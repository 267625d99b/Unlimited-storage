/**
 * Real-time Collaboration Module
 * نظام التعاون الفوري
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============ CONFIGURATION ============
const COLLAB_FILE = path.join(__dirname, '.collaboration.json');

// ============ DATA STRUCTURES ============
let collabData = {
  sessions: [],      // جلسات التعاون النشطة
  presence: {},      // من يشاهد ماذا
  cursors: {},       // مواقع المؤشرات
  mentions: [],      // الإشارات (@mentions)
  liveComments: []   // التعليقات الحية
};

// Active WebSocket connections per file
const fileConnections = new Map(); // fileId -> Set of { ws, userId, username, color }

// User colors for collaboration
const COLORS = [
  '#1a73e8', '#ea4335', '#34a853', '#fbbc04', '#9c27b0',
  '#00bcd4', '#ff5722', '#795548', '#607d8b', '#e91e63'
];

function loadCollabData() {
  try {
    if (fs.existsSync(COLLAB_FILE)) {
      collabData = JSON.parse(fs.readFileSync(COLLAB_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading collaboration data:', e);
  }
  return collabData;
}

function saveCollabData() {
  try {
    fs.writeFileSync(COLLAB_FILE, JSON.stringify(collabData, null, 2));
  } catch (e) {
    console.error('Error saving collaboration data:', e);
  }
}

// Initialize
loadCollabData();

// ============ PRESENCE SYSTEM ============

/**
 * User joins file viewing/editing
 */
function joinFile(fileId, userId, username, ws) {
  if (!fileConnections.has(fileId)) {
    fileConnections.set(fileId, new Set());
  }

  // Assign color
  const connections = fileConnections.get(fileId);
  const usedColors = Array.from(connections).map(c => c.color);
  const availableColor = COLORS.find(c => !usedColors.includes(c)) || COLORS[connections.size % COLORS.length];

  const connection = { ws, userId, username, color: availableColor, joinedAt: Date.now() };
  connections.add(connection);

  // Update presence
  if (!collabData.presence[fileId]) {
    collabData.presence[fileId] = [];
  }
  
  // Remove existing presence for this user
  collabData.presence[fileId] = collabData.presence[fileId].filter(p => p.userId !== userId);
  
  collabData.presence[fileId].push({
    userId,
    username,
    color: availableColor,
    joinedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  });

  saveCollabData();

  // Broadcast presence update to all viewers
  broadcastToFile(fileId, {
    type: 'presence_update',
    data: {
      action: 'joined',
      user: { userId, username, color: availableColor },
      viewers: getFileViewers(fileId)
    }
  }, userId);

  return { color: availableColor, viewers: getFileViewers(fileId) };
}

/**
 * User leaves file
 */
function leaveFile(fileId, userId) {
  const connections = fileConnections.get(fileId);
  if (connections) {
    // Remove connection
    for (const conn of connections) {
      if (conn.userId === userId) {
        connections.delete(conn);
        break;
      }
    }

    if (connections.size === 0) {
      fileConnections.delete(fileId);
    }
  }

  // Update presence
  if (collabData.presence[fileId]) {
    collabData.presence[fileId] = collabData.presence[fileId].filter(p => p.userId !== userId);
    if (collabData.presence[fileId].length === 0) {
      delete collabData.presence[fileId];
    }
  }

  // Remove cursor
  if (collabData.cursors[fileId]) {
    delete collabData.cursors[fileId][userId];
  }

  saveCollabData();

  // Broadcast presence update
  broadcastToFile(fileId, {
    type: 'presence_update',
    data: {
      action: 'left',
      userId,
      viewers: getFileViewers(fileId)
    }
  });
}

/**
 * Get current file viewers
 */
function getFileViewers(fileId) {
  return collabData.presence[fileId] || [];
}

/**
 * Update user activity
 */
