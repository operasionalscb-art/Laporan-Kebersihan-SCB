import { CleaningReport } from '../types';
import { getTodayDateString } from '../utils/storage';

export const SPARK_DAILY_READS_LIMIT = 50_000;
export const SPARK_DAILY_WRITES_LIMIT = 20_000;
export const SPARK_DAILY_DELETES_LIMIT = 20_000;
export const SPARK_STORAGE_BYTES_LIMIT = 1024 * 1024 * 1024; // 1 GiB

export type FirestoreMeterCategory =
  | 'reports'
  | 'report_photos'
  | 'users'
  | 'configs'
  | 'public_summary';

export interface CategoryMeterCounts {
  reads: number;
  writes: number;
  deletes: number;
  cacheHits: number;
}

export interface FirestoreMeterStats {
  date: string;
  reads: number;
  writes: number;
  deletes: number;
  cacheHits: number;
  activeListeners: string[];
  breakdown: Record<FirestoreMeterCategory, CategoryMeterCounts>;
  lastUpdatedAt: number;
}

export interface FirestoreFootprintEstimate {
  reportsCount: number;
  reportsSummaryBytes: number;
  pendingPhotoReportsCount: number;
  pendingPhotosBytes: number;
  archivedDriveReportsCount: number;
  totalEstimatedBytes: number;
  storagePercent: number;
}

export const CATEGORY_LABELS: Record<FirestoreMeterCategory, string> = {
  reports: 'Laporan Kebersihan (reports)',
  report_photos: 'Antrean Foto Base64 (report_photos)',
  users: 'Akun & Role (users / staff_roles)',
  configs: 'Master Form & Jadwal',
  public_summary: 'Notifikasi Publik & Sistem',
};

const METER_STORAGE_KEY = 'scb_firestore_meter_daily_v1';
const meterSubscribers = new Set<(stats: FirestoreMeterStats) => void>();
const activeListenerSet = new Set<string>();

function createEmptyBreakdown(): Record<FirestoreMeterCategory, CategoryMeterCounts> {
  return {
    reports: { reads: 0, writes: 0, deletes: 0, cacheHits: 0 },
    report_photos: { reads: 0, writes: 0, deletes: 0, cacheHits: 0 },
    users: { reads: 0, writes: 0, deletes: 0, cacheHits: 0 },
    configs: { reads: 0, writes: 0, deletes: 0, cacheHits: 0 },
    public_summary: { reads: 0, writes: 0, deletes: 0, cacheHits: 0 },
  };
}

function createFreshStats(today: string): FirestoreMeterStats {
  return {
    date: today,
    reads: 0,
    writes: 0,
    deletes: 0,
    cacheHits: 0,
    activeListeners: Array.from(activeListenerSet),
    breakdown: createEmptyBreakdown(),
    lastUpdatedAt: Date.now(),
  };
}

function loadStats(): FirestoreMeterStats {
  const today = getTodayDateString();
  try {
    const raw = localStorage.getItem(METER_STORAGE_KEY);
    if (!raw) return createFreshStats(today);
    const parsed = JSON.parse(raw) as Partial<FirestoreMeterStats>;
    if (!parsed || parsed.date !== today) {
      return createFreshStats(today);
    }
    const base = createEmptyBreakdown();
    if (parsed.breakdown) {
      (Object.keys(base) as FirestoreMeterCategory[]).forEach((cat) => {
        const incoming = parsed.breakdown?.[cat];
        if (incoming) {
          base[cat] = {
            reads: Number(incoming.reads) || 0,
            writes: Number(incoming.writes) || 0,
            deletes: Number(incoming.deletes) || 0,
            cacheHits: Number(incoming.cacheHits) || 0,
          };
        }
      });
    }
    return {
      date: today,
      reads: Number(parsed.reads) || 0,
      writes: Number(parsed.writes) || 0,
      deletes: Number(parsed.deletes) || 0,
      cacheHits: Number(parsed.cacheHits) || 0,
      activeListeners: Array.from(activeListenerSet),
      breakdown: base,
      lastUpdatedAt: Number(parsed.lastUpdatedAt) || Date.now(),
    };
  } catch {
    return createFreshStats(today);
  }
}

function saveAndNotify(stats: FirestoreMeterStats): void {
  const withListeners: FirestoreMeterStats = {
    ...stats,
    activeListeners: Array.from(activeListenerSet),
    lastUpdatedAt: Date.now(),
  };
  try {
    localStorage.setItem(METER_STORAGE_KEY, JSON.stringify(withListeners));
  } catch {
    // Ignore storage quota errors on meter state
  }
  meterSubscribers.forEach((cb) => {
    try {
      cb(withListeners);
    } catch {
      // Ignore subscriber error
    }
  });
}

export function getFirestoreMeterStats(): FirestoreMeterStats {
  return loadStats();
}

