/**
 * Two-Factor Authentication (2FA) Module
 * نظام المصادقة الثنائية
 */

const crypto = require('crypto');

// ============ TOTP IMPLEMENTATION ============
// Time-based One-Time Password (RFC 6238)

const TOTP_CONFIG = {
  digits: 6,
  period: 30, // seconds
  algorithm: 'sha1'
};

/**
 * Generate a random secret for 2FA
 * @returns {string} Base32 encoded secret
 */
function generateSecret() {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Base32 encode
 * @param {Buffer} buffer 
 * @returns {string}
 */
function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;
  
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }
  
  return result;
}

/**
 * Base32 decode
 * @param {string} str 
 * @returns {Buffer}
 */
function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  str = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  
  const bytes = [];
  let bits = 0;
  let value = 0;
  
  for (let i = 0; i < str.length; i++) {
    const idx = alphabet.indexOf(str[i]);
    if (idx === -1) continue;
    
    value = (value << 5) | idx;
    bits += 5;
    
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  
  return Buffer.from(bytes);
}

/**
 * Generate TOTP code
 * @param {string} secret - Base32 encoded secret
 * @param {number} counter - Time counter (optional, uses current time)
 * @returns {string} 6-digit code
 */
function generateTOTP(secret, counter = null) {
  if (counter === null) {
    counter = Math.floor(Date.now() / 1000 / TOTP_CONFIG.period);
  }
  
  const secretBuffer = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  
  // Write counter as big-endian 64-bit integer
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  
  // HMAC-SHA1
  const hmac = crypto.createHmac(TOTP_CONFIG.algorithm, secretBuffer);
  hmac.update(counterBuffer);
  const hash = hmac.digest();
  
  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = 
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  
  const otp = binary % Math.pow(10, TOTP_CONFIG.digits);
  return otp.toString().padStart(TOTP_CONFIG.digits, '0');
}

/**
 * Verify TOTP code
 * @param {string} secret - Base32 encoded secret
 * @param {string} code - User provided code
 * @param {number} window - Number of periods to check before/after (default: 1)
 * @returns {boolean}
 */
function verifyTOTP(secret, code, window = 1) {
  const currentCounter = Math.floor(Date.now() / 1000 / TOTP_CONFIG.period);
  
  for (let i = -window; i <= window; i++) {
    const expectedCode = generateTOTP(secret, currentCounter + i);
    if (code === expectedCode) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate QR code URL for authenticator apps
 * @param {string} secret 
 * @param {string} accountName - User's email or username
 * @param {string} issuer - App name
 * @returns {string} otpauth URL
 */
function generateQRCodeURL(secret, accountName, issuer = 'CloudStorage') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_CONFIG.digits}&period=${TOTP_CONFIG.period}`;
}

/**
 * Generate backup codes
 * @param {number} count - Number of codes to generate
 * @returns {string[]} Array of backup codes
 */
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

/**
 * Hash backup code for storage
 * @param {string} code 
 * @returns {string}
 */
function hashBackupCode(code) {
  return crypto.createHash('sha256').update(code.replace(/-/g, '')).digest('hex');
}

/**
 * Verify backup code
 * @param {string} code - User provided code
 * @param {string[]} hashedCodes - Array of hashed backup codes
 * @returns {number} Index of matched code, or -1 if not found
 */
function verifyBackupCode(code, hashedCodes) {
  const hashed = hashBackupCode(code);
  return hashedCodes.indexOf(hashed);
}

// ============ 2FA SETUP FLOW ============

/**
 * Initialize 2FA setup for user
 * @param {string} accountName 
 * @param {string} issuer 
 * @returns {object} { secret, qrCodeUrl, backupCodes }
 */
function setup2FA(accountName, issuer = 'CloudStorage') {
  const secret = generateSecret();
  const qrCodeUrl = generateQRCodeURL(secret, accountName, issuer);
  const backupCodes = generateBackupCodes(10);
  const hashedBackupCodes = backupCodes.map(hashBackupCode);
  
  return {
    secret,
    qrCodeUrl,
    backupCodes, // Show to user once
    hashedBackupCodes // Store in database
  };
}

/**
 * Verify 2FA during login
 * @param {string} secret - User's 2FA secret
 * @param {string} code - User provided code
 * @param {string[]} hashedBackupCodes - User's hashed backup codes
 * @returns {{ valid: boolean, usedBackupCode: boolean, backupCodeIndex: number }}
 */
function verify2FA(secret, code, hashedBackupCodes = []) {
  // First try TOTP
  if (verifyTOTP(secret, code)) {
    return { valid: true, usedBackupCode: false, backupCodeIndex: -1 };
  }
  
  // Then try backup codes
  const backupIndex = verifyBackupCode(code, hashedBackupCodes);
  if (backupIndex !== -1) {
    return { valid: true, usedBackupCode: true, backupCodeIndex: backupIndex };
  }
  
  return { valid: false, usedBackupCode: false, backupCodeIndex: -1 };
}

// ============ EXPORTS ============
module.exports = {
  // Secret generation
  generateSecret,
  
  // TOTP
  generateTOTP,
  verifyTOTP,
  generateQRCodeURL,
  
  // Backup codes
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  
  // Setup flow
  setup2FA,
  verify2FA,
  
  // Config
  TOTP_CONFIG
};
