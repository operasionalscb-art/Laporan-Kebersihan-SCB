import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  limit,
  writeBatch,
  serverTimestamp,
  FieldValue,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  CleaningReport,
  User,
  MasterRoom,
  MasterChecklist,
  FormSettings,
  RoomSchedule,
  PublicDailyNotificationSummary,
  PublicNotificationItem,
} from '../types';
import {
  INITIAL_USERS,
  canonicalizeUsersToOfficial,
  saveReports as saveReportsToStorage,
  getReports as getReportsFromStorage,
  saveUsers as saveUsersToStorage,
  getUsers as getUsersFromStorage,
  getTodayDateString,
} from '../utils/storage';
import {
  getMasterRooms,
  saveMasterRooms,
  getMasterChecklists,
  saveMasterChecklists,
  getFormSettings,
  saveFormSettings,
  getRoomSchedules,
  saveRoomSchedules,
  sanitizeSchedulesToOfficial,
  getMandatoryTargetRoomsForDate,
  DEFAULT_MASTER_ROOMS,
  DEFAULT_MASTER_CHECKLISTS,
  DEFAULT_FORM_SETTINGS,
  DEFAULT_ROOM_SCHEDULES,
} from '../utils/formStorage';
import {
  recompressImageDataUrl,
  createMicroThumbnail,
} from '../utils/imageCompressor';
import {
  recordFirestoreRead,
  recordFirestoreWrite,
  recordFirestoreDelete,
  setFirestoreActiveListener,
} from './firestoreMeter';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  if (isQuotaExceededError(error)) {
    notifyQuotaStatus(true);
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const REPORTS_COLLECTION = 'reports';
const REPORT_PHOTOS_COLLECTION = 'report_photos';
const USERS_COLLECTION = 'users';
const FORM_CONFIGS_COLLECTION = 'form_configs';
const ROOM_SCHEDULES_COLLECTION = 'room_schedules';
const STAFF_ROLES_COLLECTION = 'staff_roles';
const ADMINS_COLLECTION = 'admins';
const PUBLIC_SUMMARY_COLLECTION = 'public_summary';

const SUPERADMIN_EMAIL = 'operasional.scb@gmail.com';
const FORM_CONFIG_DOC_ID = 'config_form_configs';
const ROOM_SCHEDULE_DOC_ID = 'config_room_schedules';
const PUBLIC_SUMMARY_DOC_ID = 'daily_notifications';

export const LIVE_REPORT_WINDOW_DAYS = 7;
export const MONTH_REPORT_WINDOW_DAYS = 35;
export const DEFAULT_REPORT_WINDOW_DAYS = MONTH_REPORT_WINDOW_DAYS;
const CONFIG_CACHE_TTL_MS = 30 * 60 * 1000; // 30 menit cache config & jadwal untuk non-superadmin
const GUEST_REPORTS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 menit cache laporan 7 hari untuk tamu
const PUBLIC_SUMMARY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 menit cache notifikasi tamu (0 read saat F5)
const MONTH_REPORTS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam cache riwayat 8-35 hari
const OLDER_REPORTS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam cache riwayat >35 hari
const SELF_USER_CACHE_TTL_MS = 60 * 60 * 1000; // 60 menit cache profil sendiri untuk non-superadmin
const IDLE_LISTENER_PAUSE_MS = 5 * 60 * 1000; // Jeda listener live jika tab idle > 5 menit

const UNSYNCED_REPORT_IDS_KEY = 'scb_unsynced_report_ids_v1';
const UNSYNCED_USER_IDS_KEY = 'scb_unsynced_user_ids_v1';
const UNSYNCED_FORM_CONFIG_KEY = 'scb_unsynced_form_config_v1';
const UNSYNCED_SCHEDULES_KEY = 'scb_unsynced_schedules_v1';
const CLOUD_CANONICAL_USERS_KEY = 'scb_cloud_canonical_users_v2';
const CLOUD_CANONICAL_SCHEDULES_KEY = 'scb_cloud_canonical_schedules_v2';
const FORM_CONFIG_FETCHED_AT_KEY = 'scb_form_config_fetched_at_v1';
const SCHEDULES_FETCHED_AT_KEY = 'scb_schedules_fetched_at_v1';
const GUEST_REPORTS_FETCHED_AT_KEY = 'scb_guest_reports_fetched_at_v1';
const PUBLIC_SUMMARY_CACHE_KEY = 'scb_public_summary_cache_v1';
const PUBLIC_SUMMARY_HASH_KEY = 'scb_public_summary_hash_v1';
const MONTH_REPORTS_FETCHED_AT_KEY = 'scb_month_reports_fetched_at_v1';
const OLDER_REPORTS_FETCHED_AT_KEY = 'scb_older_reports_fetched_at_v1';
const SELF_USER_FETCHED_AT_KEY = 'scb_self_user_fetched_at_v1';
const ADMIN_BOOTSTRAPPED_UID_KEY = 'scb_admin_bootstrapped_uid_v1';
const LEGACY_MIGRATION_CHECKED_KEY = 'scb_legacy_config_migrated_v1';
const STAFF_ROLES_HASH_KEY = 'scb_staff_roles_hash_v1';

export interface CloudSaveResult {
  status: 'synced' | 'local_unauthenticated' | 'local_quota' | 'local_error';
  message?: string;
}

let isUsersSeeded = false;
let lastBootstrappedAdminUid: string | null = null;
let lastBackfilledAdminUid: string | null = null;
let lastBackfillAttemptMs = 0;
let olderCloudReportsLoaded = false;
let inFlightPendingReportsSync: Promise<number> | null = null;
let inFlightMonthReportsFetch: Promise<void> | null = null;
const hydratedPhotoIds = new Set<string>();

let isQuotaLimitedState = false;
const quotaStatusListeners = new Set<(limited: boolean) => void>();
const unsyncedCountListeners = new Set<(count: number) => void>();

function notifyQuotaStatus(limited: boolean): void {
  if (isQuotaLimitedState !== limited) {
    isQuotaLimitedState = limited;
    quotaStatusListeners.forEach((cb) => {
      try {
        cb(limited);
      } catch {
        // Ignore subscriber error
      }
    });
  }
}

export function subscribeQuotaStatus(callback: (limited: boolean) => void): () => void {
  quotaStatusListeners.add(callback);
  callback(isQuotaLimitedState);
  return () => {
    quotaStatusListeners.delete(callback);
  };
}

export function hasLoadedOlderCloudReports(): boolean {
  return olderCloudReportsLoaded;
}

function getUnsyncedIdSet(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function notifyUnsyncedCount(): void {
  const count = getUnsyncedIdSet(UNSYNCED_REPORT_IDS_KEY).size;
  unsyncedCountListeners.forEach((cb) => {
    try {
      cb(count);
    } catch {
      // Ignore subscriber error
    }
  });
}

export function getPendingUnsyncedReportIds(): string[] {
  return Array.from(getUnsyncedIdSet(UNSYNCED_REPORT_IDS_KEY));
}

export function subscribePendingUnsyncedCount(callback: (count: number) => void): () => void {
  unsyncedCountListeners.add(callback);
  callback(getUnsyncedIdSet(UNSYNCED_REPORT_IDS_KEY).size);
  return () => {
    unsyncedCountListeners.delete(callback);
  };
}

function saveUnsyncedIdSet(storageKey: string, ids: Set<string>): void {
  try {
    if (ids.size === 0) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(ids)));
    }
  } catch {
    // Ignore storage quota errors on metadata tracking
  }
  if (storageKey === UNSYNCED_REPORT_IDS_KEY) {
    notifyUnsyncedCount();
  }
}

function markUnsyncedId(storageKey: string, id: string): void {
  const ids = getUnsyncedIdSet(storageKey);
  ids.add(id);
  saveUnsyncedIdSet(storageKey, ids);
}

function unmarkUnsyncedId(storageKey: string, id: string): void {
  const ids = getUnsyncedIdSet(storageKey);
  if (ids.delete(id)) {
    saveUnsyncedIdSet(storageKey, ids);
  }
}

export function clearUnsyncedTrackers(): void {
  try {
    localStorage.removeItem(UNSYNCED_REPORT_IDS_KEY);
    localStorage.removeItem(UNSYNCED_USER_IDS_KEY);
    localStorage.removeItem(UNSYNCED_FORM_CONFIG_KEY);
    localStorage.removeItem(UNSYNCED_SCHEDULES_KEY);
  } catch {}
  notifyUnsyncedCount();
}

function hasUnsyncedFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function setUnsyncedFlag(key: string, pending: boolean): void {
  try {
    if (pending) {
      localStorage.setItem(key, 'true');
    } else {
      localStorage.removeItem(key);
    }
  } catch {}
}

export function resetCloudSyncSessionFlags(): void {
  isUsersSeeded = false;
  lastBootstrappedAdminUid = null;
  lastBackfilledAdminUid = null;
  lastBackfillAttemptMs = 0;
}

export function isFirebaseCloudConnected(): boolean {
  return Boolean(auth.currentUser?.email && auth.currentUser?.emailVerified);
}

export function toEmailKey(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export function isCurrentAuthSuperAdmin(): boolean {
  const email = auth.currentUser?.email?.trim().toLowerCase();
  return Boolean(email && email === SUPERADMIN_EMAIL && auth.currentUser?.emailVerified);
}

export function isQuotaExceededError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  const code = (err as { code?: string })?.code;
  return code === 'resource-exhausted' || msg.includes('quota') || msg.includes('resource-exhausted');
}

/**
 * Strips any undefined fields before writing to Firestore,
 * preserving FieldValue sentinels (e.g. serverTimestamp) and Timestamps.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (data instanceof FieldValue || data instanceof Timestamp) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean as T;
  }
  return data;
}

const MAX_FIRESTORE_PHOTOS_BYTES = 880_000;

async function ensureReportPhotosFitLimit(rawPhotos: string[] = []): Promise<string[]> {
  const cleanPhotos = Array.isArray(rawPhotos)
    ? rawPhotos.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).slice(0, 5)
    : [];
  const calcSize = (arr: string[]) => arr.reduce((sum, item) => sum + (item?.length || 0), 0);

  if (calcSize(cleanPhotos) <= MAX_FIRESTORE_PHOTOS_BYTES) {
    return cleanPhotos;
  }

  const perPhotoBudget = Math.floor(MAX_FIRESTORE_PHOTOS_BYTES / Math.max(1, cleanPhotos.length));
  const compressionSteps: Array<[number, number, number]> = [
    [1600, 1600, 0.62],
    [1440, 1440, 0.56],
    [1280, 1280, 0.52],
    [1080, 1080, 0.46],
    [880, 880, 0.4],
  ];

  let current = cleanPhotos;
  for (const [w, h, q] of compressionSteps) {
    current = await Promise.all(
      current.map((p) => recompressImageDataUrl(p, w, h, q, perPhotoBudget))
    );
    if (calcSize(current) <= MAX_FIRESTORE_PHOTOS_BYTES) {
      return current;
    }
  }

  return current;
}

/**
 * Snaps query cutoffs to local midnight (00:00:00.000) so query constraints remain identical
 * across browser reloads on the same day, maximizing Firestore persistent cache & resume reuse.
 */
function getMidnightCutoffMs(daysAgo: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, daysAgo));
  return Math.max(1, d.getTime());
}

function getLiveWindowCutoffMs(): number {
  return getMidnightCutoffMs(LIVE_REPORT_WINDOW_DAYS);
}

function getWindowCutoffMs(): number {
  return getMidnightCutoffMs(MONTH_REPORT_WINDOW_DAYS);
}

function hasFullLocalPhotos(localRep: CleaningReport | undefined, expectedCount: number): boolean {
  if (!localRep || !Array.isArray(localRep.fotoBukti) || localRep.fotoBukti.length === 0) {
    return false;
  }
  if (expectedCount > 0 && localRep.fotoBukti.length < expectedCount) {
    return false;
  }
  return localRep.fotoBukti.some(
    (p) =>
      p.startsWith('http://') ||
      p.startsWith('https://') ||
      p.startsWith('data:image/svg+xml') ||
      p.length > 26_000
  );
}

