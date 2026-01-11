/**
 * Authentication Routes (Email Verification, Password Reset, 2FA)
 * مسارات المصادقة المتقدمة
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const users = require('../users');
const email = require('../email');
const twoFactor = require('../twoFactor');
const notifications = require('../notifications');
const db = require('../database');

// ============ RATE LIMITERS ============

// Rate limiter for 2FA verification (prevent brute force)
const twoFAVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'تم تجاوز الحد المسموح من محاولات التحقق، حاول بعد 15 دقيقة' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
  handler: (req, res) => {
    // Log brute force attempt
    db.logActivity(
      req.user?.userId || 'unknown',
      '2fa_brute_force_attempt',
      'security',
      null,
      null,
      { attempts: 'exceeded' },
      req.ip,
      req.headers['user-agent']
    );
    res.status(429).json({ error: 'تم تجاوز الحد المسموح من محاولات التحقق، حاول بعد 15 دقيقة' });
  }
});

// Rate limiter for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: { error: 'تم تجاوز الحد المسموح من طلبات إعادة التعيين، حاول لاحقاً' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for email verification
const emailVerifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: { error: 'تم تجاوز الحد المسموح من طلبات التحقق، حاول لاحقاً' }
});

// Rate limiter for 2FA setup
const twoFASetupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour
  message: { error: 'تم تجاوز الحد المسموح، حاول لاحقاً' }
});

// ============ EMAIL VERIFICATION ============

// POST /api/auth/send-verification - Send verification email
router.post('/send-verification', emailVerifyLimiter, users.authMiddleware, async (req, res) => {
  try {
    const user = users.getUser(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({ error: 'البريد الإلكتروني مؤكد بالفعل' });
    }
    
    const result = await email.createEmailVerification(
      user.id,
      user.email,
      user.displayName
    );
    
    res.json({ 
      success: true, 
      message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
      expiresAt: result.expiresAt
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/verify-email - Verify email with code
router.post('/verify-email', users.authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'رمز التحقق مطلوب' });
    }
    
    const verified = email.verifyEmail(req.user.userId, code);
    
    if (!verified) {
      return res.status(400).json({ error: 'رمز التحقق غير صحيح أو منتهي الصلاحية' });
    }
    
    // Update user
    await users.updateUser(req.user.userId, { emailVerified: true });
    
    db.logActivity(req.user.userId, 'email_verified', 'user', req.user.userId, req.user.username, null, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, message: 'تم تأكيد البريد الإلكتروني بنجاح' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/verify-email/:token - Verify email via link
router.get('/verify-email/:token', async (req, res) => {
  try {
    const result = email.verifyEmailByToken(req.params.token);
    
    if (!result) {
      return res.status(400).json({ error: 'رابط التحقق غير صحيح أو منتهي الصلاحية' });
    }
    
    // Update user
    await users.updateUser(result.userId, { emailVerified: true });
    
    db.logActivity(result.userId, 'email_verified', 'user', result.userId, null, null, req.ip, req.headers['user-agent']);
    
    // Redirect to app or show success
    res.json({ success: true, message: 'تم تأكيد البريد الإلكتروني بنجاح' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ PASSWORD RESET ============

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email: userEmail } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
    }
    
    const user = users.getUserByEmail(userEmail);
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ 
        success: true, 
        message: 'إذا كان البريد الإلكتروني مسجلاً، ستتلقى رسالة لإعادة تعيين كلمة المرور' 
      });
    }
    
    await email.createPasswordReset(user.id, user.email, user.displayName);
    
    db.logActivity(user.id, 'password_reset_requested', 'user', user.id, user.username, null, req.ip, req.headers['user-agent']);
    
    res.json({ 
      success: true, 
      message: 'إذا كان البريد الإلكتروني مسجلاً، ستتلقى رسالة لإعادة تعيين كلمة المرور' 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/verify-reset-code - Verify reset code
router.post('/verify-reset-code', (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'رمز إعادة التعيين مطلوب' });
    }
    
    const result = email.verifyPasswordReset(code);
    
    if (!result) {
      return res.status(400).json({ error: 'رمز إعادة التعيين غير صحيح أو منتهي الصلاحية' });
    }
    
    res.json({ success: true, valid: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/reset-password - Reset password with code
router.post('/reset-password', async (req, res) => {
  try {
    const { code, newPassword } = req.body;
    
    if (!code || !newPassword) {
      return res.status(400).json({ error: 'رمز إعادة التعيين وكلمة المرور الجديدة مطلوبان' });
    }
    
    const result = email.verifyPasswordReset(code);
    
    if (!result) {
      return res.status(400).json({ error: 'رمز إعادة التعيين غير صحيح أو منتهي الصلاحية' });
    }
    
    // Reset password
    await users.resetPassword(result.userId, newPassword);
    
    // Complete reset (remove token)
    email.completePasswordReset(code);
    
    // Send security alert
    const user = users.getUser(result.userId);
    if (user) {
      await email.sendSecurityAlert(user.email, user.displayName, {
        alertType: 'تم تغيير كلمة المرور',
        message: 'تم إعادة تعيين كلمة المرور الخاصة بحسابك'
      });
      
      notifications.notifySecurityAlert(user.id, 'password_reset', 'تم إعادة تعيين كلمة المرور');
    }
    
    db.logActivity(result.userId, 'password_reset_completed', 'user', result.userId, null, null, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ TWO-FACTOR AUTHENTICATION ============

// POST /api/auth/2fa/setup - Initialize 2FA setup
router.post('/2fa/setup', twoFASetupLimiter, users.authMiddleware, (req, res) => {
  try {
    const user = users.getUser(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: 'المصادقة الثنائية مفعلة بالفعل' });
    }
    
    const setup = twoFactor.setup2FA(user.email, 'CloudStorage');
    
    // Store secret temporarily (not enabled yet)
    users.updateUser(req.user.userId, { 
      twoFactorSecret: setup.secret,
      twoFactorBackupCodes: setup.hashedBackupCodes
    });
    
    res.json({
      success: true,
      secret: setup.secret,
      qrCodeUrl: setup.qrCodeUrl,
      backupCodes: setup.backupCodes // Show once!
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/2fa/verify - Verify and enable 2FA
router.post('/2fa/verify', twoFAVerifyLimiter, users.authMiddleware, (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'رمز التحقق مطلوب' });
    }
    
    const user = users.getUser(req.user.userId);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'يرجى بدء إعداد المصادقة الثنائية أولاً' });
    }
    
    const valid = twoFactor.verifyTOTP(user.twoFactorSecret, code);
    
    if (!valid) {
      return res.status(400).json({ error: 'رمز التحقق غير صحيح' });
    }
    
    // Enable 2FA
    users.updateUser(req.user.userId, { twoFactorEnabled: true });
    
    db.logActivity(req.user.userId, '2fa_enabled', 'user', req.user.userId, req.user.username, null, req.ip, req.headers['user-agent']);
    
    notifications.createNotification({
      userId: req.user.userId,
      type: notifications.NOTIFICATION_TYPES.SECURITY_ALERT,
      title: 'تم تفعيل المصادقة الثنائية',
      message: 'تم تفعيل المصادقة الثنائية على حسابك بنجاح',
      priority: 'high'
    });
    
    res.json({ success: true, message: 'تم تفعيل المصادقة الثنائية بنجاح' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/2fa/disable - Disable 2FA
router.post('/2fa/disable', users.authMiddleware, async (req, res) => {
  try {
    const { password, code } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'كلمة المرور مطلوبة' });
    }
    
    const user = users.getUser(req.user.userId);
    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({ error: 'المصادقة الثنائية غير مفعلة' });
    }
    
    // Verify password (need to get full user with password hash)
    const fullUser = users.getUserByUsername(user.username);
    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(password, fullUser.passwordHash);
    
    if (!validPassword) {
      return res.status(400).json({ error: 'كلمة المرور غير صحيحة' });
    }
    
    // Verify 2FA code if provided
    if (code) {
      const valid = twoFactor.verifyTOTP(user.twoFactorSecret, code);
      if (!valid) {
        return res.status(400).json({ error: 'رمز التحقق غير صحيح' });
      }
    }
    
    // Disable 2FA
    users.updateUser(req.user.userId, { 
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null
    });
    
    db.logActivity(req.user.userId, '2fa_disabled', 'user', req.user.userId, req.user.username, null, req.ip, req.headers['user-agent']);
    
    // Send security alert
    await email.sendSecurityAlert(user.email, user.displayName, {
      alertType: 'تم تعطيل المصادقة الثنائية',
      message: 'تم تعطيل المصادقة الثنائية على حسابك'
    });
    
    res.json({ success: true, message: 'تم تعطيل المصادقة الثنائية' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/2fa/regenerate-backup - Regenerate backup codes
router.post('/2fa/regenerate-backup', users.authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'كلمة المرور مطلوبة' });
    }
    
    const user = users.getUser(req.user.userId);
    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({ error: 'المصادقة الثنائية غير مفعلة' });
    }
    
    // Verify password
    const fullUser = users.getUserByUsername(user.username);
    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(password, fullUser.passwordHash);
    
    if (!validPassword) {
      return res.status(400).json({ error: 'كلمة المرور غير صحيحة' });
    }
    
    // Generate new backup codes
    const backupCodes = twoFactor.generateBackupCodes(10);
    const hashedBackupCodes = backupCodes.map(twoFactor.hashBackupCode);
    
    users.updateUser(req.user.userId, { twoFactorBackupCodes: hashedBackupCodes });
    
    db.logActivity(req.user.userId, '2fa_backup_regenerated', 'user', req.user.userId, req.user.username, null, req.ip, req.headers['user-agent']);
    
    res.json({ 
      success: true, 
      backupCodes,
      message: 'تم إنشاء رموز احتياطية جديدة. احفظها في مكان آمن!' 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/2fa/status - Get 2FA status
router.get('/2fa/status', users.authMiddleware, (req, res) => {
  try {
    const user = users.getUser(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
    res.json({
      enabled: user.twoFactorEnabled || false,
      hasBackupCodes: !!(user.twoFactorBackupCodes && user.twoFactorBackupCodes.length > 0)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
