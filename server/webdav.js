/**
 * WebDAV Server Module - Telegram Cloud Storage
 * يسمح بربط التخزين السحابي كقرص شبكي في Windows/Mac/Linux
 * الملفات ترفع مباشرة لـ Telegram = تخزين غير محدود!
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { createReadStream, createWriteStream } = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { pipeline } = require('stream/promises');
const os = require('os');

// WebDAV Methods
const WEBDAV_METHODS = ['PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE', 'LOCK', 'UNLOCK'];

// ============ إعدادات التخزين المحسنة للسرعة ============
const STORAGE_CONFIG = {
  // استخدام مجلد temp للملفات المؤقتة
  tempDir: path.join(os.tmpdir(), 'cloud-storage-temp'),
  // حجم Buffer ضخم للسرعة القصوى (64MB)
  highWaterMark: 64 * 1024 * 1024,
  // رفع مباشر لـ Telegram
  uploadToTelegram: true,
  // حذف الملف المؤقت بعد الرفع
  deleteAfterUpload: true,
  // عدد الرفع المتوازي
  maxConcurrentUploads: 5,
  // تأخير بين الرفع (لتجنب rate limit)
  uploadDelay: 100
};

// إنشاء مجلد temp إذا ما موجود
fs.mkdir(STORAGE_CONFIG.tempDir, { recursive: true }).catch(() => {});

// ============ نظام الرفع المتوازي ============
const uploadQueue = [];
let activeUploads = 0;

async function processUploadQueue() {
  while (uploadQueue.length > 0 && activeUploads < STORAGE_CONFIG.maxConcurrentUploads) {
    const task = uploadQueue.shift();
    activeUploads++;
    
    task.execute()
      .finally(() => {
        activeUploads--;
        // معالجة المهمة التالية
        setTimeout(processUploadQueue, STORAGE_CONFIG.uploadDelay);
      });
  }
}

function queueUpload(task) {
  return new Promise((resolve, reject) => {
    uploadQueue.push({
      execute: async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
    });
    processUploadQueue();
  });
}

/**
 * إنشاء WebDAV Router
 */
