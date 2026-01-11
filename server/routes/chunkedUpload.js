/**
 * Chunked Upload Routes
 * مسارات رفع الملفات الكبيرة على أجزاء
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const chunkedUpload = require('../chunkedUpload');
const users = require('../users');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Multer for chunk uploads (store in memory temporarily)
const chunkStorage = multer.memoryStorage();
const chunkUpload = multer({
  storage: chunkStorage,
  limits: {
    fileSize: chunkedUpload.CHUNK_SIZE + 1024 // Chunk size + small buffer
  }
});

// Apply auth middleware to all routes
router.use(users.authMiddleware);

/**
 * POST /api/chunked/init
 * Initialize a new chunked upload session
 */
router.post('/init', (req, res) => {
  try {
    const { fileName, fileSize, fileType, folderId, totalChunks } = req.body;

    // Validation
    if (!fileName || !fileSize) {
      return res.status(400).json({ error: 'اسم الملف وحجمه مطلوبان' });
    }

    if (fileSize <= 0) {
      return res.status(400).json({ error: 'حجم الملف غير صالح' });
    }

    // Check for resumable upload
    const existing = chunkedUpload.findResumableUpload(fileName, fileSize, req.user.userId);
    if (existing) {
      console.log(`📤 Resuming existing upload: ${existing.uploadId}`);
      return res.json({
        ...existing,
        resumed: true,
        message: 'تم العثور على رفع سابق، يمكنك الاستئناف'
      });
    }

    // Initialize new upload
    const session = chunkedUpload.initUpload({
      fileName,
      fileSize,
      fileType: fileType || 'application/octet-stream',
      userId: req.user.userId,
      folderId: folderId || null,
      totalChunks
    });

    res.json({
      ...session,
      resumed: false,
      message: 'تم إنشاء جلسة الرفع بنجاح'
    });
  } catch (error) {
    console.error('Init upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/chunked/:uploadId/chunk
 * Upload a single chunk
 */
router.post('/:uploadId/chunk', chunkUpload.single('chunk'), (req, res) => {
  try {
    const { uploadId } = req.params;
    const chunkIndex = parseInt(req.body.chunkIndex);

    if (isNaN(chunkIndex) || chunkIndex < 0) {
      return res.status(400).json({ error: 'رقم الجزء غير صالح' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'لم يتم إرسال بيانات الجزء' });
    }

    const progress = chunkedUpload.uploadChunk(uploadId, chunkIndex, req.file.buffer);

    res.json({
      ...progress,
      message: `تم رفع الجزء ${chunkIndex + 1} من ${progress.totalChunks}`
    });
  } catch (error) {
    console.error('Chunk upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/chunked/:uploadId/progress
 * Get upload progress
 */
router.get('/:uploadId/progress', (req, res) => {
  try {
    const { uploadId } = req.params;
    const progress = chunkedUpload.getUploadProgress(uploadId);

    if (!progress) {
      return res.status(404).json({ error: 'جلسة الرفع غير موجودة' });
    }

    res.json(progress);
  } catch (error) {
    console.error('Progress error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/chunked/:uploadId/complete
 * Complete the upload - يرفع مباشرة لـ Telegram بدون تخزين محلي!
 */
router.post('/:uploadId/complete', async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    // Complete upload (merge chunks in memory)
    const result = await chunkedUpload.completeUpload(uploadId);

    let telegramFileId = null;
    let telegramMessageId = null;

    // رفع مباشر لـ Telegram من الذاكرة
    const bot = req.app.get('bot');
    const channelId = req.app.get('channelId');

    if (bot && channelId && result.fileBuffer) {
      try {
        const sizeMB = (result.fileSize / 1024 / 1024).toFixed(2);
        console.log(`📤 Chunked: Uploading to Telegram: ${result.fileName} (${sizeMB} MB) - From memory!`);
        
        const telegramResult = await bot.telegram.sendDocument(channelId, {
          source: result.fileBuffer,
          filename: result.fileName
        }, {
          caption: `📁 ${result.fileName}\n👤 User: ${result.userId}\n📅 ${new Date().toLocaleString('ar-SA')}`
        });

        telegramFileId = telegramResult.document.file_id;
        telegramMessageId = telegramResult.message_id;
        
        console.log(`✅ Chunked: Uploaded to Telegram: ${result.fileName} - Zero local storage!`);
      } catch (telegramError) {
        console.error('❌ Telegram upload error:', telegramError.message);
        return res.status(500).json({ error: 'فشل الرفع لـ Telegram: ' + telegramError.message });
      }
    } else {
      return res.status(503).json({ error: 'Telegram bot not configured. Cannot upload without local storage.' });
    }

    // Create file record in database
    const fileId = uuidv4();
    const fileData = {
      id: fileId,
      name: result.fileName,
      size: result.fileSize,
      type: result.fileType,
      telegram_file_id: telegramFileId,
      telegram_message_id: telegramMessageId,
      folder_id: result.folderId,
      user_id: result.userId,
      created_at: new Date().toISOString()
    };

    db.createFile(fileData);

    // تنظيف الذاكرة
    chunkedUpload.cancelUpload(uploadId);

    res.json({
      success: true,
      file: {
        id: fileId,
        name: result.fileName,
        size: result.fileSize,
        type: result.fileType,
        created_at: fileData.created_at
      },
      message: 'تم رفع الملف بنجاح لـ Telegram!'
    });
  } catch (error) {
    console.error('Complete upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/chunked/:uploadId
 * Cancel an upload
 */
router.delete('/:uploadId', (req, res) => {
  try {
    const { uploadId } = req.params;
    chunkedUpload.cancelUpload(uploadId);
    res.json({ success: true, message: 'تم إلغاء الرفع' });
  } catch (error) {
    console.error('Cancel upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/chunked/:uploadId/resume
 * Resume an interrupted upload
 */
router.post('/:uploadId/resume', (req, res) => {
  try {
    const { uploadId } = req.params;
    const progress = chunkedUpload.resumeUpload(uploadId);

    if (!progress) {
      return res.status(404).json({ 
        error: 'جلسة الرفع غير موجودة أو منتهية الصلاحية',
        canResume: false
      });
    }

    res.json({
      ...progress,
      canResume: true,
      message: 'يمكنك استئناف الرفع'
    });
  } catch (error) {
    console.error('Resume error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
