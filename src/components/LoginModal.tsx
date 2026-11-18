import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';
import { getUsers, INITIAL_USERS } from '../utils/storage';
import {
  signInWithEmailPassword,
  checkAndCompleteEmailVerification,
  resendVerificationEmail,
  sendPasswordResetForIdentifier,
  parseFirebaseEmailAuthError,
  signOutFirebaseOnly,
} from '../services/firebaseAuth';
import { fetchUserByEmailFromCloud } from '../services/firestoreSync';
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
  MailCheck,
  RefreshCw,
  CheckCircle2,
  KeyRound,
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
  const [infoMessage, setInfoMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSendingReset, setIsSendingReset] = useState<boolean>(false);

  // One-time email verification state
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [isCheckingVerify, setIsCheckingVerify] = useState<boolean>(false);
  const [isResendingVerify, setIsResendingVerify] = useState<boolean>(false);

  const identifierInputRef = useRef<HTMLInputElement | null>(null);

  const getCandidatePool = useCallback((): User[] => {
    const storedUsers = getUsers();
    if (users && users.length > 0) return users;
    if (storedUsers && storedUsers.length > 0) return storedUsers;
    return INITIAL_USERS;
  }, [users]);

  const resolveAuthenticatedAppUser = useCallback(
    async (verifiedEmail: string, fallbackMatched?: User): Promise<User | null> => {
      const cleanEmail = verifiedEmail.trim().toLowerCase();

      // 1. Fetch freshest record directly from Cloud Firestore (works even on brand-new devices!)
      const cloudUser = await fetchUserByEmailFromCloud(cleanEmail);
      if (cloudUser) {
        return cloudUser;
      }

      // 2. Fallback to known local/official roster
      if (fallbackMatched) return fallbackMatched;

      const pool = getCandidatePool();
      const localMatch =
        pool.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail) ||
        INITIAL_USERS.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail);

      return localMatch || null;
    },
    [getCandidatePool]
  );

  const handleClose = useCallback(() => {
    setIdentifier('');
    setSecret('');
    setShowSecret(false);
    setErrorMessage('');
    setInfoMessage('');
    setIsSubmitting(false);
    setIsSendingReset(false);
    setPendingVerifyEmail(null);
    setIsCheckingVerify(false);
    setIsResendingVerify(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage('');
    setInfoMessage('');
    setSecret('');
    setShowSecret(false);
    setIsSubmitting(false);
    setPendingVerifyEmail(null);

    const focusTimer = setTimeout(() => {
      identifierInputRef.current?.focus();
    }, 60);

    return () => clearTimeout(focusTimer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    const cleanIdentifier = identifier.trim();
    const cleanSecret = secret.trim();

    if (!cleanIdentifier) {
      setErrorMessage('Masukkan Email atau Username akun Anda.');
      return;
    }
    if (!cleanSecret) {
      setErrorMessage('Masukkan Kata Sandi akun Anda.');
      return;
    }

    setIsSubmitting(true);
    try {
      const pool = getCandidatePool();
      const result = await signInWithEmailPassword(cleanIdentifier, cleanSecret, pool);

      if (result.status === 'needs_verification') {
        setPendingVerifyEmail(result.email);
        if (result.verificationSent) {
          setInfoMessage(
            `Link verifikasi telah dikirim ke ${result.email}. Klik link di kotak masuk/spam email Anda, lalu tekan "Saya Sudah Verifikasi".`
          );
        }
        return;
      }

      const appUser = await resolveAuthenticatedAppUser(result.email, result.matchedLocalUser);

      if (!appUser) {
        await signOutFirebaseOnly().catch(() => {});
        setErrorMessage(
          `Email "${result.email}" belum terdaftar di daftar personel SIM-BERSIH SCB. Minta Superadmin menambahkan akun Anda di menu Kelola Akun.`
        );
        return;
      }

      if (appUser.isActive === false) {
        await signOutFirebaseOnly().catch(() => {});
        setErrorMessage(
          `Akun "${appUser.name}" sedang berstatus nonaktif. Hubungi Superadmin SCB untuk mengaktifkan kembali akses Anda.`
        );
        return;
      }

      onLoginSuccess(appUser);
      handleClose();
    } catch (err: any) {
      const parsed = parseFirebaseEmailAuthError(err);
      setErrorMessage(parsed.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!pendingVerifyEmail) return;
    setErrorMessage('');
    setInfoMessage('');
    setIsCheckingVerify(true);

    try {
      const { verified, firebaseUser } = await checkAndCompleteEmailVerification();
      if (!verified || !firebaseUser?.email) {
        setErrorMessage(
          `Email ${pendingVerifyEmail} belum terverifikasi. Pastikan Anda sudah membuka dan mengklik link verifikasi di email Anda (cek juga folder Spam).`
        );
        return;
      }

      const appUser = await resolveAuthenticatedAppUser(firebaseUser.email);
      if (!appUser) {
        await signOutFirebaseOnly().catch(() => {});
        setErrorMessage(
          `Email ${firebaseUser.email} belum terdaftar di daftar personel SIM-BERSIH SCB.`
        );
        return;
      }

      if (appUser.isActive === false) {
        await signOutFirebaseOnly().catch(() => {});
        setErrorMessage(`Akun "${appUser.name}" sedang berstatus nonaktif.`);
        return;
      }

      onLoginSuccess(appUser);
      handleClose();
    } catch (err: any) {
      const parsed = parseFirebaseEmailAuthError(err);
      setErrorMessage(parsed.message);
    } finally {
      setIsCheckingVerify(false);
    }
  };

  const handleResendVerification = async () => {
    setErrorMessage('');
    setInfoMessage('');
    setIsResendingVerify(true);
    try {
      await resendVerificationEmail();
      setInfoMessage(`Link verifikasi baru telah dikirim ke ${pendingVerifyEmail}.`);
    } catch (err: any) {
      const parsed = parseFirebaseEmailAuthError(err);
      setErrorMessage(parsed.message);
    } finally {
      setIsResendingVerify(false);
    }
  };

  const handleSendPasswordReset = async () => {
    setErrorMessage('');
    setInfoMessage('');

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage('Ketik Email atau Username Anda terlebih dahulu di kolom atas, lalu klik Atur / Lupa Kata Sandi.');
      identifierInputRef.current?.focus();
      return;
    }

    setIsSendingReset(true);
    try {
      const sentEmail = await sendPasswordResetForIdentifier(cleanIdentifier, getCandidatePool());
      setInfoMessage(
        `Link atur / reset kata sandi telah dikirim ke ${sentEmail}. Buka email Anda (cek folder Spam bila perlu), buat kata sandi baru minimal 6 karakter, lalu masuk kembali di sini.`
      );
    } catch (err: any) {
      const parsed = parseFirebaseEmailAuthError(err);
      setErrorMessage(parsed.message);
    } finally {
      setIsSendingReset(false);
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
                Sekolah Cendekia BAZNAS · Login Cloud Terintegrasi
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        {pendingVerifyEmail ? (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                <MailCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Verifikasi Email Diperlukan (1 Kali Saja)</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Agar akun <strong className="font-mono">{pendingVerifyEmail}</strong> terhubung ke database Cloud secara aman, klik link verifikasi yang dikirim ke kotak masuk email Anda.
              </p>
            </div>

            {infoMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{infoMessage}</p>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isCheckingVerify}
                onClick={handleCheckVerification}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{isCheckingVerify ? 'Memeriksa Verifikasi...' : 'Saya Sudah Verifikasi, Masuk Sekarang'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isResendingVerify}
                  onClick={handleResendVerification}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResendingVerify ? 'animate-spin' : ''}`} />
                  <span>Kirim Ulang Link</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await signOutFirebaseOnly().catch(() => {});
                    setPendingVerifyEmail(null);
                    setErrorMessage('');
                    setInfoMessage('');
                  }}
                  className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Ganti Akun
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            {promptReason && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{promptReason}</p>
              </div>
            )}

            {infoMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <div className="flex-1 leading-relaxed">
                  <p className="font-bold text-emerald-950 mb-0.5">Email Terkirim</p>
                  <p>{infoMessage}</p>
                </div>
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

            {/* Email / Username Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-identifier"
                className="block text-xs font-bold text-slate-700"
              >
                Email atau Username Terdaftar
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={identifierInputRef}
                  id="login-identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="Contoh: operasional.scb@gmail.com atau iday"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Pada perangkat baru, gunakan alamat Email lengkap Anda.
              </p>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-secret"
                  className="block text-xs font-bold text-slate-700"
                >
                  Kata Sandi
                </label>
                <button
                  type="button"
                  disabled={isSendingReset}
                  onClick={handleSendPasswordReset}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>{isSendingReset ? 'Mengirim...' : 'Lupa / Atur Kata Sandi?'}</span>
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-secret"
                  type={showSecret ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi (min. 6 karakter)"
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
              <span>{isSubmitting ? 'Menghubungkan Cloud...' : 'Masuk ke Sistem'}</span>
              <ArrowRight className="w-4 h-4 shrink-0 ml-auto" />
            </button>

            {/* Security Note */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Login langsung memakai Email &amp; Kata Sandi tanpa pop-up Google. Data akun, jadwal, dan laporan tersinkron otomatis ke Cloud antar perangkat.
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
