export type UserRole = 'superadmin' | 'supervisor' | 'petugas';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  password?: string;
  pin?: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  avatarColor?: string;
  photoURL?: string;
}

export type AreaKamarMandi =
  | 'KM MASJID PUTRA'
  | 'KM KANTOR UTAMA'
  | 'KM KELAS PUTRA'
  | 'T WUDHU KLINIK'
  | 'KM KELAS PUTRI'
  | 'KM UKS'
  | string;

export type KondisiAkhir = 'Bersih' | 'Perlu Pengecekan Ulang' | 'Ada Kerusakan';

export interface CleaningReport {
  id: string;
  tanggal: string; // YYYY-MM-DD
  waktu: string;   // HH:mm
  timestamp: number;
  petugasId: string;
  namaPetugas: string;
  area: string;
  isAreaOther: boolean;
  areaCustom?: string;
  checklist: string[];
  checklistCustom?: string;
  kondisiAkhir: KondisiAkhir;
  keteranganTambahan: string;
  fotoBukti: string[]; // Base64 data URLs
  statusVerifikasi: 'Menunggu' | 'Disetujui' | 'Perlu Perbaikan';
  catatanSupervisor?: string;
  diverifikasiOleh?: string;
  diverifikasiPada?: string;
}

export interface AreaStatusSummary {
  areaName: string;
  lastCleaned?: string;
  lastPetugas?: string;
  lastKondisi?: KondisiAkhir;
  isCleanedToday: boolean;
  totalHariIni: number;
  scheduledOfficer?: string;
}

// ========================
// PENGELOLAAN FORM & JADWAL
// ========================

export interface MasterRoom {
  id: string;
  name: string;             // e.g. 'KM MASJID PUTRA'
  code?: string;            // e.g. 'KM-01'
  zone?: string;            // 'Zona Masjid', 'Zona Kantor', 'Zona Belajar', 'Zona Kesehatan'
  isMandatoryDaily: boolean;// Wajib dilaporkan harian (Senin - Sabtu)
  isActive: boolean;
  orderIndex: number;
  description?: string;
  createdAt?: string;
}

export interface MasterChecklist {
  id: string;
  label: string;            // e.g. 'Kloset Bersih', 'Kran Ada'
  category: 'Fasilitas' | 'Kebersihan' | 'Kelengkapan' | 'Lainnya';
  isRequired: boolean;      // Wajib dicentang saat pelaporan normal
  isActive: boolean;
  orderIndex: number;
  description?: string;
}

export interface FormSettings {
  requirePhoto: boolean;     // Wajib melampirkan foto
  minPhotos: number;         // Minimal foto (default 1)
  allowOtherRoom: boolean;   // Boleh pilih area kustom 'Other'
  allowCustomChecklist: boolean;
  guidelinesText: string;    // Petunjuk SOP pengisian form
  operatingHours: string;    // e.g. '06:00 - 17:00'
  updatedAt?: string;
}

export interface RoomSchedule {
  id: string;
  roomId?: string;
  roomName: string;          // Matches MasterRoom name
  officerId: string;         // User ID of assigned officer
  officerName: string;       // User name of assigned officer (e.g. 'IDAY M YUSUF')
  daysOfWeek: number[];      // [1, 2, 3, 4, 5, 6] (1=Senin ... 6=Sabtu)
  shift?: 'Pagi' | 'Siang' | 'Harian';
  notes?: string;
  isActive: boolean;
  updatedAt?: string;
}
