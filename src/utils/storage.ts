import { CleaningReport, User } from '../types';
import { createSamplePhotoUrl } from './imageCompressor';
import { saveReportsToIDB, loadReportsFromIDB, saveUsersToIDB, loadUsersFromIDB } from './indexedDb';

const STORAGE_USERS_KEY = 'scb_cleaning_users_v2';
const STORAGE_REPORTS_KEY = 'scb_cleaning_reports_v2';
const STORAGE_CURRENT_USER_KEY = 'scb_current_user_v2';

// In-memory cache for ultra-fast, zero-quota-limit access
let inMemoryReports: CleaningReport[] | null = null;

// Trigger IDB background hydration once
if (typeof window !== 'undefined') {
  loadReportsFromIDB().then((idbReports) => {
    if (idbReports && idbReports.length > 0) {
      const cleanIdb = idbReports.filter((r) => !['rep-1', 'rep-2', 'rep-3', 'rep-4'].includes(r.id));
      if (!inMemoryReports || inMemoryReports.length === 0) {
        inMemoryReports = cleanIdb;
      } else {
        // Merge full photos from IDB into inMemoryReports in case localStorage had stripped them
        const idbMap = new Map(cleanIdb.map((r) => [r.id, r]));
        inMemoryReports = inMemoryReports
          .filter((r) => !['rep-1', 'rep-2', 'rep-3', 'rep-4'].includes(r.id))
          .map((r) => {
            const fromIdb = idbMap.get(r.id);
            if (fromIdb && fromIdb.fotoBukti && fromIdb.fotoBukti.length > 0 && (!r.fotoBukti || r.fotoBukti.length === 0)) {
              return { ...r, fotoBukti: fromIdb.fotoBukti };
            }
            return r;
          });
      }
    }
  }).catch(() => {});
}

const STORAGE_OFFICIAL_USERS_SYNC_KEY = 'scb_official_users_sync_v1';
const STORAGE_CANONICAL_USERS_SYNC_KEY = 'scb_canonical_users_reset_v2';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-supervisor-windi',
    name: 'WINDI',
    email: 'operasional.ga2022@gmail.com',
    username: 'windi',
    password: 'supervisor123',
    pin: '1234',
    role: 'supervisor',
    isActive: true,
    createdAt: '2026-09-29',
    avatarColor: 'from-emerald-600 to-teal-700',
  },
  {
    id: 'user-supervisor-azar',
    name: 'AZAR',
    email: 'it.labkomscb@gmail.com',
    username: 'azar',
    password: 'supervisor123',
    pin: '1234',
    role: 'supervisor',
    isActive: true,
    createdAt: '2026-09-30',
    avatarColor: 'from-emerald-600 to-teal-700',
  },
  {
    id: 'user-admin-1',
    name: 'SUPERADMIN OPERASIONAL SCB',
    email: 'operasional.scb@gmail.com',
    username: 'operasional.scb',
    password: 'admin123',
    pin: '123456',
    role: 'superadmin',
    phone: '081298765432',
    isActive: true,
    createdAt: '2026-01-01',
    avatarColor: 'from-emerald-600 to-teal-700',
  },
  {
    id: 'user-officer-1',
    name: 'IDAY M YUSUF',
    email: 'idaymuhamadyusup@gmail.com',
    username: 'iday',
    password: '123456',
    pin: '1234',
    role: 'petugas',
    phone: '085712345678',
    isActive: true,
    createdAt: '2026-01-10',
    avatarColor: 'from-blue-600 to-indigo-700',
  },
  {
    id: 'user-officer-3',
    name: 'WAHYUDIN',
    email: 'aldbayu88@gmail.com',
    username: 'wahyudin',
    password: '123456',
    pin: '1234',
    role: 'petugas',
    phone: '081399887766',
    isActive: true,
    createdAt: '2026-01-15',
    avatarColor: 'from-purple-600 to-fuchsia-700',
  },
];

export const INITIAL_AREAS = [
  'KM MASJID PUTRA',
  'KM KANTOR UTAMA',
  'KM KELAS PUTRA',
  'T WUDHU KLINIK',
  'KM KELAS PUTRI',
  'KM UKS',
];

export const INITIAL_CHECKLIST_ITEMS = [
  'Kloset Bersih',
  'Kran Ada',
  'Ember Ada',
  'Air ada',
  'Gayung Ada',
];

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeString(): string {
  const d = new Date();
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
}

export const INITIAL_REPORTS: CleaningReport[] = [];

/**
 * Normalizes a user list strictly to the 5 canonical SCB accounts while preserving
 * any customized credentials/phone/active state on those 5 accounts.
 */
