/**
 * Session Manager
 * إدارة الجلسات مع timeout تلقائي وتسجيل خروج من جميع الأجهزة
 */

const crypto = require('crypto');

// تخزين الجلسات في الذاكرة (يمكن استبداله بـ Redis)
const sessions = new Map();
const userSessions = new Map(); // userId -> Set of sessionIds

// إعدادات الجلسة
const SESSION_CONFIG = {
  maxAge: 24 * 60 * 60 * 1000, // 24 ساعة
  inactivityTimeout: 30 * 60 * 1000, // 30 دقيقة بدون نشاط
  maxSessionsPerUser: 5, // أقصى عدد جلسات لكل مستخدم
  cleanupInterval: 5 * 60 * 1000 // تنظيف كل 5 دقائق
};

/**
 * إنشاء جلسة جديدة
 */
function createSession(userId, deviceInfo = {}) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  
  const session = {
    id: sessionId,
    userId,
    deviceInfo: {
      userAgent: deviceInfo.userAgent || 'Unknown',
      ip: deviceInfo.ip || 'Unknown',
      device: parseUserAgent(deviceInfo.userAgent),
      location: deviceInfo.location || 'Unknown'
    },
    createdAt: now,
    lastActivity: now,
    expiresAt: now + SESSION_CONFIG.maxAge
  };
  
  // حفظ الجلسة
  sessions.set(sessionId, session);
  
  // ربط الجلسة بالمستخدم
  if (!userSessions.has(userId)) {
    userSessions.set(userId, new Set());
  }
  userSessions.get(userId).add(sessionId);
  
  // التحقق من عدد الجلسات
  enforceMaxSessions(userId);
  
  return session;
}

/**
 * التحقق من صلاحية الجلسة
 */
function validateSession(sessionId) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return { valid: false, reason: 'SESSION_NOT_FOUND' };
  }
  
  const now = Date.now();
  
  // التحقق من انتهاء الصلاحية
  if (now > session.expiresAt) {
    destroySession(sessionId);
    return { valid: false, reason: 'SESSION_EXPIRED' };
  }
  
  // التحقق من عدم النشاط
  if (now - session.lastActivity > SESSION_CONFIG.inactivityTimeout) {
    destroySession(sessionId);
    return { valid: false, reason: 'SESSION_INACTIVE' };
  }
  
  // تحديث آخر نشاط
  session.lastActivity = now;
  
  return { valid: true, session };
}

/**
 * تحديث نشاط الجلسة
 */
function touchSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = Date.now();
    return true;
  }
  return false;
}

/**
 * إنهاء جلسة
 */
function destroySession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    // إزالة من قائمة جلسات المستخدم
    const userSessionSet = userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      if (userSessionSet.size === 0) {
        userSessions.delete(session.userId);
      }
    }
    
    sessions.delete(sessionId);
    return true;
  }
  return false;
}

/**
 * تسجيل خروج من جميع الأجهزة
 */
function logoutAllDevices(userId, exceptSessionId = null) {
  const userSessionSet = userSessions.get(userId);
  if (!userSessionSet) return 0;
  
  let count = 0;
  for (const sessionId of userSessionSet) {
    if (sessionId !== exceptSessionId) {
      sessions.delete(sessionId);
      count++;
    }
  }
  
  if (exceptSessionId && userSessionSet.has(exceptSessionId)) {
    userSessions.set(userId, new Set([exceptSessionId]));
  } else {
    userSessions.delete(userId);
  }
  
  return count;
}

/**
 * الحصول على جميع جلسات المستخدم
 */
function getUserSessions(userId) {
  const userSessionSet = userSessions.get(userId);
  if (!userSessionSet) return [];
  
  const result = [];
  for (const sessionId of userSessionSet) {
    const session = sessions.get(sessionId);
    if (session) {
      result.push({
        id: session.id,
        deviceInfo: session.deviceInfo,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        isCurrent: false // يتم تحديده في الـ route
      });
    }
  }
  
  return result.sort((a, b) => b.lastActivity - a.lastActivity);
}

/**
 * فرض الحد الأقصى للجلسات
 */
function enforceMaxSessions(userId) {
  const userSessionSet = userSessions.get(userId);
  if (!userSessionSet || userSessionSet.size <= SESSION_CONFIG.maxSessionsPerUser) {
    return;
  }
  
  // الحصول على الجلسات مرتبة حسب آخر نشاط
  const sortedSessions = Array.from(userSessionSet)
    .map(id => sessions.get(id))
    .filter(Boolean)
    .sort((a, b) => a.lastActivity - b.lastActivity);
  
  // حذف الجلسات الأقدم
  const toRemove = sortedSessions.slice(0, sortedSessions.length - SESSION_CONFIG.maxSessionsPerUser);
  for (const session of toRemove) {
    destroySession(session.id);
  }
}

/**
 * تحليل User Agent
 */
function parseUserAgent(userAgent) {
  if (!userAgent) return 'Unknown Device';
  
  // تحديد نوع الجهاز
  let device = 'Desktop';
  if (/mobile/i.test(userAgent)) device = 'Mobile';
  else if (/tablet/i.test(userAgent)) device = 'Tablet';
  
  // تحديد المتصفح
  let browser = 'Unknown';
  if (/chrome/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent)) browser = 'Safari';
  else if (/edge/i.test(userAgent)) browser = 'Edge';
  else if (/opera/i.test(userAgent)) browser = 'Opera';
  
  // تحديد نظام التشغيل
  let os = 'Unknown';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/mac/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/ios|iphone|ipad/i.test(userAgent)) os = 'iOS';
  
  return `${browser} on ${os} (${device})`;
}

/**
 * تنظيف الجلسات المنتهية
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [sessionId, session] of sessions) {
    if (now > session.expiresAt || now - session.lastActivity > SESSION_CONFIG.inactivityTimeout) {
      destroySession(sessionId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Session cleanup: removed ${cleaned} expired sessions`);
  }
  
  return cleaned;
}

/**
 * الحصول على إحصائيات الجلسات
 */
function getSessionStats() {
  return {
    totalSessions: sessions.size,
    totalUsers: userSessions.size,
    config: SESSION_CONFIG
  };
}

// بدء التنظيف الدوري
const cleanupInterval = setInterval(cleanupExpiredSessions, SESSION_CONFIG.cleanupInterval);

// Middleware للتحقق من الجلسة
function sessionMiddleware(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  
  if (sessionId) {
    const result = validateSession(sessionId);
    if (result.valid) {
      req.session = result.session;
    }
  }
  
  next();
}

// تنظيف عند إغلاق التطبيق
function shutdown() {
  clearInterval(cleanupInterval);
  sessions.clear();
  userSessions.clear();
}

module.exports = {
  createSession,
  validateSession,
  touchSession,
  destroySession,
  logoutAllDevices,
  getUserSessions,
  getSessionStats,
  cleanupExpiredSessions,
  sessionMiddleware,
  shutdown,
  SESSION_CONFIG
};