function createWebDAVRouter(uploadsPath, db, bot, channelId) {
  // db هنا هو database module وليس database instance
  // نستخدم db.query و db.queryOne بدلاً من db.prepare
  const router = express.Router();

  // دعم methods الخاصة بـ WebDAV
  router.use((req, res, next) => {
    res.set({
      'DAV': '1, 2',
      'MS-Author-Via': 'DAV',
      'Allow': 'OPTIONS, GET, HEAD, POST, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE'
    });
    next();
  });

  // OPTIONS - للتحقق من الدعم
  router.options('*', (req, res) => {
    res.status(200).end();
  });

  // PROPFIND - قراءة خصائص الملفات والمجلدات
  router.all('*', async (req, res, next) => {
    if (req.method !== 'PROPFIND') return next();

    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).set('WWW-Authenticate', 'Basic realm="Cloud Storage"').end();
      }

      const requestPath = decodeURIComponent(req.path) || '/';
      const depth = req.headers['depth'] || 'infinity';

      // الحصول على الملفات والمجلدات
      const items = await getItemsForPath(db, userId, requestPath, depth);
      
      // بناء XML Response
      const xml = buildPropfindResponse(items, req);
      
      res.status(207)
        .set('Content-Type', 'application/xml; charset=utf-8')
        .send(xml);

    } catch (error) {
      console.error('PROPFIND error:', error);
      res.status(500).end();
    }
  });

  // GET - تحميل ملف (من Telegram أو محلي)
  router.get('*', async (req, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).set('WWW-Authenticate', 'Basic realm="Cloud Storage"').end();
      }

      const requestPath = decodeURIComponent(req.path);
      const file = await getFileByPath(db, userId, requestPath);

      if (!file) {
        return res.status(404).end();
      }

      res.set({
        'Content-Type': file.type || 'application/octet-stream',
        'Content-Length': file.size,
        'ETag': `"${file.id}"`,
        'Last-Modified': new Date(file.created_at).toUTCString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      });

      // التحقق إذا الملف على Telegram (file_id طويل) أو محلي
      const isOnTelegram = file.telegram_file_id && 
                          file.telegram_file_id.length > 50 && 
                          !file.telegram_file_id.includes('-');

      if (isOnTelegram && bot) {
        // تحميل من Telegram
        try {
          const fileLink = await bot.telegram.getFileLink(file.telegram_file_id);
          const https = require('https');
          const http = require('http');
          const protocol = fileLink.href.startsWith('https') ? https : http;
          
          protocol.get(fileLink.href, (telegramRes) => {
            telegramRes.pipe(res);
          }).on('error', (err) => {
            console.error('Telegram download error:', err);
            res.status(500).end();
          });
        } catch (telegramError) {
          console.error('GET Telegram error:', telegramError);
          res.status(500).end();
        }
      } else {
        // تحميل من الملف المحلي
        const filePath = path.join(uploadsPath, file.telegram_file_id || file.id);
        
        const readStream = createReadStream(filePath, {
          highWaterMark: STORAGE_CONFIG.highWaterMark
        });
        
        readStream.on('error', () => {
          res.status(404).end();
        });
        
        readStream.pipe(res);
      }

    } catch (error) {
      console.error('GET error:', error);
      res.status(500).end();
    }
  });

  // PUT - رفع ملف مباشرة لـ Telegram بدون تخزين محلي! 🚀
  router.put('*', async (req, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).set('WWW-Authenticate', 'Basic realm="Cloud Storage"').end();
      }

      const requestPath = decodeURIComponent(req.path);
      const filename = path.basename(requestPath);
      const folderPath = path.dirname(requestPath);

      // الحصول على المجلد الأب
      const parentFolder = await getFolderByPath(db, userId, folderPath);
      const folderId = parentFolder?.id || null;

      // التحقق من وجود ملف بنفس الاسم
      const existingFile = await getFileByPath(db, userId, requestPath);

      // تجميع البيانات في الذاكرة (RAM) بدلاً من الهارد ديسك
      const chunks = [];
      let totalSize = 0;

      await new Promise((resolve, reject) => {
        req.on('data', (chunk) => {
          chunks.push(chunk);
          totalSize += chunk.length;
        });
        req.on('end', resolve);
        req.on('error', reject);
      });

      const fileBuffer = Buffer.concat(chunks);
      const mimeType = getMimeType(filename);

      let telegramFileId = null;
      let telegramMessageId = null;

      // رفع مباشر لـ Telegram من الذاكرة (بدون حفظ على الهارد!)
      if (bot && channelId) {
        try {
          const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
          console.log(`📤 WebDAV: Streaming to Telegram: ${filename} (${sizeMB} MB) - No local storage!`);
          
          const uploadTask = async () => {
            return await bot.telegram.sendDocument(channelId, {
              source: fileBuffer,
              filename: filename
            }, {
              caption: `📁 ${filename}\n👤 User: ${userId}\n📅 ${new Date().toLocaleString('ar-SA')}`
            });
          };
          
          const result = totalSize < 10 * 1024 * 1024 
            ? await uploadTask()
            : await queueUpload(uploadTask);

          telegramFileId = result.document.file_id;
          telegramMessageId = result.message_id;
          
          console.log(`✅ WebDAV: Uploaded to Telegram: ${filename} (${sizeMB} MB) - Zero local storage used!`);
          
        } catch (telegramError) {
          console.error('❌ WebDAV Telegram upload error:', telegramError.message);
          return res.status(500).send('Telegram upload failed: ' + telegramError.message);
        }
      } else {
        // لا يوجد بوت - نرفض الرفع لأن المستخدم لا يريد تخزين محلي
        console.error('❌ No Telegram bot configured - cannot upload without local storage');
        return res.status(503).send('Telegram bot not configured. Local storage disabled.');
      }

      // حذف الملف القديم إذا موجود
      if (existingFile) {
        db.deleteFile(existingFile.id);
      }
      
      // إنشاء سجل الملف
      const fileId = uuidv4();
      
      db.createFile({
        id: fileId,
        name: filename,
        size: totalSize,
        type: mimeType,
        telegram_file_id: telegramFileId,
        telegram_message_id: telegramMessageId,
        folder_id: folderId,
        user_id: userId,
        created_at: new Date().toISOString()
      });

      res.status(existingFile ? 204 : 201).end();

    } catch (error) {
      console.error('PUT error:', error);
      res.status(500).end();
    }
  });

  // DELETE - حذف ملف أو مجلد
  router.delete('*', async (req, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).set('WWW-Authenticate', 'Basic realm="Cloud Storage"').end();
      }

      const requestPath = decodeURIComponent(req.path);

      // محاولة حذف كملف
      const file = await getFileByPath(db, userId, requestPath);
      if (file) {
        db.deleteFile(file.id);
        try {
          await fs.unlink(path.join(uploadsPath, file.telegram_file_id || file.id));
        } catch (e) {}
        return res.status(204).end();
      }

      // محاولة حذف كمجلد
      const folder = await getFolderByPath(db, userId, requestPath);
      if (folder) {
        // حذف المحتويات أولاً
        await deleteFolderContents(db, userId, folder.id, uploadsPath);
        db.deleteFolder(folder.id);
        return res.status(204).end();
      }

      res.status(404).end();

    } catch (error) {
      console.error('DELETE error:', error);
      res.status(500).end();
    }
  });

  // MKCOL - إنشاء مجلد
  router.all('*', async (req, res, next) => {
    if (req.method !== 'MKCOL') return next();

    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).set('WWW-Authenticate', 'Basic realm="Cloud Storage"').end();
      }

      const requestPath = decodeURIComponent(req.path);
      const folderName = path.basename(requestPath);
      const parentPath = path.dirname(requestPath);

      // الحصول على المجلد الأب
      const parentFolder = await getFolderByPath(db, userId, parentPath);
      const parentId = parentFolder?.id || null;

      // التحقق من عدم وجود مجلد بنفس الاسم
      let existing;
      if (parentId === null) {
        existing = db.queryOne(
          'SELECT id FROM folders WHERE user_id = ? AND name = ? AND parent_id IS NULL',
          [userId, folderName]
        );
      } else {
        existing = db.queryOne(
          'SELECT id FROM folders WHERE user_id = ? AND name = ? AND parent_id = ?',
          [userId, folderName, parentId]
        );
      }

      if (existing) {
        return res.status(405).end(); // Method Not Allowed - already exists
      }

      // إنشاء المجلد
      const folderId = uuidv4();
      db.createFolder(folderId, folderName, parentId, new Date().toISOString(), userId);

      res.status(201).end();

    } catch (error) {
      console.error('MKCOL error:', error);
      res.status(500).end();
    }
  });

  // MOVE - نقل ملف أو مجلد
  router.all('*', async (req, res, next) => {
    if (req.method !== 'MOVE') return next();

    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).set('WWW-Authenticate', 'Basic realm="Cloud Storage"').end();
      }

      const sourcePath = decodeURIComponent(req.path);
      const destHeader = req.headers['destination'];
      if (!destHeader) {
        return res.status(400).end();
      }

      const destUrl = new URL(destHeader);
      const destPath = decodeURIComponent(destUrl.pathname.replace(/^\/webdav/, ''));
      const newName = path.basename(destPath);
      const newParentPath = path.dirname(destPath);

      // الحصول على المجلد الجديد
      const newParent = await getFolderByPath(db, userId, newParentPath);
      const newParentId = newParent?.id || null;

      // محاولة نقل كملف
      const file = await getFileByPath(db, userId, sourcePath);
      if (file) {
        db.updateFileName(file.id, newName);
        db.updateFileFolder(file.id, newParentId);
        return res.status(201).end();
      }

      // محاولة نقل كمجلد
      const folder = await getFolderByPath(db, userId, sourcePath);
      if (folder) {
        db.updateFolderName(folder.id, newName);
        db.updateFolderParent(folder.id, newParentId);
        return res.status(201).end();
      }

      res.status(404).end();

    } catch (error) {
      console.error('MOVE error:', error);
      res.status(500).end();
    }
  });

  // COPY - نسخ ملف
  router.all('*', async (req, res, next) => {
    if (req.method !== 'COPY') return next();

    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).set('WWW-Authenticate', 'Basic realm="Cloud Storage"').end();
      }

      const sourcePath = decodeURIComponent(req.path);
      const destHeader = req.headers['destination'];
      if (!destHeader) {
        return res.status(400).end();
      }

      const destUrl = new URL(destHeader);
      const destPath = decodeURIComponent(destUrl.pathname.replace(/^\/webdav/, ''));
      const newName = path.basename(destPath);
      const newParentPath = path.dirname(destPath);

      const newParent = await getFolderByPath(db, userId, newParentPath);
      const newParentId = newParent?.id || null;

      const file = await getFileByPath(db, userId, sourcePath);
      if (file) {
        // نسخ الملف الفعلي باستخدام streaming للملفات الكبيرة
        const newFilename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(newName)}`;
        const srcPath = path.join(uploadsPath, file.telegram_file_id || file.id);
        const destPath = path.join(uploadsPath, newFilename);
        
        // استخدام pipeline مع buffer كبير للنسخ السريع
        const readStream = createReadStream(srcPath, { highWaterMark: PERFORMANCE_CONFIG.highWaterMark });
        const writeStream = createWriteStream(destPath, { highWaterMark: PERFORMANCE_CONFIG.highWaterMark });
        await pipeline(readStream, writeStream);

        // إنشاء سجل جديد
        const newFileId = uuidv4();
        db.createFile({
          id: newFileId,
          name: newName,
          size: file.size,
          type: file.type,
          telegram_file_id: newFilename,
          telegram_message_id: null,
          folder_id: newParentId,
          user_id: userId,
          created_at: new Date().toISOString()
        });

        return res.status(201).end();
      }

      res.status(404).end();

    } catch (error) {
      console.error('COPY error:', error);
      res.status(500).end();
    }
  });

  return router;
}

// ==================== Helper Functions ====================

async function getItemsForPath(db, userId, requestPath, depth) {
  const items = [];
  
  if (requestPath === '/' || requestPath === '') {
    // Root folder
    items.push({
      href: '/webdav/',
      isCollection: true,
      name: 'Cloud Storage',
      created: new Date(),
      modified: new Date(),
      size: 0
    });

    if (depth !== '0') {
      // Get root folders - استخدام db.query بدلاً من db.prepare
      const folders = db.query(
        'SELECT * FROM folders WHERE user_id = ? AND parent_id IS NULL',
        [userId]
      );

      for (const folder of folders) {
        items.push({
          href: `/webdav/${encodeURIComponent(folder.name)}/`,
          isCollection: true,
          name: folder.name,
          created: new Date(folder.created_at),
          modified: new Date(folder.created_at),
          size: 0
        });
      }

      // Get root files - استخدام db.query
      const files = db.query(
        'SELECT * FROM files WHERE user_id = ? AND folder_id IS NULL',
        [userId]
      );

      for (const file of files) {
        items.push({
          href: `/webdav/${encodeURIComponent(file.name)}`,
          isCollection: false,
          name: file.name,
          created: new Date(file.created_at),
          modified: new Date(file.created_at),
          size: file.size,
          mimeType: file.type
        });
      }
    }
  } else {
    // Specific path
    const folder = await getFolderByPath(db, userId, requestPath);
    
    if (folder) {
      items.push({
        href: `/webdav${requestPath}/`,
        isCollection: true,
        name: folder.name,
        created: new Date(folder.created_at),
        modified: new Date(folder.created_at),
        size: 0
      });

      if (depth !== '0') {
        // Get subfolders
        const subfolders = db.query(
          'SELECT * FROM folders WHERE user_id = ? AND parent_id = ?',
          [userId, folder.id]
        );

        for (const sub of subfolders) {
          items.push({
            href: `/webdav${requestPath}/${encodeURIComponent(sub.name)}/`,
            isCollection: true,
            name: sub.name,
            created: new Date(sub.created_at),
            modified: new Date(sub.created_at),
            size: 0
          });
        }

        // Get files
        const files = db.query(
          'SELECT * FROM files WHERE user_id = ? AND folder_id = ?',
          [userId, folder.id]
        );

        for (const file of files) {
          items.push({
            href: `/webdav${requestPath}/${encodeURIComponent(file.name)}`,
            isCollection: false,
            name: file.name,
            created: new Date(file.created_at),
            modified: new Date(file.created_at),
            size: file.size,
            mimeType: file.type
          });
        }
      }
    } else {
      // Check if it's a file
      const file = await getFileByPath(db, userId, requestPath);
      if (file) {
        items.push({
          href: `/webdav${requestPath}`,
          isCollection: false,
          name: file.name,
          created: new Date(file.created_at),
          modified: new Date(file.created_at),
          size: file.size,
          mimeType: file.type
        });
      }
    }
  }

  return items;
}

async function getFolderByPath(db, userId, folderPath) {
  if (!folderPath || folderPath === '/' || folderPath === '') return null;

  const parts = folderPath.split('/').filter(p => p);
  let currentFolder = null;
  let parentId = null;

  for (const part of parts) {
    if (parentId === null) {
      currentFolder = db.queryOne(
        'SELECT * FROM folders WHERE user_id = ? AND name = ? AND parent_id IS NULL',
        [userId, part]
      );
    } else {
      currentFolder = db.queryOne(
        'SELECT * FROM folders WHERE user_id = ? AND name = ? AND parent_id = ?',
        [userId, part, parentId]
      );
    }

    if (!currentFolder) return null;
    parentId = currentFolder.id;
  }

  return currentFolder;
}

async function getFileByPath(db, userId, filePath) {
  if (!filePath || filePath === '/') return null;

  const parts = filePath.split('/').filter(p => p);
  const filename = parts.pop();
  const folderPath = '/' + parts.join('/');

  const folder = await getFolderByPath(db, userId, folderPath);
  const folderId = folder?.id || null;

  if (folderId === null) {
    return db.queryOne(
      'SELECT * FROM files WHERE user_id = ? AND name = ? AND folder_id IS NULL',
      [userId, filename]
    );
  } else {
    return db.queryOne(
      'SELECT * FROM files WHERE user_id = ? AND name = ? AND folder_id = ?',
      [userId, filename, folderId]
    );
  }
}

async function deleteFolderContents(db, userId, folderId, uploadsPath) {
  // Delete files
  const files = db.query('SELECT * FROM files WHERE folder_id = ?', [folderId]);
  for (const file of files) {
    try {
      await fs.unlink(path.join(uploadsPath, file.telegram_file_id || file.id));
    } catch (e) {}
  }
  db.deleteFilesByFolder(folderId);

  // Delete subfolders recursively
  const subfolders = db.query('SELECT * FROM folders WHERE parent_id = ?', [folderId]);
  for (const sub of subfolders) {
    await deleteFolderContents(db, userId, sub.id, uploadsPath);
    db.deleteFolder(sub.id);
  }
}

function buildPropfindResponse(items, req) {
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<D:multistatus xmlns:D="DAV:">\n';

  for (const item of items) {
    xml += '  <D:response>\n';
    xml += `    <D:href>${item.href}</D:href>\n`;
    xml += '    <D:propstat>\n';
    xml += '      <D:prop>\n';
    xml += `        <D:displayname>${escapeXml(item.name)}</D:displayname>\n`;
    xml += `        <D:creationdate>${item.created.toISOString()}</D:creationdate>\n`;
    xml += `        <D:getlastmodified>${item.modified.toUTCString()}</D:getlastmodified>\n`;
    
    if (item.isCollection) {
      xml += '        <D:resourcetype><D:collection/></D:resourcetype>\n';
    } else {
      xml += '        <D:resourcetype/>\n';
      xml += `        <D:getcontentlength>${item.size}</D:getcontentlength>\n`;
      xml += `        <D:getcontenttype>${item.mimeType || 'application/octet-stream'}</D:getcontenttype>\n`;
    }
    
    xml += '      </D:prop>\n';
    xml += '      <D:status>HTTP/1.1 200 OK</D:status>\n';
    xml += '    </D:propstat>\n';
    xml += '  </D:response>\n';
  }

  xml += '</D:multistatus>';
  return xml;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain', '.html': 'text/html', '.css': 'text/css',
    '.js': 'application/javascript', '.json': 'application/json',
    '.xml': 'application/xml', '.zip': 'application/zip',
    '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.avi': 'video/x-msvideo'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

module.exports = { createWebDAVRouter, WEBDAV_METHODS };
