import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut as firebaseSignOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import rawConfig from '../../firebase-applet-config.json';

export interface GoogleUserProfile {
  email: string;
  displayName: string;
  photoURL?: string;
  authMethod: 'firebase' | 'gis';
}

// Non-sensitive identity scopes for User Login SSO (avoids sensitive/restricted Drive warnings)
export const LOGIN_SCOPES = [
  'openid',
  'email',
  'profile',
];

// App-created file scope for Google Drive Backup feature (avoids restricted full-drive scope)
export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'email',
  'profile',
];

export const SCOPES = DRIVE_SCOPES;

export type AuthScopeMode = 'login' | 'drive';

const STORAGE_ACCESS_TOKEN_KEY = 'scb_gdrive_access_token';
const STORAGE_PROFILE_KEY = 'scb_gdrive_profile';
const STORAGE_EXPIRY_KEY = 'scb_gdrive_token_expiry';
export const STORAGE_KEEP_CONNECTED_KEY = 'scb_gdrive_keep_connected';

export const firebaseConfig = {
  apiKey: (rawConfig as any)?.apiKey || '',
  authDomain: (rawConfig as any)?.authDomain || '',
  projectId: (rawConfig as any)?.projectId || 'gen-lang-client-0457083120',
  storageBucket: (rawConfig as any)?.storageBucket || '',
  messagingSenderId: (rawConfig as any)?.messagingSenderId || '',
  appId: (rawConfig as any)?.appId || '',
  oAuthClientId: (rawConfig as any)?.oAuthClientId || '794504611984-mdpandmt1r8vl85anr79ct8m66ml5941.apps.googleusercontent.com',
};

export function getActiveOAuthClientId(): string {
  try {
    const custom = localStorage.getItem('scb_custom_oauth_client_id');
    if (custom && custom.trim()) return custom.trim();
  } catch {}
  return firebaseConfig.oAuthClientId;
}

export function setActiveOAuthClientId(clientId: string): void {
  try {
    if (clientId && clientId.trim()) {
      localStorage.setItem('scb_custom_oauth_client_id', clientId.trim());
    } else {
      localStorage.removeItem('scb_custom_oauth_client_id');
    }
  } catch {}
}

// Initialize Firebase App safely
let authInstance: ReturnType<typeof getAuth> | null = null;
try {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  authInstance = getAuth(app);
} catch (e) {
  console.error('Failed to initialize Firebase Auth:', e);
}

export const auth = authInstance;

const loginProvider = new GoogleAuthProvider();
loginProvider.setCustomParameters({ prompt: 'select_account' });

const driveProvider = new GoogleAuthProvider();
DRIVE_SCOPES.forEach((scope) => driveProvider.addScope(scope));
driveProvider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let currentProfile: GoogleUserProfile | null = null;

/**
 * Checks if the Google Drive connection is retained and remembered
 */
export function isGoogleDriveLinked(): boolean {
  try {
    const keep = localStorage.getItem(STORAGE_KEEP_CONNECTED_KEY);
    if (keep === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

/**
 * Persists or updates the Google Drive connection retention flag
 */
export function setGoogleDriveLinked(linked: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEEP_CONNECTED_KEY, String(linked));
  } catch {}
}

/**
 * Storage helpers to persist authentication across page refreshes
 */
export function getSavedToken(): string | null {
  try {
    const token = localStorage.getItem(STORAGE_ACCESS_TOKEN_KEY);
    const expiryStr = localStorage.getItem(STORAGE_EXPIRY_KEY);
    if (!token) return null;
    if (expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      if (Date.now() > expiry) {
        // Clear only expired token, KEEP the linked profile and status!
        localStorage.removeItem(STORAGE_ACCESS_TOKEN_KEY);
        cachedAccessToken = null;
        return null;
      }
    }
    return token;
  } catch {
    return null;
  }
}

export function saveGoogleAuth(token: string, profile: GoogleUserProfile, expiresInSeconds = 3500) {
  cachedAccessToken = token;
  currentProfile = profile;
  try {
    localStorage.setItem(STORAGE_ACCESS_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000));
    localStorage.setItem(STORAGE_KEEP_CONNECTED_KEY, 'true');
  } catch (e) {
    console.warn('Could not persist Google auth:', e);
  }
}

export function clearStoredGoogleAuth() {
  cachedAccessToken = null;
  currentProfile = null;
  try {
    localStorage.removeItem(STORAGE_ACCESS_TOKEN_KEY);
    localStorage.removeItem(STORAGE_PROFILE_KEY);
    localStorage.removeItem(STORAGE_EXPIRY_KEY);
    localStorage.removeItem(STORAGE_KEEP_CONNECTED_KEY);
  } catch {}
}

