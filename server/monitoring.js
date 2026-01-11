/**
 * Monitoring Module - Prometheus Metrics
 * وحدة المراقبة - مقاييس Prometheus
 */

const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// ============ CUSTOM METRICS ============

// HTTP Request metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5]
});
register.registerMetric(httpRequestDuration);

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestTotal);

// Active connections
const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});
register.registerMetric(activeConnections);

// File operations metrics
const fileUploadsTotal = new client.Counter({
  name: 'file_uploads_total',
  help: 'Total number of file uploads',
  labelNames: ['status']
});
register.registerMetric(fileUploadsTotal);

const fileDownloadsTotal = new client.Counter({
  name: 'file_downloads_total',
  help: 'Total number of file downloads',
  labelNames: ['status']
});
register.registerMetric(fileDownloadsTotal);

const fileUploadSize = new client.Histogram({
  name: 'file_upload_size_bytes',
  help: 'Size of uploaded files in bytes',
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600, 1073741824] // 1KB to 1GB
});
register.registerMetric(fileUploadSize);

// Storage metrics
const storageUsedBytes = new client.Gauge({
  name: 'storage_used_bytes',
  help: 'Total storage used in bytes'
});
register.registerMetric(storageUsedBytes);

const totalFiles = new client.Gauge({
  name: 'total_files',
  help: 'Total number of files'
});
register.registerMetric(totalFiles);

const totalFolders = new client.Gauge({
  name: 'total_folders',
  help: 'Total number of folders'
});
register.registerMetric(totalFolders);

// User metrics
const activeUsers = new client.Gauge({
  name: 'active_users',
  help: 'Number of active users'
});
register.registerMetric(activeUsers);

const totalUsers = new client.Gauge({
  name: 'total_users',
  help: 'Total number of registered users'
});
register.registerMetric(totalUsers);

const loginAttemptsTotal = new client.Counter({
  name: 'login_attempts_total',
  help: 'Total login attempts',
  labelNames: ['status'] // success, failed, locked
});
register.registerMetric(loginAttemptsTotal);

// Database metrics
const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});
register.registerMetric(dbQueryDuration);

const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits'
});
register.registerMetric(cacheHits);

const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses'
});
register.registerMetric(cacheMisses);

// Telegram API metrics
const telegramApiCalls = new client.Counter({
  name: 'telegram_api_calls_total',
  help: 'Total Telegram API calls',
  labelNames: ['method', 'status']
});
register.registerMetric(telegramApiCalls);

const telegramApiDuration = new client.Histogram({
  name: 'telegram_api_duration_seconds',
  help: 'Duration of Telegram API calls',
  labelNames: ['method'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});
register.registerMetric(telegramApiDuration);

// Error metrics
const errorsTotal = new client.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code']
});
register.registerMetric(errorsTotal);

// ============ MIDDLEWARE ============

/**
 * Express middleware to track HTTP metrics
 */
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  // Track active connections
  activeConnections.inc();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode
    };
    
    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
    activeConnections.dec();
  });
  
  next();
}

/**
 * Metrics endpoint handler
 */
async function metricsHandler(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (e) {
    res.status(500).end(e.message);
  }
}

// ============ HELPER FUNCTIONS ============

function recordFileUpload(status, size) {
  fileUploadsTotal.inc({ status });
  if (status === 'success' && size) {
    fileUploadSize.observe(size);
  }
}

function recordFileDownload(status) {
  fileDownloadsTotal.inc({ status });
}

function recordLoginAttempt(status) {
  loginAttemptsTotal.inc({ status });
}

function recordError(type, code) {
  errorsTotal.inc({ type, code: code || 'unknown' });
}

function recordTelegramCall(method, status, duration) {
  telegramApiCalls.inc({ method, status });
  if (duration) {
    telegramApiDuration.observe({ method }, duration / 1000);
  }
}

function recordDbQuery(operation, duration) {
  dbQueryDuration.observe({ operation }, duration / 1000);
}

function recordCacheHit() {
  cacheHits.inc();
}

function recordCacheMiss() {
  cacheMisses.inc();
}

function updateStorageMetrics(stats) {
  if (stats.totalSize !== undefined) storageUsedBytes.set(stats.totalSize);
  if (stats.files !== undefined) totalFiles.set(stats.files);
  if (stats.folders !== undefined) totalFolders.set(stats.folders);
}

function updateUserMetrics(stats) {
  if (stats.total !== undefined) totalUsers.set(stats.total);
  if (stats.active !== undefined) activeUsers.set(stats.active);
}

// ============ SETUP ============

function setupMonitoring(app) {
  // Add metrics middleware
  app.use(metricsMiddleware);
  
  // Metrics endpoint
  app.get('/metrics', metricsHandler);
  
  console.log('📊 Prometheus metrics available at /metrics');
}

module.exports = {
  register,
  setupMonitoring,
  metricsMiddleware,
  metricsHandler,
  
  // Recording functions
  recordFileUpload,
  recordFileDownload,
  recordLoginAttempt,
  recordError,
  recordTelegramCall,
  recordDbQuery,
  recordCacheHit,
  recordCacheMiss,
  updateStorageMetrics,
  updateUserMetrics
};
