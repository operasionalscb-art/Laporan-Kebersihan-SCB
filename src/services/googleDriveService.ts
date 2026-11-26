import {
  getGoogleAccessToken,
  clearActiveDriveToken,
} from './googleAuth';
import { CleaningReport } from '../types';
import {
  extractGoogleDriveFileId,
  optimizePhotoForDrive,
} from '../utils/imageCompressor';

function createDriveAuthError(message: string): Error & { isDriveAuthError?: boolean } {
  const err: Error & { isDriveAuthError?: boolean } = new Error(message);
  err.isDriveAuthError = true;
  return err;
}

async function fetchDriveWithAuthRetry(
  url: string,
  initFactory: (token: string) => RequestInit
): Promise<{ response: Response; tokenUsed: string }> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw createDriveAuthError(
      'Akses Google Drive belum terautentikasi. Silakan klik "Pulihkan Sesi Google Drive".'
    );
  }

  const response = await fetch(url, initFactory(token));
  if (response.status === 401) {
    clearActiveDriveToken();
  }
  return { response, tokenUsed: token };
}

// In-memory Blob URL cache for authenticated Google Drive image loading
const driveImageBlobCache = new Map<string, string>();

export const DEFAULT_DATABASE_FOLDER_ID = '1EW55LPCuje5G3OOB4oiMpd5JGnTf3H5Z';
export const DEFAULT_DATABASE_FOLDER_URL = `https://drive.google.com/drive/folders/${DEFAULT_DATABASE_FOLDER_ID}?usp=sharing`;
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

  const { response } = await fetchDriveWithAuthRetry(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    (token) => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  );

  if (!response.ok) {
    if (response.status === 401) {
      clearActiveDriveToken();
      throw createDriveAuthError('Sesi Google Drive telah berakhir. Silakan klik "Hubungkan Google Drive" untuk memperbarui sesi.');
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal memuat file Google Drive (${response.status})`);
  }

  const data = await response.json();
  return data.files || [];
}

const UPLOADED_REPORT_IDS_KEY = 'scb_gdrive_uploaded_report_ids';

function getUploadedDriveReportIds(): Set<string> {
  try {
    const raw = localStorage.getItem(UPLOADED_REPORT_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function markReportUploadedToDrive(reportId: string): void {
  if (!reportId) return;
  try {
    const set = getUploadedDriveReportIds();
    set.add(reportId);
    // Keep recent 2000 report IDs bounded in localStorage
    const list = Array.from(set).slice(-2000);
    localStorage.setItem(UPLOADED_REPORT_IDS_KEY, JSON.stringify(list));
  } catch {}
}

function buildReportJsonFileName(report: CleaningReport): string {
  const rawArea = report.isAreaOther ? report.areaCustom || report.area : report.area;
  const cleanArea = (rawArea || 'Area').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 25);
  return `Laporan_${report.tanggal}_${cleanArea}_${report.id}.json`;
}

function buildDeterministicPhotoFileName(
  report: CleaningReport,
  index: number
): string {
  const rawArea = report.isAreaOther ? report.areaCustom || report.area : report.area;
  const cleanArea = (rawArea || 'Area').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 25);
  return `Foto_${report.tanggal}_${cleanArea}_${report.id}_${index + 1}.jpg`;
}

/**
 * Lists up to 1000 existing non-trashed files inside the target Google Drive folder
 * to avoid re-uploading or replacing already-archived files.
 */
async function listAllDriveFolderFiles(folderId?: string): Promise<DriveFileItem[]> {
  const targetFolderId = folderId || getConfiguredFolderId();
  let q = 'trashed = false';
  if (targetFolderId) {
    q += ` and '${targetFolderId}' in parents`;
  }

  const allFiles: DriveFileItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q,
      pageSize: '1000',
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const { response } = await fetchDriveWithAuthRetry(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      (token) => ({
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    if (!response.ok) {
      if (response.status === 401) {
        clearActiveDriveToken();
        throw createDriveAuthError(
          'Sesi Google Drive telah berakhir. Silakan klik "Pulihkan Sesi Google Drive".'
        );
      }
      break;
    }
    const data = await response.json();
    if (Array.isArray(data.files)) {
      allFiles.push(...data.files);
    }
    pageToken = data.nextPageToken;
  } while (pageToken && allFiles.length < 3000);

  return allFiles;
}

/**
 * Searches for a single existing non-trashed file in the target folder matching a query fragment.
 */
async function findExistingDriveFile(
  qFragment: string,
  folderId?: string
): Promise<DriveFileItem | null> {
  try {
    const targetFolderId = folderId || getConfiguredFolderId();
    const q = targetFolderId
      ? `trashed = false and '${targetFolderId}' in parents and ${qFragment}`
      : `trashed = false and ${qFragment}`;

    const params = new URLSearchParams({
      q,
      pageSize: '5',
      fields: 'files(id, name, mimeType, webViewLink)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });

    const { response } = await fetchDriveWithAuthRetry(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      (token) => ({
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data.files) && data.files.length > 0 ? data.files[0] : null;
  } catch {
    return null;
  }
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
      clearActiveDriveToken();
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
  const { response: res } = await fetchDriveWithAuthRetry(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    (token) => ({
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  if (!res.ok) {
    if (res.status === 401) {
      clearActiveDriveToken();
      throw createDriveAuthError('Sesi Google Drive telah berakhir. Silakan hubungkan kembali akun Google.');
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

  const { response: res } = await fetchDriveWithAuthRetry(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true',
    (token) => ({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullBody,
    })
  );

  if (!res.ok) {
    if (res.status === 401) {
      clearActiveDriveToken();
      throw createDriveAuthError('Sesi Google Drive telah berakhir. Silakan hubungkan ulang akun Google.');
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
 * Best-effort permission helper so uploaded report photos can be viewed across
 * supervisor/admin browsers from Google Drive links.
 */
async function setDriveFileReadable(fileId: string, token: string): Promise<void> {
  try {
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );
  } catch {
    // Non-fatal: workspace domain policies may restrict 'anyone' sharing; authenticated Drive API fallback still works
  }
}

/**
 * Fetches an image directly from Google Drive API (alt=media) using the active
 * Google Drive access token and caches a local Blob ObjectURL in memory.
 */
export async function fetchDriveImageBlobUrl(fileIdOrUrl: string): Promise<string | null> {
  const fileId = extractGoogleDriveFileId(fileIdOrUrl) ||
    (/^[a-zA-Z0-9_-]{15,}$/.test(fileIdOrUrl.trim()) ? fileIdOrUrl.trim() : null);
  if (!fileId) return null;

  const cached = driveImageBlobCache.get(fileId);
  if (cached) return cached;

  const token = await getGoogleAccessToken();
  if (!token) return null;

  try {
    const { response: res } = await fetchDriveWithAuthRetry(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      (tk) => ({
        headers: { Authorization: `Bearer ${tk}` },
      })
    );
    if (!res.ok) {
      if (res.status === 401) {
        clearActiveDriveToken();
      }
      return null;
    }
    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;
    const objectUrl = URL.createObjectURL(blob);
    driveImageBlobCache.set(fileId, objectUrl);
    return objectUrl;
  } catch {
    return null;
  }
}

/**
 * Builds a compact direct image reference URL backed by Google Drive file ID.
 */
export function buildDriveDirectViewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
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
  const { response: res } = await fetchDriveWithAuthRetry(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
    (token) => ({
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  if (!res.ok) {
    if (res.status === 401) {
      clearActiveDriveToken();
      throw createDriveAuthError('Sesi Google Drive telah berakhir. Silakan hubungkan ulang akun Google.');
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
 * Uploads a base64 encoded image or data URL to Google Drive, optimizing only if oversized
 * while preserving crisp HD resolution.
 */
export async function uploadBase64ImageToDrive(
  base64Data: string,
  fileName: string,
  parentFolderId?: string
): Promise<DriveUploadResult> {
  const optimizedDataUrl = await optimizePhotoForDrive(base64Data);
  let mimeType = 'image/jpeg';
  let pureBase64 = optimizedDataUrl;

  const match = optimizedDataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
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
 * Uploads ONLY new photos from a cleaning report to Google Drive (skipping existing Drive links
 * or files already present in the folder without replacing/duplicating them).
 */
export async function uploadReportPhotosToDrive(
  report: CleaningReport,
  folderId?: string
): Promise<{
  updatedPhotos: string[];
  driveViewUrls: string[];
  uploadedCount: number;
  driveLinks: string[];
  hadUploadFailure: boolean;
}> {
  if (!report.fotoBukti || report.fotoBukti.length === 0) {
    return {
      updatedPhotos: [],
      driveViewUrls: [],
      uploadedCount: 0,
      driveLinks: report.drivePhotoLinks || [],
      hadUploadFailure: false,
    };
  }

  const token = await getGoogleAccessToken();
  if (!token) {
    return {
      updatedPhotos: report.fotoBukti,
      driveViewUrls: [],
      uploadedCount: 0,
      driveLinks: report.drivePhotoLinks || [],
      hadUploadFailure: true,
    };
  }

  const targetFolder = folderId || getConfiguredFolderId();
  const updatedPhotos: string[] = [...report.fotoBukti];
  const existingDriveLinks: string[] = Array.isArray(report.drivePhotoLinks) ? [...report.drivePhotoLinks] : [];
  const driveLinks: string[] = [];
  const driveViewUrls: string[] = [];
  let uploadedCount = 0;
  let hadUploadFailure = false;

  for (let i = 0; i < report.fotoBukti.length; i++) {
    const photo = report.fotoBukti[i];
    if (photo.startsWith('http://') || photo.startsWith('https://')) {
      const existingFileId = extractGoogleDriveFileId(photo);
      driveLinks.push(
        existingFileId ? `https://drive.google.com/file/d/${existingFileId}/view` : photo
      );
      driveViewUrls.push(
        existingFileId ? buildDriveDirectViewUrl(existingFileId) : photo
      );
      continue;
    }
    if (existingDriveLinks[i] && existingDriveLinks[i].startsWith('http')) {
      const existingFileId = extractGoogleDriveFileId(existingDriveLinks[i]);
      driveLinks.push(existingDriveLinks[i]);
      driveViewUrls.push(
        existingFileId ? buildDriveDirectViewUrl(existingFileId) : existingDriveLinks[i]
      );
      continue;
    }

    try {
      const fileName = buildDeterministicPhotoFileName(report, i);
      const escapedName = fileName.replace(/'/g, "\\'");
      // Check if this exact photo file already exists in Drive folder (avoid duplicate / replace)
      const existingDrivePhoto = await findExistingDriveFile(`name = '${escapedName}'`, targetFolder);
      if (existingDrivePhoto) {
        driveLinks.push(
          existingDrivePhoto.webViewLink || `https://drive.google.com/file/d/${existingDrivePhoto.id}/view`
        );
        driveViewUrls.push(buildDriveDirectViewUrl(existingDrivePhoto.id));
        continue;
      }

      const uploadResult = await uploadBase64ImageToDrive(photo, fileName, targetFolder);
      const activeToken = (await getGoogleAccessToken()) || token;
      await setDriveFileReadable(uploadResult.fileId, activeToken);

      driveLinks.push(uploadResult.webViewLink);
      driveViewUrls.push(buildDriveDirectViewUrl(uploadResult.fileId));
      uploadedCount++;
    } catch (err: any) {
      hadUploadFailure = true;
      console.warn(`Gagal mengunggah foto ke-${i + 1} ke Google Drive:`, err);
      driveViewUrls.push(photo);
      if (err?.isDriveAuthError) {
        for (let j = i + 1; j < report.fotoBukti.length; j++) {
          driveViewUrls.push(report.fotoBukti[j]);
        }
        break;
      }
    }
  }

  return { updatedPhotos, driveViewUrls, uploadedCount, driveLinks, hadUploadFailure };
}