export const getDiagnosticInfo = () => {
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isVercel = currentHostname.includes('vercel.app');
  const isLocalhost = currentHostname === 'localhost' || currentHostname === '127.0.0.1';

  return {
    currentHostname,
    currentOrigin,
    isVercel,
    isLocalhost,
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    oAuthClientId: firebaseConfig.oAuthClientId,
    firebaseConsoleSettingsUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`,
    googleCloudCredentialsUrl: `https://console.cloud.google.com/apis/credentials?project=${firebaseConfig.projectId}`,
  };
};

/**
 * Parses Auth error into human-readable details
 */
export const parseAuthError = (error: any): { title: string; message: string; code: string; isDomainError: boolean; originUrl?: string } => {
  const code = error?.code || '';
  const rawMsg = error?.message || String(error);
  const { currentHostname, currentOrigin, projectId } = getDiagnosticInfo();

  if (
    code === 'auth/unauthorized-domain' || 
    rawMsg.includes('unauthorized-domain') || 
    rawMsg.includes('ORIGIN_MISMATCH') ||
    rawMsg.toLowerCase().includes('origin') ||
    rawMsg.toLowerCase().includes('idpiframe')
  ) {
    return {
      code: 'auth/unauthorized-domain',
      title: 'Domain Belum Diizinkan di Google Cloud / Firebase',
      message: `Domain "${currentOrigin || currentHostname}" belum didaftarkan di "Authorized JavaScript origins" Google Cloud Console atau "Authorized Domains" Firebase.`,
      isDomainError: true,
      originUrl: currentOrigin,
    };
  }

  if (code === 'auth/popup-blocked' || rawMsg.includes('popup')) {
    return {
      code: 'auth/popup-blocked',
      title: 'Jendela Pop-up Terblokir',
      message: 'Browser Anda memblokir jendela login Google. Silakan klik ikon izin pop-up di bilah URL browser Anda.',
      isDomainError: false,
    };
  }

  if (code === 'auth/popup-closed-by-user' || rawMsg.includes('closed') || rawMsg.includes('dibatalkan')) {
    return {
      code: 'auth/popup-closed-by-user',
      title: 'Login Dibatalkan',
      message: 'Jendela login ditutup sebelum proses autentikasi selesai.',
      isDomainError: false,
    };
  }

  return {
    code,
    title: 'Autentikasi Google',
    message: rawMsg || 'Gagal menghubungkan akun Google.',
    isDomainError: false,
  };
};

/**
 * Initializes Google Auth Listener with persistent session restoration
 */
