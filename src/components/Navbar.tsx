import React, { useState } from 'react';
import { User } from '../types';
import { 
  Building2, 
  ClipboardCheck, 
  PlusCircle, 
  Users, 
  LogOut, 
  UserCheck, 
  ChevronDown, 
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Eye,
  LogIn,
  HardDrive
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  allUsers: User[];
  activeTab: 'dashboard' | 'input' | 'accounts' | 'drive';
  setActiveTab: (tab: 'dashboard' | 'input' | 'accounts' | 'drive') => void;
  onSwitchUser: (user: User) => void;
  onLogout: () => void;
  onOpenLoginModal: (reason?: string, tab?: 'quick_petugas' | 'email_admin') => void;
  onRequestInputReport: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  allUsers,
  activeTab,
  setActiveTab,
  onSwitchUser,
  onLogout,
  onOpenLoginModal,
  onRequestInputReport,
}) => {
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);

  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.email === 'operasional.scb@gmail.com';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner Alert / Institution Branding */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white px-4 py-1.5 text-xs font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-500/40 text-[11px] font-semibold text-emerald-200">
              BAZNAS
            </span>
            <span className="hidden sm:inline text-emerald-100">
              Sekolah Cendekia BAZNAS (SCB) • Divisi Sarana, Prasarana & Kebersihan
            </span>
            <span className="sm:hidden text-emerald-100">
              Sekolah Cendekia BAZNAS
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            {currentUser ? (
              <span className="inline-flex items-center gap-1 text-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">Status:</span>
                <span className="font-semibold text-white">Online ({currentUser.role.toUpperCase()})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-400/30 text-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Mode Tamu: <strong className="text-white">Hanya Melihat Dashboard</strong></span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-700/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight tracking-tight">
                  SIM-BERSIH SCB
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                  Harian
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Laporan Kebersihan Kamar Mandi Petugas
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Dashboard Laporan</span>
            </button>

            <button
              onClick={onRequestInputReport}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'input'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : currentUser
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {currentUser ? <PlusCircle className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-600" />}
              <span>Input Laporan Baru</span>
              {!currentUser && (
                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-bold">
                  Kunci Petugas
                </span>
              )}
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('accounts')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'accounts'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Pengelolaan Akun</span>
                <span className="ml-1 px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                  Admin
                </span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('drive')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'drive'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Google Drive</span>
              <span className="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                Cloud
              </span>
            </button>
          </nav>

          {/* Right Actions: User Switcher / Profile */}
          <div className="flex items-center space-x-2">
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setShowSwitchMenu(!showSwitchMenu)}
                  className="flex items-center space-x-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${currentUser.avatarColor || 'from-emerald-600 to-teal-700'} flex items-center justify-center text-white font-bold text-xs shadow-xs`}>
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-bold text-slate-800 truncate max-w-[130px] leading-tight">
                      {currentUser.name}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {currentUser.role === 'superadmin' ? 'Superadmin' : 'Petugas CS'}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {showSwitchMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Akun Aktif
                        </span>
                        {currentUser.role === 'superadmin' && (
                          <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 mr-0.5" /> Super Admin
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-slate-800 mt-1">{currentUser.name}</p>
                      <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                    </div>

                    {/* Quick Switcher for Testing Different Roles */}
                    <div className="px-3 py-2 border-b border-slate-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-emerald-600" />
                          Ganti Cepat Pengguna
                        </span>
                        <span className="text-[10px] text-slate-400">Mode Demo</span>
                      </div>
                      <div className="space-y-1 max-h-44 overflow-y-auto">
                        {allUsers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              onSwitchUser(u);
                              setShowSwitchMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                              currentUser.id === u.id
                                ? 'bg-emerald-50 text-emerald-800 font-semibold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="truncate pr-2">{u.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              u.role === 'superadmin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {u.role === 'superadmin' ? 'Admin' : 'Petugas'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setShowSwitchMenu(false);
                          onLogout();
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Keluar / Ganti Akun Lain</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => onOpenLoginModal('Masuk Akun Petugas Kebersihan / Pengelola SCB')}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-all"
              >
                <span>Masuk Petugas / Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="flex md:hidden items-center justify-around border-t border-slate-100 py-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center py-1 px-3 text-xs font-medium rounded-lg ${
              activeTab === 'dashboard' ? 'text-emerald-700 font-bold' : 'text-slate-600'
            }`}
          >
            <ClipboardCheck className="w-5 h-5 mb-0.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={onRequestInputReport}
            className={`flex flex-col items-center py-1 px-3 text-xs font-medium rounded-lg ${
              activeTab === 'input' ? 'text-emerald-700 font-bold' : 'text-slate-600'
            }`}
          >
            {currentUser ? <PlusCircle className="w-5 h-5 mb-0.5" /> : <Lock className="w-5 h-5 mb-0.5 text-amber-600" />}
            <span>Input {currentUser ? 'Laporan' : '(Petugas)'}</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('accounts')}
              className={`flex flex-col items-center py-1 px-3 text-xs font-medium rounded-lg ${
                activeTab === 'accounts' ? 'text-emerald-700 font-bold' : 'text-slate-600'
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span>Akun</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('drive')}
            className={`flex flex-col items-center py-1 px-3 text-xs font-medium rounded-lg ${
              activeTab === 'drive' ? 'text-emerald-700 font-bold' : 'text-slate-600'
            }`}
          >
            <HardDrive className="w-5 h-5 mb-0.5" />
            <span>Drive</span>
          </button>
        </div>
      </div>
    </header>
  );
};
