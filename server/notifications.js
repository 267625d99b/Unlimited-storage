/**
 * Notifications System
 * نظام الإشعارات
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NOTIFICATIONS_FILE = path.join(__dirname, '.notifications.json');

// In-memory notifications store
let notificationsData = { notifications: [], settings: {} };

// ============ NOTIFICATION TYPES ============
const NOTIFICATION_TYPES = {
  FILE_SHARED: 'file_shared',
  FILE_UPLOADED: 'file_uploaded',
  FILE_DELETED: 'file_deleted',
  FOLDER_SHARED: 'folder_shared',
  STORAGE_WARNING: 'storage_warning',
  SECURITY_ALERT: 'security_alert',
  SYSTEM_UPDATE: 'system_update',
  LOGIN_NEW_DEVICE: 'login_new_device',
  PASSWORD_CHANGED: 'password_changed'
};

// ============ DATA MANAGEMENT ============
function loadNotifications() {
  try {
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      notificationsData = JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading notifications:', e);
  }
  return notificationsData;
}

function saveNotifications() {
  try {
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notificationsData, null, 2));
  } catch (e) {
    console.error('Error saving notifications:', e);
  }
}

// Initialize
loadNotifications();

// ============ NOTIFICATION CRUD ============

/**
 * Create a new notification
 * @param {object} options
 * @returns {object} notification
 */
function createNotification({ userId, type, title, message, data = {}, priority = 'normal' }) {
  const notification = {
    id: crypto.randomUUID(),
    userId,
    type,
    title,
    message,
    data,
    priority, // low, normal, high, urgent
    read: false,
    createdAt: new Date().toISOString()
  };
  
  notificationsData.notifications.push(notification);
  saveNotifications();
  
  // Trigger real-time notification if WebSocket connected
  broadcastNotification(userId, notification);
  
  return notification;
}

/**
 * Get notifications for a user
 * @param {string} userId 
 * @param {object} options 
 * @returns {object}
 */
function getNotifications(userId, options = {}) {
  loadNotifications();
  
  const { page = 1, limit = 20, unreadOnly = false, type = null } = options;
  
  let notifications = notificationsData.notifications
    .filter(n => n.userId === userId)
    .filter(n => !unreadOnly || !n.read)
    .filter(n => !type || n.type === type)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const total = notifications.length;
  const start = (page - 1) * limit;
  notifications = notifications.slice(start, start + limit);
  
  const unreadCount = notificationsData.notifications
    .filter(n => n.userId === userId && !n.read).length;
  
  return {
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Mark notification as read
 * @param {string} notificationId 
 * @param {string} userId 
 * @returns {boolean}
 */
function markAsRead(notificationId, userId) {
  loadNotifications();
  
  const notification = notificationsData.notifications
    .find(n => n.id === notificationId && n.userId === userId);
  
  if (notification) {
    notification.read = true;
    notification.readAt = new Date().toISOString();
    saveNotifications();
    return true;
  }
  return false;
}

/**
 * Mark all notifications as read
 * @param {string} userId 
 * @returns {number} count of marked notifications
 */
function markAllAsRead(userId) {
  loadNotifications();
  
  let count = 0;
  notificationsData.notifications.forEach(n => {
    if (n.userId === userId && !n.read) {
      n.read = true;
      n.readAt = new Date().toISOString();
      count++;
    }
  });
  
  saveNotifications();
  return count;
}

/**
 * Delete notification
 * @param {string} notificationId 
 * @param {string} userId 
 * @returns {boolean}
 */
function deleteNotification(notificationId, userId) {
  loadNotifications();
  
  const index = notificationsData.notifications
    .findIndex(n => n.id === notificationId && n.userId === userId);
  
  if (index !== -1) {
    notificationsData.notifications.splice(index, 1);
    saveNotifications();
    return true;
  }
  return false;
}

/**
 * Delete all notifications for user
 * @param {string} userId 
 */
function clearNotifications(userId) {
  loadNotifications();
  notificationsData.notifications = notificationsData.notifications
    .filter(n => n.userId !== userId);
  saveNotifications();
}

// ============ NOTIFICATION SETTINGS ============

/**
 * Get user notification settings
 * @param {string} userId 
 * @returns {object}
 */
function getNotificationSettings(userId) {
  loadNotifications();
  return notificationsData.settings[userId] || {
    email: true,
    push: true,
    inApp: true,
    types: {
      [NOTIFICATION_TYPES.FILE_SHARED]: true,
      [NOTIFICATION_TYPES.FILE_UPLOADED]: false,
      [NOTIFICATION_TYPES.FILE_DELETED]: false,
      [NOTIFICATION_TYPES.FOLDER_SHARED]: true,
      [NOTIFICATION_TYPES.STORAGE_WARNING]: true,
      [NOTIFICATION_TYPES.SECURITY_ALERT]: true,
      [NOTIFICATION_TYPES.SYSTEM_UPDATE]: true,
      [NOTIFICATION_TYPES.LOGIN_NEW_DEVICE]: true,
      [NOTIFICATION_TYPES.PASSWORD_CHANGED]: true
    }
  };
}

/**
 * Update user notification settings
 * @param {string} userId 
 * @param {object} settings 
 */
function updateNotificationSettings(userId, settings) {
  loadNotifications();
  notificationsData.settings[userId] = {
    ...getNotificationSettings(userId),
    ...settings
  };
  saveNotifications();
}

// ============ WEBSOCKET SUPPORT ============
const connectedClients = new Map(); // userId -> Set of WebSocket connections

/**
 * Register WebSocket connection
 * @param {string} userId 
 * @param {WebSocket} ws 
 */
function registerConnection(userId, ws) {
  if (!connectedClients.has(userId)) {
    connectedClients.set(userId, new Set());
  }
  connectedClients.get(userId).add(ws);
}

/**
 * Unregister WebSocket connection
 * @param {string} userId 
 * @param {WebSocket} ws 
 */
function unregisterConnection(userId, ws) {
  if (connectedClients.has(userId)) {
    connectedClients.get(userId).delete(ws);
    if (connectedClients.get(userId).size === 0) {
      connectedClients.delete(userId);
    }
  }
}

/**
 * Broadcast notification to user's connected clients
 * @param {string} userId 
 * @param {object} notification 
 */
function broadcastNotification(userId, notification) {
  const settings = getNotificationSettings(userId);
  
  // Check if this notification type is enabled
  if (!settings.inApp || !settings.types[notification.type]) {
    return;
  }
  
  const clients = connectedClients.get(userId);
  if (clients) {
    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });
    
    clients.forEach(ws => {
      try {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(message);
        }
      } catch (e) {
        console.error('Error sending notification:', e);
      }
    });
  }
}

