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
  writeBatch,
  serverTimestamp,
  FieldValue,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { CleaningReport, User, MasterRoom, MasterChecklist, FormSettings, RoomSchedule } from '../types';
import {
  INITIAL_USERS,
  canonicalizeUsersToOfficial,
  saveReports as saveReportsToStorage,
  getReports as getReportsFromStorage,
  saveUsers as saveUsersToStorage,
  getUsers as getUsersFromStorage,
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
  DEFAULT_MASTER_ROOMS,
  DEFAULT_MASTER_CHECKLISTS,
  DEFAULT_FORM_SETTINGS,
  DEFAULT_ROOM_SCHEDULES,
} from '../utils/formStorage';
import {
  recompressImageDataUrl,
  createMicroThumbnail,
} from '../utils/imageCompressor';

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

const SUPERADMIN_EMAIL = 'operasional.scb@gmail.com';
const FORM_CONFIG_DOC_ID = 'config_form_configs';
const ROOM_SCHEDULE_DOC_ID = 'config_room_schedules';

export const DEFAULT_REPORT_WINDOW_DAYS = 35;
const CONFIG_CACHE_TTL_MS = 15 * 60 * 1000; // 15 menit cache untuk tamu

const UNSYNCED_REPORT_IDS_KEY = 'scb_unsynced_report_ids_v1';
const UNSYNCED_USER_IDS_KEY = 'scb_unsynced_user_ids_v1';
const UNSYNCED_FORM_CONFIG_KEY = 'scb_unsynced_form_config_v1';
const UNSYNCED_SCHEDULES_KEY = 'scb_unsynced_schedules_v1';
const CLOUD_CANONICAL_USERS_KEY = 'scb_cloud_canonical_users_v2';
const CLOUD_CANONICAL_SCHEDULES_KEY = 'scb_cloud_canonical_schedules_v2';
const FORM_CONFIG_FETCHED_AT_KEY = 'scb_form_config_fetched_at_v1';
const SCHEDULES_FETCHED_AT_KEY = 'scb_schedules_fetched_at_v1';

export interface CloudSaveResult {
  status: 'synced' | 'local_unauthenticated' | 'local_quota' | 'local_error';
  message?: string;
}

let isUsersSeeded = false;
let lastBootstrappedAdminUid: string | null = null;
let lastBackfilledAdminUid: string | null = null;
let hasBackfilledLocalReports = false;
let olderCloudReportsLoaded = false;
const hydratedPhotoIds = new Set<string>();

let isQuotaLimitedState = false;
const quotaStatusListeners = new Set<(limited: boolean) => void>();

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
  hasBackfilledLocalReports = false;
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

const MAX_FIRESTORE_PHOTOS_BYTES = 760_000;

async function ensureReportPhotosFitLimit(rawPhotos: string[] = []): Promise<string[]> {
  const capped = Array.isArray(rawPhotos) ? rawPhotos.slice(0, 5) : [];
  const calcSize = (arr: string[]) => arr.reduce((sum, item) => sum + (item?.length || 0), 0);

  if (calcSize(capped) <= MAX_FIRESTORE_PHOTOS_BYTES) {
    return capped;
  }

  let current = await Promise.all(
    capped.map((p) => recompressImageDataUrl(p, 500, 500, 0.48))
  );
  if (calcSize(current) <= MAX_FIRESTORE_PHOTOS_BYTES) {
    return current;
  }

  current = await Promise.all(
    current.map((p) => recompressImageDataUrl(p, 400, 400, 0.42))
  );
  if (calcSize(current) <= MAX_FIRESTORE_PHOTOS_BYTES) {
    return current;
  }

  return Promise.all(
    current.map((p) => recompressImageDataUrl(p, 320, 320, 0.35))
  );
}

