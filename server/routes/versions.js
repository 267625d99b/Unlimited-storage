/**
 * File Versions Routes
 * مسارات سجل الإصدارات
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const users = require('../users');

// All routes require authentication
router.use(users.authMiddleware);

// GET /api/versions/:fileId - Get all versions of a file
router.get('/:fileId', (req, res) => {
  try {
    const file = db.getFileById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    
    // Check ownership
    if (file.user_id && file.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    
    const versions = db.getFileVersions(req.params.fileId);
    res.json({ versions, file });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/versions/:fileId/restore/:versionId - Restore a version
router.post('/:fileId/restore/:versionId', (req, res) => {
  try {
    const file = db.getFileById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    
    if (file.user_id && file.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    
    db.restoreFileVersion(req.params.fileId, req.params.versionId, req.user.userId);
    
    db.logActivity(req.user.userId, 'restore_version', 'file', req.params.fileId, file.name, 
      { versionId: req.params.versionId }, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, message: 'تم استعادة الإصدار بنجاح' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/versions/:versionId - Delete a version
router.delete('/:versionId', (req, res) => {
  try {
    const version = db.getFileVersion(req.params.versionId);
    if (!version) {
      return res.status(404).json({ error: 'الإصدار غير موجود' });
    }
    
    const file = db.getFileById(version.file_id);
    if (file && file.user_id && file.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    
    db.deleteFileVersion(req.params.versionId, req.user.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/versions/download/:versionId - Download a specific version
router.get('/download/:versionId', async (req, res) => {
  try {
    const version = db.getFileVersion(req.params.versionId);
    if (!version) {
      return res.status(404).json({ error: 'الإصدار غير موجود' });
    }
    
    const file = db.getFileById(version.file_id);
    if (file && file.user_id && file.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    
    // Return version info for download
    res.json({
      name: version.name,
      telegram_file_id: version.telegram_file_id,
      type: version.type,
      size: version.size,
      version_number: version.version_number
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
