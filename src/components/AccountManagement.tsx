import React, { useState, useMemo, useEffect } from 'react';
import { User, UserRole, AccountActivity } from '../types';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Key, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  Phone, 
  Mail, 
  RefreshCw, 
  Search,
  X,
  Lock,
  Sparkles,
  ClipboardList,
  Check,
  AlertCircle,
  FileText,
  Camera,
  Database,
  Printer,
  Sliders,
  Layers,
  Info,
  ChevronRight,
  Eye,
  EyeOff,
  Cloud,
  Download,
  Upload,
  Loader2,
  KeyRound,
  Copy,
  Smartphone,
  Monitor,
  Tablet,
  Activity,
  Clock,
  History,
} from 'lucide-react';
import { generateStrongTempPassword } from '../services/firebaseAuth';
import {
  fetchAccountActivitiesFromCloud,
  getCachedAccountActivities,
} from '../services/firestoreSync';
import { getTodayDateString } from '../utils/storage';

export interface RolePermissionFeature {
  id: string;
  category: 'Pelaporan & Input' | 'Monitoring & Verifikasi' | 'Pengelolaan Akun' | 'Sistem & Google Drive';
  name: string;
  description: string;
  user: {
    allowed: boolean | 'partial';
    label: string;
    note?: string;
  };
  supervisor: {
    allowed: boolean | 'partial';
    label: string;
    note?: string;
  };
  admin: {
    allowed: boolean | 'partial';
    label: string;
    note?: string;
  };
}

