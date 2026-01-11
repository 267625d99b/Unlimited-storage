/**
 * File Encryption Module
 * نظام تشفير الملفات (AES-256-GCM)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

// ============ CONFIGURATION ============
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

// Master key (should be stored securely, e.g., in HSM or KMS)
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || null;

// ============ KEY MANAGEMENT ============

/**
 * Generate a random encryption key
 */
function generateKey() {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Generate a random IV
 */
function generateIV() {
  return crypto.randomBytes(IV_LENGTH);
}

/**
 * Derive key from password using PBKDF2
 */
function deriveKeyFromPassword(password, salt = null) {
  const useSalt = salt || crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(
    password,
    useSalt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );
  return { key, salt: useSalt };
}

/**
 * Encrypt a key with master key (key wrapping)
 */
function wrapKey(key) {
  if (!MASTER_KEY) {
    throw new Error('Master key not configured');
  }
  
  const masterKeyBuffer = Buffer.from(MASTER_KEY, 'hex');
  const iv = generateIV();
  const cipher = crypto.createCipheriv(ALGORITHM, masterKeyBuffer, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(key),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a wrapped key
 */
function unwrapKey(wrappedKey) {
  if (!MASTER_KEY) {
    throw new Error('Master key not configured');
  }
  
  const masterKeyBuffer = Buffer.from(MASTER_KEY, 'hex');
  const data = Buffer.from(wrappedKey, 'base64');
  
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKeyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
}

// ============ DATA ENCRYPTION ============

/**
 * Encrypt data (Buffer or string)
 */
function encrypt(data, key = null) {
  const useKey = key || generateKey();
  const iv = generateIV();
  
  const cipher = crypto.createCipheriv(ALGORITHM, useKey, iv);
  
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  
  const encrypted = Buffer.concat([
    cipher.update(dataBuffer),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Format: IV (16) + AuthTag (16) + Encrypted Data
  const result = Buffer.concat([iv, authTag, encrypted]);
  
  return {
    encrypted: result,
    key: useKey,
    iv,
    authTag
  };
}

/**
 * Decrypt data
 */
function decrypt(encryptedData, key) {
  const data = Buffer.isBuffer(encryptedData) 
    ? encryptedData 
    : Buffer.from(encryptedData, 'base64');
  
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
}

// ============ FILE ENCRYPTION ============

/**
 * Encrypt a file
 */
async function encryptFile(inputPath, outputPath, key = null) {
  const useKey = key || generateKey();
  const iv = generateIV();
  
  const cipher = crypto.createCipheriv(ALGORITHM, useKey, iv);
  
  const input = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(outputPath);
  
  // Write IV at the beginning
  output.write(iv);
  
  // Encrypt file content
  await pipeline(input, cipher, output);
  
  // Get auth tag
  const authTag = cipher.getAuthTag();
  
  // Append auth tag at the end
  fs.appendFileSync(outputPath, authTag);
  
  // Get file stats
  const stats = fs.statSync(outputPath);
  
  return {
    key: useKey,
    iv,
    authTag,
    encryptedSize: stats.size,
    originalPath: inputPath,
    encryptedPath: outputPath
  };
}

/**
 * Decrypt a file
 */
async function decryptFile(inputPath, outputPath, key) {
  const stats = fs.statSync(inputPath);
  const fileSize = stats.size;
  
  // Read IV from beginning
  const fd = fs.openSync(inputPath, 'r');
  const iv = Buffer.alloc(IV_LENGTH);
  fs.readSync(fd, iv, 0, IV_LENGTH, 0);
  
  // Read auth tag from end
  const authTag = Buffer.alloc(AUTH_TAG_LENGTH);
  fs.readSync(fd, authTag, 0, AUTH_TAG_LENGTH, fileSize - AUTH_TAG_LENGTH);
  fs.closeSync(fd);
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  // Create streams
  const input = fs.createReadStream(inputPath, {
    start: IV_LENGTH,
    end: fileSize - AUTH_TAG_LENGTH - 1
  });
  const output = fs.createWriteStream(outputPath);
  
  // Decrypt
  await pipeline(input, decipher, output);
  
  return {
    decryptedPath: outputPath
  };
}

/**
 * Encrypt file in place (creates .enc file)
 */
async function encryptFileInPlace(filePath, key = null) {
  const encryptedPath = filePath + '.enc';
  const result = await encryptFile(filePath, encryptedPath, key);
  
  // Optionally delete original
  // fs.unlinkSync(filePath);
  
  return result;
}

/**
 * Decrypt file in place (removes .enc extension)
 */
async function decryptFileInPlace(encryptedPath, key) {
  const decryptedPath = encryptedPath.replace(/\.enc$/, '');
  const result = await decryptFile(encryptedPath, decryptedPath, key);
  
  // Optionally delete encrypted
  // fs.unlinkSync(encryptedPath);
  
  return result;
}

// ============ STREAMING ENCRYPTION ============

/**
 * Create encryption transform stream
 */
function createEncryptStream(key) {
  const iv = generateIV();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Prepend IV to stream
  let ivSent = false;
  
  const transform = new (require('stream').Transform)({
    transform(chunk, encoding, callback) {
      if (!ivSent) {
        this.push(iv);
        ivSent = true;
      }
      callback(null, cipher.update(chunk));
    },
    flush(callback) {
      this.push(cipher.final());
      this.push(cipher.getAuthTag());
      callback();
    }
  });
  
  return { stream: transform, iv };
}

/**
 * Create decryption transform stream
 */
function createDecryptStream(key) {
  let iv = null;
  let buffer = Buffer.alloc(0);
  let decipher = null;
  
  const transform = new (require('stream').Transform)({
    transform(chunk, encoding, callback) {
      buffer = Buffer.concat([buffer, chunk]);
      
      // Wait for IV
      if (!iv && buffer.length >= IV_LENGTH) {
        iv = buffer.subarray(0, IV_LENGTH);
        buffer = buffer.subarray(IV_LENGTH);
        decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      }
      
      // Process data (keep last 16 bytes for auth tag)
      if (decipher && buffer.length > AUTH_TAG_LENGTH) {
        const toProcess = buffer.subarray(0, buffer.length - AUTH_TAG_LENGTH);
        buffer = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
        callback(null, decipher.update(toProcess));
      } else {
        callback();
      }
    },
    flush(callback) {
      if (decipher && buffer.length === AUTH_TAG_LENGTH) {
        decipher.setAuthTag(buffer);
        try {
          this.push(decipher.final());
          callback();
        } catch (e) {
          callback(new Error('Decryption failed - invalid auth tag'));
        }
      } else {
        callback(new Error('Invalid encrypted data'));
      }
    }
  });
  
  return transform;
}

// ============ PASSWORD-BASED ENCRYPTION ============

/**
 * Encrypt data with password
 */
function encryptWithPassword(data, password) {
  const { key, salt } = deriveKeyFromPassword(password);
  const { encrypted, iv, authTag } = encrypt(data, key);
  
  // Format: Salt (32) + IV (16) + AuthTag (16) + Encrypted Data
  const result = Buffer.concat([salt, encrypted]);
  
  return result.toString('base64');
}

/**
 * Decrypt data with password
 */
function decryptWithPassword(encryptedBase64, password) {
  const data = Buffer.from(encryptedBase64, 'base64');
  
  const salt = data.subarray(0, SALT_LENGTH);
  const encryptedData = data.subarray(SALT_LENGTH);
  
  const { key } = deriveKeyFromPassword(password, salt);
  
  return decrypt(encryptedData, key);
}

// ============ HASH FUNCTIONS ============

/**
 * Calculate file hash (SHA-256)
 */
async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Calculate data hash
 */
function calculateHash(data, algorithm = 'sha256') {
  return crypto.createHash(algorithm).update(data).digest('hex');
}

// ============ SECURE RANDOM ============

/**
 * Generate secure random string
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate secure random number
 */
function generateSecureNumber(min, max) {
  const range = max - min;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const randomBytes = crypto.randomBytes(bytesNeeded);
  const randomNumber = parseInt(randomBytes.toString('hex'), 16);
  return min + (randomNumber % range);
}

// ============ EXPORTS ============
module.exports = {
  // Key management
  generateKey,
  generateIV,
  deriveKeyFromPassword,
  wrapKey,
  unwrapKey,
  
  // Data encryption
  encrypt,
  decrypt,
  
  // File encryption
  encryptFile,
  decryptFile,
  encryptFileInPlace,
  decryptFileInPlace,
  
  // Streaming
  createEncryptStream,
  createDecryptStream,
  
  // Password-based
  encryptWithPassword,
  decryptWithPassword,
  
  // Hashing
  calculateFileHash,
  calculateHash,
  
  // Random
  generateSecureToken,
  generateSecureNumber,
  
  // Constants
  ALGORITHM,
  KEY_LENGTH,
  IV_LENGTH
};
