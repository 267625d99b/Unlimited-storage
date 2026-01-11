/**
 * Device Management Module
 * نظام إدارة الأجهزة والجلسات
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============ CONFIGURATION ============
const DEVICES_FILE = path.join(__dirname, '.devices.json');
const MAX_DEVICES_PER_USER = 10;
const DEVICE_TRUST_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

// ============ DATA MANAGEMENT ============
let devicesData = { devices: [], trustedDevices: [] };

function loadDevices() {
  try {
    if (fs.existsSync(DEVICES_FILE)) {
      devicesData = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading devices:', e);
  }
  return devicesData;
}

function saveDevices() {
  try {
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(devicesData, null, 2));
  } catch (e) {
    console.error('Error saving devices:', e);
  }
}

// ============ DEVICE FINGERPRINTING ============

/**
 * Generate device fingerprint from request
 */
function generateDeviceFingerprint(req) {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.ip || req.connection?.remoteAddress || ''
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 32);
}

/**
 * Parse user agent for device info
 */
function parseUserAgent(userAgent) {
  if (!userAgent) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
  }
  
  // Browser detection
  let browser = 'Unknown';
  if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg')) browser = 'Edge';
  else if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Opera') || userAgent.includes('OPR')) browser = 'Opera';
  
  // OS detection
  let os = 'Unknown';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
  
  // Device type
  let device = 'Desktop';
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) device = 'Mobile';
  else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) device = 'Tablet';
  
  return { browser, os, device };
}

/**
 * Get device info from request
 */
function getDeviceInfo(req) {
  const userAgent = req.headers['user-agent'] || '';
  const parsed = parseUserAgent(userAgent);
  
  return {
    fingerprint: generateDeviceFingerprint(req),
    userAgent,
    browser: parsed.browser,
    os: parsed.os,
    deviceType: parsed.device,
    ip: req.ip || req.connection?.remoteAddress || 'Unknown',
    language: req.headers['accept-language']?.split(',')[0] || 'Unknown'
  };
}

// ============ DEVICE MANAGEMENT ============

/**
 * Register a new device for user
 */
function registerDevice(userId, deviceInfo, sessionId) {
  loadDevices();
  
  const deviceId = crypto.randomUUID();
  const now = Date.now();
  
  const device = {
    id: deviceId,
    userId,
    sessionId,
    fingerprint: deviceInfo.fingerprint,
    name: `${deviceInfo.browser} على ${deviceInfo.os}`,
    browser: deviceInfo.browser,
    os: deviceInfo.os,
    deviceType: deviceInfo.deviceType,
    ip: deviceInfo.ip,
    language: deviceInfo.language,
    userAgent: deviceInfo.userAgent,
    trusted: false,
    trustedUntil: null,
    firstSeenAt: now,
    lastSeenAt: now,
    lastActivityAt: now,
    loginCount: 1,
    status: 'active' // active, blocked, suspicious
  };
  
  // Check device limit
  const userDevices = devicesData.devices.filter(d => d.userId === userId);
  if (userDevices.length >= MAX_DEVICES_PER_USER) {
    // Remove oldest device
    const oldest = userDevices.sort((a, b) => a.lastSeenAt - b.lastSeenAt)[0];
    devicesData.devices = devicesData.devices.filter(d => d.id !== oldest.id);
  }
  
  devicesData.devices.push(device);
  saveDevices();
  
  return device;
}

/**
 * Update device activity
 */
function updateDeviceActivity(deviceId, sessionId = null) {
  loadDevices();
  
  const device = devicesData.devices.find(d => d.id === deviceId);
  if (device) {
    device.lastSeenAt = Date.now();
    device.lastActivityAt = Date.now();
    if (sessionId) {
      device.sessionId = sessionId;
    }
    saveDevices();
  }
  
  return device;
}

/**
 * Find device by fingerprint
 */
function findDeviceByFingerprint(userId, fingerprint) {
  loadDevices();
  return devicesData.devices.find(d => 
    d.userId === userId && d.fingerprint === fingerprint
  );
}

/**
 * Get user devices
 */
