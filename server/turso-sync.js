/**
 * Turso Cloud Sync Module
 * مزامنة البيانات مع Turso للحفاظ عليها بشكل دائم
 */

const { createClient } = require('@libsql/client');

let tursoClient = null;

// Initialize Turso client
function initTurso() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.log('ℹ️ Turso not configured - using local SQLite only');
    return null;
  }

  try {
    tursoClient = createClient({
      url,
      authToken
    });
    console.log('✅ Turso cloud database connected');
    return tursoClient;
  } catch (err) {
    console.error('❌ Turso connection failed:', err.message);
    return null;
  }
}

// Create tables in Turso
async function createTursoTables() {
  if (!tursoClient) return;

  try {
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        size INTEGER DEFAULT 0,
        telegram_file_id TEXT,
        telegram_message_id INTEGER,
        folder_id TEXT,
        user_id TEXT,
        starred INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        tags TEXT,
        metadata TEXT
      )
    `);

    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        user_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        color TEXT
      )
    `);

    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        display_name TEXT,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        created_at TEXT,
        updated_at TEXT,
        preferences TEXT
      )
    `);

    // Add telegram_message_id column if not exists
    try {
      await tursoClient.execute('ALTER TABLE files ADD COLUMN telegram_message_id INTEGER');
    } catch (e) {
      // Column already exists
    }

    console.log('✅ Turso tables created');
  } catch (err) {
    console.error('❌ Error creating Turso tables:', err.message);
  }
}

// Sync file to Turso
async function syncFile(file) {
  if (!tursoClient) {
    console.log('⚠️ Turso client not initialized, cannot sync file');
    return;
  }

  try {
    console.log(`☁️ Syncing file to Turso: ${file.name} (ID: ${file.id})`);
    
    await tursoClient.execute({
      sql: `INSERT OR REPLACE INTO files 
            (id, name, type, size, telegram_file_id, telegram_message_id, folder_id, user_id, starred, created_at, updated_at, deleted_at, tags, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        file.id,
        file.name,
        file.type,
        file.size || 0,
        file.telegram_file_id,
        file.telegram_message_id || null,
        file.folder_id || null,
        file.user_id || null,
        file.starred ? 1 : 0,
        file.created_at,
        file.updated_at || new Date().toISOString(),
        file.deleted_at || null,
        JSON.stringify(file.tags || []),
        JSON.stringify(file.metadata || {})
      ]
    });
    console.log(`✅ Synced to Turso: ${file.name}`);
  } catch (err) {
    console.error(`❌ Turso sync file error for ${file.name}:`, err.message);
    console.error('Full error:', err);
  }
}

// Sync folder to Turso
async function syncFolder(folder) {
  if (!tursoClient) return;

  try {
    await tursoClient.execute({
      sql: `INSERT OR REPLACE INTO folders 
            (id, name, parent_id, user_id, created_at, updated_at, deleted_at, color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        folder.id,
        folder.name,
        folder.parent_id,
        folder.user_id,
        folder.created_at,
        folder.updated_at,
        folder.deleted_at,
        folder.color
      ]
    });
  } catch (err) {
    console.error('Turso sync folder error:', err.message);
  }
}

// Sync user to Turso
async function syncUser(user) {
  if (!tursoClient) return;

  try {
    await tursoClient.execute({
      sql: `INSERT OR REPLACE INTO users 
            (id, username, email, password_hash, display_name, role, status, created_at, updated_at, preferences)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        user.id,
        user.username,
        user.email,
        user.passwordHash,
        user.displayName,
        user.role,
        user.status || 'active',
        user.createdAt,
        user.updatedAt,
        JSON.stringify(user.preferences || {})
      ]
    });
  } catch (err) {
    console.error('Turso sync user error:', err.message);
  }
}

// Delete file from Turso
async function deleteFileFromTurso(fileId) {
  if (!tursoClient) return;

  try {
    await tursoClient.execute({
      sql: 'DELETE FROM files WHERE id = ?',
      args: [fileId]
    });
  } catch (err) {
    console.error('Turso delete file error:', err.message);
  }
}

