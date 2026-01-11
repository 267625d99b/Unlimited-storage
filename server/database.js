/**
 * Database Module - Using better-sqlite3 (Native SQLite)
 * قاعدة بيانات SQLite حقيقية مع دعم Transactions
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ============ CONFIGURATION ============
const DB_PATH = path.join(__dirname, 'storage.db');
const BACKUP_DIR = path.join(__dirname, 'backups');
const JSON_PATH = path.join(__dirname, 'storage.json');

// Backup settings
const BACKUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const MAX_BACKUPS = 10; // Keep last 10 backups

let db = null;

// ============ SMART CACHE SYSTEM ============
const cache = {
  files: new Map(),
  folders: new Map(),
  queries: new Map(),

  config: {
    ttl: 60000,
    maxSize: 200,
    ttlByType: {
      files: 30000,
      folders: 60000,
      starred: 30000,
      recent: 15000,
      trash: 60000,
      stats: 120000
    }
  }
};

function getCached(key, type = 'queries') {
  const cacheMap = cache[type] || cache.queries;
  const item = cacheMap.get(key);

  if (!item) return null;

  const ttl = cache.config.ttlByType[type] || cache.config.ttl;
  if (Date.now() - item.time < ttl) {
    item.hits = (item.hits || 0) + 1;
    return item.data;
  }

  cacheMap.delete(key);
  return null;
}

function setCache(key, data, type = 'queries') {
  const cacheMap = cache[type] || cache.queries;

  if (cacheMap.size >= cache.config.maxSize) {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [k, v] of cacheMap) {
      if (v.time < oldestTime) {
        oldestTime = v.time;
        oldestKey = k;
      }
    }

    if (oldestKey) cacheMap.delete(oldestKey);
  }

  cacheMap.set(key, { data, time: Date.now(), hits: 0 });
}

function invalidateCache(types = []) {
  if (types.length === 0) {
    cache.files.clear();
    cache.folders.clear();
    cache.queries.clear();
  } else {
    types.forEach(type => {
      if (cache[type]) {
        cache[type].clear();
      }
      for (const [key] of cache.queries) {
        if (key.startsWith(type)) {
          cache.queries.delete(key);
        }
      }
    });
  }
}

function invalidateFolderCache(folderId) {
  for (const [key] of cache.queries) {
    if (key.includes(`_${folderId}_`) || key.includes(`folders_${folderId}`)) {
      cache.queries.delete(key);
    }
  }
  cache.folders.delete(folderId);
}

function invalidateFileCache(fileId) {
  cache.files.delete(fileId);
  invalidateCache(['starred', 'recent']);
}

// ============ DATABASE INITIALIZATION ============
async function initDB() {
  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Initialize better-sqlite3 database
  const isNewDB = !fs.existsSync(DB_PATH);

  db = new Database(DB_PATH, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : null
  });

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = 10000');
  db.pragma('temp_store = MEMORY');
  db.pragma('foreign_keys = ON');

  if (isNewDB) {
    createTables();

    // Migrate from JSON if exists
    if (fs.existsSync(JSON_PATH)) {
      migrateFromJSON();
    }
    console.log('✅ Created new SQLite database (better-sqlite3)');
  } else {
    console.log('✅ Loaded existing SQLite database (better-sqlite3)');
    runMigrations();
  }

  // Run optimizations
  optimizeDB();

  // Start backup scheduler
  startBackupScheduler();

  return db;
}

// ============ TRANSACTIONS ============
/**
 * Execute multiple operations in a transaction
 * @param {Function} callback - Function containing database operations
 * @returns {any} Result of the callback
 */
function transaction(callback) {
  const trx = db.transaction(callback);
  return trx();
}

/**
 * Execute operations in a transaction with automatic rollback on error
 * @param {Function} callback 
 * @returns {any}
 */
function safeTransaction(callback) {
  try {
    return transaction(callback);
  } catch (error) {
    console.error('Transaction failed, rolled back:', error.message);
    throw error;
  }
}

// ============ MIGRATIONS ============
function runMigrations() {
  console.log('🔄 Running database migrations...');

  const addColumnIfNotExists = (table, column, type) => {
    try {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all();
      const columnNames = columns.map(row => row.name);

      if (!columnNames.includes(column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`  ✅ Added column ${column} to ${table}`);
        return true;
      }
    } catch (e) {
      console.log(`  ⚠️ Could not add ${column} to ${table}: ${e.message}`);
    }
    return false;
  };

  let changed = false;
  changed = addColumnIfNotExists('folders', 'user_id', 'TEXT') || changed;
  changed = addColumnIfNotExists('files', 'user_id', 'TEXT') || changed;
  changed = addColumnIfNotExists('trash', 'user_id', 'TEXT') || changed;
  changed = addColumnIfNotExists('recent_files', 'user_id', 'TEXT') || changed;

  if (changed) {
    console.log('✅ Migrations completed');
  } else {
    console.log('✅ No migrations needed');
  }
}

