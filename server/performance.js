/**
 * Performance Optimizations Module
 * تحسينات الأداء
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============ THUMBNAIL CACHE ============
const THUMBNAIL_CACHE_DIR = path.join(__dirname, 'cache', 'thumbnails');
const THUMBNAIL_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const THUMBNAIL_MAX_SIZE = 500; // Max cached thumbnails

// Ensure cache directory exists
if (!fs.existsSync(THUMBNAIL_CACHE_DIR)) {
  fs.mkdirSync(THUMBNAIL_CACHE_DIR, { recursive: true });
}

// In-memory index for fast lookup
const thumbnailIndex = new Map();

/**
 * Initialize thumbnail cache from disk
 */
function initThumbnailCache() {
  try {
    const files = fs.readdirSync(THUMBNAIL_CACHE_DIR);
    files.forEach(file => {
      const filePath = path.join(THUMBNAIL_CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      const fileId = path.basename(file, path.extname(file));
      
      thumbnailIndex.set(fileId, {
        path: filePath,
        size: stats.size,
        mtime: stats.mtime.getTime()
      });
    });
    
    console.log(`✅ Thumbnail cache initialized (${thumbnailIndex.size} items)`);
    
    // Clean old thumbnails
    cleanOldThumbnails();
  } catch (e) {
    console.error('Error initializing thumbnail cache:', e);
  }
}

/**
 * Get cached thumbnail
 * @param {string} fileId - Telegram file ID
 * @returns {Buffer|null}
 */
function getCachedThumbnail(fileId) {
  const hash = hashFileId(fileId);
  const cached = thumbnailIndex.get(hash);
  
  if (!cached) return null;
  
  // Check if expired
  if (Date.now() - cached.mtime > THUMBNAIL_MAX_AGE) {
    deleteCachedThumbnail(hash);
    return null;
  }
  
  try {
    return fs.readFileSync(cached.path);
  } catch (e) {
    thumbnailIndex.delete(hash);
    return null;
  }
}

/**
 * Save thumbnail to cache
 * @param {string} fileId - Telegram file ID
 * @param {Buffer} data - Thumbnail data
 * @param {string} mimeType - MIME type
 */
function cacheThumbnail(fileId, data, mimeType = 'image/jpeg') {
  const hash = hashFileId(fileId);
  const ext = mimeType.includes('png') ? '.png' : '.jpg';
  const filePath = path.join(THUMBNAIL_CACHE_DIR, hash + ext);
  
  try {
    // Enforce max cache size
    if (thumbnailIndex.size >= THUMBNAIL_MAX_SIZE) {
      evictOldestThumbnails(Math.floor(THUMBNAIL_MAX_SIZE * 0.2)); // Remove 20%
    }
    
    fs.writeFileSync(filePath, data);
    
    thumbnailIndex.set(hash, {
      path: filePath,
      size: data.length,
      mtime: Date.now()
    });
    
    return true;
  } catch (e) {
    console.error('Error caching thumbnail:', e);
    return false;
  }
}

/**
 * Delete cached thumbnail
 * @param {string} hash 
 */
function deleteCachedThumbnail(hash) {
  const cached = thumbnailIndex.get(hash);
  if (cached) {
    try {
      fs.unlinkSync(cached.path);
    } catch (e) {}
    thumbnailIndex.delete(hash);
  }
}

/**
 * Clean old thumbnails
 */
function cleanOldThumbnails() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [hash, info] of thumbnailIndex) {
    if (now - info.mtime > THUMBNAIL_MAX_AGE) {
      deleteCachedThumbnail(hash);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🗑️ Cleaned ${cleaned} old thumbnails`);
  }
}

/**
 * Evict oldest thumbnails
 * @param {number} count 
 */
function evictOldestThumbnails(count) {
  const sorted = [...thumbnailIndex.entries()]
    .sort((a, b) => a[1].mtime - b[1].mtime)
    .slice(0, count);
  
  sorted.forEach(([hash]) => deleteCachedThumbnail(hash));
}

/**
 * Hash file ID for cache key
 * @param {string} fileId 
 * @returns {string}
 */
function hashFileId(fileId) {
  return crypto.createHash('md5').update(fileId).digest('hex').substring(0, 16);
}

/**
 * Get thumbnail cache stats
 */
function getThumbnailCacheStats() {
  let totalSize = 0;
  thumbnailIndex.forEach(info => totalSize += info.size);
  
  return {
    count: thumbnailIndex.size,
    totalSize,
    maxSize: THUMBNAIL_MAX_SIZE,
    maxAge: THUMBNAIL_MAX_AGE
  };
}

// ============ BROTLI COMPRESSION ============

/**
 * Create Brotli compression middleware
 * Falls back to gzip if Brotli not supported
 */
function brotliCompression(options = {}) {
  const {
    threshold = 1024, // Min size to compress (1KB)
    level = 4, // Brotli quality (0-11, 4 is good balance)
    gzipLevel = 6
  } = options;
  
  return (req, res, next) => {
    // Skip if already compressed or small response
    if (req.headers['x-no-compression']) {
      return next();
    }
    
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    // Store original write and end
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    
    let chunks = [];
    let isCompressing = false;
    
    // Override write
    res.write = function(chunk, encoding, callback) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      if (typeof encoding === 'function') {
        callback = encoding;
      }
      if (callback) callback();
      return true;
    };
    
    // Override end
    res.end = function(chunk, encoding, callback) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      
      const body = Buffer.concat(chunks);
      
      // Skip compression for small responses
      if (body.length < threshold) {
        res.setHeader('Content-Length', body.length);
        originalWrite(body);
        return originalEnd(callback);
      }
      
      // Check content type - only compress text-based content
      const contentType = res.getHeader('Content-Type') || '';
      const compressible = /text|json|javascript|xml|html|css|svg/.test(contentType);
      
      if (!compressible) {
        res.setHeader('Content-Length', body.length);
        originalWrite(body);
        return originalEnd(callback);
      }
      
      // Choose compression method
      if (acceptEncoding.includes('br')) {
        // Brotli compression
        zlib.brotliCompress(body, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: level
          }
        }, (err, compressed) => {
          if (err || compressed.length >= body.length) {
            // Compression failed or didn't help
            res.setHeader('Content-Length', body.length);
            originalWrite(body);
            return originalEnd(callback);
          }
          
          res.setHeader('Content-Encoding', 'br');
          res.setHeader('Content-Length', compressed.length);
          res.removeHeader('Content-Length'); // Let it be calculated
          originalWrite(compressed);
          originalEnd(callback);
        });
      } else if (acceptEncoding.includes('gzip')) {
        // Gzip fallback
        zlib.gzip(body, { level: gzipLevel }, (err, compressed) => {
          if (err || compressed.length >= body.length) {
            res.setHeader('Content-Length', body.length);
            originalWrite(body);
            return originalEnd(callback);
          }
          
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Content-Length', compressed.length);
          originalWrite(compressed);
          originalEnd(callback);
        });
      } else {
        // No compression
        res.setHeader('Content-Length', body.length);
        originalWrite(body);
        originalEnd(callback);
      }
    };
    
    next();
  };
}

// ============ CURSOR-BASED PAGINATION ============

/**
 * Encode cursor for pagination
 * @param {object} data - { id, sortValue, sortField }
 * @returns {string}
 */
function encodeCursor(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decode cursor
 * @param {string} cursor 
 * @returns {object|null}
 */
function decodeCursor(cursor) {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch (e) {
    return null;
  }
}

/**
 * Build cursor-based pagination query
 * @param {object} options
 * @returns {object} { whereClause, params, orderClause }
 */
function buildCursorQuery(options = {}) {
  const {
    cursor,
    sortField = 'created_at',
    sortOrder = 'DESC',
    limit = 50
  } = options;
  
  let whereClause = '';
  let params = [];
  const isDesc = sortOrder.toUpperCase() === 'DESC';
  const operator = isDesc ? '<' : '>';
  
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      // Use composite cursor for stable pagination
      whereClause = `AND (${sortField} ${operator} ? OR (${sortField} = ? AND id ${operator} ?))`;
      params = [decoded.sortValue, decoded.sortValue, decoded.id];
    }
  }
  
  const orderClause = `ORDER BY ${sortField} ${sortOrder}, id ${sortOrder} LIMIT ?`;
  params.push(limit + 1); // Fetch one extra to check if there's more
  
  return { whereClause, params, orderClause };
}

/**
 * Process cursor pagination results
 * @param {Array} results 
 * @param {number} limit 
 * @param {string} sortField 
 * @returns {object} { items, nextCursor, hasMore }
 */
function processCursorResults(results, limit, sortField = 'created_at') {
  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;
  
  let nextCursor = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor({
      id: lastItem.id,
      sortValue: lastItem[sortField],
      sortField
    });
  }
  
  return { items, nextCursor, hasMore };
}

// ============ RESPONSE CACHE ============
const responseCache = new Map();
const RESPONSE_CACHE_TTL = 30000; // 30 seconds

/**
 * Cache middleware for GET requests
 * @param {number} ttl - Time to live in ms
 */
function cacheResponse(ttl = RESPONSE_CACHE_TTL) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    const key = `${req.originalUrl}_${req.user?.userId || 'anon'}`;
    const cached = responseCache.get(key);
    
    if (cached && Date.now() - cached.time < ttl) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }
    
    // Store original json method
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // Cache the response
      responseCache.set(key, { data, time: Date.now() });
      
      // Clean old entries periodically
      if (responseCache.size > 1000) {
        const now = Date.now();
        for (const [k, v] of responseCache) {
          if (now - v.time > ttl) {
            responseCache.delete(k);
          }
        }
      }
      
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };
    
    next();
  };
}

/**
 * Invalidate response cache
 * @param {string} pattern - URL pattern to invalidate
 */
function invalidateResponseCache(pattern) {
  for (const key of responseCache.keys()) {
    if (key.includes(pattern)) {
      responseCache.delete(key);
    }
  }
}

// ============ ETAG SUPPORT ============

/**
 * Generate ETag for content
 * @param {any} content 
 * @returns {string}
 */
function generateETag(content) {
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * ETag middleware
 */
function etagMiddleware() {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      const etag = `"${generateETag(data)}"`;
      res.setHeader('ETag', etag);
      
      // Check If-None-Match header
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch === etag) {
        return res.status(304).end();
      }
      
      return originalJson(data);
    };
    
    next();
  };
}

// Initialize on load
initThumbnailCache();

// Schedule periodic cleanup
setInterval(cleanOldThumbnails, 60 * 60 * 1000); // Every hour

// ============ EXPORTS ============
module.exports = {
  // Thumbnail cache
  getCachedThumbnail,
  cacheThumbnail,
  getThumbnailCacheStats,
  initThumbnailCache,
  
  // Compression
  brotliCompression,
  
  // Cursor pagination
  encodeCursor,
  decodeCursor,
  buildCursorQuery,
  processCursorResults,
  
  // Response cache
  cacheResponse,
  invalidateResponseCache,
  
  // ETag
  generateETag,
  etagMiddleware
};