export function doesReportNeedPhotoHydration(report: CleaningReport): boolean {
  if (!report.photosOffloaded) return false;
  if (hydratedPhotoIds.has(report.id)) return false;
  const expectedCount = report.fotoCount ?? report.fotoBukti?.length ?? 0;
  if (
    expectedCount > 0 &&
    Array.isArray(report.drivePhotoLinks) &&
    report.drivePhotoLinks.length >= expectedCount &&
    report.drivePhotoLinks.every((l) => typeof l === 'string' && l.startsWith('http'))
  ) {
    return false;
  }
  return !hasFullLocalPhotos(report, expectedCount);
}

function buildNormalizedCloudReport(docId: string, raw: CleaningReport): CleaningReport {
  const fotos = Array.isArray(raw.fotoBukti) ? raw.fotoBukti : [];
  return {
    ...raw,
    id: raw.id || docId,
    checklist: Array.isArray(raw.checklist) ? raw.checklist : [],
    keteranganTambahan: raw.keteranganTambahan ?? '',
    fotoBukti: fotos,
    fotoCount: typeof raw.fotoCount === 'number' ? raw.fotoCount : fotos.length,
    photosOffloaded: Boolean(raw.photosOffloaded),
    drivePhotoLinks: Array.isArray(raw.drivePhotoLinks) ? raw.drivePhotoLinks : undefined,
  };
}

function mergeCloudWithLocalReports(
  cloudReportsList: CleaningReport[],
  localReports: CleaningReport[],
  unsyncedIds: Set<string>,
  preserveOlderLocalCutoffMs?: number
): CleaningReport[] {
  const localById = new Map(localReports.map((r) => [r.id, r]));
  const cloudIds = new Set(cloudReportsList.map((r) => r.id));

  const mergedCloud = cloudReportsList.map((cloudRep) => {
    const localVersion = localById.get(cloudRep.id);
    if (unsyncedIds.has(cloudRep.id) && localVersion) {
      return localVersion;
    }

    const cloudDriveLinks = (cloudRep.drivePhotoLinks || []).filter(
      (l) => typeof l === 'string' && l.startsWith('http')
    );
    const localDriveLinks = (localVersion?.drivePhotoLinks || []).filter(
      (l) => typeof l === 'string' && l.startsWith('http')
    );

    if (localVersion && localDriveLinks.length > cloudDriveLinks.length) {
      markUnsyncedId(UNSYNCED_REPORT_IDS_KEY, cloudRep.id);
      const localHasHttpPhotos =
        Array.isArray(localVersion.fotoBukti) &&
        localVersion.fotoBukti.length > 0 &&
        localVersion.fotoBukti.every((p) => p.startsWith('http'));
      return {
        ...cloudRep,
        drivePhotoLinks: localVersion.drivePhotoLinks,
        fotoBukti: localHasHttpPhotos ? localVersion.fotoBukti : cloudRep.fotoBukti,
        fotoCount: localHasHttpPhotos
          ? localVersion.fotoBukti.length
          : cloudRep.fotoCount ?? localVersion.fotoCount,
        photosOffloaded: localHasHttpPhotos ? false : cloudRep.photosOffloaded,
      };
    }

    if (
      cloudRep.photosOffloaded &&
      localVersion &&
      (hydratedPhotoIds.has(cloudRep.id) ||
        hasFullLocalPhotos(localVersion, cloudRep.fotoCount ?? cloudRep.fotoBukti.length))
    ) {
      return {
        ...cloudRep,
        fotoBukti: localVersion.fotoBukti,
        fotoCount: cloudRep.fotoCount ?? localVersion.fotoBukti.length,
        drivePhotoLinks:
          cloudDriveLinks.length >= localDriveLinks.length
            ? cloudRep.drivePhotoLinks
            : localVersion.drivePhotoLinks,
      };
    }
    return cloudRep;
  });

  const preservedLocalOnly = localReports.filter((r) => {
    if (cloudIds.has(r.id)) return false;
    if (unsyncedIds.has(r.id)) return true;
    if (preserveOlderLocalCutoffMs !== undefined && (r.timestamp || 0) <= preserveOlderLocalCutoffMs) {
      return true;
    }
    return false;
  });

  const merged = [...mergedCloud, ...preservedLocalOnly];
  merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return merged;
}

function isCacheFresh(storageKey: string, ttlMs: number): boolean {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && ts > 0 && Date.now() - ts < ttlMs;
  } catch {
    return false;
  }
}

function markCacheFetchedNow(storageKey: string): void {
  try {
    localStorage.setItem(storageKey, String(Date.now()));
  } catch {
    // Ignore quota errors
  }
}

function processFetchedReportDocs(
  docs: Array<{ id: string; data: () => unknown }>
): CleaningReport[] {
  const reportsList: CleaningReport[] = [];
  docs.forEach((docSnap) => {
    if (['rep-1', 'rep-2', 'rep-3', 'rep-4'].includes(docSnap.id)) {
      if (isCurrentAuthSuperAdmin()) {
        deleteDoc(doc(db, REPORTS_COLLECTION, docSnap.id))
          .then(() => recordFirestoreDelete('reports', 1))
          .catch(() => {});
      }
    } else {
      const raw = docSnap.data() as CleaningReport;
      reportsList.push(buildNormalizedCloudReport(docSnap.id, raw));
    }
  });
  return reportsList;
}

/**
 * Loads days 8..35 reports at most once per 6 hours (via localStorage TTL)
 * so monthly compliance charts work without re-reading 35 days on every F5 or live listener.
 */
async function loadMonthReportsFromCloudIfStale(force = false): Promise<void> {
  if (!force && isCacheFresh(MONTH_REPORTS_FETCHED_AT_KEY, MONTH_REPORTS_CACHE_TTL_MS)) {
    return;
  }
  if (inFlightMonthReportsFetch) {
    return inFlightMonthReportsFetch;
  }

  const liveCutoffMs = getLiveWindowCutoffMs();
  const monthCutoffMs = getWindowCutoffMs();

  inFlightMonthReportsFetch = (async () => {
    try {
      const q = query(
        collection(db, REPORTS_COLLECTION),
        where('timestamp', '>', monthCutoffMs),
        where('timestamp', '<=', liveCutoffMs)
      );
      const snapshot = await getDocs(q);
      recordFirestoreRead('reports', Math.max(1, snapshot.size), snapshot.metadata?.fromCache);
      notifyQuotaStatus(false);
      markCacheFetchedNow(MONTH_REPORTS_FETCHED_AT_KEY);

      const monthSliceList = processFetchedReportDocs(snapshot.docs);
      const localReports = getReportsFromStorage();
      const unsyncedIds = getUnsyncedIdSet(UNSYNCED_REPORT_IDS_KEY);
      const existingRecentOrOlder = localReports.filter(
        (r) => (r.timestamp || 0) > liveCutoffMs || (r.timestamp || 0) <= monthCutoffMs
      );
      const merged = mergeCloudWithLocalReports(
        [...existingRecentOrOlder, ...monthSliceList],
        localReports,
        unsyncedIds,
        monthCutoffMs
      );
      saveReportsToStorage(merged);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('scb_idb_reports_hydrated'));
      }
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaStatus(true);
        console.warn('Firestore quota exceeded while fetching monthly reports window, using local cache.');
      } else {
        console.warn('Background monthly report fetch skipped:', err);
      }
    }
  })().finally(() => {
    inFlightMonthReportsFetch = null;
  });

  return inFlightMonthReportsFetch;
}

/**
 * Subscribes to reports with quota-efficient strategy:
 * - Unauthenticated Guests: 10-minute local cache first (0 reads on repeat visits/F5),
 *   then one-shot getDocs on a 7-day midnight-snapped window + 6h-cached monthly window.
 * - Authenticated Staff: live onSnapshot ONLY on the 7-day midnight-snapped window
 *   (backed by IndexedDB persistentLocalCache) + 6h-cached monthly history.
 */
export function subscribeReports(
  onReportsChanged: (reports: CleaningReport[]) => void,
  onError?: (err: Error) => void
): () => void {
  const liveCutoffMs = getLiveWindowCutoffMs();
  const reportsRef = collection(db, REPORTS_COLLECTION);
  const q = query(reportsRef, where('timestamp', '>', liveCutoffMs));

  const applyRecentCloudReports = (reportsList: CleaningReport[]) => {
    const localReports = getReportsFromStorage();
    const unsyncedIds = getUnsyncedIdSet(UNSYNCED_REPORT_IDS_KEY);

    if (reportsList.length === 0 && localReports.length > 0) {
      const sortedLocal = [...localReports].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      onReportsChanged(sortedLocal);

      const pendingRecent = sortedLocal.filter(
        (rep) => unsyncedIds.has(rep.id) || (rep.timestamp || 0) > liveCutoffMs
      );
      if (pendingRecent.length > 0) {
        pendingRecent.forEach((rep) => markUnsyncedId(UNSYNCED_REPORT_IDS_KEY, rep.id));
      }
      const nowMs = Date.now();
      if (isFirebaseCloudConnected() && pendingRecent.length > 0 && nowMs - lastBackfillAttemptMs > 15_000) {
        lastBackfillAttemptMs = nowMs;
        syncPendingLocalReportsToCloud().catch(() => {});
      }
      return;
    }

    // Preserve older local/monthly reports <= liveCutoffMs
    const merged = mergeCloudWithLocalReports(reportsList, localReports, unsyncedIds, liveCutoffMs);
    saveReportsToStorage(merged);
    onReportsChanged(merged);

    const pendingToSync = merged.filter((r) => unsyncedIds.has(r.id));
    const nowMs = Date.now();
    if (pendingToSync.length > 0 && isFirebaseCloudConnected() && nowMs - lastBackfillAttemptMs > 15_000) {
      lastBackfillAttemptMs = nowMs;
      syncPendingLocalReportsToCloud().catch(() => {});
    }
  };

  // Guest optimization: avoid opening live WebSocket onSnapshot listeners for public dashboard views
  if (!isFirebaseCloudConnected()) {
    const localReports = getReportsFromStorage();
    if (localReports.length > 0 && isCacheFresh(GUEST_REPORTS_FETCHED_AT_KEY, GUEST_REPORTS_CACHE_TTL_MS)) {
      const sortedLocal = [...localReports].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      onReportsChanged(sortedLocal);
      loadMonthReportsFromCloudIfStale().catch(() => {});
      return () => {};
    }

    let cancelled = false;
    getDocs(q)
      .then((snapshot) => {
        if (cancelled) return;
        recordFirestoreRead('reports', Math.max(1, snapshot.size), snapshot.metadata?.fromCache);
        notifyQuotaStatus(false);
        markCacheFetchedNow(GUEST_REPORTS_FETCHED_AT_KEY);
        const reportsList = processFetchedReportDocs(snapshot.docs);
        applyRecentCloudReports(reportsList);
        loadMonthReportsFromCloudIfStale().catch(() => {});
      })
      .catch((error) => {
        if (cancelled) return;
        const fallback = getReportsFromStorage();
        onReportsChanged(fallback);
        if (onError) onError(error);
        if (isQuotaExceededError(error)) {
          notifyQuotaStatus(true);
          console.warn('Firestore quota exceeded on guest reports fetch, using local storage cache.');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, REPORTS_COLLECTION);
      });

    return () => {
      cancelled = true;
    };
  }

  // Authenticated staff: 7-day live listener (pauses automatically when tab is hidden > 5 min) + 12h monthly cache
  loadMonthReportsFromCloudIfStale().catch(() => {});

  let disposed = false;
  let activeSnapshotUnsub: (() => void) | null = null;
  let idlePauseTimer: ReturnType<typeof setTimeout> | null = null;

  const attachLiveListener = () => {
    if (disposed || activeSnapshotUnsub) return;
    let isInitialSnapshot = true;
    setFirestoreActiveListener('Laporan 7 Hari', true);
    activeSnapshotUnsub = onSnapshot(
      q,
      (snapshot) => {
        const changesCount = snapshot.docChanges().length;
        const billedCount = changesCount > 0 ? changesCount : isInitialSnapshot ? 1 : 0;
        isInitialSnapshot = false;
        recordFirestoreRead('reports', billedCount, snapshot.metadata?.fromCache);
        notifyQuotaStatus(false);
        markCacheFetchedNow(GUEST_REPORTS_FETCHED_AT_KEY);
        const reportsList = processFetchedReportDocs(snapshot.docs);
        applyRecentCloudReports(reportsList);
        syncPublicDailyNotificationsToCloud().catch(() => {});
      },
      (error) => {
        const fallback = getReportsFromStorage();
        onReportsChanged(fallback);
        if (onError) onError(error);
        if (isQuotaExceededError(error)) {
          notifyQuotaStatus(true);
          console.warn('Firestore quota exceeded on reports listener, using local storage cache.');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, REPORTS_COLLECTION);
      }
    );
  };

  const handleVisibilityChange = () => {
    if (disposed || typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      if (!idlePauseTimer) {
        idlePauseTimer = setTimeout(() => {
          idlePauseTimer = null;
          if (activeSnapshotUnsub) {
            activeSnapshotUnsub();
            activeSnapshotUnsub = null;
            setFirestoreActiveListener('Laporan 7 Hari', false);
          }
        }, IDLE_LISTENER_PAUSE_MS);
      }
    } else if (document.visibilityState === 'visible') {
      if (idlePauseTimer) {
        clearTimeout(idlePauseTimer);
        idlePauseTimer = null;
      }
      if (!activeSnapshotUnsub) {
        attachLiveListener();
      }
    }
  };

  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
    attachLiveListener();
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return () => {
    disposed = true;
    if (idlePauseTimer) {
      clearTimeout(idlePauseTimer);
      idlePauseTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (activeSnapshotUnsub) {
      activeSnapshotUnsub();
      activeSnapshotUnsub = null;
    }
    setFirestoreActiveListener('Laporan 7 Hari', false);
  };
}

/**
 * Manual on-demand refresh of the 7-day report window (plus stale monthly cache & configs),
 * so users/guests can pull fresh updates without reloading the entire browser tab.
 */
export async function refreshReportsFromCloudNow(): Promise<{
  syncedCount: number;
  quotaExceeded?: boolean;
}> {
  const liveCutoffMs = getLiveWindowCutoffMs();
  try {
    const q = query(collection(db, REPORTS_COLLECTION), where('timestamp', '>', liveCutoffMs));
    const snapshot = await getDocs(q);
    recordFirestoreRead('reports', Math.max(1, snapshot.size), snapshot.metadata?.fromCache);
    notifyQuotaStatus(false);
    markCacheFetchedNow(GUEST_REPORTS_FETCHED_AT_KEY);

    const freshList = processFetchedReportDocs(snapshot.docs);
    const localReports = getReportsFromStorage();
    const unsyncedIds = getUnsyncedIdSet(UNSYNCED_REPORT_IDS_KEY);
    const merged = mergeCloudWithLocalReports(freshList, localReports, unsyncedIds, liveCutoffMs);
    saveReportsToStorage(merged);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('scb_idb_reports_hydrated'));
    }

    // Also pull latest form config & schedules once on explicit manual refresh
    if (!hasUnsyncedFlag(UNSYNCED_FORM_CONFIG_KEY)) {
      const formSnap = await getDoc(doc(db, FORM_CONFIGS_COLLECTION, FORM_CONFIG_DOC_ID)).catch(() => null);
      if (formSnap) {
        recordFirestoreRead('configs', 1, formSnap.metadata?.fromCache);
      }
      if (formSnap?.exists()) {
        const data = formSnap.data();
        if (Array.isArray(data?.rooms)) saveMasterRooms(data.rooms);
        if (Array.isArray(data?.checklists)) saveMasterChecklists(data.checklists);
        if (data?.settings) saveFormSettings(data.settings);
        markCacheFetchedNow(FORM_CONFIG_FETCHED_AT_KEY);
      }
    }
    if (!hasUnsyncedFlag(UNSYNCED_SCHEDULES_KEY)) {
      const schedSnap = await getDoc(doc(db, ROOM_SCHEDULES_COLLECTION, ROOM_SCHEDULE_DOC_ID)).catch(() => null);
      if (schedSnap) {
        recordFirestoreRead('configs', 1, schedSnap.metadata?.fromCache);
      }
      if (schedSnap?.exists() && Array.isArray(schedSnap.data()?.schedules)) {
        saveRoomSchedules(sanitizeSchedulesToOfficial(schedSnap.data().schedules));
        markCacheFetchedNow(SCHEDULES_FETCHED_AT_KEY);
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('scb_config_hydrated'));
    }

    await loadMonthReportsFromCloudIfStale(false);
    return { syncedCount: freshList.length };
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      return { syncedCount: 0, quotaExceeded: true };
    }
    console.warn('Manual cloud reports refresh failed:', err);
    return { syncedCount: 0 };
  }
}

