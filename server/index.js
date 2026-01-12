console.log('🚀 Starting server...');
require('dotenv').config();

// ============ ENVIRONMENT VALIDATION ============
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHANNEL_ID'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(v => console.error(`   - ${v}`));
  console.error('\n📝 Please check your .env file');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { Telegraf } = require('telegraf');
const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const archiver = require('archiver');
const https = require('https');
const http = require('http');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { z } = require('zod');
const auth = require('./auth');
const users = require('./users');
const security = require('./security');
const performance = require('./performance');
const notifications = require('./notifications');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const notificationRoutes = require('./routes/notifications');
const commentsRoutes = require('./routes/comments');
const collectionsRoutes = require('./routes/collections');
const versionsRoutes = require('./routes/versions');
const chunkedUploadRoutes = require('./routes/chunkedUpload');
const securityRoutes = require('./routes/security');
const sharingRoutes = require('./routes/sharing');
const teamsRoutes = require('./routes/teams');
const collaborationRoutes = require('./routes/collaboration');
const webhooksRoutes = require('./routes/webhooks');
const aiRoutes = require('./routes/ai');
const smartAIRoutes = require('./routes/smartAI');
const cookieParser = require('cookie-parser');
const { WebSocketServer } = require('ws');
const { cacheManager, cacheMiddleware } = require('./cache');
const ipSecurity = require('./ipSecurity');
const deviceManager = require('./deviceManager');

// Optional modules (graceful fallback if not installed)
let swagger, monitoring, fileScanner, auditLog;
try { swagger = require('./swagger'); } catch (e) { console.log('ℹ️ Swagger not configured'); }
try { monitoring = require('./monitoring'); } catch (e) { console.log('ℹ️ Monitoring not configured'); }
try { fileScanner = require('./fileScanner'); } catch (e) { console.log('ℹ️ File scanner not configured'); }
try { auditLog = require('./auditLog'); } catch (e) { console.log('ℹ️ Audit log not configured'); }

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Initialize audit logger
if (auditLog) {
  auditLog.initAuditLogger({ enableDatabase: false });
}

// Initialize Telegram bot
let bot;
try {
  bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  console.log('✅ Telegram bot initialized');
} catch (e) {
  console.error('❌ Failed to initialize Telegram bot:', e.message);
  process.exit(1);
}

const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

// ============ LOGGING ============
// Custom log format
const logFormat = IS_PRODUCTION 
  ? 'combined' 
  : ':method :url :status :response-time ms - :res[content-length]';

// Create logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log to file in production
if (IS_PRODUCTION) {
  const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'), 
    { flags: 'a' }
  );
  app.use(morgan(logFormat, { stream: accessLogStream }));
} else {
  app.use(morgan(logFormat));
}

// Setup Swagger API documentation
if (swagger && swagger.setupSwagger) {
  swagger.setupSwagger(app);
}

// Setup Prometheus monitoring
if (monitoring && monitoring.setupMonitoring) {
  monitoring.setupMonitoring(app);
}

// Setup audit logging middleware
if (auditLog && auditLog.auditMiddleware) {
  app.use(auditLog.auditMiddleware({ autoLog: true }));
}

// Custom logger utility
const logger = {
  info: (message, data = {}) => {
    const log = { timestamp: new Date().toISOString(), level: 'INFO', message, ...data };
    console.log(JSON.stringify(log));
  },
  error: (message, error = null, data = {}) => {
    const log = { 
      timestamp: new Date().toISOString(), 
      level: 'ERROR', 
      message, 
      error: error?.message || error,
      stack: error?.stack,
      ...data 
    };
    console.error(JSON.stringify(log));
    
    // Write to error log file
    fs.appendFileSync(
      path.join(logsDir, 'error.log'),
      JSON.stringify(log) + '\n'
    );
  },
  warn: (message, data = {}) => {
    const log = { timestamp: new Date().toISOString(), level: 'WARN', message, ...data };
    console.warn(JSON.stringify(log));
  }
};

// ============ VALIDATION SCHEMAS (Zod) ============
const schemas = {
  // Folder name validation
  folderName: z.string()
    .min(1, 'اسم المجلد مطلوب')
    .max(255, 'اسم المجلد طويل جداً')
    .refine(name => !name.includes('..'), 'اسم غير صالح')
    .refine(name => !name.includes('/'), 'اسم غير صالح')
    .refine(name => !name.includes('\\'), 'اسم غير صالح'),
  
  // File name validation
  fileName: z.string()
    .min(1, 'اسم الملف مطلوب')
    .max(255, 'اسم الملف طويل جداً')
    .refine(name => !name.includes('..'), 'اسم غير صالح')
    .refine(name => !name.includes('/'), 'اسم غير صالح'),
  
  // UUID validation
  uuid: z.string().uuid('معرف غير صالح'),
  
  // Pagination validation
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    sortBy: z.enum(['name', 'created_at', 'size', 'type']).default('name'),
    sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('ASC')
  }),
  
  // Create folder request
  createFolder: z.object({
    name: z.string().min(1).max(255),
    parentId: z.string().uuid().nullable().optional()
  }),
  
  // Rename request
  rename: z.object({
    name: z.string().min(1).max(255)
  }),
  
  // Move request
  move: z.object({
    folderId: z.string().uuid().nullable().optional(),
    parentId: z.string().uuid().nullable().optional()
  }),
  
  // Search query
  search: z.object({
    q: z.string().min(1).max(100)
  }),
  
  // File IDs for ZIP
  fileIds: z.object({
    fileIds: z.array(z.string().uuid()).min(1).max(50)
  })
};

// Validation middleware factory
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const data = source === 'body' ? req.body : 
                   source === 'query' ? req.query : 
                   req.params;
      
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const errors = result.error.errors.map(e => e.message).join(', ');
        return res.status(400).json({ error: errors });
      }
      
      // Attach validated data
      req.validated = result.data;
      next();
    } catch (e) {
      logger.error('Validation error', e);
      res.status(400).json({ error: 'بيانات غير صالحة' });
    }
  };
};

// ============ SECURITY MIDDLEWARE ============

// Cookie parser (required for CSRF)
app.use(cookieParser());

// Additional security headers
app.use(security.securityHeaders());

// Helmet - Secure HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: IS_PRODUCTION ? undefined : false,
  hsts: IS_PRODUCTION ? { maxAge: 31536000, includeSubDomains: true } : false
}));

// Compression - gzip responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6, // Balanced compression level
  threshold: 1024 // Only compress responses > 1KB
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
  exposedHeaders: ['X-CSRF-Token']
}));

// Rate limiting - General API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_PRODUCTION ? 200 : 5000, // More lenient in development
  message: { error: 'تم تجاوز الحد المسموح من الطلبات، حاول لاحقاً' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ error: 'تم تجاوز الحد المسموح من الطلبات، حاول لاحقاً' });
  }
});

// Rate limiting - Upload (مرفوع للرفع الكثيف)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: IS_PRODUCTION ? 500 : 50000, // 50000 في التطوير للرفع الكثيف
  message: { error: 'تم تجاوز الحد المسموح من الرفع، حاول لاحقاً' },
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', { ip: req.ip });
    res.status(429).json({ error: 'تم تجاوز الحد المسموح من الرفع، حاول لاحقاً' });
  }
});

// Rate limiting - Download
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_PRODUCTION ? 200 : 2000,
  message: { error: 'تم تجاوز الحد المسموح من التحميل، حاول لاحقاً' }
});

// Apply rate limiters
app.use('/api/', apiLimiter);
app.use('/api/upload', uploadLimiter);
app.use('/api/download', downloadLimiter);
app.use('/api/download-file', downloadLimiter);

