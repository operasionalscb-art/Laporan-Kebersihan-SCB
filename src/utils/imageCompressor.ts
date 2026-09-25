/**
 * Compresses an image file (from camera or file picker) to a web-friendly size
 * and returns a JPEG data URL.
 */
export async function compressImage(file: File, maxWidth = 900, maxHeight = 900, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
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
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Draw white background in case of transparent png
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Watermark with timestamp and SCB text for authentic evidence
        const now = new Date();
        const timeStr = `${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, height - 28, width, 28);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`SCB Cleaning Log • ${timeStr}`, 10, height - 10);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
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
