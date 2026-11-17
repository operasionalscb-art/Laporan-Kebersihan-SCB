import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';
import {
  Building2,
  ShieldCheck,
  X,
  AlertCircle,
  ArrowRight,
  Loader2,
  Info,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import {
  googleSignIn,
  GoogleUserProfile,
  ensureGISScriptLoaded,
  renderGoogleFedCMButton,
  signInWithRedirectFirebase,
  isEmbeddedIframe,
  getExistingFirebaseProfile,
  getDiagnosticInfo,
} from '../services/googleAuth';
import { fetchUserByEmailFromCloud } from '../services/firestoreSync';

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
  const [isRedirectLoading, setIsRedirectLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string>('');
  const [isPopupBlocked, setIsPopupBlocked] = useState<boolean>(false);
  const [isDomainError, setIsDomainError] = useState<boolean>(false);
  const [fedcmReady, setFedcmReady] = useState<boolean>(false);
  const [activeGoogleSession, setActiveGoogleSession] = useState<GoogleUserProfile | null>(null);

  const fedcmContainerRef = useRef<HTMLDivElement | null>(null);
  const inIframe = isEmbeddedIframe();
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const diag = getDiagnosticInfo();

  const matchRegisteredUser = useCallback(
    (email: string, userList: User[]): { user?: User; isDisabled?: boolean } => {
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
    },
    []
  );

  const handleClose = useCallback(() => {
    setErrorMessage('');
    setErrorCode('');
    setIsGoogleLoading(false);
    setIsRedirectLoading(false);
    setIsPopupBlocked(false);
    setIsDomainError(false);
    onClose();
  }, [onClose]);

  const completeProfileLogin = useCallback(
    async (profile: GoogleUserProfile) => {
      const googleEmail = (profile.email || '').trim().toLowerCase();

      if (!googleEmail) {
        setErrorMessage(
          'Email akun Google tidak terbaca. Pastikan Anda mengizinkan akses profil email saat login.'
        );
        return;
      }

      let { user: matchedUser, isDisabled } = matchRegisteredUser(googleEmail, users);

      // Fallback: check Firestore for freshly provisioned account matching this verified email
      if (!matchedUser && !isDisabled) {
        try {
          const cloudUser = await fetchUserByEmailFromCloud(googleEmail);
          if (cloudUser) {
            if (cloudUser.isActive === false) {
              isDisabled = true;
            } else {
              matchedUser = cloudUser;
            }
          }
        } catch {
          // Structured error already logged by handleFirestoreError if lookup failed
        }
      }

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
    },
    [users, matchRegisteredUser, onLoginSuccess, handleClose]
  );

  // Keep ref to latest completeProfileLogin so useEffect ONLY runs when isOpen flips
  const completeProfileLoginRef = useRef(completeProfileLogin);
  useEffect(() => {
    completeProfileLoginRef.current = completeProfileLogin;
  }, [completeProfileLogin]);

  useEffect(() => {
    if (!isOpen) return;

    setIsGoogleLoading(false);
    setIsRedirectLoading(false);
    setErrorMessage('');
    setErrorCode('');
    setIsPopupBlocked(false);
    setIsDomainError(false);
    setFedcmReady(false);
    setActiveGoogleSession(getExistingFirebaseProfile());

    let cancelled = false;
    ensureGISScriptLoaded()
      .then(async () => {
        if (cancelled || !fedcmContainerRef.current) return;
        const rendered = await renderGoogleFedCMButton(
          fedcmContainerRef.current,
          async (profile) => {
            if (cancelled) return;
            setIsGoogleLoading(true);
            setErrorMessage('');
            setErrorCode('');
            try {
              await completeProfileLoginRef.current(profile);
            } finally {
              if (!cancelled) setIsGoogleLoading(false);
            }
          },
          (err) => {
            if (cancelled) return;
            setErrorMessage(err?.message || 'Gagal autentikasi via tombol Google.');
          }
        );
        if (!cancelled) {
          setFedcmReady(rendered);
        }
      })
      .catch(() => {
        if (!cancelled) setFedcmReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuthException = (err: any) => {
    const rawMsg = err?.message || String(err || '');
    const code = err?.code || '';
    setErrorCode(code);

    if (code === 'auth/unauthorized-domain' || err?.isDomainError) {
      setIsDomainError(true);
      setIsPopupBlocked(false);
      setErrorMessage(
        `Domain "${diag.currentOrigin || diag.currentHostname}" belum terdaftar di Authorized Domains Firebase Console.`
      );
      return;
    }

    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      rawMsg.toLowerCase().includes('dibatalkan')
    ) {
      setIsPopupBlocked(false);
      setErrorMessage('Proses login dibatalkan. Silakan klik tombol di bawah untuk mencoba lagi.');
      return;
    }

    if (
      code === 'auth/popup-blocked' ||
      rawMsg.toLowerCase().includes('terblokir') ||
      rawMsg.toLowerCase().includes('diblokir')
    ) {
      setIsPopupBlocked(true);
      setErrorMessage(
        'Pop-up Google diblokir oleh browser Anda. Gunakan salah satu opsi masuk tanpa pop-up di bawah ini atau izinkan pop-up pada address bar browser.'
      );
      return;
    }

    setErrorMessage(rawMsg || 'Gagal terhubung ke Google. Pastikan koneksi internet aktif.');
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setErrorMessage('');
    setErrorCode('');
    setIsPopupBlocked(false);
    setIsDomainError(false);

    try {
      const { profile } = await googleSignIn('auto', undefined, 'login');
      await completeProfileLogin(profile);
    } catch (err: any) {
      handleAuthException(err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDirectGISLogin = async () => {
    setIsGoogleLoading(true);
    setErrorMessage('');
    setErrorCode('');
    setIsPopupBlocked(false);

    try {
      const { profile } = await googleSignIn('gis', undefined, 'login');
      await completeProfileLogin(profile);
    } catch (err: any) {
      handleAuthException(err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleContinueExistingSession = async () => {
    if (!activeGoogleSession) return;
    setIsGoogleLoading(true);
    setErrorMessage('');
    try {
      await completeProfileLogin(activeGoogleSession);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleRedirectLogin = async () => {
    setIsRedirectLoading(true);
    setErrorMessage('');
    setErrorCode('');
    try {
      await signInWithRedirectFirebase('login');
    } catch (err: any) {
      setIsRedirectLoading(false);
      handleAuthException(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative max-h-[92vh] overflow-y-auto">
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

          {/* Active Firebase session shortcut (no popup required) */}
          {activeGoogleSession?.email && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Sesi Google Aktif Terdeteksi</span>
              </div>
              <button
                type="button"
                onClick={handleContinueExistingSession}
                disabled={isGoogleLoading}
                className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                <span className="truncate">Masuk sebagai {activeGoogleSession.email}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 leading-relaxed">
                  <p className="font-bold text-rose-900 mb-0.5">
                    {isPopupBlocked
                      ? 'Pop-up Login Diblokir Browser'
                      : isDomainError
                      ? 'Domain Belum Terdaftar di Firebase'
                      : 'Login Tidak Dapat Dilanjutkan'}
                  </p>
                  <p>{errorMessage}</p>
                  {errorCode && (
                    <p className="text-[10px] text-rose-600/80 font-mono mt-1">
                      Kode: {errorCode}
                    </p>
                  )}
                </div>
              </div>

              {isDomainError && (
                <div className="pt-2 border-t border-rose-200/80 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleDirectGISLogin}
                    disabled={isGoogleLoading}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    <GoogleIcon className="w-3.5 h-3.5 bg-white rounded-full p-0.5" />
                    <span>Masuk via Google Direct</span>
                  </button>
                  <a
                    href={diag.firebaseConsoleSettingsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-rose-300 hover:bg-rose-100/60 text-rose-900 rounded-lg font-semibold text-[11px] transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Buka Settings Firebase</span>
                  </a>
                </div>
              )}

              {isPopupBlocked && (
                <div className="pt-2 border-t border-rose-200/80 space-y-2">
                  <p className="text-[11px] font-semibold text-rose-900">
                    Solusi cepat untuk Admin &amp; Pengelola:
                  </p>
                  <ul className="text-[11px] text-rose-800 space-y-1 list-disc pl-4 leading-relaxed">
                    {inIframe ? (
                      <li>
                        Anda sedang membuka preview di dalam bingkai (iframe). Klik{' '}
                        <strong>Buka di Tab Baru</strong> di bawah agar login Google tidak terblokir.
                      </li>
                    ) : (
                      <li>
                        Gunakan tombol <strong>Masuk via Pengalihan Halaman</strong> di bawah (tanpa pop-up sama sekali).
                      </li>
                    )}
                    <li>
                      Atau klik ikon <strong>Pop-up Diblokir</strong> di ujung kanan address bar browser lalu pilih{' '}
                      <strong>Selalu izinkan pop-up</strong>.
                    </li>
                  </ul>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    {inIframe ? (
                      <a
                        href={currentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-semibold text-[11px] transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka di Tab Baru (Anti Blokir)</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRedirectLogin}
                        disabled={isRedirectLoading}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {isRedirectLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        <span>Masuk via Pengalihan Halaman</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isGoogleLoading}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-rose-300 hover:bg-rose-100/60 text-rose-900 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Coba Pop-up Lagi</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Primary Google SSO Action */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || isRedirectLoading}
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

            {/* Official FedCM / Embedded Google Button container (rendered visibly off-layout only when ready) */}
            <div className={fedcmReady ? 'space-y-2' : 'h-0 overflow-hidden opacity-0 pointer-events-none'}>
              {fedcmReady && (
                <div className="relative flex items-center py-0.5">
                  <div className="grow border-t border-slate-200" />
                  <span className="shrink mx-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    atau tanpa pop-up
                  </span>
                  <div className="grow border-t border-slate-200" />
                </div>
              )}
              <div
                ref={fedcmContainerRef}
                className="flex justify-center min-h-[42px] overflow-hidden"
              />
            </div>

            {!isPopupBlocked && (
              <div className="flex flex-col items-center gap-1.5 pt-0.5">
                {inIframe ? (
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Pop-up terblokir di preview? Buka di tab baru untuk login</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handleRedirectLogin}
                    disabled={isGoogleLoading || isRedirectLoading}
                    className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 underline underline-offset-2 cursor-pointer disabled:opacity-50"
                  >
                    {isRedirectLoading
                      ? 'Mengalihkan ke Google...'
                      : 'Pop-up terblokir? Masuk via pengalihan halaman'}
                  </button>
                )}
              </div>
            )}

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
