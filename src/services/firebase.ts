import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import rawConfig from '../../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || (rawConfig as any)?.apiKey || '',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || (rawConfig as any)?.authDomain || '',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || (rawConfig as any)?.projectId || 'gen-lang-client-0457083120',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || (rawConfig as any)?.storageBucket || '',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || (rawConfig as any)?.messagingSenderId || '',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || (rawConfig as any)?.appId || '',
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Connection test as required by skill
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, check connection.');
      return false;
    }
    return true;
  }
}
testFirestoreConnection();
