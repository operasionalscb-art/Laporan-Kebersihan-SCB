import React, { useState, useEffect } from 'react';
import { 
  googleSignIn, 
  googleSignOut, 
  initGoogleAuth, 
  getGoogleAccessToken,
  getCurrentGoogleProfile,
  getSavedToken,
  parseAuthError,
  GoogleUserProfile 
} from '../services/googleAuth';
import { 
  listDriveFiles, 
  getOrCreateScbDriveFolder, 
  backupReportsToGoogleDrive, 
  exportCsvToGoogleDrive, 
  deleteDriveFile,
  getDriveFolderDetails,
  readJsonFromDrive,
  getConfiguredFolderId,
  setConfiguredFolderId,
  resetConfiguredFolderId,
  extractFolderId,
  DEFAULT_DATABASE_FOLDER_ID,
  DEFAULT_DATABASE_FOLDER_URL,
  DriveFileItem 
} from '../services/googleDriveService';
import { CleaningReport } from '../types';
import { 
  Cloud, 
  FolderCheck, 
  FileSpreadsheet, 
  FileText, 
  UploadCloud, 
  ExternalLink, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  HardDrive,
  FolderOpen,
  Settings,
  Database,
  Link2,
  RotateCcw,
  Check,
  LogOut
} from 'lucide-react';

interface GoogleDriveManagerProps {
  reports: CleaningReport[];
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onRestoreReports?: (reports: CleaningReport[]) => void;
}