// Body parser with limits (رفع الحد لدعم الملفات الكبيرة)
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ extended: true, limit: '2gb' }));

// ============ SERVE STATIC FILES (Production) - EARLY ============
const clientBuildPath = path.join(__dirname, '../client/dist');
if (IS_PRODUCTION && fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  console.log('📦 Serving static files from:', clientBuildPath);
}

// زيادة timeout للملفات الكبيرة (30 دقيقة)
app.use((req, res, next) => {
  req.setTimeout(30 * 60 * 1000); // 30 minutes
  res.setTimeout(30 * 60 * 1000);
  next();
});

// ============ USER ROUTES (NEW MULTI-USER SYSTEM) ============
// Login rate limiter (more lenient in development)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_PRODUCTION ? 10 : 500, // 500 attempts in dev, 10 in production
  message: { error: 'تم تجاوز الحد المسموح من الطلبات، حاول لاحقاً' },
  skipSuccessfulRequests: true // Don't count successful logins
});

// Apply login limiter to auth routes
app.use('/api/users/login', loginLimiter);
app.use('/api/users/register', loginLimiter);

// Mount user routes
app.use('/api/users', userRoutes);

// Mount admin routes
app.use('/api/admin', adminRoutes);

// Mount auth routes (email verification, password reset, 2FA)
app.use('/api/auth', authRoutes);

// Mount notification routes
app.use('/api/notifications', notificationRoutes);

// Mount comments routes
app.use('/api/comments', commentsRoutes);

// Mount collections routes
app.use('/api/collections', collectionsRoutes);

// Mount versions routes
app.use('/api/versions', versionsRoutes);

// Mount chunked upload routes
app.use('/api/chunked', chunkedUploadRoutes);

// Mount security routes
app.use('/api/security', securityRoutes);

// Mount sharing routes
app.use('/api/sharing', users.authMiddleware, sharingRoutes);

// Mount teams routes
app.use('/api/teams', users.authMiddleware, teamsRoutes);

// Mount collaboration routes
app.use('/api/collaboration', users.authMiddleware, collaborationRoutes);

// Mount webhooks routes
app.use('/api/webhooks', users.authMiddleware, webhooksRoutes);

// Mount AI routes
app.use('/api/ai', aiRoutes);

// Mount Smart AI routes (المساعد الذكي)
app.use('/api/smart-ai', smartAIRoutes);

// ============ WEBDAV SUPPORT ============
// يسمح بربط التخزين كقرص شبكي في Windows/Mac/Linux
const { createWebDAVRouter, WEBDAV_METHODS } = require('./webdav');

// WebDAV Basic Auth middleware
const webdavAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Cloud Storage WebDAV"');
    return res.status(401).send('Authentication required');
  }
  
  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    const [username, password] = credentials.split(':');
    
    // التحقق من المستخدم بالإيميل أو اسم المستخدم
    let user = users.getUserByEmail(username);
    if (!user) {
      user = users.getUserByUsername(username);
    }
    
    if (!user) {
      console.log('WebDAV Auth: User not found:', username);
      res.set('WWW-Authenticate', 'Basic realm="Cloud Storage WebDAV"');
      return res.status(401).send('Invalid credentials');
    }
    
    // التحقق من كلمة المرور
    const bcrypt = require('bcryptjs');
    const passwordField = user.password || user.passwordHash;
    if (!bcrypt.compareSync(password, passwordField)) {
      console.log('WebDAV Auth: Wrong password for:', username);
      res.set('WWW-Authenticate', 'Basic realm="Cloud Storage WebDAV"');
      return res.status(401).send('Invalid credentials');
    }
    
    console.log('WebDAV Auth: Success for:', username);
    req.user = { userId: user.id, email: user.email };
    next();
  } catch (error) {
    console.error('WebDAV Auth Error:', error);
    res.set('WWW-Authenticate', 'Basic realm="Cloud Storage WebDAV"');
    res.status(401).send('Invalid credentials');
  }
};

// Mount WebDAV router (مع دعم Telegram للتخزين غير المحدود)
const webdavRouter = createWebDAVRouter(path.join(__dirname, 'uploads'), db, bot, CHANNEL_ID);
app.use('/webdav', webdavAuth, webdavRouter);

// Apply IP security middleware
app.use(ipSecurity.ipSecurityMiddleware({
  skipPaths: ['/health', '/api/health', '/api/users/login', '/api/users/register']
}));

// GET /api/auth/check - Check if authenticated (backward compatibility)
app.get('/api/auth/check', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const decoded = users.verifyAccessToken(token);
  res.json({ 
    authenticated: !!decoded,
    authEnabled: true,
    multiUser: true
  });
});

// Apply auth middleware to all protected routes
app.use('/api/files', users.authMiddleware);
app.use('/api/folders', users.authMiddleware);
app.use('/api/upload', users.authMiddleware);
app.use('/api/download', users.authMiddleware);
app.use('/api/download-file', users.authMiddleware);
app.use('/api/search', users.authMiddleware);
app.use('/api/storage', users.authMiddleware);
app.use('/api/all-folders', users.authMiddleware);
app.use('/api/rename', users.authMiddleware);
app.use('/api/move', users.authMiddleware);
app.use('/api/copy', users.authMiddleware);
app.use('/api/star', users.authMiddleware);
app.use('/api/starred', users.authMiddleware);
app.use('/api/trash', users.authMiddleware);
app.use('/api/restore', users.authMiddleware);
app.use('/api/share', users.authMiddleware);
app.use('/api/recent', users.authMiddleware);
app.use('/api/download-zip', users.authMiddleware);
app.use('/api/file-info', users.authMiddleware);

// ============ FILE UPLOAD SECURITY ============

// Allowed file types (MIME types)
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/ico',
  // Videos
  'video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/mkv', 'video/wmv', 'video/flv', 'video/x-msvideo', 'video/quicktime',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4', 'audio/x-m4a',
  // Documents
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript', 'application/json', 'application/xml',
  // Archives
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/gzip', 'application/x-tar'
];

// Blocked file extensions (dangerous executables only)
// ملاحظة: تم السماح بملفات الكود (.py, .js, etc) للمطورين
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.vbs', '.vbe', '.ws', '.wsf', '.wsc', '.wsh',
  '.ps1', '.psm1', '.psd1', '.ps1xml', '.pssc', '.cdxml',
  '.dll', '.sys', '.drv', '.ocx', '.cpl'
  // تم إزالة: .sh, .bash, .zsh, .fish, .php, .asp, .aspx, .jsp, .cgi, .pl, .py, .rb, .js, .jse
  // للسماح برفع ملفات الكود للمطورين
];

// Multer config with file size limit (2GB) and security checks
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    // Fix Arabic/Unicode filename encoding
    try {
      const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
      if (decoded && !decoded.includes('�')) {
        file.originalname = decoded;
      }
    } catch (e) {
      console.log('Filename encoding issue:', e);
    }
    cb(null, Date.now() + '-' + Math.random().toString(36).substring(2, 11));
  }
});

// File filter for security
const fileFilter = (req, file, cb) => {
  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return cb(new Error('نوع الملف غير مسموح به لأسباب أمنية'), false);
  }
  
  // Check MIME type (allow if in list or unknown for flexibility)
  const mimeType = file.mimetype.toLowerCase();
  if (ALLOWED_MIME_TYPES.includes(mimeType) || mimeType === 'application/octet-stream') {
    cb(null, true);
  } else {
    // Log unknown types but allow them (for flexibility)
    console.log('Unknown MIME type uploaded:', mimeType, file.originalname);
    cb(null, true);
  }
};

