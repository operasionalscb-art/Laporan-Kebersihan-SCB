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

// Clean and standard Google Drive & Profile scopes
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
  'email',
  'profile',
];

const STORAGE_ACCESS_TOKEN_KEY = 'scb_gdrive_access_token';
const STORAGE_PROFILE_KEY = 'scb_gdrive_profile';
const STORAGE_EXPIRY_KEY = 'scb_gdrive_token_expiry';
export const STORAGE_KEEP_CONNECTED_KEY = 'scb_gdrive_keep_connected';

// Combine config from json and Vite environment variables
export const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || (rawConfig as any)?.apiKey || '',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || (rawConfig as any)?.authDomain || '',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || (rawConfig as any)?.projectId || 'gen-lang-client-0457083120',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || (rawConfig as any)?.storageBucket || '',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || (rawConfig as any)?.messagingSenderId || '',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || (rawConfig as any)?.appId || '',
  oAuthClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || (rawConfig as any)?.oAuthClientId || '794504611984-mdpandmt1r8vl85anr79ct8m66ml5941.apps.googleusercontent.com',
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

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

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

  if (code === 'auth/popup-closed-by-user' || rawMsg.includes('closed')) {
    return {
      code: 'auth/popup-closed-by-user',
      title: 'Login Dibatalkan',
      message: 'Jendela login ditutup sebelum otentikasi Google Drive selesai.',
      isDomainError: false,
    };
  }

  return {
    code,
    title: 'Autentikasi Google Drive',
    message: rawMsg || 'Gagal menghubungkan Google Drive.',
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
  silent = false
): Promise<{ profile: GoogleUserProfile; accessToken: string }> => {
  const clientId = getActiveOAuthClientId();
  if (!clientId) {
    throw new Error('OAuth Client ID tidak ditemukan.');
  }

  // Ensure GIS script is loaded
  if (typeof (window as any).google?.accounts?.oauth2 === 'undefined') {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Gagal memuat script Google Identity Services')));
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Gagal memuat script Google Identity Services'));
        document.head.appendChild(script);
      }
    });
  }

  return new Promise((resolve, reject) => {
    try {
      const google = (window as any).google;
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        prompt: silent ? '' : undefined,
        callback: async (response: any) => {
          if (response.error) {
            if (response.error === 'immediate_failed') {
              reject(new Error('Sesi Google Drive memerlukan otorisasi manual (klik tombol Aktifkan).'));
            } else if (response.error === 'access_denied') {
              reject(new Error('Izin akses Google Drive ditolak oleh pengguna. Silakan izinkan akses agar data otomatis tersimpan di folder.'));
            } else {
              reject(new Error(response.error_description || response.error));
            }
            return;
          }

          if (!response.access_token) {
            reject(new Error('Tidak ada access token yang diterima dari Google.'));
            return;
          }

          const accessToken = response.access_token;
          const expiresIn = response.expires_in ? parseInt(response.expires_in, 10) : 3500;

          // Fetch basic user profile from Google UserInfo endpoint
          let profile: GoogleUserProfile = getCurrentGoogleProfile() || {
            email: 'operasional.scb@gmail.com',
            displayName: 'Operasional SCB',
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
            // Keep default profile if userinfo fetch fails
          }

          saveGoogleAuth(accessToken, profile, expiresIn);
          resolve({ profile, accessToken });
        },
      });

      client.requestAccessToken({ 
        prompt: silent ? '' : undefined,
        hint: 'operasional.scb@gmail.com',
      });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Sign in using Firebase Auth with GoogleAuthProvider
 */
export const signInWithFirebase = async (): Promise<{ profile: GoogleUserProfile; accessToken: string }> => {
  if (!auth) {
    throw new Error('Firebase Auth instance is not initialized.');
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan access token Google Drive dari Firebase.');
    }

    const profile: GoogleUserProfile = {
      email: result.user.email || 'operasional.scb@gmail.com',
      displayName: result.user.displayName || result.user.email || 'Pengguna Google',
      photoURL: result.user.photoURL || undefined,
      authMethod: 'firebase',
    };

    saveGoogleAuth(credential.accessToken, profile, 3500);
    return { profile, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Firebase Auth Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Unified Sign In:
 * Uses Google Identity Services directly for seamless SPA auth, with Firebase as fallback.
 */
export const googleSignIn = async (
  preferredMethod: 'auto' | 'firebase' | 'gis' = 'auto'
): Promise<{ profile: GoogleUserProfile; accessToken: string }> => {
  if (preferredMethod === 'gis') {
    return signInWithGIS();
  }

  if (preferredMethod === 'firebase') {
    return signInWithFirebase();
  }

  // 'auto' mode: Prefer GIS for Google Drive API scopes (avoids Firebase domain restrictions)
  try {
    return await signInWithGIS();
  } catch (gisErr: any) {
    console.warn('GIS sign in attempt had error, falling back to Firebase...', gisErr);
    try {
      return await signInWithFirebase();
    } catch (firebaseErr: any) {
      // Throw the most descriptive error
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

  // If connection is retained and remembered, attempt silent token renewal via GIS
  if (isGoogleDriveLinked()) {
    try {
      const res = await signInWithGIS(true);
      if (res?.accessToken) {
        cachedAccessToken = res.accessToken;
        return res.accessToken;
      }
    } catch (e) {
      console.warn('Silent token renewal via GIS was not possible:', e);
    }
  }

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
  
  // Default SCB designated Google account
  currentProfile = {
    email: 'operasional.scb@gmail.com',
    displayName: 'Operasional SCB',
    authMethod: 'gis',
  };
  try {
    localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(currentProfile));
    localStorage.setItem(STORAGE_KEEP_CONNECTED_KEY, 'true');
  } catch {}
  return currentProfile;
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