function optimizeDB() {
  try {
    db.exec('ANALYZE');
    console.log('✅ Database optimizations applied');
  } catch (e) {
    console.error('Optimization error:', e);
  }
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      user_id TEXT,
      created_at TEXT,
      FOREIGN KEY (parent_id) REFERENCES folders(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size INTEGER,
      type TEXT,
      telegram_file_id TEXT,
      telegram_message_id INTEGER,
      folder_id TEXT,
      user_id TEXT,
      created_at TEXT,
      starred INTEGER DEFAULT 0,
      shared INTEGER DEFAULT 0,
      share_id TEXT,
      share_password TEXT,
      share_expires_at TEXT,
      share_permissions TEXT DEFAULT 'view',
      FOREIGN KEY (folder_id) REFERENCES folders(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS trash (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size INTEGER,
      type TEXT,
      telegram_file_id TEXT,
      telegram_message_id INTEGER,
      original_folder_id TEXT,
      original_parent_id TEXT,
      user_id TEXT,
      is_folder INTEGER DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS recent_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL,
      user_id TEXT,
      accessed_at TEXT,
      FOREIGN KEY (file_id) REFERENCES files(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      target_name TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_access (
      id TEXT PRIMARY KEY,
      file_id TEXT,
      folder_id TEXT,
      owner_id TEXT NOT NULL,
      shared_with_id TEXT,
      shared_with_email TEXT,
      permission TEXT DEFAULT 'view',
      created_at TEXT,
      expires_at TEXT,
      FOREIGN KEY (file_id) REFERENCES files(id),
      FOREIGN KEY (folder_id) REFERENCES folders(id)
    )
  `);

  // Tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#1a73e8',
      user_id TEXT NOT NULL,
      created_at TEXT,
      UNIQUE(name, user_id)
    )
  `);

  // File-Tags relationship table
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      created_at TEXT,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      UNIQUE(file_id, tag_id)
    )
  `);

  // File Versions table (Version History)
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_versions (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      size INTEGER,
      type TEXT,
      telegram_file_id TEXT,
      telegram_message_id INTEGER,
      user_id TEXT,
      created_at TEXT,
      comment TEXT,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `);

  // Comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      parent_id TEXT,
      content TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    )
  `);

  // Collections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      user_id TEXT NOT NULL,
      color TEXT DEFAULT '#1a73e8',
      icon TEXT DEFAULT 'folder',
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // Collection Items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS collection_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      added_at TEXT,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      UNIQUE(collection_id, file_id)
    )
  `);

  // AI - Extracted Text table (OCR results)
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_extracted_text (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL UNIQUE,
      text TEXT,
      confidence REAL,
      language TEXT DEFAULT 'ara+eng',
      extracted_at TEXT,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `);

  // AI - Auto Tags table (AI suggested tags)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_suggested_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL,
      tag_name TEXT NOT NULL,
      confidence REAL,
      applied INTEGER DEFAULT 0,
      suggested_at TEXT,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `);

  // AI - File Descriptions table (AI generated descriptions)
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_descriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `);

  // AI - File Summaries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL UNIQUE,
      summary TEXT,
      language TEXT DEFAULT 'ar',
      method TEXT DEFAULT 'local',
      created_at TEXT,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id)',
    'CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_files_name ON files(name)',
    'CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_files_starred ON files(starred)',
    'CREATE INDEX IF NOT EXISTS idx_files_shared ON files(shared)',
    'CREATE INDEX IF NOT EXISTS idx_files_share_id ON files(share_id)',
    'CREATE INDEX IF NOT EXISTS idx_files_type ON files(type)',
    'CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id)',
    'CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_folders_name ON folders(name)',
    'CREATE INDEX IF NOT EXISTS idx_trash_deleted ON trash(deleted_at)',
    'CREATE INDEX IF NOT EXISTS idx_trash_user ON trash(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_recent_accessed ON recent_files(accessed_at)',
    'CREATE INDEX IF NOT EXISTS idx_recent_user ON recent_files(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_shared_file ON shared_access(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_shared_owner ON shared_access(owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)',
    'CREATE INDEX IF NOT EXISTS idx_file_tags_file ON file_tags(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag_id)',
    'CREATE INDEX IF NOT EXISTS idx_versions_file ON file_versions(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_versions_created ON file_versions(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_comments_file ON comments(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id)',
    'CREATE INDEX IF NOT EXISTS idx_collection_items_file ON collection_items(file_id)',
    // AI indexes
    'CREATE INDEX IF NOT EXISTS idx_extracted_text_file ON file_extracted_text(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_ai_tags_file ON ai_suggested_tags(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_file_summaries_file ON file_summaries(file_id)'
  ];

  indexes.forEach(sql => db.exec(sql));

  console.log('✅ Tables and indexes created');
}

// ============ BACKUP SYSTEM ============
function startBackupScheduler() {
  createBackup();

  setInterval(() => {
    createBackup();
    cleanOldBackups();
  }, BACKUP_INTERVAL);

  console.log('✅ Backup scheduler started (every 6 hours)');
}

function createBackup() {
  try {
    if (!db) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `storage_${timestamp}.db`);

    // Use better-sqlite3's backup API
    db.backup(backupPath);

    console.log(`📦 Backup created: ${backupPath}`);
    return backupPath;
  } catch (e) {
    console.error('Backup error:', e);
    return null;
  }
}

function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('storage_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      toDelete.forEach(f => {
        fs.unlinkSync(f.path);
        console.log(`🗑️ Deleted old backup: ${f.name}`);
      });
    }
  } catch (e) {
    console.error('Cleanup error:', e);
  }
}

function restoreFromBackup(backupPath) {
  try {
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    // Close current database
    if (db) db.close();

    // Copy backup to main DB path
    fs.copyFileSync(backupPath, DB_PATH);

    // Reopen database
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    invalidateCache();

    console.log(`✅ Restored from backup: ${backupPath}`);
    return true;
  } catch (e) {
    console.error('Restore error:', e);
    return false;
  }
}

function listBackups() {
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('storage_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        size: fs.statSync(path.join(BACKUP_DIR, f)).size,
        created: fs.statSync(path.join(BACKUP_DIR, f)).mtime
      }))
      .sort((a, b) => b.created - a.created);
  } catch (e) {
    console.error('List backups error:', e);
    return [];
  }
}

// ============ MIGRATION FROM JSON ============
function migrateFromJSON() {
  console.log('Migrating data from JSON to SQLite...');

  try {
    const content = fs.readFileSync(JSON_PATH, 'utf8');
    const data = JSON.parse(content);

    // Use transaction for migration
    transaction(() => {
      // Migrate folders
      if (data.folders && data.folders.length > 0) {
        const stmt = db.prepare('INSERT OR REPLACE INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)');
        for (const folder of data.folders) {
          stmt.run(folder.id, folder.name, folder.parent_id || null, folder.created_at);
        }
        console.log(`Migrated ${data.folders.length} folders`);
      }

      // Migrate files
      if (data.files && data.files.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO files 
          (id, name, size, type, telegram_file_id, telegram_message_id, folder_id, created_at, starred, shared, share_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const file of data.files) {
          stmt.run(
            file.id, file.name, file.size, file.type,
            file.telegram_file_id, file.telegram_message_id,
            file.folder_id || null, file.created_at,
            file.starred ? 1 : 0, file.shared ? 1 : 0, file.share_id || null
          );
        }
        console.log(`Migrated ${data.files.length} files`);
      }

      // Migrate trash
      if (data.trash && data.trash.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO trash 
          (id, name, size, type, telegram_file_id, telegram_message_id, original_folder_id, original_parent_id, is_folder, deleted_at, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of data.trash) {
          stmt.run(
            item.id, item.name, item.size || 0, item.type || null,
            item.telegram_file_id || null, item.telegram_message_id || null,
            item.original_folder_id || null, item.original_parent_id || null,
            item.isFolder ? 1 : 0, item.deleted_at, item.created_at
          );
        }
        console.log(`Migrated ${data.trash.length} trash items`);
      }

      // Migrate recent files
      if (data.recentFiles && data.recentFiles.length > 0) {
        const stmt = db.prepare('INSERT INTO recent_files (file_id, accessed_at) VALUES (?, ?)');
        for (const recent of data.recentFiles) {
          stmt.run(recent.id, recent.accessed_at);
        }
        console.log(`Migrated ${data.recentFiles.length} recent files`);
      }
    });

    // Backup JSON file
    fs.renameSync(JSON_PATH, JSON_PATH + '.backup');
    console.log('Migration complete! JSON file backed up.');

  } catch (e) {
    console.error('Migration error:', e);
  }
}

// ============ QUERY HELPERS ============
function query(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (e) {
    console.error('Query error:', sql, e);
    return [];
  }
}

function queryOne(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...params) || null;
  } catch (e) {
    console.error('Query error:', sql, e);
    return null;
  }
}

function execute(sql, params = [], cacheTypes = []) {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);

    if (cacheTypes.length > 0) {
      invalidateCache(cacheTypes);
    }

    return result;
  } catch (e) {
    console.error('Execute error:', sql, e);
    return null;
  }
}


// ============ FOLDERS ============
function getFolders(parentId = null, options = {}) {
  const { page = 1, limit = 50, userId = null } = options;
  const offset = (page - 1) * limit;
  const cacheKey = `folders_${parentId}_${userId}_${page}_${limit}`;
  const cached = getCached(cacheKey, 'folders');
  if (cached) return cached;

  let results;
  let total;

  const userFilter = userId ? 'AND user_id = ?' : '';
  const userParams = userId ? [userId] : [];

  if (parentId === null || parentId === 'null' || parentId === undefined) {
    results = query(
      `SELECT * FROM folders WHERE parent_id IS NULL ${userFilter} ORDER BY name LIMIT ? OFFSET ?`,
      [...userParams, limit, offset]
    );
    total = queryOne(
      `SELECT COUNT(*) as count FROM folders WHERE parent_id IS NULL ${userFilter}`,
      userParams
    );
  } else {
    results = query(
      `SELECT * FROM folders WHERE parent_id = ? ${userFilter} ORDER BY name LIMIT ? OFFSET ?`,
      [parentId, ...userParams, limit, offset]
    );
    total = queryOne(
      `SELECT COUNT(*) as count FROM folders WHERE parent_id = ? ${userFilter}`,
      [parentId, ...userParams]
    );
  }

  const response = {
    folders: results,
    pagination: {
      page,
      limit,
      total: total?.count || 0,
      totalPages: Math.ceil((total?.count || 0) / limit),
      hasMore: offset + results.length < (total?.count || 0)
    }
  };

  setCache(cacheKey, response, 'folders');
  return response;
}

function getAllFolders(userId = null) {
  const cacheKey = `all_folders_${userId}`;
  const cached = getCached(cacheKey, 'folders');
  if (cached) return cached;

  let results;
  if (userId) {
    results = query('SELECT * FROM folders WHERE user_id = ? ORDER BY name', [userId]);
  } else {
    results = query('SELECT * FROM folders ORDER BY name');
  }
  setCache(cacheKey, results, 'folders');
  return results;
}

function getFolderById(id) {
  const cached = getCached(`folder_${id}`, 'folders');
  if (cached) return cached;

  const result = queryOne('SELECT * FROM folders WHERE id = ?', [id]);
  if (result) setCache(`folder_${id}`, result, 'folders');
  return result;
}

function createFolder(id, name, parentId, createdAt, userId = null) {
  const result = execute(
    'INSERT INTO folders (id, name, parent_id, created_at, user_id) VALUES (?, ?, ?, ?, ?)',
    [id, name, parentId || null, createdAt, userId],
    ['folders']
  );
  if (result) invalidateFolderCache(parentId);
  return result;
}

function updateFolderName(id, name) {
  const result = execute('UPDATE folders SET name = ? WHERE id = ?', [name, id], ['folders']);
  if (result) invalidateFolderCache(id);
  return result;
}

function updateFolderParent(id, parentId) {
  const folder = getFolderById(id);
  const result = execute('UPDATE folders SET parent_id = ? WHERE id = ?', [parentId || null, id], ['folders']);
  if (result) {
    invalidateFolderCache(id);
    invalidateFolderCache(folder?.parent_id);
    invalidateFolderCache(parentId);
  }
  return result;
}

function deleteFolder(id) {
  const folder = getFolderById(id);
  const result = execute('DELETE FROM folders WHERE id = ?', [id], ['folders']);
  if (result) invalidateFolderCache(folder?.parent_id);
  return result;
}

function deleteFoldersByParent(parentId) {
  return execute('DELETE FROM folders WHERE parent_id = ?', [parentId], ['folders']);
}

// ============ FILES ============
function getFiles(folderId = null, options = {}) {
  const { page = 1, limit = 50, sortBy = 'name', sortOrder = 'ASC', userId = null } = options;
  const offset = (page - 1) * limit;
  const cacheKey = `files_${folderId}_${userId}_${page}_${limit}_${sortBy}_${sortOrder}`;
  const cached = getCached(cacheKey, 'files');
  if (cached) return cached;

  const validSortFields = ['name', 'created_at', 'size', 'type'];
  const validSortOrders = ['ASC', 'DESC'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'name';
  const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

  const userFilter = userId ? 'AND user_id = ?' : '';
  const userParams = userId ? [userId] : [];

  let results;
  let total;

  if (folderId === null || folderId === 'null' || folderId === undefined) {
    results = query(
      `SELECT * FROM files WHERE folder_id IS NULL ${userFilter} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
      [...userParams, limit, offset]
    );
    total = queryOne(
      `SELECT COUNT(*) as count FROM files WHERE folder_id IS NULL ${userFilter}`,
      userParams
    );
  } else {
    results = query(
      `SELECT * FROM files WHERE folder_id = ? ${userFilter} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
      [folderId, ...userParams, limit, offset]
    );
    total = queryOne(
      `SELECT COUNT(*) as count FROM files WHERE folder_id = ? ${userFilter}`,
      [folderId, ...userParams]
    );
  }

  results = results.map(f => ({
    ...f,
    starred: f.starred === 1,
    shared: f.shared === 1
  }));

  const response = {
    files: results,
    pagination: {
      page,
      limit,
      total: total?.count || 0,
      totalPages: Math.ceil((total?.count || 0) / limit),
      hasMore: offset + results.length < (total?.count || 0)
    }
  };

  setCache(cacheKey, response, 'files');
  return response;
}

function getFileById(id) {
  const cached = getCached(`file_${id}`, 'files');
  if (cached) return cached;

  const file = queryOne('SELECT * FROM files WHERE id = ?', [id]);
  if (file) {
    file.starred = file.starred === 1;
    file.shared = file.shared === 1;
    setCache(`file_${id}`, file, 'files');
  }
  return file;
}

function createFile(fileData) {
  const result = execute(
    `INSERT INTO files (id, name, size, type, telegram_file_id, telegram_message_id, folder_id, user_id, created_at, starred, shared, share_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fileData.id, fileData.name, fileData.size, fileData.type,
      fileData.telegram_file_id, fileData.telegram_message_id,
      fileData.folder_id || null, fileData.user_id || null, fileData.created_at,
      0, 0, null
    ],
    ['files']
  );
  if (result) invalidateFolderCache(fileData.folder_id);
  return result;
}

