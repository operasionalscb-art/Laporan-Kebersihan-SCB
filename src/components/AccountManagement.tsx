import React, { useState, useMemo } from 'react';
import { User, UserRole } from '../types';
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
  ChevronRight
} from 'lucide-react';

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
    name: 'Verifikasi & Validasi Laporan',
    description: 'Menyetujui (Disetujui) atau menolak laporan petugas dan meminta perbaikan ulang (Perlu Perbaikan).',
    user: { allowed: false, label: 'Tidak Diizinkan', note: 'Petugas tidak dapat memvalidasi laporan sendiri' },
    supervisor: { allowed: true, label: 'Tugas Utama', note: 'Penanggung jawab kebersihan & mutu' },
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
    name: 'Login Cepat PIN & Ganti Akun',
    description: 'Masuk dengan 4 digit PIN petugas di ponsel lapangan tanpa repot mengetik email panjang.',
    user: { allowed: true, label: 'Diizinkan', note: 'Login cepat khusus petugas lapangan' },
    supervisor: { allowed: true, label: 'Diizinkan', note: 'Dapat menggunakan PIN cepat atau Sandi' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Akses login cepat atau email superadmin' },
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
    description: 'Mendaftarkan petugas kebersihan baru, menentukan username login, PIN, peran, dan nomor WhatsApp.',
    user: { allowed: false, label: 'Tidak Diizinkan', note: 'Hanya Super Admin yang berwenang' },
    supervisor: { allowed: false, label: 'Tidak Diizinkan', note: 'Hanya Super Admin yang berwenang' },
    admin: { allowed: true, label: 'Diizinkan', note: 'Kelola seluruh daftar personil' },
  },
  {
    id: 'edit_reset_pin',
    category: 'Pengelolaan Akun',
    name: 'Edit Data Pengguna & Reset PIN/Sandi',
    description: 'Mengubah nama personil, mengganti peran (role), mereset PIN yang terlupa, dan memperbarui kontak.',
    user: { allowed: 'partial', label: 'PIN Pribadi', note: 'Hanya mengetahui PIN akunnya sendiri' },
    supervisor: { allowed: 'partial', label: 'PIN Pribadi', note: 'Hanya mengetahui PIN akunnya sendiri' },
    admin: { allowed: true, label: 'Bebas Reset', note: 'Dapat mereset PIN/sandi semua akun' },
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

interface AccountManagementProps {
  users: User[];
  currentUser: User | null;
  onAddUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  onUpdateUser: (id: string, updates: Partial<User>) => void;
  onDeleteUser: (id: string) => void;
  onSwitchUser?: (user: User) => void;
  onResetData?: () => void;
}

export const AccountManagement: React.FC<AccountManagementProps> = ({
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  const [searchUser, setSearchUser] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Sub Tab Navigation: 'users' or 'checklist'
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'checklist'>('users');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchFeature, setSearchFeature] = useState<string>('');

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    pin: '1234',
    role: 'petugas' as UserRole,
    phone: '',
    isActive: true,
  });

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      email: '',
      username: '',
      password: '',
      pin: '1234',
      role: 'petugas',
      phone: '',
      isActive: true,
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      username: user.username,
      password: user.password || '',
      pin: user.pin || '1234',
      role: user.role,
      phone: user.phone || '',
      isActive: user.isActive,
    });
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.username.trim()) {
      alert('Nama dan Username wajib diisi');
      return;
    }

    if (editingUser) {
      onUpdateUser(editingUser.id, {
        name: formData.name.trim().toUpperCase(),
        email: formData.email.trim(),
        username: formData.username.trim().toLowerCase(),
        password: formData.password || 'password123',
        pin: formData.pin || '1234',
        role: formData.role,
        phone: formData.phone.trim(),
        isActive: formData.isActive,
      });
      setEditingUser(null);
    } else {
      onAddUser({
        name: formData.name.trim().toUpperCase(),
        email: formData.email.trim() || `${formData.username.trim().toLowerCase()}@scb.sch.id`,
        username: formData.username.trim().toLowerCase(),
        password: formData.password || 'password123',
        pin: formData.pin || '1234',
        role: formData.role,
        phone: formData.phone.trim(),
        isActive: formData.isActive,
        avatarColor:
          formData.role === 'superadmin'
            ? 'from-amber-600 to-yellow-700'
            : formData.role === 'supervisor'
            ? 'from-blue-600 to-indigo-700'
            : 'from-emerald-600 to-teal-700',
      });
      setIsAddModalOpen(false);
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Tambah Petugas Baru</span>
          </button>
        </div>
      </div>

      {/* SUB-TABS: USERS LIST VS ROLES CHECKLIST MATRIX */}
      <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-1">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
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
          onClick={() => setActiveSubTab('checklist')}
          className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'checklist'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-blue-600" />
          <span>Ceklist Fitur & Hak Akses Peran</span>
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
          {/* Info Callout */}
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-emerald-950">
                Petugas Bawaan Terdaftar Sesuai Formulir:
              </p>
              <p className="text-emerald-800">
                Akun bawaan: <strong>IDAY M YUSUF</strong> (username: <code>iday</code>),{' '}
                <strong>ABDUL KODIR</strong> (username: <code>kodir</code>), dan{' '}
                <strong>WAHYUDIN</strong> (username: <code>wahyudin</code>) dengan PIN standar <code>1234</code>.
                Petugas dapat langsung memilih akun untuk input laporan kebersihan harian.
              </p>
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
                    <th className="py-3 px-4">PIN / Sandi</th>
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
                          <div className="text-[11px] text-slate-500">{user.email}</div>
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

                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-600">
                          PIN: <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">{user.pin}</span>
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
                            {/* Edit User */}
                            <button
                              onClick={() => handleOpenEditModal(user)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                              title="Edit Akun"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete User (Prevent deleting primary superadmin) */}
                            {!isSuper && (
                              <button
                                onClick={() => {
                                  if (confirm(`Yakin ingin menghapus akun ${user.name}?`)) {
                                    onDeleteUser(user.id);
                                  }
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
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

      {/* TAB CONTENT 2: CEKLIST & MATRIKS HAK AKSES PERAN */}
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
                  <span>Login Cepat PIN 4 Digit di Ponsel</span>
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
                Memegang <strong>otoritas penuh (Full Access)</strong>: manajemen personil & reset PIN, kontrol sinkronisasi folder Google Drive BAZNAS, backup & restore database cloud, serta audit log sistem.
              </p>
              <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1.5 text-slate-600">
                <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Pengelolaan Akun & Reset PIN Personel</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Kontrol Cloud Database & Google Drive</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Hapus Laporan & Pulihkan Cadangan Data</span>
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
                <span>Seluruh hak akses dikontrol secara otomatis dan terlindungi oleh sistem enkripsi PIN/Sandi.</span>
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
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                {editingUser ? 'Edit Data Petugas' : 'Tambah Petugas Kebersihan Baru'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingUser(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="p-5 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap Petugas <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: MUHAMMAD RIZKI"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Username Login <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="contoh: rizki"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl lowercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    PIN Cepat (4-6 digit) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="1234"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email (Opsional)
                </label>
                <input
                  type="email"
                  placeholder="petugas@scb.sch.id"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

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
                        <span>Login cepat dengan 4 digit PIN di ponsel</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-800">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Revisi laporan pribadi jika berstatus "Perlu Perbaikan"</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Tidak memiliki akses verifikasi laporan atau kelola personil</span>
                      </div>
                    </>
                  )}

                  {formData.role === 'supervisor' && (
                    <>
                      <div className="flex items-center gap-1.5 text-blue-800">
                        <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Memiliki seluruh akses pelaporan petugas lapangan</span>
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
                        <span>Tambah, edit, non-aktifkan personil & reset PIN semua akun</span>
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

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kata Sandi Akun
                </label>
                <input
                  type="text"
                  placeholder="password123"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
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
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setEditingUser(null);
                    }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
