/**
 * Advanced Sharing Routes
 * مسارات المشاركة المتقدمة
 */

const express = require('express');
const router = express.Router();
const advancedSharing = require('../advancedSharing');
const notifications = require('../notifications');

// ============ SHARE WITH USERS ============

/**
 * Share item with user
 * POST /api/sharing/share
 */
router.post('/share', (req, res) => {
  try {
    const {
      itemId,
      itemType,
      itemName,
      targetUserId,
      targetUserName,
      targetEmail,
      permission,
      message
    } = req.body;

    if (!itemId || !targetUserId) {
      return res.status(400).json({ error: 'معرف العنصر والمستخدم المستهدف مطلوبان' });
    }

    const share = advancedSharing.shareWithUser({
      itemId,
      itemType: itemType || 'file',
      itemName: itemName || 'ملف',
      ownerId: req.user.id,
      ownerName: req.user.username,
      targetUserId,
      targetUserName,
      targetEmail,
      permission: permission || 'view',
      message
    });

    // Send notification
    notifications.notifyFileShared(targetUserId, itemName, req.user.username);

    res.json({ success: true, share });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Update share permission
 * PUT /api/sharing/share/:shareId
 */
router.put('/share/:shareId', (req, res) => {
  try {
    const { permission } = req.body;
    const share = advancedSharing.updateSharePermission(
      req.params.shareId,
      permission,
      req.user.id
    );
    res.json({ success: true, share });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Revoke share
 * DELETE /api/sharing/share/:shareId
 */
router.delete('/share/:shareId', (req, res) => {
  try {
    advancedSharing.revokeShare(req.params.shareId, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Get shares for item
 * GET /api/sharing/item/:itemId
 */
router.get('/item/:itemId', (req, res) => {
  const shares = advancedSharing.getItemShares(req.params.itemId, req.user.id);
  const publicLinks = advancedSharing.getItemPublicLinks(req.params.itemId, req.user.id);
  res.json({ shares, publicLinks });
});

/**
 * Get items shared with me
 * GET /api/sharing/shared-with-me
 */
router.get('/shared-with-me', (req, res) => {
  const shares = advancedSharing.getSharedWithMe(req.user.id);
  res.json({ shares });
});

/**
 * Get items I shared
 * GET /api/sharing/shared-by-me
 */
router.get('/shared-by-me', (req, res) => {
  const shares = advancedSharing.getSharedByMe(req.user.id);
  res.json({ shares });
});

// ============ PUBLIC LINKS ============

/**
 * Create public link
 * POST /api/sharing/public-link
 */
router.post('/public-link', (req, res) => {
  try {
    const {
      itemId,
      itemType,
      itemName,
      permission,
      password,
      expiresAt,
      maxDownloads,
      allowedEmails,
      requireLogin
    } = req.body;

    if (!itemId) {
      return res.status(400).json({ error: 'معرف العنصر مطلوب' });
    }

    const link = advancedSharing.createPublicLink({
      itemId,
      itemType: itemType || 'file',
      itemName: itemName || 'ملف',
      ownerId: req.user.id,
      ownerName: req.user.username,
      permission: permission || 'view',
      password,
      expiresAt,
      maxDownloads,
      allowedEmails,
      requireLogin
    });

    // Generate full URL
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    link.url = `${baseUrl}/s/${link.shortCode}`;
    link.fullUrl = `${baseUrl}/share/${link.token}`;

    res.json({ success: true, link });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Access public link (no auth required)
 * POST /api/sharing/access/:tokenOrCode
 */
router.post('/access/:tokenOrCode', (req, res) => {
  const { password, email } = req.body;
  const userId = req.user?.id || null;
  const ip = req.ip;
  const userAgent = req.get('User-Agent');

  const result = advancedSharing.accessPublicLink(req.params.tokenOrCode, {
    password,
    email,
    userId,
    ip,
    userAgent
  });

  if (result.success) {
    res.json(result);
  } else {
    res.status(result.requirePassword || result.requireEmail || result.requireLogin ? 401 : 404)
       .json(result);
  }
});

/**
 * Record download from public link
 * POST /api/sharing/download/:linkId
 */
router.post('/download/:linkId', (req, res) => {
  advancedSharing.recordLinkDownload(req.params.linkId);
  res.json({ success: true });
});

/**
 * Update public link
 * PUT /api/sharing/public-link/:linkId
 */
router.put('/public-link/:linkId', (req, res) => {
  try {
    const link = advancedSharing.updatePublicLink(
      req.params.linkId,
      req.body,
      req.user.id
    );
    res.json({ success: true, link });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Disable public link
 * DELETE /api/sharing/public-link/:linkId
 */
router.delete('/public-link/:linkId', (req, res) => {
  try {
    advancedSharing.disablePublicLink(req.params.linkId, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Get my public links
 * GET /api/sharing/public-links
 */
router.get('/public-links', (req, res) => {
  const links = advancedSharing.getUserPublicLinks(req.user.id);
  res.json({ links });
});

/**
 * Get link statistics
 * GET /api/sharing/public-link/:linkId/stats
 */
router.get('/public-link/:linkId/stats', (req, res) => {
  const stats = advancedSharing.getLinkStats(req.params.linkId, req.user.id);
  if (stats) {
    res.json({ stats });
  } else {
    res.status(404).json({ error: 'الرابط غير موجود' });
  }
});


// ============ FOLDER SHARING ============

/**
 * Share folder
 * POST /api/sharing/folder
 */
router.post('/folder', (req, res) => {
  try {
    const {
      folderId,
      folderName,
      folderPath,
      targetUserId,
      targetUserName,
      targetEmail,
      permission,
      includeSubfolders,
      message
    } = req.body;

    const share = advancedSharing.shareFolder({
      folderId,
      folderName,
      folderPath,
      ownerId: req.user.id,
      ownerName: req.user.username,
      targetUserId,
      targetUserName,
      targetEmail,
      permission: permission || 'view',
      includeSubfolders: includeSubfolders !== false,
      message
    });

    // Send notification
    notifications.notifyFolderShared(targetUserId, folderName, req.user.username);

    res.json({ success: true, share });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============ BATCH OPERATIONS ============

/**
 * Batch share items
 * POST /api/sharing/batch
 */
router.post('/batch', (req, res) => {
  try {
    const { items, targetUserId, targetUserName, targetEmail, permission } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'قائمة العناصر مطلوبة' });
    }

    const results = advancedSharing.batchShare(
      items,
      targetUserId,
      targetUserName,
      targetEmail,
      permission || 'view',
      req.user.id,
      req.user.username
    );

    res.json({ success: true, results });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Revoke all shares for item
 * DELETE /api/sharing/item/:itemId/all
 */
router.delete('/item/:itemId/all', (req, res) => {
  try {
    const result = advancedSharing.revokeAllShares(req.params.itemId, req.user.id);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============ ACCESS REQUESTS ============

/**
 * Request access to item
 * POST /api/sharing/request-access
 */
router.post('/request-access', (req, res) => {
  try {
    const { itemId, itemType, itemName, ownerId, message } = req.body;

    const request = advancedSharing.requestAccess({
      itemId,
      itemType,
      itemName,
      requesterId: req.user.id,
      requesterName: req.user.username,
      requesterEmail: req.user.email,
      ownerId,
      message
    });

    // Notify owner
    notifications.createNotification({
      userId: ownerId,
      type: 'access_request',
      title: 'طلب وصول جديد',
      message: `${req.user.username} يطلب الوصول إلى "${itemName}"`,
      data: { requestId: request.id, itemId, requesterName: req.user.username }
    });

    res.json({ success: true, request });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Respond to access request
 * POST /api/sharing/request/:requestId/respond
 */
router.post('/request/:requestId/respond', (req, res) => {
  try {
    const { approved, permission } = req.body;

    const request = advancedSharing.respondToAccessRequest(
      req.params.requestId,
      approved,
      permission || 'view',
      req.user.id
    );

    // Notify requester
    notifications.createNotification({
      userId: request.data.requesterId,
      type: 'access_response',
      title: approved ? 'تم قبول طلبك' : 'تم رفض طلبك',
      message: approved 
        ? `تم منحك صلاحية الوصول إلى "${request.data.itemName}"`
        : `تم رفض طلب الوصول إلى "${request.data.itemName}"`,
      data: { itemId: request.data.itemId, approved }
    });

    res.json({ success: true, request });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Get pending access requests
 * GET /api/sharing/requests
 */
router.get('/requests', (req, res) => {
  const requests = advancedSharing.getPendingAccessRequests(req.user.id);
  res.json({ requests });
});

// ============ ACTIVITY ============

/**
 * Get share activity
 * GET /api/sharing/activity
 */
router.get('/activity', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const activity = advancedSharing.getUserShareActivity(req.user.id, limit);
  res.json({ activity });
});

/**
 * Get item share activity
 * GET /api/sharing/item/:itemId/activity
 */
router.get('/item/:itemId/activity', (req, res) => {
  const shares = advancedSharing.getItemShares(req.params.itemId, req.user.id);
  const activities = [];
  
  shares.forEach(share => {
    const shareActivity = advancedSharing.getShareActivity(share.id, 20);
    activities.push(...shareActivity);
  });

  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json({ activity: activities.slice(0, 50) });
});

module.exports = router;
