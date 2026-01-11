/**
 * Comments Routes
 * مسارات التعليقات
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const users = require('../users');
const notifications = require('../notifications');

// All routes require authentication
router.use(users.authMiddleware);

// GET /api/comments/:fileId - Get comments for a file
router.get('/:fileId', (req, res) => {
  try {
    const file = db.getFileById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    
    const comments = db.getFileComments(req.params.fileId);
    const count = db.getCommentCount(req.params.fileId);
    
    res.json({ comments, count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/comments/:fileId - Add a comment
router.post('/:fileId', (req, res) => {
  try {
    const { content, parentId } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'محتوى التعليق مطلوب' });
    }
    
    if (content.length > 2000) {
      return res.status(400).json({ error: 'التعليق طويل جداً (الحد الأقصى 2000 حرف)' });
    }
    
    const file = db.getFileById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    
    const comment = db.addComment(req.params.fileId, req.user.userId, content.trim(), parentId);
    
    // Notify file owner if different from commenter
    if (file.user_id && file.user_id !== req.user.userId) {
      notifications.createNotification({
        userId: file.user_id,
        type: 'comment',
        title: 'تعليق جديد',
        message: `علق ${req.user.username} على ملفك "${file.name}"`,
        data: { fileId: file.id, commentId: comment.id }
      });
    }
    
    // Notify parent comment author if replying
    if (parentId) {
      const parentComment = db.queryOne('SELECT * FROM comments WHERE id = ?', [parentId]);
      if (parentComment && parentComment.user_id !== req.user.userId) {
        notifications.createNotification({
          userId: parentComment.user_id,
          type: 'comment_reply',
          title: 'رد على تعليقك',
          message: `رد ${req.user.username} على تعليقك`,
          data: { fileId: file.id, commentId: comment.id }
        });
      }
    }
    
    db.logActivity(req.user.userId, 'add_comment', 'file', req.params.fileId, file.name, 
      null, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, comment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/comments/:commentId - Update a comment
router.patch('/:commentId', (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'محتوى التعليق مطلوب' });
    }
    
    db.updateComment(req.params.commentId, req.user.userId, content.trim());
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/comments/:commentId - Delete a comment
router.delete('/:commentId', (req, res) => {
  try {
    db.deleteComment(req.params.commentId, req.user.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
