const express = require('express');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const { resolveActingContext, isEmployerLike } = require('../utils/actingContext');
const { loadOwnerProfile } = require('../utils/ownerProfile');

const router = express.Router();

// El rol sale de resolveActingContext, que ya contempla empresa, miembro de
// equipo e impersonación. Antes se calculaba acá comparando contra el literal
// 'employer', que dejaba afuera a las cuentas de empresa.
const isEmployerRole = isEmployerLike;
const isWorkerRole = (effectiveRole) => effectiveRole === 'worker';

// Get or create chat for a match
// Both employer and worker can initiate chats if there's a match
router.post('/:matchId', authMiddleware, async (req, res, next) => {
  try {
    const { actingUid: uid, effectiveRole, userData } = await resolveActingContext(req);
    const { matchId } = req.params;

    console.log('[Chats] POST /:matchId - Starting:', { uid, matchId });
    const db = getDb();

    if (!userData) {
      console.log('[Chats] User not found:', req.user.uid);
      return res.status(404).json({ error: 'User not found' });
    }
    const isWorker = isWorkerRole(effectiveRole);
    const isEmployer = isEmployerRole(effectiveRole);
    console.log('[Chats] User role:', { effectiveRole, isWorker, isEmployer });

    // Verify match exists and user is part of it
    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists) {
      console.log('[Chats] Match not found:', matchId);
      return res.status(404).json({ error: 'Match not found' });
    }

    const matchData = matchDoc.data();
    console.log('[Chats] Match data:', { workerId: matchData.workerId, employerId: matchData.employerId, status: matchData.status });

    if (matchData.workerId !== uid && matchData.employerId !== uid) {
      console.log('[Chats] User not part of match:', { uid, workerId: matchData.workerId, employerId: matchData.employerId });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if chat already exists - both parties can access existing chat
    const existingChat = await db.collection('chats')
      .where('matchId', '==', matchId)
      .limit(1)
      .get();

    console.log('[Chats] Existing chat found:', !existingChat.empty);

    // Get participant info. Del lado del worker la contraparte puede ser un
    // employer individual o una empresa: loadOwnerProfile cubre las dos
    // colecciones, buscar sólo en `employers` dejaba el participante en null.
    const otherUid = isWorker ? matchData.employerId : matchData.workerId;
    const participant = isWorker
      ? await loadOwnerProfile(db, otherUid)
      : (await db.collection('workers').doc(otherUid).get()).data() || null;

    // Get participant user info (name, email)
    const otherUserDoc = await db.collection('users').doc(otherUid).get();
    const otherUserData = otherUserDoc.exists ? otherUserDoc.data() : {};

    const enrichedParticipant = participant ? {
      ...participant,
      firstName: otherUserData.firstName,
      lastName: otherUserData.lastName,
      email: otherUserData.email
    } : null;

    if (!existingChat.empty) {
      const chatDoc = existingChat.docs[0];
      const chatData = chatDoc.data();
      return res.json({
        id: chatDoc.id,
        ...chatData,
        participant: enrichedParticipant,
        lastMessageAt: chatData.lastMessageAt?.toDate?.() || chatData.lastMessageAt
      });
    }

    // Both employer and worker can create chats (if there's a match)
    // Create new chat
    const chatData = {
      matchId,
      workerId: matchData.workerId,
      employerId: matchData.employerId,
      createdAt: new Date(),
      lastMessageAt: new Date() // Set to now so it shows in queries
    };

    console.log('[Chats] Creating new chat:', chatData);
    const chatRef = await db.collection('chats').add(chatData);
    console.log('[Chats] Chat created:', chatRef.id);

    res.status(201).json({
      id: chatRef.id,
      ...chatData,
      participant: enrichedParticipant
    });
  } catch (error) {
    console.error('[Chats] POST /:matchId - Error:', error.message, error.stack);
    next(error);
  }
});

