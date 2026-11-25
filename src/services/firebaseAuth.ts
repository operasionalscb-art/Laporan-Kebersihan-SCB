import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  reload,
  updatePassword,
  linkWithCredential,
  EmailAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, firebaseConfig } from './firebase';
import { User } from '../types';
import { INITIAL_USERS } from '../utils/storage';

const SECONDARY_APP_NAME = 'scb-staff-provisioner';

function getSecondaryAuth() {
  const existing = getApps().find((a) => a.name === SECONDARY_APP_NAME);
  const secondaryApp = existing || initializeApp(firebaseConfig, SECONDARY_APP_NAME);
  return getAuth(secondaryApp);
}

export function resolveEmailFromIdentifier(
  identifier: string,
  knownUsers: User[]
): { email: string; matchedUser?: User } | null {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return null;

  const pool = knownUsers && knownUsers.length > 0 ? knownUsers : INITIAL_USERS;
  const matchedByUsernameOrEmail =
    pool.find(
      (u) =>
        (u.username || '').trim().toLowerCase() === clean ||
        (u.email || '').trim().toLowerCase() === clean
    ) ||
    INITIAL_USERS.find(
      (u) =>
        (u.username || '').trim().toLowerCase() === clean ||
        (u.email || '').trim().toLowerCase() === clean
    );

  if (matchedByUsernameOrEmail?.email) {
    return {
      email: matchedByUsernameOrEmail.email.trim().toLowerCase(),
      matchedUser: matchedByUsernameOrEmail,
    };
  }

  if (clean.includes('@') && clean.includes('.')) {
    return { email: clean };
  }

  return null;
}

export type EmailSignInResult =
  | {
      status: 'authenticated';
      email: string;
      firebaseUser: FirebaseUser;
      matchedLocalUser?: User;
    }
  | {
      status: 'needs_verification';
      email: string;
      firebaseUser: FirebaseUser;
      verificationSent: boolean;
      newlyProvisioned?: boolean;
    };

export function parseFirebaseEmailAuthError(error: any): { code: string; message: string } {
  const code = error?.code || '';
  const raw = error?.message || String(error || '');

  if (code === 'auth/operation-not-allowed') {
    return {
      code,
      message:
        'Metode Email/Password belum diaktifkan di Firebase Console (Authentication → Sign-in method). Hubungi developer/admin.',
    };
  }
  if (code === 'auth/invalid-email') {
    return {
      code,
      message: 'Format alamat email tidak valid. Masukkan email lengkap seperti nama@gmail.com.',
    };
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return {
      code,
      message:
        'Email atau kata sandi tidak sesuai, atau akun belum memiliki kata sandi Firebase. Gunakan "Lupa / Atur Kata Sandi?" di bawah jika Anda baru pertama kali login.',
    };
  }
  if (code === 'auth/user-disabled') {
    return {
      code,
      message: 'Akun ini dinonaktifkan di Firebase Authentication. Hubungi Superadmin SCB.',
    };
  }
  if (code === 'auth/weak-password') {
    return {
      code,
      message: 'Kata sandi minimal harus 6 karakter untuk keamanan Firebase Auth.',
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      code,
      message:
        'Terlalu banyak percobaan login atau pengiriman email. Tunggu beberapa menit lalu coba kembali.',
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      code,
      message: 'Koneksi internet bermasalah. Periksa jaringan Anda lalu coba lagi.',
    };
  }
  if (code === 'ACCOUNT_EXISTS_NEEDS_RESET') {
    return {
      code,
      message:
        'Email ini sudah terdaftar di Firebase (sebelumnya via Google) atau kata sandinya berbeda. Klik "Kirim Link Atur Kata Sandi" di bawah untuk membuat kata sandi baru lewat email Anda.',
    };
  }

  return {
    code: code || 'auth/unknown',
    message: raw || 'Gagal memproses autentikasi akun.',
  };
}

/**
 * Signs in with Email (or locally resolved Username) + Password via Firebase Auth.
 * Automatically sends email verification & refreshes ID token when verified.
 */
export async function signInWithEmailPassword(
  identifier: string,
  password: string,
  knownUsers: User[]
): Promise<EmailSignInResult> {
  const resolved = resolveEmailFromIdentifier(identifier, knownUsers);
  if (!resolved) {
    throw {
      code: 'auth/invalid-email',
      message:
        'Username tidak ditemukan di perangkat ini. Masukkan alamat Email lengkap Anda (contoh: nama@gmail.com).',
    };
  }

  const { email, matchedUser } = resolved;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    if (!cred.user.emailVerified) {
      await reload(cred.user);
    }

    if (cred.user.emailVerified) {
      await cred.user.getIdToken(true);
      return {
        status: 'authenticated',
        email,
        firebaseUser: cred.user,
        matchedLocalUser: matchedUser,
      };
    }

    let verificationSent = false;
    try {
      await sendEmailVerification(cred.user);
      verificationSent = true;
    } catch (verifyErr) {
      console.warn('Email verification send note:', verifyErr);
    }

    return {
      status: 'needs_verification',
      email,
      firebaseUser: cred.user,
      verificationSent,
    };
  } catch (err: any) {
    const code = err?.code || '';

    // Auto-provision first-time official/synced account only when password matches expected local credential & >= 6 chars
    if (
      (code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password') &&
      matchedUser &&
      matchedUser.isActive !== false &&
      password.length >= 6 &&
      password === (matchedUser.password || '123456').trim()
    ) {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, email, password);
        let verificationSent = false;
        try {
          await sendEmailVerification(newCred.user);
          verificationSent = true;
        } catch (verifyErr) {
          console.warn('Initial verification email note:', verifyErr);
        }

        return {
          status: 'needs_verification',
          email,
          firebaseUser: newCred.user,
          verificationSent,
          newlyProvisioned: true,
        };
      } catch (createErr: any) {
        if (createErr?.code === 'auth/email-already-in-use') {
          throw {
            code: 'ACCOUNT_EXISTS_NEEDS_RESET',
            message:
              'Email ini sudah terdaftar di Firebase (sebelumnya via Google) atau memakai kata sandi berbeda. Klik "Kirim Link Atur Kata Sandi" di bawah untuk menyetel kata sandi email ini.',
          };
        }
        throw createErr;
      }
    }

    throw err;
  }
}

