/**
 * AI Routes - مسارات الذكاء الاصطناعي
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ai = require('../ai');
const users = require('../users');

// Authentication middleware
const authenticateToken = users.authMiddleware;

// إعداد multer للملفات المؤقتة
const upload = multer({ 
  dest: 'server/uploads/temp/',
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

// ==================== Analyze Route ====================

/**
 * @route POST /api/ai/analyze
 * @desc تحليل ملف شامل (نوع، وسوم مقترحة، معلومات)
 */
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.body;
    
    if (!fileId) {
      return res.status(400).json({ error: 'معرف الملف مطلوب' });
    }
    
    const db = req.app.locals.db;
    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
      .get(fileId, req.user.id);
    
    if (!file) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    
    // تحليل الملف
    const analysis = {
      fileId: file.id,
      filename: file.original_name,
      type: file.mime_type,
      size: file.size,
      category: getCategoryFromMime(file.mime_type),
      suggestedTags: ai.classifyFileLocal(file.original_name, file.mime_type),
      canOCR: file.mime_type?.startsWith('image/'),
      canSummarize: isTextFile(file.mime_type, file.original_name),
      aiAvailable: ai.isAIAvailable()
    };
    
    // إضافة تحليل AI إذا متاح
    if (ai.isAIAvailable()) {
      try {
        const aiTags = await ai.classifyFileAI(file.original_name);
        analysis.aiSuggestedTags = aiTags;
      } catch (e) {
        // تجاهل أخطاء AI
      }
    }
    
    res.json(analysis);
  } catch (error) {
    console.error('Analyze Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function getCategoryFromMime(mimeType) {
  if (!mimeType) return 'أخرى';
  if (mimeType.startsWith('image/')) return 'صور';
  if (mimeType.startsWith('video/')) return 'فيديو';
  if (mimeType.startsWith('audio/')) return 'صوت';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'مستندات';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'جداول';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'عروض';
  if (mimeType.startsWith('text/')) return 'نصوص';
  return 'أخرى';
}

function isTextFile(mimeType, filename) {
  const textTypes = ['text/plain', 'text/markdown', 'application/json'];
  const textExts = ['.txt', '.md', '.json', '.csv', '.xml', '.html', '.css', '.js'];
  return textTypes.includes(mimeType) || textExts.some(ext => filename?.toLowerCase().endsWith(ext));
}

// ==================== OCR Routes ====================

/**
 * @route POST /api/ai/ocr
 * @desc استخراج النص من صورة
 */
router.post('/ocr', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم رفع صورة' });
    }
    
    const language = req.body.language || 'ara+eng';
    const result = await ai.extractTextFromImage(req.file.path, language);
    
    // حذف الملف المؤقت
    fs.unlinkSync(req.file.path);
    
    if (result.success) {
      res.json({
        success: true,
        text: result.text,
        confidence: result.confidence,
        words: result.words
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/ai/ocr/file/:fileId
 * @desc استخراج النص من ملف موجود
 */
router.post('/ocr/file/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const db = req.app.locals.db;
    
    // جلب معلومات الملف
    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
      .get(fileId, req.user.id);
    
    if (!file) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    
    // التحقق من نوع الملف
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!imageTypes.includes(file.mime_type)) {
      return res.status(400).json({ error: 'نوع الملف غير مدعوم للـ OCR' });
    }
    
    // تحميل الملف من Telegram
    const bot = req.app.locals.bot;
    const fileLink = await bot.telegram.getFileLink(file.telegram_file_id);
    
    // تحميل مؤقت
    const axios = require('axios');
    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    const tempPath = `server/uploads/temp/ocr_${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, response.data);
    
    // OCR
    const language = req.body.language || 'ara+eng';
    const result = await ai.extractTextFromImage(tempPath, language);
    
    // حذف الملف المؤقت
    fs.unlinkSync(tempPath);
    
    if (result.success) {
      // حفظ النص المستخرج في قاعدة البيانات
      db.prepare(`
        INSERT OR REPLACE INTO file_extracted_text (file_id, text, confidence, extracted_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(fileId, result.text, result.confidence);
      
      res.json({
        success: true,
        fileId,
        filename: file.original_name,
        text: result.text,
        confidence: result.confidence,
        words: result.words
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('OCR File Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Classification Routes ====================

/**
 * @route POST /api/ai/classify
 * @desc تصنيف ملف تلقائياً
 */
router.post('/classify', authenticateToken, async (req, res) => {
  try {
    const { filename, content, useAI } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'اسم الملف مطلوب' });
    }
    
    let tags;
    if (useAI && ai.isAIAvailable()) {
      tags = await ai.classifyFileAI(filename, content);
    } else {
      tags = ai.classifyFileLocal(filename);
    }
    
    res.json({
      success: true,
      filename,
      tags,
      method: useAI && ai.isAIAvailable() ? 'ai' : 'local'
    });
  } catch (error) {
    console.error('Classification Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/ai/classify/file/:fileId
 * @desc تصنيف ملف موجود وإضافة الوسوم
 */
router.post('/classify/file/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { autoApply } = req.body;
    const db = req.app.locals.db;
    
    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
      .get(fileId, req.user.id);
    
    if (!file) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    
    // تصنيف الملف
    const tags = ai.classifyFileLocal(file.original_name, file.mime_type);
    
    // تطبيق الوسوم تلقائياً إذا طُلب
    if (autoApply && tags.length > 0) {
      for (const tagName of tags) {
        // إنشاء الوسم إذا لم يكن موجوداً
        let tag = db.prepare('SELECT id FROM tags WHERE name = ? AND user_id = ?')
          .get(tagName, req.user.id);
        
        if (!tag) {
          const result = db.prepare('INSERT INTO tags (name, user_id, color) VALUES (?, ?, ?)')
            .run(tagName, req.user.id, getRandomColor());
          tag = { id: result.lastInsertRowid };
        }
        
        // ربط الوسم بالملف
        db.prepare('INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)')
          .run(fileId, tag.id);
      }
    }
    
    res.json({
      success: true,
      fileId,
      filename: file.original_name,
      suggestedTags: tags,
      applied: autoApply
    });
  } catch (error) {
    console.error('Classify File Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/ai/classify/bulk
 * @desc تصنيف عدة ملفات دفعة واحدة
 */
router.post('/classify/bulk', authenticateToken, async (req, res) => {
  try {
    const { autoApply } = req.body;
    const db = req.app.locals.db;
    
    // جلب الملفات بدون وسوم
    const files = db.prepare(`
      SELECT f.* FROM files f
      LEFT JOIN file_tags ft ON f.id = ft.file_id
      WHERE f.user_id = ? AND ft.file_id IS NULL
      LIMIT 100
    `).all(req.user.id);
    
    const results = [];
    
    for (const file of files) {
      const tags = ai.classifyFileLocal(file.original_name, file.mime_type);
      
      if (autoApply && tags.length > 0) {
        for (const tagName of tags) {
          let tag = db.prepare('SELECT id FROM tags WHERE name = ? AND user_id = ?')
            .get(tagName, req.user.id);
          
          if (!tag) {
            const result = db.prepare('INSERT INTO tags (name, user_id, color) VALUES (?, ?, ?)')
              .run(tagName, req.user.id, getRandomColor());
            tag = { id: result.lastInsertRowid };
          }
          
          db.prepare('INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)')
            .run(file.id, tag.id);
        }
      }
      
      results.push({
        fileId: file.id,
        filename: file.original_name,
        tags
      });
    }
    
    res.json({
      success: true,
      processed: results.length,
      results,
      applied: autoApply
    });
  } catch (error) {
    console.error('Bulk Classify Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Summary Routes ====================

/**
 * @route POST /api/ai/summarize
 * @desc تلخيص نص
 */
router.post('/summarize', authenticateToken, async (req, res) => {
  try {
    const { text, language } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'النص مطلوب' });
    }
    
    const result = await ai.summarizeTextAI(text, language || 'ar');
    res.json(result);
  } catch (error) {
    console.error('Summarize Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/ai/summarize/file/:fileId
 * @desc تلخيص محتوى ملف
 */
router.post('/summarize/file/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const db = req.app.locals.db;
    
    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
      .get(fileId, req.user.id);
    
    if (!file) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    
    // التحقق من نوع الملف
    const textTypes = ['text/plain', 'text/markdown', 'application/json'];
    const isTextFile = textTypes.includes(file.mime_type) || 
                       file.original_name.match(/\.(txt|md|json|csv)$/i);
    
    if (!isTextFile) {
      // محاولة استخدام النص المستخرج سابقاً
      const extracted = db.prepare('SELECT text FROM file_extracted_text WHERE file_id = ?')
        .get(fileId);
      
      if (extracted) {
        const result = await ai.summarizeTextAI(extracted.text);
        return res.json({ ...result, fileId, filename: file.original_name });
      }
      
      return res.status(400).json({ 
        error: 'نوع الملف غير مدعوم للتلخيص',
        suggestion: 'جرب استخراج النص أولاً باستخدام OCR'
      });
    }
    
    // تحميل محتوى الملف
    const bot = req.app.locals.bot;
    const fileLink = await bot.telegram.getFileLink(file.telegram_file_id);
    const axios = require('axios');
    const response = await axios.get(fileLink.href, { responseType: 'text' });
    
    const result = await ai.summarizeTextAI(response.data);
    res.json({ ...result, fileId, filename: file.original_name });
  } catch (error) {
    console.error('Summarize File Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Translation Routes ====================

/**
 * @route POST /api/ai/translate
 * @desc ترجمة نص
 */
router.post('/translate', authenticateToken, async (req, res) => {
  try {
    const { text, fromLang, toLang } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'النص مطلوب' });
    }
    
    const result = await ai.translateText(text, fromLang || 'auto', toLang || 'ar');
    res.json(result);
  } catch (error) {
    console.error('Translate Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Smart Search Routes ====================

/**
 * @route GET /api/ai/search
 * @desc البحث الذكي في محتوى الملفات
 */
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, includeContent } = req.query;
    const db = req.app.locals.db;
    
    if (!q) {
      return res.status(400).json({ error: 'كلمة البحث مطلوبة' });
    }
    
    // البحث في أسماء الملفات
    const fileResults = db.prepare(`
      SELECT id, original_name, mime_type, size, created_at
      FROM files 
      WHERE user_id = ? AND (
        original_name LIKE ? OR
        original_name LIKE ?
      )
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id, `%${q}%`, `%${q.toLowerCase()}%`);
    
    let contentResults = [];
    
    // البحث في المحتوى المستخرج
    if (includeContent === 'true') {
      const extractedTexts = db.prepare(`
        SELECT et.file_id, et.text, et.confidence, f.original_name as filename
        FROM file_extracted_text et
        JOIN files f ON et.file_id = f.id
        WHERE f.user_id = ?
      `).all(req.user.id);
      
      contentResults = ai.searchInExtractedText(q, extractedTexts);
    }
    
    res.json({
      success: true,
      query: q,
      fileResults: fileResults.map(f => ({
        ...f,
        matchType: 'filename'
      })),
      contentResults: contentResults.map(r => ({
        ...r,
        matchType: 'content'
      })),
      total: fileResults.length + contentResults.length
    });
  } catch (error) {
    console.error('Smart Search Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== AI Status ====================

/**
 * @route GET /api/ai/status
 * @desc حالة خدمات AI
 */
router.get('/status', authenticateToken, (req, res) => {
  res.json({
    ocr: {
      available: true,
      engine: 'Tesseract.js',
      languages: ['ara', 'eng', 'fra', 'deu', 'spa']
    },
    classification: {
      available: true,
      aiEnabled: ai.isAIAvailable(),
      method: ai.isAIAvailable() ? 'OpenAI + Local' : 'Local Rules'
    },
    summarization: {
      available: true,
      aiEnabled: ai.isAIAvailable(),
      method: ai.isAIAvailable() ? 'OpenAI GPT' : 'Local Algorithm'
    },
    translation: {
      available: ai.isAIAvailable(),
      engine: ai.isAIAvailable() ? 'OpenAI GPT' : 'Not Available',
      note: ai.isAIAvailable() ? null : 'يحتاج OPENAI_API_KEY'
    }
  });
});

// ==================== Helper Functions ====================

function getRandomColor() {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

module.exports = router;
