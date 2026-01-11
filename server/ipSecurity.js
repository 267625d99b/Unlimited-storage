/**
 * IP Security Module
 * نظام أمان عناوين IP (Whitelist/Blacklist, Geo-blocking)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============ CONFIGURATION ============
const IP_CONFIG_FILE = path.join(__dirname, '.ip-security.json');
const FAILED_ATTEMPTS_THRESHOLD = 10;
const BLOCK_DURATION = 60 * 60 * 1000; // 1 hour
const SUSPICIOUS_THRESHOLD = 5;

// ============ DATA MANAGEMENT ============
let ipData = {
  whitelist: [],
  blacklist: [],
  failedAttempts: {},
  suspiciousIPs: {},
  geoBlocking: {
    enabled: false,
    mode: 'blacklist', // 'whitelist' or 'blacklist'
    countries: []
  },
  settings: {
    enableWhitelist: false,
    enableBlacklist: true,
    enableAutoBlock: true,
    enableGeoBlocking: false
  }
};

function loadIPData() {
  try {
    if (fs.existsSync(IP_CONFIG_FILE)) {
      ipData = JSON.parse(fs.readFileSync(IP_CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading IP data:', e);
  }
  return ipData;
}

function saveIPData() {
  try {
    fs.writeFileSync(IP_CONFIG_FILE, JSON.stringify(ipData, null, 2));
  } catch (e) {
    console.error('Error saving IP data:', e);
  }
}

// ============ IP UTILITIES ============

/**
 * Get client IP from request
 */
function getClientIP(req) {
  // Check various headers for proxied requests
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }
  
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Normalize IP address
 */
function normalizeIP(ip) {
  if (!ip) return null;
  
  // Remove IPv6 prefix for IPv4 addresses
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  return ip;
}

/**
 * Check if IP matches pattern (supports CIDR and wildcards)
 */
function ipMatches(ip, pattern) {
  if (!ip || !pattern) return false;
  
  const normalizedIP = normalizeIP(ip);
  const normalizedPattern = normalizeIP(pattern);
  
  // Exact match
  if (normalizedIP === normalizedPattern) return true;
  
  // Wildcard match (e.g., 192.168.*.*)
  if (normalizedPattern.includes('*')) {
    const regex = new RegExp('^' + normalizedPattern.replace(/\./g, '\\.').replace(/\*/g, '\\d+') + '$');
    return regex.test(normalizedIP);
  }
  
  // CIDR match (e.g., 192.168.1.0/24)
  if (normalizedPattern.includes('/')) {
    return ipInCIDR(normalizedIP, normalizedPattern);
  }
  
  return false;
}

/**
 * Check if IP is in CIDR range
 */