const upload = multer({
  storage,
  limits: { 
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB max
    files: 500 // Max 500 files per request
  },
  fileFilter
});

// Error handler for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'حجم الملف كبير جداً (الحد الأقصى 2GB)' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'عدد الملفات كبير جداً (الحد الأقصى 500)' });
    }
    return res.status(400).json({ error: 'خطأ في رفع الملف: ' + err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Helper: Validate folder/file name
function isValidName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.trim().length === 0 || name.length > 255) return false;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  return true;
}

// GET /api/files - List files and folders with pagination
app.get('/api/files', (req, res) => {
  try {
    // Validate pagination params
    const paginationResult = schemas.pagination.safeParse(req.query);
    const { page, limit, sortBy, sortOrder } = paginationResult.success 
      ? paginationResult.data 
      : { page: 1, limit: 50, sortBy: 'name', sortOrder: 'ASC' };
    
    const folderId = req.query.folderId;
    
    // Convert 'null' string or undefined to actual null
    const normalizedFolderId = (!folderId || folderId === 'null' || folderId === 'undefined') ? null : folderId;
    
    const userId = req.user?.userId;
    const foldersResult = db.getFolders(normalizedFolderId, { page: 1, limit: 1000, userId });
    const filesResult = db.getFiles(normalizedFolderId, { page, limit, sortBy, sortOrder, userId });
    
    logger.info('Files loaded', { 
      folderId: normalizedFolderId, 
      page, 
      filesCount: filesResult.files.length,
      foldersCount: foldersResult.folders.length 
    });
    
    res.json({
      folders: foldersResult.folders,
      files: filesResult.files,
      pagination: filesResult.pagination
    });
  } catch (e) {
    logger.error('Error listing files', e);
    res.status(500).json({ error: 'فشل في تحميل الملفات' });
  }
});

// GET /api/files/cursor - Cursor-based pagination (more efficient for large datasets)
app.get('/api/files/cursor', (req, res) => {
  try {
    const { cursor, limit = 50, sortBy = 'created_at', sortOrder = 'DESC', folderId } = req.query;
    const userId = req.user?.userId;
    const normalizedFolderId = (!folderId || folderId === 'null') ? null : folderId;
    
    // Build cursor query
    const { whereClause, params, orderClause } = performance.buildCursorQuery({
      cursor,
      sortField: sortBy === 'date' ? 'created_at' : sortBy,
      sortOrder,
      limit: parseInt(limit)
    });
    
    // Build full query
    let sql = 'SELECT * FROM files WHERE 1=1';
    const queryParams = [];
    
    if (normalizedFolderId === null) {
      sql += ' AND folder_id IS NULL';
    } else {
      sql += ' AND folder_id = ?';
      queryParams.push(normalizedFolderId);
    }
    
    if (userId) {
      sql += ' AND user_id = ?';
      queryParams.push(userId);
    }
    
    sql += ` ${whereClause} ${orderClause}`;
    queryParams.push(...params);
    
    // Execute query (using db module)
    const results = db.query ? db.query(sql, queryParams) : [];
    
    // Process results
    const { items, nextCursor, hasMore } = performance.processCursorResults(
      results.map(f => ({ ...f, starred: f.starred === 1, shared: f.shared === 1 })),
      parseInt(limit),
      sortBy === 'date' ? 'created_at' : sortBy
    );
    
    res.json({
      files: items,
      nextCursor,
      hasMore
    });
  } catch (e) {
    logger.error('Error with cursor pagination', e);
    res.status(500).json({ error: 'فشل في تحميل الملفات' });
  }
});

// GET /api/search - Simple search files and folders
app.get('/api/search', (req, res) => {
  try {
    const searchResult = schemas.search.safeParse(req.query);
    if (!searchResult.success) {
      return res.json({ folders: [], files: [] });
    }
    
    const query = searchResult.data.q.trim();
    const folders = db.searchFolders(query);
    const files = db.searchFiles(query);
    
    logger.info('Search performed', { query, resultsCount: folders.length + files.length });
    res.json({ folders, files });
  } catch (e) {
    logger.error('Error searching', e);
    res.status(500).json({ error: 'فشل في البحث' });
  }
});

// POST /api/search/advanced - Advanced search with filters
app.post('/api/search/advanced', (req, res) => {
  try {
    const {
      query,
      folderId,
      types,
      minSize,
      maxSize,
      dateFrom,
      dateTo,
      starred,
      shared,
      sortBy,
      sortOrder,
      page,
      limit
    } = req.body;

    const result = db.advancedSearch({
      query,
      userId: req.user?.userId,
      folderId,
      types,
      minSize,
      maxSize,
      dateFrom,
      dateTo,
      starred,
      shared,
      sortBy,
      sortOrder,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });

    // Also search folders if query provided
    let folders = [];
    if (query && query.trim()) {
      folders = db.searchFolders(query);
    }

    logger.info('Advanced search', { query, filters: { types, minSize, maxSize }, results: result.pagination.total });
    res.json({ ...result, folders });
  } catch (e) {
    logger.error('Error in advanced search', e);
    res.status(500).json({ error: 'فشل في البحث' });
  }
});

// GET /api/search/suggestions - Get search suggestions (autocomplete)
app.get('/api/search/suggestions', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = db.getSearchSuggestions(q, req.user?.userId, 10);
    res.json({ suggestions });
  } catch (e) {
    logger.error('Error getting suggestions', e);
    res.status(500).json({ error: 'فشل في جلب الاقتراحات' });
  }
});

// GET /api/search/stats - Get file type statistics
app.get('/api/search/stats', (req, res) => {
  try {
    const stats = db.getFileTypeStats(req.user?.userId);
    res.json({ stats });
  } catch (e) {
    logger.error('Error getting stats', e);
    res.status(500).json({ error: 'فشل في جلب الإحصائيات' });
  }
});

// ============ DUPLICATE FILES ============

// GET /api/duplicates - Get duplicate files
app.get('/api/duplicates', users.authMiddleware, (req, res) => {
  try {
    const result = db.getDuplicatesSummary(req.user?.userId);
    logger.info('Duplicates scan', { 
      userId: req.user?.userId, 
      groups: result.totalGroups,
      wastedSpace: result.totalWastedSpace 
    });
    res.json(result);
  } catch (e) {
    logger.error('Error finding duplicates', e);
    res.status(500).json({ error: 'فشل في البحث عن الملفات المكررة' });
  }
});

// DELETE /api/duplicates - Delete selected duplicate files
app.delete('/api/duplicates', users.authMiddleware, (req, res) => {
  try {
    const { fileIds } = req.body;
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد الملفات المراد حذفها' });
    }
    
    const result = db.deleteDuplicates(fileIds, req.user?.userId);
    
    logger.info('Duplicates deleted', { 
      userId: req.user?.userId, 
      deleted: result.deleted,
      freedSpace: result.freedSpace 
    });
    
    res.json({ 
      success: true, 
      ...result,
      message: `تم حذف ${result.deleted} ملف وتوفير ${formatBytes(result.freedSpace)}`
    });
  } catch (e) {
    logger.error('Error deleting duplicates', e);
    res.status(500).json({ error: 'فشل في حذف الملفات المكررة' });
  }
});

// Helper function for formatting bytes
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============ STORAGE ANALYTICS ============

// GET /api/storage/analytics - Get storage analytics
app.get('/api/storage/analytics', users.authMiddleware, (req, res) => {
  try {
    const report = db.getFullStorageReport(req.user?.userId);
    logger.info('Storage analytics requested', { userId: req.user?.userId });
    res.json(report);
  } catch (e) {
    logger.error('Error getting storage analytics', e);
    res.status(500).json({ error: 'فشل في تحميل تحليلات التخزين' });
  }
});

