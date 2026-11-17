import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';
import { getUsers, INITIAL_USERS } from '../utils/storage';
import {
  Building2,
  ShieldCheck,
  X,
  AlertCircle,
  ArrowRight,
  Info,
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  LogIn,
} from 'lucide-react';

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
  const [identifier, setIdentifier] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const identifierInputRef = useRef<HTMLInputElement | null>(null);

  const handleClose = useCallback(() => {
    setIdentifier('');
    setSecret('');
    setShowSecret(false);
    setErrorMessage('');
    setIsSubmitting(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage('');
    setSecret('');
    setShowSecret(false);
    setIsSubmitting(false);

    const focusTimer = setTimeout(() => {
      identifierInputRef.current?.focus();
    }, 60);

    return () => clearTimeout(focusTimer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanSecret = secret.trim();

    if (!cleanIdentifier) {
      setErrorMessage('Masukkan Username atau Email akun Anda.');
      return;
    }
    if (!cleanSecret) {
      setErrorMessage('Masukkan Kata Sandi atau PIN akun Anda.');
      return;
    }

    setIsSubmitting(true);
    try {
      const storedUsers = getUsers();
      const candidatePool =
        users && users.length > 0
          ? users
          : storedUsers && storedUsers.length > 0
          ? storedUsers
          : INITIAL_USERS;

      const matched = candidatePool.find((u) => {
        const uName = (u.username || '').trim().toLowerCase();
        const uEmail = (u.email || '').trim().toLowerCase();
        return uName === cleanIdentifier || uEmail === cleanIdentifier;
      });

      if (!matched) {
        setErrorMessage(
          `Akun "${identifier.trim()}" tidak ditemukan. Periksa kembali Username atau Email yang terdaftar.`
        );
        return;
      }

      if (matched.isActive === false) {
        setErrorMessage(
          `Akun "${matched.name}" sedang berstatus nonaktif. Hubungi Superadmin SCB untuk mengaktifkan kembali akses Anda.`
        );
        return;
      }

      const expectedPassword = (matched.password || '123456').trim();
      const expectedPin = (matched.pin || '').trim();
      const isPasswordValid = cleanSecret === expectedPassword;
      const isPinValid = Boolean(expectedPin) && cleanSecret === expectedPin;

      if (!isPasswordValid && !isPinValid) {
        setErrorMessage('Kata sandi atau PIN tidak sesuai. Silakan periksa kembali.');
        return;
      }

      onLoginSuccess(matched);
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-5 text-white relative">
          <button
            type="button"
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
                Sekolah Cendekia BAZNAS · Login Akun Manual
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {promptReason && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">{promptReason}</p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 leading-relaxed">
                <p className="font-bold text-rose-900 mb-0.5">Gagal Masuk</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Username / Email Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="login-identifier"
              className="block text-xs font-bold text-slate-700"
            >
              Username atau Email Terdaftar
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={identifierInputRef}
                id="login-identifier"
                type="text"
                autoComplete="username"
                placeholder="Contoh: operasional.scb atau iday"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Password / PIN Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="login-secret"
              className="block text-xs font-bold text-slate-700"
            >
              Kata Sandi atau PIN
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-secret"
                type={showSecret ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Masukkan kata sandi atau PIN"
                value={secret}
                onChange={(e) => {
                  setSecret(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                className="w-full pl-10 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowSecret((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                title={showSecret ? 'Sembunyikan Sandi' : 'Tampilkan Sandi'}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <LogIn className="w-4 h-4 shrink-0" />
            <span>{isSubmitting ? 'Memeriksa Akun...' : 'Masuk ke Sistem'}</span>
            <ArrowRight className="w-4 h-4 shrink-0 ml-auto" />
          </button>

          {/* Security Note */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Login menggunakan akun internal yang tersimpan di sistem tanpa pop-up Google. Hubungi Superadmin SCB jika lupa kata sandi atau memerlukan akun baru.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