/**
 * Loads older reports (> 35 days old) on demand when the user selects "Semua" or an older month filter.
 * Cached in localStorage for 6 hours so page reloads don't re-scan archived reports.
 */
export async function loadOlderReportsFromCloud(): Promise<{
  loadedCount: number;
  quotaExceeded?: boolean;
}> {
  if (olderCloudReportsLoaded || isCacheFresh(OLDER_REPORTS_FETCHED_AT_KEY, OLDER_REPORTS_CACHE_TTL_MS)) {
    olderCloudReportsLoaded = true;
    return { loadedCount: 0 };
  }

  const windowCutoffMs = getWindowCutoffMs();
  try {
    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('timestamp', '>', 0),
      where('timestamp', '<=', windowCutoffMs)
    );
    const snapshot = await getDocs(q);
    recordFirestoreRead('reports', Math.max(1, snapshot.size), snapshot.metadata?.fromCache);
    notifyQuotaStatus(false);
    olderCloudReportsLoaded = true;
    markCacheFetchedNow(OLDER_REPORTS_FETCHED_AT_KEY);

    const olderCloudList: CleaningReport[] = [];
    snapshot.forEach((docSnap) => {
      if (!['rep-1', 'rep-2', 'rep-3', 'rep-4'].includes(docSnap.id)) {
        olderCloudList.push(buildNormalizedCloudReport(docSnap.id, docSnap.data() as CleaningReport));
      }
    });

    if (olderCloudList.length > 0) {
      const localReports = getReportsFromStorage();
      const unsyncedIds = getUnsyncedIdSet(UNSYNCED_REPORT_IDS_KEY);
      const existingRecentOrLocal = localReports.filter((r) => (r.timestamp || 0) > windowCutoffMs);
      const merged = mergeCloudWithLocalReports(
        [...existingRecentOrLocal, ...olderCloudList],
        localReports,
        unsyncedIds
      );
      saveReportsToStorage(merged);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('scb_idb_reports_hydrated'));
      }
    }

    return { loadedCount: olderCloudList.length };
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      console.warn('Firestore quota exceeded while loading older reports.');
      return { loadedCount: 0, quotaExceeded: true };
    }
    console.warn('Failed to load older reports:', err);
    return { loadedCount: 0 };
  }
}

/**
 * Fetches full-resolution photos for a specific report from /report_photos/{reportId} on demand,
 * caching them into local/IDB storage so subsequent views cost 0 Firestore reads.
 */
export async function fetchReportPhotosFromCloud(reportId: string): Promise<string[] | null> {
  if (!reportId) return null;

  const localReports = getReportsFromStorage();
  const localRep = localReports.find((r) => r.id === reportId);
  if (
    localRep &&
    (!localRep.photosOffloaded ||
      hydratedPhotoIds.has(reportId) ||
      hasFullLocalPhotos(localRep, localRep.fotoCount ?? localRep.fotoBukti?.length ?? 0))
  ) {
    return localRep.fotoBukti || [];
  }

  try {
    const snap = await getDoc(doc(db, REPORT_PHOTOS_COLLECTION, reportId));
    recordFirestoreRead('report_photos', 1, snap.metadata?.fromCache);
    notifyQuotaStatus(false);
    if (!snap.exists()) {
      return localRep?.fotoBukti || null;
    }

    const data = snap.data();
    const photos = Array.isArray(data?.photos)
      ? data.photos.filter((p): p is string => typeof p === 'string')
      : [];

    hydratedPhotoIds.add(reportId);

    if (photos.length > 0) {
      const latest = getReportsFromStorage();
      const idx = latest.findIndex((r) => r.id === reportId);
      if (idx >= 0) {
        latest[idx] = {
          ...latest[idx],
          fotoBukti: photos,
          fotoCount: photos.length,
        };
        saveReportsToStorage(latest);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('scb_idb_reports_hydrated'));
        }
      }
    }

    return photos;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      console.warn('Firestore quota exceeded while fetching full report photos, using cached thumbnail.');
      return localRep?.fotoBukti || null;
    }
    console.warn(`Could not fetch report_photos/${reportId}:`, err);
    return localRep?.fotoBukti || null;
  }
}

/**
 * Deletes temporary base64 document in /report_photos/{reportId} once Superadmin
 * has archived the full photos to Google Drive and updated /reports/{reportId} with Drive URLs.
 */
export async function cleanupTemporaryReportPhotosInCloud(reportId: string): Promise<void> {
  if (!reportId || !isCurrentAuthSuperAdmin()) return;
  try {
    await deleteDoc(doc(db, REPORT_PHOTOS_COLLECTION, reportId));
    recordFirestoreDelete('report_photos', 1);
  } catch (err) {
    console.warn(`Could not cleanup temporary report_photos/${reportId}:`, err);
  }
}

/**
 * Create a new cleaning report in Firestore (summary + micro-thumbnail in /reports, full photos in /report_photos)
 * and keep full-resolution photos in local/IndexedDB storage.
 */