// GET /api/storage/largest - Get largest files
app.get('/api/storage/largest', users.authMiddleware, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const files = db.getLargestFiles(req.user?.userId, limit);
    res.json({ files });
  } catch (e) {
    logger.error('Error getting largest files', e);
    res.status(500).json({ error: 'فشل في تحميل أكبر الملفات' });
  }
});

// GET /api/storage/unused - Get unused files
app.get('/api/storage/unused', users.authMiddleware, (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 50;
    const files = db.getUnusedFiles(req.user?.userId, days, limit);
    res.json({ files, days });
  } catch (e) {
    logger.error('Error getting unused files', e);
    res.status(500).json({ error: 'فشل في تحميل الملفات غير المستخدمة' });
  }
});

// DELETE /api/storage/cleanup - Delete unused files
app.delete('/api/storage/cleanup', users.authMiddleware, (req, res) => {
  try {
    const { fileIds } = req.body;
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد الملفات المراد حذفها' });
    }
    
    let deleted = 0;
    let freedSpace = 0;
    
    for (const fileId of fileIds) {
      const file = db.getFileById(fileId);
      if (file && file.user_id === req.user?.userId) {
        freedSpace += file.size || 0;
        db.deleteFile(fileId);
        deleted++;
      }
    }
    
    logger.info('Storage cleanup', { userId: req.user?.userId, deleted, freedSpace });
    
    res.json({ 
      success: true, 
      deleted, 
      freedSpace,
      message: `تم حذف ${deleted} ملف وتوفير ${formatBytes(freedSpace)}`
    });
  } catch (e) {
    logger.error('Error cleaning up storage', e);
    res.status(500).json({ error: 'فشل في تنظيف التخزين' });
  }
});

// ============ TAGS SYSTEM ============

// GET /api/tags - Get all tags
app.get('/api/tags', users.authMiddleware, (req, res) => {
  try {
    const tags = db.getTags(req.user.userId);
    res.json({ tags });
  } catch (e) {
    logger.error('Error getting tags', e);
    res.status(500).json({ error: 'فشل في تحميل الوسوم' });
  }
});

// POST /api/tags - Create tag
app.post('/api/tags', users.authMiddleware, (req, res) => {
  try {
    const { name, color } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'اسم الوسم مطلوب' });
    }
    
    if (name.trim().length > 50) {
      return res.status(400).json({ error: 'اسم الوسم طويل جداً' });
    }
    
    const tag = db.createTag(name, color, req.user.userId);
    logger.info('Tag created', { tag, userId: req.user.userId });
    res.json({ success: true, tag });
  } catch (e) {
    logger.error('Error creating tag', e);
    res.status(400).json({ error: e.message || 'فشل في إنشاء الوسم' });
  }
});

// PATCH /api/tags/:id - Update tag
app.patch('/api/tags/:id', users.authMiddleware, (req, res) => {
  try {
    const { name, color } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'اسم الوسم مطلوب' });
    }
    
    const tag = db.updateTag(req.params.id, name, color, req.user.userId);
    res.json({ success: true, tag });
  } catch (e) {
    logger.error('Error updating tag', e);
    res.status(400).json({ error: e.message || 'فشل في تحديث الوسم' });
  }
});

// DELETE /api/tags/:id - Delete tag
app.delete('/api/tags/:id', users.authMiddleware, (req, res) => {
  try {
    db.deleteTag(req.params.id, req.user.userId);
    res.json({ success: true });
  } catch (e) {
    logger.error('Error deleting tag', e);
    res.status(400).json({ error: e.message || 'فشل في حذف الوسم' });
  }
});

// GET /api/tags/:id/files - Get files by tag
app.get('/api/tags/:id/files', users.authMiddleware, (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = db.getFilesByTag(req.params.id, req.user.userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });
    res.json(result);
  } catch (e) {
    logger.error('Error getting files by tag', e);
    res.status(500).json({ error: 'فشل في تحميل الملفات' });
  }
});

// POST /api/files/:id/tags - Add tag to file
app.post('/api/files/:id/tags', users.authMiddleware, (req, res) => {
  try {
    const { tagId } = req.body;
    
    if (!tagId) {
      return res.status(400).json({ error: 'معرف الوسم مطلوب' });
    }
    
    db.addTagToFile(req.params.id, tagId, req.user.userId);
    const tags = db.getFileTags(req.params.id);
    res.json({ success: true, tags });
  } catch (e) {
    logger.error('Error adding tag to file', e);
    res.status(400).json({ error: e.message || 'فشل في إضافة الوسم' });
  }
});

// DELETE /api/files/:id/tags/:tagId - Remove tag from file
app.delete('/api/files/:id/tags/:tagId', users.authMiddleware, (req, res) => {
  try {
    db.removeTagFromFile(req.params.id, req.params.tagId);
    const tags = db.getFileTags(req.params.id);
    res.json({ success: true, tags });
  } catch (e) {
    logger.error('Error removing tag from file', e);
    res.status(400).json({ error: 'فشل في إزالة الوسم' });
  }
});

// GET /api/files/:id/tags - Get file tags
app.get('/api/files/:id/tags', users.authMiddleware, (req, res) => {
  try {
    const tags = db.getFileTags(req.params.id);
    res.json({ tags });
  } catch (e) {
    logger.error('Error getting file tags', e);
    res.status(500).json({ error: 'فشل في تحميل الوسوم' });
  }
});

// POST /api/tags/:id/bulk - Bulk tag files
app.post('/api/tags/:id/bulk', users.authMiddleware, (req, res) => {
  try {
    const { fileIds } = req.body;
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد الملفات' });
    }
    
    const result = db.bulkTagFiles(fileIds, req.params.id, req.user.userId);
    res.json({ success: true, ...result });
  } catch (e) {
    logger.error('Error bulk tagging', e);
    res.status(400).json({ error: e.message || 'فشل في إضافة الوسوم' });
  }
});

// POST /api/folders - Create folder
app.post('/api/folders', validate(schemas.createFolder), (req, res) => {
  try {
    const { name, parentId } = req.validated;
    
    // Additional validation
    const nameValidation = schemas.folderName.safeParse(name);
    if (!nameValidation.success) {
      return res.status(400).json({ error: nameValidation.error.errors[0].message });
    }
    
    const id = uuidv4();
    const userId = req.user?.userId;
    db.createFolder(id, name.trim(), parentId || null, new Date().toISOString(), userId);
    
    logger.info('Folder created', { id, name: name.trim(), parentId, userId });
    res.json({ id, name: name.trim() });
  } catch (e) {
    logger.error('Error creating folder', e);
    res.status(500).json({ error: 'فشل في إنشاء المجلد' });
  }
});