/**
 * Uploads a single submitted officer cleaning report JSON directly to the SCB Google Drive folder
 * ONLY if a file for that report ID does not already exist (never repeats or replaces existing files).
 */
export async function uploadSingleReportToDrive(
  report: CleaningReport,
  folderId?: string
): Promise<DriveUploadResult & { skipped?: boolean }> {
  const fileName = buildReportJsonFileName(report);
  const targetFolder = folderId || getConfiguredFolderId();

  if (getUploadedDriveReportIds().has(report.id)) {
    return {
      fileId: '',
      name: fileName,
      webViewLink: '',
      skipped: true,
    };
  }

  const escapedId = report.id.replace(/'/g, "\\'");
  const existing = await findExistingDriveFile(`name contains '${escapedId}.json'`, targetFolder);
  if (existing) {
    markReportUploadedToDrive(report.id);
    return {
      fileId: existing.id,
      name: existing.name,
      webViewLink: existing.webViewLink || `https://drive.google.com/file/d/${existing.id}/view`,
      skipped: true,
    };
  }

  const payload = {
    type: 'single_cleaning_report',
    appName: 'SIM-BERSIH SCB',
    savedAt: new Date().toISOString(),
    report,
  };
  const uploaded = await uploadFileToDrive(
    fileName,
    JSON.stringify(payload, null, 2),
    'application/json',
    targetFolder
  );
  markReportUploadedToDrive(report.id);
  return { ...uploaded, skipped: false };
}

/**
 * Fetches cleaning reports and Drive photo references directly from the configured Google Drive folder.
 * Reads the latest Backup_Laporan_Kebersihan_SCB_*.json plus any individual Laporan_*.json files.
 */
export async function fetchReportsFromGoogleDrive(
  folderId?: string
): Promise<{
  reports: CleaningReport[];
  filesScanned: number;
  latestBackupName?: string;
}> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('Akses Google Drive belum aktif. Hubungkan akun Google terlebih dahulu.');
  }

  const targetFolder = folderId || getConfiguredFolderId();
  const files = await listDriveFiles(targetFolder);
  const reportMap = new Map<string, CleaningReport>();
  let filesScanned = 0;
  let latestBackupName: string | undefined;

  const normalizeLoadedReport = (raw: CleaningReport): CleaningReport => {
    const rawLinks = Array.isArray(raw.drivePhotoLinks) ? raw.drivePhotoLinks : [];
    const fallbackDriveViewPhotos = rawLinks.map((link) => {
      const fid = extractGoogleDriveFileId(link);
      return fid ? buildDriveDirectViewUrl(fid) : link;
    });
    const currentPhotos = Array.isArray(raw.fotoBukti) ? raw.fotoBukti : [];
    const effectivePhotos =
      fallbackDriveViewPhotos.length > 0 &&
      (currentPhotos.length === 0 ||
        (currentPhotos.length < fallbackDriveViewPhotos.length &&
          currentPhotos.every((p) => !p.startsWith('http'))))
        ? fallbackDriveViewPhotos
        : currentPhotos;

    return {
      ...raw,
      checklist: Array.isArray(raw.checklist) ? raw.checklist : [],
      keteranganTambahan: raw.keteranganTambahan ?? '',
      fotoBukti: effectivePhotos,
      fotoCount: raw.fotoCount ?? effectivePhotos.length,
      drivePhotoLinks: rawLinks.length > 0 ? rawLinks : raw.drivePhotoLinks,
    };
  };

  // 1. Read the newest full JSON backup file first (if any)
  const backupFiles = files.filter(
    (f) =>
      f.mimeType === 'application/json' ||
      f.name.toLowerCase().endsWith('.json')
  );

  const latestBulkBackup = backupFiles.find((f) =>
    f.name.startsWith('Backup_Laporan_Kebersihan_SCB_') || f.name.startsWith('Backup_SIM_BERSIH_SCB_')
  );

  if (latestBulkBackup) {
    try {
      const json = await readJsonFromDrive<any>(latestBulkBackup.id);
      filesScanned++;
      latestBackupName = latestBulkBackup.name;
      const list = Array.isArray(json) ? json : Array.isArray(json?.reports) ? json.reports : [];
      for (const r of list) {
        if (r && r.id) {
          reportMap.set(r.id, normalizeLoadedReport(r));
        }
      }
    } catch (err) {
      console.warn('Could not read latest Drive backup JSON:', err);
    }
  }

  // 2. Also read up to 25 individual Laporan_*.json files newer than or missing from the bulk backup
  const individualReportFiles = backupFiles
    .filter((f) => f.name.startsWith('Laporan_') && f.name.endsWith('.json'))
    .slice(0, 25);

  for (const file of individualReportFiles) {
    try {
      const json = await readJsonFromDrive<any>(file.id);
      filesScanned++;
      const rep: CleaningReport | undefined = json?.report || (json?.id && json?.area ? json : undefined);
      if (rep && rep.id) {
        const existing = reportMap.get(rep.id);
        if (!existing || (rep.timestamp || 0) >= (existing.timestamp || 0)) {
          reportMap.set(rep.id, normalizeLoadedReport(rep));
        }
      }
    } catch (err) {
      console.warn(`Could not read individual Drive report ${file.name}:`, err);
    }
  }

  const reports = Array.from(reportMap.values()).sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
  );
  return { reports, filesScanned, latestBackupName };
}

