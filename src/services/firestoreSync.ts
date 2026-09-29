import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs, 
  query,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { CleaningReport, User } from '../types';
import { 
  INITIAL_REPORTS, 
  INITIAL_USERS, 
  saveReports as saveReportsToStorage, 
  getReports as getReportsFromStorage,
  saveUsers as saveUsersToStorage,
  getUsers as getUsersFromStorage
} from '../utils/storage';

const REPORTS_COLLECTION = 'reports';
const USERS_COLLECTION = 'users';

let isReportsSeeded = false;
let isUsersSeeded = false;

/**
 * Subscribes to real-time reports from Firestore.
 * Automatically synchronizes across all devices (mobile, laptop, Vercel).
 */
export function subscribeReports(
  onReportsChanged: (reports: CleaningReport[]) => void,
  onError?: (err: Error) => void
): () => void {
  const reportsRef = collection(db, REPORTS_COLLECTION);
  const q = query(reportsRef);

  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty && !isReportsSeeded) {
        isReportsSeeded = true;
        // Check if there are local reports to seed Firestore with
        const localReports = getReportsFromStorage();
        const initialToSeed = localReports && localReports.length > 0 ? localReports : INITIAL_REPORTS;
        
        try {
          const batch = writeBatch(db);
          for (const rep of initialToSeed) {
            const docRef = doc(db, REPORTS_COLLECTION, rep.id);
            batch.set(docRef, rep);
          }
          await batch.commit();
        } catch (e) {
          console.warn('Could not auto-seed reports to Firestore:', e);
        }
        return;
      }

      const reportsList: CleaningReport[] = [];
      snapshot.forEach((docSnap) => {
        reportsList.push(docSnap.data() as CleaningReport);
      });

      // Sort by timestamp descending (newest first)
      reportsList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      // Update local storage backup
      saveReportsToStorage(reportsList);
      onReportsChanged(reportsList);
    },
    (error) => {
      console.warn('Firestore reports subscription error, fallback to local storage:', error);
      const fallback = getReportsFromStorage();
      onReportsChanged(fallback);
      if (onError) onError(error);
    }
  );
}

/**
 * Add or update report in Firestore and local storage
 */
export async function saveReportToCloud(report: CleaningReport): Promise<void> {
  // Update local storage immediately for snappy UI
  const current = getReportsFromStorage();
  const existingIdx = current.findIndex((r) => r.id === report.id);
  if (existingIdx >= 0) {
    current[existingIdx] = report;
  } else {
    current.unshift(report);
  }
  saveReportsToStorage(current);

  // Sync to Firestore
  try {
    const docRef = doc(db, REPORTS_COLLECTION, report.id);
    await setDoc(docRef, report, { merge: true });
  } catch (err) {
    console.error('Failed to sync report to Firestore cloud:', err);
    throw err;
  }
}

/**
 * Delete report from Firestore and local storage
 */
export async function deleteReportFromCloud(id: string): Promise<void> {
  const current = getReportsFromStorage();
  const filtered = current.filter((r) => r.id !== id);
  saveReportsToStorage(filtered);

  try {
    const docRef = doc(db, REPORTS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete report from Firestore:', err);
    throw err;
  }
}

/**
 * Batch replace reports in cloud (for restore from JSON backup)
 */
export async function batchRestoreReportsToCloud(reports: CleaningReport[]): Promise<void> {
  saveReportsToStorage(reports);

  try {
    // 1. Get existing docs to clean up
    const snapshot = await getDocs(collection(db, REPORTS_COLLECTION));
    const deleteBatch = writeBatch(db);
    snapshot.forEach((d) => {
      deleteBatch.delete(d.ref);
    });
    await deleteBatch.commit();

    // 2. Add restored docs in batches of 400
    const chunkSize = 400;
    for (let i = 0; i < reports.length; i += chunkSize) {
      const chunk = reports.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const rep of chunk) {
        batch.set(doc(db, REPORTS_COLLECTION, rep.id), rep);
      }
      await batch.commit();
    }
  } catch (err) {
    console.error('Failed to batch restore to cloud:', err);
  }
}

/**
 * Subscribes to real-time users list from Firestore.
 */
export function subscribeUsers(
  onUsersChanged: (users: User[]) => void,
  onError?: (err: Error) => void
): () => void {
  const usersRef = collection(db, USERS_COLLECTION);
  const q = query(usersRef);

  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty && !isUsersSeeded) {
        isUsersSeeded = true;
        const localUsers = getUsersFromStorage();
        const initialToSeed = localUsers && localUsers.length > 0 ? localUsers : INITIAL_USERS;
        try {
          const batch = writeBatch(db);
          for (const u of initialToSeed) {
            batch.set(doc(db, USERS_COLLECTION, u.id), u);
          }
          await batch.commit();
        } catch (e) {
          console.warn('Could not auto-seed users to Firestore:', e);
        }
        return;
      }

      const usersList: User[] = [];
      snapshot.forEach((docSnap) => {
        usersList.push(docSnap.data() as User);
      });

      saveUsersToStorage(usersList);
      onUsersChanged(usersList);
    },
    (error) => {
      console.warn('Firestore users subscription error, fallback to local storage:', error);
      const fallback = getUsersFromStorage();
      onUsersChanged(fallback);
      if (onError) onError(error);
    }
  );
}

/**
 * Save user to Firestore
 */
export async function saveUserToCloud(user: User): Promise<void> {
  const current = getUsersFromStorage();
  const existingIdx = current.findIndex((u) => u.id === user.id);
  if (existingIdx >= 0) {
    current[existingIdx] = user;
  } else {
    current.push(user);
  }
  saveUsersToStorage(current);

  try {
    const docRef = doc(db, USERS_COLLECTION, user.id);
    await setDoc(docRef, user, { merge: true });
  } catch (err) {
    console.error('Failed to save user to Firestore:', err);
  }
}

/**
 * Delete user from Firestore
 */
export async function deleteUserFromCloud(id: string): Promise<void> {
  const current = getUsersFromStorage();
  const filtered = current.filter((u) => u.id !== id);
  saveUsersToStorage(filtered);

  try {
    const docRef = doc(db, USERS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete user from Firestore:', err);
  }
}
