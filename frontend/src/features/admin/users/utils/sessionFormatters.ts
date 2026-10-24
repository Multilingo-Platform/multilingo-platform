/**
 * Tiện ích chuẩn hóa và phân tích thông tin phiên đăng nhập cho UI/UX thân thiện với người dùng
 */

export interface ParsedDeviceInfo {
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  friendlyName: string;
}

export function parseUserAgent(ua: string | null | undefined): ParsedDeviceInfo {
  if (!ua || ua.trim() === '') {
    return {
      browser: 'Không rõ',
      os: 'Không rõ',
      deviceType: 'desktop',
      friendlyName: 'Thiết bị không xác định',
    };
  }

  // 1. Nhận diện Hệ điều hành (OS)
  let os = 'Khác';
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';

  if (/Windows NT 10.0/i.test(ua)) {
    os = 'Windows 10/11';
  } else if (/Windows NT 6.3/i.test(ua)) {
    os = 'Windows 8.1';
  } else if (/Windows NT 6.1/i.test(ua)) {
    os = 'Windows 7';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/iPhone/i.test(ua)) {
    os = 'iOS (iPhone)';
    deviceType = 'mobile';
  } else if (/iPad/i.test(ua)) {
    os = 'iPadOS';
    deviceType = 'tablet';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
    deviceType = /Mobile/i.test(ua) ? 'mobile' : 'tablet';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // 2. Nhận diện Trình duyệt (Browser)
  let browser = 'Trình duyệt Web';
  if (/Edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/CocCoc/i.test(ua)) {
    browser = 'Cốc Cốc';
  } else if (/OPR\/|Opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/Chrome\//i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/Safari\//i.test(ua)) {
    browser = 'Apple Safari';
  }

  return {
    browser,
    os,
    deviceType,
    friendlyName: `${browser} trên ${os}`,
  };
}

export function formatIpAddress(ip: string | null | undefined): {
  displayIp: string;
  isLocal: boolean;
} {
  if (!ip || ip.trim() === '') {
    return { displayIp: 'Không rõ IP', isLocal: false };
  }

  const cleanIp = ip.trim();
  if (
    cleanIp === '0:0:0:0:0:0:0:1' ||
    cleanIp === '::1' ||
    cleanIp === '127.0.0.1' ||
    cleanIp === 'localhost'
  ) {
    return { displayIp: 'Máy nội bộ (Localhost)', isLocal: true };
  }

  return { displayIp: cleanIp, isLocal: false };
}