// Get chat messages
router.get('/:chatId/messages', authMiddleware, async (req, res, next) => {
  try {
    const { actingUid: uid } = await resolveActingContext(req);
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
    const ctx = await resolveActingContext(req);
    const { actingUid: uid } = ctx;
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

    // senderId es la organización (es quien figura en el chat del otro lado);
    // quién lo escribió realmente queda en los campos de auditoría.
    const messageData = {
      senderId: uid,
      text: text.trim(),
      createdAt: new Date(),
      actorUid: req.user.uid,
      ...(req.user.uid !== uid ? { impersonated: !!ctx.isImpersonating } : {})
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
    const { actingUid: uid, effectiveRole, userData } = await resolveActingContext(req);
    const db = getDb();

    console.log('[Chats] GET / - Fetching chats for user:', uid);

    if (!userData) {
      console.log('[Chats] GET / - User not found:', req.user.uid);
      return res.status(404).json({ error: 'User not found' });
    }

    const isWorker = isWorkerRole(effectiveRole);
    const field = isWorker ? 'workerId' : 'employerId';

    console.log('[Chats] GET / - Querying chats with field:', field, 'uid:', uid);

    // Query without orderBy to avoid index requirement, then sort in memory
    const chatsSnapshot = await db.collection('chats')
      .where(field, '==', uid)
      .get();

    console.log('[Chats] GET / - Found chats:', chatsSnapshot.size);

    if (chatsSnapshot.empty) {
      return res.json([]);
    }

    // Collect all participant IDs we need to fetch
    const participantIds = new Set();
    const chatsRaw = chatsSnapshot.docs.map(doc => {
      const chatData = doc.data();
      const otherUid = isWorker ? chatData.employerId : chatData.workerId;
      participantIds.add(otherUid);
      return {
        id: doc.id,
        ...chatData,
        otherUid,
        lastMessageAt: chatData.lastMessageAt?.toDate?.() || chatData.lastMessageAt
      };
    });

    // Batch fetch all participants and their user info in parallel. Del lado
    // del worker la contraparte puede ser employer o empresa (colecciones
    // distintas), de ahí el loadOwnerProfile en vez de una colección fija.
    const participantIdsArray = Array.from(participantIds);

    const [profileDocs, userDocs] = await Promise.all([
      Promise.all(participantIdsArray.map(id =>
        isWorker
          ? loadOwnerProfile(db, id).then((data) => ({ exists: !!data, data: () => data }))
          : db.collection('workers').doc(id).get()
      )),
      Promise.all(participantIdsArray.map(id =>
        db.collection('users').doc(id).get()
      ))
    ]);

    // Build lookup maps
    const profileMap = new Map();
    const userMap = new Map();

    profileDocs.forEach(doc => {
      if (doc.exists) profileMap.set(doc.id, doc.data());
    });
    userDocs.forEach(doc => {
      if (doc.exists) userMap.set(doc.id, doc.data());
    });

    // Enrich chats with participant data
    const chats = chatsRaw.map(chat => {
      const participant = profileMap.get(chat.otherUid);
      const otherUserData = userMap.get(chat.otherUid) || {};

      const enrichedParticipant = participant ? {
        ...participant,
        firstName: otherUserData.firstName,
        lastName: otherUserData.lastName
      } : null;

      // Remove temporary field
      const { otherUid, ...chatWithoutOtherUid } = chat;
      return {
        ...chatWithoutOtherUid,
        participant: enrichedParticipant
      };
    });

    // Sort by lastMessageAt descending (newest first)
    chats.sort((a, b) => {
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return dateB - dateA;
    });

    // Deduplicate by matchId (keep the most recent one - already sorted)
    const seenMatchIds = new Set();
    const uniqueChats = chats.filter(chat => {
      if (seenMatchIds.has(chat.matchId)) {
        return false;
      }
      seenMatchIds.add(chat.matchId);
      return true;
    });

    console.log('[Chats] GET / - Returning chats:', uniqueChats.length, '(deduped from', chats.length, ')');
    res.json(uniqueChats);
  } catch (error) {
    console.error('[Chats] GET / - Error:', error.message, error.stack);
    next(error);
  }
});

module.exports = router;
