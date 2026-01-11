/**
 * Webhooks Routes
 * مسارات الـ Webhooks
 */

const express = require('express');
const router = express.Router();
const webhooks = require('../webhooks');

/**
 * Get available events
 * GET /api/webhooks/events
 */
router.get('/events', (req, res) => {
  res.json({ events: Object.values(webhooks.WEBHOOK_EVENTS) });
});

/**
 * Create webhook
 * POST /api/webhooks
 */
router.post('/', (req, res) => {
  try {
    const { name, url, events, headers } = req.body;

    if (!name || !url || !events || events.length === 0) {
      return res.status(400).json({ error: 'الاسم والرابط والأحداث مطلوبة' });
    }

    const webhook = webhooks.createWebhook({
      userId: req.user.id,
      name,
      url,
      events,
      headers
    });

    res.json({ success: true, webhook });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Get my webhooks
 * GET /api/webhooks
 */
router.get('/', (req, res) => {
  const userWebhooks = webhooks.getUserWebhooks(req.user.id);
  // Hide secrets
  const safeWebhooks = userWebhooks.map(w => ({
    ...w,
    secret: '••••••••' + w.secret.slice(-8)
  }));
  res.json({ webhooks: safeWebhooks });
});

/**
 * Get webhook by ID
 * GET /api/webhooks/:webhookId
 */
router.get('/:webhookId', (req, res) => {
  const webhook = webhooks.getWebhook(req.params.webhookId, req.user.id);
  if (!webhook) {
    return res.status(404).json({ error: 'الـ Webhook غير موجود' });
  }
  res.json({ 
    webhook: {
      ...webhook,
      secret: '••••••••' + webhook.secret.slice(-8)
    }
  });
});

/**
 * Update webhook
 * PUT /api/webhooks/:webhookId
 */
router.put('/:webhookId', (req, res) => {
  try {
    const webhook = webhooks.updateWebhook(
      req.params.webhookId,
      req.body,
      req.user.id
    );
    res.json({ success: true, webhook });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Delete webhook
 * DELETE /api/webhooks/:webhookId
 */
router.delete('/:webhookId', (req, res) => {
  try {
    webhooks.deleteWebhook(req.params.webhookId, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Regenerate secret
 * POST /api/webhooks/:webhookId/regenerate-secret
 */
router.post('/:webhookId/regenerate-secret', (req, res) => {
  try {
    const webhook = webhooks.regenerateSecret(req.params.webhookId, req.user.id);
    res.json({ 
      success: true, 
      secret: webhook.secret // Show full secret only on regeneration
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Test webhook
 * POST /api/webhooks/:webhookId/test
 */
router.post('/:webhookId/test', async (req, res) => {
  try {
    const delivery = await webhooks.testWebhook(req.params.webhookId, req.user.id);
    res.json({ success: true, delivery });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Get webhook deliveries
 * GET /api/webhooks/:webhookId/deliveries
 */
router.get('/:webhookId/deliveries', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const deliveries = webhooks.getWebhookDeliveries(
    req.params.webhookId,
    req.user.id,
    limit
  );
  res.json({ deliveries });
});

/**
 * Retry delivery
 * POST /api/webhooks/deliveries/:deliveryId/retry
 */
router.post('/deliveries/:deliveryId/retry', async (req, res) => {
  try {
    const delivery = await webhooks.retryDelivery(req.params.deliveryId, req.user.id);
    res.json({ success: true, delivery });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