/**
 * Broadcast to all connected users
 * @param {object} notification 
 */
function broadcastToAll(notification) {
  connectedClients.forEach((clients, userId) => {
    broadcastNotification(userId, { ...notification, userId });
  });
}

// ============ HELPER FUNCTIONS ============

/**
 * Notify file shared
 */
function notifyFileShared(userId, fileName, sharedBy) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.FILE_SHARED,
    title: 'ملف جديد تمت مشاركته معك',
    message: `قام ${sharedBy} بمشاركة "${fileName}" معك`,
    data: { fileName, sharedBy }
  });
}

/**
 * Notify folder shared
 */
function notifyFolderShared(userId, folderName, sharedBy) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.FOLDER_SHARED,
    title: 'مجلد جديد تمت مشاركته معك',
    message: `قام ${sharedBy} بمشاركة مجلد "${folderName}" معك`,
    data: { folderName, sharedBy }
  });
}

/**
 * Notify storage warning
 */
function notifyStorageWarning(userId, usedPercent) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.STORAGE_WARNING,
    title: 'تحذير: مساحة التخزين',
    message: `لقد استخدمت ${usedPercent}% من مساحة التخزين المتاحة`,
    data: { usedPercent },
    priority: 'high'
  });
}

/**
 * Notify security alert
 */
function notifySecurityAlert(userId, alertType, details) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.SECURITY_ALERT,
    title: 'تنبيه أمني',
    message: details,
    data: { alertType },
    priority: 'urgent'
  });
}

/**
 * Notify new device login
 */
function notifyNewDeviceLogin(userId, deviceInfo) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.LOGIN_NEW_DEVICE,
    title: 'تسجيل دخول من جهاز جديد',
    message: `تم تسجيل الدخول من ${deviceInfo.platform || 'جهاز غير معروف'}`,
    data: deviceInfo,
    priority: 'high'
  });
}

// Clean old notifications periodically (keep last 100 per user)
setInterval(() => {
  loadNotifications();
  const userNotifications = {};
  
  notificationsData.notifications.forEach(n => {
    if (!userNotifications[n.userId]) {
      userNotifications[n.userId] = [];
    }
    userNotifications[n.userId].push(n);
  });
  
  let cleaned = 0;
  Object.keys(userNotifications).forEach(userId => {
    const sorted = userNotifications[userId]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (sorted.length > 100) {
      const toRemove = sorted.slice(100);
      toRemove.forEach(n => {
        const index = notificationsData.notifications.findIndex(x => x.id === n.id);
        if (index !== -1) {
          notificationsData.notifications.splice(index, 1);
          cleaned++;
        }
      });
    }
  });
  
  if (cleaned > 0) {
    saveNotifications();
    console.log(`🗑️ Cleaned ${cleaned} old notifications`);
  }
}, 24 * 60 * 60 * 1000); // Daily

// ============ EXPORTS ============
module.exports = {
  NOTIFICATION_TYPES,
  
  // CRUD
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearNotifications,
  
  // Settings
  getNotificationSettings,
  updateNotificationSettings,
  
  // WebSocket
  registerConnection,
  unregisterConnection,
  broadcastNotification,
  broadcastToAll,
  
  // Helpers
  notifyFileShared,
  notifyFolderShared,
  notifyStorageWarning,
  notifySecurityAlert,
  notifyNewDeviceLogin
};
