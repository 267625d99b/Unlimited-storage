/**
 * Collections Routes
 * مسارات المجموعات
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const users = require('../users');

// All routes require authentication
router.use(users.authMiddleware);

// GET /api/collections - Get user's collections
router.get('/', (req, res) => {
  try {
    const collections = db.getCollections(req.user.userId);
    res.json({ collections });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/collections - Create a collection
router.post('/', (req, res) => {
  try {
    const { name, description, color, icon } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'اسم المجموعة مطلوب' });
    }
    
    if (name.length > 100) {
      return res.status(400).json({ error: 'اسم المجموعة طويل جداً' });
    }
    
    const collection = db.createCollection(name.trim(), req.user.userId, {
      description, color, icon
    });
    
    db.logActivity(req.user.userId, 'create_collection', 'collection', collection.id, name, 
      null, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, collection });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/collections/:id - Get collection with files
router.get('/:id', (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = db.getCollectionFiles(req.params.id, req.user.userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PATCH /api/collections/:id - Update collection
router.patch('/:id', (req, res) => {
  try {
    const { name, description, color, icon } = req.body;
    const collection = db.updateCollection(req.params.id, req.user.userId, {
      name, description, color, icon
    });
    res.json({ success: true, collection });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/collections/:id - Delete collection
router.delete('/:id', (req, res) => {
  try {
    db.deleteCollection(req.params.id, req.user.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/collections/:id/files - Add file to collection
router.post('/:id/files', (req, res) => {
  try {
    const { fileId } = req.body;
    
    if (!fileId) {
      return res.status(400).json({ error: 'معرف الملف مطلوب' });
    }
    
    const file = db.getFileById(fileId);
    if (!file) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    
    const added = db.addToCollection(req.params.id, fileId, req.user.userId);
    res.json({ success: true, added });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/collections/:id/files/:fileId - Remove file from collection
router.delete('/:id/files/:fileId', (req, res) => {
  try {
    db.removeFromCollection(req.params.id, req.params.fileId, req.user.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/collections/:id/bulk - Add multiple files to collection
router.post('/:id/bulk', (req, res) => {
  try {
    const { fileIds } = req.body;
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد الملفات' });
    }
    
    let added = 0;
    for (const fileId of fileIds) {
      try {
        if (db.addToCollection(req.params.id, fileId, req.user.userId)) {
          added++;
        }
      } catch (e) {
        // Skip errors
      }
    }
    
    res.json({ success: true, added });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/collections/file/:fileId - Get collections containing a file
router.get('/file/:fileId', (req, res) => {
  try {
    const collections = db.getFileCollections(req.params.fileId, req.user.userId);
    res.json({ collections });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
