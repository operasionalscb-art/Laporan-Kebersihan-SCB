const MAX_SINGLE_PHOTO_CHARS = 165_000;
const MAX_MICRO_THUMBNAIL_CHARS = 20_000;

/**
 * Renders an already-loaded HTMLImageElement to JPEG data URL at target max dimension & quality,
 * with a clean proportional timestamp watermark.
 */
function renderCompressedCanvas(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  includeWatermark = true
): string {
  let width = img.width;
  let height = img.height;

  if (width > height) {
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
  } else {
    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  // Draw white background in case of transparent png
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (includeWatermark) {
    const now = new Date();
    const timeStr = `${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;
    const fontSize = Math.max(13, Math.min(24, Math.round(canvas.width * 0.021)));
    const barHeight = Math.max(28, Math.round(fontSize * 2.05));
    const padX = Math.max(10, Math.round(fontSize * 0.8));

    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(`SCB Cleaning Log • ${timeStr}`, padX, canvas.height - barHeight / 2);
  }

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Compresses an image file (from camera or file picker) to crisp HD resolution
 * while staying compact (~90–140 KB per photo) for Firebase read/write efficiency.
 */
export async function compressImage(
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          let dataUrl = renderCompressedCanvas(img, maxWidth, maxHeight, quality, true);

          if (dataUrl.length > MAX_SINGLE_PHOTO_CHARS) {
            dataUrl = renderCompressedCanvas(img, maxWidth, maxHeight, 0.68, true);
          }
          if (dataUrl.length > MAX_SINGLE_PHOTO_CHARS) {
            dataUrl = renderCompressedCanvas(
              img,
              Math.min(maxWidth, 1080),
              Math.min(maxHeight, 1080),
              0.62,
              true
            );
          }
          if (dataUrl.length > MAX_SINGLE_PHOTO_CHARS) {
            dataUrl = renderCompressedCanvas(img, 960, 960, 0.56, true);
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to compress image'));
        }
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Creates a clean SVG placeholder image data URL for initial system reports
 */
export function createSamplePhotoUrl(title: string, subtitle: string, bgColor = '#059669'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
        <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="600" height="450" fill="url(#grad)"/>
    <circle cx="300" cy="180" r="60" fill="rgba(255,255,255,0.15)"/>
    <path d="M 275 180 L 295 200 L 330 160" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="300" y="275" font-family="sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">${title}</text>
    <text x="300" y="308" font-family="sans-serif" font-size="14" fill="rgba(255,255,255,0.8)" text-anchor="middle">${subtitle}</text>
    <rect x="0" y="415" width="600" height="35" fill="rgba(0,0,0,0.5)"/>
    <text x="20" y="438" font-family="sans-serif" font-size="13" font-weight="bold" fill="#ffffff">SEKOLAH CENDEKIA BAZNAS • BUKTI KEBERSIHAN</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Re-compresses an existing image data URL to smaller dimensions/quality
 * so multi-photo reports always stay safely below Firestore's 1MB document limit.
 */
export async function recompressImageDataUrl(
  dataUrl: string,
  maxWidth = 520,
  maxHeight = 520,
  quality = 0.5
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:image/svg+xml')) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const smaller = canvas.toDataURL('image/jpeg', quality);
        resolve(smaller.length < dataUrl.length ? smaller : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Generates a crisp yet lightweight card thumbnail (~7–14 KB) for Dashboard card previews
 * stored in the main /reports document while full HD photos live in /report_photos.
 */
export async function createMicroThumbnail(
  dataUrl: string,
  maxWidth = 360,
  maxHeight = 360,
  quality = 0.48
): Promise<string> {
  const firstPass = await recompressImageDataUrl(dataUrl, maxWidth, maxHeight, quality);
  if (firstPass.length <= MAX_MICRO_THUMBNAIL_CHARS) {
    return firstPass;
  }
  return recompressImageDataUrl(dataUrl, 280, 280, 0.4);
}

/**
 * Extracts a Google Drive file ID from common Drive share/view URLs.
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed.includes('drive.google.com') && !trimmed.includes('googleusercontent.com')) {
    return null;
  }
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return fileMatch[1];

  const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch?.[1]) return dMatch[1];

  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch?.[1]) return idMatch[1];

  return null;
}

/**
 * Returns renderable <img> src candidates for a report photo URL.
 * Converts legacy Google Drive /view HTML URLs into direct image/thumbnail URLs.
 */
export function getGoogleDriveImageCandidates(url: string): string[] {
  if (!url) return [];
  const fileId = extractGoogleDriveFileId(url);
  if (fileId) {
    return [
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
      `https://lh3.googleusercontent.com/d/${fileId}=w1000`,
    ];
  }
  return [url];
}