export function canonicalizeUsersToOfficial(existing: User[]): User[] {
  const byId = new Map<string, User>();
  const byEmail = new Map<string, User>();
  const byUsername = new Map<string, User>();

  for (const u of existing || []) {
    if (!u) continue;
    if (u.id) byId.set(u.id, u);
    if (u.email) byEmail.set(u.email.trim().toLowerCase(), u);
    if (u.username) byUsername.set(u.username.trim().toLowerCase(), u);
  }

  return INITIAL_USERS.map((official) => {
    const matched =
      byId.get(official.id) ||
      byEmail.get(official.email.trim().toLowerCase()) ||
      byUsername.get(official.username.trim().toLowerCase());

    if (!matched) return { ...official };

    return {
      ...official,
      password: matched.password || official.password,
      pin: matched.pin || official.pin,
      phone: matched.phone ?? official.phone,
      isActive: matched.isActive !== undefined ? matched.isActive : official.isActive,
      avatarColor: matched.avatarColor || official.avatarColor,
      photoURL: matched.photoURL || official.photoURL,
    };
  });
}

function syncOfficialUsersOnce(existing: User[]): User[] {
  try {
    if (localStorage.getItem(STORAGE_CANONICAL_USERS_SYNC_KEY) === 'true') {
      return existing;
    }

    const canonical = canonicalizeUsersToOfficial(existing);
    saveUsers(canonical);

    // Ensure any stale current user session not in the canonical 5 accounts is cleared/aligned
    try {
      const rawCurrent = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
      if (rawCurrent && rawCurrent !== 'null' && rawCurrent !== 'undefined') {
        const parsedCurrent = JSON.parse(rawCurrent) as User;
        const matchedCanonical = canonical.find(
          (u) =>
            u.id === parsedCurrent?.id ||
            u.email.toLowerCase() === (parsedCurrent?.email || '').trim().toLowerCase() ||
            u.username.toLowerCase() === (parsedCurrent?.username || '').trim().toLowerCase()
        );
        if (matchedCanonical) {
          localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(matchedCanonical));
        } else {
          localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
        }
      }
    } catch {}

    localStorage.setItem(STORAGE_OFFICIAL_USERS_SYNC_KEY, 'true');
    localStorage.setItem(STORAGE_CANONICAL_USERS_SYNC_KEY, 'true');
    return canonical;
  } catch {
    return existing;
  }
}

// User storage
export function getUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (!raw) {
      saveUsers(INITIAL_USERS);
      localStorage.setItem(STORAGE_OFFICIAL_USERS_SYNC_KEY, 'true');
      localStorage.setItem(STORAGE_CANONICAL_USERS_SYNC_KEY, 'true');
      return INITIAL_USERS;
    }
    const parsed: User[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveUsers(INITIAL_USERS);
      localStorage.setItem(STORAGE_OFFICIAL_USERS_SYNC_KEY, 'true');
      localStorage.setItem(STORAGE_CANONICAL_USERS_SYNC_KEY, 'true');
      return INITIAL_USERS;
    }

    return syncOfficialUsersOnce(parsed);
  } catch (e) {
    console.error('Failed to load users from localStorage', e);
    return INITIAL_USERS;
  }
}

export function saveUsers(users: User[]): void {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    saveUsersToIDB(users).catch(() => {});
  } catch (e) {
    console.warn('Failed to save users to localStorage', e);
  }
}

export function addUser(user: Omit<User, 'id' | 'createdAt'>): User {
  const users = getUsers();
  const newUser: User = {
    ...user,
    id: `user-${Date.now()}`,
    createdAt: getTodayDateString(),
    avatarColor: user.avatarColor || 'from-emerald-600 to-teal-700',
  };
  users.push(newUser);
  saveUsers(users);
  return newUser;
}

export function updateUser(id: string, updates: Partial<User>): User | null {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...updates };
  saveUsers(users);
  return users[idx];
}

export function deleteUser(id: string): boolean {
  const users = getUsers();
  const filtered = users.filter((u) => u.id !== id);
  if (filtered.length === users.length) return false;
  saveUsers(filtered);
  return true;
}

// Reports storage

/**
 * Safely writes reports to localStorage with smart quota fallbacks.
 * Prevents QuotaExceededError by pruning large base64 strings if necessary,
 * while the complete photos and records are safely preserved in memory and IndexedDB.
 */