function ipInCIDR(ip, cidr) {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Convert IP to number
 */
function ipToNumber(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

/**
 * Check if IP is private/local
 */
function isPrivateIP(ip) {
  const normalizedIP = normalizeIP(ip);
  if (!normalizedIP) return false;
  
  const privateRanges = [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '127.0.0.0/8',
    '169.254.0.0/16'
  ];
  
  return privateRanges.some(range => ipInCIDR(normalizedIP, range));
}

// ============ WHITELIST MANAGEMENT ============

/**
 * Add IP to whitelist
 */
function addToWhitelist(ip, description = '', addedBy = 'system') {
  loadIPData();
  
  const normalizedIP = normalizeIP(ip);
  
  // Check if already exists
  if (ipData.whitelist.some(w => w.ip === normalizedIP)) {
    throw new Error('عنوان IP موجود بالفعل في القائمة البيضاء');
  }
  
  ipData.whitelist.push({
    ip: normalizedIP,
    description,
    addedBy,
    addedAt: new Date().toISOString()
  });
  
  // Remove from blacklist if exists
  ipData.blacklist = ipData.blacklist.filter(b => b.ip !== normalizedIP);
  
  saveIPData();
  return true;
}

/**
 * Remove IP from whitelist
 */
function removeFromWhitelist(ip) {
  loadIPData();
  
  const normalizedIP = normalizeIP(ip);
  const before = ipData.whitelist.length;
  
  ipData.whitelist = ipData.whitelist.filter(w => w.ip !== normalizedIP);
  
  if (ipData.whitelist.length === before) {
    throw new Error('عنوان IP غير موجود في القائمة البيضاء');
  }
  
  saveIPData();
  return true;
}

/**
 * Check if IP is whitelisted
 */
function isWhitelisted(ip) {
  loadIPData();
  
  if (!ipData.settings.enableWhitelist) return true;
  
  const normalizedIP = normalizeIP(ip);
  
  // Always allow private IPs
  if (isPrivateIP(normalizedIP)) return true;
  
  return ipData.whitelist.some(w => ipMatches(normalizedIP, w.ip));
}

/**
 * Get whitelist
 */
function getWhitelist() {
  loadIPData();
  return ipData.whitelist;
}

// ============ BLACKLIST MANAGEMENT ============

/**
 * Add IP to blacklist
 */
function addToBlacklist(ip, reason = '', addedBy = 'system', duration = null) {
  loadIPData();
  
  const normalizedIP = normalizeIP(ip);
  
  // Don't blacklist private IPs
  if (isPrivateIP(normalizedIP)) {
    throw new Error('لا يمكن حظر عناوين IP المحلية');
  }
  
  // Check if already exists
  const existing = ipData.blacklist.find(b => b.ip === normalizedIP);
  if (existing) {
    // Update existing entry
    existing.reason = reason;
    existing.updatedAt = new Date().toISOString();
    if (duration) {
      existing.expiresAt = new Date(Date.now() + duration).toISOString();
    }
  } else {
    ipData.blacklist.push({
      ip: normalizedIP,
      reason,
      addedBy,
      addedAt: new Date().toISOString(),
      expiresAt: duration ? new Date(Date.now() + duration).toISOString() : null
    });
  }
  
  // Remove from whitelist if exists
  ipData.whitelist = ipData.whitelist.filter(w => w.ip !== normalizedIP);
  
  saveIPData();
  return true;
}

/**
 * Remove IP from blacklist
 */
function removeFromBlacklist(ip) {
  loadIPData();
  
  const normalizedIP = normalizeIP(ip);
  const before = ipData.blacklist.length;
  
  ipData.blacklist = ipData.blacklist.filter(b => b.ip !== normalizedIP);
  
  if (ipData.blacklist.length === before) {
    throw new Error('عنوان IP غير موجود في القائمة السوداء');
  }
  
  saveIPData();
  return true;
}

/**
 * Check if IP is blacklisted
 */
function isBlacklisted(ip) {
  loadIPData();
  
  if (!ipData.settings.enableBlacklist) return false;
  
  const normalizedIP = normalizeIP(ip);
  
  const entry = ipData.blacklist.find(b => ipMatches(normalizedIP, b.ip));
  
  if (!entry) return false;
  
  // Check expiry
  if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
    // Remove expired entry
    ipData.blacklist = ipData.blacklist.filter(b => b.ip !== entry.ip);
    saveIPData();
    return false;
  }
  
  return true;
}

/**
 * Get blacklist
 */
function getBlacklist() {
  loadIPData();
  return ipData.blacklist;
}

// ============ AUTO-BLOCKING ============

/**
 * Record failed attempt
 */
function recordFailedAttempt(ip, reason = 'login_failed') {
  loadIPData();
  
  const normalizedIP = normalizeIP(ip);
  if (!normalizedIP || isPrivateIP(normalizedIP)) return;
  
  if (!ipData.failedAttempts[normalizedIP]) {
    ipData.failedAttempts[normalizedIP] = {
      count: 0,
      firstAttempt: Date.now(),
      lastAttempt: Date.now(),
      reasons: []
    };
  }
  
  const record = ipData.failedAttempts[normalizedIP];
  record.count++;
  record.lastAttempt = Date.now();
  record.reasons.push({ reason, time: Date.now() });
  
  // Keep only last 100 reasons
  if (record.reasons.length > 100) {
    record.reasons = record.reasons.slice(-100);
  }
  
  saveIPData();
  
  // Auto-block if threshold exceeded
  if (ipData.settings.enableAutoBlock && record.count >= FAILED_ATTEMPTS_THRESHOLD) {
    addToBlacklist(normalizedIP, `تم الحظر تلقائياً: ${record.count} محاولات فاشلة`, 'auto', BLOCK_DURATION);
    delete ipData.failedAttempts[normalizedIP];
    saveIPData();
    
    return { blocked: true, reason: 'تم حظر عنوان IP بسبب محاولات فاشلة متعددة' };
  }
  
  return { blocked: false, attempts: record.count };
}

/**
 * Clear failed attempts for IP
 */
function clearFailedAttempts(ip) {
  loadIPData();
  
  const normalizedIP = normalizeIP(ip);
  delete ipData.failedAttempts[normalizedIP];
  
  saveIPData();
}

/**
 * Get failed attempts for IP
 */
function getFailedAttempts(ip) {
  loadIPData();
  
  const normalizedIP = normalizeIP(ip);
  return ipData.failedAttempts[normalizedIP] || null;
}

// ============ SUSPICIOUS ACTIVITY ============

/**
 * Mark IP as suspicious
 */
function markSuspicious(ip, reason) {
  loadIPData();
  
  const normalizedIP = normalizeIP(ip);
  if (!normalizedIP) return;
  
  if (!ipData.suspiciousIPs[normalizedIP]) {
    ipData.suspiciousIPs[normalizedIP] = {
      count: 0,
      reasons: [],
      firstSeen: Date.now()
    };
  }
  
  const record = ipData.suspiciousIPs[normalizedIP];
  record.count++;
  record.lastSeen = Date.now();
  record.reasons.push({ reason, time: Date.now() });
  
  saveIPData();
  
  // Auto-block if very suspicious
  if (record.count >= SUSPICIOUS_THRESHOLD) {
    addToBlacklist(normalizedIP, `نشاط مشبوه: ${reason}`, 'auto', BLOCK_DURATION * 2);
  }
  
  return record;
}

/**
 * Get suspicious IPs
 */
function getSuspiciousIPs() {
  loadIPData();
  return ipData.suspiciousIPs;
}

// ============ SETTINGS ============

/**
 * Update IP security settings
 */
function updateSettings(settings) {
  loadIPData();
  
  ipData.settings = {
    ...ipData.settings,
    ...settings
  };
  
  saveIPData();
  return ipData.settings;
}

/**
 * Get IP security settings
 */
function getSettings() {
  loadIPData();
  return ipData.settings;
}

// ============ MIDDLEWARE ============

/**
 * IP security middleware
 */
function ipSecurityMiddleware(options = {}) {
  const {
    onBlocked = null,
    skipPaths = ['/health', '/api/health']
  } = options;
  
  return (req, res, next) => {
    // Skip certain paths
    if (skipPaths.some(p => req.path.startsWith(p))) {
      return next();
    }
    
    const ip = getClientIP(req);
    const normalizedIP = normalizeIP(ip);
    
    // Attach IP to request
    req.clientIP = normalizedIP;
    
    // Check blacklist
    if (isBlacklisted(normalizedIP)) {
      if (onBlocked) onBlocked(req, 'blacklisted');
      return res.status(403).json({ 
        error: 'تم حظر عنوان IP الخاص بك',
        code: 'IP_BLOCKED'
      });
    }
    
    // Check whitelist (if enabled)
    if (ipData.settings.enableWhitelist && !isWhitelisted(normalizedIP)) {
      if (onBlocked) onBlocked(req, 'not_whitelisted');
      return res.status(403).json({ 
        error: 'عنوان IP غير مصرح به',
        code: 'IP_NOT_ALLOWED'
      });
    }
    
    next();
  };
}

// ============ CLEANUP ============

/**
 * Clean expired entries
 */
function cleanExpiredEntries() {
  loadIPData();
  
  const now = new Date();
  
  // Clean expired blacklist entries
  ipData.blacklist = ipData.blacklist.filter(b => 
    !b.expiresAt || new Date(b.expiresAt) > now
  );
  
  // Clean old failed attempts (older than 24 hours)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const ip in ipData.failedAttempts) {
    if (ipData.failedAttempts[ip].lastAttempt < cutoff) {
      delete ipData.failedAttempts[ip];
    }
  }
  
  // Clean old suspicious records (older than 7 days)
  const suspiciousCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const ip in ipData.suspiciousIPs) {
    if (ipData.suspiciousIPs[ip].lastSeen < suspiciousCutoff) {
      delete ipData.suspiciousIPs[ip];
    }
  }
  
  saveIPData();
}

// Run cleanup every hour
setInterval(cleanExpiredEntries, 60 * 60 * 1000);

// ============ EXPORTS ============
module.exports = {
  // Utilities
  getClientIP,
  normalizeIP,
  ipMatches,
  isPrivateIP,
  
  // Whitelist
  addToWhitelist,
  removeFromWhitelist,
  isWhitelisted,
  getWhitelist,
  
  // Blacklist
  addToBlacklist,
  removeFromBlacklist,
  isBlacklisted,
  getBlacklist,
  
  // Auto-blocking
  recordFailedAttempt,
  clearFailedAttempts,
  getFailedAttempts,
  
  // Suspicious activity
  markSuspicious,
  getSuspiciousIPs,
  
  // Settings
  updateSettings,
  getSettings,
  
  // Middleware
  ipSecurityMiddleware,
  
  // Cleanup
  cleanExpiredEntries
};
