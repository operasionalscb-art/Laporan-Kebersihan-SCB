import { CleaningReport, User } from '../types';
import { createSamplePhotoUrl } from './imageCompressor';

const STORAGE_USERS_KEY = 'scb_cleaning_users_v2';
const STORAGE_REPORTS_KEY = 'scb_cleaning_reports_v2';
const STORAGE_CURRENT_USER_KEY = 'scb_current_user_v2';

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
    avatarColor: 'from-emerald-600 to-teal-700',
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
    avatarColor: 'from-blue-600 to-indigo-700',
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
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_USERS;
  } catch (e) {
    console.error('Failed to load users from localStorage', e);
    return INITIAL_USERS;
  }
}

export function saveUsers(users: User[]): void {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save users to localStorage', e);
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
export function getReports(): CleaningReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_REPORTS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(INITIAL_REPORTS));
      return INITIAL_REPORTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_REPORTS;
  } catch (e) {
    console.error('Failed to load reports from localStorage', e);
    return INITIAL_REPORTS;
  }
}

export function saveReports(reports: CleaningReport[]): void {
  try {
    localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(reports));
  } catch (e) {
    console.error('Failed to save reports to localStorage', e);
  }
}

export function addReport(report: Omit<CleaningReport, 'id' | 'timestamp'>): CleaningReport {
  const reports = getReports();
  const newReport: CleaningReport = {
    ...report,
    id: `rep-${Date.now()}`,
    timestamp: Date.now(),
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
      return JSON.parse(raw);
    }
    // Default to guest (null) so non-users/guests can only view dashboard
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
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(INITIAL_USERS));
  localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(INITIAL_REPORTS));
  localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
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
