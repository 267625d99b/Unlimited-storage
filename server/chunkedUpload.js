/**
 * Chunked Upload Module
 * رفع الملفات الكبيرة على أجزاء - مباشرة للذاكرة بدون تخزين محلي! 🚀
 */

const crypto = require('crypto');

// ============ CONFIGURATION ============
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const UPLOAD_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// In-memory upload sessions - الأجزاء تتخزن في RAM مش على الهارد!
const uploadSessions = new Map();

// ============ UPLOAD SESSION MANAGEMENT ============

/**
 * Initialize a new chunked upload session
 * @param {Object} params - Upload parameters
 * @returns {Object} Session info
 */
function initUpload({ fileName, fileSize, fileType, userId, folderId, totalChunks }) {
  // Validate file size
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`حجم الملف كبير جداً (الحد الأقصى ${formatBytes(MAX_FILE_SIZE)})`);
  }

  // Generate unique upload ID
  const uploadId = crypto.randomUUID();
  const fileHash = crypto.createHash('md5').update(`${fileName}-${fileSize}-${Date.now()}`).digest('hex');
  
  // Calculate chunks
  const calculatedChunks = Math.ceil(fileSize / CHUNK_SIZE);
  const chunks = totalChunks || calculatedChunks;

  // Create session - الأجزاء تتخزن في الذاكرة (RAM) مش على الهارد!
  const session = {
    uploadId,
    fileName,
    fileSize,
    fileType,
    userId,
    folderId,
    fileHash,
    totalChunks: chunks,
    uploadedChunks: [],
    chunkBuffers: new Map(), // تخزين الأجزاء في الذاكرة
    uploadedBytes: 0,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + UPLOAD_TIMEOUT
  };

  // Store session
  uploadSessions.set(uploadId, session);

  console.log(`📤 Upload session created (in-memory): ${uploadId} for ${fileName} (${formatBytes(fileSize)}, ${chunks} chunks)`);

  return {
    uploadId,
    chunkSize: CHUNK_SIZE,
    totalChunks: chunks,
    expiresAt: session.expiresAt
  };
}

/**
 * Upload a single chunk - يتخزن في الذاكرة مباشرة!
 * @param {string} uploadId - Upload session ID
 * @param {number} chunkIndex - Chunk index (0-based)
 * @param {Buffer} chunkData - Chunk data
 * @returns {Object} Upload progress
 */
function uploadChunk(uploadId, chunkIndex, chunkData) {
  const session = uploadSessions.get(uploadId);
  
  if (!session) {
    throw new Error('جلسة الرفع غير موجودة أو منتهية الصلاحية');
  }

  if (session.status === 'completed') {
    throw new Error('تم اكتمال الرفع مسبقاً');
  }

  if (session.status === 'failed') {
    throw new Error('فشل الرفع، يرجى البدء من جديد');
  }

  if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
    throw new Error(`رقم الجزء غير صالح: ${chunkIndex}`);
  }

  // Check if chunk already uploaded
  if (session.uploadedChunks.includes(chunkIndex)) {
    console.log(`⚠️ Chunk ${chunkIndex} already uploaded for ${uploadId}`);
    return getUploadProgress(uploadId);
  }

  // تخزين الجزء في الذاكرة (RAM) بدلاً من الهارد ديسك!
  session.chunkBuffers.set(chunkIndex, chunkData);

  // Update session
  session.uploadedChunks.push(chunkIndex);
  session.uploadedBytes += chunkData.length;
  session.updatedAt = Date.now();
  session.status = 'uploading';

  console.log(`📦 Chunk ${chunkIndex + 1}/${session.totalChunks} stored in memory for ${session.fileName}`);

  return getUploadProgress(uploadId);
}

/**
 * Get upload progress
 * @param {string} uploadId - Upload session ID
 * @returns {Object} Progress info
 */
function getUploadProgress(uploadId) {
  const session = uploadSessions.get(uploadId);
  
  if (!session) {
    return null;
  }

  const progress = (session.uploadedChunks.length / session.totalChunks) * 100;
  const missingChunks = [];
  
  for (let i = 0; i < session.totalChunks; i++) {
    if (!session.uploadedChunks.includes(i)) {
      missingChunks.push(i);
    }
  }

  return {
    uploadId,
    fileName: session.fileName,
    fileSize: session.fileSize,
    totalChunks: session.totalChunks,
    uploadedChunks: session.uploadedChunks.length,
    uploadedBytes: session.uploadedBytes,
    progress: Math.round(progress * 100) / 100,
    status: session.status,
    missingChunks,
    isComplete: session.uploadedChunks.length === session.totalChunks
  };
}

/**
 * Complete the upload - يجمع الأجزاء من الذاكرة ويرجع Buffer جاهز للرفع لـ Telegram
 * @param {string} uploadId - Upload session ID
 * @returns {Object} Final file info with buffer
 */
