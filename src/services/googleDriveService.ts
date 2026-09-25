import { getGoogleAccessToken } from './googleAuth';
import { CleaningReport } from '../types';

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
 * Searches or lists files in user's Google Drive.
 * Defaults to searching within or listing SCB Cleaning documents.
 */
export async function listDriveFiles(
  folderId?: string,
  queryText?: string
): Promise<DriveFileItem[]> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('Akses Google Drive belum terautentikasi. Silakan Hubungkan Akun Google.');
  }

  let q = "trashed = false";
  if (folderId) {
    q += ` and '${folderId}' in parents`;
  }
  if (queryText && queryText.trim()) {
    q += ` and name contains '${queryText.trim().replace(/'/g, "\\'")}'`;
  }

  const params = new URLSearchParams({
    q,
    pageSize: '50',
    fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink, thumbnailLink, iconLink)',
    orderBy: 'modifiedTime desc',
  });

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal memuat file Google Drive (${response.status})`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Finds or creates a dedicated root folder in Google Drive:
 * "SIM-BERSIH SCB (Sekolah Cendekia BAZNAS)"
 */
export async function getOrCreateScbDriveFolder(): Promise<string> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('Akses Google Drive belum terautentikasi.');
  }

  const folderName = 'SIM-BERSIH SCB (Laporan Kebersihan)';

  // 1. Search for existing folder
  const searchParams = new URLSearchParams({
    q: `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`,
    fields: 'files(id, name)',
  });

  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // 2. Create if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Folder penyimpanan otomatis dokumen, rekapitulasi, dan foto laporan kebersihan Sekolah Cendekia BAZNAS',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal membuat folder Google Drive');
  }

  const createdData = await createRes.json();
  return createdData.id;
}

/**
 * Uploads a text/JSON/CSV/blob file to Google Drive using multipart upload.
 */
export async function uploadFileToDrive(
  name: string,
  content: Blob | string,
  mimeType: string,
  parentFolderId?: string
): Promise<DriveUploadResult> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('Akses Google Drive belum terautentikasi.');
  }

  const metadata: any = {
    name,
    mimeType,
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
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
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
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
 * Converts a data URL (from report photo) to a Blob and uploads it to Google Drive
 */
export async function uploadBase64PhotoToDrive(
  dataUrl: string,
  fileName: string,
  folderId?: string
): Promise<DriveUploadResult> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return uploadFileToDrive(fileName, blob, 'image/jpeg', folderId);
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
 * Mandatory explicit user confirmation before deleting a file in Google Drive
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('Akses Google Drive belum terautentikasi.');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal menghapus file (${res.status})`);
  }

  return true;
}
