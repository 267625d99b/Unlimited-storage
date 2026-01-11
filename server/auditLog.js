/**
 * Advanced Audit Logging Module
 * وحدة سجل التدقيق المتقدم
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============ CONFIGURATION ============

const AUDIT_LOG_DIR = path.join(__dirname, 'logs', 'audit');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_LOG_FILES = 30; // Keep 30 days of logs
const SENSITIVE_FIELDS = ['password', 'passwordHash', 'token', 'secret', 'apiKey', 'creditCard'];

// Audit event categories
const AUDIT_CATEGORIES = {
  AUTH: 'authentication',
  USER: 'user_management',
  FILE: 'file_operations',
  FOLDER: 'folder_operations',
  SHARE: 'sharing',
  ADMIN: 'administration',
  SECURITY: 'security',
  SYSTEM: 'system'
};

// Audit event types
const AUDIT_EVENTS = {
  // Authentication
  LOGIN_SUCCESS: { category: AUDIT_CATEGORIES.AUTH, severity: 'info', description: 'تسجيل دخول ناجح' },
  LOGIN_FAILED: { category: AUDIT_CATEGORIES.AUTH, severity: 'warning', description: 'فشل تسجيل الدخول' },
  LOGIN_LOCKED: { category: AUDIT_CATEGORIES.AUTH, severity: 'warning', description: 'قفل الحساب' },
  LOGOUT: { category: AUDIT_CATEGORIES.AUTH, severity: 'info', description: 'تسجيل خروج' },
  TOKEN_REFRESH: { category: AUDIT_CATEGORIES.AUTH, severity: 'info', description: 'تجديد التوكن' },
  
  // User Management
  USER_CREATED: { category: AUDIT_CATEGORIES.USER, severity: 'info', description: 'إنشاء مستخدم' },
  USER_UPDATED: { category: AUDIT_CATEGORIES.USER, severity: 'info', description: 'تحديث مستخدم' },
  USER_DELETED: { category: AUDIT_CATEGORIES.USER, severity: 'warning', description: 'حذف مستخدم' },
  PASSWORD_CHANGED: { category: AUDIT_CATEGORIES.USER, severity: 'info', description: 'تغيير كلمة المرور' },
  PASSWORD_RESET: { category: AUDIT_CATEGORIES.USER, severity: 'warning', description: 'إعادة تعيين كلمة المرور' },
  EMAIL_VERIFIED: { category: AUDIT_CATEGORIES.USER, severity: 'info', description: 'تأكيد البريد الإلكتروني' },
  
  // 2FA
  TWO_FA_ENABLED: { category: AUDIT_CATEGORIES.SECURITY, severity: 'info', description: 'تفعيل المصادقة الثنائية' },
  TWO_FA_DISABLED: { category: AUDIT_CATEGORIES.SECURITY, severity: 'warning', description: 'تعطيل المصادقة الثنائية' },
  TWO_FA_VERIFIED: { category: AUDIT_CATEGORIES.AUTH, severity: 'info', description: 'التحقق من 2FA' },
  TWO_FA_FAILED: { category: AUDIT_CATEGORIES.AUTH, severity: 'warning', description: 'فشل التحقق من 2FA' },
  
  // File Operations
  FILE_UPLOADED: { category: AUDIT_CATEGORIES.FILE, severity: 'info', description: 'رفع ملف' },
  FILE_DOWNLOADED: { category: AUDIT_CATEGORIES.FILE, severity: 'info', description: 'تحميل ملف' },
  FILE_DELETED: { category: AUDIT_CATEGORIES.FILE, severity: 'info', description: 'حذف ملف' },
  FILE_RENAMED: { category: AUDIT_CATEGORIES.FILE, severity: 'info', description: 'إعادة تسمية ملف' },
  FILE_MOVED: { category: AUDIT_CATEGORIES.FILE, severity: 'info', description: 'نقل ملف' },
  FILE_COPIED: { category: AUDIT_CATEGORIES.FILE, severity: 'info', description: 'نسخ ملف' },
  FILE_RESTORED: { category: AUDIT_CATEGORIES.FILE, severity: 'info', description: 'استعادة ملف' },
  FILE_SCAN_BLOCKED: { category: AUDIT_CATEGORIES.SECURITY, severity: 'critical', description: 'حظر ملف ضار' },
  
  // Folder Operations
  FOLDER_CREATED: { category: AUDIT_CATEGORIES.FOLDER, severity: 'info', description: 'إنشاء مجلد' },
  FOLDER_DELETED: { category: AUDIT_CATEGORIES.FOLDER, severity: 'info', description: 'حذف مجلد' },
  FOLDER_RENAMED: { category: AUDIT_CATEGORIES.FOLDER, severity: 'info', description: 'إعادة تسمية مجلد' },
  FOLDER_MOVED: { category: AUDIT_CATEGORIES.FOLDER, severity: 'info', description: 'نقل مجلد' },
  
  // Sharing
  SHARE_CREATED: { category: AUDIT_CATEGORIES.SHARE, severity: 'info', description: 'إنشاء مشاركة' },
  SHARE_ACCESSED: { category: AUDIT_CATEGORIES.SHARE, severity: 'info', description: 'الوصول لمشاركة' },
  SHARE_REVOKED: { category: AUDIT_CATEGORIES.SHARE, severity: 'info', description: 'إلغاء مشاركة' },
  
  // Admin
  ADMIN_USER_CREATED: { category: AUDIT_CATEGORIES.ADMIN, severity: 'warning', description: 'إنشاء مستخدم بواسطة المدير' },
  ADMIN_USER_DELETED: { category: AUDIT_CATEGORIES.ADMIN, severity: 'warning', description: 'حذف مستخدم بواسطة المدير' },
  ADMIN_USER_SUSPENDED: { category: AUDIT_CATEGORIES.ADMIN, severity: 'warning', description: 'إيقاف مستخدم' },
  ADMIN_PASSWORD_RESET: { category: AUDIT_CATEGORIES.ADMIN, severity: 'warning', description: 'إعادة تعيين كلمة مرور بواسطة المدير' },
  ADMIN_ROLE_CHANGED: { category: AUDIT_CATEGORIES.ADMIN, severity: 'warning', description: 'تغيير صلاحيات مستخدم' },
  BACKUP_CREATED: { category: AUDIT_CATEGORIES.ADMIN, severity: 'info', description: 'إنشاء نسخة احتياطية' },
  
  // Security
  RATE_LIMIT_EXCEEDED: { category: AUDIT_CATEGORIES.SECURITY, severity: 'warning', description: 'تجاوز حد الطلبات' },
  SUSPICIOUS_ACTIVITY: { category: AUDIT_CATEGORIES.SECURITY, severity: 'warning', description: 'نشاط مشبوه' },
  BRUTE_FORCE_DETECTED: { category: AUDIT_CATEGORIES.SECURITY, severity: 'critical', description: 'محاولة اختراق' },
  INVALID_TOKEN: { category: AUDIT_CATEGORIES.SECURITY, severity: 'warning', description: 'توكن غير صالح' },
  UNAUTHORIZED_ACCESS: { category: AUDIT_CATEGORIES.SECURITY, severity: 'warning', description: 'محاولة وصول غير مصرح' },
  
  // System
  SERVER_STARTED: { category: AUDIT_CATEGORIES.SYSTEM, severity: 'info', description: 'بدء تشغيل السيرفر' },
  SERVER_STOPPED: { category: AUDIT_CATEGORIES.SYSTEM, severity: 'info', description: 'إيقاف السيرفر' },
  CONFIG_CHANGED: { category: AUDIT_CATEGORIES.SYSTEM, severity: 'warning', description: 'تغيير الإعدادات' },
  ERROR_OCCURRED: { category: AUDIT_CATEGORIES.SYSTEM, severity: 'error', description: 'حدث خطأ' }
};

// ============ AUDIT LOGGER CLASS ============

class AuditLogger {
  constructor(options = {}) {
    this.options = {
      logDir: options.logDir || AUDIT_LOG_DIR,
      maxFileSize: options.maxFileSize || MAX_LOG_SIZE,
      maxFiles: options.maxFiles || MAX_LOG_FILES,
      enableConsole: options.enableConsole !== false,
      enableFile: options.enableFile !== false,
      enableDatabase: options.enableDatabase || false,
      ...options
    };
    
    // Ensure log directory exists
    if (this.options.enableFile && !fs.existsSync(this.options.logDir)) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }
    
    this.currentLogFile = null;
    this.currentLogSize = 0;
    
    // Initialize log file
    if (this.options.enableFile) {
      this.rotateLogFile();
    }
  }

  /**
   * Log an audit event
   */
  log(eventType, data = {}) {
    const eventInfo = AUDIT_EVENTS[eventType] || {
      category: AUDIT_CATEGORIES.SYSTEM,
      severity: 'info',
      description: eventType
    };
    
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      category: eventInfo.category,
      severity: eventInfo.severity,
      description: eventInfo.description,
      
      // User info
      userId: data.userId || null,
      username: data.username || null,
      userRole: data.userRole || null,
      
      // Request info
      ip: data.ip || null,
      userAgent: data.userAgent || null,
      requestId: data.requestId || null,
      method: data.method || null,
      path: data.path || null,
      
      // Target info
      targetType: data.targetType || null,
      targetId: data.targetId || null,
      targetName: data.targetName || null,
      
      // Additional details
      details: this.sanitizeData(data.details || {}),
      
      // Result
      success: data.success !== false,
      errorMessage: data.errorMessage || null,
      
      // Metadata
      sessionId: data.sessionId || null,
      duration: data.duration || null
    };
    
    // Generate integrity hash
    entry.hash = this.generateHash(entry);
    
    // Log to console
    if (this.options.enableConsole) {
      this.logToConsole(entry);
    }
    
    // Log to file
    if (this.options.enableFile) {
      this.logToFile(entry);
    }
    
    // Log to database (if enabled)
    if (this.options.enableDatabase && this.options.dbLogger) {
      this.options.dbLogger(entry);
    }
    
    return entry;
  }

  /**
   * Sanitize sensitive data
   */
  sanitizeData(data) {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    
    for (const field of SENSITIVE_FIELDS) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Generate integrity hash for log entry
   */
  generateHash(entry) {
    const content = JSON.stringify({
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      userId: entry.userId,
      targetId: entry.targetId,
      details: entry.details
    });
    
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Log to console with colors
   */
  logToConsole(entry) {
    const colors = {
      info: '\x1b[36m',    // Cyan
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      critical: '\x1b[35m' // Magenta
    };
    const reset = '\x1b[0m';
    const color = colors[entry.severity] || '';
    
    const message = `${color}[AUDIT] ${entry.timestamp} | ${entry.severity.toUpperCase()} | ${entry.eventType} | User: ${entry.username || 'anonymous'} | ${entry.description}${reset}`;
    
    if (entry.severity === 'error' || entry.severity === 'critical') {
      console.error(message);
    } else if (entry.severity === 'warning') {
      console.warn(message);
    } else {
      console.log(message);
    }
  }

  /**
   * Log to file
   */
  logToFile(entry) {
    const line = JSON.stringify(entry) + '\n';
    const lineSize = Buffer.byteLength(line);
    
    // Check if rotation needed
    if (this.currentLogSize + lineSize > this.options.maxFileSize) {
      this.rotateLogFile();
    }
    
    try {
      fs.appendFileSync(this.currentLogFile, line);
      this.currentLogSize += lineSize;
    } catch (e) {
      console.error('Failed to write audit log:', e);
    }
  }

  /**
   * Rotate log file
   */
  rotateLogFile() {
    const date = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    this.currentLogFile = path.join(this.options.logDir, `audit_${date}_${timestamp}.log`);
    this.currentLogSize = 0;
    
    // Clean old log files
    this.cleanOldLogs();
  }

  /**
   * Clean old log files
   */
  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.options.logDir)
        .filter(f => f.startsWith('audit_') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.options.logDir, f),
          time: fs.statSync(path.join(this.options.logDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      // Remove files beyond max limit
      if (files.length > this.options.maxFiles) {
        const toDelete = files.slice(this.options.maxFiles);
        toDelete.forEach(f => {
          fs.unlinkSync(f.path);
          console.log(`🗑️ Deleted old audit log: ${f.name}`);
        });
      }
    } catch (e) {
      console.error('Error cleaning old logs:', e);
    }
  }

  /**
   * Query audit logs
   */
  query(filters = {}) {
    const results = [];
    const files = fs.readdirSync(this.options.logDir)
      .filter(f => f.startsWith('audit_') && f.endsWith('.log'))
      .sort()
      .reverse();
    
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    let count = 0;
    
    for (const file of files) {
      if (results.length >= limit) break;
      
      const content = fs.readFileSync(path.join(this.options.logDir, file), 'utf8');
      const lines = content.trim().split('\n').reverse();
      
      for (const line of lines) {
        if (results.length >= limit) break;
        
        try {
          const entry = JSON.parse(line);
          
          // Apply filters
          if (filters.userId && entry.userId !== filters.userId) continue;
          if (filters.eventType && entry.eventType !== filters.eventType) continue;
          if (filters.category && entry.category !== filters.category) continue;
          if (filters.severity && entry.severity !== filters.severity) continue;
          if (filters.startDate && new Date(entry.timestamp) < new Date(filters.startDate)) continue;
          if (filters.endDate && new Date(entry.timestamp) > new Date(filters.endDate)) continue;
          
          count++;
          if (count > offset) {
            results.push(entry);
          }
        } catch (e) {
          // Skip invalid lines
        }
      }
    }
    
    return {
      entries: results,
      total: count,
      limit,
      offset
    };
  }

  /**
   * Get audit statistics
   */
  getStats(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const stats = {
      totalEvents: 0,
      byCategory: {},
      bySeverity: {},
      byEventType: {},
      topUsers: {},
      securityAlerts: 0
    };
    
    const entries = this.query({ startDate: startDate.toISOString(), limit: 10000 }).entries;
    
    for (const entry of entries) {
      stats.totalEvents++;
      
      // By category
      stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
      
      // By severity
      stats.bySeverity[entry.severity] = (stats.bySeverity[entry.severity] || 0) + 1;
      
      // By event type
      stats.byEventType[entry.eventType] = (stats.byEventType[entry.eventType] || 0) + 1;
      
      // Top users
      if (entry.username) {
        stats.topUsers[entry.username] = (stats.topUsers[entry.username] || 0) + 1;
      }
      
      // Security alerts
      if (entry.severity === 'warning' || entry.severity === 'critical') {
        if (entry.category === AUDIT_CATEGORIES.SECURITY) {
          stats.securityAlerts++;
        }
      }
    }
    
    return stats;
  }
}