/**
 * Syncs ONLY new cleaning report JSON files to Google Drive without repeating or replacing
 * reports that already exist in the configured folder.
 */
export async function syncNewReportsOnlyToDrive(
  reports: CleaningReport[],
  folderId?: string,
  forceVerifyDrive = false
): Promise<{
  uploadedCount: number;
  skippedCount: number;
  totalReports: number;
  lastUploadedName?: string;
}> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw createDriveAuthError('Akses Google Drive belum aktif.');
  }

  if (reports.length === 0) {
    return { uploadedCount: 0, skippedCount: 0, totalReports: 0 };
  }

  const targetFolder = folderId || getConfiguredFolderId();
  const localUploaded = forceVerifyDrive ? new Set<string>() : getUploadedDriveReportIds();

  // Check if we need to query the Drive folder at all
  const needsDriveCheck =
    forceVerifyDrive || reports.some((r) => !localUploaded.has(r.id));

  if (!needsDriveCheck) {
    return {
      uploadedCount: 0,
      skippedCount: reports.length,
      totalReports: reports.length,
    };
  }

  const existingFiles = await listAllDriveFolderFiles(targetFolder);
  const existingFileNames = existingFiles.map((f) => f.name || '');

  const isReportAlreadyInDrive = (report: CleaningReport): boolean => {
    if (localUploaded.has(report.id)) return true;
    const exactName = buildReportJsonFileName(report);
    const suffix = `_${report.id}.json`;
    return existingFileNames.some((n) => n === exactName || n.endsWith(suffix));
  };

  let uploadedCount = 0;
  let skippedCount = 0;
  let lastUploadedName: string | undefined;

  for (const report of reports) {
    if (isReportAlreadyInDrive(report)) {
      markReportUploadedToDrive(report.id);
      skippedCount++;
      continue;
    }

    const fileName = buildReportJsonFileName(report);
    const payload = {
      type: 'single_cleaning_report',
      appName: 'SIM-BERSIH SCB',
      savedAt: new Date().toISOString(),
      report,
    };
    const res = await uploadFileToDrive(
      fileName,
      JSON.stringify(payload, null, 2),
      'application/json',
      targetFolder
    );
    markReportUploadedToDrive(report.id);
    uploadedCount++;
    lastUploadedName = res.name;
  }

  return {
    uploadedCount,
    skippedCount,
    totalReports: reports.length,
    lastUploadedName,
  };
}

