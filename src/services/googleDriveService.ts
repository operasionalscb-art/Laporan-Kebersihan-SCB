import { getGoogleAccessToken, clearStoredGoogleAuth } from './googleAuth';
import { CleaningReport } from '../types';

export const DEFAULT_DATABASE_FOLDER_ID = '1EW55LPCuje5G3OOB4oiMpd5JGnTf3H5Z';
export const DEFAULT_DATABASE_FOLDER_URL = `https://drive.google.com/drive/folders/${DEFAULT_DATABASE_FOLDER_ID}?usp=share_link`;
export const STORAGE_FOLDER_KEY = 'scb_custom_gdrive_folder_id';

/**
 * Extracts a Google Drive Folder ID from a URL, link with parameters, or returns the raw ID.
 */
export function extractFolderId(input: string): string {
  if (!input) return DEFAULT_DATABASE_FOLDER_ID;
  const trimmed = input.trim();
  // Format: .../folders/FOLDER_ID...
  const match = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // Format: ...id=FOLDER_ID...
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }
  // Raw alphanumeric ID (Google Drive IDs are usually 15-44 characters)
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed || DEFAULT_DATABASE_FOLDER_ID;
}

/**
 * Retrieves the currently active Google Drive storage folder ID (defaults to designated SCB database folder).
 */
export function getConfiguredFolderId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_FOLDER_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return DEFAULT_DATABASE_FOLDER_ID;
}

/**
 * Saves a custom Google Drive folder ID or URL as the active storage database.
 */
export function setConfiguredFolderId(folderIdOrUrl: string): string {
  const cleanId = extractFolderId(folderIdOrUrl);
  try {
    localStorage.setItem(STORAGE_FOLDER_KEY, cleanId);
  } catch (e) {
    // Ignore localStorage errors
  }
  return cleanId;
}

/**
 * Resets the folder ID back to the designated default SCB database folder.
 */
export function resetConfiguredFolderId(): string {
  try {
    localStorage.setItem(STORAGE_FOLDER_KEY, DEFAULT_DATABASE_FOLDER_ID);
  } catch (e) {
    // Ignore localStorage errors
  }
  return DEFAULT_DATABASE_FOLDER_ID;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  iconLink?: string;
}

export interface DriveUploadResult {
  fileId: string;
  name: string;
  webViewLink: string;
}

/**
 * Searches or lists files in the configured Google Drive database folder.
 */
export async function listDriveFiles(
  folderId?: string,
  queryText?: string
): Promise<DriveFileItem[]> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('Akses Google Drive belum terautentikasi. Silakan klik tombol "Hubungkan Akun Google".');
  }

  const targetFolderId = folderId || getConfiguredFolderId();

  let q = "trashed = false";
  if (targetFolderId) {
    q += ` and '${targetFolderId}' in parents`;
  }
  if (queryText && queryText.trim()) {
    q += ` and name contains '${queryText.trim().replace(/'/g, "\\'")}'`;
  }

  const params = new URLSearchParams({
    q,
    pageSize: '50',
    fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink, thumbnailLink, iconLink)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredGoogleAuth();
      throw new Error('Sesi Google Drive telah berakhir. Silakan klik "Hubungkan Akun Google" untuk memperbarui sesi.');
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal memuat file Google Drive (${response.status})`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Gets details of a Google Drive folder by its ID.
 */
export async function getDriveFolderDetails(folderId: string): Promise<{
  id: string;
  name: string;
  webViewLink: string;
  accessible: boolean;
}> {
  const token = await getGoogleAccessToken();
  const defaultUrl = `https://drive.google.com/drive/folders/${folderId}`;

  if (!token) {
    return {
      id: folderId,
      name: 'Folder Database SIM-BERSIH SCB',
      webViewLink: defaultUrl,
      accessible: false,
    };
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,webViewLink,trashed&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (res.ok) {
      const data = await res.json();
      return {
        id: data.id,
        name: data.name || 'Folder Database SIM-BERSIH SCB',
        webViewLink: data.webViewLink || defaultUrl,
        accessible: !data.trashed,
      };
    }
    if (res.status === 401) {
      clearStoredGoogleAuth();
    }
  } catch (err) {
    console.warn('Could not fetch folder details from Drive API:', err);
  }

  return {
    id: folderId,
    name: 'Folder Database SIM-BERSIH SCB',
    webViewLink: defaultUrl,
    accessible: true,
  };
}

/**
 * Returns the designated database storage folder ID in Google Drive.
 */
