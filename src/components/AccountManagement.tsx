import React, { useState } from 'react';
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
  Sparkles
} from 'lucide-react';

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
      password: 'password123',
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
            ? 'from-emerald-600 to-teal-700'
            : 'from-blue-600 to-indigo-700',
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
            Pengelolaan Akun Petugas & Supervisor
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Kelola akun petugas kebersihan Sekolah Cendekia BAZNAS (SCB), atur hak akses, dan reset PIN login.
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
