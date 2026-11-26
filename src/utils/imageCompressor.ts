const MAX_SINGLE_PHOTO_CHARS = 220_000;
const MAX_DRIVE_PHOTO_CHARS = 280_000;
const MAX_MICRO_THUMBNAIL_CHARS = 20_000;

/**
 * Renders an already-loaded HTMLImageElement to JPEG data URL at target max dimension & quality,
 * with high-quality resampling and optional timestamp watermark.
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

  // High quality image smoothing to keep fine details crisp
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw white background in case of transparent png
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (includeWatermark) {
    const now = new Date();
    const timeStr = `${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;
    const fontSize = Math.max(13, Math.min(26, Math.round(canvas.width * 0.02)));
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
 * Compresses an image file (from camera or file picker) while preserving high resolution
 * (up to 1600px HD). Optimizes JPEG quality first before gently scaling dimensions only if needed.
 */
export async function compressImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Optimize encoding quality at full target resolution first before reducing pixels
          let dataUrl = renderCompressedCanvas(img, maxWidth, maxHeight, quality, true);

          if (dataUrl.length > MAX_SINGLE_PHOTO_CHARS) {
            dataUrl = renderCompressedCanvas(img, maxWidth, maxHeight, 0.74, true);
          }
          if (dataUrl.length > MAX_SINGLE_PHOTO_CHARS) {
            dataUrl = renderCompressedCanvas(img, maxWidth, maxHeight, 0.66, true);
          }
          if (dataUrl.length > MAX_SINGLE_PHOTO_CHARS) {
            dataUrl = renderCompressedCanvas(img, maxWidth, maxHeight, 0.6, true);
          }
          // Only reduce resolution slightly if file is still oversized due to very dense detail
          if (dataUrl.length > MAX_SINGLE_PHOTO_CHARS) {
            dataUrl = renderCompressedCanvas(
              img,
              Math.min(maxWidth, 1440),
              Math.min(maxHeight, 1440),
              0.62,
              true
            );
          }
          if (dataUrl.length > MAX_SINGLE_PHOTO_CHARS) {
            dataUrl = renderCompressedCanvas(
              img,
              Math.min(maxWidth, 1280),
              Math.min(maxHeight, 1280),
              0.58,
              true
            );
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
 * Re-compresses an existing image data URL only when needed (skipping if already <= targetMaxChars)
 * while preserving maximum clarity via high-quality canvas smoothing.
 */
export async function recompressImageDataUrl(
  dataUrl: string,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.65,
  targetMaxChars?: number
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:image/svg+xml')) {
    return dataUrl;
  }
  if (targetMaxChars && dataUrl.length <= targetMaxChars) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const smaller = renderCompressedCanvas(img, maxWidth, maxHeight, quality, false);
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
 * Optimizes a data URL photo before uploading to Google Drive only if it exceeds target weight,
 * prioritizing JPEG quality tuning so HD resolution (up to 1600px) is preserved.
 */
export async function optimizePhotoForDrive(
  dataUrl: string,
  maxChars = MAX_DRIVE_PHOTO_CHARS
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:image/svg+xml')) {
    return dataUrl;
  }
  if (dataUrl.length <= maxChars) {
    return dataUrl;
  }

  let best = dataUrl;
  const steps: Array<[number, number, number]> = [
    [1600, 1600, 0.8],
    [1600, 1600, 0.72],
    [1600, 1600, 0.65],
    [1440, 1440, 0.64],
  ];

  for (const [w, h, q] of steps) {
    const candidate = await recompressImageDataUrl(best, w, h, q);
    if (candidate.length < best.length) {
      best = candidate;
    }
    if (best.length <= maxChars) {
      return best;
    }
  }
  return best;
}

/**
 * Generates a crisp yet lightweight card thumbnail (~7–14 KB) for Dashboard card previews
 * stored in the main /reports document while full HD photos live in Google Drive / temporary queue.
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
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w1280`,
      `https://lh3.googleusercontent.com/d/${fileId}=w1280`,
      `https://drive.google.com/uc?export=view&id=${fileId}`,
    ];
  }
  return [url];
}

