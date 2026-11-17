import React, { useState } from 'react';
import { User } from '../types';
import { 
  Building2, 
  ClipboardCheck, 
  PlusCircle, 
  Users, 
  LogOut, 
  ChevronDown, 
  ShieldCheck,
  CheckCircle2,
  Lock,
  Database,
  Sliders
} from 'lucide-react';
import { GoogleIcon } from './LoginModal';

interface NavbarProps {
  currentUser: User | null;
  allUsers?: User[];
  activeTab: 'dashboard' | 'input' | 'form_mgmt' | 'accounts' | 'drive';
  setActiveTab: (tab: 'dashboard' | 'input' | 'form_mgmt' | 'accounts' | 'drive') => void;
  onSwitchUser?: (user: User) => void;
  onLogout: () => void;
  onOpenLoginModal: (reason?: string) => void;
  onRequestInputReport: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
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
                <span className="font-semibold text-white">
                  Online ({currentUser.role === 'superadmin' ? 'SUPERADMIN' : currentUser.role === 'supervisor' ? 'SUPERVISOR' : 'PETUGAS'})
                </span>
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
        <div className="flex items-center justify-between gap-3 lg:gap-4 h-16">
          {/* Logo & Brand Title */}
          <div
            className="flex items-center gap-2.5 cursor-pointer shrink-0 min-w-0"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-700/20 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-slate-900 text-sm sm:text-base lg:text-lg leading-tight tracking-tight whitespace-nowrap">
                  SIM-BERSIH SCB
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded shrink-0">
                  Harian
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden xl:block truncate">
                Laporan Kebersihan Kamar Mandi Petugas
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links (Uniform Segmented Bar, Zero Overlap) */}
          <nav
            aria-label="Menu Utama"
            className="hidden lg:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shrink-0"
          >
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`inline-flex items-center justify-center gap-1.5 h-9 px-3 xl:px-3.5 rounded-lg text-xs xl:text-[13px] whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                activeTab === 'dashboard'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs border border-slate-200/80'
                  : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <ClipboardCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={onRequestInputReport}
              title={!currentUser ? 'Khusus Petugas / Pengelola Terdaftar (Login Google)' : 'Buat Laporan Kebersihan Baru'}
              className={`inline-flex items-center justify-center gap-1.5 h-9 px-3 xl:px-3.5 rounded-lg text-xs xl:text-[13px] whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                activeTab === 'input'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : currentUser
                  ? 'text-emerald-800 font-semibold hover:bg-emerald-50'
                  : 'text-slate-500 font-medium hover:text-slate-800 hover:bg-white/60'
              }`}
            >
              {currentUser ? (
                <PlusCircle className={`w-4 h-4 shrink-0 ${activeTab === 'input' ? 'text-white' : 'text-emerald-600'}`} />
              ) : (
                <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              )}
              <span>Input Laporan</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('form_mgmt')}
                className={`inline-flex items-center justify-center gap-1.5 h-9 px-3 xl:px-3.5 rounded-lg text-xs xl:text-[13px] whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  activeTab === 'form_mgmt'
                    ? 'bg-white text-emerald-800 font-bold shadow-xs border border-slate-200/80'
                    : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Form &amp; Jadwal</span>
              </button>
            )}

            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('accounts')}
                className={`inline-flex items-center justify-center gap-1.5 h-9 px-3 xl:px-3.5 rounded-lg text-xs xl:text-[13px] whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  activeTab === 'accounts'
                    ? 'bg-white text-emerald-800 font-bold shadow-xs border border-slate-200/80'
                    : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Users className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Kelola Akun</span>
              </button>
            )}

            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('drive')}
                className={`inline-flex items-center justify-center gap-1.5 h-9 px-3 xl:px-3.5 rounded-lg text-xs xl:text-[13px] whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  activeTab === 'drive'
                    ? 'bg-white text-emerald-800 font-bold shadow-xs border border-slate-200/80'
                    : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Database className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Penyimpanan</span>
              </button>
            )}
          </nav>

          {/* Right Actions: User Switcher / Profile */}
          <div className="flex items-center gap-2 shrink-0">
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setShowSwitchMenu(!showSwitchMenu)}
                  className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left cursor-pointer"
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${currentUser.avatarColor || 'from-emerald-600 to-teal-700'} flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0`}>
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="hidden sm:block text-left min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate max-w-[115px] xl:max-w-[140px] leading-tight">
                      {currentUser.name}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                      {currentUser.role === 'superadmin' ? 'Superadmin' : currentUser.role === 'supervisor' ? 'Supervisor Sarpras' : 'Petugas CS'}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>

                {/* Dropdown Menu */}
                {showSwitchMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2.5 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Akun Terhubung (Google SSO)
                        </span>
                        {currentUser.role === 'superadmin' ? (
                          <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 mr-0.5" /> Super Admin
                          </span>
                        ) : currentUser.role === 'supervisor' ? (
                          <span className="inline-flex items-center text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            <ShieldCheck className="w-3 h-3 mr-0.5" /> Supervisor
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm font-bold text-slate-800 mt-1">{currentUser.name}</p>
                      <p className="text-xs text-slate-500 truncate font-mono">{currentUser.email}</p>
                    </div>

                    {isSuperAdmin && (
                      <div className="p-1 border-b border-slate-100 space-y-0.5">
                        <button
                          onClick={() => {
                            setShowSwitchMenu(false);
                            setActiveTab('form_mgmt');
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left cursor-pointer"
                        >
                          <Sliders className="w-4 h-4 text-emerald-600" />
                          <span>Pengelolaan Form & Jadwal Ruangan</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowSwitchMenu(false);
                            setActiveTab('accounts');
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left cursor-pointer"
                        >
                          <Users className="w-4 h-4 text-emerald-600" />
                          <span>Pengelolaan Akun Personil</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowSwitchMenu(false);
                            setActiveTab('drive');
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left cursor-pointer"
                        >
                          <Database className="w-4 h-4 text-emerald-600" />
                          <span>Pusat Penyimpanan & Cadangan</span>
                        </button>
                      </div>
                    )}

                    <div className="p-1">
                      <button
                        onClick={() => {
                          setShowSwitchMenu(false);
                          onLogout();
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Keluar Akun (Logout)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => onOpenLoginModal('Masuk Akun Petugas Kebersihan / Pengelola SCB via Google')}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
              >
                <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center p-0.5 shrink-0 shadow-2xs">
                  <GoogleIcon className="w-3.5 h-3.5" />
                </span>
                <span>Login Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile & Tablet Sub-Navigation Bar (Uniform Grid, Zero Overlap) */}
        <div
          className={`grid lg:hidden gap-1 border-t border-slate-100 py-1.5 ${
            isSuperAdmin ? 'grid-cols-5' : 'grid-cols-2'
          }`}
        >
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 text-[11px] rounded-lg transition-colors min-w-0 ${
              activeTab === 'dashboard'
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-slate-600 font-medium hover:bg-slate-50'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 mb-0.5 shrink-0" />
            <span className="truncate w-full text-center">Dashboard</span>
          </button>

          <button
            onClick={onRequestInputReport}
            className={`flex flex-col items-center justify-center py-1.5 px-1 text-[11px] rounded-lg transition-colors min-w-0 ${
              activeTab === 'input'
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-slate-600 font-medium hover:bg-slate-50'
            }`}
          >
            {currentUser ? (
              <PlusCircle className="w-4 h-4 mb-0.5 shrink-0" />
            ) : (
              <Lock className="w-4 h-4 mb-0.5 text-amber-600 shrink-0" />
            )}
            <span className="truncate w-full text-center">Input</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('form_mgmt')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 text-[11px] rounded-lg transition-colors min-w-0 ${
                activeTab === 'form_mgmt'
                  ? 'bg-emerald-50 text-emerald-700 font-bold'
                  : 'text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              <Sliders className="w-4 h-4 mb-0.5 shrink-0" />
              <span className="truncate w-full text-center">Jadwal</span>
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('accounts')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 text-[11px] rounded-lg transition-colors min-w-0 ${
                activeTab === 'accounts'
                  ? 'bg-emerald-50 text-emerald-700 font-bold'
                  : 'text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4 mb-0.5 shrink-0" />
              <span className="truncate w-full text-center">Akun</span>
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('drive')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 text-[11px] rounded-lg transition-colors min-w-0 ${
                activeTab === 'drive'
                  ? 'bg-emerald-50 text-emerald-700 font-bold'
                  : 'text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              <Database className="w-4 h-4 mb-0.5 shrink-0" />
              <span className="truncate w-full text-center">Data</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
