const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

/**
 * GET /
 * Get notifications for current user
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { limit = 50, unreadOnly = false } = req.query;

    const notifications = await notificationService.getNotifications(uid, {
      limit: parseInt(limit, 10),
      unreadOnly: unreadOnly === 'true'
    });

    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /unread-count
 * Get unread notification count
 */
router.get('/unread-count', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const count = await notificationService.getUnreadCount(uid);

    res.json({ count });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /:id/read
 * Mark notification as read
 */
router.patch('/:id/read', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;

    const result = await notificationService.markAsRead(id, uid);
    res.json(result);
  } catch (error) {
    if (error.message === 'Notification not found') {
      return res.status(404).json({ error: 'Notification not found' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    next(error);
  }
});

/**
 * POST /read-all
 * Mark all notifications as read
 */
router.post('/read-all', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const count = await notificationService.markAllAsRead(uid);

    res.json({ markedAsRead: count });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /fcm-token
 * Register FCM token for push notifications
 */
router.post('/fcm-token', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { token, deviceType = 'web' } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const result = await notificationService.registerFcmToken(uid, token, deviceType);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /fcm-token
 * Remove FCM token
 */
router.delete('/fcm-token', authMiddleware, async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const result = await notificationService.removeFcmToken(token);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
