/**
 * Webhooks Module
 * نظام الـ Webhooks للتكامل الخارجي
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ============ CONFIGURATION ============
const WEBHOOKS_FILE = path.join(__dirname, '.webhooks.json');

// Webhook Events
const WEBHOOK_EVENTS = {
  FILE_UPLOADED: 'file.uploaded',
  FILE_DELETED: 'file.deleted',
  FILE_SHARED: 'file.shared',
  FILE_DOWNLOADED: 'file.downloaded',
  FOLDER_CREATED: 'folder.created',
  FOLDER_DELETED: 'folder.deleted',
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  SHARE_CREATED: 'share.created',
  SHARE_ACCESSED: 'share.accessed',
  COMMENT_ADDED: 'comment.added',
  TEAM_CREATED: 'team.created',
  TEAM_MEMBER_ADDED: 'team.member_added'
};

// ============ DATA MANAGEMENT ============
let webhooksData = {
  webhooks: [],
  deliveries: []
};

function loadWebhooks() {
  try {
    if (fs.existsSync(WEBHOOKS_FILE)) {
      webhooksData = JSON.parse(fs.readFileSync(WEBHOOKS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading webhooks:', e);
  }
  return webhooksData;
}

function saveWebhooks() {
  try {
    fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify(webhooksData, null, 2));
  } catch (e) {
    console.error('Error saving webhooks:', e);
  }
}

// Initialize
loadWebhooks();

// ============ WEBHOOK CRUD ============

/**
 * Create webhook
 */
function createWebhook({
  userId,
  name,
  url,
  events,
  secret = null,
  headers = {},
  active = true
}) {
  loadWebhooks();

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error('رابط غير صالح');
  }

  // Validate events
  const validEvents = Object.values(WEBHOOK_EVENTS);
  const invalidEvents = events.filter(e => !validEvents.includes(e));
  if (invalidEvents.length > 0) {
    throw new Error(`أحداث غير صالحة: ${invalidEvents.join(', ')}`);
  }

  // Generate secret if not provided
  const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

  const webhook = {
    id: crypto.randomUUID(),
    userId,
    name,
    url,
    events,
    secret: webhookSecret,
    headers,
    active,
    failureCount: 0,
    lastDelivery: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  webhooksData.webhooks.push(webhook);
  saveWebhooks();

  return webhook;
}

/**
 * Get user webhooks
 */
function getUserWebhooks(userId) {
  loadWebhooks();
  return webhooksData.webhooks.filter(w => w.userId === userId);
}

/**
 * Get webhook by ID
 */
function getWebhook(webhookId, userId) {
  loadWebhooks();
  return webhooksData.webhooks.find(w => w.id === webhookId && w.userId === userId);
}

/**
 * Update webhook
 */
function updateWebhook(webhookId, updates, userId) {
  loadWebhooks();

  const webhook = webhooksData.webhooks.find(w => w.id === webhookId && w.userId === userId);
  if (!webhook) {
    throw new Error('الـ Webhook غير موجود');
  }

  const allowedUpdates = ['name', 'url', 'events', 'headers', 'active'];
  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      webhook[key] = updates[key];
    }
  }

  webhook.updatedAt = new Date().toISOString();
  saveWebhooks();

  return webhook;
}

/**
 * Delete webhook
 */
function deleteWebhook(webhookId, userId) {
  loadWebhooks();

  const index = webhooksData.webhooks.findIndex(w => w.id === webhookId && w.userId === userId);
  if (index === -1) {
    throw new Error('الـ Webhook غير موجود');
  }

  webhooksData.webhooks.splice(index, 1);
  saveWebhooks();

  return true;
}

/**
 * Regenerate webhook secret
 */
function regenerateSecret(webhookId, userId) {
  loadWebhooks();

  const webhook = webhooksData.webhooks.find(w => w.id === webhookId && w.userId === userId);
  if (!webhook) {
    throw new Error('الـ Webhook غير موجود');
  }

  webhook.secret = crypto.randomBytes(32).toString('hex');
  webhook.updatedAt = new Date().toISOString();
  saveWebhooks();

  return webhook;
}

// ============ WEBHOOK DELIVERY ============

/**
 * Generate signature for payload
 */
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

/**
 * Deliver webhook
 */
