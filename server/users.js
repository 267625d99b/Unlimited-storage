/**
 * Advanced User Management System
 * نظام إدارة مستخدمين متقدم
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const security = require('./security');

// Configuration
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Validate JWT Secret on startup
const jwtValidation = security.validateJWTSecret(process.env.JWT_SECRET);
if (!jwtValidation.valid) {
  console.error('❌ JWT_SECRET Security Issues:');
  jwtValidation.errors.forEach(err => console.error(`   - ${err}`));
  console.warn('⚠️  Using provided JWT_SECRET');
  console.warn(`💡 Recommended secret: ${security.generateSecureSecret()}`);
}

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_in_production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
const USERS_FILE = path.join(__dirname, '.users.json');
const SESSIONS_FILE = path.join(__dirname, '.sessions.json');

// User Roles & Permissions
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest'
};

const PERMISSIONS = {
  // File operations
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_DELETE: 'file:delete',
  FILE_SHARE: 'file:share',
  FILE_DOWNLOAD: 'file:download',

  // Folder operations
  FOLDER_CREATE: 'folder:create',
  FOLDER_DELETE: 'folder:delete',

  // User management
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',

  // Admin operations
  ADMIN_PANEL: 'admin:panel',
  ADMIN_SETTINGS: 'admin:settings',
  ADMIN_LOGS: 'admin:logs',

  // Storage
  STORAGE_UNLIMITED: 'storage:unlimited',
  STORAGE_VIEW: 'storage:view'
};

// Role permissions mapping
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: [
    PERMISSIONS.FILE_READ, PERMISSIONS.FILE_WRITE, PERMISSIONS.FILE_DELETE,
    PERMISSIONS.FILE_SHARE, PERMISSIONS.FILE_DOWNLOAD,
    PERMISSIONS.FOLDER_CREATE, PERMISSIONS.FOLDER_DELETE,
    PERMISSIONS.USER_VIEW, PERMISSIONS.USER_CREATE, PERMISSIONS.USER_EDIT,
    PERMISSIONS.ADMIN_PANEL, PERMISSIONS.ADMIN_LOGS,
    PERMISSIONS.STORAGE_UNLIMITED, PERMISSIONS.STORAGE_VIEW
  ],
  [ROLES.USER]: [
    PERMISSIONS.FILE_READ, PERMISSIONS.FILE_WRITE, PERMISSIONS.FILE_DELETE,
    PERMISSIONS.FILE_SHARE, PERMISSIONS.FILE_DOWNLOAD,
    PERMISSIONS.FOLDER_CREATE, PERMISSIONS.FOLDER_DELETE,
    PERMISSIONS.STORAGE_VIEW
  ],
  [ROLES.GUEST]: [
    PERMISSIONS.FILE_READ, PERMISSIONS.FILE_DOWNLOAD
  ]
};

// Storage limits per role (in bytes)
const STORAGE_LIMITS = {
  [ROLES.SUPER_ADMIN]: -1, // Unlimited
  [ROLES.ADMIN]: -1, // Unlimited
  [ROLES.USER]: 10 * 1024 * 1024 * 1024, // 10 GB
  [ROLES.GUEST]: 1 * 1024 * 1024 * 1024 // 1 GB
};


// ============ DATA MANAGEMENT ============
let usersData = { users: [], settings: {} };
let sessionsData = { sessions: [], refreshTokens: [] };

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading users:', e);
  }
  return usersData;
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2));
  } catch (e) {
    console.error('Error saving users:', e);
  }
}

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading sessions:', e);
  }
  return sessionsData;
}

function saveSessions() {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsData, null, 2));
  } catch (e) {
    console.error('Error saving sessions:', e);
  }
}

// ============ INITIALIZATION ============
async function initUsers() {
  loadUsers();
  loadSessions();

  // Create super admin if no users exist
  if (usersData.users.length === 0) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    try {
      await createUser({
        username: 'admin',
        email: 'admin@localhost',
        password: adminPassword,
        displayName: 'مدير النظام',
        role: ROLES.SUPER_ADMIN
      });
      console.log('✅ Super Admin created (username: admin)');
    } catch (err) {
      // If password validation fails, create with simple hash
      console.warn('⚠️ Creating admin with basic setup:', err.message);
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      const adminUser = {
        id: crypto.randomUUID(),
        username: 'admin',
        email: 'admin@localhost',
        passwordHash: hashedPassword,
        displayName: 'مدير النظام',
        role: ROLES.SUPER_ADMIN,
        status: 'active',
        avatar: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        emailVerified: true,
        twoFactorEnabled: false,
        storageUsed: 0,
        storageLimit: -1,
        preferences: { theme: 'dark', language: 'ar' }
      };
      usersData.users.push(adminUser);
      saveUsers();
      console.log('✅ Super Admin created (username: admin)');
    }
  }

  // Clean expired sessions
  cleanExpiredSessions();

  // Schedule session cleanup every hour
  setInterval(cleanExpiredSessions, 60 * 60 * 1000);

  console.log(`✅ User system initialized (${usersData.users.length} users)`);
}

function cleanExpiredSessions() {
  const now = Date.now();
  sessionsData.sessions = sessionsData.sessions.filter(s => s.expiresAt > now);
  sessionsData.refreshTokens = sessionsData.refreshTokens.filter(t => t.expiresAt > now);
  saveSessions();
}

// ============ USER CRUD ============
async function createUser({ username, email, password, displayName, role = ROLES.USER, avatar = null }) {
  loadUsers();

  // Validate username with security module
  const usernameValidation = security.validateUsername(username);
  if (!usernameValidation.valid) {
    throw new Error(usernameValidation.error);
  }

  // Validate email with security module
  const emailValidation = security.validateEmail(email);
  if (!emailValidation.valid) {
    throw new Error(emailValidation.error);
  }

  // Validate password with security module (strong password policy)
  const passwordValidation = security.validatePassword(password, {
    username: usernameValidation.sanitized,
    email: emailValidation.sanitized
  });
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join('\n'));
  }

  // Check duplicates
  const existingUser = usersData.users.find(u =>
    u.username.toLowerCase() === usernameValidation.sanitized ||
    u.email.toLowerCase() === emailValidation.sanitized
  );
  if (existingUser) {
    throw new Error('اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل');
  }

  // Sanitize display name
  const sanitizedDisplayName = security.sanitizeString(displayName || username);

  // Create user
  const user = {
    id: crypto.randomUUID(),
    username: usernameValidation.sanitized,
    email: emailValidation.sanitized,
    passwordHash: await bcrypt.hash(password, 12),
    displayName: sanitizedDisplayName,
    avatar,
    role,
    permissions: ROLE_PERMISSIONS[role] || [],
    storageLimit: STORAGE_LIMITS[role] || STORAGE_LIMITS[ROLES.USER],
    storageUsed: 0,
    status: 'active', // active, suspended, pending
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: null,
    loginAttempts: 0,
    lockedUntil: null,
    settings: {
      language: 'ar',
      theme: 'light',
      notifications: true
    },
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
    emailVerified: false
  };

  usersData.users.push(user);
  saveUsers();

  return sanitizeUser(user);
}

function getUser(userId) {
  loadUsers();
  const user = usersData.users.find(u => u.id === userId);
  return user ? sanitizeUser(user) : null;
}

function getUserByUsername(username) {
  loadUsers();
  return usersData.users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

function getUserByEmail(email) {
  loadUsers();
  return usersData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

function getAllUsers(options = {}) {
  loadUsers();
  let users = [...usersData.users];

  // Filter by role
  if (options.role) {
    users = users.filter(u => u.role === options.role);
  }

  // Filter by status
  if (options.status) {
    users = users.filter(u => u.status === options.status);
  }

  // Search
  if (options.search) {
    const search = options.search.toLowerCase();
    users = users.filter(u =>
      u.username.includes(search) ||
      u.email.includes(search) ||
      u.displayName.toLowerCase().includes(search)
    );
  }

  // Sort
  const sortBy = options.sortBy || 'createdAt';
  const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
  users.sort((a, b) => {
    if (a[sortBy] < b[sortBy]) return -1 * sortOrder;
    if (a[sortBy] > b[sortBy]) return 1 * sortOrder;
    return 0;
  });

  // Pagination
  const page = options.page || 1;
  const limit = options.limit || 50;
  const total = users.length;
  const start = (page - 1) * limit;
  users = users.slice(start, start + limit);

  return {
    users: users.map(sanitizeUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function updateUser(userId, updates) {
  loadUsers();
  const index = usersData.users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('المستخدم غير موجود');
  }

  const user = usersData.users[index];

  // Update allowed fields
  const allowedFields = ['displayName', 'avatar', 'settings', 'status', 'emailVerified', 'twoFactorEnabled', 'twoFactorSecret', 'twoFactorBackupCodes'];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      user[field] = updates[field];
    }
  }

  // Update role (admin only)
  if (updates.role && Object.values(ROLES).includes(updates.role)) {
    user.role = updates.role;
    user.permissions = ROLE_PERMISSIONS[updates.role];
    user.storageLimit = STORAGE_LIMITS[updates.role];
  }

  // Update password
  if (updates.password) {
    user.passwordHash = await bcrypt.hash(updates.password, 12);
  }

  user.updatedAt = new Date().toISOString();
  usersData.users[index] = user;
  saveUsers();

  return sanitizeUser(user);
}

function deleteUser(userId) {
  loadUsers();
  const index = usersData.users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('المستخدم غير موجود');
  }

  // Don't delete super admin
  if (usersData.users[index].role === ROLES.SUPER_ADMIN) {
    const superAdmins = usersData.users.filter(u => u.role === ROLES.SUPER_ADMIN);
    if (superAdmins.length <= 1) {
      throw new Error('لا يمكن حذف المدير الأعلى الوحيد');
    }
  }

  usersData.users.splice(index, 1);
  saveUsers();

  // Revoke all sessions
  revokeAllUserSessions(userId);

  return true;
}

function sanitizeUser(user) {
  const { passwordHash, twoFactorSecret, loginAttempts, lockedUntil, ...safe } = user;
  return safe;
}


// ============ AUTHENTICATION ============
async function login(usernameOrEmail, password, deviceInfo = {}) {
  loadUsers();

  // Find user
  const user = usersData.users.find(u =>
    u.username === usernameOrEmail.toLowerCase() ||
    u.email === usernameOrEmail.toLowerCase()
  );

  if (!user) {
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
  }

  // Check if account is locked
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
    throw new Error(`الحساب مقفل. حاول بعد ${remainingMinutes} دقيقة`);
  }

  // Check if account is suspended
  if (user.status === 'suspended') {
    throw new Error('هذا الحساب موقوف. تواصل مع المدير');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    // Increment failed attempts
    user.loginAttempts = (user.loginAttempts || 0) + 1;

    // Lock after 5 failed attempts
    if (user.loginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
      user.loginAttempts = 0;
      saveUsers();
      throw new Error('تم قفل الحساب لمدة 30 دقيقة بسبب محاولات فاشلة متعددة');
    }

    saveUsers();
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
  }

  // Reset failed attempts
  user.loginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date().toISOString();
  saveUsers();

  // Generate tokens
  const tokens = generateTokens(user, deviceInfo);

  return {
    user: sanitizeUser(user),
    ...tokens
  };
}

function generateTokens(user, deviceInfo = {}) {
  loadSessions();

  const sessionId = crypto.randomUUID();
  const now = Date.now();

  // Access token (short-lived)
  const accessToken = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      sessionId
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  // Refresh token (long-lived)
  const refreshToken = jwt.sign(
    {
      userId: user.id,
      sessionId,
      type: 'refresh'
    },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  // Store session
  const session = {
    id: sessionId,
    userId: user.id,
    deviceInfo: {
      userAgent: deviceInfo.userAgent || 'Unknown',
      ip: deviceInfo.ip || 'Unknown',
      platform: deviceInfo.platform || 'Unknown'
    },
    createdAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
    lastActivityAt: now
  };

  sessionsData.sessions.push(session);
  sessionsData.refreshTokens.push({
    token: refreshToken,
    sessionId,
    userId: user.id,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000
  });

  saveSessions();

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
    sessionId
  };
}

function refreshAccessToken(refreshToken) {
  loadSessions();

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    // Check if refresh token is valid
    const storedToken = sessionsData.refreshTokens.find(t =>
      t.token === refreshToken && t.userId === decoded.userId
    );

    if (!storedToken || storedToken.expiresAt < Date.now()) {
      throw new Error('Refresh token expired');
    }

    // Get user
    const user = usersData.users.find(u => u.id === decoded.userId);
    if (!user || user.status !== 'active') {
      throw new Error('User not found or inactive');
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        sessionId: decoded.sessionId
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Update session activity
    const session = sessionsData.sessions.find(s => s.id === decoded.sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
      saveSessions();
    }

    return {
      accessToken,
      expiresIn: 15 * 60
    };
  } catch (e) {
    throw new Error('Invalid refresh token');
  }
}

function logout(sessionId) {
  loadSessions();
  sessionsData.sessions = sessionsData.sessions.filter(s => s.id !== sessionId);
  sessionsData.refreshTokens = sessionsData.refreshTokens.filter(t => t.sessionId !== sessionId);
  saveSessions();
}

function logoutAllDevices(userId) {
  revokeAllUserSessions(userId);
}

function revokeAllUserSessions(userId) {
  loadSessions();
  sessionsData.sessions = sessionsData.sessions.filter(s => s.userId !== userId);
  sessionsData.refreshTokens = sessionsData.refreshTokens.filter(t => t.userId !== userId);
  saveSessions();
}

function getUserSessions(userId) {
  loadSessions();
  return sessionsData.sessions.filter(s => s.userId === userId);
}

// ============ TOKEN VERIFICATION ============
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // JWT is valid - no need to check sessions (they may be lost on server restart)
    // Just verify the user still exists
    loadUsers();
    const user = usersData.users.find(u => u.id === decoded.userId);
    if (!user) {
      return null;
    }

    // Check if user is active (default to active if status not set)
    const isActive = user.status === 'active' || user.isActive === true || !user.status;
    if (!isActive) {
      return null;
    }

    return decoded;
  } catch (e) {
    console.error('Token verification error:', e.message);
    return null;
  }
}

// ============ MIDDLEWARE ============
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'يرجى تسجيل الدخول', code: 'NO_TOKEN' });
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'جلسة منتهية', code: 'INVALID_TOKEN' });
  }

  // Get full user data
  const user = usersData.users.find(u => u.id === decoded.userId);
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'الحساب غير نشط', code: 'INACTIVE_USER' });
  }

  req.user = {
    ...decoded,
    storageLimit: user.storageLimit,
    storageUsed: user.storageUsed
  };
  req.sessionId = decoded.sessionId;

  next();
}

function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
    }

    const hasPermission = permissions.every(p => req.user.permissions.includes(p));
    if (!hasPermission) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لهذا الإجراء' });
    }

    next();
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لهذا الإجراء' });
    }

    next();
  };
}

// ============ STORAGE MANAGEMENT ============
function updateUserStorage(userId, bytesChange) {
  loadUsers();
  const user = usersData.users.find(u => u.id === userId);
  if (user) {
    user.storageUsed = Math.max(0, (user.storageUsed || 0) + bytesChange);
    saveUsers();
  }
}

function checkStorageLimit(userId, fileSize) {
  loadUsers();
  const user = usersData.users.find(u => u.id === userId);
  if (!user) return false;

  // Unlimited storage
  if (user.storageLimit === -1) return true;

  return (user.storageUsed + fileSize) <= user.storageLimit;
}

function getUserStorageInfo(userId) {
  loadUsers();
  const user = usersData.users.find(u => u.id === userId);
  if (!user) return null;

  return {
    used: user.storageUsed || 0,
    limit: user.storageLimit,
    unlimited: user.storageLimit === -1,
    percentage: user.storageLimit === -1 ? 0 : Math.round((user.storageUsed / user.storageLimit) * 100)
  };
}

// ============ PASSWORD MANAGEMENT ============
async function changePassword(userId, currentPassword, newPassword) {
  loadUsers();
  const user = usersData.users.find(u => u.id === userId);
  if (!user) {
    throw new Error('المستخدم غير موجود');
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new Error('كلمة المرور الحالية غير صحيحة');
  }

  // Validate new password with strong policy
  const passwordValidation = security.validatePassword(newPassword, {
    username: user.username,
    email: user.email
  });
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join('\n'));
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.updatedAt = new Date().toISOString();
  saveUsers();

  // Optionally revoke all sessions except current
  // revokeAllUserSessions(userId);

  return true;
}

async function resetPassword(userId, newPassword) {
  loadUsers();
  const user = usersData.users.find(u => u.id === userId);
  if (!user) {
    throw new Error('المستخدم غير موجود');
  }

  // Validate new password with strong policy
  const passwordValidation = security.validatePassword(newPassword, {
    username: user.username,
    email: user.email
  });
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join('\n'));
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.updatedAt = new Date().toISOString();
  saveUsers();

  // Revoke all sessions
  revokeAllUserSessions(userId);

  return true;
}

// ============ EXPORTS ============
module.exports = {
  // Constants
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  STORAGE_LIMITS,

  // Initialization
  initUsers,

  // User CRUD
  createUser,
  getUser,
  getUserByUsername,
  getUserByEmail,
  getAllUsers,
  updateUser,
  deleteUser,

  // Authentication
  login,
  logout,
  logoutAllDevices,
  refreshAccessToken,
  verifyAccessToken,
  getUserSessions,

  // Middleware
  authMiddleware,
  requirePermission,
  requireRole,

  // Storage
  updateUserStorage,
  checkStorageLimit,
  getUserStorageInfo,

  // Password
  changePassword,
  resetPassword
};
