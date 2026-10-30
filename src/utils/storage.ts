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
      if (!inMemoryReports || inMemoryReports.length === 0) {
        inMemoryReports = idbReports;
      } else {
        // Merge full photos from IDB into inMemoryReports in case localStorage had stripped them
        const idbMap = new Map(idbReports.map((r) => [r.id, r]));
        inMemoryReports = inMemoryReports.map((r) => {
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

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin-1',
    name: 'Superadmin Operasional SCB',
    email: 'operasional.scb@gmail.com',
    username: 'operasional.scb',
    password: 'admin123',
    pin: '123456',
    role: 'superadmin',
    phone: '081298765432',
    isActive: true,
    createdAt: '2026-01-01',
    avatarColor: 'from-amber-600 to-yellow-700',
  },
  {
    id: 'user-supervisor-1',
    name: 'SUPERVISOR SARPRAS SCB',
    email: 'supervisor@scb.sch.id',
    username: 'supervisor',
    password: 'supervisor123',
    pin: '1234',
    role: 'supervisor',
    phone: '081234567890',
    isActive: true,
    createdAt: '2026-01-05',
    avatarColor: 'from-blue-600 to-indigo-700',
  },
  {
    id: 'user-officer-1',
    name: 'IDAY M YUSUF',
    email: 'iday@scb.sch.id',
    username: 'iday',
    password: '123456',
    pin: '1234',
    role: 'petugas',
    phone: '085712345678',
    isActive: true,
    createdAt: '2026-01-10',
    avatarColor: 'from-emerald-600 to-teal-700',
  },
  {
    id: 'user-officer-2',
    name: 'ABDUL KODIR',
    email: 'kodir@scb.sch.id',
    username: 'kodir',
    password: '123456',
    pin: '1234',
    role: 'petugas',
    phone: '085887654321',
    isActive: true,
    createdAt: '2026-01-10',
    avatarColor: 'from-amber-600 to-orange-700',
  },
  {
    id: 'user-officer-3',
    name: 'WAHYUDIN',
    email: 'wahyudin@scb.sch.id',
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

export const INITIAL_REPORTS: CleaningReport[] = [
  {
    id: 'rep-1',
    tanggal: getTodayDateString(),
    waktu: '07:30',
    timestamp: Date.now() - 3600000 * 3,
    petugasId: 'user-officer-1',
    namaPetugas: 'IDAY M YUSUF',
    area: 'KM MASJID PUTRA',
    isAreaOther: false,
    checklist: ['Kloset Bersih', 'Kran Ada', 'Ember Ada', 'Air ada', 'Gayung Ada'],
    kondisiAkhir: 'Bersih',
    keteranganTambahan: 'Kamar mandi sudah disikat wangi, bak air telah dikuras penuh.',
    fotoBukti: [
      createSamplePhotoUrl('KM MASJID PUTRA', 'Kondisi: Bersih & Rapi - IDAY M YUSUF', '#059669'),
    ],
    statusVerifikasi: 'Disetujui',
    catatanSupervisor: 'Bagus, kebersihan sangat terjaga menjelang shalat Dhuha.',
    diverifikasiOleh: 'Superadmin Operasional SCB',
    diverifikasiPada: '08:15',
  },
  {
    id: 'rep-2',
    tanggal: getTodayDateString(),
    waktu: '08:05',
    timestamp: Date.now() - 3600000 * 2,
    petugasId: 'user-officer-2',
    namaPetugas: 'ABDUL KODIR',
    area: 'KM KANTOR UTAMA',
    isAreaOther: false,
    checklist: ['Kloset Bersih', 'Kran Ada', 'Ember Ada', 'Air ada', 'Gayung Ada'],
    kondisiAkhir: 'Bersih',
    keteranganTambahan: 'Lantai dipel kering dan diberi pengharum ruangan.',
    fotoBukti: [
      createSamplePhotoUrl('KM KANTOR UTAMA', 'Kondisi: Bersih - ABDUL KODIR', '#0284c7'),
    ],
    statusVerifikasi: 'Disetujui',
    catatanSupervisor: 'Sesuai standar operasional.',
    diverifikasiOleh: 'Superadmin Operasional SCB',
    diverifikasiPada: '08:40',
  },
  {
    id: 'rep-3',
    tanggal: getTodayDateString(),
    waktu: '08:45',
    timestamp: Date.now() - 3600000 * 1,
    petugasId: 'user-officer-1',
    namaPetugas: 'IDAY M YUSUF',
    area: 'T WUDHU KLINIK',
    isAreaOther: false,
    checklist: ['Kloset Bersih', 'Ember Ada', 'Air ada'],
    kondisiAkhir: 'Ada Kerusakan',
    keteranganTambahan: 'Kran no. 2 dari kiri dol / bocor air menetes terus, perlu diganti seal atau kran baru oleh tim sarpras.',
    fotoBukti: [
      createSamplePhotoUrl('T WUDHU KLINIK', 'PERHATIAN: Kran Bocor - IDAY M YUSUF', '#dc2626'),
    ],
    statusVerifikasi: 'Perlu Perbaikan',
    catatanSupervisor: 'Sudah diteruskan ke teknisi sarpras untuk penggantian kran.',
    diverifikasiOleh: 'Superadmin Operasional SCB',
    diverifikasiPada: '09:00',
  },
  {
    id: 'rep-4',
    tanggal: getTodayDateString(),
    waktu: '09:15',
    timestamp: Date.now() - 1800000,
    petugasId: 'user-officer-3',
    namaPetugas: 'WAHYUDIN',
    area: 'KM KELAS PUTRA',
    isAreaOther: false,
    checklist: ['Kloset Bersih', 'Kran Ada', 'Air ada', 'Gayung Ada'],
    kondisiAkhir: 'Perlu Pengecekan Ulang',
    keteranganTambahan: 'Ember plastik retak di bagian samping bawah, sabun cuci tangan habis.',
    fotoBukti: [
      createSamplePhotoUrl('KM KELAS PUTRA', 'Perlu Pengecekan: Ember Retak - WAHYUDIN', '#d97706'),
    ],
    statusVerifikasi: 'Menunggu',
  },
];

// User storage
export function getUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    const parsed: User[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }

    // Ensure default supervisor exists in existing saved users
    const hasSupervisor = parsed.some((u) => u.role === 'supervisor');
    if (!hasSupervisor) {
      const defaultSupervisor: User = {
        id: 'user-supervisor-1',
        name: 'SUPERVISOR SARPRAS SCB',
        email: 'supervisor@scb.sch.id',
        username: 'supervisor',
        password: 'supervisor123',
        pin: '1234',
        role: 'supervisor',
        phone: '081234567890',
        isActive: true,
        createdAt: '2026-01-05',
        avatarColor: 'from-blue-600 to-indigo-700',
      };
      parsed.splice(1, 0, defaultSupervisor);
      saveUsers(parsed);
    }

    return parsed;
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
    avatarColor: 'from-emerald-600 to-teal-700',
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
  // If memory cache is populated, return it immediately
  if (inMemoryReports && inMemoryReports.length > 0) {
    return inMemoryReports;
  }

  try {
    const raw = localStorage.getItem(STORAGE_REPORTS_KEY);
    if (!raw) {
      inMemoryReports = [...INITIAL_REPORTS];
      safelySaveToLocalStorage(INITIAL_REPORTS);
      saveReportsToIDB(INITIAL_REPORTS).catch(() => {});
      return inMemoryReports;
    }
    const parsed = JSON.parse(raw);
    const result = Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_REPORTS;
    inMemoryReports = [...result];
    return inMemoryReports;
  } catch (e) {
    console.warn('Fallback loading reports from initial data', e);
    inMemoryReports = [...INITIAL_REPORTS];
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
    // Default to Supervisor account so the user has immediate supervisor access without login popups or email verification!
    const users = getUsers();
    const supervisor = users.find((u) => u.role === 'supervisor') || users[1] || users[0];
    if (supervisor) {
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(supervisor));
      return supervisor;
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