function getWindowCutoffMs(): number {
  return Math.max(1, Date.now() - DEFAULT_REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
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
      p.length > 12_000
  );
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

/**
 * Subscribes to recent real-time reports from Firestore (default rolling window: 35 days)
 * to save Firestore read units. Older history is loaded on demand via loadOlderReportsFromCloud().
 */
export function subscribeReports(
  onReportsChanged: (reports: CleaningReport[]) => void,
  onError?: (err: Error) => void
): () => void {
  const windowCutoffMs = getWindowCutoffMs();
  const reportsRef = collection(db, REPORTS_COLLECTION);
  const q = query(reportsRef, where('timestamp', '>', windowCutoffMs));

  return onSnapshot(
    q,
    (snapshot) => {
      notifyQuotaStatus(false);
      const reportsList: CleaningReport[] = [];
      snapshot.forEach((docSnap) => {
        if (['rep-1', 'rep-2', 'rep-3', 'rep-4'].includes(docSnap.id)) {
          if (isCurrentAuthSuperAdmin()) {
            deleteDoc(doc(db, REPORTS_COLLECTION, docSnap.id)).catch(() => {});
          }
        } else {
          const raw = docSnap.data() as CleaningReport;
          reportsList.push(buildNormalizedCloudReport(docSnap.id, raw));
        }
      });

      const localReports = getReportsFromStorage();
      const unsyncedIds = getUnsyncedIdSet(UNSYNCED_REPORT_IDS_KEY);

      // Protect local reports if Firestore returns empty inside active window
      if (reportsList.length === 0 && localReports.length > 0) {
        const sortedLocal = [...localReports].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        onReportsChanged(sortedLocal);

        const pendingRecent = sortedLocal.filter(
          (rep) => unsyncedIds.has(rep.id) || (rep.timestamp || 0) > windowCutoffMs
        );
        if (isFirebaseCloudConnected() && !hasBackfilledLocalReports && pendingRecent.length > 0) {
          hasBackfilledLocalReports = true;
          Promise.all(pendingRecent.map((rep) => saveReportToCloud(rep).catch(() => {}))).catch(() => {});
        }
        return;
      }

      const merged = mergeCloudWithLocalReports(reportsList, localReports, unsyncedIds, windowCutoffMs);
      saveReportsToStorage(merged);
      onReportsChanged(merged);

      const pendingToSync = merged.filter((r) => unsyncedIds.has(r.id));
      if (pendingToSync.length > 0 && isFirebaseCloudConnected() && !hasBackfilledLocalReports) {
        hasBackfilledLocalReports = true;
        Promise.all(pendingToSync.map((rep) => saveReportToCloud(rep).catch(() => {}))).catch(() => {});
      }
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
}

/**
 * Loads older reports (> 35 days old) on demand when the user selects "Semua" or an older month filter.
 */
export async function loadOlderReportsFromCloud(): Promise<{
  loadedCount: number;
  quotaExceeded?: boolean;
}> {
  if (olderCloudReportsLoaded) {
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
    notifyQuotaStatus(false);
    olderCloudReportsLoaded = true;

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
 * Create a new cleaning report in Firestore (summary + micro-thumbnail in /reports, full photos in /report_photos)
 * and keep full-resolution photos in local/IndexedDB storage.
 */
export async function saveReportToCloud(report: CleaningReport): Promise<CloudSaveResult> {
  const safePhotos = await ensureReportPhotosFitLimit(report.fotoBukti);
  const resolvedAuthorUid = report.authorUid || auth.currentUser?.uid || undefined;
  const isOffloaded = safePhotos.length > 0;

  const preparedLocalReport: CleaningReport = {
    ...report,
    checklist: Array.isArray(report.checklist) ? report.checklist : [],
    keteranganTambahan: report.keteranganTambahan ?? '',
    fotoBukti: safePhotos,
    fotoCount: safePhotos.length,
    photosOffloaded: isOffloaded,
    authorUid: resolvedAuthorUid,
  };

  if (isOffloaded) {
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
    const thumbList = isOffloaded ? [await createMicroThumbnail(safePhotos[0])] : [];
    const cloudSummaryReport: CleaningReport = {
      ...preparedLocalReport,
      fotoBukti: thumbList,
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
    notifyQuotaStatus(false);
    unmarkUnsyncedId(UNSYNCED_REPORT_IDS_KEY, preparedLocalReport.id);
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
  const preparedUpdates: Partial<CleaningReport> = { ...updates };
  let fullUpdatedPhotos: string[] | null = null;
  if (Array.isArray(preparedUpdates.fotoBukti)) {
    fullUpdatedPhotos = await ensureReportPhotosFitLimit(preparedUpdates.fotoBukti);
    preparedUpdates.fotoBukti = fullUpdatedPhotos;
    preparedUpdates.fotoCount = fullUpdatedPhotos.length;
    preparedUpdates.photosOffloaded = fullUpdatedPhotos.length > 0;
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
    markUnsyncedId(UNSYNCED_REPORT_IDS_KEY, id);
    return {
      status: 'local_unauthenticated',
      message: 'Perubahan tersimpan lokal. Masuk Cloud agar sinkron ke pengguna lain.',
    };
  }

  const path = `${REPORTS_COLLECTION}/${id}`;
  try {
    const cloudUpdates: Partial<CleaningReport> = { ...preparedUpdates };
    if (fullUpdatedPhotos !== null) {
      cloudUpdates.fotoBukti =
        fullUpdatedPhotos.length > 0 ? [await createMicroThumbnail(fullUpdatedPhotos[0])] : [];
      cloudUpdates.fotoCount = fullUpdatedPhotos.length;
      cloudUpdates.photosOffloaded = fullUpdatedPhotos.length > 0;
    }

    const docRef = doc(db, REPORTS_COLLECTION, id);
    const sanitizedUpdates = sanitizeForFirestore(cloudUpdates);

    if (fullUpdatedPhotos !== null && fullUpdatedPhotos.length > 0) {
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
    } else {
      await updateDoc(docRef, {
        ...sanitizedUpdates,
        updatedAt: serverTimestamp(),
      });
    }

    notifyQuotaStatus(false);
    unmarkUnsyncedId(UNSYNCED_REPORT_IDS_KEY, id);
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
 * whenever a verified user signs in.
 */
export async function syncPendingLocalReportsToCloud(): Promise<number> {
  if (!isFirebaseCloudConnected()) return 0;

  const unsyncedIds = getUnsyncedIdSet(UNSYNCED_REPORT_IDS_KEY);
  if (unsyncedIds.size === 0) return 0;

  const localReports = getReportsFromStorage();
  const pendingReports = localReports.filter((r) => unsyncedIds.has(r.id));
  if (pendingReports.length === 0) return 0;

  let syncedCount = 0;
  for (const rep of pendingReports) {
    try {
      const res = await saveReportToCloud({
        ...rep,
        authorUid: rep.authorUid || auth.currentUser?.uid || undefined,
      });
      if (res.status === 'synced') {
        syncedCount++;
      }
    } catch {
      // Keep marked as unsynced for next attempt
    }
  }
  return syncedCount;
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
    await deleteDoc(doc(db, REPORT_PHOTOS_COLLECTION, id)).catch(() => {});
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
    const chunkSize = 200;
    const existingDocs = snapshot.docs;
    for (let i = 0; i < existingDocs.length; i += chunkSize) {
      const deleteBatch = writeBatch(db);
      for (const d of existingDocs.slice(i, i + chunkSize)) {
        deleteBatch.delete(d.ref);
        deleteBatch.delete(doc(db, REPORT_PHOTOS_COLLECTION, d.id));
      }
      await deleteBatch.commit();
    }

    for (let i = 0; i < reports.length; i += chunkSize) {
      const chunk = reports.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const rep of chunk) {
        const safePhotos = await ensureReportPhotosFitLimit(rep.fotoBukti);
        const isOffloaded = safePhotos.length > 0;
        const thumbList = isOffloaded ? [await createMicroThumbnail(safePhotos[0])] : [];
        const sanitized = sanitizeForFirestore({
          ...rep,
          checklist: Array.isArray(rep.checklist) ? rep.checklist : [],
          keteranganTambahan: rep.keteranganTambahan ?? '',
          fotoBukti: thumbList,
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
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Ensures the signed-in Superadmin UID is recorded in /admins/{uid}
 * and migrates legacy config docs from /users/config_* if present.
 */
let hasCheckedLegacyMigration = false;

export async function migrateLegacyConfigsIfNeeded(): Promise<void> {
  if (hasCheckedLegacyMigration || !isCurrentAuthSuperAdmin()) return;
  hasCheckedLegacyMigration = true;

  try {
    const newFormRef = doc(db, FORM_CONFIGS_COLLECTION, FORM_CONFIG_DOC_ID);
    const newFormSnap = await getDoc(newFormRef);
    if (!newFormSnap.exists()) {
      const legacyFormSnap = await getDoc(doc(db, USERS_COLLECTION, FORM_CONFIG_DOC_ID));
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
      }
    }

    const newSchedRef = doc(db, ROOM_SCHEDULES_COLLECTION, ROOM_SCHEDULE_DOC_ID);
    const newSchedSnap = await getDoc(newSchedRef);
    if (!newSchedSnap.exists()) {
      const legacySchedSnap = await getDoc(doc(db, USERS_COLLECTION, ROOM_SCHEDULE_DOC_ID));
      if (legacySchedSnap.exists()) {
        const legacyData = legacySchedSnap.data();
        if (Array.isArray(legacyData?.schedules)) {
          await setDoc(
            newSchedRef,
            sanitizeForFirestore({ schedules: legacyData.schedules })
          );
        }
      }
    }
  } catch (err) {
    console.warn('Legacy config migration check note:', err);
  }
}

export async function ensureSuperAdminRecord(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !isCurrentAuthSuperAdmin()) return;
  const path = `${ADMINS_COLLECTION}/${currentUser.uid}`;
  try {
    await setDoc(
      doc(db, ADMINS_COLLECTION, currentUser.uid),
      {
        uid: currentUser.uid,
        email: (currentUser.email || SUPERADMIN_EMAIL).toLowerCase(),
        role: 'superadmin',
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    await migrateLegacyConfigsIfNeeded();
  } catch (err) {
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
  const usersQuery = isAdmin
    ? query(collection(db, USERS_COLLECTION))
    : query(collection(db, USERS_COLLECTION), where('email', '==', fbUser.email.trim().toLowerCase()));

  return onSnapshot(
    usersQuery,
    async (snapshot) => {
      if (isAdmin && lastBootstrappedAdminUid !== fbUser.uid) {
        lastBootstrappedAdminUid = fbUser.uid;
        await ensureSuperAdminRecord().catch((err) => {
          if (!isQuotaExceededError(err)) {
            console.warn('Admin bootstrap note:', err);
          }
        });
      }

      if (snapshot.empty && isAdmin && !isUsersSeeded) {
        isUsersSeeded = true;
        const localUsers = getUsersFromStorage();
        const initialToSeed = localUsers && localUsers.length > 0 ? localUsers : INITIAL_USERS;
        try {
          const batch = writeBatch(db);
          for (const u of initialToSeed) {
            const cleanUser = sanitizeForFirestore({
              ...u,
              email: (u.email || `${u.username}@scb.sch.id`).trim().toLowerCase(),
            });
            batch.set(doc(db, USERS_COLLECTION, u.id), cleanUser);
            if (cleanUser.email) {
              batch.set(doc(db, STAFF_ROLES_COLLECTION, toEmailKey(cleanUser.email)), {
                email: cleanUser.email,
                role: cleanUser.role,
                isActive: cleanUser.isActive !== false,
                userId: cleanUser.id,
                updatedAt: serverTimestamp(),
              });
            }
          }
          await batch.commit();
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

        // Backfill staff_roles directory once per authenticated admin session (never on every snapshot)
        if (lastBackfilledAdminUid !== fbUser.uid) {
          lastBackfilledAdminUid = fbUser.uid;
          Promise.all(mergedUsers.map((u) => syncStaffRoleToCloud(u))).catch((err) => {
            if (!isQuotaExceededError(err)) {
              console.warn('Staff role backfill note:', err);
            }
          });
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
        console.warn('Firestore quota exceeded on users listener, using local storage cache.');
        return;
      }
      handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
    }
  );
}

/**
 * Save user to Firestore and sync staff_roles
 */
export async function saveUserToCloud(user: User): Promise<void> {
  const current = getUsersFromStorage();
  const normalizedUser: User = {
    ...user,
    email: (user.email || `${user.username}@scb.sch.id`).trim().toLowerCase(),
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
    await setDoc(docRef, sanitizeForFirestore(normalizedUser), { merge: true });
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
    if (targetUser?.email && isCurrentAuthSuperAdmin()) {
      await deleteDoc(doc(db, STAFF_ROLES_COLLECTION, toEmailKey(targetUser.email)));
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

  // Guest optimization: use 15-min local cache or single one-shot getDoc instead of live onSnapshot
  if (!isFirebaseCloudConnected()) {
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

  return onSnapshot(
    docRef,
    async (snapshot) => {
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
    setUnsyncedFlag(UNSYNCED_FORM_CONFIG_KEY, false);
    return { status: 'synced' };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
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

  // Guest optimization: use 15-min local cache or single one-shot getDoc instead of live onSnapshot
  if (!isFirebaseCloudConnected()) {
    const hasLocalSchedules = Boolean(localStorage.getItem('scb_room_schedules_v1'));
    if (hasLocalSchedules && isCacheFresh(SCHEDULES_FETCHED_AT_KEY, CONFIG_CACHE_TTL_MS)) {
      onSchedulesChanged(getRoomSchedules());
      return () => {};
    }

    let cancelled = false;
    getDoc(docRef)
      .then((snapshot) => {
        if (cancelled) return;
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

  return onSnapshot(
    docRef,
    async (snapshot) => {
      notifyQuotaStatus(false);
      markCacheFetchedNow(SCHEDULES_FETCHED_AT_KEY);

      if (hasUnsyncedFlag(UNSYNCED_SCHEDULES_KEY)) {
        const localSchedules = getRoomSchedules();
        onSchedulesChanged(localSchedules);

        if (isCurrentAuthSuperAdmin()) {
          try {
            await setDoc(docRef, { schedules: sanitizeForFirestore(localSchedules) });
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
    setUnsyncedFlag(UNSYNCED_SCHEDULES_KEY, false);
    return { status: 'synced' };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
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
    const existingRolesSnap = await getDocs(collection(db, STAFF_ROLES_COLLECTION));
    const desiredIds = new Set(users.map((u) => u.id));
    const desiredEmailKeys = new Set(
      users
        .map((u) => (u.email || `${u.username}@scb.sch.id`).trim().toLowerCase())
        .filter(Boolean)
        .map((email) => toEmailKey(email))
    );
    const batch = writeBatch(db);

    existingSnap.forEach((docSnap) => {
      if (!docSnap.id.startsWith('config_') && !docSnap.id.startsWith('sys_') && !desiredIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    existingRolesSnap.forEach((roleSnap) => {
      if (!desiredEmailKeys.has(roleSnap.id)) {
        batch.delete(roleSnap.ref);
      }
    });

    for (const u of users) {
      const cleanUser = sanitizeForFirestore({
        ...u,
        email: (u.email || `${u.username}@scb.sch.id`).trim().toLowerCase(),
      });
      batch.set(doc(db, USERS_COLLECTION, cleanUser.id), cleanUser);
      if (cleanUser.email) {
        batch.set(doc(db, STAFF_ROLES_COLLECTION, toEmailKey(cleanUser.email)), {
          email: cleanUser.email,
          role: cleanUser.role,
          isActive: cleanUser.isActive !== false,
          userId: cleanUser.id,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
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
