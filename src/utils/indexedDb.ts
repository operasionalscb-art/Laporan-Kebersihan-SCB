import { CleaningReport, User } from '../types';

const DB_NAME = 'scb_cleaning_db';
const DB_VERSION = 1;
const REPORTS_STORE = 'reports';
const USERS_STORE = 'users';

function getDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(REPORTS_STORE)) {
          db.createObjectStore(REPORTS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(USERS_STORE)) {
          db.createObjectStore(USERS_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

export async function saveReportsToIDB(reports: CleaningReport[]): Promise<void> {
  const db = await getDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(REPORTS_STORE, 'readwrite');
      const store = tx.objectStore(REPORTS_STORE);

      // Clear existing records to ensure parity
      store.clear();

      for (const report of reports) {
        store.put(report);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadReportsFromIDB(): Promise<CleaningReport[] | null> {
  const db = await getDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(REPORTS_STORE, 'readonly');
      const store = tx.objectStore(REPORTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result as CleaningReport[]);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveUsersToIDB(users: User[]): Promise<void> {
  const db = await getDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(USERS_STORE, 'readwrite');
      const store = tx.objectStore(USERS_STORE);
      store.clear();

      for (const user of users) {
        store.put(user);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadUsersFromIDB(): Promise<User[] | null> {
  const db = await getDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(USERS_STORE, 'readonly');
      const store = tx.objectStore(USERS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result as User[]);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