async function completeUpload(uploadId) {
  const session = uploadSessions.get(uploadId);
  
  if (!session) {
    throw new Error('جلسة الرفع غير موجودة');
  }

  // Check if all chunks uploaded
  if (session.uploadedChunks.length !== session.totalChunks) {
    const missing = session.totalChunks - session.uploadedChunks.length;
    throw new Error(`لم يتم رفع جميع الأجزاء (${missing} أجزاء متبقية)`);
  }

  try {
    // تجميع الأجزاء من الذاكرة في Buffer واحد
    const sortedChunks = [];
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkBuffer = session.chunkBuffers.get(i);
      if (!chunkBuffer) {
        throw new Error(`الجزء ${i} غير موجود في الذاكرة`);
      }
      sortedChunks.push(chunkBuffer);
    }

    const finalBuffer = Buffer.concat(sortedChunks);
    
    // Verify file size
    if (Math.abs(finalBuffer.length - session.fileSize) > 1024) {
      console.warn(`⚠️ File size mismatch: expected ${session.fileSize}, got ${finalBuffer.length}`);
    }

    // Calculate file hash
    const hash = crypto.createHash('md5').update(finalBuffer).digest('hex');

    // Update session status
    session.status = 'completed';
    session.finalHash = hash;
    session.finalBuffer = finalBuffer;

    console.log(`✅ Upload completed in memory: ${session.fileName} (${formatBytes(finalBuffer.length)}) - Zero disk usage!`);

    return {
      success: true,
      uploadId,
      fileName: session.fileName,
      fileBuffer: finalBuffer, // Buffer جاهز للرفع لـ Telegram
      fileSize: finalBuffer.length,
      fileType: session.fileType,
      hash,
      userId: session.userId,
      folderId: session.folderId
    };
  } catch (error) {
    session.status = 'failed';
    console.error(`❌ Upload completion failed: ${error.message}`);
    throw error;
  }
}

/**
 * Cancel and cleanup an upload session
 * @param {string} uploadId - Upload session ID
 */
function cancelUpload(uploadId) {
  const session = uploadSessions.get(uploadId);
  
  if (session) {
    cleanupSession(uploadId);
    session.status = 'cancelled';
    uploadSessions.delete(uploadId);
    console.log(`🗑️ Upload cancelled: ${uploadId}`);
  }

  return { success: true };
}

/**
 * Cleanup memory for a session - تحرير الذاكرة
 * @param {string} uploadId - Upload session ID
 */
function cleanupSession(uploadId) {
  const session = uploadSessions.get(uploadId);
  
  if (session && session.chunkBuffers) {
    // تحرير الذاكرة
    session.chunkBuffers.clear();
    session.finalBuffer = null;
    console.log(`🧹 Memory cleaned for session: ${uploadId}`);
  }
}

/**
 * Resume an interrupted upload
 * @param {string} uploadId - Upload session ID
 * @returns {Object} Session info with missing chunks
 */
function resumeUpload(uploadId) {
  const session = uploadSessions.get(uploadId);
  
  if (!session) {
    return null;
  }

  // Check if expired
  if (Date.now() > session.expiresAt) {
    cancelUpload(uploadId);
    return null;
  }

  // Reset status if was failed
  if (session.status === 'failed') {
    session.status = 'uploading';
  }

  return getUploadProgress(uploadId);
}

/**
 * Check if an upload can be resumed (by file hash)
 * @param {string} fileHash - File hash
 * @param {string} userId - User ID
 * @returns {Object|null} Existing session or null
 */
function findResumableUpload(fileName, fileSize, userId) {
  for (const [uploadId, session] of uploadSessions) {
    if (
      session.fileName === fileName &&
      session.fileSize === fileSize &&
      session.userId === userId &&
      session.status !== 'completed' &&
      session.status !== 'cancelled' &&
      Date.now() < session.expiresAt
    ) {
      return getUploadProgress(uploadId);
    }
  }
  return null;
}

// ============ CLEANUP EXPIRED SESSIONS ============
function cleanupExpiredSessions() {
  const now = Date.now();
  let cleaned = 0;

  for (const [uploadId, session] of uploadSessions) {
    if (now > session.expiresAt || session.status === 'completed') {
      cleanupSession(uploadId);
      uploadSessions.delete(uploadId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired upload sessions`);
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// ============ HELPERS ============
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============ EXPORTS ============
module.exports = {
  CHUNK_SIZE,
  MAX_FILE_SIZE,
  initUpload,
  uploadChunk,
  getUploadProgress,
  completeUpload,
  cancelUpload,
  resumeUpload,
  findResumableUpload,
  cleanupExpiredSessions
};
