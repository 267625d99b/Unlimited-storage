/**
 * Push Notifications Module
 * نظام إشعارات الدفع (Web Push)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============ CONFIGURATION ============
const SUBSCRIPTIONS_FILE = path.join(__dirname, '.push-subscriptions.json');

// VAPID keys should be generated once and stored in environment
// Generate with: npx web-push generate-vapid-keys
const VAPID_CONFIG = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'UUxI4O8-FbRouAf7-fGI7cYLNXijL3YRcSdNbt_fJc4',
  subject: process.env.VAPID_SUBJECT || 'mailto:admin@cloudstorage.local'
};

// ============ DATA MANAGEMENT ============
let subscriptionsData = {
  subscriptions: []
};

function loadSubscriptions() {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      subscriptionsData = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading push subscriptions:', e);
  }
  return subscriptionsData;
}

function saveSubscriptions() {
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptionsData, null, 2));
  } catch (e) {
    console.error('Error saving push subscriptions:', e);
  }
}

// Initialize
loadSubscriptions();

// ============ SUBSCRIPTION MANAGEMENT ============

/**
 * Save push subscription
 */
function saveSubscription(userId, subscription, deviceInfo = {}) {
  loadSubscriptions();

  // Check if subscription already exists
  const existing = subscriptionsData.subscriptions.find(s => 
    s.endpoint === subscription.endpoint
  );

  if (existing) {
    // Update existing
    existing.userId = userId;
    existing.keys = subscription.keys;
    existing.deviceInfo = deviceInfo;
    existing.updatedAt = new Date().toISOString();
  } else {
    // Add new
    subscriptionsData.subscriptions.push({
      id: crypto.randomUUID(),
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      deviceInfo,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  saveSubscriptions();
  return true;
}

/**
 * Remove push subscription
 */
function removeSubscription(endpoint) {
  loadSubscriptions();

  const index = subscriptionsData.subscriptions.findIndex(s => s.endpoint === endpoint);
  if (index !== -1) {
    subscriptionsData.subscriptions.splice(index, 1);
    saveSubscriptions();
    return true;
  }

  return false;
}

/**
 * Get user subscriptions
 */
function getUserSubscriptions(userId) {
  loadSubscriptions();
  return subscriptionsData.subscriptions.filter(s => s.userId === userId && s.active);
}

/**
 * Deactivate subscription (on failure)
 */
function deactivateSubscription(endpoint) {
  loadSubscriptions();

  const subscription = subscriptionsData.subscriptions.find(s => s.endpoint === endpoint);
  if (subscription) {
    subscription.active = false;
    subscription.deactivatedAt = new Date().toISOString();
    saveSubscriptions();
  }
}

// ============ PUSH SENDING ============

/**
 * Send push notification to user
 */
async function sendPushNotification(userId, notification) {
  const subscriptions = getUserSubscriptions(userId);
  
  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message || notification.body,
    icon: notification.icon || '/icons/icon-192x192.png',
    badge: notification.badge || '/icons/badge-72x72.png',
    tag: notification.tag || notification.type,
    data: {
      url: notification.url || '/',
      ...notification.data
    },
    actions: notification.actions || [],
    requireInteraction: notification.priority === 'urgent' || notification.priority === 'high',
    timestamp: Date.now()
  });

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await sendWebPush(subscription, payload);
      sent++;
    } catch (e) {
      console.error('Push notification failed:', e.message);
      failed++;
      
      // Deactivate on permanent failure
      if (e.statusCode === 404 || e.statusCode === 410) {
        deactivateSubscription(subscription.endpoint);
      }
    }
  }

  return { sent, failed };
}

/**
 * Send Web Push (simplified implementation)
 * In production, use 'web-push' npm package
 */
async function sendWebPush(subscription, payload) {
  // This is a simplified implementation
  // For production, use the 'web-push' npm package:
  // const webpush = require('web-push');
  // webpush.setVapidDetails(VAPID_CONFIG.subject, VAPID_CONFIG.publicKey, VAPID_CONFIG.privateKey);
  // await webpush.sendNotification(subscription, payload);

  const https = require('https');
  const url = new URL(subscription.endpoint);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': Buffer.byteLength(payload),
        'TTL': '86400'
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve({ statusCode: res.statusCode });
      } else {
        const error = new Error(`Push failed with status ${res.statusCode}`);
        error.statusCode = res.statusCode;
        reject(error);
      }
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send push to multiple users
 */
async function sendPushToUsers(userIds, notification) {
  const results = {};

  for (const userId of userIds) {
    results[userId] = await sendPushNotification(userId, notification);
  }

  return results;
}

/**
 * Send push to all users
 */
async function sendPushToAll(notification) {
  loadSubscriptions();

  const uniqueUserIds = [...new Set(
    subscriptionsData.subscriptions
      .filter(s => s.active)
      .map(s => s.userId)
  )];

  return await sendPushToUsers(uniqueUserIds, notification);
}

// ============ VAPID KEYS ============

/**
 * Get VAPID public key (for client)
 */
function getVapidPublicKey() {
  return VAPID_CONFIG.publicKey;
}

// ============ EXPORTS ============
module.exports = {
  // Subscriptions
  saveSubscription,
  removeSubscription,
  getUserSubscriptions,
  deactivateSubscription,

  // Sending
  sendPushNotification,
  sendPushToUsers,
  sendPushToAll,

  // Config
  getVapidPublicKey
};
