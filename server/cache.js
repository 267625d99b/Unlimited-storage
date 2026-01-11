/**
 * Advanced Caching Module
 * نظام تخزين مؤقت متقدم مع TTL و LRU
 */

// ============ LRU CACHE IMPLEMENTATION ============
class LRUCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.ttl || 60000; // 1 minute default
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {any} Cached value or undefined
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return undefined;
    }

    // Check TTL
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    this.stats.hits++;
    return item.value;
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in ms (optional)
   */
  set(key, value, ttl = this.defaultTTL) {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }

    // Remove existing to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: ttl > 0 ? Date.now() + ttl : null
    });

    this.stats.sets++;
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) this.stats.deletes++;
    return deleted;
  }

  /**
   * Check if key exists and is valid
   * @param {string} key - Cache key
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Clear all items
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Delete items matching pattern
   * @param {string|RegExp} pattern - Pattern to match
   */
  deletePattern(pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    let deleted = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    this.stats.deletes += deleted;
    return deleted;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Cleanup expired items
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache) {
      if (item.expiresAt && now > item.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// ============ CACHE MANAGER ============
class CacheManager {
  constructor() {
    // Different caches for different data types
    this.caches = {
      files: new LRUCache({ maxSize: 500, ttl: 30000 }),      // 30 seconds
      folders: new LRUCache({ maxSize: 200, ttl: 60000 }),    // 1 minute
      queries: new LRUCache({ maxSize: 300, ttl: 30000 }),    // 30 seconds
      thumbnails: new LRUCache({ maxSize: 1000, ttl: 300000 }), // 5 minutes
      users: new LRUCache({ maxSize: 100, ttl: 120000 }),     // 2 minutes
      stats: new LRUCache({ maxSize: 50, ttl: 60000 }),       // 1 minute
      search: new LRUCache({ maxSize: 200, ttl: 15000 })      // 15 seconds
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupAll(), 60000);
  }

  /**
   * Get from specific cache
   */
  get(type, key) {
    const cache = this.caches[type];
    if (!cache) return undefined;
    return cache.get(key);
  }

  /**
   * Set in specific cache
   */
  set(type, key, value, ttl) {
    const cache = this.caches[type];
    if (!cache) return false;
    cache.set(key, value, ttl);
    return true;
  }

  /**
   * Delete from specific cache
   */
  delete(type, key) {
    const cache = this.caches[type];
    if (!cache) return false;
    return cache.delete(key);
  }

  /**
   * Invalidate cache by type
   */
  invalidate(type) {
    const cache = this.caches[type];
    if (cache) {
      cache.clear();
    }
  }

  /**
   * Invalidate multiple types
   */
  invalidateMultiple(types) {
    types.forEach(type => this.invalidate(type));
  }

  /**
   * Invalidate by pattern across all caches
   */
  invalidatePattern(pattern) {
    let total = 0;
    for (const cache of Object.values(this.caches)) {
      total += cache.deletePattern(pattern);
    }
    return total;
  }

  /**
   * Invalidate user-related caches
   */
  invalidateUser(userId) {
    return this.invalidatePattern(new RegExp(`_${userId}_|_${userId}$|^${userId}_`));
  }

  /**
   * Invalidate file-related caches
   */
  invalidateFile(fileId) {
    this.delete('files', `file_${fileId}`);
    this.invalidatePattern(new RegExp(`file.*${fileId}`));
  }

  /**
   * Invalidate folder-related caches
   */
  invalidateFolder(folderId) {
    this.delete('folders', `folder_${folderId}`);
    this.invalidatePattern(new RegExp(`folder.*${folderId}|_${folderId}_`));
  }

  /**
   * Cleanup all caches
   */
  cleanupAll() {
    let total = 0;
    for (const cache of Object.values(this.caches)) {
      total += cache.cleanup();
    }
    if (total > 0) {
      console.log(`🧹 Cache cleanup: removed ${total} expired items`);
    }
    return total;
  }

  /**
   * Get all stats
   */
  getAllStats() {
    const stats = {};
    for (const [name, cache] of Object.entries(this.caches)) {
      stats[name] = cache.getStats();
    }
    return stats;
  }

  /**
   * Clear all caches
   */
  clearAll() {
    for (const cache of Object.values(this.caches)) {
      cache.clear();
    }
  }

  /**
   * Destroy manager
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.clearAll();
  }
}

// ============ CACHE DECORATORS ============

/**
 * Memoize function results
 * @param {Function} fn - Function to memoize
 * @param {Object} options - Cache options
 */
function memoize(fn, options = {}) {
  const cache = new LRUCache({
    maxSize: options.maxSize || 100,
    ttl: options.ttl || 60000
  });

  const keyGenerator = options.keyGenerator || ((...args) => JSON.stringify(args));

  return function (...args) {
    const key = keyGenerator(...args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    
    // Handle promises
    if (result instanceof Promise) {
      return result.then(value => {
        cache.set(key, value);
        return value;
      });
    }

    cache.set(key, result);
    return result;
  };
}

/**
 * Cache middleware for Express
 */
function cacheMiddleware(cacheManager, type, options = {}) {
  const ttl = options.ttl;
  const keyGenerator = options.keyGenerator || ((req) => `${req.method}_${req.originalUrl}_${req.user?.userId || 'anon'}`);

  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET' && !options.allowNonGet) {
      return next();
    }

    const key = keyGenerator(req);
    const cached = cacheManager.get(type, key);

    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200) {
        cacheManager.set(type, key, data, ttl);
      }
      res.set('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
}

// ============ SINGLETON INSTANCE ============
const cacheManager = new CacheManager();

// ============ EXPORTS ============
module.exports = {
  LRUCache,
  CacheManager,
  cacheManager,
  memoize,
  cacheMiddleware
};