export async function saveReportToCloud(report: CleaningReport): Promise<CloudSaveResult> {
  const safePhotos = await ensureReportPhotosFitLimit(report.fotoBukti);
  const resolvedAuthorUid = report.authorUid || auth.currentUser?.uid || undefined;
  const isOffloaded = safePhotos.some(
    (p) => p.startsWith('data:image/') && !p.startsWith('data:image/svg+xml')
  );

  const preparedLocalReport: CleaningReport = {
    ...report,
    checklist: Array.isArray(report.checklist) ? report.checklist : [],
    keteranganTambahan: report.keteranganTambahan ?? '',
    fotoBukti: safePhotos,
    fotoCount: safePhotos.length,
    photosOffloaded: isOffloaded,
    authorUid: resolvedAuthorUid,
  };

  if (isOffloaded || safePhotos.length > 0) {
    hydratedPhotoIds.add(preparedLocalReport.id);
  }

  const current = getReportsFromStorage();
  const existingIdx = current.findIndex((r) => r.id === preparedLocalReport.id);
  if (existingIdx >= 0) {
    current[existingIdx] = preparedLocalReport;
  } else {
    current.unshift(preparedLocalReport);
  }
  saveReportsToStorage(current);

  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    markUnsyncedId(UNSYNCED_REPORT_IDS_KEY, preparedLocalReport.id);
    return {
      status: 'local_unauthenticated',
      message: 'Laporan & foto tersimpan di perangkat ini. Masuk ulang dengan Email & Sandi agar sinkron ke Dashboard semua pengguna.',
    };
  }

  const path = `${REPORTS_COLLECTION}/${preparedLocalReport.id}`;
  try {
    const cloudFotoBukti = isOffloaded ? [await createMicroThumbnail(safePhotos[0])] : safePhotos;
    const cloudSummaryReport: CleaningReport = {
      ...preparedLocalReport,
      fotoBukti: cloudFotoBukti,
      fotoCount: safePhotos.length,
      photosOffloaded: isOffloaded,
    };

    const batch = writeBatch(db);
    const reportRef = doc(db, REPORTS_COLLECTION, preparedLocalReport.id);
    batch.set(reportRef, {
      ...sanitizeForFirestore(cloudSummaryReport),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (isOffloaded) {
      const photosRef = doc(db, REPORT_PHOTOS_COLLECTION, preparedLocalReport.id);
      batch.set(photosRef, sanitizeForFirestore({
        id: preparedLocalReport.id,
        photos: safePhotos,
        authorUid: resolvedAuthorUid,
        updatedAt: serverTimestamp(),
      }));
    }

    await batch.commit();
    recordFirestoreWrite('reports', 1);
    if (isOffloaded) {
      recordFirestoreWrite('report_photos', 1);
    }
    notifyQuotaStatus(false);
    unmarkUnsyncedId(UNSYNCED_REPORT_IDS_KEY, preparedLocalReport.id);
    syncPublicDailyNotificationsToCloud(true).catch(() => {});
    return { status: 'synced' };
  } catch (err) {
    markUnsyncedId(UNSYNCED_REPORT_IDS_KEY, preparedLocalReport.id);
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      console.warn('Firestore quota exceeded while saving report, kept in local storage.');
      return {
        status: 'local_quota',
        message: 'Kuota harian Firestore penuh. Laporan & foto aman tersimpan lokal.',
      };
    }
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

/**
 * Update specific fields on an existing cleaning report in Firestore and local storage
 */
export async function updateReportInCloud(
  id: string,
  updates: Partial<CleaningReport>
): Promise<CloudSaveResult> {
  // Mark unsynced immediately so concurrent onSnapshot emissions cannot overwrite pending updates (e.g., Drive links)
  markUnsyncedId(UNSYNCED_REPORT_IDS_KEY, id);

  const preparedUpdates: Partial<CleaningReport> = { ...updates };
  let fullUpdatedPhotos: string[] | null = null;
  let hasOffloadedPhotos = false;
  if (Array.isArray(preparedUpdates.fotoBukti)) {
    fullUpdatedPhotos = await ensureReportPhotosFitLimit(preparedUpdates.fotoBukti);
    hasOffloadedPhotos = fullUpdatedPhotos.some(
      (p) => p.startsWith('data:image/') && !p.startsWith('data:image/svg+xml')
    );
    preparedUpdates.fotoBukti = fullUpdatedPhotos;
    preparedUpdates.fotoCount = fullUpdatedPhotos.length;
    preparedUpdates.photosOffloaded = hasOffloadedPhotos;
    if (fullUpdatedPhotos.length > 0) {
      hydratedPhotoIds.add(id);
    }
  }
  if (Array.isArray(preparedUpdates.drivePhotoLinks)) {
    preparedUpdates.drivePhotoLinks = preparedUpdates.drivePhotoLinks.slice(0, 10);
  }

  const current = getReportsFromStorage();
  const idx = current.findIndex((r) => r.id === id);
  const existingAuthorUid = idx >= 0 ? current[idx].authorUid : undefined;
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...preparedUpdates };
    saveReportsToStorage(current);
  }

  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    return {
      status: 'local_unauthenticated',
      message: 'Perubahan tersimpan lokal. Masuk Cloud agar sinkron ke pengguna lain.',
    };
  }

  const path = `${REPORTS_COLLECTION}/${id}`;
  try {
    const cloudUpdates: Partial<CleaningReport> = { ...preparedUpdates };
    if (fullUpdatedPhotos !== null) {
      cloudUpdates.fotoBukti = hasOffloadedPhotos
        ? [await createMicroThumbnail(fullUpdatedPhotos[0])]
        : fullUpdatedPhotos;
      cloudUpdates.fotoCount = fullUpdatedPhotos.length;
      cloudUpdates.photosOffloaded = hasOffloadedPhotos;
    }

    const docRef = doc(db, REPORTS_COLLECTION, id);
    const sanitizedUpdates = sanitizeForFirestore(cloudUpdates);

    if (fullUpdatedPhotos !== null && hasOffloadedPhotos) {
      const batch = writeBatch(db);
      batch.update(docRef, {
        ...sanitizedUpdates,
        updatedAt: serverTimestamp(),
      });
      batch.set(
        doc(db, REPORT_PHOTOS_COLLECTION, id),
        sanitizeForFirestore({
          id,
          photos: fullUpdatedPhotos,
          authorUid: existingAuthorUid || auth.currentUser?.uid,
          updatedAt: serverTimestamp(),
        })
      );
      await batch.commit();
      recordFirestoreWrite('reports', 1);
      recordFirestoreWrite('report_photos', 1);
    } else {
      await updateDoc(docRef, {
        ...sanitizedUpdates,
        updatedAt: serverTimestamp(),
      });
      recordFirestoreWrite('reports', 1);
    }

    notifyQuotaStatus(false);
    unmarkUnsyncedId(UNSYNCED_REPORT_IDS_KEY, id);
    syncPublicDailyNotificationsToCloud(true).catch(() => {});
    return { status: 'synced' };
  } catch (err) {
    markUnsyncedId(UNSYNCED_REPORT_IDS_KEY, id);
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      console.warn('Firestore quota exceeded while updating report, kept in local storage.');
      return {
        status: 'local_quota',
        message: 'Kuota harian Firestore penuh. Perubahan aman tersimpan lokal.',
      };
    }
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Syncs any locally created/updated reports waiting in UNSYNCED_REPORT_IDS_KEY to Cloud
 * whenever a verified user is connected. Safely handles both new creates and updates.
 */
export async function syncPendingLocalReportsToCloud(): Promise<number> {
  if (!isFirebaseCloudConnected()) return 0;
  if (inFlightPendingReportsSync) {
    return inFlightPendingReportsSync;
  }

  inFlightPendingReportsSync = (async () => {
    const unsyncedIds = getUnsyncedIdSet(UNSYNCED_REPORT_IDS_KEY);
    if (unsyncedIds.size === 0) return 0;

    const localReports = getReportsFromStorage();
    const localById = new Map(localReports.map((r) => [r.id, r]));

    // Prune orphan IDs that no longer exist locally
    for (const id of Array.from(unsyncedIds)) {
      if (!localById.has(id)) {
        unmarkUnsyncedId(UNSYNCED_REPORT_IDS_KEY, id);
      }
    }

    const pendingReports = localReports.filter((r) => unsyncedIds.has(r.id));
    if (pendingReports.length === 0) return 0;

    let syncedCount = 0;
    for (const rep of pendingReports) {
      try {
        const existingSnap = await getDoc(doc(db, REPORTS_COLLECTION, rep.id));
        recordFirestoreRead('reports', 1, existingSnap.metadata?.fromCache);
        if (!existingSnap.exists()) {
          const res = await saveReportToCloud({
            ...rep,
            authorUid: rep.authorUid || auth.currentUser?.uid || undefined,
          });
          if (res.status === 'synced') {
            syncedCount++;
          }
        } else {
          // Document already exists in Firestore: apply safe field update or mark synced
          const cloudData = existingSnap.data() as CleaningReport;
          const updates: Partial<CleaningReport> = {};
          const localDriveLinks = (rep.drivePhotoLinks || []).filter((l) => l && l.startsWith('http'));
          const cloudDriveLinks = (cloudData.drivePhotoLinks || []).filter((l) => l && l.startsWith('http'));
          if (localDriveLinks.length > 0 && localDriveLinks.length >= cloudDriveLinks.length) {
            updates.drivePhotoLinks = rep.drivePhotoLinks;
            if (Array.isArray(rep.fotoBukti) && rep.fotoBukti.some((p) => p.startsWith('http'))) {
              updates.fotoBukti = rep.fotoBukti;
              updates.fotoCount = rep.fotoCount ?? rep.fotoBukti.length;
              updates.photosOffloaded = Boolean(rep.photosOffloaded);
            }
          }
          if (
            rep.statusVerifikasi &&
            rep.statusVerifikasi !== cloudData.statusVerifikasi &&
            rep.statusVerifikasi !== 'Menunggu'
          ) {
            updates.statusVerifikasi = rep.statusVerifikasi;
            updates.catatanSupervisor = rep.catatanSupervisor || '';
            updates.diverifikasiOleh = rep.diverifikasiOleh;
            updates.diverifikasiPada = rep.diverifikasiPada;
          }
          if (Object.keys(updates).length > 0) {
            const res = await updateReportInCloud(rep.id, updates);
            if (res.status === 'synced') {
              syncedCount++;
            }
          } else {
            unmarkUnsyncedId(UNSYNCED_REPORT_IDS_KEY, rep.id);
            syncedCount++;
          }
        }
      } catch (err) {
        console.warn(`Pending report sync skipped for ${rep.id}:`, err);
      }
    }
    return syncedCount;
  })().finally(() => {
    inFlightPendingReportsSync = null;
  });

  return inFlightPendingReportsSync;
}

/**
 * Explicitly retries Cloud sync for a single report ID (used by Retry button after failure/re-auth).
 */
export async function retrySingleReportCloudSync(reportId: string): Promise<CloudSaveResult> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    return {
      status: 'local_unauthenticated',
      message: 'Sesi Cloud belum aktif. Masuk dengan Email & Kata Sandi Anda untuk mengirim laporan ke Dashboard pusat.',
    };
  }

  const localReports = getReportsFromStorage();
  const target = localReports.find((r) => r.id === reportId);
  if (!target) {
    unmarkUnsyncedId(UNSYNCED_REPORT_IDS_KEY, reportId);
    return { status: 'synced' };
  }

  try {
    const existingSnap = await getDoc(doc(db, REPORTS_COLLECTION, reportId));
    recordFirestoreRead('reports', 1, existingSnap.metadata?.fromCache);
    if (!existingSnap.exists()) {
      return await saveReportToCloud({
        ...target,
        authorUid: target.authorUid || auth.currentUser.uid,
      });
    }
    const cloudData = existingSnap.data() as CleaningReport;
    const localDriveLinks = (target.drivePhotoLinks || []).filter((l) => l && l.startsWith('http'));
    const cloudDriveLinks = (cloudData.drivePhotoLinks || []).filter((l) => l && l.startsWith('http'));
    if (localDriveLinks.length > cloudDriveLinks.length) {
      return await updateReportInCloud(reportId, {
        drivePhotoLinks: target.drivePhotoLinks,
        fotoBukti: target.fotoBukti,
        fotoCount: target.fotoCount ?? target.fotoBukti?.length ?? 0,
        photosOffloaded: Boolean(target.photosOffloaded),
      });
    }
    unmarkUnsyncedId(UNSYNCED_REPORT_IDS_KEY, reportId);
    return { status: 'synced' };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      return {
        status: 'local_quota',
        message: 'Kuota harian Firestore penuh. Laporan aman tersimpan di perangkat ini.',
      };
    }
    const rawMsg = err?.message || String(err || '');
    return {
      status: 'local_error',
      message: rawMsg.toLowerCase().includes('permission')
        ? 'Izin tulis Firestore ditolak. Pastikan akun email Anda terverifikasi & aktif di daftar personel SCB.'
        : `Gagal menyinkronkan ke Cloud (${rawMsg}).`,
    };
  }
}

/**
 * Delete report from Firestore and local storage
 */