export const GoogleDriveManager: React.FC<GoogleDriveManagerProps> = ({
  reports,
  onShowToast,
  onRestoreReports,
}) => {
  const [googleProfile, setGoogleProfile] = useState<GoogleUserProfile | null>(() => getCurrentGoogleProfile());
  const [isConnected, setIsConnected] = useState<boolean>(() => Boolean(getSavedToken()));
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(false);

  // Drive state & Database Folder
  const [driveFolderId, setDriveFolderId] = useState<string>(() => getConfiguredFolderId());
  const [folderName, setFolderName] = useState<string>('Folder Database SIM-BERSIH SCB');
  const [folderUrl, setFolderUrl] = useState<string>(DEFAULT_DATABASE_FOLDER_URL);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);
  const [inputFolderLink, setInputFolderLink] = useState<string>(DEFAULT_DATABASE_FOLDER_URL);
  const [isValidatingFolder, setIsValidatingFolder] = useState<boolean>(false);

  // Restore State
  const [restoringFile, setRestoringFile] = useState<DriveFileItem | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);

  // Error Alert State
  const [errorDetails, setErrorDetails] = useState<{ title: string; message: string; code?: string } | null>(null);

  // Destructive Delete Confirmation Modal State
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (profile, token) => {
        setGoogleProfile(profile);
        setIsConnected(true);
        setErrorDetails(null);
        loadFolderAndFiles(token);
      },
      () => {
        const existing = getCurrentGoogleProfile();
        const token = getSavedToken();
        if (existing && token) {
          setGoogleProfile(existing);
          setIsConnected(true);
          loadFolderAndFiles(token);
        } else {
          setGoogleProfile(null);
          setIsConnected(false);
        }
      }
    );

    // Initial load if already authenticated
    const activeToken = getSavedToken();
    if (activeToken) {
      loadFolderAndFiles(activeToken);
    }

    return () => unsubscribe();
  }, []);

  const loadFolderAndFiles = async (token?: string) => {
    const activeToken = token || (await getGoogleAccessToken());
    if (!activeToken) {
      setIsConnected(false);
      return;
    }

    setIsLoadingFiles(true);
    try {
      const folderId = await getOrCreateScbDriveFolder();
      setDriveFolderId(folderId);
      const details = await getDriveFolderDetails(folderId);
      setFolderName(details.name);
      setFolderUrl(details.webViewLink);
      const files = await listDriveFiles(folderId);
      setDriveFiles(files);
      setIsConnected(true);
      setErrorDetails(null);
    } catch (err: any) {
      console.error('Error loading drive files:', err);
      if (err.message?.includes('terautentikasi') || err.message?.includes('berakhir')) {
        setIsConnected(false);
        setErrorDetails({
          title: 'Perlu Otorisasi Akun Google',
          message: 'Sesi Google Drive telah berakhir atau belum terhubung. Silakan klik tombol Hubungkan Google Drive.',
        });
      } else {
        onShowToast(err.message || 'Gagal memuat dokumen dari Google Drive', 'error');
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSaveCustomFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputFolderLink.trim()) return;

    setIsValidatingFolder(true);
    try {
      const cleanId = setConfiguredFolderId(inputFolderLink.trim());
      setDriveFolderId(cleanId);
      const details = await getDriveFolderDetails(cleanId);
      setFolderName(details.name);
      setFolderUrl(details.webViewLink);
      setIsFolderModalOpen(false);
      onShowToast(`Database terhubung ke folder: ${details.name} (ID: ${cleanId})`, 'success');
      if (isConnected) {
        await loadFolderAndFiles();
      }
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || 'Gagal mengatur folder Google Drive', 'error');
    } finally {
      setIsValidatingFolder(false);
    }
  };

  const handleResetToDefaultFolder = async () => {
    resetConfiguredFolderId();
    setInputFolderLink(DEFAULT_DATABASE_FOLDER_URL);
    setDriveFolderId(DEFAULT_DATABASE_FOLDER_ID);
    setFolderUrl(DEFAULT_DATABASE_FOLDER_URL);
    setFolderName('Folder Database SIM-BERSIH SCB');
    setIsFolderModalOpen(false);
    onShowToast('Folder database dikembalikan ke folder bawaan SCB (1EW55LPCuje5G3OOB4oiMpd5JGnTf3H5Z).', 'info');
    if (isConnected) {
      await loadFolderAndFiles();
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoringFile) return;
    setIsRestoring(true);
    try {
      const data = await readJsonFromDrive<any>(restoringFile.id);
      if (!data || !Array.isArray(data.reports)) {
        throw new Error('Format file backup tidak valid. Dokumen harus memuat daftar laporan ("reports").');
      }
      if (onRestoreReports) {
        onRestoreReports(data.reports);
      }
      onShowToast(`Berhasil memulihkan ${data.reports.length} laporan dari arsip Google Drive!`, 'success');
      setRestoringFile(null);
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || 'Gagal memulihkan database dari Google Drive', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleConnectGoogle = async () => {
    setIsLoadingAuth(true);
    setErrorDetails(null);
    try {
      const result = await googleSignIn('auto');
      if (result) {
        setGoogleProfile(result.profile);
        setIsConnected(true);
        setErrorDetails(null);
        onShowToast(`Terhubung dengan Google Drive: ${result.profile.email}`, 'success');
        await loadFolderAndFiles(result.accessToken);
      }
    } catch (err: any) {
      console.error('Connection attempt failed:', err);
      const parsed = parseAuthError(err);
      setErrorDetails({
        title: parsed.title,
        message: parsed.message,
        code: parsed.code,
      });
      onShowToast(parsed.message, 'error');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (window.confirm('Putuskan sambungan Google Drive dari aplikasi?')) {
      await googleSignOut();
      setGoogleProfile(null);
      setIsConnected(false);
      setDriveFiles([]);
      setDriveFolderId(DEFAULT_DATABASE_FOLDER_ID);
      setErrorDetails(null);
      onShowToast('Sambungan Google Drive diputuskan.', 'info');
    }
  };

  const handleBackupAllReports = async () => {
    if (!isConnected) {
      onShowToast('Silakan hubungkan akun Google terlebih dahulu.', 'error');
      return;
    }

    setIsBackingUp(true);
    try {
      const folderId = driveFolderId || (await getOrCreateScbDriveFolder());
      const res = await backupReportsToGoogleDrive(reports, folderId);
      onShowToast(`Backup berhasil disimpan ke Google Drive: ${res.name}`, 'success');
      await loadFolderAndFiles();
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || 'Gagal melakukan backup ke Google Drive', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleExportCsvToDrive = async () => {
    if (!isConnected) {
      onShowToast('Silakan hubungkan akun Google terlebih dahulu.', 'error');
      return;
    }

    setIsExportingCsv(true);
    try {
      const folderId = driveFolderId || (await getOrCreateScbDriveFolder());
      const res = await exportCsvToGoogleDrive(reports, folderId);
      onShowToast(`Rekap CSV berhasil diunggah ke Google Drive: ${res.name}`, 'success');
      await loadFolderAndFiles();
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || 'Gagal mengunggah CSV ke Google Drive', 'error');
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Mandatory Explicit Confirmation for Destructive Deletion
  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;

    setIsDeleting(true);
    try {
      await deleteDriveFile(fileToDelete.id);
      onShowToast(`File "${fileToDelete.name}" berhasil dihapus dari Google Drive.`, 'info');
      setFileToDelete(null);
      await loadFolderAndFiles();
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || 'Gagal menghapus file', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDriveFiles = driveFiles.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Connection Status Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-emerald-500 to-amber-500 p-0.5 shadow-sm shrink-0">
            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-slate-800" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Integrasi Cloud Google Drive
              </h2>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Terhubung Aktif
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  Belum Terhubung
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Media penyimpanan cloud resmi untuk sinkronisasi dokumen laporan, foto bukti kebersihan, backup database, dan rekapitulasi Sekolah Cendekia BAZNAS.
            </p>
            {googleProfile && isConnected && (
              <div className="text-[11px] text-slate-600 mt-2 flex items-center gap-2">
                {googleProfile.photoURL ? (
                  <img src={googleProfile.photoURL} alt="Avatar" className="w-5 h-5 rounded-full border border-slate-200" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">
                    {googleProfile.displayName.charAt(0)}
                  </div>
                )}
                <span>Akun Google:</span>
                <strong className="text-slate-800">{googleProfile.email}</strong>
                <span className="text-slate-400">({googleProfile.displayName})</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button: Connect / Disconnect */}
        <div className="shrink-0 flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadFolderAndFiles()}
                disabled={isLoadingFiles}
                className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                title="Refresh Dokumen"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
              <button
                onClick={handleDisconnectGoogle}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Putus Sambungan</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              disabled={isLoadingAuth}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs hover:shadow transition-all disabled:opacity-50"
            >
              {isLoadingAuth ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menghubungkan...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  <span>Hubungkan Akun Google</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ERROR NOTIFICATION BANNER */}
      {errorDetails && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-amber-950">
                  {errorDetails.title}
                </h3>
              </div>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                {errorDetails.message}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleConnectGoogle}
                  disabled={isLoadingAuth}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Hubungkan Ulang Google Drive</span>
                </button>
                <button
                  onClick={() => setErrorDetails(null)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED GOOGLE DRIVE DATABASE FOLDER CARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-5 sm:p-6 rounded-2xl shadow-md border border-slate-700/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-52 h-52 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Database className="w-3.5 h-3.5" />
                Folder Database Utama
              </span>
              <span className="text-[11px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                ID: {driveFolderId || DEFAULT_DATABASE_FOLDER_ID}
              </span>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{folderName}</span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
                Folder Google Drive ini ditetapkan sebagai lokasi penyimpanan database dan arsip laporan kebersihan Sekolah Cendekia BAZNAS (SCB).
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-200/90 font-mono break-all pt-1">
              <Link2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <a 
                href={folderUrl} 
                target="_blank" 
                rel="noreferrer"
                className="underline hover:text-white transition-colors truncate max-w-md sm:max-w-xl"
                title={folderUrl}
              >
                {folderUrl}
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={folderUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Buka Folder di Drive</span>
            </a>

            <button
              onClick={() => {
                setInputFolderLink(folderUrl);
                setIsFolderModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl border border-white/15 transition-all"
            >
              <Settings className="w-4 h-4 text-emerald-300" />
              <span>Atur / Ganti Link Folder</span>
            </button>

            <button
              onClick={() => loadFolderAndFiles()}
              disabled={isLoadingFiles}
              className="inline-flex items-center space-x-1.5 px-3 py-2.5 bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white font-medium text-xs rounded-xl border border-white/10 transition-all"
              title="Refresh isi folder database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cloud Sync Actions Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sync / Export CSV */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Simpan Rekapitulasi (CSV) ke Drive
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Otomatis mengonversi dan menyimpan rekapitulasi data laporan saat ini ke spreadsheet Google Drive.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Total {reports.length} laporan siap</span>
            <button
              onClick={handleExportCsvToDrive}
              disabled={isExportingCsv || !isConnected}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              {isExportingCsv ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengunggah...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Simpan ke Drive</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Full JSON Backup */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
              <FolderCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Backup Data Lengkap (JSON Database)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Arsipkan seluruh riwayat kebersihan, catatan supervisor, dan status verifikasi ke folder Google Drive.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Arsip aman terenkripsi</span>
            <button
              onClick={handleBackupAllReports}
              disabled={isBackingUp || !isConnected}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              {isBackingUp ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Buat Backup Drive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Google Drive Files List in Database Folder */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Berkas di Folder Database: {folderName}
              </h3>
              <p className="text-[11px] text-slate-500">
                Target Folder: <code className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{driveFolderId || DEFAULT_DATABASE_FOLDER_ID}</code>
              </p>
            </div>
          </div>

          {/* Search files in drive */}
          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari file di folder database..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Files Table / States */}
        {!isConnected ? (
          <div className="p-12 text-center text-slate-500">
            <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700 text-sm">Google Drive Belum Terhubung</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Hubungkan akun Google Anda untuk mengakses media penyimpanan dokumen, rekapitulasi data, dan pencadangan.
            </p>
            <button
              onClick={handleConnectGoogle}
              disabled={isLoadingAuth}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors inline-flex items-center gap-2"
            >
              {isLoadingAuth ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menghubungkan...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  <span>Hubungkan Akun Google Drive</span>
                </>
              )}
            </button>
          </div>
        ) : isLoadingFiles ? (
          <div className="p-12 text-center text-slate-500 flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <span className="text-xs">Memuat dokumen dari Google Drive...</span>
          </div>
        ) : filteredDriveFiles.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FolderCheck className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
            <p className="font-bold text-slate-700 text-sm">Folder Database Masih Kosong</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Folder <strong className="text-slate-700">{folderName}</strong> sudah aktif. Anda dapat menyimpan rekapitulasi CSV atau membuat backup data sekarang.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleExportCsvToDrive}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Unggah Rekap CSV ke Drive
              </button>
              <button
                onClick={handleBackupAllReports}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Buat Backup JSON ke Drive
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Nama Dokumen</th>
                  <th className="py-3 px-4">Tipe Berkas</th>
                  <th className="py-3 px-4">Waktu Modifikasi</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredDriveFiles.map((file) => {
                  const isJson = file.name.toLowerCase().endsWith('.json') || file.mimeType.includes('json');
                  return (
                    <tr key={file.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {file.mimeType.includes('csv') || file.mimeType.includes('sheet') ? (
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                          <span className="font-bold text-slate-800">{file.name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-500">
                        {file.mimeType.includes('csv')
                          ? 'Spreadsheet / CSV'
                          : isJson
                          ? 'Data Backup JSON'
                          : file.mimeType}
                      </td>

                      <td className="py-3 px-4 text-slate-500">
                        {file.modifiedTime ? new Date(file.modifiedTime).toLocaleString('id-ID') : '-'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isJson && (
                            <button
                              onClick={() => setRestoringFile(file)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
                              title="Pulihkan dan sinkronkan data laporan dari file backup ini"
                            >
                              <RotateCcw className="w-3 h-3 text-emerald-600" />
                              <span>Pulihkan Data</span>
                            </button>
                          )}

                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <span>Buka di Drive</span>
                              <ExternalLink className="w-3 h-3 text-slate-500" />
                            </a>
                          )}

                          {/* Explicit User Confirmation for Destructive Deletion */}
                          <button
                            onClick={() => setFileToDelete(file)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus file ini dari Google Drive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MANDATORY EXPLICIT CONFIRMATION MODAL FOR DESTRUCTIVE DELETION */}
      {fileToDelete && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Konfirmasi Hapus File Google Drive
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus berkas <strong className="text-slate-900">{fileToDelete.name}</strong> dari Google Drive Anda? Tindakan ini akan memindahkan berkas ke tempat sampah Google Drive.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 font-mono">
              ID File: {fileToDelete.id}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteFile}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENGATURAN FOLDER DATABASE GOOGLE DRIVE */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Tautkan Folder Database Google Drive
                  </h3>
                  <p className="text-xs text-slate-500">
                    Atur link atau ID folder tujuan penyimpanan data SIM-BERSIH SCB
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFolderModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tautan (Link) atau ID Folder Google Drive:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="https://drive.google.com/drive/folders/1EW55LPCuje5G3OOB4oiMpd5JGnTf3H5Z..."
                    value={inputFolderLink}
                    onChange={(e) => setInputFolderLink(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                  <span className="font-medium">ID Folder Terdeteksi:</span>
                  <code className="font-bold font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-emerald-300">
                    {extractFolderId(inputFolderLink)}
                  </code>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="font-semibold text-slate-700">💡 Informasi Folder Database:</p>
                <p>
                  Seluruh berkas arsip, rekapitulasi CSV, backup JSON, dan foto bukti akan otomatis diunggah dan disimpan ke dalam folder ini.
                </p>
                <p className="text-[11px] text-slate-400">
                  Pastikan akun Google yang Anda hubungkan (<strong className="text-slate-600">{googleProfile?.email || 'operasional.scb@gmail.com'}</strong>) memiliki hak akses minimal sebagai Editor pada folder tersebut.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={handleResetToDefaultFolder}
                  className="w-full sm:w-auto px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  Pakai Folder Bawaan SCB
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsFolderModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isValidatingFolder}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {isValidatingFolder ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Memverifikasi...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan & Terapkan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI PEMULIHAN DATABASE DARI GOOGLE DRIVE */}
      {restoringFile && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-emerald-700">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Pulihkan Database Laporan
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Anda akan memulihkan data laporan kebersihan dari arsip Google Drive berikut:
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-slate-800">{restoringFile.name}</p>
              <p className="text-slate-500 text-[11px]">
                Waktu Arsip: {restoringFile.modifiedTime ? new Date(restoringFile.modifiedTime).toLocaleString('id-ID') : '-'}
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              ⚠️ <strong>Perhatian:</strong> Seluruh riwayat laporan kebersihan saat ini akan disinkronkan dan digantikan dengan data yang ada di dalam berkas backup ini.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRestoringFile(null)}
                disabled={isRestoring}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors flex items-center gap-1.5"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Memulihkan Data...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ya, Pulihkan Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
