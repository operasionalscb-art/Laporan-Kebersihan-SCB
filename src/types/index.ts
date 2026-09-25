export type UserRole = 'superadmin' | 'supervisor' | 'petugas';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  password?: string;
  pin: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  avatarColor?: string;
}

export type AreaKamarMandi =
  | 'KM MASJID PUTRA'
  | 'KM KANTOR UTAMA'
  | 'KM KELAS PUTRA'
  | 'T WUDHU KLINIK'
  | 'KM KELAS PUTRI'
  | 'KM UKS'
  | 'Other';

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
}