// Delete folder from Turso
async function deleteFolderFromTurso(folderId) {
  if (!tursoClient) return;

  try {
    await tursoClient.execute({
      sql: 'DELETE FROM folders WHERE id = ?',
      args: [folderId]
    });
  } catch (err) {
    console.error('Turso delete folder error:', err.message);
  }
}

// Restore data from Turso (on server start)
async function restoreFromTurso(localDb) {
  if (!tursoClient) {
    console.log('⚠️ Turso client not initialized, skipping restore');
    return { files: 0, folders: 0, users: 0 };
  }

  try {
    let restored = { files: 0, folders: 0, users: 0 };

    console.log('🔄 Restoring data from Turso cloud...');

    // Get counts from Turso
    const tursoFilesCount = await tursoClient.execute('SELECT COUNT(*) as count FROM files WHERE deleted_at IS NULL');
    const tursoFoldersCount = await tursoClient.execute('SELECT COUNT(*) as count FROM folders WHERE deleted_at IS NULL');
    
    console.log(`📊 Turso has: ${tursoFilesCount.rows[0]?.count || 0} files, ${tursoFoldersCount.rows[0]?.count || 0} folders`);

    // Restore folders first
    const folders = await tursoClient.execute('SELECT * FROM folders WHERE deleted_at IS NULL');
    console.log(`📁 Restoring ${folders.rows.length} folders...`);
    
    for (const folder of folders.rows) {
      try {
        localDb.prepare(`
          INSERT OR REPLACE INTO folders (id, name, parent_id, user_id, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(folder.id, folder.name, folder.parent_id, folder.user_id, folder.created_at);
        restored.folders++;
      } catch (e) {
        console.error(`❌ Failed to restore folder ${folder.name}:`, e.message);
      }
    }

    // Restore files
    const files = await tursoClient.execute('SELECT * FROM files WHERE deleted_at IS NULL');
    console.log(`📄 Restoring ${files.rows.length} files...`);
    
    for (const file of files.rows) {
      try {
        localDb.prepare(`
          INSERT OR REPLACE INTO files (id, name, type, size, telegram_file_id, telegram_message_id, folder_id, user_id, starred, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          file.id, 
          file.name, 
          file.type, 
          file.size, 
          file.telegram_file_id, 
          file.telegram_message_id || null, 
          file.folder_id, 
          file.user_id, 
          file.starred || 0, 
          file.created_at
        );
        restored.files++;
      } catch (e) {
        console.error(`❌ Failed to restore file ${file.name}:`, e.message);
      }
    }

    console.log(`✅ Restored from Turso: ${restored.files} files, ${restored.folders} folders`);

    return restored;
  } catch (err) {
    console.error('❌ Turso restore error:', err.message);
    console.error('Full error:', err);
    return { files: 0, folders: 0, users: 0 };
  }
}

// Full sync to Turso (backup all local data)
async function fullSyncToTurso(localDb) {
  if (!tursoClient) return;

  try {
    console.log('🔄 Full sync to Turso cloud...');

    // Sync all files
    const files = localDb.prepare('SELECT * FROM files').all();
    for (const file of files) {
      await syncFile(file);
    }

    // Sync all folders
    const folders = localDb.prepare('SELECT * FROM folders').all();
    for (const folder of folders) {
      await syncFolder(folder);
    }

    console.log(`✅ Synced to Turso: ${files.length} files, ${folders.length} folders`);
  } catch (err) {
    console.error('❌ Turso full sync error:', err.message);
  }
}

module.exports = {
  initTurso,
  createTursoTables,
  syncFile,
  syncFolder,
  syncUser,
  deleteFileFromTurso,
  deleteFolderFromTurso,
  restoreFromTurso,
  fullSyncToTurso,
  get client() { return tursoClient; }
};