export async function getOrCreateScbDriveFolder(): Promise<string> {
  return getConfiguredFolderId() || DEFAULT_DATABASE_FOLDER_ID;
}

/**
 * Reads a JSON file directly from Google Drive (e.g. for database restoration/import).
 */
export async function readJsonFromDrive<T = any>(fileId: string): Promise<T> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('Akses Google Drive belum terautentikasi. Silakan hubungkan akun Google.');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredGoogleAuth();
      throw new Error('Sesi Google Drive telah berakhir. Silakan hubungkan kembali akun Google.');
    }
    throw new Error(`Gagal mengunduh file dari Google Drive (${res.status})`);
  }

  return await res.json();
}

/**
 * Uploads a text/JSON/CSV file to Google Drive using multipart upload.
 */
export async function uploadFileToDrive(
  name: string,
  content: Blob | string,
  mimeType: string,
  parentFolderId?: string
): Promise<DriveUploadResult> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('Akses Google Drive belum terautentikasi. Silakan klik "Hubungkan Akun Google".');
  }

  const metadata: any = {
    name,
    mimeType,
  };

  const targetParent = parentFolderId || getConfiguredFolderId();
  if (targetParent) {
    metadata.parents = [targetParent];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const bodyBlobParts: (string | Blob)[] = [
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    delimiter,
    `Content-Type: ${mimeType}\r\n\r\n`,
    content,
    closeDelimiter,
  ];

  const fullBody = new Blob(bodyBlobParts);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullBody,
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredGoogleAuth();
      throw new Error('Sesi Google Drive telah berakhir. Silakan hubungkan ulang akun Google.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal mengunggah file ke Google Drive (${res.status})`);
  }

  const result = await res.json();
  return {
    fileId: result.id,
    name: result.name,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
  };
}

/**
 * Creates and uploads a full JSON backup of reports and master data to Google Drive
 */
export async function backupReportsToGoogleDrive(
  reports: CleaningReport[],
  folderId?: string
): Promise<DriveUploadResult> {
  const payload = {
    appName: 'SIM-BERSIH SCB',
    institution: 'Sekolah Cendekia BAZNAS (SCB)',
    backupTimestamp: new Date().toISOString(),
    totalReports: reports.length,
    reports,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Backup_Laporan_Kebersihan_SCB_${dateStr}.json`;

  return uploadFileToDrive(fileName, jsonString, 'application/json', folderId);
}

/**
 * Exports CSV report file directly to Google Drive
 */
export async function exportCsvToGoogleDrive(
  reports: CleaningReport[],
  folderId?: string
): Promise<DriveUploadResult> {
  const headers = [
    'ID Laporan',
    'Tanggal',
    'Waktu',
    'Petugas',
    'Area',
    'Kondisi Akhir',
    'Checklist',
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
  const fileName = `Rekap_Laporan_SCB_${dateStr}.csv`;

  return uploadFileToDrive(fileName, csvContent, 'text/csv;charset=utf-8', folderId);
}

/**
 * Explicit user confirmation before deleting a file in Google Drive
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('Akses Google Drive belum terautentikasi.');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredGoogleAuth();
      throw new Error('Sesi Google Drive telah berakhir. Silakan hubungkan ulang akun Google.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal menghapus file (${res.status})`);
  }

  return true;
}

export const STORAGE_AUTO_BACKUP_KEY = 'scb_auto_gdrive_backup';
export const STORAGE_AUTO_PHOTOS_KEY = 'scb_auto_gdrive_photos';

export function isAutoBackupEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_AUTO_BACKUP_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setAutoBackupEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_AUTO_BACKUP_KEY, String(enabled));
  } catch {}
}

export function isAutoPhotosUploadEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_AUTO_PHOTOS_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setAutoPhotosUploadEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_AUTO_PHOTOS_KEY, String(enabled));
  } catch {}
}

/**
 * Uploads a base64 encoded image or data URL to Google Drive
 */
export async function uploadBase64ImageToDrive(
  base64Data: string,
  fileName: string,
  parentFolderId?: string
): Promise<DriveUploadResult> {
  let mimeType = 'image/jpeg';
  let pureBase64 = base64Data;

  const match = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
  if (match) {
    mimeType = match[1];
    pureBase64 = match[2];
  }

  // Convert base64 characters to binary Uint8Array blob
  const byteCharacters = atob(pureBase64);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: mimeType });

  return uploadFileToDrive(fileName, blob, mimeType, parentFolderId);
}

/**
 * Automatically uploads all photos from a cleaning report to Google Drive.
 * Returns an array of Google Drive webViewLinks for successfully uploaded photos.
 */