/**
 * Reloads current Firebase user and refreshes ID token so Firestore sees email_verified=true.
 */
export async function checkAndCompleteEmailVerification(): Promise<{
  verified: boolean;
  firebaseUser: FirebaseUser | null;
}> {
  const user = auth.currentUser;
  if (!user) return { verified: false, firebaseUser: null };

  await reload(user);
  if (user.emailVerified) {
    await user.getIdToken(true);
    return { verified: true, firebaseUser: user };
  }
  return { verified: false, firebaseUser: user };
}

export async function resendVerificationEmail(): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Tidak ada sesi akun yang menunggu verifikasi.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function sendPasswordResetForIdentifier(
  identifier: string,
  knownUsers: User[]
): Promise<string> {
  const resolved = resolveEmailFromIdentifier(identifier, knownUsers);
  if (!resolved) {
    throw new Error(
      'Masukkan alamat Email lengkap Anda terlebih dahulu untuk menerima link atur ulang kata sandi.'
    );
  }
  await sendPasswordResetEmail(auth, resolved.email);
  return resolved.email;
}

/**
 * Generates a readable random password (>= 10 chars) using Web Crypto when available
 * so Superadmin can provision new Email/Password staff accounts safely.
 */
export function generateStrongTempPassword(length = 10): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;

  const getRandomInt = (max: number): number => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return arr[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  const chars: string[] = [
    upper[getRandomInt(upper.length)],
    lower[getRandomInt(lower.length)],
    digits[getRandomInt(digits.length)],
  ];
  for (let i = chars.length; i < Math.max(8, length); i++) {
    chars.push(all[getRandomInt(all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Provisions a new staff Email/Password Firebase Auth account in the background
 * using a secondary Firebase App instance so the Superadmin stays signed in.
 */
export async function provisionStaffFirebaseAuthAccount(
  email: string,
  password: string
): Promise<{
  status: 'created' | 'already_exists' | 'error';
  message: string;
  emailSent?: boolean;
  uid?: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { status: 'error', message: 'Format alamat email tidak valid.' };
  }
  if (cleanPassword.length < 6) {
    return {
      status: 'error',
      message: 'Kata sandi minimal 6 karakter untuk mendaftarkan login Firebase.',
    };
  }

  const secondaryAuth = getSecondaryAuth();
  try {
    const userCred = await createUserWithEmailAndPassword(
      secondaryAuth,
      cleanEmail,
      cleanPassword
    );
    let emailSent = false;
    try {
      await sendEmailVerification(userCred.user);
      emailSent = true;
    } catch (verifyErr) {
      console.warn('Staff email verification dispatch note:', verifyErr);
    }

    return {
      status: 'created',
      emailSent,
      uid: userCred.user.uid,
      message: emailSent
        ? `Akun login & link verifikasi 1x dikirim ke ${cleanEmail}.`
        : `Akun login ${cleanEmail} dibuat di Firebase Auth.`,
    };
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      return {
        status: 'already_exists',
        emailSent: false,
        message: `Email ${cleanEmail} sudah terdaftar di Firebase Auth. Pengguna dapat masuk dengan kata sandi sebelumnya atau gunakan "Kirim Reset Sandi".`,
      };
    }
    const parsed = parseFirebaseEmailAuthError(err);
    return {
      status: 'error',
      message: parsed.message,
    };
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch {
      // Ignore cleanup signout noise
    }
  }
}

/**
 * Links or updates Email/Password credentials on the currently signed-in Firebase user.
 */
export async function linkOrUpdateOwnPassword(newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('Tidak ada sesi Firebase Auth aktif.');
  }
  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
  if (hasPasswordProvider) {
    await updatePassword(user, newPassword);
  } else {
    const cred = EmailAuthProvider.credential(user.email, newPassword);
    await linkWithCredential(user, cred);
  }
}

export async function signOutFirebaseOnly(): Promise<void> {
  if (auth.currentUser) {
    await signOut(auth);
  }
  // Ensure primary app ref stays referenced cleanly
  getApps().length > 0 && getApp();
}
