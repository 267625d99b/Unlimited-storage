/**
 * Smart AI Routes - مسارات المساعد الذكي
 */

const express = require('express');
const router = express.Router();
const smartAssistant = require('../ai/smartAssistant');
const users = require('../users');
const db = require('../database');

// Authentication middleware
const authenticateToken = users.authMiddleware;

// ==================== Chat with Assistant ====================

/**
 * @route POST /api/smart-ai/chat
 * @desc محادثة مع المساعد الذكي
 */
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'الرسالة مطلوبة' });
    }

    // جلب سياق المستخدم
    const filesResult = db.getFiles(null, { userId: req.user.userId, page: 1, limit: 50 });
    const files = filesResult.files || filesResult || [];
    const folders = db.getFolders(null, req.user.userId) || [];
    const storageInfo = users.getUserStorageInfo(req.user.userId);

    const context = {
      files,
      folders,
      storageInfo
    };

    const result = await smartAssistant.chat(message, context);

    res.json(result);
  } catch (error) {
    console.error('Smart AI Chat Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Organization Suggestions ====================

/**
 * @route GET /api/smart-ai/suggest-organization
 * @desc اقتراح تنظيم الملفات
 */
router.get('/suggest-organization', authenticateToken, async (req, res) => {
  try {
    const { folderId } = req.query;
    const filesResult = db.getFiles(folderId || null, { userId: req.user.userId, page: 1, limit: 100 });
    const files = filesResult.files || filesResult || [];

    const result = await smartAssistant.suggestOrganization(files);
    res.json(result);
  } catch (error) {
    console.error('Organization Suggestion Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Similar Files Detection ====================

/**
 * @route GET /api/smart-ai/similar-files
 * @desc اكتشاف الملفات المتشابهة
 */
router.get('/similar-files', authenticateToken, async (req, res) => {
  try {
    const filesResult = db.getFiles(null, { userId: req.user.userId, page: 1, limit: 500 });
    const files = filesResult.files || filesResult || [];

    const similar = smartAssistant.findSimilarFiles(files);

    res.json({
      success: true,
      totalFiles: files.length,
      similarPairs: similar.length,
      results: similar.slice(0, 20)
    });
  } catch (error) {
    console.error('Similar Files Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== File Analysis ====================

/**
 * @route GET /api/smart-ai/analyze
 * @desc تحليل الملفات
 */
router.get('/analyze', authenticateToken, async (req, res) => {
  try {
    const filesResult = db.getFiles(null, { userId: req.user.userId, page: 1, limit: 500 });
    const files = filesResult.files || filesResult || [];

    const analysis = smartAssistant.analyzeFiles(files);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Analysis Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== AI Status ====================

/**
 * @route GET /api/smart-ai/status
 * @desc حالة المساعد الذكي
 */
router.get('/status', authenticateToken, (req, res) => {
  const providerInfo = smartAssistant.getProviderInfo();
  const providers = smartAssistant.getAvailableProviders();

  res.json({
    available: true,
    aiEnabled: smartAssistant.isAIAvailable(),
    provider: providerInfo,
    availableProviders: providers,
    features: {
      chat: true,
      organization: true,
      imageDescription: providerInfo.features?.vision || false,
      dataExtraction: true,
      similarFiles: true,
      translation: providerInfo.features?.translation || false
    }
  });
});

module.exports = router;