// ============ TELEGRAM UPLOAD QUEUE SYSTEM ============
// نظام Queue لتنظيم الرفع وتجنب Rate Limit
class TelegramUploadQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastRequestTime = 0;
    this.minDelay = 100; // 100ms بين كل طلب كحد أدنى
    this.concurrentUploads = 0;
    this.maxConcurrent = 2; // أقصى عدد رفع متزامن
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.concurrentUploads >= this.maxConcurrent) return;
    if (this.queue.length === 0) return;

    const { task, resolve, reject } = this.queue.shift();
    this.concurrentUploads++;

    // تأخير بسيط بين الطلبات
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelay) {
      await new Promise(r => setTimeout(r, this.minDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    try {
      const result = await task();
      resolve(result);
    } catch (e) {
      reject(e);
    } finally {
      this.concurrentUploads--;
      // معالجة العنصر التالي
      if (this.queue.length > 0) {
        setImmediate(() => this.process());
      }
    }
  }
}

const uploadQueue = new TelegramUploadQueue();

// ============ TELEGRAM UPLOAD WITH RETRY ============
async function uploadToTelegramWithRetry(filePath, filename, maxRetries = 5) {
  return uploadQueue.add(async () => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await bot.telegram.sendDocument(CHANNEL_ID, {
          source: filePath,
          filename: filename
        });
        return result;
      } catch (e) {
        lastError = e;
        
        // Check if it's a rate limit error
        if (e.message && e.message.includes('429')) {
          // Extract retry_after from error message
          const match = e.message.match(/retry after (\d+)/i);
          const retryAfter = match ? parseInt(match[1]) : attempt * 3;
          
          logger.warn('Telegram rate limit hit, waiting...', { 
            attempt, 
            retryAfter, 
            filename 
          });
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, (retryAfter + 1) * 1000));
        } else {
          // For other errors, shorter wait
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }
    
    throw lastError;
  });
}

// POST /api/upload - Upload file
app.post('/api/upload', upload.single('file'), handleMulterError, async (req, res) => {
  const startTime = Date.now();
  let filePath = null;
  
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'لم يتم اختيار ملف' });
    }
    
    // Log file info
    logger.info('File upload started', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    filePath = path.join(__dirname, '..', file.path);
    
    // Use retry mechanism for Telegram upload
    const result = await uploadToTelegramWithRetry(filePath, file.originalname);
    
    const id = uuidv4();
    const userId = req.user?.userId;
    db.createFile({
      id,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      telegram_file_id: result.document.file_id,
      telegram_message_id: result.message_id,
      folder_id: req.body.folderId || null,
      user_id: userId,
      created_at: new Date().toISOString()
    });
    
    // Clean up temp file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    const duration = Date.now() - startTime;
    logger.info('File uploaded successfully', { 
      id, 
      name: file.originalname, 
      size: file.size,
      duration: `${duration}ms`
    });
    
    res.json({ id, name: file.originalname, size: file.size, type: file.mimetype });
  } catch (e) {
    // Clean up temp file on error
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    
    logger.error('Upload error', e, { filename: req.file?.originalname });
    res.status(500).json({ error: 'فشل في رفع الملف: ' + e.message });
  }
});

// GET /api/download/:id - Get download link (for preview)
app.get('/api/download/:id', async (req, res) => {
  try {
    const file = db.getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'الملف غير موجود' });
    const link = await bot.telegram.getFileLink(file.telegram_file_id);
    res.json({ url: link.href, name: file.name });
  } catch (e) {
    console.error('Download error:', e);
    res.status(500).json({ error: 'فشل في تحميل الملف' });
  }
});

// GET /api/thumbnail/:id - Get cached thumbnail
app.get('/api/thumbnail/:id', async (req, res) => {
  try {
    const file = db.getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'الملف غير موجود' });
    
    // Only for images
    if (!file.type?.startsWith('image/')) {
      return res.status(400).json({ error: 'ليس ملف صورة' });
    }
    
    // Check cache first
    const cached = performance.getCachedThumbnail(file.telegram_file_id);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Content-Type', file.type);
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
      return res.send(cached);
    }
    
    // Fetch from Telegram
    const link = await bot.telegram.getFileLink(file.telegram_file_id);
    
    // Download and cache
    const protocol = link.href.startsWith('https') ? https : http;
    protocol.get(link.href, (response) => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        // Cache the thumbnail
        performance.cacheThumbnail(file.telegram_file_id, buffer, file.type);
        
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Content-Type', file.type);
        res.setHeader('Cache-Control', 'public, max-age=604800');
        res.send(buffer);
      });
    }).on('error', (err) => {
      console.error('Thumbnail fetch error:', err);
      res.status(500).json({ error: 'فشل في تحميل الصورة المصغرة' });
    });
  } catch (e) {
    console.error('Thumbnail error:', e);
    res.status(500).json({ error: 'فشل في تحميل الصورة المصغرة' });
  }
});

// GET /api/download-file/:id - Download file with correct name
app.get('/api/download-file/:id', async (req, res) => {
  try {
    const file = db.getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'الملف غير موجود' });
    
    const link = await bot.telegram.getFileLink(file.telegram_file_id);
    const fileUrl = link.href;
    
    // Get filename with extension
    let filename = file.name;
    
    // If filename doesn't have extension, add it based on mime type
    if (!filename.includes('.')) {
      const mimeToExt = {
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'application/vnd.ms-powerpoint': '.ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'audio/mpeg': '.mp3',
        'audio/wav': '.wav',
        'text/plain': '.txt',
        'application/zip': '.zip',
        'application/x-rar-compressed': '.rar'
      };
      const ext = mimeToExt[file.type] || '';
      filename = filename + ext;
    }
    
    // Set headers for download with correct filename
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', file.type || 'application/octet-stream');
    
    // Pipe the file from Telegram to response
    const protocol = fileUrl.startsWith('https') ? https : http;
    protocol.get(fileUrl, (fileResponse) => {
      if (fileResponse.headers['content-length']) {
        res.setHeader('Content-Length', fileResponse.headers['content-length']);
      }
      fileResponse.pipe(res);
    }).on('error', (err) => {
      console.error('Download stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'فشل في تحميل الملف' });
      }
    });
  } catch (e) {
    console.error('Download error:', e);
    res.status(500).json({ error: 'فشل في تحميل الملف' });
  }
});

// PATCH /api/rename/file/:id - Rename file
app.patch('/api/rename/file/:id', (req, res) => {
  try {
    const { name } = req.body;
    if (!isValidName(name)) {
      return res.status(400).json({ error: 'الاسم غير صالح' });
    }
    db.updateFileName(req.params.id, name.trim());
    res.json({ success: true });
  } catch (e) {
    console.error('Rename error:', e);
    res.status(500).json({ error: 'فشل في إعادة التسمية' });
  }
});

// PATCH /api/rename/folder/:id - Rename folder
app.patch('/api/rename/folder/:id', (req, res) => {
  try {
    const { name } = req.body;
    if (!isValidName(name)) {
      return res.status(400).json({ error: 'الاسم غير صالح' });
    }
    db.updateFolderName(req.params.id, name.trim());
    res.json({ success: true });
  } catch (e) {
    console.error('Rename error:', e);
    res.status(500).json({ error: 'فشل في إعادة التسمية' });
  }
});

// DELETE /api/files/:id - Delete file
app.delete('/api/files/:id', (req, res) => {
  try {
    db.deleteFile(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error('Delete error:', e);
    res.status(500).json({ error: 'فشل في حذف الملف' });
  }
});

// DELETE /api/folders/:id - Delete folder (recursive)
app.delete('/api/folders/:id', (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user?.userId;
    // Recursive delete function
    const deleteRecursive = (folderId) => {
      // Get subfolders - use folders array from result object
      const result = db.getFolders(folderId, { page: 1, limit: 1000, userId });
      const subfolders = result.folders || result;
      for (const sub of subfolders) {
        deleteRecursive(sub.id);
      }
      // Delete files in folder
      db.deleteFilesByFolder(folderId);
      // Delete folder
      db.deleteFolder(folderId);
    };
    deleteRecursive(id);
    res.json({ success: true });
  } catch (e) {
    console.error('Delete error:', e);
    res.status(500).json({ error: 'فشل في حذف المجلد' });
  }
});

// GET /api/storage - Get storage usage
app.get('/api/storage', (req, res) => {
  try {
    const total = db.getTotalSize();
    res.json({ used: total });
  } catch (e) {
    console.error('Storage error:', e);
    res.status(500).json({ error: 'فشل في حساب التخزين' });
  }
});