function updateActivity(fileId, userId) {
  if (collabData.presence[fileId]) {
    const user = collabData.presence[fileId].find(p => p.userId === userId);
    if (user) {
      user.lastActivity = new Date().toISOString();
      saveCollabData();
    }
  }
}

// ============ CURSOR SHARING ============

/**
 * Update cursor position
 */
function updateCursor(fileId, userId, username, position, selection = null) {
  if (!collabData.cursors[fileId]) {
    collabData.cursors[fileId] = {};
  }

  const userPresence = collabData.presence[fileId]?.find(p => p.userId === userId);
  const color = userPresence?.color || COLORS[0];

  collabData.cursors[fileId][userId] = {
    userId,
    username,
    color,
    position, // { line, column } or { x, y }
    selection, // { start, end } for text selection
    updatedAt: new Date().toISOString()
  };

  // Broadcast cursor update
  broadcastToFile(fileId, {
    type: 'cursor_update',
    data: {
      userId,
      username,
      color,
      position,
      selection
    }
  }, userId);
}

/**
 * Get all cursors for file
 */
function getFileCursors(fileId) {
  return collabData.cursors[fileId] || {};
}

// ============ REAL-TIME EDITING ============

/**
 * Create collaboration session
 */
function createSession(fileId, fileName, ownerId, ownerName) {
  loadCollabData();

  // Check for existing session
  const existing = collabData.sessions.find(s => s.fileId === fileId && s.status === 'active');
  if (existing) {
    return existing;
  }

  const session = {
    id: crypto.randomUUID(),
    fileId,
    fileName,
    ownerId,
    ownerName,
    participants: [{
      userId: ownerId,
      username: ownerName,
      role: 'owner',
      joinedAt: new Date().toISOString()
    }],
    operations: [], // Operation log for conflict resolution
    version: 0,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  collabData.sessions.push(session);
  saveCollabData();

  return session;
}

/**
 * Join collaboration session
 */
function joinSession(sessionId, userId, username) {
  loadCollabData();

  const session = collabData.sessions.find(s => s.id === sessionId);
  if (!session) {
    throw new Error('الجلسة غير موجودة');
  }

  if (session.status !== 'active') {
    throw new Error('الجلسة غير نشطة');
  }

  // Check if already participant
  if (!session.participants.some(p => p.userId === userId)) {
    session.participants.push({
      userId,
      username,
      role: 'editor',
      joinedAt: new Date().toISOString()
    });
    saveCollabData();
  }

  return session;
}

/**
 * Apply operation (for OT - Operational Transformation)
 */
function applyOperation(sessionId, userId, operation) {
  loadCollabData();

  const session = collabData.sessions.find(s => s.id === sessionId);
  if (!session) {
    throw new Error('الجلسة غير موجودة');
  }

  // Add operation to log
  const op = {
    id: crypto.randomUUID(),
    userId,
    operation, // { type: 'insert'|'delete'|'replace', position, content, length }
    version: session.version,
    timestamp: new Date().toISOString()
  };

  session.operations.push(op);
  session.version++;

  // Keep only last 1000 operations
  if (session.operations.length > 1000) {
    session.operations = session.operations.slice(-1000);
  }

  saveCollabData();

  // Broadcast operation to other participants
  broadcastToFile(session.fileId, {
    type: 'operation',
    data: op
  }, userId);

  return op;
}

/**
 * Get session operations since version
 */
function getOperationsSince(sessionId, sinceVersion) {
  loadCollabData();

  const session = collabData.sessions.find(s => s.id === sessionId);
  if (!session) return [];

  return session.operations.filter(op => op.version >= sinceVersion);
}

/**
 * End collaboration session
 */
function endSession(sessionId, userId) {
  loadCollabData();

  const session = collabData.sessions.find(s => s.id === sessionId);
  if (!session) {
    throw new Error('الجلسة غير موجودة');
  }

  if (session.ownerId !== userId) {
    throw new Error('فقط مالك الجلسة يمكنه إنهاءها');
  }

  session.status = 'ended';
  session.endedAt = new Date().toISOString();

  // Notify all participants
  broadcastToFile(session.fileId, {
    type: 'session_ended',
    data: { sessionId }
  });

  saveCollabData();

  return true;
}


// ============ @MENTIONS ============

/**
 * Create mention
 */
function createMention({
  fileId,
  fileName,
  mentionedUserId,
  mentionedUsername,
  mentionedBy,
  mentionedByName,
  context,      // النص المحيط بالإشارة
  position      // موقع الإشارة في الملف
}) {
  loadCollabData();

  const mention = {
    id: crypto.randomUUID(),
    fileId,
    fileName,
    mentionedUserId,
    mentionedUsername,
    mentionedBy,
    mentionedByName,
    context,
    position,
    read: false,
    createdAt: new Date().toISOString()
  };

  collabData.mentions.push(mention);
  saveCollabData();

  // Notify mentioned user via WebSocket
  broadcastToUser(mentionedUserId, {
    type: 'mention',
    data: mention
  });

  return mention;
}

/**
 * Get mentions for user
 */
function getUserMentions(userId, unreadOnly = false) {
  loadCollabData();
  
  return collabData.mentions
    .filter(m => m.mentionedUserId === userId && (!unreadOnly || !m.read))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Mark mention as read
 */
function markMentionRead(mentionId, userId) {
  loadCollabData();

  const mention = collabData.mentions.find(m => 
    m.id === mentionId && m.mentionedUserId === userId
  );

  if (mention) {
    mention.read = true;
    mention.readAt = new Date().toISOString();
    saveCollabData();
    return true;
  }

  return false;
}

/**
 * Mark all mentions as read
 */
function markAllMentionsRead(userId) {
  loadCollabData();

  let count = 0;
  collabData.mentions.forEach(m => {
    if (m.mentionedUserId === userId && !m.read) {
      m.read = true;
      m.readAt = new Date().toISOString();
      count++;
    }
  });

  saveCollabData();
  return count;
}

// ============ LIVE COMMENTS ============

/**
 * Add live comment (real-time)
 */
function addLiveComment({
  fileId,
  userId,
  username,
  content,
  position,     // موقع التعليق في الملف
  parentId = null
}) {
  loadCollabData();

  const userPresence = collabData.presence[fileId]?.find(p => p.userId === userId);
  const color = userPresence?.color || COLORS[0];

  const comment = {
    id: crypto.randomUUID(),
    fileId,
    userId,
    username,
    color,
    content,
    position,
    parentId,
    resolved: false,
    createdAt: new Date().toISOString()
  };

  collabData.liveComments.push(comment);
  saveCollabData();

  // Broadcast to file viewers
  broadcastToFile(fileId, {
    type: 'live_comment',
    data: comment
  });

  // Check for mentions in comment
  const mentionRegex = /@(\w+)/g;
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    // This would need user lookup by username
    // For now, just log it
    console.log(`Mention detected: @${match[1]}`);
  }

  return comment;
}

/**
 * Get live comments for file
 */
function getFileComments(fileId) {
  loadCollabData();
  
  return collabData.liveComments
    .filter(c => c.fileId === fileId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/**
 * Resolve comment
 */
function resolveComment(commentId, userId) {
  loadCollabData();

  const comment = collabData.liveComments.find(c => c.id === commentId);
  if (comment) {
    comment.resolved = true;
    comment.resolvedBy = userId;
    comment.resolvedAt = new Date().toISOString();
    saveCollabData();

    // Broadcast resolution
    broadcastToFile(comment.fileId, {
      type: 'comment_resolved',
      data: { commentId, resolvedBy: userId }
    });

    return true;
  }

  return false;
}

/**
 * Delete live comment
 */
function deleteLiveComment(commentId, userId) {
  loadCollabData();

  const index = collabData.liveComments.findIndex(c => 
    c.id === commentId && c.userId === userId
  );

  if (index !== -1) {
    const comment = collabData.liveComments[index];
    collabData.liveComments.splice(index, 1);
    saveCollabData();

    // Broadcast deletion
    broadcastToFile(comment.fileId, {
      type: 'comment_deleted',
      data: { commentId }
    });

    return true;
  }

  return false;
}

// ============ BROADCASTING ============

// User connections for direct messaging
const userConnections = new Map(); // userId -> Set of WebSocket

/**
 * Register user connection
 */
function registerUserConnection(userId, ws) {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId).add(ws);
}

/**
 * Unregister user connection
 */
function unregisterUserConnection(userId, ws) {
  if (userConnections.has(userId)) {
    userConnections.get(userId).delete(ws);
    if (userConnections.get(userId).size === 0) {
      userConnections.delete(userId);
    }
  }
}

/**
 * Broadcast to all viewers of a file
 */
function broadcastToFile(fileId, message, excludeUserId = null) {
  const connections = fileConnections.get(fileId);
  if (!connections) return;

  const messageStr = JSON.stringify(message);

  connections.forEach(conn => {
    if (excludeUserId && conn.userId === excludeUserId) return;
    
    try {
      if (conn.ws.readyState === 1) { // WebSocket.OPEN
        conn.ws.send(messageStr);
      }
    } catch (e) {
      console.error('Error broadcasting to file:', e);
    }
  });
}

/**
 * Broadcast to specific user
 */
function broadcastToUser(userId, message) {
  const connections = userConnections.get(userId);
  if (!connections) return;

  const messageStr = JSON.stringify(message);

  connections.forEach(ws => {
    try {
      if (ws.readyState === 1) {
        ws.send(messageStr);
      }
    } catch (e) {
      console.error('Error broadcasting to user:', e);
    }
  });
}

// ============ CLEANUP ============

// Clean up stale presence data periodically
setInterval(() => {
  loadCollabData();
  const staleThreshold = Date.now() - 5 * 60 * 1000; // 5 minutes
  let cleaned = 0;

  Object.keys(collabData.presence).forEach(fileId => {
    const before = collabData.presence[fileId].length;
    collabData.presence[fileId] = collabData.presence[fileId].filter(p => 
      new Date(p.lastActivity).getTime() > staleThreshold
    );
    cleaned += before - collabData.presence[fileId].length;

    if (collabData.presence[fileId].length === 0) {
      delete collabData.presence[fileId];
    }
  });

  // Clean old sessions
  const sessionThreshold = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
  collabData.sessions = collabData.sessions.filter(s => 
    s.status === 'active' || new Date(s.endedAt || s.createdAt).getTime() > sessionThreshold
  );

  // Clean old mentions (keep last 30 days)
  const mentionThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
  collabData.mentions = collabData.mentions.filter(m => 
    new Date(m.createdAt).getTime() > mentionThreshold
  );

  if (cleaned > 0) {
    saveCollabData();
    console.log(`🧹 Cleaned ${cleaned} stale presence entries`);
  }
}, 60 * 1000); // Every minute

// ============ EXPORTS ============
module.exports = {
  // Presence
  joinFile,
  leaveFile,
  getFileViewers,
  updateActivity,

  // Cursors
  updateCursor,
  getFileCursors,

  // Sessions
  createSession,
  joinSession,
  applyOperation,
  getOperationsSince,
  endSession,

  // Mentions
  createMention,
  getUserMentions,
  markMentionRead,
  markAllMentionsRead,

  // Live Comments
  addLiveComment,
  getFileComments,
  resolveComment,
  deleteLiveComment,

  // Connections
  registerUserConnection,
  unregisterUserConnection,
  broadcastToFile,
  broadcastToUser,

  // Data access
  fileConnections,
  userConnections
};
