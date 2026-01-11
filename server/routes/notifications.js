/**
 * Notifications Routes
 * مسارات الإشعارات
 */

const express = require('express');
const router = express.Router();
const notifications = require('../notifications');
const users = require('../users');

// All routes require authentication
router.use(users.authMiddleware);

// GET /api/notifications - Get user notifications
router.get('/', (req, res) => {
  try {
    const { page, limit, unreadOnly, type } = req.query;
    
    const result = notifications.getNotifications(req.user.userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      unreadOnly: unreadOnly === 'true',
      type
    });
    
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', (req, res) => {
  try {
    const result = notifications.getNotifications(req.user.userId, { limit: 1 });
    res.json({ count: result.unreadCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/notifications/:id/read - Mark as read
router.patch('/:id/read', (req, res) => {
  try {
    const success = notifications.markAsRead(req.params.id, req.user.userId);
    if (!success) {
      return res.status(404).json({ error: 'الإشعار غير موجود' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', (req, res) => {
  try {
    const count = notifications.markAllAsRead(req.user.userId);
    res.json({ success: true, count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', (req, res) => {
  try {
    const success = notifications.deleteNotification(req.params.id, req.user.userId);
    if (!success) {
      return res.status(404).json({ error: 'الإشعار غير موجود' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/notifications - Clear all notifications
router.delete('/', (req, res) => {
  try {
    notifications.clearNotifications(req.user.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/notifications/settings - Get notification settings
router.get('/settings', (req, res) => {
  try {
    const settings = notifications.getNotificationSettings(req.user.userId);
    res.json({ settings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/notifications/settings - Update notification settings
router.patch('/settings', (req, res) => {
  try {
    notifications.updateNotificationSettings(req.user.userId, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ PUSH NOTIFICATIONS ============
const pushNotifications = require('../pushNotifications');

// GET /api/notifications/push/vapid-key - Get VAPID public key
router.get('/push/vapid-key', (req, res) => {
  res.json({ publicKey: pushNotifications.getVapidPublicKey() });
});

// POST /api/notifications/push/subscribe - Subscribe to push notifications
router.post('/push/subscribe', (req, res) => {
  try {
    const { subscription, deviceInfo } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'بيانات الاشتراك غير صالحة' });
    }
    
    pushNotifications.saveSubscription(req.user.userId, subscription, deviceInfo);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notifications/push/unsubscribe - Unsubscribe from push notifications
router.post('/push/unsubscribe', (req, res) => {
  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint مطلوب' });
    }
    
    pushNotifications.removeSubscription(endpoint);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notifications/push/test - Send test push notification
router.post('/push/test', async (req, res) => {
  try {
    const result = await pushNotifications.sendPushNotification(req.user.userId, {
      title: 'اختبار الإشعارات',
      message: 'هذا إشعار تجريبي من التخزين السحابي',
      type: 'test'
    });
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