export function subscribeFirestoreMeter(
  callback: (stats: FirestoreMeterStats) => void
): () => void {
  meterSubscribers.add(callback);
  callback(loadStats());
  return () => {
    meterSubscribers.delete(callback);
  };
}

export function recordFirestoreRead(
  category: FirestoreMeterCategory,
  count = 1,
  fromCache = false
): void {
  const safeCount = Math.max(0, Math.round(count));
  if (safeCount === 0) return;
  const stats = loadStats();
  if (fromCache) {
    stats.cacheHits += safeCount;
    stats.breakdown[category].cacheHits += safeCount;
  } else {
    stats.reads += safeCount;
    stats.breakdown[category].reads += safeCount;
  }
  saveAndNotify(stats);
}

export function recordFirestoreWrite(
  category: FirestoreMeterCategory,
  count = 1
): void {
  const safeCount = Math.max(0, Math.round(count));
  if (safeCount === 0) return;
  const stats = loadStats();
  stats.writes += safeCount;
  stats.breakdown[category].writes += safeCount;
  saveAndNotify(stats);
}

export function recordFirestoreDelete(
  category: FirestoreMeterCategory,
  count = 1
): void {
  const safeCount = Math.max(0, Math.round(count));
  if (safeCount === 0) return;
  const stats = loadStats();
  stats.deletes += safeCount;
  stats.breakdown[category].deletes += safeCount;
  saveAndNotify(stats);
}

export function setFirestoreActiveListener(label: string, active: boolean): void {
  const had = activeListenerSet.has(label);
  if (active && !had) {
    activeListenerSet.add(label);
    saveAndNotify(loadStats());
  } else if (!active && had) {
    activeListenerSet.delete(label);
    saveAndNotify(loadStats());
  }
}

export function resetFirestoreMeterToday(): void {
  const fresh = createFreshStats(getTodayDateString());
  saveAndNotify(fresh);
}

export function estimateFirestoreFootprint(
  reports: CleaningReport[],
  usersCount: number
): FirestoreFootprintEstimate {
  let reportsSummaryBytes = 0;
  let pendingPhotosBytes = 0;
  let pendingPhotoReportsCount = 0;
  let archivedDriveReportsCount = 0;

  for (const r of reports) {
    const driveLinks = Array.isArray(r.drivePhotoLinks)
      ? r.drivePhotoLinks.filter((l) => typeof l === 'string' && l.startsWith('http'))
      : [];
    const base64Photos = Array.isArray(r.fotoBukti)
      ? r.fotoBukti.filter((p) => typeof p === 'string' && p.startsWith('data:image/') && !p.startsWith('data:image/svg+xml'))
      : [];
    const urlPhotos = Array.isArray(r.fotoBukti)
      ? r.fotoBukti.filter((p) => typeof p === 'string' && p.startsWith('http'))
      : [];

    const hasDrive = driveLinks.length > 0 || urlPhotos.length > 0;
    const isPendingPhotoInFirestore =
      !hasDrive && (Boolean(r.photosOffloaded) || base64Photos.length > 0);

    if (hasDrive && !isPendingPhotoInFirestore) {
      archivedDriveReportsCount += 1;
    }

    if (isPendingPhotoInFirestore) {
      pendingPhotoReportsCount += 1;
      if (base64Photos.length > 0) {
        pendingPhotosBytes += base64Photos.reduce((acc, s) => acc + s.length, 0);
      } else {
        // Hydrated photos not loaded locally yet: average compressed photo bundle ~180 KB per report
        const countEstimate = Math.max(1, r.fotoCount || 1);
        pendingPhotosBytes += countEstimate * 120_000;
      }
      // Summary doc in /reports holds text metadata + ~3KB micro-thumbnail
      reportsSummaryBytes += 4_200;
    } else {
      const checklistBytes = Array.isArray(r.checklist) ? r.checklist.length * 75 : 0;
      const textBytes =
        900 +
        (r.keteranganTambahan?.length || 0) +
        (r.catatanSupervisor?.length || 0) +
        checklistBytes +
        driveLinks.reduce((acc, s) => acc + s.length, 0);
      reportsSummaryBytes += textBytes;
    }
  }

  const overheadBytes = Math.max(1, usersCount) * 600 + 25_000; // users + staff_roles + form_configs + schedules + public_summary
  const totalEstimatedBytes = reportsSummaryBytes + pendingPhotosBytes + overheadBytes;
  const storagePercent = Math.min(100, (totalEstimatedBytes / SPARK_STORAGE_BYTES_LIMIT) * 100);

  return {
    reportsCount: reports.length,
    reportsSummaryBytes,
    pendingPhotoReportsCount,
    pendingPhotosBytes,
    archivedDriveReportsCount,
    totalEstimatedBytes,
    storagePercent,
  };
}