export async function deleteReportFromCloud(id: string): Promise<void> {
  unmarkUnsyncedId(UNSYNCED_REPORT_IDS_KEY, id);
  hydratedPhotoIds.delete(id);
  const current = getReportsFromStorage();
  const filtered = current.filter((r) => r.id !== id);
  saveReportsToStorage(filtered);

  if (!auth.currentUser || !auth.currentUser.emailVerified) return;

  const path = `${REPORTS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, REPORTS_COLLECTION, id));
    recordFirestoreDelete('reports', 1);
    await deleteDoc(doc(db, REPORT_PHOTOS_COLLECTION, id))
      .then(() => recordFirestoreDelete('report_photos', 1))
      .catch(() => {});
    syncPublicDailyNotificationsToCloud(true).catch(() => {});
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      console.warn('Firestore quota exceeded while deleting report, kept in local storage.');
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Batch replace reports in cloud (for Superadmin restore from JSON backup)
 */
export async function batchRestoreReportsToCloud(reports: CleaningReport[]): Promise<void> {
  saveReportsToStorage(reports);

  if (!auth.currentUser || !auth.currentUser.emailVerified) return;

  try {
    const snapshot = await getDocs(
      query(collection(db, REPORTS_COLLECTION), where('timestamp', '>', 0))
    );
    recordFirestoreRead('reports', Math.max(1, snapshot.size), snapshot.metadata?.fromCache);
    const chunkSize = 200;
    const existingDocs = snapshot.docs;
    for (let i = 0; i < existingDocs.length; i += chunkSize) {
      const slice = existingDocs.slice(i, i + chunkSize);
      const deleteBatch = writeBatch(db);
      for (const d of slice) {
        deleteBatch.delete(d.ref);
        deleteBatch.delete(doc(db, REPORT_PHOTOS_COLLECTION, d.id));
      }
      await deleteBatch.commit();
      recordFirestoreDelete('reports', slice.length);
      recordFirestoreDelete('report_photos', slice.length);
    }

    for (let i = 0; i < reports.length; i += chunkSize) {
      const chunk = reports.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      let photoWritesInBatch = 0;
      for (const rep of chunk) {
        const safePhotos = await ensureReportPhotosFitLimit(rep.fotoBukti);
        const isOffloaded = safePhotos.some(
          (p) => p.startsWith('data:image/') && !p.startsWith('data:image/svg+xml')
        );
        const cloudFotoBukti = isOffloaded ? [await createMicroThumbnail(safePhotos[0])] : safePhotos;
        const sanitized = sanitizeForFirestore({
          ...rep,
          checklist: Array.isArray(rep.checklist) ? rep.checklist : [],
          keteranganTambahan: rep.keteranganTambahan ?? '',
          fotoBukti: cloudFotoBukti,
          fotoCount: safePhotos.length,
          photosOffloaded: isOffloaded,
        });
        batch.set(doc(db, REPORTS_COLLECTION, rep.id), {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (isOffloaded) {
          hydratedPhotoIds.add(rep.id);
          photoWritesInBatch++;
          batch.set(
            doc(db, REPORT_PHOTOS_COLLECTION, rep.id),
            sanitizeForFirestore({
              id: rep.id,
              photos: safePhotos,
              authorUid: rep.authorUid || auth.currentUser?.uid,
              updatedAt: serverTimestamp(),
            })
          );
        }
      }
      await batch.commit();
      recordFirestoreWrite('reports', chunk.length);
      if (photoWritesInBatch > 0) {
        recordFirestoreWrite('report_photos', photoWritesInBatch);
      }
    }
    notifyQuotaStatus(false);
    saveUnsyncedIdSet(UNSYNCED_REPORT_IDS_KEY, new Set());
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      console.warn('Firestore quota exceeded during batch restore, kept in local storage.');
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, REPORTS_COLLECTION);
  }
}

/**
 * Syncs authoritative staff role document (only callable by Superadmin)
 */
async function syncStaffRoleToCloud(user: User): Promise<void> {
  if (!user.email) return;
  const emailId = toEmailKey(user.email);
  const path = `${STAFF_ROLES_COLLECTION}/${emailId}`;
  try {
    await setDoc(doc(db, STAFF_ROLES_COLLECTION, emailId), {
      email: user.email.trim().toLowerCase(),
      role: user.role,
      isActive: user.isActive !== false,
      userId: user.id,
      updatedAt: serverTimestamp(),
    });
    recordFirestoreWrite('users', 1);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      console.warn(`Firestore quota exceeded syncing ${path}, skipping.`);
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Ensures the signed-in Superadmin UID is recorded in /admins/{uid}
 * and migrates legacy config docs from /users/config_* if present.
 */
let hasCheckedLegacyMigration = false;

export async function migrateLegacyConfigsIfNeeded(): Promise<void> {
  if (
    hasCheckedLegacyMigration ||
    !isCurrentAuthSuperAdmin() ||
    localStorage.getItem(LEGACY_MIGRATION_CHECKED_KEY) === 'true'
  ) {
    hasCheckedLegacyMigration = true;
    return;
  }
  hasCheckedLegacyMigration = true;

  try {
    const newFormRef = doc(db, FORM_CONFIGS_COLLECTION, FORM_CONFIG_DOC_ID);
    const newFormSnap = await getDoc(newFormRef);
    recordFirestoreRead('configs', 1, newFormSnap.metadata?.fromCache);
    if (!newFormSnap.exists()) {
      const legacyFormSnap = await getDoc(doc(db, USERS_COLLECTION, FORM_CONFIG_DOC_ID));
      recordFirestoreRead('configs', 1, legacyFormSnap.metadata?.fromCache);
      if (legacyFormSnap.exists()) {
        const legacyData = legacyFormSnap.data();
        await setDoc(
          newFormRef,
          sanitizeForFirestore({
            rooms: Array.isArray(legacyData?.rooms) ? legacyData.rooms : DEFAULT_MASTER_ROOMS,
            checklists: Array.isArray(legacyData?.checklists)
              ? legacyData.checklists
              : DEFAULT_MASTER_CHECKLISTS,
            settings: legacyData?.settings || DEFAULT_FORM_SETTINGS,
          })
        );
        recordFirestoreWrite('configs', 1);
      }
    }

    const newSchedRef = doc(db, ROOM_SCHEDULES_COLLECTION, ROOM_SCHEDULE_DOC_ID);
    const newSchedSnap = await getDoc(newSchedRef);
    recordFirestoreRead('configs', 1, newSchedSnap.metadata?.fromCache);
    if (!newSchedSnap.exists()) {
      const legacySchedSnap = await getDoc(doc(db, USERS_COLLECTION, ROOM_SCHEDULE_DOC_ID));
      recordFirestoreRead('configs', 1, legacySchedSnap.metadata?.fromCache);
      if (legacySchedSnap.exists()) {
        const legacyData = legacySchedSnap.data();
        if (Array.isArray(legacyData?.schedules)) {
          await setDoc(
            newSchedRef,
            sanitizeForFirestore({ schedules: legacyData.schedules })
          );
          recordFirestoreWrite('configs', 1);
        }
      }
    }
    try {
      localStorage.setItem(LEGACY_MIGRATION_CHECKED_KEY, 'true');
    } catch {}
  } catch (err) {
    console.warn('Legacy config migration check note:', err);
  }
}

export async function ensureSuperAdminRecord(): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser || !isCurrentAuthSuperAdmin()) return false;
  if (isQuotaLimitedState) return false;
  try {
    if (localStorage.getItem(ADMIN_BOOTSTRAPPED_UID_KEY) === currentUser.uid) {
      return true;
    }
  } catch {}

  const path = `${ADMINS_COLLECTION}/${currentUser.uid}`;
  const targetEmail = (currentUser.email || SUPERADMIN_EMAIL).toLowerCase();
  try {
    const adminRef = doc(db, ADMINS_COLLECTION, currentUser.uid);
    const existingSnap = await getDoc(adminRef);
    recordFirestoreRead('public_summary', 1, existingSnap.metadata?.fromCache);
    if (!existingSnap.exists()) {
      await setDoc(adminRef, {
        uid: currentUser.uid,
        email: targetEmail,
        role: 'superadmin',
        createdAt: serverTimestamp(),
      });
      recordFirestoreWrite('public_summary', 1);
    } else {
      const existingData = existingSnap.data();
      if (existingData?.email !== targetEmail || existingData?.role !== 'superadmin') {
        await updateDoc(adminRef, {
          email: targetEmail,
          role: 'superadmin',
        });
        recordFirestoreWrite('public_summary', 1);
      }
    }
    await migrateLegacyConfigsIfNeeded();
    return true;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      console.warn('Firestore quota exceeded during Superadmin bootstrap, continuing in local mode.');
      return false;
    }
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Fetches a single user's own record from Firestore by email after Firebase sign-in
 */
export async function fetchUserByEmailFromCloud(email: string): Promise<User | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!auth.currentUser || !auth.currentUser.emailVerified || !cleanEmail) return null;

  const path = `${USERS_COLLECTION}?email=${cleanEmail}`;
  try {
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    recordFirestoreRead('users', Math.max(1, snap.size), snap.metadata?.fromCache);
    if (snap.empty) return null;
    return snap.docs[0].data() as User;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('Firestore quota exceeded while fetching user profile, falling back to local cache.');
      return null;
    }
    console.warn(`Could not fetch user profile from cloud (${path}):`, err);
    return null;
  }
}

/**
 * Subscribes to users list in Firestore when authenticated.
 * Superadmin receives full directory & auto-seeds empty DB; non-admins only listen to their own profile.
 */
export function subscribeUsers(
  onUsersChanged: (users: User[]) => void,
  onError?: (err: Error) => void
): () => void {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.email || !fbUser.emailVerified) {
    return () => {};
  }

  const isAdmin = isCurrentAuthSuperAdmin();
  const cleanSelfEmail = fbUser.email.trim().toLowerCase();

  // Quota optimization for Petugas/Supervisor: do NOT keep a permanent onSnapshot on /users.
  // Serve from local roster when cached within 60 minutes, otherwise run a single 1-doc getDocs.
  if (!isAdmin) {
    const existingLocal = getUsersFromStorage();
    const hasSelfLocally = existingLocal.some(
      (u) => (u.email || '').trim().toLowerCase() === cleanSelfEmail
    );
    if (hasSelfLocally && isCacheFresh(SELF_USER_FETCHED_AT_KEY, SELF_USER_CACHE_TTL_MS)) {
      onUsersChanged(existingLocal);
      return () => {};
    }

    let cancelled = false;
    const selfQuery = query(
      collection(db, USERS_COLLECTION),
      where('email', '==', cleanSelfEmail)
    );
    getDocs(selfQuery)
      .then((snapshot) => {
        if (cancelled) return;
        recordFirestoreRead('users', Math.max(1, snapshot.size), snapshot.metadata?.fromCache);
        notifyQuotaStatus(false);
        markCacheFetchedNow(SELF_USER_FETCHED_AT_KEY);
        if (snapshot.empty) {
          onUsersChanged(getUsersFromStorage());
          return;
        }
        const selfDoc = snapshot.docs[0].data() as User;
        const selfEmailLower = (selfDoc.email || '').trim().toLowerCase();
        const latestLocal = getUsersFromStorage();
        const merged = latestLocal.some(
          (u) =>
            u.id === selfDoc.id ||
            (selfEmailLower && (u.email || '').trim().toLowerCase() === selfEmailLower)
        )
          ? latestLocal.map((u) =>
              u.id === selfDoc.id ||
              (selfEmailLower && (u.email || '').trim().toLowerCase() === selfEmailLower)
                ? selfDoc
                : u
            )
          : [...latestLocal, selfDoc];
        saveUsersToStorage(merged);
        onUsersChanged(merged);
      })
      .catch((error) => {
        if (cancelled) return;
        onUsersChanged(getUsersFromStorage());
        if (onError) onError(error);
        if (isQuotaExceededError(error)) {
          notifyQuotaStatus(true);
          console.warn('Firestore quota exceeded on staff self profile fetch, using local cache.');
        }
      });

    return () => {
      cancelled = true;
    };
  }

  const usersQuery = query(collection(db, USERS_COLLECTION));
  let isInitialUsersSnap = true;
  setFirestoreActiveListener('Direktori Akun (users)', true);

  const unsub = onSnapshot(
    usersQuery,
    async (snapshot) => {
      const changesCount = snapshot.docChanges().length;
      const billedCount = changesCount > 0 ? changesCount : isInitialUsersSnap ? 1 : 0;
      isInitialUsersSnap = false;
      recordFirestoreRead('users', billedCount, snapshot.metadata?.fromCache);

      let persistedAdminUid: string | null = null;
      try {
        persistedAdminUid = localStorage.getItem(ADMIN_BOOTSTRAPPED_UID_KEY);
      } catch {}
      if (isAdmin && lastBootstrappedAdminUid !== fbUser.uid && persistedAdminUid !== fbUser.uid) {
        lastBootstrappedAdminUid = fbUser.uid;
        ensureSuperAdminRecord()
          .then((ok) => {
            if (ok) {
              try {
                localStorage.setItem(ADMIN_BOOTSTRAPPED_UID_KEY, fbUser.uid);
              } catch {}
            } else {
              lastBootstrappedAdminUid = null;
            }
          })
          .catch((err) => {
            lastBootstrappedAdminUid = null;
            if (!isQuotaExceededError(err)) {
              console.warn('Admin bootstrap note:', err);
            }
          });
      } else if (isAdmin) {
        lastBootstrappedAdminUid = fbUser.uid;
      }

      if (snapshot.empty && isAdmin && !isUsersSeeded) {
        isUsersSeeded = true;
        const localUsers = getUsersFromStorage();
        const initialToSeed = localUsers && localUsers.length > 0 ? localUsers : INITIAL_USERS;
        try {
          const batch = writeBatch(db);
          let writeCount = 0;
          for (const u of initialToSeed) {
            const cleanUser = sanitizeForFirestore({
              ...u,
              email: (u.email || `${u.username}@scb.sch.id`).trim().toLowerCase(),
              isActive: u.isActive !== false,
              createdAt: u.createdAt || getTodayDateString(),
            });
            batch.set(doc(db, USERS_COLLECTION, u.id), cleanUser);
            writeCount++;
            if (cleanUser.email) {
              batch.set(doc(db, STAFF_ROLES_COLLECTION, toEmailKey(cleanUser.email)), {
                email: cleanUser.email,
                role: cleanUser.role,
                isActive: cleanUser.isActive !== false,
                userId: cleanUser.id,
                updatedAt: serverTimestamp(),
              });
              writeCount++;
            }
          }
          await batch.commit();
          recordFirestoreWrite('users', writeCount);
        } catch (err) {
          if (isQuotaExceededError(err)) {
            console.warn('Firestore quota exceeded while seeding users, using local storage.');
            return;
          }
          handleFirestoreError(err, OperationType.WRITE, USERS_COLLECTION);
        }
        return;
      }

      const usersList: User[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.id.startsWith('config_') || docSnap.id.startsWith('sys_')) {
          return;
        }
        usersList.push(docSnap.data() as User);
      });

      if (isAdmin && usersList.length > 0) {
        if (localStorage.getItem(CLOUD_CANONICAL_USERS_KEY) !== 'true') {
          const officialById = new Map(INITIAL_USERS.map((u) => [u.id, u]));
          const needsCanonicalReset =
            usersList.length !== INITIAL_USERS.length ||
            usersList.some((u) => {
              const off = officialById.get(u.id);
              if (!off) return true;
              return (
                (u.email || '').trim().toLowerCase() !== off.email.trim().toLowerCase() ||
                u.role !== off.role ||
                u.name !== off.name ||
                (u.username || '').trim().toLowerCase() !== off.username.trim().toLowerCase()
              );
            }) ||
            INITIAL_USERS.some((off) => !usersList.some((u) => u.id === off.id));

          localStorage.setItem(CLOUD_CANONICAL_USERS_KEY, 'true');
          if (needsCanonicalReset) {
            const canonical = canonicalizeUsersToOfficial(usersList);
            saveUsersToStorage(canonical);
            onUsersChanged(canonical);
            syncAllUsersToCloud(canonical).catch((err) => {
              if (!isQuotaExceededError(err)) {
                console.warn('Canonical cloud user cleanup note:', err);
              }
            });
            return;
          }
        }

        const localUsers = getUsersFromStorage();
        const unsyncedUserIds = getUnsyncedIdSet(UNSYNCED_USER_IDS_KEY);
        const cloudUserIds = new Set(usersList.map((u) => u.id));
        const pendingUsers = localUsers.filter(
          (u) => !cloudUserIds.has(u.id) && unsyncedUserIds.has(u.id)
        );
        const mergedUsers = [...usersList, ...pendingUsers];

        mergedUsers.sort((a, b) => {
          const order: Record<string, number> = { superadmin: 1, supervisor: 2, petugas: 3 };
          return (order[a.role] || 9) - (order[b.role] || 9);
        });
        saveUsersToStorage(mergedUsers);
        onUsersChanged(mergedUsers);

        if (pendingUsers.length > 0) {
          Promise.all(pendingUsers.map((u) => saveUserToCloud(u))).catch(() => {});
        }

        // Sync staff_roles ONLY when user roles/emails/status actually change (avoid redundant writes per reload)
        if (lastBackfilledAdminUid !== fbUser.uid) {
          lastBackfilledAdminUid = fbUser.uid;
          const rolesHash = mergedUsers
            .map(
              (u) =>
                `${u.id}:${(u.email || '').trim().toLowerCase()}:${u.role}:${u.isActive !== false}`
            )
            .sort()
            .join('|');
          let storedRolesHash: string | null = null;
          try {
            storedRolesHash = localStorage.getItem(STAFF_ROLES_HASH_KEY);
          } catch {}
          if (storedRolesHash !== rolesHash) {
            Promise.all(mergedUsers.map((u) => syncStaffRoleToCloud(u)))
              .then(() => {
                try {
                  localStorage.setItem(STAFF_ROLES_HASH_KEY, rolesHash);
                } catch {}
              })
              .catch((err) => {
                if (!isQuotaExceededError(err)) {
                  console.warn('Staff role backfill note:', err);
                }
              });
          }
        }
      } else if (usersList.length > 0) {
        // Merge own synced user profile into existing roster without overwriting non-PII list
        const existingLocal = getUsersFromStorage();
        const selfDoc = usersList[0];
        const selfEmailLower = (selfDoc.email || '').trim().toLowerCase();
        const merged = existingLocal.some(
          (u) => u.id === selfDoc.id || (selfEmailLower && (u.email || '').trim().toLowerCase() === selfEmailLower)
        )
          ? existingLocal.map((u) =>
              u.id === selfDoc.id || (selfEmailLower && (u.email || '').trim().toLowerCase() === selfEmailLower)
                ? selfDoc
                : u
            )
          : [...existingLocal, selfDoc];
        saveUsersToStorage(merged);
        onUsersChanged(merged);
      }
    },
    (error) => {
      const fallback = getUsersFromStorage();
      onUsersChanged(fallback);
      if (onError) onError(error);
      if (isQuotaExceededError(error)) {
        notifyQuotaStatus(true);
        console.warn('Firestore quota exceeded on users listener, using local storage cache.');
        return;
      }
      handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
    }
  );
  return () => {
    setFirestoreActiveListener('Direktori Akun (users)', false);
    unsub();
  };
}

/**
 * Save user to Firestore and sync staff_roles
 */
export async function saveUserToCloud(user: User): Promise<void> {
  const current = getUsersFromStorage();
  const normalizedUser: User = {
    ...user,
    email: (user.email || `${user.username}@scb.sch.id`).trim().toLowerCase(),
    isActive: user.isActive !== false,
    createdAt: user.createdAt || getTodayDateString(),
  };

  const existingIdx = current.findIndex((u) => u.id === normalizedUser.id);
  if (existingIdx >= 0) {
    current[existingIdx] = normalizedUser;
  } else {
    current.push(normalizedUser);
  }
  saveUsersToStorage(current);

  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    markUnsyncedId(UNSYNCED_USER_IDS_KEY, normalizedUser.id);
    return;
  }

  const path = `${USERS_COLLECTION}/${normalizedUser.id}`;
  try {
    const docRef = doc(db, USERS_COLLECTION, normalizedUser.id);
    const existingSnap = await getDoc(docRef);
    recordFirestoreRead('users', 1, existingSnap.metadata?.fromCache);
    const existingCreatedAt = existingSnap.exists()
      ? (existingSnap.data()?.createdAt as string | undefined)
      : undefined;
    const payloadToWrite = sanitizeForFirestore({
      ...normalizedUser,
      createdAt: existingCreatedAt || normalizedUser.createdAt,
    });
    if (existingSnap.exists()) {
      await setDoc(docRef, payloadToWrite, { merge: true });
    } else {
      await setDoc(docRef, payloadToWrite);
    }
    recordFirestoreWrite('users', 1);
    if (isCurrentAuthSuperAdmin()) {
      await syncStaffRoleToCloud(normalizedUser);
    }
    unmarkUnsyncedId(UNSYNCED_USER_IDS_KEY, normalizedUser.id);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markUnsyncedId(UNSYNCED_USER_IDS_KEY, normalizedUser.id);
      console.warn('Firestore quota exceeded while saving user, kept in local storage.');
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete user from Firestore and staff_roles
 */
export async function deleteUserFromCloud(id: string): Promise<void> {
  unmarkUnsyncedId(UNSYNCED_USER_IDS_KEY, id);
  const current = getUsersFromStorage();
  const targetUser = current.find((u) => u.id === id);
  const filtered = current.filter((u) => u.id !== id);
  saveUsersToStorage(filtered);

  if (!auth.currentUser || !auth.currentUser.emailVerified) return;

  const path = `${USERS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, USERS_COLLECTION, id));
    recordFirestoreDelete('users', 1);
    if (targetUser?.email && isCurrentAuthSuperAdmin()) {
      await deleteDoc(doc(db, STAFF_ROLES_COLLECTION, toEmailKey(targetUser.email)));
      recordFirestoreDelete('users', 1);
    }
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('Firestore quota exceeded while deleting user, kept in local storage.');
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// ==========================================
// FORM CONFIGURATION CLOUD SYNCHRONIZATION
// ==========================================