// GET /api/all-folders - Get all folders for move/copy dialog
app.get('/api/all-folders', (req, res) => {
  try {
    const userId = req.user?.userId;
    const folders = db.getAllFolders(userId);
    res.json({ folders });
  } catch (e) {
    console.error('Error getting folders:', e);
    res.status(500).json({ error: 'فشل في تحميل المجلدات' });
  }
});

// PATCH /api/move/file/:id - Move file to another folder
app.patch('/api/move/file/:id', (req, res) => {
  try {
    const { folderId } = req.body;
    db.updateFileFolder(req.params.id, folderId || null);
    res.json({ success: true });
  } catch (e) {
    console.error('Move error:', e);
    res.status(500).json({ error: 'فشل في نقل الملف' });
  }
});

// PATCH /api/move/folder/:id - Move folder to another folder
app.patch('/api/move/folder/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { parentId } = req.body;
    
    // Prevent moving folder into itself
    if (id === parentId) {
      return res.status(400).json({ error: 'لا يمكن نقل المجلد إلى نفسه' });
    }
    
    db.updateFolderParent(id, parentId || null);
    res.json({ success: true });
  } catch (e) {
    console.error('Move error:', e);
    res.status(500).json({ error: 'فشل في نقل المجلد' });
  }
});

// POST /api/copy/file/:id - Copy file
app.post('/api/copy/file/:id', (req, res) => {
  try {
    const original = db.getFileById(req.params.id);
    if (!original) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    
    const newId = uuidv4();
    const { folderId } = req.body;
    const copyName = `نسخة من ${original.name}`;
    const userId = req.user?.userId;
    
    db.createFile({
      id: newId,
      name: copyName,
      size: original.size,
      type: original.type,
      telegram_file_id: original.telegram_file_id,
      telegram_message_id: original.telegram_message_id,
      folder_id: folderId || null,
      user_id: userId,
      created_at: new Date().toISOString()
    });
    
    res.json({ id: newId, name: copyName });
  } catch (e) {
    console.error('Copy error:', e);
    res.status(500).json({ error: 'فشل في نسخ الملف' });
  }
});


// ============ STARRED FILES ============

// PATCH /api/star/:id - Toggle star on file
app.patch('/api/star/:id', (req, res) => {
  try {
    const starred = db.toggleStar(req.params.id);
    if (starred === null) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    res.json({ success: true, starred });
  } catch (e) {
    console.error('Star error:', e);
    res.status(500).json({ error: 'فشل في تحديث المفضلة' });
  }
});

// GET /api/starred - Get starred files
app.get('/api/starred', (req, res) => {
  try {
    const userId = req.user?.userId;
    const files = db.getStarredFiles(userId);
    res.json({ files });
  } catch (e) {
    console.error('Starred error:', e);
    res.status(500).json({ error: 'فشل في تحميل المفضلة' });
  }
});

// ============ TRASH ============

// POST /api/trash/file/:id - Move file to trash
app.post('/api/trash/file/:id', (req, res) => {
  try {
    const success = db.moveFileToTrash(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Trash error:', e);
    res.status(500).json({ error: 'فشل في نقل الملف للمحذوفات' });
  }
});

// POST /api/trash/folder/:id - Move folder to trash
app.post('/api/trash/folder/:id', (req, res) => {
  try {
    const success = db.moveFolderToTrash(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'المجلد غير موجود' });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Trash error:', e);
    res.status(500).json({ error: 'فشل في نقل المجلد للمحذوفات' });
  }
});

// GET /api/trash - Get trash items
app.get('/api/trash', (req, res) => {
  try {
    const userId = req.user?.userId;
    const items = db.getTrashItems(userId);
    res.json({ items });
  } catch (e) {
    console.error('Trash error:', e);
    res.status(500).json({ error: 'فشل في تحميل المحذوفات' });
  }
});

// POST /api/restore/:id - Restore from trash
app.post('/api/restore/:id', (req, res) => {
  try {
    const success = db.restoreFromTrash(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'العنصر غير موجود' });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Restore error:', e);
    res.status(500).json({ error: 'فشل في استعادة العنصر' });
  }
});

