import React, { useState, useRef, useMemo } from 'react';
import { CleaningReport } from '../types';
import { 
  DEFAULT_DATABASE_FOLDER_ID,
  DEFAULT_DATABASE_FOLDER_URL,
  isAutoBackupEnabled,
  setAutoBackupEnabled,
  isAutoPhotosUploadEnabled,
  setAutoPhotosUploadEnabled,
  executeAutoBackupToDrive,
  batchUploadAllReportsPhotosToDrive
} from '../services/googleDriveService';
import { 
  googleSignIn, 
  getGoogleAccessToken,
  getSavedToken,
  getCurrentGoogleProfile,
  GoogleUserProfile 
} from '../services/googleAuth';
import { 
  HardDrive, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  FileJson, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  Database, 
  Trash2, 
  FolderOpen, 
  Settings, 
  Check, 
  ShieldCheck, 
  Cloud, 
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
  Camera,
  Image as ImageIcon,
  Loader2,
  CheckCheck
} from 'lucide-react';

interface StorageBackupManagerProps {
  reports: CleaningReport[];
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onRestoreReports?: (reports: CleaningReport[]) => void;
  onResetData?: () => void;
}

export const StorageBackupManager: React.FC<StorageBackupManagerProps> = ({
  reports,
  onShowToast,
  onRestoreReports,
  onResetData,
}) => {
  // Configured Cloud Folder (Permanently fixed to official SCB folder)
  const folderId = DEFAULT_DATABASE_FOLDER_ID;
  const folderUrl = DEFAULT_DATABASE_FOLDER_URL;

  // File Upload / Restore State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewRestoreData, setPreviewRestoreData] = useState<{
    fileName: string;
    totalReports: number;
    backupTimestamp?: string;
    appName?: string;
    reports: CleaningReport[];
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');

  // Reset Confirmation State
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Google Drive Direct Sync (Permanent SCB Account)
  const [googleProfile, setGoogleProfile] = useState<GoogleUserProfile>(() => getCurrentGoogleProfile() || {
    email: 'operasional.scb@gmail.com',
    displayName: 'Operasional SCB',
    authMethod: 'gis',
  });
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(() => Boolean(getSavedToken()));
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  // Auto-backup & Auto-upload photo toggles
  const [autoBackupEnabled, setAutoBackupState] = useState<boolean>(() => isAutoBackupEnabled());
  const [autoPhotosEnabled, setAutoPhotosState] = useState<boolean>(() => isAutoPhotosUploadEnabled());
  const [isBackingUpToDrive, setIsBackingUpToDrive] = useState(false);
  const [isUploadingBatchPhotos, setIsUploadingBatchPhotos] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Count pending local photos that can be uploaded
  const pendingLocalPhotosCount = useMemo(() => {
    let count = 0;
    for (const r of reports) {
      count += (r.fotoBukti || []).filter((p) => p && p.startsWith('data:image/')).length;
    }
    return count;
  }, [reports]);

  // Calculate local storage size
  const databaseStats = useMemo(() => {
    const rawData = JSON.stringify(reports);
    const bytes = new Blob([rawData]).size;
    const kb = (bytes / 1024).toFixed(1);
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    const sizeDisplay = bytes > 1024 * 1024 ? `${mb} MB` : `${kb} KB`;

    const verifiedCount = reports.filter((r) => r.statusVerifikasi === 'Disetujui').length;
    const pendingCount = reports.length - verifiedCount;

    return {
      sizeDisplay,
      bytes,
      total: reports.length,
      verifiedCount,
      pendingCount,
      lastUpdated: reports.length > 0 ? `${reports[0].tanggal} ${reports[0].waktu || ''}` : '-',
    };
  }, [reports]);

  // Direct 1-Click JSON Backup Download
  const handleDownloadJsonBackup = () => {
    try {
      const payload = {
        appName: 'SIM-BERSIH SCB',
        institution: 'Sekolah Cendekia BAZNAS (SCB)',
        exportDate: new Date().toISOString(),
        version: '2.0',
        totalReports: reports.length,
        reports,
      };

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Backup_SIM_BERSIH_SCB_${dateStr}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onShowToast(`File cadangan database berhasil diunduh: ${filename}`, 'success');
    } catch (err: any) {
      console.error(err);
      onShowToast('Gagal mengunduh file cadangan', 'error');
    }
  };

  // Direct 1-Click CSV / Spreadsheet Export Download
  const handleDownloadCsvExport = () => {
    try {
      const headers = [
        'ID Laporan',
        'Tanggal',
        'Waktu',
        'Nama Petugas',
        'Area Kebersihan',
        'Kondisi Akhir',
        'Daftar Checklist',
        'Keterangan Tambahan',
        'Status Verifikasi',
        'Catatan Supervisor',
      ];

      const rows = reports.map((r) => [
        r.id,
        r.tanggal,
        r.waktu,
        `"${r.namaPetugas}"`,
        `"${r.isAreaOther ? r.areaCustom || r.area : r.area}"`,
        `"${r.kondisiAkhir}"`,
        `"${r.checklist.join('; ')}"`,
        `"${(r.keteranganTambahan || '').replace(/"/g, '""')}"`,
        `"${r.statusVerifikasi}"`,
        `"${(r.catatanSupervisor || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Rekap_Laporan_Kebersihan_SCB_${dateStr}.csv`;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onShowToast(`Rekap CSV berhasil diunduh: ${filename}`, 'success');
    } catch (err: any) {
      console.error(err);
      onShowToast('Gagal mengunduh rekap CSV', 'error');
    }
  };

  // Handle File Selection for Restore
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        let reportsArray: CleaningReport[] = [];
        if (Array.isArray(parsed)) {
          reportsArray = parsed;
        } else if (parsed && Array.isArray(parsed.reports)) {
          reportsArray = parsed.reports;
        } else {
          throw new Error('Berkas tidak memuat daftar laporan yang valid.');
        }

        // Validate basic structure
        if (reportsArray.length === 0) {
          throw new Error('Berkas cadangan kosong (0 laporan).');
        }

        setPreviewRestoreData({
          fileName: file.name,
          totalReports: reportsArray.length,
          backupTimestamp: parsed.exportDate || parsed.backupTimestamp,
          appName: parsed.appName || 'SIM-BERSIH SCB',
          reports: reportsArray,
        });

        onShowToast(`File cadangan valid (${reportsArray.length} laporan ditemukan). Silakan konfirmasi pemulihan.`, 'info');
      } catch (err: any) {
        console.error(err);
        onShowToast(err.message || 'Format file JSON cadangan tidak valid.', 'error');
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  // Confirm and Apply Restore
  const handleApplyRestore = () => {
    if (!previewRestoreData || !onRestoreReports) return;

    try {
      if (restoreMode === 'replace') {
        onRestoreReports(previewRestoreData.reports);
        onShowToast(`Berhasil memulihkan ${previewRestoreData.reports.length} laporan ke sistem!`, 'success');
      } else {
        // Merge mode: combine without duplicates based on ID
        const existingIds = new Set(reports.map((r) => r.id));
        const newReports = previewRestoreData.reports.filter((r) => !existingIds.has(r.id));
        const merged = [...newReports, ...reports];
        onRestoreReports(merged);
        onShowToast(`Berhasil menggabungkan ${newReports.length} laporan baru ke sistem!`, 'success');
      }

      setPreviewRestoreData(null);
    } catch (err: any) {
      console.error(err);
      onShowToast('Gagal memulihkan data', 'error');
    }
  };

  // Connect or refresh Google Drive session
  const handleConnectGoogleAuth = async () => {
    setIsLoadingGoogle(true);
    try {
      const result = await googleSignIn('gis');
      if (result?.accessToken) {
        setGoogleProfile(result.profile);
        setIsGoogleConnected(true);
        onShowToast(`Koneksi aktif! Akun ${result.profile.email} berhasil diotorisasi.`, 'success');

        // Immediately backup current reports into Google Drive folder!
        if (reports.length > 0) {
          try {
            const res = await executeAutoBackupToDrive(reports, folderId);
            onShowToast(`☁️ Berkas cadangan (${res.name}) otomatis disimpan di folder Google Drive!`, 'success');
          } catch (syncErr: any) {
            console.warn('Initial backup after connect error:', syncErr);
          }
        }
      }
    } catch (err: any) {
      console.warn('Google sign in error:', err);
      onShowToast(err.message || 'Gagal menghubungkan Google Drive.', 'error');
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  // Toggle Auto-Backup
  const handleToggleAutoBackup = () => {
    const next = !autoBackupEnabled;
    setAutoBackupState(next);
    setAutoBackupEnabled(next);
    onShowToast(
      next
        ? 'Pencadangan otomatis data (JSON) ke Google Drive diaktifkan.'
        : 'Pencadangan otomatis ke Google Drive dinonaktifkan.',
      'info'
    );
  };

  // Toggle Auto-Photos
  const handleToggleAutoPhotos = () => {
    const next = !autoPhotosEnabled;
    setAutoPhotosState(next);
    setAutoPhotosUploadEnabled(next);
    onShowToast(
      next
        ? 'Unggah foto bukti otomatis ke Google Drive diaktifkan.'
        : 'Unggah foto bukti otomatis ke Google Drive dinonaktifkan.',
      'info'
    );
  };

  // 1-Click Manual Drive Backup
  const handleManualDriveBackup = async () => {
    setIsBackingUpToDrive(true);
    try {
      let token = await getGoogleAccessToken();
      if (!token) {
        onShowToast('Membuka otorisasi Google Drive...', 'info');
        const loginRes = await googleSignIn('gis');
        token = loginRes?.accessToken;
        setIsGoogleConnected(true);
        setGoogleProfile(loginRes.profile);
      }

      const res = await executeAutoBackupToDrive(reports, folderId);
      setIsGoogleConnected(true);
      onShowToast(`Berkas cadangan berhasil diunggah ke Google Drive: ${res.name}`, 'success');
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || 'Gagal mencadangkan data ke Google Drive', 'error');
    } finally {
      setIsBackingUpToDrive(false);
    }
  };

  // 1-Click Batch Upload Photos to Google Drive
  const handleBatchUploadPhotos = async () => {
    if (pendingLocalPhotosCount === 0) {
      onShowToast('Semua foto sudah tersimpan di Google Drive!', 'info');
      return;
    }

    setIsUploadingBatchPhotos(true);
    setBatchProgress({ current: 0, total: pendingLocalPhotosCount });

    try {
      let token = await getGoogleAccessToken();
      if (!token) {
        onShowToast('Membuka otorisasi Google Drive...', 'info');
        const loginRes = await googleSignIn('gis');
        token = loginRes?.accessToken;
        setIsGoogleConnected(true);
        setGoogleProfile(loginRes.profile);
      }

      const result = await batchUploadAllReportsPhotosToDrive(reports, (cur, tot) => {
        setBatchProgress({ current: cur, total: tot });
      });

      if (onRestoreReports && result.updatedReports) {
        onRestoreReports(result.updatedReports);
      }

      setIsGoogleConnected(true);
      onShowToast(`Berhasil mengunggah ${result.totalUploaded} foto ke folder Google Drive!`, 'success');
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || 'Gagal mengunggah foto ke Google Drive', 'error');
    } finally {
      setIsUploadingBatchPhotos(false);
      setBatchProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input for Restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Main Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-800 p-0.5 shadow-sm shrink-0">
            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
              <Database className="w-6 h-6 text-emerald-700" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Pusat Penyimpanan & Pencadangan Data
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Penyimpanan Mandiri Aktif
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Metode penyimpanan mandiri yang stabil dan mudah dikelola. Seluruh data laporan kebersihan tersimpan aman di sistem lokal, siap dicadangkan (.JSON) atau diekspor ke Spreadsheet (.CSV) kapan saja tanpa bergantung pada koneksi pihak ketiga.
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadJsonBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Cadangkan Data (JSON)</span>
          </button>
          <button
            onClick={handleDownloadCsvExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Database Overview & Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Reports */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Total Data Laporan</span>
            <span className="text-xl font-bold text-slate-900">{databaseStats.total} Laporan</span>
          </div>
        </div>

        {/* Database Size */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Ukuran Memori Data</span>
            <span className="text-xl font-bold text-slate-900">{databaseStats.sizeDisplay}</span>
          </div>
        </div>

        {/* Verified Status */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Status Verifikasi</span>
            <span className="text-xs font-bold text-slate-800">
              <span className="text-emerald-600">{databaseStats.verifiedCount} Terverifikasi</span> •{' '}
              <span className="text-amber-600">{databaseStats.pendingCount} Menunggu</span>
            </span>
          </div>
        </div>

        {/* Last Updated */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Terakhir Diperbarui</span>
            <span className="text-xs font-bold text-slate-800">{databaseStats.lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* RESTORE PREVIEW MODAL / BANNER */}
      {previewRestoreData && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 shadow-sm animate-in fade-in duration-150 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  Konfirmasi Pemulihan Berkas Cadangan
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Berkas cadangan <strong className="font-mono">{previewRestoreData.fileName}</strong> siap dipulihkan ke sistem.
                </p>
              </div>
            </div>
            <button
              onClick={() => setPreviewRestoreData(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1 rounded-lg"
            >
              ✕
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 text-xs space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block text-[11px]">Jumlah Laporan:</span>
                <span className="font-bold text-slate-800">{previewRestoreData.totalReports} Laporan</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Waktu Cadangan:</span>
                <span className="font-bold text-slate-800">
                  {previewRestoreData.backupTimestamp ? new Date(previewRestoreData.backupTimestamp).toLocaleString('id-ID') : 'Tercatat dalam berkas'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Aplikasi Asal:</span>
                <span className="font-bold text-slate-800">{previewRestoreData.appName}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="restore_mode"
                    checked={restoreMode === 'replace'}
                    onChange={() => setRestoreMode('replace')}
                    className="text-emerald-600"
                  />
                  <span className="font-semibold text-slate-700">Timpa Seluruh Data Saat Ini</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="restore_mode"
                    checked={restoreMode === 'merge'}
                    onChange={() => setRestoreMode('merge')}
                    className="text-emerald-600"
                  />
                  <span className="font-semibold text-slate-700">Gabungkan dengan Data yang Ada</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewRestoreData(null)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleApplyRestore}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Terapkan Pemulihan Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2-COLUMN MANAGEMENT SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: PENCADANGAN BERKAS MANDIRI (100% RELIABLE) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Pencadangan & Ekspor Mandiri
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Simpan file arsip langsung ke komputer atau HP Anda dalam satu klik.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* JSON Backup Button */}
            <div className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <FileJson className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Cadangan Lengkap Database (.JSON)</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Memuat seluruh laporan, foto bukti, checklist, dan status verifikasi. Format resmi untuk pemulihan data.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadJsonBackup}
                className="shrink-0 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh JSON</span>
              </button>
            </div>

            {/* CSV Export Button */}
            <div className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Rekapitulasi Spreadsheet (.CSV)</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tabel data siap dibuka langsung di Microsoft Excel, Google Sheets, atau aplikasi laporan lainnya.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadCsvExport}
                className="shrink-0 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Unduh CSV</span>
              </button>
            </div>
          </div>

          {/* Restore Trigger Section */}
          <div className="pt-2 border-t border-slate-100">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Pulihkan Data dari Berkas (.JSON)</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Unggah file cadangan sebelumnya untuk mengembalikan atau menggabungkan riwayat laporan.
                  </p>
                </div>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pilih Berkas Cadangan</span>
              </button>
            </div>
          </div>
        </div>

        {/* CARD 2: PENYIMPANAN CLOUD GOOGLE DRIVE SCB (ARSIP EKSTERNAL OTOMATIS) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">
                      Cloud Google Drive SCB
                    </h3>
                    {isGoogleConnected ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Tersimpan & Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        Perlu Diaktifkan
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Penyimpanan otomatis berkas cadangan data (.JSON) dan foto dokumentasi ke folder resmi SCB.
                  </p>
                </div>
              </div>
            </div>

            {/* Google Drive Account Authorization Box */}
            {!isGoogleConnected ? (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-950">
                      Otorisasi Google Drive Diperlukan (1x di Browser Ini)
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                      Agar laporan kebersihan dan foto dokumentasi <strong>otomatis tersimpan langsung di folder Google Drive resmi</strong>, silakan izinkan akses ke akun <strong>operasional.scb@gmail.com</strong> dengan menekan tombol di bawah.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConnectGoogleAuth}
                  disabled={isLoadingGoogle}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  {isLoadingGoogle ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menghubungkan ke Google Drive...</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-4 h-4" />
                      <span>Aktifkan Sinkronisasi Otomatis Google Drive</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      G
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {googleProfile.displayName || 'Operasional SCB'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-white border border-emerald-200 px-1.5 py-0.2 rounded-full">
                          <Check className="w-2.5 h-2.5" />
                          Terhubung & Aktif
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block font-mono">
                        {googleProfile.email || 'operasional.scb@gmail.com'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleConnectGoogleAuth}
                    disabled={isLoadingGoogle}
                    className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 bg-white hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-300 flex items-center gap-1.5"
                    title="Perbarui Sesi Google Drive"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingGoogle ? 'animate-spin' : ''}`} />
                    <span>{isLoadingGoogle ? 'Memperbarui...' : 'Perbarui Sesi'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 text-[11px] text-emerald-800">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Sinkronisasi otomatis aktif. Setiap laporan baru akan langsung tersimpan di folder Google Drive.</span>
                  </span>
                </div>
              </div>
            )}

            {/* AUTOMATION TOGGLES SECTION */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Otomatisasi Input & Cadangan:
              </span>

              {/* Toggle 1: Auto Backup Reports */}
              <div
                onClick={handleToggleAutoBackup}
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 transition-all flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${autoBackupEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    <FileJson className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Otomatis Cadangkan Data (.JSON)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Perbarui arsip JSON di Google Drive secara otomatis saat laporan baru disimpan.
                    </p>
                  </div>
                </div>
                <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${autoBackupEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${autoBackupEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>

              {/* Toggle 2: Auto Upload Photos */}
              <div
                onClick={handleToggleAutoPhotos}
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 transition-all flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${autoPhotosEnabled ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Otomatis Upload Foto Dokumentasi
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Unggah foto bukti langsung ke folder Google Drive & tautkan ke laporan.
                    </p>
                  </div>
                </div>
                <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${autoPhotosEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${autoPhotosEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>

            {/* MANUAL DRIVE ACTION BUTTONS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleManualDriveBackup}
                disabled={isBackingUpToDrive || !isGoogleConnected}
                className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                title={!isGoogleConnected ? 'Hubungkan Akun Google terlebih dahulu' : 'Cadangkan data ke Google Drive sekarang'}
              >
                {isBackingUpToDrive ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mencadangkan...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Cadangkan ke Drive Sekarang</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBatchUploadPhotos}
                disabled={isUploadingBatchPhotos || !isGoogleConnected || pendingLocalPhotosCount === 0}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 border border-transparent"
                title={!isGoogleConnected ? 'Hubungkan Akun Google terlebih dahulu' : 'Upload semua foto lokal ke Google Drive'}
              >
                {isUploadingBatchPhotos ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      Mengunggah ({batchProgress?.current || 0}/{batchProgress?.total || 0})...
                    </span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>
                      Upload Foto Tertunda ({pendingLocalPhotosCount})
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Folder Info Box */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-emerald-600" />
                  <span>Folder Database Resmi SCB</span>
                </span>
                <span className="font-mono text-[10px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                  ID: {folderId}
                </span>
              </div>

              <div className="text-[11px] text-slate-500 font-mono truncate bg-white p-2 rounded-lg border border-slate-200">
                {folderUrl}
              </div>

              {/* Direct Link to Google Drive Folder */}
              <div className="pt-1">
                <a
                  href={folderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buka Folder Google Drive SCB di Tab Baru</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: PERAWATAN DATABASE & BERSIHKAN DATA */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Perawatan & Pembersihan Riwayat Laporan</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Bersihkan seluruh data laporan di sistem untuk memulai pencatatan periode baru. Sistem akan secara otomatis mengunduh salinan cadangan terlebih dahulu sebelum data dihapus.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsResetConfirmOpen(true)}
          className="shrink-0 px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Cadangkan & Reset Data</span>
        </button>
      </div>

      {/* MODAL RESET CONFIRMATION */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Konfirmasi Reset Data Laporan
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan mengosongkan seluruh riwayat laporan kebersihan saat ini ({reports.length} laporan). Untuk menjaga keamanan arsip, berkas cadangan JSON akan otomatis diunduh ke komputer Anda sebelum data dikosongkan.
            </p>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              ⚠️ Data akun petugas dan superadmin tetap tersimpan dan tidak akan terhapus.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDownloadJsonBackup();
                  if (onResetData) {
                    onResetData();
                  } else if (onRestoreReports) {
                    onRestoreReports([]);
                  }
                  setIsResetConfirmOpen(false);
                  onShowToast('Database berhasil direset. Cadangan otomatis tersimpan.', 'info');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Cadangan & Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
