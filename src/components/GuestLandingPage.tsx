import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, PublicDailyNotificationSummary } from '../types';
import { getUsers, INITIAL_USERS } from '../utils/storage';
import {
  signInWithEmailPassword,
  checkAndCompleteEmailVerification,
  resendVerificationEmail,
  sendPasswordResetForIdentifier,
  parseFirebaseEmailAuthError,
  signOutFirebaseOnly,
} from '../services/firebaseAuth';
import {
  fetchUserByEmailFromCloud,
  fetchPublicDailyNotificationsForGuest,
  buildLocalPublicDailyNotifications,
} from '../services/firestoreSync';
import {
  Building2,
  CheckCircle2,
  RefreshCw,
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  ArrowRight,
  AlertCircle,
  MailCheck,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

interface GuestLandingPageProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
  isFirestoreQuotaLimited?: boolean;
  loginPromptNotice?: string;
}

export const GuestLandingPage: React.FC<GuestLandingPageProps> = ({
  users,
  onLoginSuccess,
  loginPromptNotice,
}) => {
  // Public daily summary metrics state (1-doc read + 10m cache)
  const [summary, setSummary] = useState<PublicDailyNotificationSummary>(() =>
    buildLocalPublicDailyNotifications()
  );

  // Embedded login state
  const [identifier, setIdentifier] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [infoMessage, setInfoMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSendingReset, setIsSendingReset] = useState<boolean>(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [isCheckingVerify, setIsCheckingVerify] = useState<boolean>(false);
  const [isResendingVerify, setIsResendingVerify] = useState<boolean>(false);

  const identifierInputRef = useRef<HTMLInputElement | null>(null);
  const loginSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublicDailyNotificationsForGuest(false)
      .then((res) => {
        if (active) {
          setSummary(res.summary);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const focusLoginForm = () => {
    loginSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      identifierInputRef.current?.focus();
    }, 220);
  };

  const getCandidatePool = useCallback((): User[] => {
    const storedUsers = getUsers();
    if (users && users.length > 0) return users;
    if (storedUsers && storedUsers.length > 0) return storedUsers;
    return INITIAL_USERS;
  }, [users]);

  const resolveAuthenticatedAppUser = useCallback(
    async (verifiedEmail: string, fallbackMatched?: User): Promise<User | null> => {
      const cleanEmail = verifiedEmail.trim().toLowerCase();
      const cloudUser = await fetchUserByEmailFromCloud(cleanEmail);
      if (cloudUser) return cloudUser;
      if (fallbackMatched) return fallbackMatched;

      const pool = getCandidatePool();
      return (
        pool.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail) ||
        INITIAL_USERS.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail) ||
        null
      );
    },
    [getCandidatePool]
  );

  const handleSubmitLogin = async (e: React.FormEvent) => {
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
            `Link verifikasi telah dikirim ke ${result.email}. Klik link di inbox/spam email Anda, lalu tekan "Saya Sudah Verifikasi".`
          );
        }
        return;
      }

      const appUser = await resolveAuthenticatedAppUser(result.email, result.matchedLocalUser);

      if (!appUser) {
        await signOutFirebaseOnly().catch(() => {});
        setErrorMessage(
          `Email "${result.email}" belum terdaftar di daftar personel SIM-BERSIH SCB. Hubungi Superadmin untuk pendaftaran akun.`
        );
        return;
      }

      if (appUser.isActive === false) {
        await signOutFirebaseOnly().catch(() => {});
        setErrorMessage(
          `Akun "${appUser.name}" sedang berstatus nonaktif. Hubungi Superadmin SCB.`
        );
        return;
      }

      onLoginSuccess(appUser);
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
          `Email ${pendingVerifyEmail} belum terverifikasi. Klik link verifikasi di email Anda (cek juga folder Spam).`
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
      setErrorMessage(
        'Ketik Email atau Username Anda terlebih dahulu di kolom atas, lalu klik Lupa / Atur Kata Sandi.'
      );
      identifierInputRef.current?.focus();
      return;
    }

    setIsSendingReset(true);
    try {
      const sentEmail = await sendPasswordResetForIdentifier(cleanIdentifier, getCandidatePool());
      setInfoMessage(
        `Link atur / reset kata sandi telah dikirim ke ${sentEmail}. Buka email Anda (cek folder Spam bila perlu), lalu masuk kembali.`
      );
    } catch (err: any) {
      const parsed = parseFirebaseEmailAuthError(err);
      setErrorMessage(parsed.message);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar: Clean 3-Zone Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2.5"
          >
            <span className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </span>
            <span>SIM-BERSIH SCB</span>
          </a>

          <nav
            aria-label="Navigasi Pengunjung"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#ringkasan"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Ringkasan Hari Ini
            </a>
            <a
              href="#login-panel"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Akses Akun
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={focusLoginForm}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Masuk Sistem
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 flex flex-col bg-white">
        {/* Hero Split: Value Proposition + Embedded Login Panel */}
        <section className="flex-1 flex items-center bg-white">
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
              {/* Left Column: Proposition & Today's Compact Summary */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
                <div className="space-y-4">
                  <p className="text-xs font-semibold tracking-wide text-emerald-700">
                    Sekolah Cendekia BAZNAS · Divisi Sarana, Prasarana &amp; Kebersihan
                  </p>
                  <h1 className="text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold tracking-tight text-slate-900 leading-[1.14] text-balance max-w-2xl">
                    Notifikasi Pelaporan Kebersihan Harian Kamar Mandi
                  </h1>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                    Pengunjung tanpa login dapat memantau notifikasi laporan kebersihan hari ini secara ringkas agar penggunaan kuota server tetap hemat. Untuk mengisi laporan, melihat foto bukti, atau verifikasi, silakan masuk menggunakan akun resmi Anda.
                  </p>
                </div>

                {/* Compact Daily Summary Strip (3 Metrics, Tabular Numerals) */}
                <div
                  id="ringkasan"
                  className="grid grid-cols-3 border border-slate-200 rounded-xl bg-slate-50/70 divide-x divide-slate-200"
                >
                  <div className="p-4 sm:p-5">
                    <p className="text-xs font-medium text-slate-500">Target Terjadwal</p>
                    <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
                      {summary.totalScheduledToday}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Area hari ini</p>
                  </div>
                  <div className="p-4 sm:p-5">
                    <p className="text-xs font-medium text-slate-500">Sudah Dilaporkan</p>
                    <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono tabular-nums">
                      {summary.reportedAreaCount}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Laporan masuk</p>
                  </div>
                  <div className="p-4 sm:p-5">
                    <p className="text-xs font-medium text-slate-500">Belum Dilaporkan</p>
                    <p
                      className={`mt-1 text-2xl sm:text-3xl font-extrabold font-mono tabular-nums ${
                        summary.pendingAreas.length > 0 ? 'text-amber-700' : 'text-slate-700'
                      }`}
                    >
                      {summary.pendingAreas.length}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Area menunggu</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Integrated Login Form */}
              <div
                id="login-panel"
                ref={loginSectionRef}
                className="lg:col-span-5 flex flex-col justify-center"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 bg-emerald-800 text-white flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold leading-tight">Masuk Akun Personel</h2>
                      <p className="text-xs text-emerald-100 mt-0.5">
                        Petugas CS, Supervisor &amp; Superadmin
                      </p>
                    </div>
                    <Lock className="w-5 h-5 text-emerald-200 shrink-0" />
                  </div>

                  {pendingVerifyEmail ? (
                    <div className="p-5 sm:p-6 space-y-4">
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                          <MailCheck className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Verifikasi Email Diperlukan (1 Kali Saja)</span>
                        </div>
                        <p className="text-xs text-amber-900 leading-relaxed">
                          Klik link verifikasi yang dikirim ke{' '}
                          <strong className="font-mono">{pendingVerifyEmail}</strong>, lalu tekan
                          tombol konfirmasi di bawah.
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
                          className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>
                            {isCheckingVerify
                              ? 'Memeriksa Verifikasi...'
                              : 'Saya Sudah Verifikasi, Masuk'}
                          </span>
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={isResendingVerify}
                            onClick={handleResendVerification}
                            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${isResendingVerify ? 'animate-spin' : ''}`}
                            />
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
                            className="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                          >
                            Ganti Akun
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitLogin} className="p-5 sm:p-6 space-y-4">
                      {loginPromptNotice && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                          {loginPromptNotice}
                        </div>
                      )}

                      {infoMessage && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                          <p className="leading-relaxed">{infoMessage}</p>
                        </div>
                      )}

                      {errorMessage && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                          <p className="leading-relaxed">{errorMessage}</p>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label
                          htmlFor="landing-login-identifier"
                          className="block text-xs font-bold text-slate-700"
                        >
                          Email atau Username Terdaftar
                        </label>
                        <div className="relative">
                          <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            ref={identifierInputRef}
                            id="landing-login-identifier"
                            type="text"
                            autoComplete="username"
                            placeholder="Contoh: operasional.scb@gmail.com"
                            value={identifier}
                            onChange={(e) => {
                              setIdentifier(e.target.value);
                              if (errorMessage) setErrorMessage('');
                            }}
                            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-colors"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor="landing-login-secret"
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
                            id="landing-login-secret"
                            type={showSecret ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder="Masukkan kata sandi"
                            value={secret}
                            onChange={(e) => {
                              setSecret(e.target.value);
                              if (errorMessage) setErrorMessage('');
                            }}
                            className="w-full pl-10 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecret((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                            title={showSecret ? 'Sembunyikan Sandi' : 'Tampilkan Sandi'}
                          >
                            {showSecret ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        <LogIn className="w-4 h-4 shrink-0" />
                        <span>{isSubmitting ? 'Memeriksa Akun...' : 'Masuk ke Dashboard'}</span>
                        <ArrowRight className="w-4 h-4 shrink-0 ml-auto" />
                      </button>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">
                          Belum punya akun? Pendaftaran akun baru menggunakan Email &amp; Kata Sandi dikelola oleh <strong>Superadmin</strong> (<span className="font-mono">operasional.scb@gmail.com</span>).
                        </p>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="bg-white border-t border-slate-200 py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <p>
            SIM-BERSIH SCB · Sekolah Cendekia BAZNAS
          </p>
          <p>
            Akses dashboard lengkap, foto bukti &amp; ekspor data tersedia setelah login personel.
          </p>
        </div>
      </footer>
    </div>
  );
};