export async function uploadReportPhotosToDrive(
  report: CleaningReport,
  folderId?: string
): Promise<{ updatedPhotos: string[]; uploadedCount: number; driveLinks: string[] }> {
  if (!report.fotoBukti || report.fotoBukti.length === 0) {
    return { updatedPhotos: [], uploadedCount: 0, driveLinks: [] };
  }

  const token = await getGoogleAccessToken();
  if (!token) {
    return { updatedPhotos: report.fotoBukti, uploadedCount: 0, driveLinks: [] };
  }

  const targetFolder = folderId || getConfiguredFolderId();
  const updatedPhotos: string[] = [];
  const driveLinks: string[] = [];
  let uploadedCount = 0;

  for (let i = 0; i < report.fotoBukti.length; i++) {
    const photo = report.fotoBukti[i];
    // If it's already a URL, retain it
    if (photo.startsWith('http://') || photo.startsWith('https://')) {
      updatedPhotos.push(photo);
      driveLinks.push(photo);
      continue;
    }

    try {
      const rawArea = report.isAreaOther ? report.areaCustom || report.area : report.area;
      const cleanArea = rawArea.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 25);
      const fileName = `Foto_${report.tanggal}_${cleanArea}_${i + 1}_${Date.now()}.jpg`;

      const uploadResult = await uploadBase64ImageToDrive(photo, fileName, targetFolder);
      // We retain the Drive web link
      updatedPhotos.push(uploadResult.webViewLink);
      driveLinks.push(uploadResult.webViewLink);
      uploadedCount++;
    } catch (err) {
      console.warn(`Gagal mengunggah foto ke-${i + 1} ke Google Drive:`, err);
      // Fallback: keep original base64 so image is not lost
      updatedPhotos.push(photo);
    }
  }

  return { updatedPhotos, uploadedCount, driveLinks };
}

/**
 * Automatically creates and updates the latest backup file in Google Drive
 */
export async function executeAutoBackupToDrive(
  reports: CleaningReport[],
  folderId?: string
): Promise<DriveUploadResult> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('Akses Google Drive belum aktif.');
  }

  const payload = {
    appName: 'SIM-BERSIH SCB',
    institution: 'Sekolah Cendekia BAZNAS (SCB)',
    backupTimestamp: new Date().toISOString(),
    totalReports: reports.length,
    reports,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Backup_Laporan_Kebersihan_SCB_${dateStr}.json`;

  return uploadFileToDrive(fileName, jsonString, 'application/json', folderId);
}

/**
 * Batch upload all pending local/base64 photos across all reports into Google Drive
 */
export async function batchUploadAllReportsPhotosToDrive(
  reports: CleaningReport[],
  onProgress?: (current: number, total: number) => void
): Promise<{ updatedReports: CleaningReport[]; totalUploaded: number }> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('Akses Google Drive belum terautentikasi.');
  }

  const targetFolder = getConfiguredFolderId();
  let totalUploaded = 0;
  const updatedReports: CleaningReport[] = [];

  // Count total photos to process
  let totalPhotos = 0;
  for (const r of reports) {
    totalPhotos += (r.fotoBukti || []).filter((p) => p.startsWith('data:image/')).length;
  }

  let processedCount = 0;

  for (const report of reports) {
    if (!report.fotoBukti || report.fotoBukti.length === 0) {
      updatedReports.push(report);
      continue;
    }

    let reportModified = false;
    const newPhotos: string[] = [];

    for (let i = 0; i < report.fotoBukti.length; i++) {
      const photo = report.fotoBukti[i];
      if (photo.startsWith('data:image/')) {
        try {
          const rawArea = report.isAreaOther ? report.areaCustom || report.area : report.area;
          const cleanArea = rawArea.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 25);
          const fileName = `Foto_${report.tanggal}_${cleanArea}_${i + 1}_${Date.now()}.jpg`;

          const result = await uploadBase64ImageToDrive(photo, fileName, targetFolder);
          newPhotos.push(result.webViewLink);
          reportModified = true;
          totalUploaded++;
        } catch (e) {
          console.warn('Batch photo upload item error:', e);
          newPhotos.push(photo);
        }
        processedCount++;
        if (onProgress) onProgress(processedCount, totalPhotos);
      } else {
        newPhotos.push(photo);
      }
    }

    if (reportModified) {
      updatedReports.push({ ...report, fotoBukti: newPhotos });
    } else {
      updatedReports.push(report);
    }
  }

  return { updatedReports, totalUploaded };
}