export function subscribeFormConfig(
  onConfigChanged: (config: {
    rooms: MasterRoom[];
    checklists: MasterChecklist[];
    settings: FormSettings;
  }) => void
): () => void {
  const path = `${FORM_CONFIGS_COLLECTION}/${FORM_CONFIG_DOC_ID}`;
  const docRef = doc(db, FORM_CONFIGS_COLLECTION, FORM_CONFIG_DOC_ID);

  // Quota optimization: non-superadmin (Guests, Petugas, Supervisors) use 30-min cache + one-shot getDoc
  // instead of holding an extra live onSnapshot listener open on every device.
  if (!isCurrentAuthSuperAdmin()) {
    const hasLocalRooms = Boolean(localStorage.getItem('scb_master_rooms_v1'));
    if (hasLocalRooms && isCacheFresh(FORM_CONFIG_FETCHED_AT_KEY, CONFIG_CACHE_TTL_MS)) {
      onConfigChanged({
        rooms: getMasterRooms(),
        checklists: getMasterChecklists(),
        settings: getFormSettings(),
      });
      return () => {};
    }

    let cancelled = false;
    getDoc(docRef)
      .then((snapshot) => {
        if (cancelled) return;
        recordFirestoreRead('configs', 1, snapshot.metadata?.fromCache);
        notifyQuotaStatus(false);
        markCacheFetchedNow(FORM_CONFIG_FETCHED_AT_KEY);
        if (snapshot.exists()) {
          const data = snapshot.data();
          const rooms: MasterRoom[] =
            data?.rooms && Array.isArray(data.rooms) ? data.rooms : DEFAULT_MASTER_ROOMS;
          const checklists: MasterChecklist[] =
            data?.checklists && Array.isArray(data.checklists)
              ? data.checklists
              : DEFAULT_MASTER_CHECKLISTS;
          const settings: FormSettings = data?.settings ? data.settings : DEFAULT_FORM_SETTINGS;
          saveMasterRooms(rooms);
          saveMasterChecklists(checklists);
          saveFormSettings(settings);
          onConfigChanged({ rooms, checklists, settings });
        } else {
          onConfigChanged({
            rooms: getMasterRooms(),
            checklists: getMasterChecklists(),
            settings: getFormSettings(),
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        onConfigChanged({
          rooms: getMasterRooms(),
          checklists: getMasterChecklists(),
          settings: getFormSettings(),
        });
        if (isQuotaExceededError(err)) {
          notifyQuotaStatus(true);
          console.warn('Firestore quota exceeded on guest form config fetch, using local storage cache.');
        }
      });

    return () => {
      cancelled = true;
    };
  }

  let isInitialConfigSnap = true;
  setFirestoreActiveListener('Master Form (form_configs)', true);

  const unsub = onSnapshot(
    docRef,
    async (snapshot) => {
      if (isInitialConfigSnap || !snapshot.metadata?.hasPendingWrites) {
        recordFirestoreRead('configs', 1, snapshot.metadata?.fromCache);
      }
      isInitialConfigSnap = false;
      notifyQuotaStatus(false);
      markCacheFetchedNow(FORM_CONFIG_FETCHED_AT_KEY);

      if (hasUnsyncedFlag(UNSYNCED_FORM_CONFIG_KEY)) {
        const localConfig = {
          rooms: getMasterRooms() || DEFAULT_MASTER_ROOMS,
          checklists: getMasterChecklists() || DEFAULT_MASTER_CHECKLISTS,
          settings: getFormSettings() || DEFAULT_FORM_SETTINGS,
        };
        onConfigChanged(localConfig);

        if (isCurrentAuthSuperAdmin()) {
          try {
            await setDoc(docRef, sanitizeForFirestore(localConfig));
            recordFirestoreWrite('configs', 1);
            setUnsyncedFlag(UNSYNCED_FORM_CONFIG_KEY, false);
          } catch (err) {
            if (!isQuotaExceededError(err)) {
              console.warn('Pending form config sync note:', err);
            }
          }
        }
        return;
      }

      if (!snapshot.exists()) {
        let seedData = {
          rooms: getMasterRooms() || DEFAULT_MASTER_ROOMS,
          checklists: getMasterChecklists() || DEFAULT_MASTER_CHECKLISTS,
          settings: getFormSettings() || DEFAULT_FORM_SETTINGS,
        };
        if (isCurrentAuthSuperAdmin()) {
          try {
            const legacySnap = await getDoc(doc(db, USERS_COLLECTION, FORM_CONFIG_DOC_ID));
            if (legacySnap.exists()) {
              const legacy = legacySnap.data();
              seedData = {
                rooms: Array.isArray(legacy?.rooms) ? legacy.rooms : seedData.rooms,
                checklists: Array.isArray(legacy?.checklists)
                  ? legacy.checklists
                  : seedData.checklists,
                settings: legacy?.settings || seedData.settings,
              };
            }
            await setDoc(docRef, sanitizeForFirestore(seedData));
          } catch (err) {
            if (!isQuotaExceededError(err)) {
              console.warn('Initial form config seed note:', err);
            }
          }
        }
        onConfigChanged(seedData);
        return;
      }

      const data = snapshot.data();
      const rooms: MasterRoom[] =
        data?.rooms && Array.isArray(data.rooms) ? data.rooms : DEFAULT_MASTER_ROOMS;
      const checklists: MasterChecklist[] =
        data?.checklists && Array.isArray(data.checklists)
          ? data.checklists
          : DEFAULT_MASTER_CHECKLISTS;
      const settings: FormSettings = data?.settings ? data.settings : DEFAULT_FORM_SETTINGS;

      saveMasterRooms(rooms);
      saveMasterChecklists(checklists);
      saveFormSettings(settings);

      onConfigChanged({ rooms, checklists, settings });
    },
    (err) => {
      onConfigChanged({
        rooms: getMasterRooms(),
        checklists: getMasterChecklists(),
        settings: getFormSettings(),
      });
      if (isQuotaExceededError(err)) {
        notifyQuotaStatus(true);
        console.warn('Firestore quota exceeded on form config listener, using local storage cache.');
        return;
      }
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
  return () => {
    setFirestoreActiveListener('Master Form (form_configs)', false);
    unsub();
  };
}

async function writeFormConfigPayloadToCloud(payload: {
  rooms: MasterRoom[];
  checklists: MasterChecklist[];
  settings: FormSettings;
}): Promise<CloudSaveResult> {
  setUnsyncedFlag(UNSYNCED_FORM_CONFIG_KEY, true);

  if (!auth.currentUser || !auth.currentUser.emailVerified || !isCurrentAuthSuperAdmin()) {
    return {
      status: 'local_unauthenticated',
      message: 'Sesi Cloud Superadmin belum terhubung. Perubahan disimpan lokal dan akan disinkronkan saat login Cloud.',
    };
  }

  try {
    const docRef = doc(db, FORM_CONFIGS_COLLECTION, FORM_CONFIG_DOC_ID);
    await setDoc(docRef, sanitizeForFirestore(payload));
    recordFirestoreWrite('configs', 1);
    setUnsyncedFlag(UNSYNCED_FORM_CONFIG_KEY, false);
    syncPublicDailyNotificationsToCloud(true).catch(() => {});
    return { status: 'synced' };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      console.warn('Firestore quota exceeded while saving form config, kept in local storage.');
      return {
        status: 'local_quota',
        message: 'Kuota harian Firestore penuh. Perubahan aman tersimpan lokal dan tidak akan tertimpa.',
      };
    }
    const msg = err instanceof Error ? err.message : String(err || '');
    console.error(`Firestore Error on ${FORM_CONFIGS_COLLECTION}/${FORM_CONFIG_DOC_ID}:`, msg);
    return {
      status: 'local_error',
      message: `Perubahan tersimpan lokal, gagal kirim ke Cloud (${msg}).`,
    };
  }
}

export async function saveMasterRoomsToCloud(rooms: MasterRoom[]): Promise<CloudSaveResult> {
  saveMasterRooms(rooms);
  return writeFormConfigPayloadToCloud({
    rooms,
    checklists: getMasterChecklists(),
    settings: getFormSettings(),
  });
}

export async function saveMasterChecklistsToCloud(checklists: MasterChecklist[]): Promise<CloudSaveResult> {
  saveMasterChecklists(checklists);
  return writeFormConfigPayloadToCloud({
    rooms: getMasterRooms(),
    checklists,
    settings: getFormSettings(),
  });
}

export async function saveFormSettingsToCloud(settings: FormSettings): Promise<CloudSaveResult> {
  saveFormSettings(settings);
  return writeFormConfigPayloadToCloud({
    rooms: getMasterRooms(),
    checklists: getMasterChecklists(),
    settings,
  });
}

// ==========================================
// ROOM OFFICER SCHEDULES CLOUD SYNC
// ==========================================

export function subscribeRoomSchedules(
  onSchedulesChanged: (schedules: RoomSchedule[]) => void
): () => void {
  const path = `${ROOM_SCHEDULES_COLLECTION}/${ROOM_SCHEDULE_DOC_ID}`;
  const docRef = doc(db, ROOM_SCHEDULES_COLLECTION, ROOM_SCHEDULE_DOC_ID);

  // Quota optimization: non-superadmin (Guests, Petugas, Supervisors) use 30-min cache + one-shot getDoc
  // instead of holding an extra live onSnapshot listener open on every device.
  if (!isCurrentAuthSuperAdmin()) {
    const hasLocalSchedules = Boolean(localStorage.getItem('scb_room_schedules_v1'));
    if (hasLocalSchedules && isCacheFresh(SCHEDULES_FETCHED_AT_KEY, CONFIG_CACHE_TTL_MS)) {
      onSchedulesChanged(getRoomSchedules());
      return () => {};
    }

    let cancelled = false;
    getDoc(docRef)
      .then((snapshot) => {
        if (cancelled) return;
        recordFirestoreRead('configs', 1, snapshot.metadata?.fromCache);
        notifyQuotaStatus(false);
        markCacheFetchedNow(SCHEDULES_FETCHED_AT_KEY);
        if (snapshot.exists()) {
          const data = snapshot.data();
          const rawSchedules: RoomSchedule[] =
            data?.schedules && Array.isArray(data.schedules) ? data.schedules : getRoomSchedules();
          const cleaned = sanitizeSchedulesToOfficial(rawSchedules);
          saveRoomSchedules(cleaned);
          onSchedulesChanged(cleaned);
        } else {
          onSchedulesChanged(getRoomSchedules());
        }
      })
      .catch((err) => {
        if (cancelled) return;
        onSchedulesChanged(getRoomSchedules());
        if (isQuotaExceededError(err)) {
          notifyQuotaStatus(true);
          console.warn('Firestore quota exceeded on guest schedules fetch, using local storage cache.');
        }
      });

    return () => {
      cancelled = true;
    };
  }

  let isInitialSchedSnap = true;
  setFirestoreActiveListener('Jadwal Ruang (room_schedules)', true);

  const unsub = onSnapshot(
    docRef,
    async (snapshot) => {
      if (isInitialSchedSnap || !snapshot.metadata?.hasPendingWrites) {
        recordFirestoreRead('configs', 1, snapshot.metadata?.fromCache);
      }
      isInitialSchedSnap = false;
      notifyQuotaStatus(false);
      markCacheFetchedNow(SCHEDULES_FETCHED_AT_KEY);

      if (hasUnsyncedFlag(UNSYNCED_SCHEDULES_KEY)) {
        const localSchedules = getRoomSchedules();
        onSchedulesChanged(localSchedules);

        if (isCurrentAuthSuperAdmin()) {
          try {
            await setDoc(docRef, { schedules: sanitizeForFirestore(localSchedules) });
            recordFirestoreWrite('configs', 1);
            setUnsyncedFlag(UNSYNCED_SCHEDULES_KEY, false);
          } catch (err) {
            if (!isQuotaExceededError(err)) {
              console.warn('Pending schedules sync note:', err);
            }
          }
        }
        return;
      }

      if (!snapshot.exists()) {
        const localSchedules = getRoomSchedules();
        let initialToSeed =
          localSchedules && localSchedules.length > 0 ? localSchedules : DEFAULT_ROOM_SCHEDULES;
        if (isCurrentAuthSuperAdmin()) {
          try {
            const legacySnap = await getDoc(doc(db, USERS_COLLECTION, ROOM_SCHEDULE_DOC_ID));
            if (legacySnap.exists() && Array.isArray(legacySnap.data()?.schedules)) {
              initialToSeed = legacySnap.data().schedules;
            }
            initialToSeed = sanitizeSchedulesToOfficial(initialToSeed);
            await setDoc(docRef, { schedules: sanitizeForFirestore(initialToSeed) });
          } catch (err) {
            if (!isQuotaExceededError(err)) {
              console.warn('Initial schedules seed note:', err);
            }
          }
        } else {
          initialToSeed = sanitizeSchedulesToOfficial(initialToSeed);
        }
        saveRoomSchedules(initialToSeed);
        onSchedulesChanged(initialToSeed);
        return;
      }

      const data = snapshot.data();
      const rawSchedules: RoomSchedule[] =
        data?.schedules && Array.isArray(data.schedules) ? data.schedules : getRoomSchedules();

      let schedules = rawSchedules;
      if (localStorage.getItem(CLOUD_CANONICAL_SCHEDULES_KEY) !== 'true') {
        const cleaned = sanitizeSchedulesToOfficial(rawSchedules);
        localStorage.setItem(CLOUD_CANONICAL_SCHEDULES_KEY, 'true');
        if (JSON.stringify(cleaned) !== JSON.stringify(rawSchedules)) {
          schedules = cleaned;
          if (isCurrentAuthSuperAdmin()) {
            saveRoomSchedulesToCloud(cleaned).catch(() => {});
          }
        }
      }

      saveRoomSchedules(schedules);
      onSchedulesChanged(schedules);
    },
    (err) => {
      onSchedulesChanged(getRoomSchedules());
      if (isQuotaExceededError(err)) {
        notifyQuotaStatus(true);
        console.warn('Firestore quota exceeded on room schedules listener, using local storage cache.');
        return;
      }
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
  return () => {
    setFirestoreActiveListener('Jadwal Ruang (room_schedules)', false);
    unsub();
  };
}

export async function saveRoomSchedulesToCloud(schedules: RoomSchedule[]): Promise<CloudSaveResult> {
  saveRoomSchedules(schedules);
  setUnsyncedFlag(UNSYNCED_SCHEDULES_KEY, true);

  if (!auth.currentUser || !auth.currentUser.emailVerified || !isCurrentAuthSuperAdmin()) {
    return {
      status: 'local_unauthenticated',
      message: 'Sesi Cloud Superadmin belum terhubung. Jadwal disimpan lokal dan akan disinkronkan saat login Cloud.',
    };
  }

  try {
    const docRef = doc(db, ROOM_SCHEDULES_COLLECTION, ROOM_SCHEDULE_DOC_ID);
    await setDoc(docRef, { schedules: sanitizeForFirestore(schedules) });
    recordFirestoreWrite('configs', 1);
    setUnsyncedFlag(UNSYNCED_SCHEDULES_KEY, false);
    syncPublicDailyNotificationsToCloud(true).catch(() => {});
    return { status: 'synced' };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      console.warn('Firestore quota exceeded while saving schedules, kept in local storage.');
      return {
        status: 'local_quota',
        message: 'Kuota harian Firestore penuh. Perubahan jadwal aman tersimpan lokal dan tidak akan tertimpa.',
      };
    }
    const msg = err instanceof Error ? err.message : String(err || '');
    console.error(`Firestore Error on ${ROOM_SCHEDULES_COLLECTION}/${ROOM_SCHEDULE_DOC_ID}:`, msg);
    return {
      status: 'local_error',
      message: `Jadwal tersimpan lokal, gagal kirim ke Cloud (${msg}).`,
    };
  }
}

/**
 * Syncs any locally edited form configs or schedules up to Firestore when Superadmin connects.
 */
export async function syncPendingLocalChangesToCloud(): Promise<{
  syncedConfig: boolean;
  syncedSchedules: boolean;
}> {
  let syncedConfig = false;
  let syncedSchedules = false;

  if (!auth.currentUser || !isCurrentAuthSuperAdmin()) {
    return { syncedConfig, syncedSchedules };
  }

  if (hasUnsyncedFlag(UNSYNCED_FORM_CONFIG_KEY)) {
    const res = await writeFormConfigPayloadToCloud({
      rooms: getMasterRooms(),
      checklists: getMasterChecklists(),
      settings: getFormSettings(),
    });
    syncedConfig = res.status === 'synced';
  }

  if (hasUnsyncedFlag(UNSYNCED_SCHEDULES_KEY)) {
    const res = await saveRoomSchedulesToCloud(getRoomSchedules());
    syncedSchedules = res.status === 'synced';
  }

  return { syncedConfig, syncedSchedules };
}

/**
 * Batch syncs all local users and staff_roles to Firestore (Superadmin only)
 */
export async function syncAllUsersToCloud(users: User[]): Promise<void> {
  saveUsersToStorage(users);
  if (!auth.currentUser || !isCurrentAuthSuperAdmin()) return;

  try {
    await ensureSuperAdminRecord();
    const existingSnap = await getDocs(collection(db, USERS_COLLECTION));
    recordFirestoreRead('users', Math.max(1, existingSnap.size), existingSnap.metadata?.fromCache);
    const existingRolesSnap = await getDocs(collection(db, STAFF_ROLES_COLLECTION));
    recordFirestoreRead('users', Math.max(1, existingRolesSnap.size), existingRolesSnap.metadata?.fromCache);
    const desiredIds = new Set(users.map((u) => u.id));
    const desiredEmailKeys = new Set(
      users
        .map((u) => (u.email || `${u.username}@scb.sch.id`).trim().toLowerCase())
        .filter(Boolean)
        .map((email) => toEmailKey(email))
    );
    const batch = writeBatch(db);
    let deletesInBatch = 0;
    let writesInBatch = 0;

    const existingCreatedAtMap = new Map<string, string>();
    existingSnap.forEach((docSnap) => {
      if (!docSnap.id.startsWith('config_') && !docSnap.id.startsWith('sys_')) {
        const data = docSnap.data();
        if (typeof data?.createdAt === 'string') {
          existingCreatedAtMap.set(docSnap.id, data.createdAt);
        }
        if (!desiredIds.has(docSnap.id)) {
          batch.delete(docSnap.ref);
          deletesInBatch++;
        }
      }
    });

    existingRolesSnap.forEach((roleSnap) => {
      if (!desiredEmailKeys.has(roleSnap.id)) {
        batch.delete(roleSnap.ref);
        deletesInBatch++;
      }
    });

    for (const u of users) {
      const cleanUser = sanitizeForFirestore({
        ...u,
        email: (u.email || `${u.username}@scb.sch.id`).trim().toLowerCase(),
        isActive: u.isActive !== false,
        createdAt: existingCreatedAtMap.get(u.id) || u.createdAt || getTodayDateString(),
      });
      batch.set(doc(db, USERS_COLLECTION, cleanUser.id), cleanUser);
      writesInBatch++;
      if (cleanUser.email) {
        batch.set(doc(db, STAFF_ROLES_COLLECTION, toEmailKey(cleanUser.email)), {
          email: cleanUser.email,
          role: cleanUser.role,
          isActive: cleanUser.isActive !== false,
          userId: cleanUser.id,
          updatedAt: serverTimestamp(),
        });
        writesInBatch++;
      }
    }

    await batch.commit();
    if (deletesInBatch > 0) recordFirestoreDelete('users', deletesInBatch);
    if (writesInBatch > 0) recordFirestoreWrite('users', writesInBatch);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn('Firestore quota exceeded while syncing users batch.');
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, USERS_COLLECTION);
  }
}

/**
 * Pushes full local configuration & users up to Firestore when Superadmin connects Cloud Sync
 */
export async function syncAllAppDataToCloud(payload: {
  users?: User[];
  masterRooms?: MasterRoom[];
  masterChecklists?: MasterChecklist[];
  formSettings?: FormSettings;
  roomSchedules?: RoomSchedule[];
  reports?: CleaningReport[];
}): Promise<void> {
  if (!auth.currentUser || !isCurrentAuthSuperAdmin()) return;

  if (payload.users && payload.users.length > 0) {
    await syncAllUsersToCloud(payload.users);
  }

  if (payload.masterRooms || payload.masterChecklists || payload.formSettings) {
    try {
      await setDoc(
        doc(db, FORM_CONFIGS_COLLECTION, FORM_CONFIG_DOC_ID),
        sanitizeForFirestore({
          rooms: payload.masterRooms || getMasterRooms(),
          checklists: payload.masterChecklists || getMasterChecklists(),
          settings: payload.formSettings || getFormSettings(),
        })
      );
      recordFirestoreWrite('configs', 1);
      setUnsyncedFlag(UNSYNCED_FORM_CONFIG_KEY, false);
    } catch (err) {
      if (!isQuotaExceededError(err)) {
        handleFirestoreError(
          err,
          OperationType.WRITE,
          `${FORM_CONFIGS_COLLECTION}/${FORM_CONFIG_DOC_ID}`
        );
      }
    }
  }

  if (payload.roomSchedules) {
    await saveRoomSchedulesToCloud(payload.roomSchedules);
  }

  if (payload.reports && payload.reports.length > 0) {
    for (const rep of payload.reports) {
      await saveReportToCloud(rep);
    }
  }
}

// ==========================================
// GUEST LANDING PAGE: ULTRA-LOW-QUOTA PUBLIC NOTIFICATIONS (1 DOC READ)
// ==========================================

export function buildLocalPublicDailyNotifications(
  customReports?: CleaningReport[],
  customRooms?: MasterRoom[],
  customSchedules?: RoomSchedule[]
): PublicDailyNotificationSummary {
  const todayStr = getTodayDateString();
  const reportsSource = customReports ?? getReportsFromStorage();
  const roomsSource = customRooms ?? getMasterRooms();
  const schedulesSource = customSchedules ?? getRoomSchedules();

  const targetRooms = getMandatoryTargetRoomsForDate(todayStr, roomsSource, schedulesSource);
  const todayReports = (reportsSource || [])
    .filter((r) => r && r.tanggal === todayStr)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const reportedAreaSet = new Set(
    todayReports.map((r) => (r.area || '').trim().toUpperCase()).filter(Boolean)
  );
  const pendingAreas = targetRooms
    .filter((room) => !reportedAreaSet.has(room.trim().toUpperCase()))
    .slice(0, 100);

  const reportedAreaCount = targetRooms.filter((room) =>
    reportedAreaSet.has(room.trim().toUpperCase())
  ).length;

  const notifications: PublicNotificationItem[] = todayReports.slice(0, 15).map((r) => ({
    id: r.id,
    area: r.isAreaOther && r.areaCustom ? r.areaCustom : r.area,
    namaPetugas: r.namaPetugas || 'Petugas',
    waktu: r.waktu || '00:00',
    tanggal: r.tanggal || todayStr,
    kondisiAkhir: r.kondisiAkhir || 'Bersih',
    statusVerifikasi: r.statusVerifikasi || 'Menunggu',
    timestamp: r.timestamp || Date.now(),
  }));

  return {
    id: PUBLIC_SUMMARY_DOC_ID,
    date: todayStr,
    totalScheduledToday: targetRooms.length,
    reportedAreaCount,
    pendingAreas,
    notifications,
    updatedAtMs: Date.now(),
  };
}

function getCachedPublicSummary(): {
  summary: PublicDailyNotificationSummary;
  fetchedAtMs: number;
} | null {
  try {
    const raw = localStorage.getItem(PUBLIC_SUMMARY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.summary &&
      typeof parsed.fetchedAtMs === 'number' &&
      parsed.summary.date === getTodayDateString()
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveCachedPublicSummary(summary: PublicDailyNotificationSummary): void {
  try {
    localStorage.setItem(
      PUBLIC_SUMMARY_CACHE_KEY,
      JSON.stringify({ summary, fetchedAtMs: Date.now() })
    );
  } catch {
    // Ignore localStorage quota noise
  }
}

/**
 * Keeps /public_summary/daily_notifications up to date when authenticated staff/admin
 * submits, updates, or views today's reports. Uses a digest hash so repeated reloads perform 0 writes.
 */
export async function syncPublicDailyNotificationsToCloud(force = false): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const summary = buildLocalPublicDailyNotifications();
  const digestHash = [
    summary.date,
    summary.totalScheduledToday,
    summary.reportedAreaCount,
    summary.pendingAreas.join(','),
    summary.notifications.map((n) => `${n.id}:${n.statusVerifikasi}:${n.kondisiAkhir}`).join('|'),
  ].join('::');

  try {
    if (!force && localStorage.getItem(PUBLIC_SUMMARY_HASH_KEY) === digestHash) {
      return;
    }
  } catch {}

  saveCachedPublicSummary(summary);

  try {
    await setDoc(
      doc(db, PUBLIC_SUMMARY_COLLECTION, PUBLIC_SUMMARY_DOC_ID),
      sanitizeForFirestore({
        ...summary,
        updatedByUid: fbUser.uid,
      })
    );
    recordFirestoreWrite('public_summary', 1);
    try {
      localStorage.setItem(PUBLIC_SUMMARY_HASH_KEY, digestHash);
    } catch {}
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      console.warn('Public notification summary sync note:', err);
    }
  }
}

/**
 * Ultra-low-quota reader for non-logged-in Landing Page:
 * - Serves 10-minute localStorage cache first (0 Firestore reads on refresh).
 * - Otherwise reads 1 single document: /public_summary/daily_notifications (1 read total).
 * - Only if that summary doc is missing or from a previous day, runs 1 capped today-only query (max 20 docs).
 */
export async function fetchPublicDailyNotificationsForGuest(forceRefresh = false): Promise<{
  summary: PublicDailyNotificationSummary;
  source: 'cache' | 'cloud_summary' | 'cloud_fallback' | 'local_offline';
  quotaExceeded?: boolean;
}> {
  const todayStr = getTodayDateString();
  const cached = getCachedPublicSummary();

  if (
    !forceRefresh &&
    cached &&
    Date.now() - cached.fetchedAtMs < PUBLIC_SUMMARY_CACHE_TTL_MS
  ) {
    return { summary: cached.summary, source: 'cache' };
  }

  try {
    const summarySnap = await getDoc(
      doc(db, PUBLIC_SUMMARY_COLLECTION, PUBLIC_SUMMARY_DOC_ID)
    );
    recordFirestoreRead('public_summary', 1, summarySnap.metadata?.fromCache);
    notifyQuotaStatus(false);

    if (summarySnap.exists()) {
      const data = summarySnap.data() as PublicDailyNotificationSummary;
      if (data && data.date === todayStr && Array.isArray(data.notifications)) {
        const normalized: PublicDailyNotificationSummary = {
          id: PUBLIC_SUMMARY_DOC_ID,
          date: data.date,
          totalScheduledToday: Number(data.totalScheduledToday) || 0,
          reportedAreaCount: Number(data.reportedAreaCount) || 0,
          pendingAreas: Array.isArray(data.pendingAreas) ? data.pendingAreas : [],
          notifications: data.notifications.slice(0, 15),
          updatedAtMs: Number(data.updatedAtMs) || Date.now(),
        };
        saveCachedPublicSummary(normalized);
        return { summary: normalized, source: 'cloud_summary' };
      }
    }

    // Fallback ONLY when summary doc doesn't exist yet for today: 1 capped today-only query
    const todayCutoffMs = getMidnightCutoffMs(0);
    const fallbackQuery = query(
      collection(db, REPORTS_COLLECTION),
      where('timestamp', '>', todayCutoffMs),
      limit(20)
    );
    const reportsSnap = await getDocs(fallbackQuery);
    recordFirestoreRead('reports', Math.max(1, reportsSnap.size), reportsSnap.metadata?.fromCache);
    const todayReports = processFetchedReportDocs(reportsSnap.docs);
    const fallbackSummary = buildLocalPublicDailyNotifications(
      todayReports,
      getMasterRooms(),
      getRoomSchedules()
    );
    saveCachedPublicSummary(fallbackSummary);
    return { summary: fallbackSummary, source: 'cloud_fallback' };
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaStatus(true);
      return {
        summary: cached?.summary || buildLocalPublicDailyNotifications(),
        source: 'local_offline',
        quotaExceeded: true,
      };
    }
    console.warn('Guest public notification fetch note:', err);
    return {
      summary: cached?.summary || buildLocalPublicDailyNotifications(),
      source: 'local_offline',
    };
  }
}