function getUserDevices(userId) {
  loadDevices();
  return devicesData.devices
    .filter(d => d.userId === userId)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

/**
 * Get device by ID
 */
function getDevice(deviceId) {
  loadDevices();
  return devicesData.devices.find(d => d.id === deviceId);
}

/**
 * Remove device
 */
function removeDevice(deviceId, userId) {
  loadDevices();
  
  const index = devicesData.devices.findIndex(d => 
    d.id === deviceId && d.userId === userId
  );
  
  if (index === -1) {
    throw new Error('الجهاز غير موجود');
  }
  
  devicesData.devices.splice(index, 1);
  saveDevices();
  
  return true;
}

/**
 * Remove all user devices
 */
function removeAllUserDevices(userId) {
  loadDevices();
  devicesData.devices = devicesData.devices.filter(d => d.userId !== userId);
  saveDevices();
}

/**
 * Block device
 */
function blockDevice(deviceId, userId) {
  loadDevices();
  
  const device = devicesData.devices.find(d => 
    d.id === deviceId && d.userId === userId
  );
  
  if (!device) {
    throw new Error('الجهاز غير موجود');
  }
  
  device.status = 'blocked';
  device.blockedAt = Date.now();
  saveDevices();
  
  return device;
}

/**
 * Unblock device
 */
function unblockDevice(deviceId, userId) {
  loadDevices();
  
  const device = devicesData.devices.find(d => 
    d.id === deviceId && d.userId === userId
  );
  
  if (!device) {
    throw new Error('الجهاز غير موجود');
  }
  
  device.status = 'active';
  device.blockedAt = null;
  saveDevices();
  
  return device;
}

// ============ TRUSTED DEVICES ============

/**
 * Trust a device (skip 2FA for duration)
 */
function trustDevice(deviceId, userId, duration = DEVICE_TRUST_DURATION) {
  loadDevices();
  
  const device = devicesData.devices.find(d => 
    d.id === deviceId && d.userId === userId
  );
  
  if (!device) {
    throw new Error('الجهاز غير موجود');
  }
  
  device.trusted = true;
  device.trustedUntil = Date.now() + duration;
  saveDevices();
  
  return device;
}

/**
 * Untrust a device
 */
function untrustDevice(deviceId, userId) {
  loadDevices();
  
  const device = devicesData.devices.find(d => 
    d.id === deviceId && d.userId === userId
  );
  
  if (!device) {
    throw new Error('الجهاز غير موجود');
  }
  
  device.trusted = false;
  device.trustedUntil = null;
  saveDevices();
  
  return device;
}

/**
 * Check if device is trusted
 */
function isDeviceTrusted(deviceId) {
  loadDevices();
  
  const device = devicesData.devices.find(d => d.id === deviceId);
  if (!device) return false;
  
  if (!device.trusted) return false;
  if (device.trustedUntil && Date.now() > device.trustedUntil) {
    device.trusted = false;
    device.trustedUntil = null;
    saveDevices();
    return false;
  }
  
  return true;
}

/**
 * Untrust all user devices
 */
function untrustAllUserDevices(userId) {
  loadDevices();
  
  devicesData.devices
    .filter(d => d.userId === userId)
    .forEach(d => {
      d.trusted = false;
      d.trustedUntil = null;
    });
  
  saveDevices();
}

// ============ SECURITY CHECKS ============

/**
 * Check for suspicious device activity
 */
function checkSuspiciousActivity(userId, deviceInfo) {
  loadDevices();
  
  const userDevices = devicesData.devices.filter(d => d.userId === userId);
  const warnings = [];
  
  // Check for new location (different IP range)
  const knownIPs = userDevices.map(d => d.ip.split('.').slice(0, 2).join('.'));
  const currentIPRange = deviceInfo.ip.split('.').slice(0, 2).join('.');
  
  if (knownIPs.length > 0 && !knownIPs.includes(currentIPRange)) {
    warnings.push({
      type: 'new_location',
      message: 'تسجيل دخول من موقع جديد',
      severity: 'medium'
    });
  }
  
  // Check for new device type
  const knownDeviceTypes = [...new Set(userDevices.map(d => d.deviceType))];
  if (knownDeviceTypes.length > 0 && !knownDeviceTypes.includes(deviceInfo.deviceType)) {
    warnings.push({
      type: 'new_device_type',
      message: 'تسجيل دخول من نوع جهاز جديد',
      severity: 'low'
    });
  }
  
  // Check for rapid device changes
  const recentDevices = userDevices.filter(d => 
    Date.now() - d.lastSeenAt < 60 * 60 * 1000 // Last hour
  );
  if (recentDevices.length > 3) {
    warnings.push({
      type: 'rapid_device_changes',
      message: 'تغييرات سريعة في الأجهزة',
      severity: 'high'
    });
  }
  
  return {
    suspicious: warnings.some(w => w.severity === 'high'),
    warnings
  };
}

/**
 * Check if device is blocked
 */
function isDeviceBlocked(fingerprint, userId) {
  loadDevices();
  
  const device = devicesData.devices.find(d => 
    d.fingerprint === fingerprint && d.userId === userId
  );
  
  return device?.status === 'blocked';
}

// ============ CLEANUP ============

/**
 * Clean inactive devices
 */
function cleanInactiveDevices(inactiveDays = 90) {
  loadDevices();
  
  const cutoff = Date.now() - (inactiveDays * 24 * 60 * 60 * 1000);
  const before = devicesData.devices.length;
  
  devicesData.devices = devicesData.devices.filter(d => d.lastSeenAt > cutoff);
  
  const removed = before - devicesData.devices.length;
  if (removed > 0) {
    saveDevices();
    console.log(`🧹 Cleaned ${removed} inactive devices`);
  }
  
  return removed;
}

// Run cleanup daily
setInterval(() => cleanInactiveDevices(), 24 * 60 * 60 * 1000);

// ============ EXPORTS ============
module.exports = {
  // Device info
  generateDeviceFingerprint,
  parseUserAgent,
  getDeviceInfo,
  
  // Device management
  registerDevice,
  updateDeviceActivity,
  findDeviceByFingerprint,
  getUserDevices,
  getDevice,
  removeDevice,
  removeAllUserDevices,
  blockDevice,
  unblockDevice,
  
  // Trusted devices
  trustDevice,
  untrustDevice,
  isDeviceTrusted,
  untrustAllUserDevices,
  
  // Security
  checkSuspiciousActivity,
  isDeviceBlocked,
  
  // Cleanup
  cleanInactiveDevices,
  
  // Constants
  MAX_DEVICES_PER_USER,
  DEVICE_TRUST_DURATION
};
