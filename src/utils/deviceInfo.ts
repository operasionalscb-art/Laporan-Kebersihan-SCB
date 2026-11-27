import { DeviceType } from '../types';

export interface DetectedDeviceInfo {
  deviceType: DeviceType;
  os: string;
  browser: string;
  deviceLabel: string;
  screenInfo: string;
}

export function detectDeviceInfo(): DetectedDeviceInfo {
  if (typeof navigator === 'undefined') {
    return {
      deviceType: 'Desktop',
      os: 'Unknown OS',
      browser: 'Browser',
      deviceLabel: 'Desktop • Unknown OS • Browser',
      screenInfo: '',
    };
  }

  const ua = navigator.userAgent || '';
  const maxTouchPoints = typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0;

  // 1. OS detection
  let os = 'Unknown OS';
  if (/Android/i.test(ua)) {
    const androidVer = ua.match(/Android\s+([\d.]+)/i)?.[1];
    os = androidVer ? `Android ${androidVer}` : 'Android';
  } else if (/iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) {
    const iosVer = ua.match(/OS\s+([\d_]+)/i)?.[1]?.replace(/_/g, '.');
    os = iosVer ? `iOS ${iosVer}` : 'iOS';
  } else if (/Windows NT/i.test(ua)) {
    os = /Windows NT 10\.0/i.test(ua) ? 'Windows 10/11' : 'Windows';
  } else if (/CrOS/i.test(ua)) {
    os = 'ChromeOS';
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // 2. Device Type detection
  let deviceType: DeviceType = 'Desktop';
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    deviceType = 'Tablet';
  } else if (/Mobile|iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = 'Mobile';
  }

  // 3. Browser detection
  let browser = 'Browser';
  if (/EdgA?|Edge/i.test(ua)) {
    browser = 'Edge';
  } else if (/SamsungBrowser/i.test(ua)) {
    browser = 'Samsung Browser';
  } else if (/OPR|Opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/Firefox|FxiOS/i.test(ua)) {
    browser = 'Firefox';
  } else if (/CriOS|Chrome/i.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari/i.test(ua)) {
    browser = 'Safari';
  }

  // 4. Screen info
  let screenInfo = '';
  if (typeof window !== 'undefined' && window.screen) {
    const w = window.screen.width;
    const h = window.screen.height;
    if (w > 0 && h > 0) {
      screenInfo = `${w}x${h}`.slice(0, 40);
    }
  }

  const safeOs = os.slice(0, 60);
  const safeBrowser = browser.slice(0, 60);
  const deviceLabel = `${deviceType} • ${safeOs} • ${safeBrowser}`.slice(0, 160);

  return {
    deviceType,
    os: safeOs,
    browser: safeBrowser,
    deviceLabel,
    screenInfo,
  };
}
