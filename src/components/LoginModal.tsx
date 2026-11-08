import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { 
  Building2, 
  ShieldCheck, 
  UserCheck, 
  X, 
  AlertCircle, 
  ArrowRight,
  Mail,
  Loader2,
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-react';
import { googleSignIn } from '../services/googleAuth';

export const GoogleIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onLoginSuccess: (user: User) => void;
  promptReason?: string;
  initialTab?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
  onLoginSuccess,
  promptReason,
}) => {
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [googleSuccessInfo, setGoogleSuccessInfo] = useState<{
    email: string;
    name: string;
    role: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setIsGoogleLoading(false);
      setGoogleSuccessInfo(null);
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const eligibleUsers = users.filter((u) => u.isActive !== false);

  const handleClose = () => {
    setErrorMessage('');
    setIsGoogleLoading(false);
    setGoogleSuccessInfo(null);
    onClose();
  };

  /**
   * Helper: Matches authenticated Google email strictly to registered user accounts
   */
  const matchRegisteredUser = (email: string, userList: User[]): User | undefined => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return undefined;

    // 1. Direct match on user.email
    const directMatch = userList.find(
      (u) => u.email && u.email.trim().toLowerCase() === cleanEmail && u.isActive !== false
    );
    if (directMatch) return directMatch;

    // 2. Designated Superadmin email
    if (cleanEmail === 'operasional.scb@gmail.com') {
      const admin = userList.find((u) => u.role === 'superadmin' && u.isActive !== false);
      if (admin) return admin;
    }

    // 3. Official SCB domain username match: ONLY if email domain is @scb.sch.id
    if (cleanEmail.endsWith('@scb.sch.id')) {
      const prefix = cleanEmail.split('@')[0];
      const usernameMatch = userList.find(
        (u) => u.username && u.username.trim().toLowerCase() === prefix && u.isActive !== false
      );
      if (usernameMatch) return usernameMatch;
    }

    return undefined;
  };

  /**
   * Main Google Login Handler:
   * Prompts user with Google account chooser and strictly verifies against registered system users.
   */
  const handleGoogleLogin = async (hintEmail?: string) => {
    setIsGoogleLoading(true);
    setErrorMessage('');
    setGoogleSuccessInfo(null);

    try {
      const { profile } = await googleSignIn('auto', hintEmail);
      const googleEmail = (profile.email || '').trim().toLowerCase();

      if (!googleEmail) {
        setErrorMessage(
          'Tidak dapat membaca alamat email dari akun Google. Pastikan Anda mengizinkan profil email saat login Google.'
        );
        setIsGoogleLoading(false);
        return;
      }

      // Check strictly against registered users
      const matchedUser = matchRegisteredUser(googleEmail, users);

      if (matchedUser) {
        setGoogleSuccessInfo({
          email: googleEmail,
          name: matchedUser.name,
          role: matchedUser.role,
        });

        // Attach profile photo if available
        if (profile.photoURL) {
          matchedUser.photoURL = profile.photoURL;
        }

        setTimeout(() => {
          onLoginSuccess(matchedUser);
          handleClose();
        }, 500);
      } else {
        // STRICT ACCESS DENIAL: Unauthorized guest or non-registered email
        setErrorMessage(
          `Akses Ditolak: Akun Google "${googleEmail}" tidak terdaftar sebagai personil SIM-BERSIH SCB. Sistem hanya mengizinkan akun resmi yang didaftarkan Superadmin.`
        );
      }
    } catch (err: any) {
      console.warn('Google login error:', err);
      const rawMsg = err?.message || String(err || '');
      if (rawMsg.includes('closed') || rawMsg.includes('dibatalkan') || rawMsg.includes('cancel')) {
        setErrorMessage('Proses login Google dibatalkan. Silakan coba kembali.');
      } else if (rawMsg.includes('popup') || rawMsg.includes('terblokir') || rawMsg.includes('blocked')) {
        setErrorMessage('Jendela pop-up Google terblokir browser. Harap izinkan pop-up di browser Anda.');
      } else {
        setErrorMessage(rawMsg || 'Gagal masuk via akun Google. Pastikan jaringan internet aktif.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-5 text-white relative">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg leading-tight">SIM-BERSIH SCB</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 rounded-full">
                  Google SSO
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Sekolah Cendekia BAZNAS • Masuk Akun Petugas & Pengelola
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {promptReason && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="font-semibold leading-relaxed">{promptReason}</p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 text-[11px] leading-relaxed">
                <p className="font-bold text-rose-800 text-xs mb-0.5">Otentikasi Akun Ditolak</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {googleSuccessInfo ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2 animate-in zoom-in-95">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">Autentikasi Berhasil!</h4>
              <p className="text-xs text-slate-600">
                Masuk sebagai <strong>{googleSuccessInfo.name}</strong> ({googleSuccessInfo.role.toUpperCase()})
              </p>
              <p className="text-[11px] text-emerald-700 font-mono">{googleSuccessInfo.email}</p>
            </div>
          ) : (
            <>
              {/* Official Google Login Hero Button */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleGoogleLogin()}
                  disabled={isGoogleLoading}
                  className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 border-2 border-slate-300 hover:border-emerald-500 rounded-xl font-bold text-slate-800 text-sm shadow-xs transition-all flex items-center justify-center gap-3 group relative cursor-pointer active:scale-[0.99] disabled:opacity-60"
                >
                  {isGoogleLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                      <span>Menghubungkan ke Google...</span>
                    </>
                  ) : (
                    <>
                      <GoogleIcon className="w-5 h-5 shrink-0" />
                      <span className="text-slate-800 group-hover:text-emerald-900 font-semibold">
                        Masuk dengan Akun Google
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all ml-auto" />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                  Sistem menggunakan <strong>Google Single Sign-On (SSO)</strong>. Pastikan akun Google yang Anda pilih menggunakan email resmi yang telah didaftarkan oleh Superadmin.
                </p>
              </div>

              {/* Registered Accounts Directory (Quick Select) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Daftar Akun Resmi yang Terdaftar:
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {eligibleUsers.length} Personel
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-2">
                  Klik akun di bawah untuk membuka verifikasi Google SSO dengan email tersebut:
                </p>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {eligibleUsers.map((user) => {
                    const isSuper = user.role === 'superadmin';
                    const isSupervisor = user.role === 'supervisor';

                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleGoogleLogin(user.email)}
                        disabled={isGoogleLoading}
                        className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all flex items-center justify-between gap-2.5 group cursor-pointer shadow-2xs hover:shadow-xs disabled:opacity-60"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${
                              user.avatarColor || 'from-emerald-600 to-teal-700'
                            } text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                          >
                            {user.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-900">
                                {user.name}
                              </p>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider shrink-0 ${
                                  isSuper
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : isSupervisor
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {isSuper ? 'Admin' : isSupervisor ? 'SPV' : 'Petugas'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                              <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="font-mono text-[10px]">{user.email}</span>
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold group-hover:bg-emerald-600 group-hover:text-white transition-all">
                          <GoogleIcon className="w-3 h-3" />
                          <span>Login</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Security & Support Note */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span>Keamanan terpusat SCB: Akses form laporan dan jadwal ruangan dibatasi sesuai penugasan personel terjadwal.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
