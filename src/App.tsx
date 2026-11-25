/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  User, 
  CleaningReport, 
  MasterRoom, 
  MasterChecklist, 
  FormSettings, 
  RoomSchedule 
} from './types';
import { 
  INITIAL_USERS,
  canonicalizeUsersToOfficial,
  getUsers, 
  saveUsers,
  addUser, 
  updateUser, 
  deleteUser, 
  getReports, 
  saveReports,
  addReport, 
  updateReport, 
  deleteReport, 
  getCurrentUser, 
  setCurrentUser, 
  clearCurrentUser
} from './utils/storage';
import { loadUsersFromIDB, loadReportsFromIDB } from './utils/indexedDb';
import {
  getMasterRooms,
  saveMasterRooms,
  getMasterChecklists,
  saveMasterChecklists,
  getFormSettings,
  saveFormSettings,
  getRoomSchedules,
  saveRoomSchedules
} from './utils/formStorage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import {
  subscribeReports,
  saveReportToCloud,
  updateReportInCloud,
  deleteReportFromCloud,
  batchRestoreReportsToCloud,
  subscribeUsers,
  saveUserToCloud,
  deleteUserFromCloud,
  subscribeFormConfig,
  saveMasterRoomsToCloud,
  saveMasterChecklistsToCloud,
  saveFormSettingsToCloud,
  subscribeRoomSchedules,
  saveRoomSchedulesToCloud,
  resetCloudSyncSessionFlags,
  clearUnsyncedTrackers,
  syncAllUsersToCloud,
  syncAllAppDataToCloud,
  syncPendingLocalChangesToCloud,
  syncPendingLocalReportsToCloud,
  retrySingleReportCloudSync,
  subscribePendingUnsyncedCount,
  fetchUserByEmailFromCloud,
  CloudSaveResult,
  subscribeQuotaStatus,
  loadOlderReportsFromCloud,
  fetchReportPhotosFromCloud,
  refreshReportsFromCloudNow,
} from './services/firestoreSync';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { ReportForm } from './components/ReportForm';
import { FormManagement } from './components/FormManagement';
import { AccountManagement, UserRegistrationResult } from './components/AccountManagement';
import { LoginModal } from './components/LoginModal';
import { GuestLandingPage } from './components/GuestLandingPage';
import { PrintModal } from './components/PrintModal';
import { GoogleDriveManager } from './components/GoogleDriveManager';
import { FullBackupPayload } from './components/StorageBackupManager';
import { 
  parseAuthError,
  getGoogleAccessToken, 
  googleSignOut
} from './services/googleAuth';
import { 
  uploadReportPhotosToDrive, 
  executeAutoBackupToDrive, 
  isAutoBackupEnabled, 
  isAutoPhotosUploadEnabled 
} from './services/googleDriveService';
import {
  provisionStaffFirebaseAuthAccount,
  sendPasswordResetForIdentifier,
  parseFirebaseEmailAuthError,
} from './services/firebaseAuth';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [reports, setReports] = useState<CleaningReport[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'input' | 'form_mgmt' | 'accounts' | 'drive'>('dashboard');

  // Master Data & Configuration state
  const [masterRooms, setMasterRooms] = useState<MasterRoom[]>(() => getMasterRooms());
  const [masterChecklists, setMasterChecklists] = useState<MasterChecklist[]>(() => getMasterChecklists());
  const [formSettings, setFormSettings] = useState<FormSettings>(() => getFormSettings());
  const [roomSchedules, setRoomSchedules] = useState<RoomSchedule[]>(() => getRoomSchedules());

  // Modals
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [printReportsData, setPrintReportsData] = useState<CleaningReport[] | null>(null);
  const [printPeriodeLabel, setPrintPeriodeLabel] = useState<string | undefined>(undefined);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const [loginModalPrompt, setLoginModalPrompt] = useState<string>('');
  const [preselectedArea, setPreselectedArea] = useState<string | null>(null);
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(() =>
    auth.currentUser?.email && auth.currentUser?.emailVerified ? auth.currentUser.email : null
  );
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [pendingUnsyncedCount, setPendingUnsyncedCount] = useState<number>(0);
  const [isFirestoreQuotaLimited, setIsFirestoreQuotaLimited] = useState<boolean>(false);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  const handleOpenLoginModal = (
    reason = 'Silakan masuk menggunakan Email / Username dan Kata Sandi akun terdaftar.'
  ) => {
    setLoginModalPrompt(reason);
    setIsLoginModalOpen(true);
  };

  const handleRequestInputReport = (areaName?: string) => {
    if (areaName && typeof areaName === 'string') {
      setPreselectedArea(areaName);
    } else {
      setPreselectedArea(null);
    }

    if (!currentUser) {
      handleOpenLoginModal(
        'Akses Dibatasi: Non-user / Tamu hanya bisa melihat Dashboard. Silakan masuk dengan akun terdaftar untuk mengisi laporan.'
      );
      showToast('Non-user / Tamu hanya bisa melihat dashboard. Silakan login.', 'error');
      setActiveTab('dashboard');
      return;
    }
    setActiveTab('input');
  };

  // Safe tab change handler to block non-users from switching to restricted tabs
  const handleSafeTabChange = (targetTab: 'dashboard' | 'input' | 'form_mgmt' | 'accounts' | 'drive') => {
    if (targetTab === 'input') {
      handleRequestInputReport();
      return;
    }
    if (targetTab === 'form_mgmt') {
      if (!isSuperAdmin) {
        handleOpenLoginModal('Pengelolaan Form & Jadwal hanya dapat diakses oleh akun Superadmin (operasional.scb).');
        setActiveTab('dashboard');
        return;
      }
    }
    if (targetTab === 'accounts') {
      if (!isSuperAdmin) {
        handleOpenLoginModal('Pengelolaan akun hanya dapat diakses oleh akun Superadmin (operasional.scb).');
        setActiveTab('dashboard');
        return;
      }
    }
    if (targetTab === 'drive') {
      if (!isSuperAdmin) {
        handleOpenLoginModal('Pusat Penyimpanan Data hanya dapat diakses oleh akun Superadmin (operasional.scb).');
        setActiveTab('dashboard');
        return;
      }
    }
    setActiveTab(targetTab);
  };

  // Initial Real-time Subscriptions & Local/IndexedDB Hydration
  useEffect(() => {
    const hasLocalUsers = Boolean(localStorage.getItem('scb_cleaning_users_v2'));

    // Current user session (local device)
    const loadedCurrentUser = getCurrentUser();
    setCurrentUserState(loadedCurrentUser);

    // Initial local cache load for instant render
    if (hasLocalUsers) {
      const canonicalUsers = getUsers();
      setUsers(canonicalUsers);
      if (loadedCurrentUser && !canonicalUsers.some((u) => u.id === loadedCurrentUser.id)) {
        clearCurrentUser();
        setCurrentUserState(null);
      }
    } else {
      setUsers(INITIAL_USERS);
      loadUsersFromIDB()
        .then((idbUsers) => {
          if (idbUsers && idbUsers.length > 0) {
            const normalized =
              localStorage.getItem('scb_canonical_users_reset_v2') === 'true'
                ? idbUsers
                : canonicalizeUsersToOfficial(idbUsers);
            saveUsers(normalized);
            localStorage.setItem('scb_canonical_users_reset_v2', 'true');
          }
          setUsers(getUsers());
        })
        .catch(() => {
          setUsers(getUsers());
        });
    }
    const initialReports = getReports();
    setReports(initialReports);
    if (initialReports.length === 0) {
      loadReportsFromIDB()
        .then((idbReports) => {
          if (idbReports && idbReports.length > 0) {
            const nonDemo = idbReports.filter((r) => !['rep-1', 'rep-2', 'rep-3', 'rep-4'].includes(r.id));
            if (nonDemo.length > 0) {
              saveReports(nonDemo);
              setReports(nonDemo);
            }
          }
        })
        .catch(() => {});
    }
    setMasterRooms(getMasterRooms());
    setMasterChecklists(getMasterChecklists());
    setFormSettings(getFormSettings());
    setRoomSchedules(getRoomSchedules());

    // 1. Track Firestore daily quota & pending local report queue cleanly
    const unsubscribeQuota = subscribeQuotaStatus((limited) => {
      setIsFirestoreQuotaLimited(limited);
    });
    const unsubscribeUnsynced = subscribePendingUnsyncedCount((count) => {
      setPendingUnsyncedCount(count);
    });

    // 2. Defer cloud subscriptions until Firebase Auth state resolves so authenticated
    // reloads do NOT open & immediately tear down duplicate Guest subscriptions.
    let unsubscribeReports: (() => void) | null = null;
    let unsubscribeFormConfig: (() => void) | null = null;
    let unsubscribeSchedules: (() => void) | null = null;
    let unsubscribeUsers: (() => void) | null = null;
    let currentSubscriptionKey: string | null = null;

    const cleanupCloudSubscriptions = () => {
      if (unsubscribeReports) {
        unsubscribeReports();
        unsubscribeReports = null;
      }
      if (unsubscribeFormConfig) {
        unsubscribeFormConfig();
        unsubscribeFormConfig = null;
      }
      if (unsubscribeSchedules) {
        unsubscribeSchedules();
        unsubscribeSchedules = null;
      }
      if (unsubscribeUsers) {
        unsubscribeUsers();
        unsubscribeUsers = null;
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      const verifiedEmail = fbUser?.email && fbUser.emailVerified ? fbUser.email : null;
      setCloudUserEmail(verifiedEmail);
      setIsAuthReady(true);

      const nextSubscriptionKey = verifiedEmail ? `auth:${fbUser!.uid}` : 'guest';
      const needsResubscribe = currentSubscriptionKey !== nextSubscriptionKey;

      if (verifiedEmail && fbUser) {
        const cleanEmail = verifiedEmail.trim().toLowerCase();
        // Restore or align local currentUser with verified Firebase Auth session
        const existingLocalSession = getCurrentUser();
        if (!existingLocalSession || (existingLocalSession.email || '').trim().toLowerCase() !== cleanEmail) {
          const localRoster = getUsers();
          let matched = localRoster.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail);
          if (!matched) {
            matched = (await fetchUserByEmailFromCloud(cleanEmail).catch(() => null)) || undefined;
          }
          if (matched && matched.isActive !== false) {
            setCurrentUser(matched);
            setCurrentUserState(matched);
          }
        }
      } else {
        resetCloudSyncSessionFlags();
      }

      if (needsResubscribe) {
        cleanupCloudSubscriptions();
        currentSubscriptionKey = nextSubscriptionKey;

        // Hemat kuota Firebase: non-login visitor hanya membaca 1 dokumen ringkasan notifikasi di GuestLandingPage.
        // Listener laporan penuh, konfigurasi, jadwal, dan akun hanya aktif setelah user login terverifikasi.
        if (verifiedEmail) {
          unsubscribeReports = subscribeReports((cloudReports) => {
            setReports(cloudReports);
          });
          unsubscribeFormConfig = subscribeFormConfig(({ rooms, checklists, settings }) => {
            setMasterRooms(rooms);
            setMasterChecklists(checklists);
            setFormSettings(settings);
          });
          unsubscribeSchedules = subscribeRoomSchedules((schedules) => {
            setRoomSchedules(schedules);
          });
          unsubscribeUsers = subscribeUsers((cloudUsers) => {
            setUsers(cloudUsers);
          });
        }
      }

      if (verifiedEmail) {
        const cleanEmail = verifiedEmail.trim().toLowerCase();
        syncPendingLocalReportsToCloud()
          .then((count) => {
            if (count > 0) {
              setReports(getReports());
              showToast(`${count} laporan tertunda berhasil disinkronkan ke Cloud!`, 'success');
            }
          })
          .catch(() => {});
        if (cleanEmail === 'operasional.scb@gmail.com') {
          syncPendingLocalChangesToCloud()
            .then(({ syncedConfig, syncedSchedules }) => {
              if (syncedConfig || syncedSchedules) {
                showToast('Perubahan lokal Master Form & Jadwal berhasil disinkronkan ke Cloud.', 'success');
              }
            })
            .catch(() => {});
        }
      }
    });

    auth.authStateReady()
      .then(() => {
        setIsAuthReady(true);
      })
      .catch(() => {
        setIsAuthReady(true);
      });

    // 3. Auto-sync pending reports when network connection recovers
    const handleOnlineReconnect = () => {
      if (auth.currentUser?.email && auth.currentUser.emailVerified) {
        syncPendingLocalReportsToCloud()
          .then((count) => {
            if (count > 0) {
              setReports(getReports());
              showToast(`${count} laporan tertunda berhasil disinkronkan setelah koneksi pulih!`, 'success');
            }
          })
          .catch(() => {});
      }
    };

    // 4. Cross-tab localStorage sync on the same browser
    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key === 'scb_cleaning_users_v2') {
        setUsers(getUsers());
      } else if (event.key === 'scb_cleaning_reports_v2') {
        try {
          const parsed = event.newValue ? JSON.parse(event.newValue) : [];
          if (Array.isArray(parsed)) setReports(parsed);
        } catch {
          setReports(getReports());
        }
      } else if (event.key === 'scb_master_rooms_v1') {
        setMasterRooms(getMasterRooms());
      } else if (event.key === 'scb_master_checklists_v1') {
        setMasterChecklists(getMasterChecklists());
      } else if (event.key === 'scb_form_settings_v1') {
        setFormSettings(getFormSettings());
      } else if (event.key === 'scb_room_schedules_v1') {
        setRoomSchedules(getRoomSchedules());
      } else if (event.key === 'scb_current_user_v2') {
        setCurrentUserState(getCurrentUser());
      }
    };
    const handleIdbHydrated = () => {
      setReports(getReports());
    };
    const handleConfigHydrated = () => {
      setMasterRooms(getMasterRooms());
      setMasterChecklists(getMasterChecklists());
      setFormSettings(getFormSettings());
      setRoomSchedules(getRoomSchedules());
    };
    window.addEventListener('online', handleOnlineReconnect);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('scb_idb_reports_hydrated', handleIdbHydrated);
    window.addEventListener('scb_config_hydrated', handleConfigHydrated);

    return () => {
      unsubscribeQuota();
      unsubscribeUnsynced();
      unsubscribeAuth();
      cleanupCloudSubscriptions();
      window.removeEventListener('online', handleOnlineReconnect);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('scb_idb_reports_hydrated', handleIdbHydrated);
      window.removeEventListener('scb_config_hydrated', handleConfigHydrated);
    };
  }, []);

  // Keep active manual session aligned with any roster updates (e.g., rename/role/deactivation)
  useEffect(() => {
    if (!currentUser || users.length === 0) return;
    const currentEmailLower = (currentUser.email || '').trim().toLowerCase();
    const latest = users.find(
      (u) =>
        u.id === currentUser.id ||
        (currentEmailLower && (u.email || '').trim().toLowerCase() === currentEmailLower)
    );
    if (!latest) {
      // Do not log out a user who is verified via Firebase Auth while roster is still hydrating
      if (
        auth.currentUser?.emailVerified &&
        currentEmailLower &&
        (auth.currentUser.email || '').trim().toLowerCase() === currentEmailLower
      ) {
        return;
      }
      clearCurrentUser();
      setCurrentUserState(null);
      setActiveTab('dashboard');
      return;
    }
    if (latest.isActive === false) {
      clearCurrentUser();
      setCurrentUserState(null);
      setActiveTab('dashboard');
      showToast('Akun Anda telah dinonaktifkan oleh Superadmin.', 'error');
      return;
    }
    if (
      latest.id !== currentUser.id ||
      latest.name !== currentUser.name ||
      latest.role !== currentUser.role ||
      latest.email !== currentUser.email ||
      latest.username !== currentUser.username ||
      latest.password !== currentUser.password ||
      latest.pin !== currentUser.pin
    ) {
      setCurrentUserState(latest);
      setCurrentUser(latest);
    }
  }, [users, currentUser]);

  // Handlers for Reports
  const handleAddNewReport = async (
    newReportData: Omit<CleaningReport, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
  ): Promise<{ saved: CleaningReport; cloudResult: CloudSaveResult }> => {
    const reportWithAuthor = auth.currentUser?.uid
      ? { ...newReportData, authorUid: auth.currentUser.uid }
      : newReportData;

    // 1. Save locally first for instant feedback
    const saved = addReport(reportWithAuthor);
    setReports(getReports());

    // 2. Persist to Firestore Cloud in real-time and await exact outcome
    let cloudResult: CloudSaveResult;
    try {
      cloudResult = await saveReportToCloud(saved);
      setReports(getReports());
      if (cloudResult.status === 'synced') {
        showToast(`Laporan ${saved.area} berhasil disimpan & disinkronkan ke Cloud!`);
      } else {
        showToast(
          cloudResult.message || `Laporan ${saved.area} tersimpan lokal (belum masuk ke Cloud).`,
          'error'
        );
      }
    } catch (e: any) {
      console.warn('Saved locally, cloud sync failed:', e);
      const rawErr = e?.message || String(e || '');
      const isPermission = rawErr.toLowerCase().includes('permission');
      cloudResult = {
        status: 'local_error',
        message: isPermission
          ? 'Izin tulis Firestore ditolak (PERMISSION_DENIED). Pastikan akun Anda aktif & terverifikasi, lalu klik Coba Kirim Ulang.'
          : `Gagal mengirim ke Cloud (${rawErr || 'gangguan jaringan'}). Data tersimpan lokal dan siap dikirim ulang.`,
      };
      showToast(cloudResult.message || 'Gagal mengirim ke Cloud.', 'error');
    }

    // 3. Automatic Google Drive Photo Archive & Backup (non-blocking background task)
    getGoogleAccessToken()
      .then((token) => {
        if (!token) {
          if (isAutoBackupEnabled()) {
            showToast('ℹ️ Laporan tersimpan di sistem. Buka tab Cadangan Data & klik "Aktifkan" agar data otomatis terunggah ke Google Drive.', 'info');
          }
          return;
        }
        (async () => {
          if (isAutoPhotosUploadEnabled() && saved.fotoBukti && saved.fotoBukti.length > 0) {
            try {
              const { driveLinks, uploadedCount } = await uploadReportPhotosToDrive(saved);
              if (uploadedCount > 0 && driveLinks.length > 0) {
                updateReport(saved.id, { drivePhotoLinks: driveLinks });
                setReports(getReports());
                await updateReportInCloud(saved.id, { drivePhotoLinks: driveLinks }).catch(() => {});
                showToast(`📸 ${uploadedCount} foto bukti otomatis diarsipkan ke Google Drive!`, 'success');
              }
            } catch (photoErr) {
              console.warn('Auto upload photos to Drive error:', photoErr);
            }
          }

          if (isAutoBackupEnabled()) {
            try {
              const allLatestReports = getReports();
              await executeAutoBackupToDrive(allLatestReports);
              showToast('☁️ Data laporan otomatis dicadangkan ke Google Drive!', 'info');
            } catch (backupErr: any) {
              console.warn('Auto backup to Google Drive error:', backupErr);
              showToast('⚠️ Gagal menyimpan ke Google Drive: ' + (backupErr?.message || 'Periksa izin akun'), 'error');
            }
          }
        })();
      })
      .catch(() => {});

    return { saved, cloudResult };
  };

  const handleRetrySingleReportSync = async (reportId: string): Promise<CloudSaveResult> => {
    const res = await retrySingleReportCloudSync(reportId);
    setReports(getReports());
    if (res.status === 'synced') {
      showToast('Laporan berhasil disinkronkan ke Cloud & Dashboard!', 'success');
    } else if (res.message) {
      showToast(res.message, 'error');
    }
    return res;
  };

  const handleSyncPendingReportsNow = async () => {
    if (!auth.currentUser || !auth.currentUser.emailVerified) {
      handleOpenLoginModal(
        'Masuk menggunakan Email & Kata Sandi akun Anda untuk mengirim laporan tertunda di perangkat ini ke Dashboard Cloud.'
      );
      return;
    }
    const syncedCount = await syncPendingLocalReportsToCloud();
    setReports(getReports());
    if (syncedCount > 0) {
      showToast(`${syncedCount} laporan tertunda berhasil disinkronkan ke Cloud!`, 'success');
    } else if (pendingUnsyncedCount > 0) {
      showToast('Sebagian laporan masih tertunda (periksa jaringan atau izin akun).', 'error');
    } else {
      showToast('Seluruh laporan sudah tersinkron dengan Cloud.', 'success');
    }
  };

  const handleUpdateReport = async (id: string, updates: Partial<CleaningReport>) => {
    const updated = updateReport(id, updates);
    setReports(getReports());

    if (updated) {
      try {
        const cloudRes = await updateReportInCloud(id, updates);
        if (cloudRes.status === 'synced') {
          showToast('Laporan berhasil diperbarui & disinkronkan.');
        } else {
          showToast(cloudRes.message || 'Perubahan tersimpan lokal, sinkronisasi Cloud tertunda.', 'info');
        }
      } catch (e) {
        console.warn('Updated locally, cloud sync failed:', e);
        showToast('Perubahan tersimpan lokal, gagal sinkron ke Cloud.', 'error');
      }

      if (isAutoBackupEnabled()) {
        getGoogleAccessToken().then((token) => {
          if (token) {
            executeAutoBackupToDrive(getReports()).catch((e) => console.warn('Auto backup on update error:', e));
          }
        });
      }
    }
  };

  const handleDeleteReport = async (id: string) => {
    deleteReport(id);
    setReports(getReports());
    showToast('Laporan berhasil dihapus.', 'info');

    try {
      await deleteReportFromCloud(id);
    } catch (e) {
      console.warn('Deleted locally, background cloud sync error:', e);
    }

    if (isAutoBackupEnabled()) {
      getGoogleAccessToken().then((token) => {
        if (token) {
          executeAutoBackupToDrive(getReports()).catch((e) => console.warn('Auto backup on delete error:', e));
        }
      });
    }
  };

  // Handlers for Form Configuration & Schedules
  const handleSaveRooms = async (updatedRooms: MasterRoom[]) => {
    setMasterRooms(updatedRooms);
    saveMasterRooms(updatedRooms);
    const res = await saveMasterRoomsToCloud(updatedRooms);
    if (res.status === 'local_error' || res.status === 'local_quota') {
      showToast(res.message || 'Tersimpan lokal, sinkronisasi Cloud tertunda.', 'error');
    } else if (res.status === 'local_unauthenticated') {
      showToast('Data ruangan tersimpan di perangkat ini. Masuk Cloud Superadmin agar sinkron ke semua perangkat.', 'info');
    }
  };

  const handleSaveChecklists = async (updatedChecklists: MasterChecklist[]) => {
    setMasterChecklists(updatedChecklists);
    saveMasterChecklists(updatedChecklists);
    const res = await saveMasterChecklistsToCloud(updatedChecklists);
    if (res.status === 'local_error' || res.status === 'local_quota') {
      showToast(res.message || 'Tersimpan lokal, sinkronisasi Cloud tertunda.', 'error');
    } else if (res.status === 'local_unauthenticated') {
      showToast('Data checklist tersimpan di perangkat ini. Masuk Cloud Superadmin agar sinkron ke semua perangkat.', 'info');
    }
  };

  const handleSaveFormSettings = async (updatedSettings: FormSettings) => {
    setFormSettings(updatedSettings);
    saveFormSettings(updatedSettings);
    const res = await saveFormSettingsToCloud(updatedSettings);
    if (res.status === 'local_error' || res.status === 'local_quota') {
      showToast(res.message || 'Tersimpan lokal, sinkronisasi Cloud tertunda.', 'error');
    } else if (res.status === 'local_unauthenticated') {
      showToast('Pengaturan form tersimpan di perangkat ini. Masuk Cloud Superadmin agar sinkron ke semua perangkat.', 'info');
    }
  };

  const handleSaveSchedules = async (updatedSchedules: RoomSchedule[]) => {
    setRoomSchedules(updatedSchedules);
    saveRoomSchedules(updatedSchedules);
    const res = await saveRoomSchedulesToCloud(updatedSchedules);
    if (res.status === 'local_error' || res.status === 'local_quota') {
      showToast(res.message || 'Jadwal tersimpan lokal, sinkronisasi Cloud tertunda.', 'error');
    } else if (res.status === 'local_unauthenticated') {
      showToast('Jadwal ruangan tersimpan di perangkat ini. Masuk Cloud Superadmin agar sinkron ke semua perangkat.', 'info');
    }
  };

  // Handlers for Users
  const handleAddUser = async (
    userData: Omit<User, 'id' | 'createdAt'>,
    initialPassword: string
  ): Promise<UserRegistrationResult> => {
    const cleanPassword = (initialPassword || userData.password || '123456').trim();
    const created = addUser({
      ...userData,
      password: cleanPassword,
    });
    setUsers((prev) => [...prev.filter((u) => u.id !== created.id), created]);

    let cloudSaved = false;
    try {
      await saveUserToCloud(created);
      cloudSaved = true;
    } catch (e) {
      console.warn('Saved user locally, cloud sync error:', e);
    }

    const authProvision = await provisionStaffFirebaseAuthAccount(
      created.email,
      cleanPassword
    );

    if (authProvision.status === 'created') {
      showToast(
        `Petugas ${created.name} ditambahkan${cloudSaved ? ' & disinkronkan' : ''}! ${authProvision.message}`,
        'success'
      );
    } else if (authProvision.status === 'already_exists') {
      showToast(
        `Petugas ${created.name} disimpan${cloudSaved ? ' & disinkronkan ke Cloud' : ''}.`,
        'success'
      );
    } else {
      showToast(
        `Petugas ${created.name} tersimpan, catatan login Cloud: ${authProvision.message}`,
        'info'
      );
    }

    return {
      success: authProvision.status !== 'error',
      user: created,
      authStatus: authProvision.status,
      emailSent: authProvision.emailSent,
      cloudSynced: cloudSaved,
      message: authProvision.message,
    };
  };

  const handleSendPasswordReset = async (email: string) => {
    try {
      const sentTo = await sendPasswordResetForIdentifier(email, users);
      showToast(
        `Link atur / reset kata sandi dikirim ke ${sentTo}. Minta personel memeriksa kotak masuk/spam email.`,
        'success'
      );
    } catch (err: any) {
      const parsed = parseFirebaseEmailAuthError(err);
      showToast(parsed.message || 'Gagal mengirim email reset kata sandi.', 'error');
    }
  };

  const handleUpdateUser = async (id: string, updates: Partial<User>) => {
    const previousUser = users.find((u) => u.id === id);
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
    const updated = updateUser(id, updates);
    if (currentUser?.id === id && updated) {
      setCurrentUserState(updated);
      setCurrentUser(updated);
    }

    // Keep officerName synced inside roomSchedules if user was renamed
    if (updated && previousUser && updates.name && updates.name !== previousUser.name) {
      const updatedSchedules = roomSchedules.map((sch) =>
        sch.officerId === id || sch.officerName.trim().toLowerCase() === previousUser.name.trim().toLowerCase()
          ? { ...sch, officerName: updated.name }
          : sch
      );
      handleSaveSchedules(updatedSchedules);
    }

    showToast('Data petugas berhasil diperbarui.');

    if (updated) {
      try {
        await saveUserToCloud(updated);
      } catch (e) {
        console.warn('Updated user locally, cloud sync error:', e);
      }
    }
  };

  const handleDeleteUser = async (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    deleteUser(id);
    showToast('Akun berhasil dihapus.', 'info');

    try {
      await deleteUserFromCloud(id);
    } catch (e) {
      console.warn('Deleted user locally, cloud sync error:', e);
    }
  };

  const handleConnectCloudSync = async () => {
    if (!auth.currentUser || !auth.currentUser.emailVerified) {
      handleOpenLoginModal(
        'Masuk menggunakan Email & Kata Sandi Superadmin (operasional.scb@gmail.com) untuk mengaktifkan sinkronisasi Cloud.'
      );
      return;
    }

    const email = auth.currentUser.email?.trim().toLowerCase() || '';
    if (email !== 'operasional.scb@gmail.com') {
      showToast(
        `Terhubung ke Cloud (${email}). Gunakan operasional.scb@gmail.com agar hak tulis Superadmin aktif.`,
        'info'
      );
      return;
    }

    try {
      await syncAllAppDataToCloud({
        users: getUsers(),
        masterRooms: getMasterRooms(),
        masterChecklists: getMasterChecklists(),
        formSettings: getFormSettings(),
        roomSchedules: getRoomSchedules(),
        reports: getReports(),
      });
      showToast('Sinkronisasi Cloud Firestore aktif! Seluruh data petugas, ruangan, jadwal & laporan disinkronkan.', 'success');
    } catch (err: any) {
      const parsed = parseAuthError(err);
      showToast(parsed.message || 'Gagal menyinkronkan data Cloud Admin.', 'error');
    }
  };

  const handleDisconnectCloudSync = async () => {
    await googleSignOut();
    resetCloudSyncSessionFlags();
    setCloudUserEmail(null);
    showToast('Koneksi Cloud Sync diputus. Sistem kembali ke penyimpanan lokal.', 'info');
  };

  const handleSyncUsersNow = async () => {
    try {
      await syncAllUsersToCloud(users);
      showToast(`${users.length} akun petugas berhasil disinkronkan ke Cloud!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyinkronkan daftar akun ke Cloud.', 'error');
    }
  };

  const handleImportUsers = async (importedUsers: User[]) => {
    const mergedMap = new Map<string, User>(users.map((u) => [u.id, u]));
    for (const incoming of importedUsers) {
      mergedMap.set(incoming.id, incoming);
    }
    const mergedList = Array.from(mergedMap.values());
    saveUsers(mergedList);
    setUsers(mergedList);
    if (auth.currentUser) {
      await syncAllUsersToCloud(mergedList).catch(() => {});
    }
    showToast(`${importedUsers.length} akun petugas berhasil diimpor ke sistem!`, 'success');
  };

  const handleRestoreFullBackup = async (payload: FullBackupPayload, mode: 'replace' | 'merge') => {
    // 1. Reports
    let finalReports = payload.reports || [];
    if (mode === 'merge') {
      const existingIds = new Set(reports.map((r) => r.id));
      const newReps = finalReports.filter((r) => !existingIds.has(r.id));
      finalReports = [...newReps, ...reports];
    }
    saveReports(finalReports);
    setReports(finalReports);

    // 2. Users (if present in backup)
    let finalUsers: User[] | undefined;
    if (Array.isArray(payload.users) && payload.users.length > 0) {
      if (mode === 'replace') {
        finalUsers = payload.users;
      } else {
        const userMap = new Map(users.map((u) => [u.id, u]));
        for (const u of payload.users) userMap.set(u.id, u);
        finalUsers = Array.from(userMap.values());
      }
      saveUsers(finalUsers);
      setUsers(finalUsers);
    }

    // 3. Form Config & Schedules (if present in backup)
    if (Array.isArray(payload.masterRooms) && payload.masterRooms.length > 0) {
      saveMasterRooms(payload.masterRooms);
      setMasterRooms(payload.masterRooms);
      saveMasterRoomsToCloud(payload.masterRooms).catch(() => {});
    }
    if (Array.isArray(payload.masterChecklists) && payload.masterChecklists.length > 0) {
      saveMasterChecklists(payload.masterChecklists);
      setMasterChecklists(payload.masterChecklists);
      saveMasterChecklistsToCloud(payload.masterChecklists).catch(() => {});
    }
    if (payload.formSettings) {
      saveFormSettings(payload.formSettings);
      setFormSettings(payload.formSettings);
      saveFormSettingsToCloud(payload.formSettings).catch(() => {});
    }
    if (Array.isArray(payload.roomSchedules) && payload.roomSchedules.length > 0) {
      saveRoomSchedules(payload.roomSchedules);
      setRoomSchedules(payload.roomSchedules);
      saveRoomSchedulesToCloud(payload.roomSchedules).catch(() => {});
    }

    try {
      await batchRestoreReportsToCloud(finalReports);
      if (finalUsers) {
        await syncAllUsersToCloud(finalUsers);
      }
    } catch {
      showToast('Data dipulihkan lokal, sinkronisasi cloud gagal.', 'error');
      return;
    }
    showToast(
      `Berhasil memulihkan ${finalReports.length} laporan${finalUsers ? ` & ${finalUsers.length} akun` : ''}!`,
      'success'
    );
  };

  const handleLoginSuccess = (user: User) => {
    setUsers((prev) => {
      const emailLower = (user.email || '').trim().toLowerCase();
      const matched = prev.some(
        (u) => u.id === user.id || (emailLower && (u.email || '').trim().toLowerCase() === emailLower)
      );
      const next = matched
        ? prev.map((u) =>
            u.id === user.id || (emailLower && (u.email || '').trim().toLowerCase() === emailLower) ? user : u
          )
        : [...prev, user];
      saveUsers(next);
      return next;
    });
    setCurrentUser(user);
    setCurrentUserState(user);
    showToast(`Selamat datang, ${user.name}!`);
    if (user.role === 'petugas') {
      setActiveTab('input');
    }
  };

  const handleLogout = () => {
    clearCurrentUser();
    setCurrentUserState(null);
    setActiveTab('dashboard');
    if (auth.currentUser) {
      googleSignOut().catch(() => {});
    }
    setIsLoginModalOpen(false);
    showToast('Anda telah keluar. Sistem beralih ke halaman notifikasi publik.', 'info');
  };

  const officers = users.filter((u) => u.role === 'petugas' && u.isActive !== false);
  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.email === 'operasional.scb@gmail.com';

  if (!currentUser) {
    return (
      <>
        {toast && (
          <div className="fixed top-5 right-5 z-60 animate-in fade-in slide-in-from-top-4 duration-200">
            <div
              className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold ${
                toast.type === 'success'
                  ? 'bg-emerald-800 text-white border-emerald-700'
                  : toast.type === 'error'
                  ? 'bg-rose-800 text-white border-rose-700'
                  : 'bg-slate-800 text-white border-slate-700'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-300" />
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        )}
        <GuestLandingPage
          users={users}
          onLoginSuccess={(loggedInUser) => {
            setLoginModalPrompt('');
            handleLoginSuccess(loggedInUser);
          }}
          isFirestoreQuotaLimited={isFirestoreQuotaLimited}
          loginPromptNotice={loginModalPrompt}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-60 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-800 text-white border-emerald-700'
                : toast.type === 'error'
                ? 'bg-rose-800 text-white border-rose-700'
                : 'bg-slate-800 text-white border-slate-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-300" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        currentUser={currentUser}
        allUsers={users}
        activeTab={activeTab}
        setActiveTab={handleSafeTabChange}
        onSwitchUser={(user) => {
          setCurrentUser(user);
          setCurrentUserState(user);
          showToast(`Berhasil masuk sebagai ${user.name} (${user.role.toUpperCase()})`, 'success');
        }}
        onLogout={handleLogout}
        onOpenLoginModal={(reason) => handleOpenLoginModal(reason)}
        onRequestInputReport={handleRequestInputReport}
        isCloudSynced={Boolean(cloudUserEmail)}
        cloudUserEmail={cloudUserEmail}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'dashboard' && (
          <DashboardView
            reports={reports}
            currentUser={currentUser}
            officers={officers}
            allUsers={users}
            masterRooms={masterRooms}
            roomSchedules={roomSchedules}
            onAddNewReport={handleRequestInputReport}
            onUpdateReport={handleUpdateReport}
            onDeleteReport={handleDeleteReport}
            onOpenPrintModal={(filtered, periodeLabel) => {
              setPrintReportsData(filtered);
              setPrintPeriodeLabel(periodeLabel);
            }}
            onOpenLoginModal={handleOpenLoginModal}
            onSwitchUser={(user) => {
              setCurrentUser(user);
              setCurrentUserState(user);
              showToast(`Berhasil masuk sebagai ${user.name} (${user.role.toUpperCase()})`, 'success');
            }}
            isFirestoreQuotaLimited={isFirestoreQuotaLimited}
            isCloudSynced={Boolean(cloudUserEmail)}
            isAuthReady={isAuthReady}
            isGuestMode={!currentUser && !cloudUserEmail}
            pendingUnsyncedCount={pendingUnsyncedCount}
            onSyncPendingReports={handleSyncPendingReportsNow}
            onRefreshCloudReports={refreshReportsFromCloudNow}
            onLoadOlderReports={loadOlderReportsFromCloud}
            onLoadReportPhotos={fetchReportPhotosFromCloud}
          />
        )}

        {activeTab === 'input' && (
          currentUser ? (
            <ReportForm
              currentUser={currentUser}
              officers={officers}
              masterRooms={masterRooms}
              masterChecklists={masterChecklists}
              formSettings={formSettings}
              roomSchedules={roomSchedules}
              initialArea={preselectedArea}
              isCloudSynced={Boolean(cloudUserEmail)}
              isAuthReady={isAuthReady}
              onOpenLoginModal={handleOpenLoginModal}
              onRetryCloudSync={handleRetrySingleReportSync}
              onSubmitSuccess={async (newReport) => {
                const res = await handleAddNewReport(newReport);
                setPreselectedArea(null);
                return res;
              }}
              onViewDashboard={() => {
                setActiveTab('dashboard');
                setPreselectedArea(null);
              }}
            />
          ) : (
            <div className="max-w-md mx-auto my-14 p-6 sm:p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Akses Khusus Petugas Terjadwal</h3>
              <p className="text-xs text-slate-600 mt-2 mb-6 leading-relaxed">
                Non-user / Tamu hanya bisa melihat dashboard pemantauan. Untuk mengisi Formulir Laporan Kebersihan Kamar Mandi, silakan masuk ke akun Petugas Anda terlebih dahulu.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => handleOpenLoginModal('Silakan masuk ke akun Petugas Kebersihan untuk mengisi formulir.')}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-colors cursor-pointer"
                >
                  Masuk Akun Petugas
                </button>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Kembali ke Dashboard Laporan
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'form_mgmt' && (
          isSuperAdmin ? (
            <FormManagement
              rooms={masterRooms}
              checklists={masterChecklists}
              formSettings={formSettings}
              schedules={roomSchedules}
              officers={officers}
              allUsers={users}
              currentUser={currentUser}
              isCloudSynced={Boolean(cloudUserEmail)}
              onOpenLoginModal={handleOpenLoginModal}
              onSaveRooms={handleSaveRooms}
              onSaveChecklists={handleSaveChecklists}
              onSaveFormSettings={handleSaveFormSettings}
              onSaveSchedules={handleSaveSchedules}
              onShowToast={showToast}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-slate-200 text-center">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 text-base">Akses Khusus Super Admin</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Halaman pengelolaan form dan jadwal hanya dapat diakses oleh akun superadmin (operasional.scb@gmail.com).
              </p>
              <button
                onClick={() => handleOpenLoginModal('Masuk dengan akun Superadmin (operasional.scb).')}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
              >
                Masuk Akun Superadmin
              </button>
            </div>
          )
        )}

        {activeTab === 'accounts' && (
          isSuperAdmin ? (
            <AccountManagement
              users={users}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              isCloudSynced={Boolean(cloudUserEmail)}
              cloudUserEmail={cloudUserEmail}
              onConnectCloudSync={handleConnectCloudSync}
              onDisconnectCloudSync={handleDisconnectCloudSync}
              onSyncUsersNow={handleSyncUsersNow}
              onImportUsers={handleImportUsers}
              onSendPasswordReset={handleSendPasswordReset}
              onShowToast={showToast}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-slate-200 text-center">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 text-base">Akses Khusus Super Admin</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Halaman pengelolaan akun hanya dapat diakses oleh akun pengelola superadmin (operasional.scb@gmail.com).
              </p>
              <button
                onClick={() => handleOpenLoginModal('Masuk dengan akun Superadmin (operasional.scb).')}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
              >
                Masuk Akun Superadmin
              </button>
            </div>
          )
        )}

        {activeTab === 'drive' && (
          isSuperAdmin ? (
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <GoogleDriveManager
                reports={reports}
                users={users}
                masterRooms={masterRooms}
                masterChecklists={masterChecklists}
                formSettings={formSettings}
                roomSchedules={roomSchedules}
                onShowToast={showToast}
                onUpdateReport={handleUpdateReport}
                onRestoreFullBackup={handleRestoreFullBackup}
                onRestoreReports={(restoredReports) => {
                  saveReports(restoredReports);
                  setReports(restoredReports);
                  batchRestoreReportsToCloud(restoredReports).catch(() => {
                    showToast('Data dipulihkan lokal, sinkronisasi cloud gagal.', 'error');
                  });
                }}
                onResetData={() => {
                  clearUnsyncedTrackers();
                  saveReports([]);
                  setReports([]);
                  batchRestoreReportsToCloud([]).catch(() => {
                    showToast('Data lokal direset, sinkronisasi cloud gagal.', 'error');
                  });
                }}
              />
            </div>
          ) : (
            <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-slate-200 text-center">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 text-base">Akses Khusus Super Admin</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Pusat penyimpanan dan pencadangan data hanya dapat diakses oleh akun Super Admin (operasional.scb@gmail.com).
              </p>
              <button
                onClick={() => handleOpenLoginModal('Masuk dengan akun superadmin untuk mengakses Pusat Penyimpanan Data.')}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
              >
                Masuk Akun Superadmin
              </button>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">SIM-BERSIH SCB</span>
            <span>•</span>
            <span>Sekolah Cendekia BAZNAS (SCB)</span>
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-slate-400">
            <span>
              Petugas Aktif:{' '}
              {officers.filter((o) => o.isActive !== false).map((o) => o.name).join(' • ') || 'Petugas Kebersihan SCB'}
            </span>
            <span>•</span>
            <span>Superadmin: operasional.scb@gmail.com</span>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={users}
        onLoginSuccess={handleLoginSuccess}
        promptReason={loginModalPrompt}
      />

      {/* Print Document Modal */}
      {printReportsData && (
        <PrintModal
          isOpen={!!printReportsData}
          onClose={() => {
            setPrintReportsData(null);
            setPrintPeriodeLabel(undefined);
          }}
          reports={printReportsData}
          periodeLabel={printPeriodeLabel}
          currentUser={currentUser}
          officers={officers}
          supervisors={users.filter((u) => u.role === 'supervisor')}
        />
      )}
    </div>
  );
}
