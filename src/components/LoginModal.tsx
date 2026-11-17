import React, { useState, useEffect } from 'react';
import { User } from '../types';
import {
  Building2,
  ShieldCheck,
  X,
  AlertCircle,
  ArrowRight,
  Loader2,
  Info,
} from 'lucide-react';
import { googleSignIn } from '../services/googleAuth';

export const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
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
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setIsGoogleLoading(false);
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setErrorMessage('');
    setIsGoogleLoading(false);
    onClose();
  };

  const matchRegisteredUser = (
    email: string,
    userList: User[]
  ): { user?: User; isDisabled?: boolean } => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return {};

    // 1. Direct email match
    const anyEmailMatch = userList.find(
      (u) => u.email && u.email.trim().toLowerCase() === cleanEmail
    );
    if (anyEmailMatch) {
      if (anyEmailMatch.isActive === false) return { isDisabled: true };
      return { user: anyEmailMatch };
    }

    // 2. Designated Superadmin email
    if (cleanEmail === 'operasional.scb@gmail.com') {
      const admin = userList.find((u) => u.role === 'superadmin' && u.isActive !== false);
      if (admin) return { user: admin };
    }

    // 3. Official @scb.sch.id username match
    if (cleanEmail.endsWith('@scb.sch.id')) {
      const prefix = cleanEmail.split('@')[0];
      const usernameMatch = userList.find(
        (u) => u.username && u.username.trim().toLowerCase() === prefix
      );
      if (usernameMatch) {
        if (usernameMatch.isActive === false) return { isDisabled: true };
        return { user: usernameMatch };
      }
    }

    return {};
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setErrorMessage('');

    try {
      const { profile } = await googleSignIn('auto', undefined, 'login');
      const googleEmail = (profile.email || '').trim().toLowerCase();

      if (!googleEmail) {
        setErrorMessage(
          'Email akun Google tidak terbaca. Pastikan Anda mengizinkan akses profil email saat login.'
        );
        return;
      }

      const { user: matchedUser, isDisabled } = matchRegisteredUser(googleEmail, users);

      if (matchedUser) {
        const loggedUser: User = profile.photoURL
          ? { ...matchedUser, photoURL: profile.photoURL }
          : matchedUser;
        onLoginSuccess(loggedUser);
        handleClose();
      } else if (isDisabled) {
        setErrorMessage(
          `Akun "${googleEmail}" berstatus nonaktif. Silakan hubungi Superadmin untuk mengaktifkan kembali akses Anda.`
        );
      } else {
        setErrorMessage(
          `Akses ditolak: Akun Google "${googleEmail}" belum terdaftar sebagai personil SIM-BERSIH SCB. Hubungi Superadmin untuk mendaftarkan email Anda.`
        );
      }
    } catch (err: any) {
      const rawMsg = err?.message || String(err || '');
      const code = err?.code || '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        rawMsg.toLowerCase().includes('dibatalkan') ||
        rawMsg.toLowerCase().includes('closed')
      ) {
        setErrorMessage('Proses login dibatalkan. Silakan klik tombol di bawah untuk mencoba lagi.');
      } else if (
        code === 'auth/popup-blocked' ||
        rawMsg.toLowerCase().includes('terblokir') ||
        rawMsg.toLowerCase().includes('popup')
      ) {
        setErrorMessage('Pop-up Google diblokir oleh browser. Mohon izinkan pop-up lalu coba kembali.');
      } else {
        setErrorMessage(rawMsg || 'Gagal terhubung ke Google. Pastikan koneksi internet aktif.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-5 text-white relative">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">SIM-BERSIH SCB</h3>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Sekolah Cendekia BAZNAS · Login Petugas &amp; Pengelola
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {promptReason && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">{promptReason}</p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 leading-relaxed">
                <p className="font-bold text-rose-900 mb-0.5">Login Tidak Dapat Dilanjutkan</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Google SSO Action */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 hover:border-emerald-500 rounded-xl font-semibold text-slate-800 text-sm shadow-2xs transition-all flex items-center justify-center gap-3 group cursor-pointer active:scale-[0.99] disabled:opacity-60"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                  <span>Memverifikasi akun Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon className="w-5 h-5 shrink-0" />
                  <span className="group-hover:text-emerald-900">Lanjutkan dengan Google</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all ml-auto" />
                </>
              )}
            </button>

            <p className="text-xs text-slate-500 text-center leading-relaxed">
              Masuk menggunakan email Google Anda yang sudah didaftarkan oleh pengelola SCB.
            </p>
          </div>

          {/* Security Note */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Autentikasi aman melalui Google SSO — hanya membaca email dan profil dasar akun Anda.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