// ============ SINGLETON INSTANCE ============

let auditLogger = null;

function initAuditLogger(options = {}) {
  auditLogger = new AuditLogger(options);
  return auditLogger;
}

function getAuditLogger() {
  if (!auditLogger) {
    auditLogger = new AuditLogger();
  }
  return auditLogger;
}

// ============ EXPRESS MIDDLEWARE ============

function auditMiddleware(options = {}) {
  const logger = getAuditLogger();
  
  return (req, res, next) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    req.auditLog = (eventType, data = {}) => {
      logger.log(eventType, {
        ...data,
        userId: req.user?.userId,
        username: req.user?.username,
        userRole: req.user?.role,
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId,
        method: req.method,
        path: req.path,
        sessionId: req.sessionId
      });
    };
    
    res.on('finish', () => {
      // Auto-log certain events
      if (options.autoLog) {
        const duration = Date.now() - startTime;
        
        // Log security events
        if (res.statusCode === 401) {
          req.auditLog('UNAUTHORIZED_ACCESS', { duration, success: false });
        } else if (res.statusCode === 403) {
          req.auditLog('UNAUTHORIZED_ACCESS', { duration, success: false });
        } else if (res.statusCode === 429) {
          req.auditLog('RATE_LIMIT_EXCEEDED', { duration, success: false });
        }
      }
    });
    
    next();
  };
}

module.exports = {
  AuditLogger,
  AUDIT_CATEGORIES,
  AUDIT_EVENTS,
  initAuditLogger,
  getAuditLogger,
  auditMiddleware
};