export const initGoogleAuth = (
  onAuthSuccess?: (profile: GoogleUserProfile, token: string) => void,
  onAuthFailure?: () => void
) => {
  // 1. Immediately check persisted session from localStorage
  const savedToken = getSavedToken();
  const savedProfile = getCurrentGoogleProfile();

  if (savedToken && savedProfile) {
    cachedAccessToken = savedToken;
    currentProfile = savedProfile;
    if (onAuthSuccess) {
      onAuthSuccess(savedProfile, savedToken);
    }
  }

  // 2. Also listen for Firebase Auth state changes
  if (!auth) {
    if (!savedToken && onAuthFailure) onAuthFailure();
    return () => {};
  }

  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      const activeToken = cachedAccessToken || getSavedToken();
      if (activeToken) {
        currentProfile = {
          email: user.email || currentProfile?.email || '',
          displayName: user.displayName || user.email || currentProfile?.displayName || 'Akun Google',
          photoURL: user.photoURL || currentProfile?.photoURL,
          authMethod: 'firebase',
        };
        saveGoogleAuth(activeToken, currentProfile);
        if (onAuthSuccess) onAuthSuccess(currentProfile, activeToken);
      }
    } else {
      const activeToken = getSavedToken();
      if (!activeToken) {
        clearStoredGoogleAuth();
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

/**
 * Direct Google Identity Services (GIS) Token Client.
 * Works seamlessly in client-side SPA without requiring Firebase Authorized Domains.
 */
export const signInWithGIS = async (
  silent = false,
  emailHint?: string,
  scopeMode: AuthScopeMode = 'login'
): Promise<{ profile: GoogleUserProfile; accessToken: string }> => {
  const clientId = getActiveOAuthClientId();
  if (!clientId) {
    throw new Error('OAuth Client ID tidak ditemukan.');
  }

  // Ensure GIS script is loaded reliably without hanging
  if (typeof (window as any).google?.accounts?.oauth2 === 'undefined') {
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        clearInterval(pollId);
        reject(new Error('Waktu memuat layanan Google Sign-In habis. Periksa koneksi internet Anda.'));
      }, 10000);

      const pollId = setInterval(() => {
        if (typeof (window as any).google?.accounts?.oauth2 !== 'undefined') {
          clearInterval(pollId);
          clearTimeout(timeoutId);
          resolve();
        }
      }, 100);

      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener('load', () => {
          if (typeof (window as any).google?.accounts?.oauth2 !== 'undefined') {
            clearInterval(pollId);
            clearTimeout(timeoutId);
            resolve();
          }
        });
        existing.addEventListener('error', () => {
          clearInterval(pollId);
          clearTimeout(timeoutId);
          reject(new Error('Gagal memuat script Google Identity Services'));
        });
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          clearInterval(pollId);
          clearTimeout(timeoutId);
          resolve();
        };
        script.onerror = () => {
          clearInterval(pollId);
          clearTimeout(timeoutId);
          reject(new Error('Gagal memuat script Google Identity Services'));
        };
        document.head.appendChild(script);
      }
    });
  }

  const activeScopes = scopeMode === 'drive' ? DRIVE_SCOPES : LOGIN_SCOPES;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finishReject = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const finishResolve = (val: { profile: GoogleUserProfile; accessToken: string }) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    try {
      const google = (window as any).google;
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: activeScopes.join(' '),
        prompt: silent ? '' : 'select_account',
        error_callback: (err: any) => {
          const errType = err?.type || '';
          if (errType === 'popup_closed') {
            const e: any = new Error('Proses login Google dibatalkan.');
            e.code = 'auth/popup-closed-by-user';
            finishReject(e);
          } else if (errType === 'popup_failed_to_open') {
            const e: any = new Error('Jendela pop-up Google terblokir browser. Harap izinkan pop-up untuk situs ini.');
            e.code = 'auth/popup-blocked';
            finishReject(e);
          } else {
            finishReject(new Error(err?.message || 'Gagal membuka jendela login Google.'));
          }
        },
        callback: async (response: any) => {
          if (response.error) {
            if (response.error === 'immediate_failed') {
              finishReject(new Error('Sesi Google memerlukan otorisasi manual. Silakan klik tombol Masuk dengan Akun Google.'));
            } else if (response.error === 'access_denied') {
              const e: any = new Error('Izin login Google ditolak oleh pengguna.');
              e.code = 'auth/popup-closed-by-user';
              finishReject(e);
            } else {
              finishReject(new Error(response.error_description || response.error));
            }
            return;
          }

          if (!response.access_token) {
            finishReject(new Error('Tidak ada access token yang diterima dari Google.'));
            return;
          }

          const accessToken = response.access_token;
          const expiresIn = response.expires_in ? parseInt(response.expires_in, 10) : 3500;

          let profile: GoogleUserProfile = {
            email: emailHint || '',
            displayName: '',
            authMethod: 'gis',
          };

          try {
            const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (userinfoRes.ok) {
              const userinfo = await userinfoRes.json();
              profile = {
                email: userinfo.email || profile.email,
                displayName: userinfo.name || userinfo.email || profile.displayName,
                photoURL: userinfo.picture || profile.photoURL,
                authMethod: 'gis',
              };
            }
          } catch {
            try {
              const v2Res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (v2Res.ok) {
                const v2info = await v2Res.json();
                profile = {
                  email: v2info.email || profile.email,
                  displayName: v2info.name || v2info.email || profile.displayName,
                  photoURL: v2info.picture || profile.photoURL,
                  authMethod: 'gis',
                };
              }
            } catch {}
          }

          if (profile.email && scopeMode === 'drive') {
            saveGoogleAuth(accessToken, profile, expiresIn);
          }
          finishResolve({ profile, accessToken });
        },
      });

      const tokenRequestOptions: any = {
        prompt: silent ? '' : 'select_account',
      };
      if (emailHint && emailHint.trim()) {
        tokenRequestOptions.hint = emailHint.trim();
      }

      client.requestAccessToken(tokenRequestOptions);
    } catch (err: any) {
      finishReject(err instanceof Error ? err : new Error(String(err)));
    }
  });
};

/**
 * Sign in using Firebase Auth with GoogleAuthProvider
 */