// DELETE /api/trash/:id - Permanently delete from trash
app.delete('/api/trash/:id', (req, res) => {
  try {
    db.deleteFromTrash(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error('Delete error:', e);
    res.status(500).json({ error: 'فشل في الحذف النهائي' });
  }
});

// DELETE /api/trash - Empty trash
app.delete('/api/trash', (req, res) => {
  try {
    db.emptyTrash();
    res.json({ success: true });
  } catch (e) {
    console.error('Empty trash error:', e);
    res.status(500).json({ error: 'فشل في تفريغ المحذوفات' });
  }
});

// ============ SHARE ============

// POST /api/share/file/:id - Create file share link
app.post('/api/share/file/:id', (req, res) => {
  try {
    const file = db.getFileById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    
    const { password, expiresIn, permissions } = req.body;
    const shareId = uuidv4().substring(0, 8);
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    
    db.shareFile(req.params.id, shareId, { password, expiresAt, permissions });
    
    // Notify if sharing with specific user
    if (req.body.sharedWithId) {
      notifications.notifyFileShared(req.body.sharedWithId, file.name, req.user.username);
    }
    
    res.json({ success: true, share_id: shareId, expiresAt });
  } catch (e) {
    console.error('Share error:', e);
    res.status(500).json({ error: 'فشل في إنشاء رابط المشاركة' });
  }
});

// POST /api/share/folder/:id - Create folder share link
app.post('/api/share/folder/:id', (req, res) => {
  try {
    const folder = db.getFolderById(req.params.id);
    if (!folder) {
      return res.status(404).json({ error: 'المجلد غير موجود' });
    }
    
    const { password, expiresIn, permissions, sharedWithId, sharedWithEmail } = req.body;
    const shareId = uuidv4().substring(0, 8);
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    
    db.shareFolder(req.params.id, shareId, { 
      password, 
      expiresAt, 
      permissions,
      ownerId: req.user.userId,
      sharedWithId,
      sharedWithEmail
    });
    
    // Notify if sharing with specific user
    if (sharedWithId) {
      notifications.notifyFolderShared(sharedWithId, folder.name, req.user.username);
    }
    
    res.json({ success: true, share_id: shareId, expiresAt });
  } catch (e) {
    console.error('Share folder error:', e);
    res.status(500).json({ error: 'فشل في مشاركة المجلد' });
  }
});

// DELETE /api/share/file/:id - Remove file share
app.delete('/api/share/file/:id', (req, res) => {
  try {
    db.unshareFile(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error('Unshare error:', e);
    res.status(500).json({ error: 'فشل في إلغاء المشاركة' });
  }
});

// DELETE /api/share/folder/:shareId - Remove folder share
app.delete('/api/share/folder/:shareId', (req, res) => {
  try {
    db.unshareFolder(req.params.shareId);
    res.json({ success: true });
  } catch (e) {
    console.error('Unshare folder error:', e);
    res.status(500).json({ error: 'فشل في إلغاء مشاركة المجلد' });
  }
});

// GET /api/s/:code - Access public share link (new advanced sharing)
app.get('/api/s/:code', (req, res) => {
  try {
    const advancedSharing = require('./advancedSharing');
    const result = advancedSharing.accessPublicLink(req.params.code, {
      password: req.query.password,
      email: req.query.email,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.requirePassword || result.requireEmail || result.requireLogin ? 401 : 404)
         .json(result);
    }
  } catch (e) {
    console.error('Public link error:', e);
    res.status(500).json({ error: 'فشل في الوصول للرابط' });
  }
});

// POST /api/s/:code/download - Record download from public link
app.post('/api/s/:code/download', (req, res) => {
  try {
    const advancedSharing = require('./advancedSharing');
    // First verify access
    const result = advancedSharing.accessPublicLink(req.params.code, {
      password: req.body.password,
      email: req.body.email
    });
    
    if (result.success && result.link) {
      advancedSharing.recordLinkDownload(result.link.id);
      res.json({ success: true });
    } else {
      res.status(403).json({ error: 'غير مسموح' });
    }
  } catch (e) {
    res.status(500).json({ error: 'فشل في تسجيل التحميل' });
  }
});

// GET /api/shared/file/:shareId - Get shared file (public)
app.get('/api/shared/file/:shareId', async (req, res) => {
  try {
    const file = db.getSharedFile(req.params.shareId);
    if (!file) {
      return res.status(404).json({ error: 'الرابط غير صالح أو منتهي' });
    }
    
    // Check password if required
    if (file.share_password && req.query.password !== file.share_password) {
      return res.status(401).json({ error: 'كلمة المرور مطلوبة', requiresPassword: true });
    }
    
    const link = await bot.telegram.getFileLink(file.telegram_file_id);
    res.json({ 
      name: file.name, 
      size: file.size, 
      type: file.type, 
      url: link.href,
      permissions: file.share_permissions
    });
  } catch (e) {
    console.error('Shared error:', e);
    res.status(500).json({ error: 'فشل في تحميل الملف المشارك' });
  }
});

// GET /api/shared/folder/:shareId - Get shared folder contents
app.get('/api/shared/folder/:shareId', (req, res) => {
  try {
    const result = db.getSharedFolder(req.params.shareId);
    if (!result) {
      return res.status(404).json({ error: 'الرابط غير صالح أو منتهي' });
    }
    
    // Get folder contents
    const folders = db.getFolders(result.id, { page: 1, limit: 1000 });
    const files = db.getFiles(result.id, { page: 1, limit: 1000 });
    
    res.json({
      folder: result,
      folders: folders.folders,
      files: files.files,
      permissions: result.share.permission
    });
  } catch (e) {
    console.error('Shared folder error:', e);
    res.status(500).json({ error: 'فشل في تحميل المجلد المشارك' });
  }
});

// GET /api/shared-with-me - Get items shared with current user
app.get('/api/shared-with-me', (req, res) => {
  try {
    const result = db.getSharedWithMe(req.user.userId);
    res.json(result);
  } catch (e) {
    console.error('Shared with me error:', e);
    res.status(500).json({ error: 'فشل في تحميل العناصر المشاركة' });
  }
});

// Backward compatibility
app.post('/api/share/:id', (req, res) => {
  req.params.id = req.params.id;
  return res.redirect(307, `/api/share/file/${req.params.id}`);
});

app.delete('/api/share/:id', (req, res) => {
  return res.redirect(307, `/api/share/file/${req.params.id}`);
});

// ============ RECENT FILES ============

// POST /api/recent/:id - Add to recent files
app.post('/api/recent/:id', (req, res) => {
  try {
    const userId = req.user?.userId;
    db.addToRecent(req.params.id, userId);
    res.json({ success: true });
  } catch (e) {
    console.error('Recent error:', e);
    res.status(500).json({ error: 'فشل في تحديث الملفات الأخيرة' });
  }
});

// GET /api/recent - Get recent files
app.get('/api/recent', (req, res) => {
  try {
    const userId = req.user?.userId;
    const files = db.getRecentFiles(userId);
    res.json({ files });
  } catch (e) {
    console.error('Recent error:', e);
    res.status(500).json({ error: 'فشل في تحميل الملفات الأخيرة' });
  }
});


// POST /api/download-zip - Download multiple files as ZIP
app.post('/api/download-zip', async (req, res) => {
  try {
    const { fileIds } = req.body;
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'لم يتم تحديد ملفات' });
    }

    const filesToDownload = fileIds
      .map(id => db.getFileById(id))
      .filter(f => f);

    if (filesToDownload.length === 0) {
      return res.status(404).json({ error: 'الملفات غير موجودة' });
    }

    // Set response headers for ZIP download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=files.zip');

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    // Download each file and add to archive
    for (const file of filesToDownload) {
      try {
        const link = await bot.telegram.getFileLink(file.telegram_file_id);
        const fileUrl = link.href;
        
        // Download file content
        const fileContent = await new Promise((resolve, reject) => {
          const protocol = fileUrl.startsWith('https') ? https : http;
          protocol.get(fileUrl, (response) => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
          }).on('error', reject);
        });

        archive.append(fileContent, { name: file.name });
      } catch (e) {
        console.error('Error adding file to zip:', file.name, e);
      }
    }

    await archive.finalize();
  } catch (e) {
    console.error('ZIP error:', e);
    if (!res.headersSent) {
      res.status(500).json({ error: 'فشل في إنشاء ملف ZIP' });
    }
  }
});

// GET /api/file-info/:id - Get file details
app.get('/api/file-info/:id', (req, res) => {
  try {
    const file = db.getFileById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    res.json({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type,
      created_at: file.created_at,
      starred: file.starred || false,
      shared: file.shared || false
    });
  } catch (e) {
    console.error('File info error:', e);
    res.status(500).json({ error: 'فشل في تحميل معلومات الملف' });
  }
});

// ============ SHARE PAGE ============

// Serve share page HTML
app.get('/share/:shareId', async (req, res) => {
  try {
    const file = db.getFileByShareId(req.params.shareId);
    if (!file) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>رابط غير صالح</title>
          <style>
            body { font-family: 'Cairo', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8f9fa; }
            .container { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            h1 { color: #d93025; margin-bottom: 16px; }
            p { color: #5f6368; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ رابط غير صالح</h1>
            <p>هذا الرابط غير موجود أو تم إلغاء المشاركة</p>
          </div>
        </body>
        </html>
      `);
    }

    const link = await bot.telegram.getFileLink(file.telegram_file_id);
    const formatSize = (bytes) => {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    res.send(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${file.name} - مشاركة ملف</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Cairo', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; }
          .container { text-align: center; padding: 40px; background: white; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; width: 100%; }
          .icon { font-size: 64px; margin-bottom: 20px; }
          h1 { color: #202124; margin-bottom: 8px; font-size: 24px; word-break: break-word; }
          .meta { color: #5f6368; margin-bottom: 24px; font-size: 14px; }
          .download-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 32px; background: #1a73e8; color: white; text-decoration: none; border-radius: 30px; font-size: 16px; font-weight: 600; transition: all 0.3s; }
          .download-btn:hover { background: #1557b0; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(26,115,232,0.4); }
          .preview { margin: 20px 0; max-width: 100%; border-radius: 12px; overflow: hidden; }
          .preview img, .preview video { max-width: 100%; max-height: 300px; object-fit: contain; }
          .footer { margin-top: 24px; color: #9aa0a6; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">${file.type?.startsWith('image/') ? '🖼️' : file.type?.startsWith('video/') ? '🎬' : file.type?.startsWith('audio/') ? '🎵' : '📄'}</div>
          <h1>${file.name}</h1>
          <p class="meta">${formatSize(file.size)} • ${file.type || 'ملف'}</p>
          ${file.type?.startsWith('image/') ? `<div class="preview"><img src="${link.href}" alt="${file.name}"></div>` : ''}
          ${file.type?.startsWith('video/') ? `<div class="preview"><video src="${link.href}" controls></video></div>` : ''}
          <a href="${link.href}" class="download-btn" download="${file.name}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            تحميل الملف
          </a>
          <p class="footer">تمت المشاركة عبر نظام التخزين السحابي ☁️</p>
        </div>
      </body>
      </html>
    `);
  } catch (e) {
    console.error('Share page error:', e);
    res.status(500).send('حدث خطأ');
  }
});

// ============ GLOBAL ERROR HANDLER ============
app.use((err, req, res, next) => {
  // Log the error
  logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Don't leak error details in production
  const message = IS_PRODUCTION ? 'حدث خطأ في الخادم' : err.message;
  const status = err.status || err.statusCode || 500;
  
  res.status(status).json({ 
    error: message,
    ...(IS_PRODUCTION ? {} : { stack: err.stack })
  });
});

// ============ 404 HANDLER ============
app.use((req, res) => {
  logger.warn('404 Not Found', { method: req.method, path: req.path });
  res.status(404).json({ error: 'المسار غير موجود' });
});

// ============ CSRF TOKEN ENDPOINT ============
app.get('/api/csrf-token', (req, res) => {
  const token = security.generateCSRFToken();
  res.cookie('_csrf', token, {
    httpOnly: false, // Must be readable by JS
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });
  res.json({ csrfToken: token });
});

// ============ SECURITY INFO ENDPOINT ============
app.get('/api/security/password-policy', (req, res) => {
  res.json({
    policy: security.PASSWORD_POLICY,
    requirements: [
      `الحد الأدنى للطول: ${security.PASSWORD_POLICY.minLength} أحرف`,
      'يجب أن تحتوي على حرف كبير (A-Z)',
      'يجب أن تحتوي على حرف صغير (a-z)',
      'يجب أن تحتوي على رقم (0-9)',
      `يجب أن تحتوي على رمز خاص (${security.PASSWORD_POLICY.specialChars})`
    ]
  });
});

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    security: {
      helmet: true,
      rateLimit: true,
      csrf: true,
      cors: true
    },
    performance: {
      thumbnailCache: performance.getThumbnailCacheStats(),
      compression: 'brotli+gzip'
    }
  });
});