function updateFileName(id, name) {
  const result = execute('UPDATE files SET name = ? WHERE id = ?', [name, id]);
  if (result) invalidateFileCache(id);
  return result;
}

function updateFileFolder(id, folderId) {
  const file = getFileById(id);
  const result = execute('UPDATE files SET folder_id = ? WHERE id = ?', [folderId || null, id]);
  if (result) {
    invalidateFileCache(id);
    invalidateFolderCache(file?.folder_id);
    invalidateFolderCache(folderId);
  }
  return result;
}

function deleteFile(id) {
  const file = getFileById(id);
  const result = execute('DELETE FROM files WHERE id = ?', [id]);
  if (result) {
    invalidateFileCache(id);
    invalidateFolderCache(file?.folder_id);
  }
  return result;
}

function deleteFilesByFolder(folderId) {
  const result = execute('DELETE FROM files WHERE folder_id = ?', [folderId], ['files']);
  if (result) invalidateFolderCache(folderId);
  return result;
}

function searchFiles(searchQuery) {
  const results = query(
    'SELECT * FROM files WHERE name LIKE ? ORDER BY name LIMIT 100',
    [`%${searchQuery}%`]
  );
  return results.map(f => ({ ...f, starred: f.starred === 1, shared: f.shared === 1 }));
}

function searchFolders(searchQuery) {
  return query(
    'SELECT * FROM folders WHERE name LIKE ? ORDER BY name LIMIT 100',
    [`%${searchQuery}%`]
  );
}


