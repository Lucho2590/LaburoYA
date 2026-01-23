const express = require('express');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get or create chat for a match
router.post('/:matchId', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { matchId } = req.params;

    const db = getDb();

    // Verify match exists and user is part of it
    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const matchData = matchDoc.data();
    if (matchData.workerId !== uid && matchData.employerId !== uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if chat already exists
    const existingChat = await db.collection('chats')
      .where('matchId', '==', matchId)
      .limit(1)
      .get();

    if (!existingChat.empty) {
      const chatDoc = existingChat.docs[0];
      return res.json({
        id: chatDoc.id,
        ...chatDoc.data()
      });
    }

    // Create new chat
    const chatData = {
      matchId,
      workerId: matchData.workerId,
      employerId: matchData.employerId,
      createdAt: new Date(),
      lastMessageAt: null
    };

    const chatRef = await db.collection('chats').add(chatData);

    res.status(201).json({
      id: chatRef.id,
      ...chatData
    });
  } catch (error) {
    next(error);
  }
});

// Get chat messages
router.get('/:chatId/messages', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { chatId } = req.params;
    const { limit = 50, before } = req.query;

    const db = getDb();

    // Verify chat exists and user is part of it
    const chatDoc = await db.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chatData = chatDoc.data();
    if (chatData.workerId !== uid && chatData.employerId !== uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get messages
    let query = db.collection('chats').doc(chatId).collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));

    if (before) {
      query = query.startAfter(new Date(before));
    }

    const messagesSnapshot = await query.get();

    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    })).reverse();

    res.json(messages);
  } catch (error) {
    next(error);
  }
});

// Send message
router.post('/:chatId/messages', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { chatId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const db = getDb();

    // Verify chat exists and user is part of it
    const chatDoc = await db.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chatData = chatDoc.data();
    if (chatData.workerId !== uid && chatData.employerId !== uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const messageData = {
      senderId: uid,
      text: text.trim(),
      createdAt: new Date()
    };

    // Add message
    const messageRef = await db.collection('chats').doc(chatId)
      .collection('messages').add(messageData);

    // Update chat lastMessageAt
    await db.collection('chats').doc(chatId).update({
      lastMessageAt: new Date(),
      lastMessage: text.trim().substring(0, 100)
    });

    res.status(201).json({
      id: messageRef.id,
      ...messageData
    });
  } catch (error) {
    next(error);
  }
});

// Get user's chats
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const db = getDb();

    // Get user role
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { role } = userDoc.data();
    const field = role === 'worker' ? 'workerId' : 'employerId';

    const chatsSnapshot = await db.collection('chats')
      .where(field, '==', uid)
      .orderBy('lastMessageAt', 'desc')
      .get();

    const chats = [];
    for (const doc of chatsSnapshot.docs) {
      const chatData = doc.data();

      // Get other participant info
      const otherUid = role === 'worker' ? chatData.employerId : chatData.workerId;
      const otherCollection = role === 'worker' ? 'employers' : 'workers';

      const otherDoc = await db.collection(otherCollection).doc(otherUid).get();

      chats.push({
        id: doc.id,
        ...chatData,
        participant: otherDoc.exists ? otherDoc.data() : null,
        lastMessageAt: chatData.lastMessageAt?.toDate?.() || chatData.lastMessageAt
      });
    }

    res.json(chats);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
