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

export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
];

// Combine config from json and Vite environment variables
export const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || (rawConfig as any)?.apiKey || '',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || (rawConfig as any)?.authDomain || '',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || (rawConfig as any)?.projectId || 'vast-summit-scf5x',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || (rawConfig as any)?.storageBucket || '',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || (rawConfig as any)?.messagingSenderId || '',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || (rawConfig as any)?.appId || '',
  oAuthClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || (rawConfig as any)?.oAuthClientId || '',
};

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
 * Parses Firebase error into human-readable details and Vercel-specific recommendations
 */
export const parseAuthError = (error: any): { title: string; message: string; code: string; isDomainError: boolean } => {
  const code = error?.code || '';
  const rawMsg = error?.message || String(error);

  if (code === 'auth/unauthorized-domain' || rawMsg.includes('unauthorized-domain')) {
    const { currentHostname, projectId } = getDiagnosticInfo();
    return {
      code: 'auth/unauthorized-domain',
      title: 'Domain Vercel Belum Diizinkan di Firebase',
      message: `Domain "${currentHostname}" belum didaftarkan di Authorized Domains Firebase Project (${projectId}).`,
      isDomainError: true,
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      code: 'auth/operation-not-allowed',
      title: 'Provider Google Belum Aktif',
      message: 'Metode login Google belum diaktifkan di Firebase Console -> Authentication -> Sign-in method.',
      isDomainError: false,
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      code: 'auth/popup-blocked',
      title: 'Jendela Pop-up Terblokir',
      message: 'Browser Anda memblokir jendela login Google. Silakan klik ikon gembok/izin pop-up di bilah URL browser Anda.',
      isDomainError: false,
    };
  }

  if (code === 'auth/popup-closed-by-user') {
    return {
      code: 'auth/popup-closed-by-user',
      title: 'Login Dibatalkan',
      message: 'Jendela login ditutup sebelum otentikasi Google Drive selesai.',
      isDomainError: false,
    };
  }

  return {
    code,
    title: 'Terjadi Kesalahan Autentikasi',
    message: rawMsg || 'Gagal menghubungkan Google Drive.',
    isDomainError: false,
  };
};

/**
 * Initializes Google Auth Listener
 */
export const initGoogleAuth = (
  onAuthSuccess?: (profile: GoogleUserProfile, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }

  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      if (cachedAccessToken) {
        currentProfile = {
          email: user.email || '',
          displayName: user.displayName || user.email || 'Akun Google',
          photoURL: user.photoURL || undefined,
          authMethod: 'firebase',
        };
        if (onAuthSuccess) onAuthSuccess(currentProfile, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else if (currentProfile?.authMethod !== 'gis') {
      cachedAccessToken = null;
      currentProfile = null;
      if (onAuthFailure) onAuthFailure();
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

    cachedAccessToken = credential.accessToken;
    currentProfile = {
      email: result.user.email || '',
      displayName: result.user.displayName || result.user.email || 'Pengguna Google',
      photoURL: result.user.photoURL || undefined,
      authMethod: 'firebase',
    };

    return { profile: currentProfile, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Firebase Auth Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Direct Google Identity Services (GIS) Token Client.
 * Bypasses Firebase Authorized Domain restrictions by talking directly to Google OAuth 2.0.
 */
export const signInWithGIS = async (): Promise<{ profile: GoogleUserProfile; accessToken: string }> => {
  const clientId = firebaseConfig.oAuthClientId;
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
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }

          if (!response.access_token) {
            reject(new Error('Tidak ada access token yang diterima dari Google.'));
            return;
          }

          cachedAccessToken = response.access_token;

          // Fetch basic user profile from Google UserInfo endpoint
          try {
            const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${cachedAccessToken}` },
            });
            const userinfo = await userinfoRes.json();
            currentProfile = {
              email: userinfo.email || 'Akun Google Drive',
              displayName: userinfo.name || userinfo.email || 'Pengguna Google Drive',
              photoURL: userinfo.picture,
              authMethod: 'gis',
            };
          } catch {
            currentProfile = {
              email: 'Akun Google Drive',
              displayName: 'Pengguna Google Drive',
              authMethod: 'gis',
            };
          }

          resolve({ profile: currentProfile, accessToken: response.access_token });
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Unified Sign In:
 * Tries Firebase Auth first. If it encounters auth/unauthorized-domain (common on Vercel),
 * it seamlessly attempts Direct GIS OAuth or throws structured error.
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

  // 'auto' mode:
  try {
    return await signInWithFirebase();
  } catch (firebaseErr: any) {
    const parsed = parseAuthError(firebaseErr);
    // If domain unauthorized (common on Vercel deployment), auto fallback to direct GIS
    if (parsed.isDomainError) {
      console.warn('Firebase unauthorized domain detected. Falling back to Google Identity Services token client...');
      try {
        return await signInWithGIS();
      } catch (gisErr) {
        // If GIS also fails, throw original firebase error so user gets full domain diagnostic
        throw firebaseErr;
      }
    }
    throw firebaseErr;
  }
};

export const getGoogleAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentGoogleProfile = (): GoogleUserProfile | null => {
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
  if (cachedAccessToken && typeof (window as any).google?.accounts?.oauth2?.revoke === 'function') {
    try {
      (window as any).google.accounts.oauth2.revoke(cachedAccessToken, () => {});
    } catch {}
  }

  cachedAccessToken = null;
  currentProfile = null;
};