// ============ ADVANCED SEARCH ============
function advancedSearch(options = {}) {
  const {
    query: searchQuery,
    userId,
    folderId,
    types = [],
    minSize,
    maxSize,
    dateFrom,
    dateTo,
    starred,
    shared,
    sortBy = 'name',
    sortOrder = 'ASC',
    page = 1,
    limit = 50
  } = options;

  const offset = (page - 1) * limit;
  let sql = 'SELECT * FROM files WHERE 1=1';
  const params = [];

  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }

  if (folderId === 'root') {
    sql += ' AND folder_id IS NULL';
  } else if (folderId) {
    sql += ' AND folder_id = ?';
    params.push(folderId);
  }

  if (searchQuery && searchQuery.trim()) {
    sql += ' AND name LIKE ?';
    params.push(`%${searchQuery.trim()}%`);
  }

  if (types && types.length > 0) {
    const typeConditions = [];
    types.forEach(type => {
      switch (type) {
        case 'image':
          typeConditions.push("type LIKE 'image/%'");
          break;
        case 'video':
          typeConditions.push("type LIKE 'video/%'");
          break;
        case 'audio':
          typeConditions.push("type LIKE 'audio/%'");
          break;
        case 'document':
          typeConditions.push("(type LIKE 'application/pdf%' OR type LIKE '%document%' OR type LIKE '%word%' OR type LIKE '%excel%' OR type LIKE '%powerpoint%' OR type LIKE 'text/%')");
          break;
        case 'archive':
          typeConditions.push("(type LIKE '%zip%' OR type LIKE '%rar%' OR type LIKE '%7z%' OR type LIKE '%tar%' OR type LIKE '%gzip%')");
          break;
      }
    });
    if (typeConditions.length > 0) {
      sql += ` AND (${typeConditions.join(' OR ')})`;
    }
  }

  if (minSize !== undefined && minSize !== null) {
    sql += ' AND size >= ?';
    params.push(minSize);
  }
  if (maxSize !== undefined && maxSize !== null) {
    sql += ' AND size <= ?';
    params.push(maxSize);
  }

  if (dateFrom) {
    sql += ' AND created_at >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    sql += ' AND created_at <= ?';
    params.push(dateTo);
  }

  if (starred === true) {
    sql += ' AND starred = 1';
  } else if (starred === false) {
    sql += ' AND starred = 0';
  }

  if (shared === true) {
    sql += ' AND shared = 1';
  } else if (shared === false) {
    sql += ' AND shared = 0';
  }

  // Count total
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
  const total = queryOne(countSql, params);

  // Add sorting and pagination
  const validSortFields = ['name', 'created_at', 'size', 'type'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'name';
  const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  sql += ` ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const results = query(sql, params).map(f => ({
    ...f,
    starred: f.starred === 1,
    shared: f.shared === 1
  }));

  return {
    files: results,
    pagination: {
      page,
      limit,
      total: total?.count || 0,
      totalPages: Math.ceil((total?.count || 0) / limit),
      hasMore: offset + results.length < (total?.count || 0)
    }
  };
}

function getSearchSuggestions(searchQuery, userId, limit = 10) {
  const userFilter = userId ? 'AND user_id = ?' : '';
  const params = userId ? [`%${searchQuery}%`, userId, limit] : [`%${searchQuery}%`, limit];

  return query(
    `SELECT DISTINCT name FROM files WHERE name LIKE ? ${userFilter} ORDER BY name LIMIT ?`,
    params
  ).map(r => r.name);
}

function getFileTypeStats(userId = null) {
  const userFilter = userId ? 'WHERE user_id = ?' : '';
  const params = userId ? [userId] : [];

  const results = query(`
    SELECT 
      CASE 
        WHEN type LIKE 'image/%' THEN 'image'
        WHEN type LIKE 'video/%' THEN 'video'
        WHEN type LIKE 'audio/%' THEN 'audio'
        WHEN type LIKE 'application/pdf%' OR type LIKE '%document%' OR type LIKE '%word%' OR type LIKE '%excel%' OR type LIKE '%powerpoint%' OR type LIKE 'text/%' THEN 'document'
        WHEN type LIKE '%zip%' OR type LIKE '%rar%' OR type LIKE '%7z%' THEN 'archive'
        ELSE 'other'
      END as category,
      COUNT(*) as count,
      SUM(size) as totalSize
    FROM files ${userFilter}
    GROUP BY category
  `, params);

  return results;
}

// ============ STARRED FILES ============
function toggleStar(fileId) {
  const file = getFileById(fileId);
  if (!file) return null;

  const newStarred = file.starred ? 0 : 1;
  execute('UPDATE files SET starred = ? WHERE id = ?', [newStarred, fileId]);
  invalidateFileCache(fileId);
  invalidateCache(['starred']);

  return newStarred === 1;
}

function getStarredFiles(userId = null) {
  const cacheKey = `starred_${userId}`;
  const cached = getCached(cacheKey, 'starred');
  if (cached) return cached;

  const userFilter = userId ? 'AND user_id = ?' : '';
  const params = userId ? [userId] : [];

  const results = query(
    `SELECT * FROM files WHERE starred = 1 ${userFilter} ORDER BY name`,
    params
  ).map(f => ({ ...f, starred: true, shared: f.shared === 1 }));

  setCache(cacheKey, results, 'starred');
  return results;
}

// ============ TRASH ============
function moveFileToTrash(fileId) {
  const file = getFileById(fileId);
  if (!file) return false;

  return safeTransaction(() => {
    execute(`
      INSERT INTO trash (id, name, size, type, telegram_file_id, telegram_message_id, original_folder_id, user_id, is_folder, deleted_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [file.id, file.name, file.size, file.type, file.telegram_file_id, file.telegram_message_id, file.folder_id, file.user_id, new Date().toISOString(), file.created_at]);

    execute('DELETE FROM files WHERE id = ?', [fileId]);
    invalidateFileCache(fileId);
    invalidateFolderCache(file.folder_id);
    invalidateCache(['trash']);

    return true;
  });
}

function moveFolderToTrash(folderId) {
  const folder = getFolderById(folderId);
  if (!folder) return false;

  return safeTransaction(() => {
    execute(`
      INSERT INTO trash (id, name, original_parent_id, user_id, is_folder, deleted_at, created_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `, [folder.id, folder.name, folder.parent_id, folder.user_id, new Date().toISOString(), folder.created_at]);

    execute('DELETE FROM folders WHERE id = ?', [folderId]);
    invalidateFolderCache(folderId);
    invalidateFolderCache(folder.parent_id);
    invalidateCache(['trash']);

    return true;
  });
}

function getTrashItems(userId = null) {
  const cacheKey = `trash_${userId}`;
  const cached = getCached(cacheKey, 'trash');
  if (cached) return cached;

  const userFilter = userId ? 'WHERE user_id = ?' : '';
  const params = userId ? [userId] : [];

  const results = query(
    `SELECT *, is_folder as isFolder FROM trash ${userFilter} ORDER BY deleted_at DESC`,
    params
  );

  setCache(cacheKey, results, 'trash');
  return results;
}

