/**
 * Collaboration Routes
 * مسارات التعاون الفوري
 */

const express = require('express');
const router = express.Router();
const collaboration = require('../collaboration');

// ============ PRESENCE ============

/**
 * Get file viewers
 * GET /api/collaboration/presence/:fileId
 */
router.get('/presence/:fileId', (req, res) => {
  const viewers = collaboration.getFileViewers(req.params.fileId);
  const cursors = collaboration.getFileCursors(req.params.fileId);
  res.json({ viewers, cursors });
});

/**
 * Update activity (heartbeat)
 * POST /api/collaboration/presence/:fileId/heartbeat
 */
router.post('/presence/:fileId/heartbeat', (req, res) => {
  collaboration.updateActivity(req.params.fileId, req.user.id);
  res.json({ success: true });
});

// ============ SESSIONS ============

/**
 * Create collaboration session
 * POST /api/collaboration/sessions
 */
router.post('/sessions', (req, res) => {
  try {
    const { fileId, fileName } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'معرف الملف مطلوب' });
    }

    const session = collaboration.createSession(
      fileId,
      fileName || 'ملف',
      req.user.id,
      req.user.username
    );

    res.json({ success: true, session });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Join collaboration session
 * POST /api/collaboration/sessions/:sessionId/join
 */
router.post('/sessions/:sessionId/join', (req, res) => {
  try {
    const session = collaboration.joinSession(
      req.params.sessionId,
      req.user.id,
      req.user.username
    );

    res.json({ success: true, session });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Apply operation
 * POST /api/collaboration/sessions/:sessionId/operation
 */
router.post('/sessions/:sessionId/operation', (req, res) => {
  try {
    const { operation } = req.body;

    if (!operation) {
      return res.status(400).json({ error: 'العملية مطلوبة' });
    }

    const op = collaboration.applyOperation(
      req.params.sessionId,
      req.user.id,
      operation
    );

    res.json({ success: true, operation: op });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Get operations since version
 * GET /api/collaboration/sessions/:sessionId/operations
 */
router.get('/sessions/:sessionId/operations', (req, res) => {
  const sinceVersion = parseInt(req.query.since) || 0;
  const operations = collaboration.getOperationsSince(req.params.sessionId, sinceVersion);
  res.json({ operations });
});

/**
 * End collaboration session
 * POST /api/collaboration/sessions/:sessionId/end
 */
router.post('/sessions/:sessionId/end', (req, res) => {
  try {
    collaboration.endSession(req.params.sessionId, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============ MENTIONS ============

/**
 * Create mention
 * POST /api/collaboration/mentions
 */
router.post('/mentions', (req, res) => {
  try {
    const { fileId, fileName, mentionedUserId, mentionedUsername, context, position } = req.body;

    if (!fileId || !mentionedUserId) {
      return res.status(400).json({ error: 'معرف الملف والمستخدم المذكور مطلوبان' });
    }

    const mention = collaboration.createMention({
      fileId,
      fileName,
      mentionedUserId,
      mentionedUsername,
      mentionedBy: req.user.id,
      mentionedByName: req.user.username,
      context,
      position
    });

    res.json({ success: true, mention });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Get my mentions
 * GET /api/collaboration/mentions
 */
router.get('/mentions', (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const mentions = collaboration.getUserMentions(req.user.id, unreadOnly);
  res.json({ mentions });
});

/**
 * Mark mention as read
 * POST /api/collaboration/mentions/:mentionId/read
 */
router.post('/mentions/:mentionId/read', (req, res) => {
  const success = collaboration.markMentionRead(req.params.mentionId, req.user.id);
  res.json({ success });
});

/**
 * Mark all mentions as read
 * POST /api/collaboration/mentions/read-all
 */
router.post('/mentions/read-all', (req, res) => {
  const count = collaboration.markAllMentionsRead(req.user.id);
  res.json({ success: true, count });
});

// ============ LIVE COMMENTS ============

/**
 * Add live comment
 * POST /api/collaboration/comments
 */
router.post('/comments', (req, res) => {
  try {
    const { fileId, content, position, parentId } = req.body;

    if (!fileId || !content) {
      return res.status(400).json({ error: 'معرف الملف والمحتوى مطلوبان' });
    }

    const comment = collaboration.addLiveComment({
      fileId,
      userId: req.user.id,
      username: req.user.username,
      content,
      position,
      parentId
    });

    res.json({ success: true, comment });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Get file comments
 * GET /api/collaboration/comments/:fileId
 */
router.get('/comments/:fileId', (req, res) => {
  const comments = collaboration.getFileComments(req.params.fileId);
  res.json({ comments });
});

/**
 * Resolve comment
 * POST /api/collaboration/comments/:commentId/resolve
 */
router.post('/comments/:commentId/resolve', (req, res) => {
  const success = collaboration.resolveComment(req.params.commentId, req.user.id);
  res.json({ success });
});

/**
 * Delete comment
 * DELETE /api/collaboration/comments/:commentId
 */
router.delete('/comments/:commentId', (req, res) => {
  const success = collaboration.deleteLiveComment(req.params.commentId, req.user.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'التعليق غير موجود أو ليس لديك صلاحية حذفه' });
  }
});

module.exports = router;
