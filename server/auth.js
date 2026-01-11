/**
 * Authentication Module
 * نظام المصادقة والتحقق من الهوية
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_in_production';
const SESSION_EXPIRY = parseInt(process.env.SESSION_EXPIRY_HOURS || '24') + 'h';
const AUTH_ENABLED = process.env.AUTH_ENABLED !== 'false';
const AUTH_FILE = path.join(__dirname, '.auth.json');

// In-memory store for revoked tokens
const revokedTokens = new Set();

/**
 * Initialize authentication system
 * Creates hashed password on first run
 */
async function initAuth() {
  if (!AUTH_ENABLED) {
    console.log('⚠️  Authentication is DISABLED');
    return;
  }

  try {
    // Check if auth file exists
    if (fs.existsSync(AUTH_FILE)) {
      console.log('✅ Authentication system loaded');
      return;
    }

    // First run - create auth file with hashed password
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    
    const authData = {
      passwordHash: hashedPassword,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      loginAttempts: 0,
      lockedUntil: null
    };

    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));
    console.log('✅ Authentication system initialized');
    console.log('🔐 Default password set (change it in .env)');
  } catch (error) {
    console.error('❌ Failed to initialize auth:', error.message);
  }
}

/**
 * Get auth data from file
 */
function getAuthData() {
  try {
    if (!fs.existsSync(AUTH_FILE)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  } catch (error) {
    console.error('Error reading auth file:', error);
    return null;
  }
}

/**
 * Save auth data to file
 */
function saveAuthData(data) {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving auth file:', error);
  }
}

/**
 * Verify password and generate JWT token
 */
async function login(password) {
  const authData = getAuthData();
  
  if (!authData) {
    throw new Error('نظام المصادقة غير مهيأ');
  }

  // Check if account is locked
  if (authData.lockedUntil && new Date(authData.lockedUntil) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(authData.lockedUntil) - new Date()) / 60000);
    throw new Error(`الحساب مقفل. حاول بعد ${remainingMinutes} دقيقة`);
  }

  // Verify password
  const isValid = await bcrypt.compare(password, authData.passwordHash);
  
  if (!isValid) {
    // Increment failed attempts
    authData.loginAttempts = (authData.loginAttempts || 0) + 1;
    
    // Lock account after 5 failed attempts
    if (authData.loginAttempts >= 5) {
      authData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes
      authData.loginAttempts = 0;
      saveAuthData(authData);
      throw new Error('تم قفل الحساب لمدة 15 دقيقة بسبب محاولات فاشلة متعددة');
    }
    
    saveAuthData(authData);
    throw new Error('كلمة المرور غير صحيحة');
  }

  // Reset failed attempts on successful login
  authData.loginAttempts = 0;
  authData.lockedUntil = null;
  authData.lastLogin = new Date().toISOString();
  saveAuthData(authData);

  // Generate JWT token
  const token = jwt.sign(
    { 
      type: 'admin',
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: SESSION_EXPIRY }
  );

  return {
    token,
    expiresIn: SESSION_EXPIRY
  };
}

/**
 * Change password
 */
async function changePassword(currentPassword, newPassword) {
  const authData = getAuthData();
  
  if (!authData) {
    throw new Error('نظام المصادقة غير مهيأ');
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, authData.passwordHash);
  if (!isValid) {
    throw new Error('كلمة المرور الحالية غير صحيحة');
  }

  // Validate new password
  if (!newPassword || newPassword.length < 6) {
    throw new Error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
  }

  // Hash and save new password
  authData.passwordHash = await bcrypt.hash(newPassword, 12);
  authData.passwordChangedAt = new Date().toISOString();
  saveAuthData(authData);

  return true;
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    // Check if token is revoked
    if (revokedTokens.has(token)) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Logout - revoke token
 */
function logout(token) {
  if (token) {
    revokedTokens.add(token);
    
    // Clean up old revoked tokens periodically
    if (revokedTokens.size > 1000) {
      revokedTokens.clear();
    }
  }
}

/**
 * Express middleware for authentication
 */
function authMiddleware(req, res, next) {
  // Skip if auth is disabled
  if (!AUTH_ENABLED) {
    return next();
  }

  // Get token from header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : null;

  if (!token) {
    return res.status(401).json({ error: 'يرجى تسجيل الدخول', code: 'NO_TOKEN' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'جلسة منتهية، يرجى تسجيل الدخول مجدداً', code: 'INVALID_TOKEN' });
  }

  req.user = decoded;
  next();
}

/**
 * Check if authentication is enabled
 */
function isAuthEnabled() {
  return AUTH_ENABLED;
}

module.exports = {
  initAuth,
  login,
  logout,
  changePassword,
  verifyToken,
  authMiddleware,
  isAuthEnabled
};