function restoreFromTrash(id) {
  const item = queryOne('SELECT * FROM trash WHERE id = ?', [id]);
  if (!item) return false;

  return safeTransaction(() => {
    if (item.is_folder) {
      execute(`
        INSERT INTO folders (id, name, parent_id, user_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [item.id, item.name, item.original_parent_id, item.user_id, item.created_at]);
    } else {
      execute(`
        INSERT INTO files (id, name, size, type, telegram_file_id, telegram_message_id, folder_id, user_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [item.id, item.name, item.size, item.type, item.telegram_file_id, item.telegram_message_id, item.original_folder_id, item.user_id, item.created_at]);
    }

    execute('DELETE FROM trash WHERE id = ?', [id]);
    invalidateCache(['trash', 'files', 'folders']);

    return true;
  });
}

function deleteFromTrash(id) {
  execute('DELETE FROM trash WHERE id = ?', [id]);
  invalidateCache(['trash']);
}

function emptyTrash(userId = null) {
  if (userId) {
    execute('DELETE FROM trash WHERE user_id = ?', [userId]);
  } else {
    execute('DELETE FROM trash');
  }
  invalidateCache(['trash']);
}

// ============ RECENT FILES ============
function addRecentFile(fileId, userId = null) {
  // Remove old entry if exists
  if (userId) {
    execute('DELETE FROM recent_files WHERE file_id = ? AND user_id = ?', [fileId, userId]);
  } else {
    execute('DELETE FROM recent_files WHERE file_id = ?', [fileId]);
  }

  // Add new entry
  execute(
    'INSERT INTO recent_files (file_id, user_id, accessed_at) VALUES (?, ?, ?)',
    [fileId, userId, new Date().toISOString()]
  );

  // Keep only last 50 recent files per user
  if (userId) {
    execute(`
      DELETE FROM recent_files WHERE user_id = ? AND id NOT IN (
        SELECT id FROM recent_files WHERE user_id = ? ORDER BY accessed_at DESC LIMIT 50
      )
    `, [userId, userId]);
  }

  invalidateCache(['recent']);
}

function getRecentFiles(userId = null, limit = 20) {
  const cacheKey = `recent_${userId}_${limit}`;
  const cached = getCached(cacheKey, 'recent');
  if (cached) return cached;

  const userFilter = userId ? 'AND r.user_id = ?' : '';
  const params = userId ? [userId, limit] : [limit];

  const results = query(`
    SELECT f.*, r.accessed_at 
    FROM recent_files r 
    JOIN files f ON r.file_id = f.id 
    WHERE 1=1 ${userFilter}
    ORDER BY r.accessed_at DESC 
    LIMIT ?
  `, params).map(f => ({ ...f, starred: f.starred === 1, shared: f.shared === 1 }));

  setCache(cacheKey, results, 'recent');
  return results;
}

// ============ SHARING ============
function shareFile(fileId, shareId, options = {}) {
  const { password, expiresAt, permissions = 'view' } = options;
  execute(
    'UPDATE files SET shared = 1, share_id = ?, share_password = ?, share_expires_at = ?, share_permissions = ? WHERE id = ?',
    [shareId, password || null, expiresAt || null, permissions, fileId]
  );
  invalidateFileCache(fileId);
  return shareId;
}

function unshareFile(fileId) {
  execute('UPDATE files SET shared = 0, share_id = NULL, share_password = NULL, share_expires_at = NULL WHERE id = ?', [fileId]);
  invalidateFileCache(fileId);
}

function getSharedFile(shareId) {
  const file = queryOne('SELECT * FROM files WHERE share_id = ? AND shared = 1', [shareId]);
  if (file) {
    // Check expiration
    if (file.share_expires_at && new Date(file.share_expires_at) < new Date()) {
      return null;
    }
    file.starred = file.starred === 1;
    file.shared = file.shared === 1;
  }
  return file;
}

// ============ FOLDER SHARING ============
function shareFolder(folderId, shareId, options = {}) {
  const { password, expiresAt, permissions = 'view', ownerId, sharedWithId, sharedWithEmail } = options;

  execute(`
    INSERT INTO shared_access (id, folder_id, owner_id, shared_with_id, shared_with_email, permission, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [shareId, folderId, ownerId, sharedWithId || null, sharedWithEmail || null, permissions, new Date().toISOString(), expiresAt || null]);

  invalidateFolderCache(folderId);
  return shareId;
}

function unshareFolder(shareId) {
  execute('DELETE FROM shared_access WHERE id = ?', [shareId]);
  invalidateCache(['folders']);
}

function getSharedFolder(shareId) {
  const share = queryOne('SELECT * FROM shared_access WHERE id = ? AND folder_id IS NOT NULL', [shareId]);
  if (!share) return null;

  // Check expiration
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return null;
  }

  const folder = getFolderById(share.folder_id);
  return folder ? { ...folder, share } : null;
}

function getFolderShares(folderId) {
  return query('SELECT * FROM shared_access WHERE folder_id = ?', [folderId]);
}

function getUserSharedFolders(userId) {
  return query(`
    SELECT f.*, sa.permission, sa.id as share_id, sa.owner_id
    FROM shared_access sa
    JOIN folders f ON sa.folder_id = f.id
    WHERE sa.shared_with_id = ? OR sa.shared_with_email IN (
      SELECT email FROM users WHERE id = ?
    )
  `, [userId, userId]);
}

function getSharedWithMe(userId) {
  // Get files shared with user
  const files = query(`
    SELECT f.*, sa.permission, sa.id as share_id, sa.owner_id
    FROM shared_access sa
    JOIN files f ON sa.file_id = f.id
    WHERE sa.shared_with_id = ?
  `, [userId]).map(f => ({ ...f, type: 'file', starred: f.starred === 1, shared: true }));

  // Get folders shared with user
  const folders = query(`
    SELECT f.*, sa.permission, sa.id as share_id, sa.owner_id
    FROM shared_access sa
    JOIN folders f ON sa.folder_id = f.id
    WHERE sa.shared_with_id = ?
  `, [userId]).map(f => ({ ...f, type: 'folder' }));

  return { files, folders };
}

// ============ STORAGE ============
function getTotalSize(userId = null) {
  const userFilter = userId ? 'WHERE user_id = ?' : '';
  const params = userId ? [userId] : [];

  const result = queryOne(`SELECT COALESCE(SUM(size), 0) as total FROM files ${userFilter}`, params);
  return result?.total || 0;
}

// ============ ACTIVITY LOG ============
function logActivity(userId, action, targetType, targetId, targetName, details, ipAddress, userAgent) {
  execute(`
    INSERT INTO activity_log (user_id, action, target_type, target_id, target_name, details, ip_address, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [userId, action, targetType, targetId, targetName, details, ipAddress, userAgent, new Date().toISOString()]);
}

function getActivityLog(options = {}) {
  const { userId, page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  const userFilter = userId ? 'WHERE user_id = ?' : '';
  const params = userId ? [userId, limit, offset] : [limit, offset];

  const results = query(
    `SELECT * FROM activity_log ${userFilter} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params
  );

  const total = queryOne(
    `SELECT COUNT(*) as count FROM activity_log ${userFilter}`,
    userId ? [userId] : []
  );

  return {
    activities: results,
    pagination: {
      page,
      limit,
      total: total?.count || 0,
      totalPages: Math.ceil((total?.count || 0) / limit)
    }
  };
}

// ============ ORPHAN FILES ============
function assignOrphanFilesToUser(userId) {
  if (!userId) return { files: 0, folders: 0, trash: 0 };

  return safeTransaction(() => {
    const filesResult = execute('UPDATE files SET user_id = ? WHERE user_id IS NULL', [userId]);
    const foldersResult = execute('UPDATE folders SET user_id = ? WHERE user_id IS NULL', [userId]);
    const trashResult = execute('UPDATE trash SET user_id = ? WHERE user_id IS NULL', [userId]);

    invalidateCache();

    return {
      files: filesResult?.changes || 0,
      folders: foldersResult?.changes || 0,
      trash: trashResult?.changes || 0
    };
  });
}

// ============ STATISTICS ============
function getStats() {
  const files = queryOne('SELECT COUNT(*) as count FROM files');
  const folders = queryOne('SELECT COUNT(*) as count FROM folders');
  const trash = queryOne('SELECT COUNT(*) as count FROM trash');
  const totalSize = queryOne('SELECT COALESCE(SUM(size), 0) as total FROM files');

  return {
    files: files?.count || 0,
    folders: folders?.count || 0,
    trash: trash?.count || 0,
    totalSize: totalSize?.total || 0
  };
}

function getCacheStats() {
  return {
    files: {
      size: cache.files.size,
      maxSize: cache.config.maxSize
    },
    folders: {
      size: cache.folders.size,
      maxSize: cache.config.maxSize
    },
    queries: {
      size: cache.queries.size,
      maxSize: cache.config.maxSize
    },
    ttl: cache.config.ttl
  };
}

// ============ SHARE BY ID ============
function getFileByShareId(shareId) {
  const file = queryOne('SELECT * FROM files WHERE share_id = ? AND shared = 1', [shareId]);
  if (file) {
    // Check expiration
    if (file.share_expires_at && new Date(file.share_expires_at) < new Date()) {
      return null;
    }
    file.starred = file.starred === 1;
    file.shared = file.shared === 1;
  }
  return file;
}

// ============ ALIAS FOR RECENT ============
function addToRecent(fileId, userId = null) {
  return addRecentFile(fileId, userId);
}

// ============ DUPLICATE FILES DETECTION ============
/**
 * Find duplicate files based on size and telegram_file_id
 * @param {string} userId - User ID to filter by
 * @returns {Array} Groups of duplicate files
 */
function findDuplicateFiles(userId = null) {
  const userFilter = userId ? 'WHERE user_id = ?' : '';
  const params = userId ? [userId] : [];
  
  // Find files with same telegram_file_id (exact duplicates - same file uploaded multiple times)
  const exactDuplicates = query(`
    SELECT telegram_file_id, COUNT(*) as count, SUM(size) as total_size
    FROM files ${userFilter}
    GROUP BY telegram_file_id
    HAVING COUNT(*) > 1
  `, params);
  
  // Find files with same size and similar name (potential duplicates)
  const sizeDuplicates = query(`
    SELECT size, COUNT(*) as count
    FROM files ${userFilter}
    GROUP BY size
    HAVING COUNT(*) > 1 AND size > 1024
  `, params);
  
  const duplicateGroups = [];
  
  // Process exact duplicates
  for (const dup of exactDuplicates) {
    const files = query(
      `SELECT * FROM files WHERE telegram_file_id = ? ${userId ? 'AND user_id = ?' : ''} ORDER BY created_at ASC`,
      userId ? [dup.telegram_file_id, userId] : [dup.telegram_file_id]
    ).map(f => ({ ...f, starred: f.starred === 1, shared: f.shared === 1 }));
    
    if (files.length > 1) {
      duplicateGroups.push({
        type: 'exact',
        reason: 'نفس الملف (telegram_file_id متطابق)',
        fileCount: files.length,
        wastedSpace: dup.total_size - files[0].size,
        originalFile: files[0],
        duplicates: files.slice(1)
      });
    }
  }
  
  // Process size-based potential duplicates
  for (const dup of sizeDuplicates) {
    const files = query(
      `SELECT * FROM files WHERE size = ? ${userId ? 'AND user_id = ?' : ''} ORDER BY created_at ASC`,
      userId ? [dup.size, userId] : [dup.size]
    ).map(f => ({ ...f, starred: f.starred === 1, shared: f.shared === 1 }));
    
    // Group by similar names
    const nameGroups = {};
    for (const file of files) {
      // Normalize name (remove numbers, extensions, etc.)
      const normalizedName = file.name
        .toLowerCase()
        .replace(/\.[^.]+$/, '') // Remove extension
        .replace(/[\d_\-\(\)\[\]]+/g, '') // Remove numbers and special chars
        .trim();
      
      if (!nameGroups[normalizedName]) {
        nameGroups[normalizedName] = [];
      }
      nameGroups[normalizedName].push(file);
    }
    
    // Add groups with more than one file
    for (const [name, groupFiles] of Object.entries(nameGroups)) {
      if (groupFiles.length > 1 && name.length > 2) {
        // Check if not already in exact duplicates
        const isExact = duplicateGroups.some(g => 
          g.type === 'exact' && 
          g.originalFile.telegram_file_id === groupFiles[0].telegram_file_id
        );
        
        if (!isExact) {
          duplicateGroups.push({
            type: 'similar',
            reason: 'حجم متطابق واسم مشابه',
            fileCount: groupFiles.length,
            wastedSpace: (groupFiles.length - 1) * groupFiles[0].size,
            originalFile: groupFiles[0],
            duplicates: groupFiles.slice(1)
          });
        }
      }
    }
  }
  
  // Sort by wasted space (descending)
  duplicateGroups.sort((a, b) => b.wastedSpace - a.wastedSpace);
  
  return duplicateGroups;
}

/**
 * Get duplicate files summary
 * @param {string} userId 
 * @returns {Object} Summary statistics
 */
function getDuplicatesSummary(userId = null) {
  const duplicates = findDuplicateFiles(userId);
  
  const totalWastedSpace = duplicates.reduce((sum, g) => sum + g.wastedSpace, 0);
  const totalDuplicateFiles = duplicates.reduce((sum, g) => sum + g.duplicates.length, 0);
  const exactCount = duplicates.filter(g => g.type === 'exact').length;
  const similarCount = duplicates.filter(g => g.type === 'similar').length;
  
  return {
    totalGroups: duplicates.length,
    totalDuplicateFiles,
    totalWastedSpace,
    exactDuplicates: exactCount,
    similarDuplicates: similarCount,
    groups: duplicates
  };
}

/**
 * Delete duplicate files (keep original)
 * @param {Array} fileIds - IDs of files to delete
 * @param {string} userId - User ID for verification
 * @returns {Object} Result
 */
function deleteDuplicates(fileIds, userId = null) {
  if (!fileIds || fileIds.length === 0) {
    return { deleted: 0, freedSpace: 0 };
  }
  
  return safeTransaction(() => {
    let deleted = 0;
    let freedSpace = 0;
    
    for (const fileId of fileIds) {
      const file = getFileById(fileId);
      if (file && (!userId || file.user_id === userId)) {
        freedSpace += file.size || 0;
        execute('DELETE FROM files WHERE id = ?', [fileId]);
        deleted++;
      }
    }
    
    invalidateCache(['files']);
    
    return { deleted, freedSpace };
  });
}

// ============ STORAGE ANALYTICS ============
/**
 * Get storage analytics - distribution by file type
 * @param {string} userId 
 * @returns {Object} Analytics data
 */
function getStorageAnalytics(userId = null) {
  const userFilter = userId ? 'WHERE user_id = ?' : '';
  const params = userId ? [userId] : [];
  
  // Total storage
  const totalResult = queryOne(
    `SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as totalSize FROM files ${userFilter}`,
    params
  );
  
  // Distribution by type category
  const distribution = query(`
    SELECT 
      CASE 
        WHEN type LIKE 'image/%' THEN 'images'
        WHEN type LIKE 'video/%' THEN 'videos'
        WHEN type LIKE 'audio/%' THEN 'audio'
        WHEN type LIKE 'application/pdf%' THEN 'pdf'
        WHEN type LIKE '%document%' OR type LIKE '%word%' THEN 'documents'
        WHEN type LIKE '%sheet%' OR type LIKE '%excel%' THEN 'spreadsheets'
        WHEN type LIKE '%presentation%' OR type LIKE '%powerpoint%' THEN 'presentations'
        WHEN type LIKE '%zip%' OR type LIKE '%rar%' OR type LIKE '%7z%' OR type LIKE '%tar%' THEN 'archives'
        WHEN type LIKE 'text/%' THEN 'text'
        ELSE 'other'
      END as category,
      COUNT(*) as count,
      COALESCE(SUM(size), 0) as totalSize
    FROM files ${userFilter}
    GROUP BY category
    ORDER BY totalSize DESC
  `, params);
  
  // Add percentage and color
  const totalSize = totalResult?.totalSize || 0;
  const colors = {
    images: '#4285f4',
    videos: '#ea4335',
    audio: '#fbbc04',
    pdf: '#ff5722',
    documents: '#34a853',
    spreadsheets: '#0f9d58',
    presentations: '#ff9800',
    archives: '#9c27b0',
    text: '#607d8b',
    other: '#9e9e9e'
  };
  
  const labels = {
    images: 'الصور',
    videos: 'الفيديوهات',
    audio: 'الصوتيات',
    pdf: 'PDF',
    documents: 'المستندات',
    spreadsheets: 'جداول البيانات',
    presentations: 'العروض التقديمية',
    archives: 'الملفات المضغوطة',
    text: 'النصوص',
    other: 'أخرى'
  };
  
  const distributionWithMeta = distribution.map(d => ({
    ...d,
    percentage: totalSize > 0 ? Math.round((d.totalSize / totalSize) * 100) : 0,
    color: colors[d.category] || '#9e9e9e',
    label: labels[d.category] || d.category
  }));
  
  return {
    totalFiles: totalResult?.count || 0,
    totalSize: totalSize,
    distribution: distributionWithMeta
  };
}

/**
 * Get largest files
 * @param {string} userId 
 * @param {number} limit 
 * @returns {Array}
 */
function getLargestFiles(userId = null, limit = 10) {
  const userFilter = userId ? 'WHERE user_id = ?' : '';
  const params = userId ? [userId, limit] : [limit];
  
  return query(
    `SELECT id, name, size, type, created_at, folder_id 
     FROM files ${userFilter} 
     ORDER BY size DESC 
     LIMIT ?`,
    params
  );
}

/**
 * Get unused files (not accessed in X days)
 * @param {string} userId 
 * @param {number} days 
 * @param {number} limit 
 * @returns {Array}
 */
function getUnusedFiles(userId = null, days = 30, limit = 50) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  // Files not in recent_files or accessed before cutoff
  const userFilter = userId ? 'AND f.user_id = ?' : '';
  const params = userId ? [cutoffDate, userId, limit] : [cutoffDate, limit];
  
  return query(`
    SELECT f.id, f.name, f.size, f.type, f.created_at, f.folder_id,
           MAX(r.accessed_at) as last_accessed
    FROM files f
    LEFT JOIN recent_files r ON f.id = r.file_id
    WHERE (r.accessed_at IS NULL OR r.accessed_at < ?) ${userFilter}
    GROUP BY f.id
    ORDER BY f.size DESC
    LIMIT ?
  `, params);
}

/**
 * Get storage by folder
 * @param {string} userId 
 * @returns {Array}
 */
function getStorageByFolder(userId = null) {
  const userFilter = userId ? 'WHERE f.user_id = ?' : '';
  const params = userId ? [userId] : [];
  
  return query(`
    SELECT 
      COALESCE(fo.id, 'root') as folder_id,
      COALESCE(fo.name, 'الجذر') as folder_name,
      COUNT(f.id) as file_count,
      COALESCE(SUM(f.size), 0) as total_size
    FROM files f
    LEFT JOIN folders fo ON f.folder_id = fo.id
    ${userFilter}
    GROUP BY f.folder_id
    ORDER BY total_size DESC
    LIMIT 20
  `, params);
}

/**
 * Get full storage report
 * @param {string} userId 
 * @returns {Object}
 */
function getFullStorageReport(userId = null) {
  return {
    analytics: getStorageAnalytics(userId),
    largestFiles: getLargestFiles(userId, 10),
    unusedFiles: getUnusedFiles(userId, 30, 20),
    byFolder: getStorageByFolder(userId)
  };
}

// ============ TAGS SYSTEM ============

/**
 * Create a new tag
 */
function createTag(name, color, userId) {
  const id = require('crypto').randomUUID();
  try {
    execute(
      'INSERT INTO tags (id, name, color, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, name.trim(), color || '#1a73e8', userId, new Date().toISOString()]
    );
    return { id, name: name.trim(), color: color || '#1a73e8' };
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      throw new Error('هذا الوسم موجود بالفعل');
    }
    throw e;
  }
}

/**
 * Get all tags for a user
 */
function getTags(userId) {
  return query(
    `SELECT t.*, COUNT(ft.file_id) as file_count 
     FROM tags t 
     LEFT JOIN file_tags ft ON t.id = ft.tag_id 
     WHERE t.user_id = ? 
     GROUP BY t.id 
     ORDER BY t.name`,
    [userId]
  );
}

/**
 * Get tag by ID
 */
function getTagById(tagId) {
  return queryOne('SELECT * FROM tags WHERE id = ?', [tagId]);
}

/**
 * Update tag
 */
function updateTag(tagId, name, color, userId) {
  const tag = getTagById(tagId);
  if (!tag || tag.user_id !== userId) {
    throw new Error('الوسم غير موجود');
  }
  
  execute(
    'UPDATE tags SET name = ?, color = ? WHERE id = ?',
    [name.trim(), color, tagId]
  );
  
  return { id: tagId, name: name.trim(), color };
}

/**
 * Delete tag
 */
function deleteTag(tagId, userId) {
  const tag = getTagById(tagId);
  if (!tag || tag.user_id !== userId) {
    throw new Error('الوسم غير موجود');
  }
  
  // Delete tag associations first
  execute('DELETE FROM file_tags WHERE tag_id = ?', [tagId]);
  execute('DELETE FROM tags WHERE id = ?', [tagId]);
  
  return true;
}

/**
 * Add tag to file
 */
function addTagToFile(fileId, tagId, userId) {
  const tag = getTagById(tagId);
  if (!tag || tag.user_id !== userId) {
    throw new Error('الوسم غير موجود');
  }
  
  try {
    execute(
      'INSERT INTO file_tags (file_id, tag_id, created_at) VALUES (?, ?, ?)',
      [fileId, tagId, new Date().toISOString()]
    );
    return true;
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return true; // Already tagged
    }
    throw e;
  }
}

/**
 * Remove tag from file
 */
function removeTagFromFile(fileId, tagId) {
  execute('DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?', [fileId, tagId]);
  return true;
}

/**
 * Get tags for a file
 */
function getFileTags(fileId) {
  return query(
    `SELECT t.* FROM tags t 
     JOIN file_tags ft ON t.id = ft.tag_id 
     WHERE ft.file_id = ?`,
    [fileId]
  );
}

/**
 * Get files by tag
 */
function getFilesByTag(tagId, userId, options = {}) {
  const { page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;
  
  const files = query(
    `SELECT f.* FROM files f 
     JOIN file_tags ft ON f.id = ft.file_id 
     WHERE ft.tag_id = ? AND f.user_id = ?
     ORDER BY f.name
     LIMIT ? OFFSET ?`,
    [tagId, userId, limit, offset]
  ).map(f => ({ ...f, starred: f.starred === 1, shared: f.shared === 1 }));
  
  const total = queryOne(
    `SELECT COUNT(*) as count FROM file_tags ft 
     JOIN files f ON ft.file_id = f.id 
     WHERE ft.tag_id = ? AND f.user_id = ?`,
    [tagId, userId]
  );
  
  return {
    files,
    pagination: {
      page,
      limit,
      total: total?.count || 0,
      totalPages: Math.ceil((total?.count || 0) / limit)
    }
  };
}

/**
 * Search files by tags
 */
function searchByTags(tagIds, userId) {
  if (!tagIds || tagIds.length === 0) return [];
  
  const placeholders = tagIds.map(() => '?').join(',');
  
  return query(
    `SELECT DISTINCT f.* FROM files f 
     JOIN file_tags ft ON f.id = ft.file_id 
     WHERE ft.tag_id IN (${placeholders}) AND f.user_id = ?
     ORDER BY f.name`,
    [...tagIds, userId]
  ).map(f => ({ ...f, starred: f.starred === 1, shared: f.shared === 1 }));
}

/**
 * Bulk tag files
 */
function bulkTagFiles(fileIds, tagId, userId) {
  const tag = getTagById(tagId);
  if (!tag || tag.user_id !== userId) {
    throw new Error('الوسم غير موجود');
  }
  
  let added = 0;
  for (const fileId of fileIds) {
    try {
      execute(
        'INSERT INTO file_tags (file_id, tag_id, created_at) VALUES (?, ?, ?)',
        [fileId, tagId, new Date().toISOString()]
      );
      added++;
    } catch (e) {
      // Skip duplicates
    }
  }
  
  return { added };
}

// ============ FILE VERSIONS ============

const MAX_VERSIONS = 10; // Maximum versions to keep per file

/**
 * Create a new version of a file
 */
function createFileVersion(fileId, versionData) {
  const file = getFileById(fileId);
  if (!file) throw new Error('الملف غير موجود');
  
  // Get current version count
  const versions = query(
    'SELECT * FROM file_versions WHERE file_id = ? ORDER BY version_number DESC',
    [fileId]
  );
  
  const nextVersion = versions.length > 0 ? versions[0].version_number + 1 : 1;
  const id = require('crypto').randomUUID();
  
  execute(
    `INSERT INTO file_versions (id, file_id, version_number, name, size, type, telegram_file_id, telegram_message_id, user_id, created_at, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, fileId, nextVersion, versionData.name, versionData.size, versionData.type,
     versionData.telegram_file_id, versionData.telegram_message_id, versionData.user_id,
     new Date().toISOString(), versionData.comment || null]
  );
  
  // Clean old versions if exceeds max
  if (versions.length >= MAX_VERSIONS) {
    const toDelete = versions.slice(MAX_VERSIONS - 1);
    for (const v of toDelete) {
      execute('DELETE FROM file_versions WHERE id = ?', [v.id]);
    }
  }
  
  return { id, version_number: nextVersion };
}

/**
 * Get all versions of a file
 */
function getFileVersions(fileId) {
  return query(
    'SELECT * FROM file_versions WHERE file_id = ? ORDER BY version_number DESC',
    [fileId]
  );
}

/**
 * Get a specific version
 */
function getFileVersion(versionId) {
  return queryOne('SELECT * FROM file_versions WHERE id = ?', [versionId]);
}

/**
 * Restore a file to a specific version
 */
function restoreFileVersion(fileId, versionId, userId) {
  const version = getFileVersion(versionId);
  if (!version || version.file_id !== fileId) {
    throw new Error('الإصدار غير موجود');
  }
  
  const currentFile = getFileById(fileId);
  if (!currentFile) throw new Error('الملف غير موجود');
  
  // Save current as a new version before restoring
  createFileVersion(fileId, {
    name: currentFile.name,
    size: currentFile.size,
    type: currentFile.type,
    telegram_file_id: currentFile.telegram_file_id,
    telegram_message_id: currentFile.telegram_message_id,
    user_id: userId,
    comment: 'نسخة قبل الاستعادة'
  });
  
  // Update file with version data
  execute(
    `UPDATE files SET name = ?, size = ?, type = ?, telegram_file_id = ?, telegram_message_id = ?
     WHERE id = ?`,
    [version.name, version.size, version.type, version.telegram_file_id, version.telegram_message_id, fileId]
  );
  
  invalidateFileCache(fileId);
  return true;
}

/**
 * Delete a specific version
 */
function deleteFileVersion(versionId, userId) {
  const version = getFileVersion(versionId);
  if (!version) throw new Error('الإصدار غير موجود');
  
  execute('DELETE FROM file_versions WHERE id = ?', [versionId]);
  return true;
}

// ============ COMMENTS ============

/**
 * Add a comment to a file
 */
function addComment(fileId, userId, content, parentId = null) {
  const id = require('crypto').randomUUID();
  const now = new Date().toISOString();
  
  execute(
    `INSERT INTO comments (id, file_id, user_id, parent_id, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, fileId, userId, parentId, content, now, now]
  );
  
  return { id, file_id: fileId, user_id: userId, content, created_at: now };
}

/**
 * Get comments for a file
 */
function getFileComments(fileId) {
  const comments = query(
    'SELECT * FROM comments WHERE file_id = ? ORDER BY created_at ASC',
    [fileId]
  );
  
  // Build nested structure
  const commentMap = new Map();
  const rootComments = [];
  
  comments.forEach(c => {
    c.replies = [];
    commentMap.set(c.id, c);
  });
  
  comments.forEach(c => {
    if (c.parent_id && commentMap.has(c.parent_id)) {
      commentMap.get(c.parent_id).replies.push(c);
    } else {
      rootComments.push(c);
    }
  });
  
  return rootComments;
}

/**
 * Update a comment
 */
function updateComment(commentId, userId, content) {
  const comment = queryOne('SELECT * FROM comments WHERE id = ?', [commentId]);
  if (!comment) throw new Error('التعليق غير موجود');
  if (comment.user_id !== userId) throw new Error('غير مصرح');
  
  execute(
    'UPDATE comments SET content = ?, updated_at = ? WHERE id = ?',
    [content, new Date().toISOString(), commentId]
  );
  
  return true;
}

/**
 * Delete a comment
 */
function deleteComment(commentId, userId) {
  const comment = queryOne('SELECT * FROM comments WHERE id = ?', [commentId]);
  if (!comment) throw new Error('التعليق غير موجود');
  if (comment.user_id !== userId) throw new Error('غير مصرح');
  
  // Delete comment and all replies
  execute('DELETE FROM comments WHERE id = ? OR parent_id = ?', [commentId, commentId]);
  return true;
}

/**
 * Get comment count for a file
 */
function getCommentCount(fileId) {
  const result = queryOne('SELECT COUNT(*) as count FROM comments WHERE file_id = ?', [fileId]);
  return result?.count || 0;
}

// ============ COLLECTIONS ============

/**
 * Create a collection
 */
function createCollection(name, userId, options = {}) {
  const id = require('crypto').randomUUID();
  const now = new Date().toISOString();
  
  execute(
    `INSERT INTO collections (id, name, description, user_id, color, icon, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, options.description || null, userId, options.color || '#1a73e8', 
     options.icon || 'folder', now, now]
  );
  
  return { id, name, user_id: userId, created_at: now };
}

/**
 * Get user's collections
 */
function getCollections(userId) {
  const collections = query(
    'SELECT * FROM collections WHERE user_id = ? ORDER BY name',
    [userId]
  );
  
  // Add item count
  return collections.map(c => ({
    ...c,
    itemCount: queryOne(
      'SELECT COUNT(*) as count FROM collection_items WHERE collection_id = ?',
      [c.id]
    )?.count || 0
  }));
}

/**
 * Get a collection by ID
 */
function getCollectionById(collectionId) {
  return queryOne('SELECT * FROM collections WHERE id = ?', [collectionId]);
}

/**
 * Update a collection
 */
function updateCollection(collectionId, userId, updates) {
  const collection = getCollectionById(collectionId);
  if (!collection) throw new Error('المجموعة غير موجودة');
  if (collection.user_id !== userId) throw new Error('غير مصرح');
  
  const fields = [];
  const values = [];
  
  if (updates.name) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.color) { fields.push('color = ?'); values.push(updates.color); }
  if (updates.icon) { fields.push('icon = ?'); values.push(updates.icon); }
  
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(collectionId);
  
  execute(`UPDATE collections SET ${fields.join(', ')} WHERE id = ?`, values);
  return getCollectionById(collectionId);
}

/**
 * Delete a collection
 */
function deleteCollection(collectionId, userId) {
  const collection = getCollectionById(collectionId);
  if (!collection) throw new Error('المجموعة غير موجودة');
  if (collection.user_id !== userId) throw new Error('غير مصرح');
  
  execute('DELETE FROM collections WHERE id = ?', [collectionId]);
  return true;
}

/**
 * Add file to collection
 */
function addToCollection(collectionId, fileId, userId) {
  const collection = getCollectionById(collectionId);
  if (!collection) throw new Error('المجموعة غير موجودة');
  if (collection.user_id !== userId) throw new Error('غير مصرح');
  
  try {
    execute(
      'INSERT INTO collection_items (collection_id, file_id, added_at) VALUES (?, ?, ?)',
      [collectionId, fileId, new Date().toISOString()]
    );
    return true;
  } catch (e) {
    // Already exists
    return false;
  }
}

/**
 * Remove file from collection
 */
function removeFromCollection(collectionId, fileId, userId) {
  const collection = getCollectionById(collectionId);
  if (!collection) throw new Error('المجموعة غير موجودة');
  if (collection.user_id !== userId) throw new Error('غير مصرح');
  
  execute(
    'DELETE FROM collection_items WHERE collection_id = ? AND file_id = ?',
    [collectionId, fileId]
  );
  return true;
}

/**
 * Get files in a collection
 */
function getCollectionFiles(collectionId, userId, options = {}) {
  const collection = getCollectionById(collectionId);
  if (!collection) throw new Error('المجموعة غير موجودة');
  if (collection.user_id !== userId) throw new Error('غير مصرح');
  
  const { page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;
  
  const files = query(
    `SELECT f.*, ci.added_at as added_to_collection
     FROM files f
     JOIN collection_items ci ON f.id = ci.file_id
     WHERE ci.collection_id = ?
     ORDER BY ci.added_at DESC
     LIMIT ? OFFSET ?`,
    [collectionId, limit, offset]
  ).map(f => ({ ...f, starred: f.starred === 1, shared: f.shared === 1 }));
  
  const total = queryOne(
    'SELECT COUNT(*) as count FROM collection_items WHERE collection_id = ?',
    [collectionId]
  )?.count || 0;
  
  return {
    files,
    collection,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + files.length < total
    }
  };
}

/**
 * Get collections containing a file
 */
function getFileCollections(fileId, userId) {
  return query(
    `SELECT c.* FROM collections c
     JOIN collection_items ci ON c.id = ci.collection_id
     WHERE ci.file_id = ? AND c.user_id = ?`,
    [fileId, userId]
  );
}

// ============ CLOSE DATABASE ============
function closeDB() {
  if (db) {
    db.close();
    console.log('✅ Database closed');
  }
}

// ============ EXPORTS ============
module.exports = {
  initDB,
  closeDB,
  transaction,
  safeTransaction,

  // Raw query (for cursor pagination)
  query,
  queryOne,

  // Folders
  getFolders,
  getAllFolders,
  getFolderById,
  createFolder,
  updateFolderName,
  updateFolderParent,
  deleteFolder,
  deleteFoldersByParent,

  // Files
  getFiles,
  getFileById,
  createFile,
  updateFileName,
  updateFileFolder,
  deleteFile,
  deleteFilesByFolder,
  searchFiles,
  searchFolders,

  // Advanced Search
  advancedSearch,
  getSearchSuggestions,
  getFileTypeStats,

  // Starred
  toggleStar,
  getStarredFiles,

  // Trash
  moveFileToTrash,
  moveFolderToTrash,
  getTrashItems,
  restoreFromTrash,
  deleteFromTrash,
  emptyTrash,

  // Recent
  addRecentFile,
  getRecentFiles,

  // Sharing
  shareFile,
  unshareFile,
  getSharedFile,
  shareFolder,
  unshareFolder,
  getSharedFolder,
  getFolderShares,
  getUserSharedFolders,
  getSharedWithMe,

  // Storage
  getTotalSize,

  // Activity
  logActivity,
  getActivityLog,

  // Orphan files
  assignOrphanFilesToUser,

  // Backup
  createBackup,
  restoreFromBackup,
  listBackups,

  // Cache
  invalidateCache,

  // Statistics
  getStats,
  getCacheStats,

  // Share by ID
  getFileByShareId,

  // Alias
  addToRecent,

  // Duplicates
  findDuplicateFiles,
  getDuplicatesSummary,
  deleteDuplicates,

  // Storage Analytics
  getStorageAnalytics,
  getLargestFiles,
  getUnusedFiles,
  getStorageByFolder,
  getFullStorageReport,

  // Tags
  createTag,
  getTags,
  getTagById,
  updateTag,
  deleteTag,
  addTagToFile,
  removeTagFromFile,
  getFileTags,
  getFilesByTag,
  searchByTags,
  bulkTagFiles,

  // File Versions
  createFileVersion,
  getFileVersions,
  getFileVersion,
  restoreFileVersion,
  deleteFileVersion,

  // Comments
  addComment,
  getFileComments,
  updateComment,
  deleteComment,
  getCommentCount,

  // Collections
  createCollection,
  getCollections,
  getCollectionById,
  updateCollection,
  deleteCollection,
  addToCollection,
  removeFromCollection,
  getCollectionFiles,
  getFileCollections
};
