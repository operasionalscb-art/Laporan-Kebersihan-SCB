import React, { useState, useEffect } from 'react';
import { 
  googleSignIn, 
  googleSignOut, 
  initGoogleAuth, 
  getGoogleAccessToken 
} from '../services/googleAuth';
import { 
  listDriveFiles, 
  getOrCreateScbDriveFolder, 
  backupReportsToGoogleDrive, 
  exportCsvToGoogleDrive, 
  deleteDriveFile,
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
  ShieldCheck, 
  HardDrive,
  FolderOpen
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface GoogleDriveManagerProps {
  reports: CleaningReport[];
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const GoogleDriveManager: React.FC<GoogleDriveManagerProps> = ({
  reports,
  onShowToast,
}) => {
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(false);

  // Drive state
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);

  // Destructive Delete Confirmation Modal State
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setIsConnected(true);
        loadFolderAndFiles(token);
      },
      () => {
        setGoogleUser(null);
        setIsConnected(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadFolderAndFiles = async (token?: string) => {
    setIsLoadingFiles(true);
    try {
      const folderId = await getOrCreateScbDriveFolder();
      setDriveFolderId(folderId);
      const files = await listDriveFiles(folderId);
      setDriveFiles(files);
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || 'Gagal memuat dokumen dari Google Drive', 'error');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleConnectGoogle = async () => {
    setIsLoadingAuth(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setIsConnected(true);
        onShowToast(`Terhubung dengan Google Drive: ${result.user.email}`);
        await loadFolderAndFiles(result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || 'Gagal menghubungkan Google Drive', 'error');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (window.confirm('Putuskan sambungan Google Drive dari aplikasi?')) {
      await googleSignOut();
      setGoogleUser(null);
      setIsConnected(false);
      setDriveFiles([]);
      setDriveFolderId(null);
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
      {/* Top Banner & Connection Card */}
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
                Integrasi Google Drive
              </h2>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Terhubung
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Belum Terhubung
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Media penyimpanan cloud resmi untuk sinkronisasi dokumen laporan, foto bukti kebersihan, backup database, dan rekapitulasi Sekolah Cendekia BAZNAS.
            </p>
            {googleUser && (
              <p className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1">
                <span>Akun Google:</span>
                <strong className="text-slate-800">{googleUser.email || googleUser.displayName}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Action Button: Sign In or Disconnect */}
        <div className="shrink-0 flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadFolderAndFiles()}
                disabled={isLoadingFiles}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                title="Segarkan daftar file"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleDisconnectGoogle}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
              >
                Putus Sambungan
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              disabled={isLoadingAuth}
              className="flex items-center space-x-2.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 shadow-xs hover:shadow transition-all"
            >
              {isLoadingAuth ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Menghubungkan...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Hubungkan Google Drive</span>
                </>
              )}
            </button>
          )}
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
                Backup Data Lengkap (JSON & Foto)
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

      {/* Google Drive Files List in Dedicated SCB Folder */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Folder: SIM-BERSIH SCB (Laporan Kebersihan)
              </h3>
              <p className="text-[11px] text-slate-500">
                Daftar berkas yang tersimpan di Google Drive Anda
              </p>
            </div>
          </div>

          {/* Search files in drive */}
          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari file di Google Drive..."
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
              Hubungkan akun Google Anda dengan menekan tombol di atas untuk mengakses media penyimpanan dokumen dan sinkronisasi data.
            </p>
            <button
              onClick={handleConnectGoogle}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              Hubungkan Akun Google Sekarang
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
            <p className="font-bold text-slate-700 text-sm">Folder Google Drive Masih Kosong</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Folder <strong className="text-slate-600">SIM-BERSIH SCB</strong> sudah berhasil dibuat. Anda dapat menyimpan rekapitulasi CSV atau backup data sekarang.
            </p>
            <button
              onClick={handleExportCsvToDrive}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
            >
              Unggah Rekap Pertama ke Drive
            </button>
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
                {filteredDriveFiles.map((file) => (
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
                        : file.mimeType.includes('json')
                        ? 'Data Backup JSON'
                        : file.mimeType}
                    </td>

                    <td className="py-3 px-4 text-slate-500">
                      {file.modifiedTime ? new Date(file.modifiedTime).toLocaleString('id-ID') : '-'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
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
                ))}
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
    </div>
  );
};
