import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import rawConfig from '../../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: (rawConfig as any)?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: (rawConfig as any)?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: (rawConfig as any)?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0457083120',
  storageBucket: (rawConfig as any)?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: (rawConfig as any)?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: (rawConfig as any)?.appId || import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const FIRESTORE_DATABASE_ID: string =
  (rawConfig as any)?.firestoreDatabaseId ||
  (rawConfig as any)?.databaseId ||
  import.meta.env.VITE_FIREBASE_DATABASE_ID ||
  'ai-studio-laporankebersiha-b837dc60-6c60-4a56-9829-2068c57227dc';

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);

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
