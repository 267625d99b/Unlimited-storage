/**
 * Security Routes
 * مسارات الأمان المتقدم
 */

const express = require('express');
const router = express.Router();
const users = require('../users');
const oauth = require('../oauth');
const deviceManager = require('../deviceManager');
const ipSecurity = require('../ipSecurity');
const encryption = require('../encryption');

// ============ OAUTH ROUTES ============

/**
 * GET /api/security/oauth/providers
 * Get available OAuth providers
 */
router.get('/oauth/providers', (req, res) => {
  try {
    const providers = oauth.getAvailableProviders();
    res.json({ providers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/security/oauth/:provider/authorize
 * Get OAuth authorization URL
 */
router.get('/oauth/:provider/authorize', (req, res) => {
  try {
    const { provider } = req.params;
    const { redirect } = req.query;
    
    const { url, state } = oauth.getAuthorizationUrl(provider, redirect);
    
    res.json({ url, state });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/security/oauth/:provider/callback
 * Handle OAuth callback
 */
router.post('/oauth/:provider/callback', async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state } = req.body;
    
    if (!code || !state) {
      return res.status(400).json({ error: 'رمز التفويض مطلوب' });
    }
    
    // Complete OAuth flow
    const result = await oauth.completeOAuth(provider, code, state);
    
    // Check if user exists with this OAuth account
    let user = users.getUserByEmail(result.user.email);
    
    if (user) {
      // Login existing user
      const deviceInfo = deviceManager.getDeviceInfo(req);
      const tokens = users.generateTokens ? 
        users.generateTokens(user, deviceInfo) : 
        { accessToken: null, refreshToken: null };
      
      // Register device
      deviceManager.registerDevice(user.id, deviceInfo, tokens.sessionId);
      
      res.json({
        success: true,
        isNewUser: false,
        user: users.sanitizeUser ? users.sanitizeUser(user) : user,
        ...tokens
      });
    } else {
      // Return OAuth data for registration
      res.json({
        success: true,
        isNewUser: true,
        oauthData: {
          provider,
          providerId: result.user.providerId,
          email: result.user.email,
          name: result.user.name,
          picture: result.user.picture
        }
      });
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/security/oauth/register
 * Register new user from OAuth
 */
router.post('/oauth/register', async (req, res) => {
  try {
    const { provider, providerId, email, name, username, picture } = req.body;
    
    if (!email || !username) {
      return res.status(400).json({ error: 'البريد الإلكتروني واسم المستخدم مطلوبان' });
    }
    
    // Generate random password for OAuth users
    const randomPassword = encryption.generateSecureToken(16);
    
    // Create user
    const user = await users.createUser({
      username,
      email,
      password: randomPassword,
      displayName: name,
      avatar: picture,
      role: users.ROLES.USER
    });
    
    // Mark email as verified (OAuth emails are verified)
    await users.updateUser(user.id, { emailVerified: true });
    
    // Login
    const deviceInfo = deviceManager.getDeviceInfo(req);
    const loginResult = await users.login(email, randomPassword, deviceInfo);
    
    // Register device
    deviceManager.registerDevice(user.id, deviceInfo, loginResult.sessionId);
    
    res.json({
      success: true,
      user: loginResult.user,
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken
    });
  } catch (error) {
    console.error('OAuth register error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ DEVICE MANAGEMENT ROUTES ============

/**
 * GET /api/security/devices
 * Get user's devices
 */
router.get('/devices', users.authMiddleware, (req, res) => {
  try {
    const devices = deviceManager.getUserDevices(req.user.userId);
    
    // Mark current device
    const currentFingerprint = deviceManager.generateDeviceFingerprint(req);
    const devicesWithCurrent = devices.map(d => ({
      ...d,
      isCurrent: d.fingerprint === currentFingerprint
    }));
    
    res.json({ devices: devicesWithCurrent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/security/devices/:deviceId
 * Remove a device
 */
router.delete('/devices/:deviceId', users.authMiddleware, (req, res) => {
  try {
    const { deviceId } = req.params;
    
    deviceManager.removeDevice(deviceId, req.user.userId);
    
    // Also logout the session
    const device = deviceManager.getDevice(deviceId);
    if (device?.sessionId) {
      users.logout(device.sessionId);
    }
    
    res.json({ success: true, message: 'تم إزالة الجهاز' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/security/devices/:deviceId/trust
 * Trust a device (skip 2FA)
 */
router.post('/devices/:deviceId/trust', users.authMiddleware, (req, res) => {
  try {
    const { deviceId } = req.params;
    const { duration } = req.body; // Optional duration in days
    
    const durationMs = duration ? duration * 24 * 60 * 60 * 1000 : undefined;
    const device = deviceManager.trustDevice(deviceId, req.user.userId, durationMs);
    
    res.json({ success: true, device });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/security/devices/:deviceId/untrust
 * Untrust a device
 */
router.post('/devices/:deviceId/untrust', users.authMiddleware, (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = deviceManager.untrustDevice(deviceId, req.user.userId);
    
    res.json({ success: true, device });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/security/devices/:deviceId/block
 * Block a device
 */
router.post('/devices/:deviceId/block', users.authMiddleware, (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = deviceManager.blockDevice(deviceId, req.user.userId);
    
    res.json({ success: true, device, message: 'تم حظر الجهاز' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/security/devices/logout-all
 * Logout from all devices
 */
router.post('/devices/logout-all', users.authMiddleware, (req, res) => {
  try {
    users.logoutAllDevices(req.user.userId);
    deviceManager.removeAllUserDevices(req.user.userId);
    
    res.json({ success: true, message: 'تم تسجيل الخروج من جميع الأجهزة' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ IP SECURITY ROUTES (Admin Only) ============

/**
 * GET /api/security/ip/whitelist
 * Get IP whitelist
 */
router.get('/ip/whitelist', users.authMiddleware, users.requireRole('admin', 'super_admin'), (req, res) => {
  try {
    const whitelist = ipSecurity.getWhitelist();
    res.json({ whitelist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/security/ip/whitelist
 * Add IP to whitelist
 */
router.post('/ip/whitelist', users.authMiddleware, users.requireRole('admin', 'super_admin'), (req, res) => {
  try {
    const { ip, description } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'عنوان IP مطلوب' });
    }
    
    ipSecurity.addToWhitelist(ip, description, req.user.username);
    
    res.json({ success: true, message: 'تمت إضافة عنوان IP للقائمة البيضاء' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/security/ip/whitelist/:ip
 * Remove IP from whitelist
 */
router.delete('/ip/whitelist/:ip', users.authMiddleware, users.requireRole('admin', 'super_admin'), (req, res) => {
  try {
    const { ip } = req.params;
    
    ipSecurity.removeFromWhitelist(decodeURIComponent(ip));
    
    res.json({ success: true, message: 'تمت إزالة عنوان IP من القائمة البيضاء' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/security/ip/blacklist
 * Get IP blacklist
 */
router.get('/ip/blacklist', users.authMiddleware, users.requireRole('admin', 'super_admin'), (req, res) => {
  try {
    const blacklist = ipSecurity.getBlacklist();
    res.json({ blacklist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/security/ip/blacklist
 * Add IP to blacklist
 */
router.post('/ip/blacklist', users.authMiddleware, users.requireRole('admin', 'super_admin'), (req, res) => {
  try {
    const { ip, reason, duration } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'عنوان IP مطلوب' });
    }
    
    const durationMs = duration ? duration * 60 * 60 * 1000 : null; // duration in hours
    ipSecurity.addToBlacklist(ip, reason, req.user.username, durationMs);
    
    res.json({ success: true, message: 'تمت إضافة عنوان IP للقائمة السوداء' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/security/ip/blacklist/:ip
 * Remove IP from blacklist
 */
router.delete('/ip/blacklist/:ip', users.authMiddleware, users.requireRole('admin', 'super_admin'), (req, res) => {
  try {
    const { ip } = req.params;
    
    ipSecurity.removeFromBlacklist(decodeURIComponent(ip));
    
    res.json({ success: true, message: 'تمت إزالة عنوان IP من القائمة السوداء' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/security/ip/suspicious
 * Get suspicious IPs
 */
router.get('/ip/suspicious', users.authMiddleware, users.requireRole('admin', 'super_admin'), (req, res) => {
  try {
    const suspicious = ipSecurity.getSuspiciousIPs();
    res.json({ suspicious });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/security/ip/settings
 * Get IP security settings
 */
router.get('/ip/settings', users.authMiddleware, users.requireRole('admin', 'super_admin'), (req, res) => {
  try {
    const settings = ipSecurity.getSettings();
    res.json({ settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/security/ip/settings
 * Update IP security settings
 */
router.patch('/ip/settings', users.authMiddleware, users.requireRole('admin', 'super_admin'), (req, res) => {
  try {
    const settings = ipSecurity.updateSettings(req.body);
    res.json({ success: true, settings });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============ ENCRYPTION ROUTES ============

/**
 * POST /api/security/encrypt
 * Encrypt data (for testing/demo)
 */
router.post('/encrypt', users.authMiddleware, (req, res) => {
  try {
    const { data, password } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'البيانات مطلوبة' });
    }
    
    let encrypted;
    if (password) {
      encrypted = encryption.encryptWithPassword(data, password);
    } else {
      const result = encryption.encrypt(data);
      encrypted = {
        data: result.encrypted.toString('base64'),
        key: result.key.toString('hex')
      };
    }
    
    res.json({ encrypted });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/security/decrypt
 * Decrypt data (for testing/demo)
 */
router.post('/decrypt', users.authMiddleware, (req, res) => {
  try {
    const { encrypted, key, password } = req.body;
    
    if (!encrypted) {
      return res.status(400).json({ error: 'البيانات المشفرة مطلوبة' });
    }
    
    let decrypted;
    if (password) {
      decrypted = encryption.decryptWithPassword(encrypted, password);
    } else if (key) {
      const keyBuffer = Buffer.from(key, 'hex');
      decrypted = encryption.decrypt(encrypted, keyBuffer);
    } else {
      return res.status(400).json({ error: 'المفتاح أو كلمة المرور مطلوبة' });
    }
    
    res.json({ decrypted: decrypted.toString('utf8') });
  } catch (error) {
    res.status(400).json({ error: 'فشل فك التشفير: ' + error.message });
  }
});

// ============ SECURITY OVERVIEW ============

/**
 * GET /api/security/overview
 * Get security overview for user
 */
router.get('/overview', users.authMiddleware, (req, res) => {
  try {
    const devices = deviceManager.getUserDevices(req.user.userId);
    const sessions = users.getUserSessions(req.user.userId);
    
    // Get user for 2FA status
    const user = users.getUser(req.user.userId);
    
    res.json({
      twoFactorEnabled: user?.twoFactorEnabled || false,
      emailVerified: user?.emailVerified || false,
      activeDevices: devices.length,
      activeSessions: sessions.length,
      trustedDevices: devices.filter(d => d.trusted).length,
      lastPasswordChange: user?.updatedAt,
      securityScore: calculateSecurityScore(user, devices)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Calculate security score
 */
function calculateSecurityScore(user, devices) {
  let score = 0;
  
  // 2FA enabled: +30
  if (user?.twoFactorEnabled) score += 30;
  
  // Email verified: +20
  if (user?.emailVerified) score += 20;
  
  // Strong password (assumed if created recently): +20
  score += 20;
  
  // Not too many devices: +15
  if (devices.length <= 5) score += 15;
  
  // Has trusted devices: +15
  if (devices.some(d => d.trusted)) score += 15;
  
  return Math.min(100, score);
}

// ============ SESSION MANAGEMENT ROUTES ============

const sessionManager = require('../sessionManager');

/**
 * GET /api/security/sessions
 * الحصول على جميع جلسات المستخدم
 */
router.get('/sessions', (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    
    const sessions = sessionManager.getUserSessions(userId);
    const currentSessionId = req.headers['x-session-id'];
    
    // تحديد الجلسة الحالية
    const sessionsWithCurrent = sessions.map(s => ({
      ...s,
      isCurrent: s.id === currentSessionId
    }));
    
    res.json({ 
      sessions: sessionsWithCurrent,
      total: sessions.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/security/sessions/:sessionId
 * إنهاء جلسة معينة
 */
router.delete('/sessions/:sessionId', (req, res) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    
    // التحقق من أن الجلسة تخص المستخدم
    const sessions = sessionManager.getUserSessions(userId);
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'الجلسة غير موجودة' });
    }
    
    sessionManager.destroySession(sessionId);
    
    res.json({ 
      success: true, 
      message: 'تم إنهاء الجلسة بنجاح' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/security/sessions/logout-all
 * تسجيل الخروج من جميع الأجهزة
 */
router.post('/sessions/logout-all', (req, res) => {
  try {
    const userId = req.user?.userId;
    const currentSessionId = req.headers['x-session-id'];
    const { keepCurrent } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    
    const count = sessionManager.logoutAllDevices(
      userId, 
      keepCurrent ? currentSessionId : null
    );
    
    res.json({ 
      success: true, 
      message: `تم تسجيل الخروج من ${count} جهاز`,
      loggedOutCount: count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/security/sessions/stats
 * إحصائيات الجلسات (للمشرفين)
 */
router.get('/sessions/stats', (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    
    // التحقق من صلاحيات المشرف
    const user = users.getUserById(userId);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'غير مصرح لك بهذا الإجراء' });
    }
    
    const stats = sessionManager.getSessionStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
