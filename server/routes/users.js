/**
 * User Routes
 * مسارات إدارة المستخدمين
 */

const express = require('express');
const router = express.Router();
const users = require('../users');
const db = require('../database');

// ============ AUTH ROUTES ============

// POST /api/users/register - Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    
    // Check if registration is allowed
    const settings = { allowRegistration: true }; // TODO: Get from settings
    if (!settings.allowRegistration) {
      return res.status(403).json({ error: 'التسجيل مغلق حالياً' });
    }
    
    const user = await users.createUser({
      username,
      email,
      password,
      displayName,
      role: users.ROLES.USER
    });
    
    // Auto login after registration
    const result = await users.login(username, password, {
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
    db.logActivity(user.id, 'register', 'user', user.id, user.username, null, req.ip, req.headers['user-agent']);
    
    res.json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      ...result
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/users/login - Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
    }
    
    const result = await users.login(username, password, {
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
    db.logActivity(result.user.id, 'login', 'user', result.user.id, result.user.username, null, req.ip, req.headers['user-agent']);
    
    res.json({
      success: true,
      ...result
    });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

// POST /api/users/logout - Logout
router.post('/logout', users.authMiddleware, (req, res) => {
  try {
    users.logout(req.sessionId);
    db.logActivity(req.user.userId, 'logout', 'user', req.user.userId, req.user.username, null, req.ip, req.headers['user-agent']);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/users/logout-all - Logout from all devices
router.post('/logout-all', users.authMiddleware, (req, res) => {
  try {
    users.logoutAllDevices(req.user.userId);
    db.logActivity(req.user.userId, 'logout_all', 'user', req.user.userId, req.user.username, null, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'تم تسجيل الخروج من جميع الأجهزة' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/users/refresh - Refresh access token
router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    
    const result = users.refreshAccessToken(refreshToken);
    res.json(result);
  } catch (e) {
    res.status(401).json({ error: e.message, code: 'REFRESH_FAILED' });
  }
});

// GET /api/users/me - Get current user
router.get('/me', users.authMiddleware, (req, res) => {
  try {
    const user = users.getUser(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
    const storage = users.getUserStorageInfo(req.user.userId);
    
    res.json({
      user,
      storage,
      permissions: req.user.permissions
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/me - Update current user
router.patch('/me', users.authMiddleware, async (req, res) => {
  try {
    const { displayName, avatar, settings } = req.body;
    const user = await users.updateUser(req.user.userId, { displayName, avatar, settings });
    
    db.logActivity(req.user.userId, 'update_profile', 'user', req.user.userId, req.user.username, null, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/users/change-password - Change password
router.post('/change-password', users.authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await users.changePassword(req.user.userId, currentPassword, newPassword);
    
    db.logActivity(req.user.userId, 'change_password', 'user', req.user.userId, req.user.username, null, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/users/sessions - Get user sessions
router.get('/sessions', users.authMiddleware, (req, res) => {
  try {
    const sessions = users.getUserSessions(req.user.userId);
    res.json({
      sessions: sessions.map(s => ({
        ...s,
        isCurrent: s.id === req.sessionId
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/users/sessions/:id - Revoke specific session
router.delete('/sessions/:id', users.authMiddleware, (req, res) => {
  try {
    users.logout(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/users/activity - Get user activity log
router.get('/activity', users.authMiddleware, (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = db.getActivityLog({
      userId: req.user.userId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/users/storage - Get storage info
router.get('/storage', users.authMiddleware, (req, res) => {
  try {
    const storage = users.getUserStorageInfo(req.user.userId);
    res.json(storage);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