/**
 * Compatibility helper: performs incremental new-files-only sync instead of repeatedly replacing
 * a full daily JSON snapshot.
 */
export async function executeAutoBackupToDrive(
  reports: CleaningReport[],
  folderId?: string
): Promise<DriveUploadResult & { uploadedCount: number; skippedCount: number }> {
  const res = await syncNewReportsOnlyToDrive(reports, folderId, false);
  return {
    fileId: '',
    name: res.lastUploadedName || 'Sinkronisasi Incremental',
    webViewLink: '',
    uploadedCount: res.uploadedCount,
    skippedCount: res.skippedCount,
  };
}

/**
 * Returns true if a report has photos still waiting to be archived to Superadmin's Google Drive
 * (or still stored as offloaded Firestore base64 payloads).
 */
export function isReportPendingDriveArchive(report: CleaningReport): boolean {
  const expectedCount = report.fotoCount ?? report.fotoBukti?.length ?? 0;
  if (expectedCount <= 0) return false;
  const archivedLinksCount = (report.drivePhotoLinks || []).filter(
    (l) => typeof l === 'string' && l.startsWith('http')
  ).length;
  if (archivedLinksCount < expectedCount) return true;
  if (report.photosOffloaded) return true;
  if (
    Array.isArray(report.fotoBukti) &&
    report.fotoBukti.some((p) => p.startsWith('data:image/') && !p.startsWith('data:image/svg+xml'))
  ) {
    return true;
  }
  return false;
}