function safelySaveToLocalStorage(reports: CleaningReport[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  // Attempt 1: Try saving the full reports directly
  try {
    localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(reports));
    return;
  } catch {
    // Quota exceeded or error - proceed to fallbacks
  }

  // Attempt 2: Keep photos for the 3 newest reports, strip large base64 strings from older reports
  try {
    const trimmedOlderPhotos = reports.map((r, index) => {
      if (index < 3) return r;
      return {
        ...r,
        fotoBukti: r.fotoBukti
          ? r.fotoBukti.filter((f) => f.length < 500 || f.startsWith('data:image/svg+xml'))
          : [],
      };
    });
    localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(trimmedOlderPhotos));
    return;
  } catch {
    // Still exceeded quota
  }

  // Attempt 3: Strip large base64 data URLs from all reports in localStorage copy
  try {
    const withoutHeavyPhotos = reports.map((r) => ({
      ...r,
      fotoBukti: r.fotoBukti
        ? r.fotoBukti.filter((f) => f.length < 500 || f.startsWith('data:image/svg+xml'))
        : [],
    }));
    localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(withoutHeavyPhotos));
    return;
  } catch {
    // Still exceeded quota
  }

  // Attempt 4: Keep only recent 25 reports without heavy photos
  try {
    const compactReports = reports.slice(0, 25).map((r) => ({
      ...r,
      fotoBukti: [],
    }));
    localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(compactReports));
  } catch {
    console.warn('LocalStorage quota reached. Active reports are maintained in memory and IndexedDB.');
  }
}

export function getReports(): CleaningReport[] {
  // If memory cache is populated, filter out legacy demo reports and return
  if (inMemoryReports !== null) {
    const nonDemo = inMemoryReports.filter((r) => !['rep-1', 'rep-2', 'rep-3', 'rep-4'].includes(r.id));
    if (nonDemo.length !== inMemoryReports.length) {
      inMemoryReports = nonDemo;
      safelySaveToLocalStorage(nonDemo);
      saveReportsToIDB(nonDemo).catch(() => {});
    }
    return inMemoryReports;
  }

  try {
    const raw = localStorage.getItem(STORAGE_REPORTS_KEY);
    if (!raw) {
      inMemoryReports = [];
      return inMemoryReports;
    }
    const parsed = JSON.parse(raw);
    const result: CleaningReport[] = Array.isArray(parsed)
      ? parsed.filter((r: CleaningReport) => !['rep-1', 'rep-2', 'rep-3', 'rep-4'].includes(r.id))
      : [];
    inMemoryReports = [...result];
    return inMemoryReports;
  } catch (e) {
    console.warn('Fallback loading reports', e);
    inMemoryReports = [];
    return inMemoryReports;
  }
}

export function saveReports(reports: CleaningReport[]): void {
  // 1. Instantly update in-memory cache
  inMemoryReports = [...reports];

  // 2. Persist full data asynchronously to IndexedDB (no 5MB quota limit)
  saveReportsToIDB(reports).catch(() => {});

  // 3. Persist to localStorage with smart quota-safe fallback
  safelySaveToLocalStorage(reports);
}

export function addReport(report: Omit<CleaningReport, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): CleaningReport {
  const reports = getReports();
  const newReport: CleaningReport = {
    ...report,
    id: report.id || `rep-${Date.now()}`,
    timestamp: report.timestamp || Date.now(),
  };
  reports.unshift(newReport);
  saveReports(reports);
  return newReport;
}

export function updateReport(id: string, updates: Partial<CleaningReport>): CleaningReport | null {
  const reports = getReports();
  const idx = reports.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  reports[idx] = { ...reports[idx], ...updates };
  saveReports(reports);
  return reports[idx];
}

export function deleteReport(id: string): boolean {
  const reports = getReports();
  const filtered = reports.filter((r) => r.id !== id);
  if (filtered.length === reports.length) return false;
  saveReports(filtered);
  return true;
}

// Current User Session
export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (raw && raw !== 'null' && raw !== 'undefined') {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function setCurrentUser(user: User): void {
  localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
}

export function clearCurrentUser(): void {
  localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
}

export function resetAllData(): void {
  inMemoryReports = [...INITIAL_REPORTS];
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(INITIAL_USERS));
    safelySaveToLocalStorage(INITIAL_REPORTS);
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    saveReportsToIDB(INITIAL_REPORTS).catch(() => {});
    saveUsersToIDB(INITIAL_USERS).catch(() => {});
  } catch (e) {
    console.warn('Reset local storage notice:', e);
  }
}

// Export to CSV
export function exportReportsToCsv(reports: CleaningReport[]): void {
  const headers = [
    'ID Laporan',
    'Tanggal',
    'Waktu',
    'Petugas',
    'Area',
    'Kondisi Akhir',
    'Checklist',
    'Keterangan Tambahan',
    'Status Verifikasi',
    'Catatan Supervisor',
  ];

  const rows = reports.map((r) => [
    r.id,
    r.tanggal,
    r.waktu,
    `"${r.namaPetugas}"`,
    `"${r.isAreaOther ? r.areaCustom || r.area : r.area}"`,
    `"${r.kondisiAkhir}"`,
    `"${r.checklist.join('; ')}"`,
    `"${(r.keteranganTambahan || '').replace(/"/g, '""')}"`,
    `"${r.statusVerifikasi}"`,
    `"${(r.catatanSupervisor || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' +
    [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Laporan_Kebersihan_SCB_${getTodayDateString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