// GET /api/performance/stats - Performance statistics
app.get('/api/performance/stats', users.authMiddleware, (req, res) => {
  res.json({
    thumbnailCache: performance.getThumbnailCacheStats(),
    cache: cacheManager.getAllStats(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// GET /api/cache/stats - Cache statistics
app.get('/api/cache/stats', users.authMiddleware, (req, res) => {
  res.json(cacheManager.getAllStats());
});

// POST /api/cache/clear - Clear cache (admin only)
app.post('/api/cache/clear', users.authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'غير مصرح' });
  }
  
  const { type } = req.body;
  if (type) {
    cacheManager.invalidate(type);
  } else {
    cacheManager.clearAll();
  }
  
  res.json({ success: true, message: 'تم مسح الذاكرة المؤقتة' });
});

// ============ CATCH-ALL FOR REACT ROUTING (Production) ============
if (IS_PRODUCTION) {
  const clientPath = path.join(__dirname, '../client/dist');
  
  // Handle React routing - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/health') || req.path.startsWith('/metrics') || req.path.startsWith('/api-docs')) {
      return next();
    }
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// ============ START SERVER ============
db.initDB().then(async () => {
  // Initialize multi-user system
  await users.initUsers();
  
  // Auto-assign orphan files to admin (files without user_id)
  const adminUser = users.getUserByUsername('admin');
  if (adminUser) {
    const result = db.assignOrphanFilesToUser(adminUser.id);
    if (result.files > 0 || result.folders > 0 || result.trash > 0) {
      console.log(`✅ Auto-assigned orphan items to admin: ${result.files} files, ${result.folders} folders, ${result.trash} trash`);
    }
  }
  
  const server = app.listen(PORT, () => {
    logger.info('Server started', {
      port: PORT,
      environment: IS_PRODUCTION ? 'production' : 'development',
      nodeVersion: process.version,
      multiUserEnabled: true
    });
    
    console.log('');
    console.log('🚀 Server running on http://localhost:' + PORT);
    console.log('📊 Health check: http://localhost:' + PORT + '/health');
    console.log('🔒 Security: Helmet, Rate Limiting, Compression, Validation');
    console.log('👥 Multi-User System: ENABLED');
    console.log('📝 Logs directory:', logsDir);
    console.log('🔔 WebSocket: ENABLED for real-time notifications');
    console.log('');
    console.log('📌 Default login: admin / admin123');
    console.log('');
  });
  
  // ============ WEBSOCKET SERVER ============
  const wss = new WebSocketServer({ server, path: '/ws' });
  const collaboration = require('./collaboration');
  
  wss.on('connection', (ws, req) => {
    let userId = null;
    let username = null;
    let currentFileId = null;
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        // Handle authentication
        if (data.type === 'auth') {
          const decoded = users.verifyAccessToken(data.token);
          if (decoded) {
            userId = decoded.userId;
            username = decoded.username;
            notifications.registerConnection(userId, ws);
            collaboration.registerUserConnection(userId, ws);
            ws.send(JSON.stringify({ type: 'auth', success: true }));
            logger.info('WebSocket authenticated', { userId });
          } else {
            ws.send(JSON.stringify({ type: 'auth', success: false, error: 'Invalid token' }));
          }
        }
        
        // Handle ping
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
        
        // Handle file join (presence)
        if (data.type === 'join_file' && userId) {
          if (currentFileId) {
            collaboration.leaveFile(currentFileId, userId);
          }
          currentFileId = data.fileId;
          const result = collaboration.joinFile(data.fileId, userId, username, ws);
          ws.send(JSON.stringify({ type: 'joined_file', ...result }));
        }
        
        // Handle file leave
        if (data.type === 'leave_file' && userId && currentFileId) {
          collaboration.leaveFile(currentFileId, userId);
          currentFileId = null;
          ws.send(JSON.stringify({ type: 'left_file' }));
        }
        
        // Handle cursor update
        if (data.type === 'cursor_update' && userId && currentFileId) {
          collaboration.updateCursor(currentFileId, userId, username, data.position, data.selection);
        }
        
        // Handle activity heartbeat
        if (data.type === 'heartbeat' && userId && currentFileId) {
          collaboration.updateActivity(currentFileId, userId);
        }
        
        // Handle live comment
        if (data.type === 'live_comment' && userId && currentFileId) {
          collaboration.addLiveComment({
            fileId: currentFileId,
            userId,
            username,
            content: data.content,
            position: data.position,
            parentId: data.parentId
          });
        }
        
        // Handle mention
        if (data.type === 'mention' && userId) {
          collaboration.createMention({
            fileId: data.fileId,
            fileName: data.fileName,
            mentionedUserId: data.mentionedUserId,
            mentionedUsername: data.mentionedUsername,
            mentionedBy: userId,
            mentionedByName: username,
            context: data.context,
            position: data.position
          });
        }
      } catch (e) {
        logger.error('WebSocket message error', e);
      }
    });
    
    ws.on('close', () => {
      if (userId) {
        notifications.unregisterConnection(userId, ws);
        collaboration.unregisterUserConnection(userId, ws);
        if (currentFileId) {
          collaboration.leaveFile(currentFileId, userId);
        }
        logger.info('WebSocket disconnected', { userId });
      }
    });
    
    ws.on('error', (error) => {
      logger.error('WebSocket error', error);
    });
  });
  
  console.log('✅ WebSocket server initialized on /ws');
  
  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
      logger.info('HTTP server closed');
      db.closeDB();
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
}).catch(err => {
  logger.error('Failed to initialize database', err);
  process.exit(1);
});