/**
 * Batch upload all pending local/base64 photos across all reports into Superadmin's Google Drive
 * and replace fotoBukti with lightweight Google Drive view URLs.
 */
export async function batchUploadAllReportsPhotosToDrive(
  reports: CleaningReport[],
  onProgress?: (current: number, total: number) => void
): Promise<{
  updatedReports: CleaningReport[];
  modifiedReports: CleaningReport[];
  totalUploaded: number;
}> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('Akses Google Drive belum terautentikasi.');
  }

  const targetFolder = getConfiguredFolderId();
  const existingDriveFiles = await listAllDriveFolderFiles(targetFolder).catch(() => [] as DriveFileItem[]);
  const existingPhotoByName = new Map<string, DriveFileItem>();
  for (const df of existingDriveFiles) {
    if (df.name) existingPhotoByName.set(df.name, df);
  }

  let totalUploaded = 0;
  const updatedReports: CleaningReport[] = [];
  const modifiedReports: CleaningReport[] = [];

  // Count total photos not yet archived in drivePhotoLinks
  let totalPhotos = 0;
  for (const r of reports) {
    const base64Count = (r.fotoBukti || []).filter((p) => p && p.startsWith('data:image/')).length;
    const archivedCount = (r.drivePhotoLinks || []).filter((l) => l && l.startsWith('http')).length;
    totalPhotos += Math.max(0, base64Count - archivedCount);
  }

  let processedCount = 0;

  for (const report of reports) {
    if (!report.fotoBukti || report.fotoBukti.length === 0) {
      updatedReports.push(report);
      continue;
    }

    let reportModified = false;
    const existingLinks = Array.isArray(report.drivePhotoLinks) ? [...report.drivePhotoLinks] : [];
    const newDriveLinks: string[] = [];
    const newDriveViewUrls: string[] = [];

    for (let i = 0; i < report.fotoBukti.length; i++) {
      const photo = report.fotoBukti[i];
      if (photo.startsWith('http://') || photo.startsWith('https://')) {
        const fid = extractGoogleDriveFileId(photo);
        newDriveLinks.push(fid ? `https://drive.google.com/file/d/${fid}/view` : photo);
        newDriveViewUrls.push(fid ? buildDriveDirectViewUrl(fid) : photo);
        continue;
      }
      if (existingLinks[i] && existingLinks[i].startsWith('http')) {
        const fid = extractGoogleDriveFileId(existingLinks[i]);
        newDriveLinks.push(existingLinks[i]);
        newDriveViewUrls.push(fid ? buildDriveDirectViewUrl(fid) : existingLinks[i]);
        if (report.photosOffloaded || photo.startsWith('data:image/')) {
          reportModified = true;
        }
        continue;
      }

      if (photo.startsWith('data:image/') && !photo.startsWith('data:image/svg+xml')) {
        const fileName = buildDeterministicPhotoFileName(report, i);
        const alreadyOnDrive = existingPhotoByName.get(fileName);
        if (alreadyOnDrive) {
          newDriveLinks.push(
            alreadyOnDrive.webViewLink || `https://drive.google.com/file/d/${alreadyOnDrive.id}/view`
          );
          newDriveViewUrls.push(buildDriveDirectViewUrl(alreadyOnDrive.id));
          reportModified = true;
          processedCount++;
          if (onProgress) onProgress(processedCount, totalPhotos);
          continue;
        }

        try {
          const result = await uploadBase64ImageToDrive(photo, fileName, targetFolder);
          await setDriveFileReadable(result.fileId, token);
          newDriveLinks.push(result.webViewLink);
          newDriveViewUrls.push(buildDriveDirectViewUrl(result.fileId));
          reportModified = true;
          totalUploaded++;
        } catch (e: any) {
          console.warn('Batch photo upload item error:', e);
          newDriveViewUrls.push(photo);
          if (e?.isDriveAuthError) {
            throw e;
          }
        }
        processedCount++;
        if (onProgress) onProgress(processedCount, totalPhotos);
      } else {
        newDriveViewUrls.push(photo);
      }
    }

    const allArchivedToHttp =
      newDriveViewUrls.length > 0 && newDriveViewUrls.every((u) => u.startsWith('http'));

    if (reportModified || (report.photosOffloaded && allArchivedToHttp)) {
      const updated: CleaningReport = {
        ...report,
        fotoBukti: allArchivedToHttp ? newDriveViewUrls : report.fotoBukti,
        fotoCount: newDriveViewUrls.length,
        photosOffloaded: allArchivedToHttp ? false : report.photosOffloaded,
        drivePhotoLinks: newDriveLinks,
      };
      updatedReports.push(updated);
      modifiedReports.push(updated);
    } else {
      updatedReports.push(report);
    }
  }

  return { updatedReports, modifiedReports, totalUploaded };
}