export const signInWithFirebase = async (
  scopeMode: AuthScopeMode = 'login',
  emailHint?: string
): Promise<{ profile: GoogleUserProfile; accessToken: string }> => {
  if (!auth) {
    throw new Error('Firebase Auth instance is not initialized.');
  }

  try {
    isSigningIn = true;
    const selectedProvider = scopeMode === 'drive' ? driveProvider : loginProvider;
    if (emailHint && emailHint.trim()) {
      selectedProvider.setCustomParameters({
        prompt: 'select_account',
        login_hint: emailHint.trim(),
      });
    } else {
      selectedProvider.setCustomParameters({ prompt: 'select_account' });
    }

    const result = await signInWithPopup(auth, selectedProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';

    if (scopeMode === 'drive' && !accessToken) {
      throw new Error('Gagal mendapatkan access token Google Drive dari Firebase.');
    }

    const profile: GoogleUserProfile = {
      email: result.user.email || '',
      displayName: result.user.displayName || result.user.email || 'Pengguna Google',
      photoURL: result.user.photoURL || undefined,
      authMethod: 'firebase',
    };

    if (scopeMode === 'drive' && accessToken) {
      saveGoogleAuth(accessToken, profile, 3500);
    }
    return { profile, accessToken };
  } catch (error: any) {
    console.error('Firebase Auth Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Unified Sign In:
 * - 'login' mode uses ONLY non-sensitive identity scopes (openid email profile)
 *   and prefers Firebase Auth / GIS without requesting Google Drive access.
 * - 'drive' mode requests drive.file scope for Google Drive backups.
 */
export const googleSignIn = async (
  preferredMethod: 'auto' | 'firebase' | 'gis' = 'auto',
  emailHint?: string,
  scopeMode: AuthScopeMode = 'login'
): Promise<{ profile: GoogleUserProfile; accessToken: string }> => {
  if (preferredMethod === 'gis') {
    return signInWithGIS(false, emailHint, scopeMode);
  }

  if (preferredMethod === 'firebase') {
    return signInWithFirebase(scopeMode, emailHint);
  }

  // 'auto' mode:
  // For 'login' mode, prefer Firebase Auth first (uses verified firebaseapp.com handler cleanly with zero unverified-app warnings).
  // Never open a second popup if the user intentionally closed/cancelled or blocked the popup.
  if (scopeMode === 'login' && auth) {
    try {
      return await signInWithFirebase('login', emailHint);
    } catch (fbErr: any) {
      const code = fbErr?.code || '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/popup-blocked'
      ) {
        throw parseAuthError(fbErr);
      }
      console.warn('Firebase Auth unavailable on this domain, switching to GIS...', fbErr);
      try {
        return await signInWithGIS(false, emailHint, 'login');
      } catch (gisErr: any) {
        throw parseAuthError(gisErr);
      }
    }
  }

  try {
    return await signInWithGIS(false, emailHint, scopeMode);
  } catch (gisErr: any) {
    const code = gisErr?.code || '';
    const msg = String(gisErr?.message || '').toLowerCase();
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/popup-blocked' ||
      msg.includes('dibatalkan') ||
      msg.includes('closed') ||
      msg.includes('terblokir')
    ) {
      throw parseAuthError(gisErr);
    }
    console.warn('GIS sign in attempt had error, falling back to Firebase...', gisErr);
    try {
      return await signInWithFirebase(scopeMode, emailHint);
    } catch (firebaseErr: any) {
      throw parseAuthError(gisErr?.message ? gisErr : firebaseErr);
    }
  }
};

export const getGoogleAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  const saved = getSavedToken();
  if (saved) {
    cachedAccessToken = saved;
    return saved;
  }

  // IMPORTANT: NEVER call signInWithGIS or requestAccessToken automatically in background!
  // Google Identity Services (GIS) opens a popup window / blank tab when requesting tokens.
  // Token requests must ONLY be triggered when user explicitly clicks "Hubungkan Akun Google" in settings.
  return null;
};

/**
 * Permanently remembers and stores the Google Drive account connection
 */
export function persistGoogleDriveAccount(
  email = 'operasional.scb@gmail.com',
  displayName = 'Operasional SCB'
): GoogleUserProfile {
  const profile: GoogleUserProfile = {
    email: email.trim(),
    displayName: displayName || email.split('@')[0],
    authMethod: 'gis',
  };
  currentProfile = profile;
  try {
    localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(STORAGE_KEEP_CONNECTED_KEY, 'true');
  } catch {}
  return profile;
}

export const getCurrentGoogleProfile = (): GoogleUserProfile | null => {
  if (currentProfile) return currentProfile;
  try {
    const raw = localStorage.getItem(STORAGE_PROFILE_KEY);
    if (raw) {
      currentProfile = JSON.parse(raw);
      return currentProfile;
    }
  } catch {}
  return null;
};

export const googleSignOut = async (): Promise<void> => {
  if (auth) {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Error signing out from Firebase:', e);
    }
  }

  // Revoke token if GIS was used
  const token = cachedAccessToken || getSavedToken();
  if (token && typeof (window as any).google?.accounts?.oauth2?.revoke === 'function') {
    try {
      (window as any).google.accounts.oauth2.revoke(token, () => {});
    } catch {}
  }

  clearStoredGoogleAuth();
};
