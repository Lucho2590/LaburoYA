const { getDb } = require('../config/firebase');
const admin = require('firebase-admin');

// Notification types
const NOTIFICATION_TYPES = {
  CONTACT_REQUEST_RECEIVED: 'contact_request_received',
  CONTACT_REQUEST_ACCEPTED: 'contact_request_accepted',
  CONTACT_REQUEST_REJECTED: 'contact_request_rejected',
  MATCH_CREATED: 'match_created',
  NEW_MESSAGE: 'new_message'
};

class NotificationService {
  /**
   * Create an in-app notification
   * @param {Object} params - Notification parameters
   * @param {string} params.userId - Recipient user ID
   * @param {string} params.type - Notification type
   * @param {string} params.title - Notification title
   * @param {string} params.body - Notification body
   * @param {Object} params.data - Additional data
   * @returns {Object} Created notification
   */
  async createInAppNotification({ userId, type, title, body, data = {} }) {
    const db = getDb();

    const notification = {
      userId,
      type,
      title,
      body,
      data,
      read: false,
      createdAt: new Date()
    };

    const notifRef = await db.collection('notifications').add(notification);

    return {
      id: notifRef.id,
      ...notification
    };
  }

  /**
   * Get notifications for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Max notifications to return
   * @param {boolean} options.unreadOnly - Only return unread notifications
   * @returns {Array} Notifications
   */
  async getNotifications(userId, { limit = 50, unreadOnly = false } = {}) {
    const db = getDb();

    let query = db.collection('notifications')
      .where('userId', '==', userId);

    if (unreadOnly) {
      query = query.where('read', '==', false);
    }

    const snapshot = await query.get();

    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    }));

    // Sort by createdAt desc
    notifications.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return notifications.slice(0, limit);
  }

  /**
   * Get unread notification count
   * @param {string} userId - User ID
   * @returns {number} Unread count
   */
  async getUnreadCount(userId) {
    const db = getDb();

    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    return snapshot.size;
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for verification)
   * @returns {Object} Updated notification
   */
  async markAsRead(notificationId, userId) {
    const db = getDb();
    const notifRef = db.collection('notifications').doc(notificationId);
    const notifDoc = await notifRef.get();

    if (!notifDoc.exists) {
      throw new Error('Notification not found');
    }

    if (notifDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }

    await notifRef.update({
      read: true,
      readAt: new Date()
    });

    return { id: notificationId, read: true };
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {number} Number of notifications marked as read
   */
  async markAllAsRead(userId) {
    const db = getDb();

    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { read: true, readAt: new Date() });
    });

    await batch.commit();

    return snapshot.size;
  }

  /**
   * Register FCM token for push notifications
   * @param {string} userId - User ID
   * @param {string} token - FCM token
   * @param {string} deviceType - Device type (web, android, ios)
   */
  async registerFcmToken(userId, token, deviceType = 'web') {
    const db = getDb();

    // Use token as document ID to prevent duplicates
    await db.collection('fcmTokens').doc(token).set({
      userId,
      token,
      deviceType,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return { success: true };
  }

  /**
   * Remove FCM token
   * @param {string} token - FCM token
   */
  async removeFcmToken(token) {
    const db = getDb();
    await db.collection('fcmTokens').doc(token).delete();
    return { success: true };
  }

  /**
   * Get FCM tokens for a user
   * @param {string} userId - User ID
   * @returns {Array} FCM tokens
   */
  async getFcmTokens(userId) {
    const db = getDb();

    const snapshot = await db.collection('fcmTokens')
      .where('userId', '==', userId)
      .get();

    return snapshot.docs.map(doc => doc.data().token);
  }

  /**
   * Send push notification via FCM
   * @param {string} userId - Recipient user ID
   * @param {Object} notification - Notification content
   * @param {string} notification.title - Title
   * @param {string} notification.body - Body
   * @param {Object} notification.data - Additional data
   */
  async sendPushNotification(userId, { title, body, data = {} }) {
    try {
      const tokens = await this.getFcmTokens(userId);

      if (tokens.length === 0) {
        console.log(`No FCM tokens for user ${userId}`);
        return { sent: 0 };
      }

      const message = {
        notification: {
          title,
          body
        },
        data: {
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          ),
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        tokens
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      // Remove invalid tokens
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });

        // Clean up invalid tokens
        for (const token of failedTokens) {
          await this.removeFcmToken(token);
        }
      }

      return {
        sent: response.successCount,
        failed: response.failureCount
      };
    } catch (error) {
      console.error('Error sending push notification:', error);
      return { sent: 0, error: error.message };
    }
  }

  /**
   * Send email notification (placeholder - needs SMTP config)
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} html - Email HTML body
   */
  async sendEmail(to, subject, html) {
    // TODO: Configure nodemailer with SMTP settings
    // For now, just log the email
    console.log('Email notification (not configured):', { to, subject });

    // Placeholder implementation - uncomment when SMTP is configured
    /*
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"LaburoYA" <noreply@laburoya.com>',
      to,
      subject,
      html
    });
    */

    return { sent: false, reason: 'SMTP not configured' };
  }

  /**
   * Send notification for contact request received
   */
  async notifyContactRequestReceived({ recipientId, senderName, offerTitle, requestId, senderType }) {
    const isFromWorker = senderType === 'worker';
    const title = isFromWorker
      ? '📩 Nuevo candidato interesado'
      : '📩 Una empresa quiere contactarte';
    const body = isFromWorker
      ? `${senderName} está interesado en tu oferta "${offerTitle}"`
      : `${senderName} te quiere contactar para "${offerTitle}"`;

    // In-app notification
    await this.createInAppNotification({
      userId: recipientId,
      type: NOTIFICATION_TYPES.CONTACT_REQUEST_RECEIVED,
      title,
      body,
      data: { requestId }
    });

    // Push notification
    await this.sendPushNotification(recipientId, {
      title,
      body,
      data: { type: 'contact_request', requestId }
    });
  }

  /**
   * Send notification for match created
   */
  async notifyMatchCreated({ workerId, employerId, workerName, employerName, offerTitle, matchId }) {
    console.log('[NotificationService] notifyMatchCreated:', { workerId, employerId, workerName, employerName, offerTitle, matchId });

    // Notify worker - they need to wait for employer to initiate chat
    await this.createInAppNotification({
      userId: workerId,
      type: NOTIFICATION_TYPES.MATCH_CREATED,
      title: '🎉 ¡Nuevo match!',
      body: `${employerName} quiere contactarte para "${offerTitle}". Te va a escribir pronto.`,
      data: { matchId }
    });

    await this.sendPushNotification(workerId, {
      title: '🎉 ¡Nuevo match!',
      body: `${employerName} quiere contactarte. Te va a escribir pronto.`,
      data: { type: 'match', matchId }
    });

    // Notify employer - they can initiate the chat
    await this.createInAppNotification({
      userId: employerId,
      type: NOTIFICATION_TYPES.MATCH_CREATED,
      title: '🎉 ¡Nuevo match!',
      body: `Match con ${workerName} para "${offerTitle}". Ya podés iniciar el chat.`,
      data: { matchId }
    });

    await this.sendPushNotification(employerId, {
      title: '🎉 ¡Nuevo match!',
      body: `Match con ${workerName}. Ya podés iniciar el chat.`,
      data: { type: 'match', matchId }
    });
  }

  /**
   * Send notification for new message
   */
  async notifyNewMessage({ recipientId, senderName, messagePreview, chatId }) {
    await this.createInAppNotification({
      userId: recipientId,
      type: NOTIFICATION_TYPES.NEW_MESSAGE,
      title: `Nuevo mensaje de ${senderName}`,
      body: messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
      data: { chatId }
    });

    await this.sendPushNotification(recipientId, {
      title: `Nuevo mensaje de ${senderName}`,
      body: messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
      data: { type: 'message', chatId }
    });
  }
}

module.exports = new NotificationService();
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
