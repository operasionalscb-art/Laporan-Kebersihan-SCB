import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import rawConfig from '../../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: (rawConfig as any)?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: (rawConfig as any)?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: (rawConfig as any)?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0457083120',
  storageBucket: (rawConfig as any)?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: (rawConfig as any)?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: (rawConfig as any)?.appId || import.meta.env.VITE_FIREBASE_APP_ID || '',
  oAuthClientId:
    (rawConfig as any)?.oAuthClientId ||
    import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ||
    '794504611984-mdpandmt1r8vl85anr79ct8m66ml5941.apps.googleusercontent.com',
};

export const FIRESTORE_DATABASE_ID: string =
  (rawConfig as any)?.firestoreDatabaseId ||
  (rawConfig as any)?.databaseId ||
  import.meta.env.VITE_FIREBASE_DATABASE_ID ||
  'ai-studio-laporankebersiha-b837dc60-6c60-4a56-9829-2068c57227dc';

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

function initDb(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      FIRESTORE_DATABASE_ID
    );
  } catch {
    return getFirestore(app, FIRESTORE_DATABASE_ID);
  }
}

export const db: Firestore = initDb();

let hasTestedConnection = false;

// Connection test on initial boot to validate Firestore reachability
export async function testFirestoreConnection(): Promise<boolean> {
  if (hasTestedConnection) return true;
  hasTestedConnection = true;

  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Firestore client is offline.');
      return false;
    }
    // Permission error, quota check, or missing test doc still confirms live network reachability to Firestore
    return true;
  }
}

testFirestoreConnection();