async function deliverWebhook(webhook, event, payload) {
  const deliveryId = crypto.randomUUID();
  const timestamp = Date.now();

  const body = {
    id: deliveryId,
    event,
    timestamp,
    data: payload
  };

  const signature = generateSignature(body, webhook.secret);

  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-ID': webhook.id,
    'X-Webhook-Event': event,
    'X-Webhook-Signature': `sha256=${signature}`,
    'X-Webhook-Timestamp': timestamp.toString(),
    'X-Delivery-ID': deliveryId,
    ...webhook.headers
  };

  const delivery = {
    id: deliveryId,
    webhookId: webhook.id,
    event,
    url: webhook.url,
    requestHeaders: headers,
    requestBody: body,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  try {
    const response = await sendRequest(webhook.url, headers, body);
    
    delivery.status = response.statusCode >= 200 && response.statusCode < 300 ? 'success' : 'failed';
    delivery.responseStatus = response.statusCode;
    delivery.responseHeaders = response.headers;
    delivery.responseBody = response.body;
    delivery.completedAt = new Date().toISOString();

    // Update webhook stats
    webhook.lastDelivery = new Date().toISOString();
    if (delivery.status === 'failed') {
      webhook.failureCount++;
      // Disable after 10 consecutive failures
      if (webhook.failureCount >= 10) {
        webhook.active = false;
        console.log(`⚠️ Webhook ${webhook.id} disabled after 10 failures`);
      }
    } else {
      webhook.failureCount = 0;
    }

  } catch (e) {
    delivery.status = 'error';
    delivery.error = e.message;
    delivery.completedAt = new Date().toISOString();
    webhook.failureCount++;
  }

  // Save delivery
  webhooksData.deliveries.push(delivery);
  
  // Keep only last 100 deliveries per webhook
  const webhookDeliveries = webhooksData.deliveries.filter(d => d.webhookId === webhook.id);
  if (webhookDeliveries.length > 100) {
    const toRemove = webhookDeliveries.slice(0, webhookDeliveries.length - 100);
    webhooksData.deliveries = webhooksData.deliveries.filter(d => !toRemove.includes(d));
  }

  saveWebhooks();

  return delivery;
}

/**
 * Send HTTP request
 */
function sendRequest(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers,
      timeout: 30000 // 30 seconds
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data.substring(0, 1000) // Limit response body
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Trigger event for all matching webhooks
 */
async function triggerEvent(event, payload, userId = null) {
  loadWebhooks();

  // Find matching webhooks
  const matchingWebhooks = webhooksData.webhooks.filter(w => 
    w.active && 
    w.events.includes(event) &&
    (!userId || w.userId === userId)
  );

  const results = [];

  for (const webhook of matchingWebhooks) {
    try {
      const delivery = await deliverWebhook(webhook, event, payload);
      results.push({ webhookId: webhook.id, delivery });
    } catch (e) {
      results.push({ webhookId: webhook.id, error: e.message });
    }
  }

  return results;
}

/**
 * Get webhook deliveries
 */
function getWebhookDeliveries(webhookId, userId, limit = 20) {
  loadWebhooks();

  // Verify ownership
  const webhook = webhooksData.webhooks.find(w => w.id === webhookId && w.userId === userId);
  if (!webhook) {
    return [];
  }

  return webhooksData.deliveries
    .filter(d => d.webhookId === webhookId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

/**
 * Retry delivery
 */
async function retryDelivery(deliveryId, userId) {
  loadWebhooks();

  const delivery = webhooksData.deliveries.find(d => d.id === deliveryId);
  if (!delivery) {
    throw new Error('التسليم غير موجود');
  }

  const webhook = webhooksData.webhooks.find(w => w.id === delivery.webhookId && w.userId === userId);
  if (!webhook) {
    throw new Error('الـ Webhook غير موجود');
  }

  return await deliverWebhook(webhook, delivery.event, delivery.requestBody.data);
}

/**
 * Test webhook
 */
async function testWebhook(webhookId, userId) {
  loadWebhooks();

  const webhook = webhooksData.webhooks.find(w => w.id === webhookId && w.userId === userId);
  if (!webhook) {
    throw new Error('الـ Webhook غير موجود');
  }

  const testPayload = {
    test: true,
    message: 'هذا اختبار للـ Webhook',
    timestamp: new Date().toISOString()
  };

  return await deliverWebhook(webhook, 'test', testPayload);
}

// ============ EXPORTS ============
module.exports = {
  WEBHOOK_EVENTS,

  // CRUD
  createWebhook,
  getUserWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  regenerateSecret,

  // Delivery
  triggerEvent,
  getWebhookDeliveries,
  retryDelivery,
  testWebhook
};