export const ROLE_PERMISSIONS_DATA: RolePermissionFeature[] = [
  // Kategori 1: Pelaporan & Input
  {
    id: 'input_report',
    category: 'Pelaporan & Input',
    name: 'Input Laporan Kebersihan Harian',
    description: 'Mengisi formulir checklist kebersihan kamar mandi per area, waktu, dan tanggal secara mandiri.',
    user: { allowed: true, label: 'Diizinkan', note: 'Tugas harian utama petugas kebersihan' },
    supervisor: { allowed: true, label: 'Diizinkan', note: 'Dapat mengisi laporan pengganti jika diperlukan' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Akses bebas untuk semua area' },
  },
  {
    id: 'upload_photo',
    category: 'Pelaporan & Input',
    name: 'Unggah Foto Bukti Dokumentasi',
    description: 'Mengambil foto dari kamera ponsel atau unggah file foto kondisi sebelum & sesudah dibersihkan (maks. 5 foto).',
    user: { allowed: true, label: 'Diizinkan', note: 'Wajib sebagai bukti riil pekerjaan di lapangan' },
    supervisor: { allowed: true, label: 'Diizinkan', note: 'Maksimal 5 foto per laporan' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Akses penuh unggah foto bukti' },
  },
  {
    id: 'checklist_sanitasi',
    category: 'Pelaporan & Input',
    name: 'Checklist 6 Titik Standar Sanitasi',
    description: 'Ceklis titik pantau: Kloset/Urinoir, Lantai/Dinding, Wastafel, Cermin, Tempat Sampah, & Aroma Ruangan.',
    user: { allowed: true, label: 'Diizinkan', note: 'Wajib dicentang sesuai kondisi lapangan' },
    supervisor: { allowed: true, label: 'Diizinkan', note: 'Dapat menyesuaikan titik pantau' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Akses penuh' },
  },
  {
    id: 'catat_kendala',
    category: 'Pelaporan & Input',
    name: 'Catat Kerusakan Sarana & Area Custom',
    description: 'Menulis keterangan jika ada kran bocor, lampu mati, atau memilih area kamar mandi tambahan selain bawaan.',
    user: { allowed: true, label: 'Diizinkan', note: 'Membantu pelaporan sarpras lebih cepat' },
    supervisor: { allowed: true, label: 'Diizinkan', note: 'Dapat mencatat temuan kerusakan' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Akses penuh' },
  },
  {
    id: 'edit_own_report',
    category: 'Pelaporan & Input',
    name: 'Edit / Revisi Laporan Sendiri',
    description: 'Memperbaiki laporan yang sudah dikirim jika statusnya dikembalikan atau ditolak supervisor.',
    user: { allowed: 'partial', label: 'Khusus Revisi', note: 'Hanya jika status "Perlu Perbaikan"' },
    supervisor: { allowed: true, label: 'Bebas Edit', note: 'Dapat mengoreksi laporan kapan saja' },
    admin: { allowed: true, label: 'Bebas Edit', note: 'Akses penuh ke semua laporan' },
  },
  {
    id: 'delete_report',
    category: 'Pelaporan & Input',
    name: 'Hapus Data Laporan Kebersihan',
    description: 'Menghapus arsip laporan dari database lokal dan penyimpanan cloud.',
    user: { allowed: false, label: 'Tidak Diizinkan', note: 'Mencegah penghapusan riwayat kerja' },
    supervisor: { allowed: false, label: 'Tidak Diizinkan', note: 'Hanya Super Admin yang berwenang' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Dapat menghapus data yang keliru' },
  },

  // Kategori 2: Monitoring & Verifikasi
  {
    id: 'view_dashboard',
    category: 'Monitoring & Verifikasi',
    name: 'Lihat Dashboard Status Real-Time',
    description: 'Melihat kartu ringkasan area yang sudah dibersihkan hari ini, kondisi bersih, dan antrean verifikasi.',
    user: { allowed: true, label: 'Diizinkan', note: 'Melihat progres kebersihan harian' },
    supervisor: { allowed: true, label: 'Diizinkan', note: 'Monitoring menyeluruh seluruh area' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Akses visual & metrik lengkap' },
  },
  {
    id: 'verify_report',
    category: 'Monitoring & Verifikasi',
    name: 'Persetujuan & Verifikasi Laporan',
    description: 'Menyetujui (Disetujui) atau meminta perbaikan ulang laporan petugas (Perlu Perbaikan). Wewenang resmi level supervisor.',
    user: { allowed: false, label: 'Tidak Diizinkan', note: 'Petugas tidak dapat menyetujui laporan sendiri' },
    supervisor: { allowed: true, label: 'Tugas Utama', note: 'Wewenang resmi persetujuan mutu' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Dapat memverifikasi jika supervisor berhalangan' },
  },
  {
    id: 'supervisor_notes',
    category: 'Monitoring & Verifikasi',
    name: 'Memberikan Catatan & Evaluasi Supervisi',
    description: 'Menulis arahan korektif atau apresiasi kualitas kebersihan yang langsung dibaca oleh petugas.',
    user: { allowed: false, label: 'Hanya Membaca', note: 'Petugas menerima instruksi korektif' },
    supervisor: { allowed: true, label: 'Diizinkan', note: 'Umpan balik tertulis untuk petugas' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Akses penuh catatan' },
  },
  {
    id: 'print_recap',
    category: 'Monitoring & Verifikasi',
    name: 'Cetak Berita Acara & Lembar Rekap',
    description: 'Mencetak format resmi Sekolah Cendekia BAZNAS (PDF / Kertas) untuk arsip fisik dan rapat koordinasi.',
    user: { allowed: 'partial', label: 'Rekap Harian', note: 'Hanya rekap harian sederhana' },
    supervisor: { allowed: true, label: 'Lengkap', note: 'Berita acara resmi + tanda tangan' },
    admin: { allowed: true, label: 'Lengkap', note: 'Format cetak lengkap seluruh periode' },
  },
  {
    id: 'filter_analytics',
    category: 'Monitoring & Verifikasi',
    name: 'Filter Periode, Petugas & Analisis Area',
    description: 'Menyaring laporan berdasarkan rentang tanggal, nama petugas tertentu, status verifikasi, dan kondisi akhir.',
    user: { allowed: 'partial', label: 'Filter Dasar', note: 'Hanya melihat riwayat harian' },
    supervisor: { allowed: true, label: 'Analisis Penuh', note: 'Filter lengkap untuk evaluasi berkala' },
    admin: { allowed: true, label: 'Analisis Penuh', note: 'Filter lengkap seluruh histori data' },
  },

  // Kategori 3: Pengelolaan Akun
  {
    id: 'login_pin',
    category: 'Pengelolaan Akun',
    name: 'Login Manual dengan Username / Email & Sandi / PIN',
    description: 'Masuk secara langsung menggunakan Username atau Email beserta Kata Sandi atau PIN yang dikelola Superadmin tanpa pop-up Google.',
    user: { allowed: true, label: 'Diizinkan', note: 'Username/Email + Sandi/PIN' },
    supervisor: { allowed: true, label: 'Diizinkan', note: 'Username/Email + Sandi/PIN' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Akses penuh akun operasional' },
  },
  {
    id: 'access_account_menu',
    category: 'Pengelolaan Akun',
    name: 'Akses Menu Pengelolaan Akun',
    description: 'Membuka tab navigasi "Pengelolaan Akun" untuk melihat daftar personil dan data kredensial.',
    user: { allowed: false, label: 'Terkunci', note: 'Menu tersembunyi untuk petugas' },
    supervisor: { allowed: false, label: 'Terkunci', note: 'Menu tersembunyi untuk supervisor' },
    admin: { allowed: true, label: 'Super Admin', note: 'Eksklusif pengelola akun resmi SCB' },
  },
  {
    id: 'add_user',
    category: 'Pengelolaan Akun',
    name: 'Tambah Akun Petugas & Supervisor Baru',
    description: 'Mendaftarkan petugas kebersihan baru, menentukan username login, peran, dan nomor WhatsApp.',
    user: { allowed: false, label: 'Tidak Diizinkan', note: 'Hanya Super Admin yang berwenang' },
    supervisor: { allowed: false, label: 'Tidak Diizinkan', note: 'Hanya Super Admin yang berwenang' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Kelola seluruh daftar personil' },
  },
  {
    id: 'edit_reset_pin',
    category: 'Pengelolaan Akun',
    name: 'Edit Data Pengguna & Pengaturan Akun',
    description: 'Mengubah nama personil, mengganti peran (role), memperbarui kontak dan sandi pengelola.',
    user: { allowed: 'partial', label: 'Profil Sendiri', note: 'Hanya melihat profil akunnya sendiri' },
    supervisor: { allowed: 'partial', label: 'Profil Sendiri', note: 'Hanya melihat profil akunnya sendiri' },
    admin: { allowed: true, label: 'Bebas Edit', note: 'Dapat mengelola semua akun' },
  },
  {
    id: 'toggle_user_status',
    category: 'Pengelolaan Akun',
    name: 'Aktifkan / Non-aktifkan Status Akun',
    description: 'Menonaktifkan sementara akun petugas yang sedang cuti atau mutasi tanpa menghapus riwayat laporannya.',
    user: { allowed: false, label: 'Tidak Diizinkan', note: 'Tidak dapat mengubah status akun' },
    supervisor: { allowed: false, label: 'Tidak Diizinkan', note: 'Tidak dapat mengubah status akun' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Kontrol status aktifasi akun' },
  },
  {
    id: 'delete_user',
    category: 'Pengelolaan Akun',
    name: 'Hapus Akun Pengguna',
    description: 'Menghapus permanen akun petugas yang sudah tidak bertugas di Sekolah Cendekia BAZNAS.',
    user: { allowed: false, label: 'Tidak Diizinkan', note: 'Tidak memiliki hak hapus akun' },
    supervisor: { allowed: false, label: 'Tidak Diizinkan', note: 'Tidak memiliki hak hapus akun' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Akun Superadmin utama terlindungi dari hapus' },
  },

  // Kategori 4: Sistem & Google Drive
  {
    id: 'auto_drive_sync',
    category: 'Sistem & Google Drive',
    name: 'Sinkronisasi Otomatis Foto & Berkas ke Drive',
    description: 'Otomatis mengunggah foto bukti dan berkas cadangan JSON ke folder resmi Google Drive SCB.',
    user: { allowed: 'partial', label: 'Otomatis', note: 'Berjalan otomatis di background saat submit' },
    supervisor: { allowed: 'partial', label: 'Otomatis', note: 'Berjalan otomatis saat verifikasi' },
    admin: { allowed: true, label: 'Kontrol Penuh', note: 'Dapat mengatur on/off dan pemicu manual' },
  },
  {
    id: 'manage_drive_auth',
    category: 'Sistem & Google Drive',
    name: 'Otorisasi Google Drive (operasional.scb@gmail.com)',
    description: 'Menghubungkan akun Google Drive resmi dan memberikan izin akses folder 1EW55LPCuje5G3OOB4oiMpd5JGnTf3H5Z.',
    user: { allowed: false, label: 'Tidak Diizinkan', note: 'Menu cadangan data terkunci' },
    supervisor: { allowed: false, label: 'Tidak Diizinkan', note: 'Menu cadangan data terkunci' },
    admin: { allowed: true, label: 'Diizinkan', note: '1x otorisasi di menu Penyimpanan Data' },
  },
  {
    id: 'backup_restore_json',
    category: 'Sistem & Google Drive',
    name: 'Cadangkan & Pulihkan Database (JSON/CSV)',
    description: 'Mengunduh berkas cadangan manual database dan memulihkan (restore) data dari file JSON cadangan.',
    user: { allowed: false, label: 'Tidak Diizinkan', note: 'Tidak memiliki hak kelola database' },
    supervisor: { allowed: 'partial', label: 'Hanya Unduh CSV', note: 'Dapat mengunduh rekap CSV' },
    admin: { allowed: true, label: 'Diizinkan Penuh', note: 'Ekspor JSON, CSV, dan Pulihkan Database' },
  },
  {
    id: 'reset_database',
    category: 'Sistem & Google Drive',
    name: 'Reset / Hapus Database Sistem',
    description: 'Membersihkan seluruh data laporan dari database sistem dengan proteksi kata sandi superadmin.',
    user: { allowed: false, label: 'Tidak Diizinkan', note: 'Dilindungi ketat' },
    supervisor: { allowed: false, label: 'Tidak Diizinkan', note: 'Dilindungi ketat' },
    admin: { allowed: true, label: 'Super Admin', note: 'Memerlukan konfirmasi ganda' },
  },
];

export interface UserRegistrationResult {
  success: boolean;
  user?: User;
  authStatus: 'created' | 'already_exists' | 'error';
  emailSent?: boolean;
  cloudSynced: boolean;
  message: string;
}

interface AccountManagementProps {
  users: User[];
  currentUser: User | null;
  onAddUser: (
    user: Omit<User, 'id' | 'createdAt'>,
    initialPassword: string
  ) => Promise<UserRegistrationResult>;
  onUpdateUser: (id: string, updates: Partial<User>) => void;
  onDeleteUser: (id: string) => void;
  onSwitchUser?: (user: User) => void;
  onResetData?: () => void;
  isCloudSynced?: boolean;
  cloudUserEmail?: string | null;
  onConnectCloudSync?: () => Promise<void>;
  onDisconnectCloudSync?: () => Promise<void>;
  onSyncUsersNow?: () => Promise<void>;
  onImportUsers?: (users: User[]) => void;
  onSendPasswordReset?: (email: string) => Promise<void>;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const AccountManagement: React.FC<AccountManagementProps> = ({
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  isCloudSynced = false,
  cloudUserEmail = null,
  onConnectCloudSync,
  onDisconnectCloudSync,
  onSyncUsersNow,
  onImportUsers,
  onSendPasswordReset,
  onShowToast,
}) => {
  const [searchUser, setSearchUser] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const importUsersInputRef = React.useRef<HTMLInputElement>(null);

  // Sub Tab Navigation: 'users' | 'activity' | 'checklist'
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'activity' | 'checklist'>('users');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchFeature, setSearchFeature] = useState<string>('');

  // Account & Device Activity State (On-demand, 5-min cached, zero real-time listeners)
  const initialCachedActivities = useMemo(() => getCachedAccountActivities(), []);
  const [activities, setActivities] = useState<AccountActivity[]>(initialCachedActivities.activities);
  const [activityFetchedAtMs, setActivityFetchedAtMs] = useState<number>(initialCachedActivities.fetchedAtMs);
  const [activityFromCache, setActivityFromCache] = useState<boolean>(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState<boolean>(false);
  const [activityQuotaError, setActivityQuotaError] = useState<boolean>(false);
  const [activitySearch, setActivitySearch] = useState<string>('');
  const [activityDeviceFilter, setActivityDeviceFilter] = useState<'ALL' | 'Mobile' | 'Desktop' | 'Tablet'>('ALL');
  const [expandedActivityUid, setExpandedActivityUid] = useState<string | null>(null);

  const loadAccountActivities = async (forceRefresh = false) => {
    setIsLoadingActivity(true);
    try {
      const res = await fetchAccountActivitiesFromCloud(forceRefresh);
      setActivities(res.activities);
      setActivityFetchedAtMs(res.fetchedAtMs);
      setActivityFromCache(res.fromCache);
      setActivityQuotaError(Boolean(res.quotaExceeded));
      if (forceRefresh) {
        if (res.quotaExceeded) {
          onShowToast?.('Kuota Firestore sedang penuh. Menampilkan data aktivitas tersimpan lokal.', 'info');
        } else {
          onShowToast?.(`Data aktivitas ${res.activities.length} akun berhasil diperbarui.`, 'success');
        }
      }
    } finally {
      setIsLoadingActivity(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'activity') {
      loadAccountActivities(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab]);

  const todayDateStr = useMemo(() => getTodayDateString(), []);

  const activityByEmail = useMemo(() => {
    const map = new Map<string, AccountActivity>();
    for (const act of activities) {
      if (act.email) {
        map.set(act.email.trim().toLowerCase(), act);
      }
    }
    return map;
  }, [activities]);

  const filteredActivities = useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    return activities.filter((act) => {
      if (activityDeviceFilter !== 'ALL' && act.deviceType !== activityDeviceFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (act.name || '').toLowerCase().includes(q) ||
        (act.email || '').toLowerCase().includes(q) ||
        (act.deviceLabel || '').toLowerCase().includes(q) ||
        (act.os || '').toLowerCase().includes(q) ||
        (act.browser || '').toLowerCase().includes(q)
      );
    });
  }, [activities, activitySearch, activityDeviceFilter]);

  const activityStats = useMemo(() => {
    const activeToday = activities.filter((a) => a.lastActiveDate === todayDateStr).length;
    const mobileOrTablet = activities.filter((a) => a.deviceType === 'Mobile' || a.deviceType === 'Tablet').length;
    const desktop = activities.filter((a) => a.deviceType === 'Desktop').length;
    return {
      total: activities.length,
      activeToday,
      mobileOrTablet,
      desktop,
    };
  }, [activities, todayDateStr]);

  const formatActivityTime = (ms: number): string => {
    if (!ms) return '-';
    try {
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(ms));
    } catch {
      return new Date(ms).toLocaleString();
    }
  };

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [usernameEditedManually, setUsernameEditedManually] = useState<boolean>(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState<boolean>(false);
  const [copiedCredentials, setCopiedCredentials] = useState<boolean>(false);
  const [registeredReceipt, setRegisteredReceipt] = useState<{
    name: string;
    email: string;
    username: string;
    role: UserRole;
    password: string;
    authStatus: 'created' | 'already_exists' | 'error';
    emailSent?: boolean;
    cloudSynced: boolean;
    message: string;
  } | null>(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    pin: '',
    role: 'petugas' as UserRole,
    phone: '',
    isActive: true,
  });

  const deriveUsernameFromEmailOrName = (emailVal: string, nameVal: string): string => {
    const emailPrefix = emailVal.trim().toLowerCase().split('@')[0] || '';
    const cleaned = (emailPrefix || nameVal.trim().toLowerCase())
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 32);
    return cleaned;
  };

  const handleOpenAddModal = () => {
    setFormError('');
    setShowPassword(false);
    setConfirmPassword('');
    setUsernameEditedManually(false);
    setIsSubmittingUser(false);
    setRegisteredReceipt(null);
    setCopiedCredentials(false);
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      username: '',
      password: '',
      pin: '',
      role: 'petugas',
      phone: '',
      isActive: true,
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setFormError('');
    setShowPassword(false);
    setConfirmPassword('');
    setUsernameEditedManually(true);
    setIsSubmittingUser(false);
    setRegisteredReceipt(null);
    setIsAddModalOpen(false);
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      username: user.username,
      password: '',
      pin: user.pin || '',
      role: user.role,
      phone: user.phone || '',
      isActive: user.isActive,
    });
  };

  const handleGeneratePassword = () => {
    const generated = generateStrongTempPassword(10);
    setFormData((prev) => ({ ...prev, password: generated }));
    setConfirmPassword(generated);
    setShowPassword(true);
    setFormError('');
  };

  const handleCopyRegisteredCredentials = async () => {
    if (!registeredReceipt) return;
    const roleLabel =
      registeredReceipt.role === 'superadmin'
        ? 'Super Admin'
        : registeredReceipt.role === 'supervisor'
        ? 'Supervisor'
        : 'Petugas Kebersihan';
    const loginUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const text = [
      `*Akun SIM-BERSIH SCB (${roleLabel})*`,
      `Nama: ${registeredReceipt.name}`,
      `Email Login: ${registeredReceipt.email}`,
      `Kata Sandi: ${registeredReceipt.password}`,
      loginUrl ? `Link Aplikasi: ${loginUrl}` : '',
      '',
      'Catatan: Silakan buka inbox/spam email Anda untuk klik link verifikasi 1x, lalu masuk menggunakan Email & Kata Sandi di atas.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedCredentials(true);
      onShowToast?.('Kredensial akun berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopiedCredentials(false), 3000);
    } catch {
      onShowToast?.('Gagal menyalin otomatis. Silakan salin manual dari kartu konfirmasi.', 'error');
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanUsername =
      formData.username.trim().toLowerCase() || deriveUsernameFromEmailOrName(cleanEmail, cleanName);
    const rawPassword = formData.password.trim();

    if (!cleanName) {
      setFormError('Nama Lengkap wajib diisi.');
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormError(
        'Alamat Email aktif wajib diisi dengan format valid (contoh: nama@gmail.com) agar bisa menerima verifikasi & sinkron antar perangkat.'
      );
      return;
    }

    if (!cleanUsername) {
      setFormError('Username login wajib diisi.');
      return;
    }

    if (!editingUser) {
      if (rawPassword.length < 6) {
        setFormError('Kata sandi pendaftaran wajib diisi minimal 6 karakter.');
        return;
      }
      if (rawPassword !== confirmPassword.trim()) {
        setFormError('Konfirmasi kata sandi tidak cocok. Periksa kembali kedua kolom kata sandi.');
        return;
      }
    }

    const duplicateUsername = users.some(
      (u) => u.id !== editingUser?.id && u.username.trim().toLowerCase() === cleanUsername
    );
    if (duplicateUsername) {
      setFormError(`Username "@${cleanUsername}" sudah digunakan oleh akun lain.`);
      return;
    }

    const duplicateEmail = users.some(
      (u) => u.id !== editingUser?.id && u.email && u.email.trim().toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      setFormError(`Email "${cleanEmail}" sudah terdaftar pada akun lain.`);
      return;
    }

    setFormError('');

    if (editingUser) {
      onUpdateUser(editingUser.id, {
        name: cleanName.toUpperCase(),
        email: cleanEmail,
        username: cleanUsername,
        pin: formData.pin.trim() || undefined,
        role: formData.role,
        phone: formData.phone.trim(),
        isActive: formData.isActive,
      });
      setEditingUser(null);
      return;
    }

    setIsSubmittingUser(true);
    try {
      const result = await onAddUser(
        {
          name: cleanName.toUpperCase(),
          email: cleanEmail,
          username: cleanUsername,
          pin: formData.pin.trim() || undefined,
          role: formData.role,
          phone: formData.phone.trim(),
          isActive: formData.isActive,
          avatarColor:
            formData.role === 'superadmin'
              ? 'from-amber-600 to-yellow-700'
              : formData.role === 'supervisor'
              ? 'from-blue-600 to-indigo-700'
              : 'from-emerald-600 to-teal-700',
        },
        rawPassword
      );

      if (!result.success) {
        setFormError(result.message);
        return;
      }

      setRegisteredReceipt({
        name: cleanName.toUpperCase(),
        email: cleanEmail,
        username: cleanUsername,
        role: formData.role,
        password: rawPassword,
        authStatus: result.authStatus,
        emailSent: result.emailSent,
        cloudSynced: result.cloudSynced,
        message: result.message,
      });
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchUser.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  // Filtered Features Checklist Data
  const categoriesList = useMemo(() => {
    return ['all', 'Pelaporan & Input', 'Monitoring & Verifikasi', 'Pengelolaan Akun', 'Sistem & Google Drive'];
  }, []);

  const filteredFeatures = useMemo(() => {
    return ROLE_PERMISSIONS_DATA.filter((feat) => {
      const matchCategory = selectedCategory === 'all' || feat.category === selectedCategory;
      const matchSearch =
        searchFeature === '' ||
        feat.name.toLowerCase().includes(searchFeature.toLowerCase()) ||
        feat.description.toLowerCase().includes(searchFeature.toLowerCase()) ||
        feat.category.toLowerCase().includes(searchFeature.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchFeature]);

  const handleExportUsersJson = () => {
    try {
      const sanitizedUsers = users.map(({ password: _omittedPassword, ...safeUser }) => safeUser);
      const payload = {
        appName: 'SIM-BERSIH SCB',
        type: 'users_directory',
        exportDate: new Date().toISOString(),
        users: sanitizedUsers,
      };
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Akun_Petugas_SCB_${dateStr}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onShowToast?.(`Daftar akun diekspor ke ${filename}`, 'success');
    } catch {
      onShowToast?.('Gagal mengekspor daftar akun.', 'error');
    }
  };

  const handleImportUsersFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || ''));
        const candidateUsers: User[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.users)
          ? parsed.users
          : [];
        const validUsers = candidateUsers.filter(
          (u) => u && typeof u.id === 'string' && typeof u.username === 'string' && typeof u.name === 'string'
        );
        if (validUsers.length === 0) {
          onShowToast?.('Berkas JSON tidak memuat daftar akun petugas yang valid.', 'error');
          return;
        }
        onImportUsers?.(validUsers);
      } catch {
        onShowToast?.('Format berkas JSON akun tidak valid.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <input
        ref={importUsersInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportUsersFile}
        className="hidden"
      />
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Superadmin Area
            </span>
            <span className="text-xs text-slate-500">
              Pengelola Utama: <strong className="text-slate-700">operasional.scb@gmail.com</strong>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Pengelolaan Akun & Hak Akses Peran
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Kelola akun petugas kebersihan Sekolah Cendekia BAZNAS (SCB), pantau matriks fitur, dan atur hak akses peran.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Daftarkan Akun Baru</span>
          </button>
        </div>
      </div>

      {/* SUB-TABS: USERS LIST VS ACCOUNT ACTIVITY VS ROLES CHECKLIST MATRIX */}
      <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-1">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'users'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-600" />
          <span>Daftar Akun Pengguna</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeSubTab === 'users' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('activity')}
          className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'activity'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Activity className="w-4 h-4 text-indigo-600" />
          <span>Aktivitas Akun &amp; Perangkat</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeSubTab === 'activity' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {activities.length > 0 ? activities.length : 'Hemat Kuota'}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('checklist')}
          className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'checklist'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-blue-600" />
          <span>Ceklist Fitur &amp; Hak Akses Peran</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeSubTab === 'checklist' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
          }`}>
            User • Supervisor • Admin
          </span>
        </button>
      </div>

      {/* TAB CONTENT 1: DAFTAR AKUN PENGGUNA */}
      {activeSubTab === 'users' && (
        <div className="space-y-6">
          {/* Cross-Device Cloud Sync Status & Manual Account Callout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
              <Key className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-bold text-emerald-950">
                  Pendaftaran Akun Email &amp; Kata Sandi Dikelola Superadmin
                </p>
                <p className="text-emerald-800 leading-relaxed">
                  Pendaftaran akun baru hanya dapat dilakukan oleh <strong>Superadmin</strong> melalui tombol <strong>Daftarkan Akun Baru</strong> (tidak ada pendaftaran mandiri publik). Kata sandi dikelola langsung oleh Firebase Authentication tanpa disimpan sebagai teks biasa di database.
                </p>
                <p className="text-[11px] text-emerald-700 font-medium">
                  Alur: 1. Superadmin daftarkan Email &amp; Sandi → 2. Sistem kirim link verifikasi 1x ke email personel → 3. Personel klik verifikasi &amp; login.
                </p>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border text-xs flex flex-col justify-between gap-3 ${
                isCloudSynced
                  ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                  : 'bg-amber-50/80 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Cloud
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    isCloudSynced ? 'text-blue-600' : 'text-amber-600'
                  }`}
                />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">
                      {isCloudSynced
                        ? 'Sinkronisasi Cloud Firestore Aktif Otomatis'
                        : 'Sesi Cloud Belum Terhubung (Mode Lokal)'}
                    </span>
                    {isCloudSynced && cloudUserEmail && (
                      <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-800">
                        {cloudUserEmail}
                      </span>
                    )}
                  </div>
                  <p className={isCloudSynced ? 'text-blue-800 leading-relaxed' : 'text-amber-900 leading-relaxed'}>
                    {isCloudSynced
                      ? 'Perubahan daftar petugas, jadwal, dan laporan langsung tersinkron real-time ke semua perangkat. Klik Sinkronkan Sekarang untuk memastikan seluruh data lokal sudah terkirim.'
                      : 'Keluar lalu Masuk ulang menggunakan Email & Kata Sandi terverifikasi untuk mengaktifkan Cloud Sync otomatis, atau gunakan tombol Hubungkan Cloud Sync di bawah.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isCloudSynced && onConnectCloudSync ? (
                  <button
                    type="button"
                    disabled={isSyncingCloud}
                    onClick={async () => {
                      setIsSyncingCloud(true);
                      try {
                        await onConnectCloudSync();
                      } finally {
                        setIsSyncingCloud(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isSyncingCloud ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Cloud className="w-3.5 h-3.5" />
                    )}
                    <span>{isSyncingCloud ? 'Menghubungkan...' : 'Hubungkan Cloud Sync Admin'}</span>
                  </button>
                ) : (
                  <>
                    {onSyncUsersNow && (
                      <button
                        type="button"
                        disabled={isSyncingCloud}
                        onClick={async () => {
                          setIsSyncingCloud(true);
                          try {
                            await onSyncUsersNow();
                          } finally {
                            setIsSyncingCloud(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                        <span>Sinkronkan Semua Akun ke Cloud</span>
                      </button>
                    )}
                    {onDisconnectCloudSync && (
                      <button
                        type="button"
                        onClick={() => onDisconnectCloudSync()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-[11px] border border-slate-200 cursor-pointer"
                      >
                        <span>Putus Cloud</span>
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={handleExportUsersJson}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-[11px] border border-slate-300 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ekspor Akun (.JSON)</span>
                </button>

                {onImportUsers && (
                  <button
                    type="button"
                    onClick={() => importUsersInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-[11px] border border-slate-300 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>Impor Akun (.JSON)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Search and Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Search header */}
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari petugas berdasarkan nama, username, atau email..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Total {filteredUsers.length} Akun Terdaftar
              </span>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">Username / Email</th>
                    <th className="py-3 px-4">Peran (Role)</th>
                    <th className="py-3 px-4">Otentikasi</th>
                    <th className="py-3 px-4">Kontak / No WA</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredUsers.map((user) => {
                    const isCurrent = currentUser?.id === user.id;
                    const isSuper = user.role === 'superadmin' || user.email === 'operasional.scb@gmail.com';

                    return (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${
                                user.avatarColor || 'from-emerald-600 to-teal-700'
                              } flex items-center justify-center text-white font-bold text-xs shrink-0`}
                            >
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{user.name}</span>
                                {isCurrent && (
                                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                Terdaftar: {user.createdAt || '-'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-mono text-xs font-semibold text-slate-800">
                            @{user.username}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isSuper
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : user.role === 'supervisor'
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            {isSuper ? 'Super Admin' : user.role === 'supervisor' ? 'Supervisor' : 'Petugas Kebersihan'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                            <Key className="w-3 h-3 text-emerald-600" />
                            Email &amp; Sandi Cloud
                          </span>
                          {(() => {
                            const act = activityByEmail.get((user.email || '').trim().toLowerCase());
                            if (!act) return null;
                            return (
                              <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
                                {act.deviceType === 'Mobile' ? (
                                  <Smartphone className="w-3 h-3 text-indigo-500" />
                                ) : act.deviceType === 'Tablet' ? (
                                  <Tablet className="w-3 h-3 text-indigo-500" />
                                ) : (
                                  <Monitor className="w-3 h-3 text-slate-500" />
                                )}
                                <span>{act.deviceLabel}</span>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                          {user.phone ? (
                            <span className="flex items-center gap-1 text-slate-700">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {user.phone}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                              user.isActive ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {user.isActive ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Aktif
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                Non-aktif
                              </>
                            )}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {onSendPasswordReset && user.email && (
                              <button
                                onClick={() => onSendPasswordReset(user.email)}
                                className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 rounded-lg transition-colors cursor-pointer"
                                title={`Kirim Link Reset / Atur Kata Sandi ke ${user.email}`}
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Edit User */}
                            <button
                              onClick={() => handleOpenEditModal(user)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Edit Akun"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete User (Prevent deleting primary superadmin) */}
                            {!isSuper && (
                              <button
                                onClick={() => {
                                  onDeleteUser(user.id);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Akun"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: AKTIVITAS AKUN & PERANGKAT */}
      {activeSubTab === 'activity' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Quota Optimization Notice */}
          <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 text-xs">
              <Activity className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-indigo-950">
                  Pemantauan Aktivitas Akun &amp; Perangkat (Mode Hemat Kuota Firestore)
                </p>
                <p className="text-indigo-800 leading-relaxed">
                  Sistem hanya mencatat data saat petugas/pengguna melakukan <strong>login atau berganti hari/perangkat</strong> (reload halaman biasa tidak memakan kuota tulis). Daftar ini dimuat sesuai permintaan dengan <strong>cache 5 menit</strong> tanpa listener live.
                </p>
                <p className="text-[11px] text-indigo-700 font-medium">
                  {activityFetchedAtMs > 0
                    ? `Terakhir dimuat: ${formatActivityTime(activityFetchedAtMs)} (${activityFromCache ? 'dari cache lokal 0 Read' : 'sinkron langsung Cloud'})`
                    : 'Belum dimuat dari Cloud'}
                  {activityQuotaError ? ' • Kuota Firestore harian penuh, menampilkan salinan lokal.' : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isLoadingActivity}
              onClick={() => loadAccountActivities(true)}
              className="self-start sm:self-center inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-60 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingActivity ? 'animate-spin' : ''}`} />
              <span>{isLoadingActivity ? 'Memuat...' : 'Segarkan Aktivitas'}</span>
            </button>
          </div>

          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Akun Tercatat</span>
                <Users className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{activityStats.total}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Dari {users.length} total akun</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold mb-1">
                <span>Aktif Hari Ini</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-700">{activityStats.activeToday}</div>
              <p className="text-[11px] text-emerald-600/80 mt-0.5">Tanggal {todayDateStr}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-indigo-700 font-semibold mb-1">
                <span>Ponsel / Tablet</span>
                <Smartphone className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-indigo-700">{activityStats.mobileOrTablet}</div>
              <p className="text-[11px] text-indigo-600/80 mt-0.5">Perangkat mobile lapangan</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1">
                <span>Desktop / Laptop</span>
                <Monitor className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-2xl font-bold text-slate-800">{activityStats.desktop}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Komputer / browser PC</p>
            </div>
          </div>

          {/* Search, Device Filter & Activity Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama akun, email, OS, atau browser..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(['ALL', 'Mobile', 'Desktop', 'Tablet'] as const).map((dev) => (
                  <button
                    key={dev}
                    type="button"
                    onClick={() => setActivityDeviceFilter(dev)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activityDeviceFilter === dev
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {dev === 'ALL' ? 'Semua Perangkat' : dev}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingActivity && activities.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <span>Mengambil data aktivitas akun &amp; perangkat...</span>
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500 space-y-2">
                <Activity className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">
                  Belum ada catatan aktivitas yang sesuai filter.
                </p>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  Aktivitas otomatis tercatat saat setiap personel atau pengawas masuk (login) menggunakan akun masing-masing.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Akun Pengguna</th>
                      <th className="py-3 px-4">Peran</th>
                      <th className="py-3 px-4">Jenis Perangkat</th>
                      <th className="py-3 px-4">Sistem &amp; Browser</th>
                      <th className="py-3 px-4">Aktivitas Terakhir</th>
                      <th className="py-3 px-4 text-right">Riwayat Login</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredActivities.map((act) => {
                      const isToday = act.lastActiveDate === todayDateStr;
                      const isExpanded = expandedActivityUid === act.uid;
                      const isSuperRow = act.role === 'superadmin' || act.email === 'operasional.scb@gmail.com';
                      const loginHistory = Array.isArray(act.recentLogins) ? act.recentLogins : [];

                      return (
                        <React.Fragment key={act.uid}>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{act.name}</span>
                                {isToday && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                    Hari Ini
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">{act.email}</div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isSuperRow
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : act.role === 'supervisor'
                                    ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}
                              >
                                {isSuperRow ? 'Super Admin' : act.role === 'supervisor' ? 'Supervisor' : 'Petugas'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                  act.deviceType === 'Mobile'
                                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                    : act.deviceType === 'Tablet'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {act.deviceType === 'Mobile' ? (
                                  <Smartphone className="w-3.5 h-3.5" />
                                ) : act.deviceType === 'Tablet' ? (
                                  <Tablet className="w-3.5 h-3.5" />
                                ) : (
                                  <Monitor className="w-3.5 h-3.5" />
                                )}
                                <span>{act.deviceType}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-800">
                                {act.os} • {act.browser}
                              </div>
                              {act.screenInfo && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Layar: {act.screenInfo}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{formatActivityTime(act.lastActiveAtMs)}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {loginHistory.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedActivityUid(isExpanded ? null : act.uid)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 text-[11px] font-semibold transition-colors cursor-pointer"
                                >
                                  <History className="w-3.5 h-3.5" />
                                  <span>{isExpanded ? 'Tutup' : `${loginHistory.length} Riwayat`}</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">-</span>
                              )}
                            </td>
                          </tr>

                          {isExpanded && loginHistory.length > 0 && (
                            <tr className="bg-slate-50/70">
                              <td colSpan={6} className="px-4 py-3 border-t border-slate-100">
                                <div className="text-[11px] text-slate-600 space-y-1.5">
                                  <p className="font-bold text-slate-700 flex items-center gap-1.5">
                                    <History className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>5 Login Terakhir ({act.name})</span>
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {loginHistory.map((entry, idx) => (
                                      <span
                                        key={`${act.uid}-hist-${idx}`}
                                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium text-[11px]"
                                      >
                                        {entry}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: CEKLIST & MATRIKS HAK AKSES PERAN */}
      {activeSubTab === 'checklist' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Role Summary Cards (User / Supervisor / Admin) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CARD 1: USER / PETUGAS */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-3 relative overflow-hidden">
              <div className="w-2 h-full absolute left-0 top-0 bg-emerald-500" />
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 mb-1">
                    <UserCheck className="w-3 h-3" />
                    User (Petugas)
                  </span>
                  <h3 className="font-bold text-slate-900 text-base">Petugas Kebersihan</h3>
                </div>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  8+
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Fokus pada <strong>pelaksanaan di lapangan</strong>: mengisi laporan harian kamar mandi, mengunggah foto kondisi sebelum & sesudah, checklist sanitasi, dan perbaikan area jika ada temuan supervisi.
              </p>
              <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1.5 text-slate-600">
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <span>Login Mudah via Username/Email &amp; Sandi/PIN</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <span>Input Laporan & Foto Bukti Realtime</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <X className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>Tidak bisa verifikasi / hapus data</span>
                </div>
              </div>
            </div>

            {/* CARD 2: SUPERVISOR */}
            <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-xs space-y-3 relative overflow-hidden">
              <div className="w-2 h-full absolute left-0 top-0 bg-blue-500" />
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 mb-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Supervisor
                  </span>
                  <h3 className="font-bold text-slate-900 text-base">Pengawas Sarpras</h3>
                </div>
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  14+
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bertanggung jawab atas <strong>kontrol mutu & validasi</strong>: memverifikasi laporan petugas (Disetujui / Perlu Perbaikan), memberi catatan evaluasi, monitoring dashboard, dan mencetak berita acara.
              </p>
              <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1.5 text-slate-600">
                <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                  <span>Validasi & Verifikasi Hasil Kebersihan</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                  <span>Cetak Lembar Rekap & Berita Acara</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <X className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>Tidak bisa ubah akun & reset database</span>
                </div>
              </div>
            </div>

            {/* CARD 3: SUPER ADMIN */}
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-3 relative overflow-hidden">
              <div className="w-2 h-full absolute left-0 top-0 bg-amber-500" />
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Admin (Super Admin)
                  </span>
                  <h3 className="font-bold text-slate-900 text-base">Operasional SCB</h3>
                </div>
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                  Semua
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Memegang <strong>otoritas penuh (Full Access)</strong>: manajemen personil &amp; kredensial akun, jadwal penugasan ruangan, kontrol Google Drive BAZNAS, backup &amp; restore database, serta audit log sistem.
              </p>
              <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1.5 text-slate-600">
                <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Pengelolaan Personil, Username, Sandi &amp; PIN</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Pengaturan Form & Jadwal Penugasan Ruangan</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Kontrol Cloud Database & Google Drive BAZNAS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {categoriesList.map((cat) => {
                  const count =
                    cat === 'all'
                      ? ROLE_PERMISSIONS_DATA.length
                      : ROLE_PERMISSIONS_DATA.filter((f) => f.category === cat).length;

                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        selectedCategory === cat
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{cat === 'all' ? 'Semua Modul' : cat}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        selectedCategory === cat ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Feature Search */}
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari fitur atau aksi..."
                  value={searchFeature}
                  onChange={(e) => setSearchFeature(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* MATRIX CHECKLIST TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-600" />
                  <span>Matriks Lengkap Hak Akses & Perbandingan Fitur</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Daftar fitur aplikasi SIM-BERSIH SCB beserta batas kewenangan tiap tingkat peran pengguna.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500 font-mono">
                {filteredFeatures.length} Fitur Terdaftar
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 min-w-[260px]">Modul & Fitur Sistem</th>
                    <th className="py-3 px-4 min-w-[190px] bg-emerald-50/60 text-emerald-900 border-x border-emerald-100">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>User (Petugas)</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 min-w-[190px] bg-blue-50/60 text-blue-900 border-r border-blue-100">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Supervisor</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 min-w-[190px] bg-amber-50/60 text-amber-900">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>Admin (Super Admin)</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredFeatures.map((feat) => {
                    return (
                      <tr key={feat.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* FEATURE NAME & DETAILS */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {feat.name}
                              </span>
                              <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {feat.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-snug">
                              {feat.description}
                            </p>
                          </div>
                        </td>

                        {/* COLUMN 1: USER (PETUGAS) */}
                        <td className="py-3.5 px-4 bg-emerald-50/20 border-x border-emerald-100/60 align-top">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                feat.user.allowed === true
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : feat.user.allowed === 'partial'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              {feat.user.allowed === true ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              ) : feat.user.allowed === 'partial' ? (
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                              ) : (
                                <XCircle className="w-3 h-3 text-slate-400" />
                              )}
                              <span>{feat.user.label}</span>
                            </span>
                            {feat.user.note && (
                              <p className="text-[10px] text-slate-500 italic leading-tight">
                                {feat.user.note}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* COLUMN 2: SUPERVISOR */}
                        <td className="py-3.5 px-4 bg-blue-50/20 border-r border-blue-100/60 align-top">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                feat.supervisor.allowed === true
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                  : feat.supervisor.allowed === 'partial'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              {feat.supervisor.allowed === true ? (
                                <CheckCircle2 className="w-3 h-3 text-blue-600" />
                              ) : feat.supervisor.allowed === 'partial' ? (
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                              ) : (
                                <XCircle className="w-3 h-3 text-slate-400" />
                              )}
                              <span>{feat.supervisor.label}</span>
                            </span>
                            {feat.supervisor.note && (
                              <p className="text-[10px] text-slate-500 italic leading-tight">
                                {feat.supervisor.note}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* COLUMN 3: ADMIN */}
                        <td className="py-3.5 px-4 bg-amber-50/20 align-top">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                feat.admin.allowed === true
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : feat.admin.allowed === 'partial'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              {feat.admin.allowed === true ? (
                                <CheckCircle2 className="w-3 h-3 text-amber-700" />
                              ) : feat.admin.allowed === 'partial' ? (
                                <AlertCircle className="w-3 h-3 text-blue-600" />
                              ) : (
                                <XCircle className="w-3 h-3 text-slate-400" />
                              )}
                              <span>{feat.admin.label}</span>
                            </span>
                            {feat.admin.note && (
                              <p className="text-[10px] text-slate-500 italic leading-tight">
                                {feat.admin.note}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Matrix Footer Notes */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Seluruh hak akses dikontrol secara otomatis sesuai peran (Petugas, Supervisor, Super Admin).</span>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="self-start sm:self-auto px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / Simpan PDF Matriks</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT USER MODAL */}
      {(isAddModalOpen || editingUser) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <span>
                  {editingUser
                    ? 'Edit Profil Akun Personel'
                    : registeredReceipt
                    ? 'Akun Berhasil Didaftarkan'
                    : 'Daftarkan Akun Baru (Email & Kata Sandi)'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingUser(null);
                  setRegisteredReceipt(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {registeredReceipt ? (
              <div className="p-5 space-y-4 text-xs sm:text-sm">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-emerald-900">
                      Pendaftaran Akun Selesai ({registeredReceipt.name})
                    </p>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      {registeredReceipt.message}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-800">Rincian Kredensial Login</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                      {registeredReceipt.role}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-slate-500">Email Login</span>
                    <span className="col-span-2 font-mono font-bold text-slate-900 break-all">
                      {registeredReceipt.email}
                    </span>
                    <span className="text-slate-500">Username</span>
                    <span className="col-span-2 font-mono text-slate-800">
                      @{registeredReceipt.username}
                    </span>
                    <span className="text-slate-500">Kata Sandi</span>
                    <span className="col-span-2 font-mono font-bold text-emerald-700">
                      {registeredReceipt.authStatus === 'already_exists'
                        ? '(Sesuai akun Firebase sebelumnya / gunakan Reset Sandi)'
                        : registeredReceipt.password}
                    </span>
                    <span className="text-slate-500">Email Verifikasi</span>
                    <span className="col-span-2 text-slate-700">
                      {registeredReceipt.emailSent
                        ? 'Terkirim ke kotak masuk/spam personel (wajib klik 1x sebelum login)'
                        : registeredReceipt.authStatus === 'already_exists'
                        ? 'Akun sudah terdaftar sebelumnya di Firebase'
                        : 'Tertunda — personel dapat minta kirim ulang saat login'}
                    </span>
                  </div>
                </div>

                {!registeredReceipt.cloudSynced && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    Profil personel tersimpan di perangkat ini dan menunggu Superadmin menghubungkan Cloud Sync untuk masuk ke daftar direktori pusat.
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCopyRegisteredCredentials}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {copiedCredentials ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedCredentials ? 'Tersalin!' : 'Salin Info Akun (WhatsApp)'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenAddModal}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Daftarkan Lagi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRegisteredReceipt(null);
                        setIsAddModalOpen(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Modal Form */
              <form onSubmit={handleSaveUser} className="p-5 space-y-4 text-xs sm:text-sm">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Lengkap Personel <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: MUHAMMAD RIZKI"
                    value={formData.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        name: val,
                        username:
                          !usernameEditedManually && !prev.email
                            ? deriveUsernameFromEmailOrName('', val)
                            : prev.username,
                      }));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Alamat Email Login <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="nama@gmail.com"
                      value={formData.email}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          email: val,
                          username: !usernameEditedManually
                            ? deriveUsernameFromEmailOrName(val, prev.name)
                            : prev.username,
                        }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Username <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="contoh: rizki"
                      value={formData.username}
                      onChange={(e) => {
                        setUsernameEditedManually(true);
                        setFormData({ ...formData, username: e.target.value });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl lowercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {!editingUser && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Kata Sandi Akun Baru (Min. 6 Karakter)</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Buat Sandi Acak</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Kata Sandi <span className="text-rose-600">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            autoComplete="new-password"
                            placeholder="Minimal 6 karakter"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full pl-3 pr-9 py-2 border border-slate-300 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Konfirmasi Kata Sandi <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          placeholder="Ulangi kata sandi"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Peran (Role)
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="petugas">Petugas Kebersihan</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      No. HP / WhatsApp
                    </label>
                    <input
                      type="tel"
                      placeholder="0812xxxxxxxx"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Dynamic Role Capability Checklist Preview */}
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    formData.role === 'superadmin'
                      ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                      : formData.role === 'supervisor'
                      ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                      : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>
                        Ringkasan Hak Akses Peran:{' '}
                        {formData.role === 'superadmin'
                          ? 'Super Admin'
                          : formData.role === 'supervisor'
                          ? 'Supervisor'
                          : 'Petugas Kebersihan'}
                      </span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border font-bold uppercase">
                      {formData.role}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    {formData.role === 'petugas' && (
                      <>
                        <div className="flex items-center gap-1.5 text-emerald-800">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Input laporan kebersihan harian & foto bukti (kamera/file)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-800">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Login menggunakan Email &amp; Kata Sandi terdaftar</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-800">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Revisi laporan pribadi jika berstatus "Perlu Perbaikan"</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Hanya dapat melaporkan ruangan yang ditugaskan dalam jadwal</span>
                        </div>
                      </>
                    )}

                    {formData.role === 'supervisor' && (
                      <>
                        <div className="flex items-center gap-1.5 text-blue-800">
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Memiliki seluruh akses pelaporan dan supervisi ruangan</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-blue-800">
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Verifikasi & validasi laporan petugas (Setujui / Perlu Perbaikan)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-blue-800">
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Memberi catatan evaluasi & cetak berita acara resmi</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Tidak memiliki akses hapus laporan atau kelola personil</span>
                        </div>
                      </>
                    )}

                    {formData.role === 'superadmin' && (
                      <>
                        <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                          <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Hak akses penuh (Full Access) ke seluruh modul sistem</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                          <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Pengelolaan form (ruangan, checklist) & jadwal penugasan petugas</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                          <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Kontrol Cloud Database & folder penyimpanan Google Drive BAZNAS</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                          <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Hapus laporan keliru & pulihkan cadangan data JSON/CSV</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Key className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-emerald-900">Autentikasi Cloud Email &amp; Kata Sandi</p>
                      <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                        {editingUser
                          ? 'Perubahan data profil langsung tersinkron. Jika ingin mengganti kata sandi login Cloud personel, kirim link reset kata sandi ke emailnya.'
                          : 'Akun login Firebase Auth akan didaftarkan dengan Email & Kata Sandi ini (tanpa menyimpan kata sandi di database), dan link verifikasi 1x dikirim ke email personel.'}
                      </p>
                    </div>
                  </div>
                  {editingUser && onSendPasswordReset && formData.email && (
                    <button
                      type="button"
                      onClick={() => onSendPasswordReset(formData.email)}
                      className="shrink-0 px-2.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      Kirim Reset Sandi
                    </button>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="font-semibold text-slate-700">Status Akun Aktif</span>
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isSubmittingUser}
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setEditingUser(null);
                      }}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingUser}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {isSubmittingUser && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>
                        {isSubmittingUser
                          ? 'Mendaftarkan...'
                          : editingUser
                          ? 'Simpan Perubahan'
                          : 'Daftarkan Akun'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
