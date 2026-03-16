const express = require('express');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

/**
 * Helper: Check if a reverse contact request exists (mutual interest)
 * Returns the existing request if found, null otherwise
 */
async function findReverseRequest(db, fromUid, toUid, offerId) {
  const reverseSnapshot = await db.collection('contactRequests')
    .where('fromUid', '==', toUid)
    .where('toUid', '==', fromUid)
    .where('offerId', '==', offerId)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  return reverseSnapshot.empty ? null : {
    id: reverseSnapshot.docs[0].id,
    ...reverseSnapshot.docs[0].data()
  };
}

/**
 * Helper: Create a match when both parties express interest
 */
async function createMutualMatch(db, workerId, employerId, offerId, jobOfferData) {
  // Check if match already exists
  const existingMatch = await db.collection('matches')
    .where('workerId', '==', workerId)
    .where('offerId', '==', offerId)
    .get();

  if (!existingMatch.empty) {
    return {
      id: existingMatch.docs[0].id,
      ...existingMatch.docs[0].data(),
      alreadyExisted: true
    };
  }

  // Create new match
  const matchData = {
    workerId,
    employerId,
    offerId,
    rubro: jobOfferData.rubro,
    puesto: jobOfferData.puesto,
    status: 'accepted', // Auto-accepted since both expressed interest
    mutualInterest: true,
    createdAt: new Date()
  };

  const matchRef = await db.collection('matches').add(matchData);

  return {
    id: matchRef.id,
    ...matchData,
    alreadyExisted: false
  };
}

/**
 * POST /worker-to-offer
 * Worker expresses interest in a job offer
 */
router.post('/worker-to-offer', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { offerId } = req.body;

    if (!offerId) {
      return res.status(400).json({ error: 'offerId is required' });
    }

    const db = getDb();

    // Verify user is a worker
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(403).json({ error: 'User not found' });
    }
    const userData = userDoc.data();
    const isWorker = userData.role === 'worker' ||
      (userData.role === 'superuser' && userData.secondaryRole === 'worker');
    if (!isWorker) {
      return res.status(403).json({ error: 'Only workers can request offers' });
    }

    // Get job offer
    const jobOfferDoc = await db.collection('jobOffers').doc(offerId).get();
    if (!jobOfferDoc.exists) {
      return res.status(404).json({ error: 'Job offer not found' });
    }
    const jobOfferData = jobOfferDoc.data();
    const employerId = jobOfferData.employerId;

    // Check if request already exists
    const existingRequest = await db.collection('contactRequests')
      .where('fromUid', '==', uid)
      .where('offerId', '==', offerId)
      .limit(1)
      .get();

    if (!existingRequest.empty) {
      return res.status(400).json({ error: 'Request already sent for this offer' });
    }

    // Check if employer already requested this worker for this offer (mutual interest)
    const reverseRequest = await findReverseRequest(db, uid, employerId, offerId);

    if (reverseRequest) {
      // Mutual interest! Create match and update both requests
      const match = await createMutualMatch(db, uid, employerId, offerId, jobOfferData);

      // Track "interested" interaction for stats (even on mutual interest)
      const existingInteraction = await db.collection('offerInteractions')
        .where('offerId', '==', offerId)
        .where('userId', '==', uid)
        .where('type', '==', 'interested')
        .limit(1)
        .get();

      if (existingInteraction.empty) {
        await db.collection('offerInteractions').add({
          offerId,
          userId: uid,
          type: 'interested',
          createdAt: new Date()
        });

        const currentStats = jobOfferData.stats || { interestedCount: 0, notInterestedCount: 0 };
        await db.collection('jobOffers').doc(offerId).update({
          stats: {
            ...currentStats,
            interestedCount: (currentStats.interestedCount || 0) + 1
          }
        });
      }

      // Update the reverse request status
      await db.collection('contactRequests').doc(reverseRequest.id).update({
        status: 'matched',
        matchId: match.id,
        updatedAt: new Date()
      });

      // Create worker's request as matched too
      const requestData = {
        fromUid: uid,
        fromType: 'worker',
        toUid: employerId,
        toType: 'employer',
        workerId: uid,
        employerId,
        offerId,
        status: 'matched',
        matchId: match.id,
        createdAt: new Date()
      };
      await db.collection('contactRequests').add(requestData);

      // Send match notifications if it's a new match
      if (!match.alreadyExisted) {
        const workerDoc = await db.collection('workers').doc(uid).get();
        const employerDoc = await db.collection('employers').doc(employerId).get();
        const workerData = workerDoc.exists ? workerDoc.data() : {};
        const employerData = employerDoc.exists ? employerDoc.data() : {};

        // Get worker user info for better name
        const workerUserDoc = await db.collection('users').doc(uid).get();
        const workerUserData = workerUserDoc.exists ? workerUserDoc.data() : {};
        const workerName = workerUserData.firstName
          ? `${workerUserData.firstName} ${workerUserData.lastName || ''}`.trim()
          : workerData.puesto || 'Candidato';

        notificationService.notifyMatchCreated({
          workerId: uid,
          employerId,
          workerName,
          employerName: employerData.businessName || 'Empresa',
          offerTitle: jobOfferData.puesto || 'oferta',
          matchId: match.id
        }).catch(err => console.error('Match notification error:', err));
      }

      return res.status(201).json({
        message: 'Mutual interest! Match created',
        matchCreated: true,
        match
      });
    }

    // No reverse request - create pending request
    const requestData = {
      fromUid: uid,
      fromType: 'worker',
      toUid: employerId,
      toType: 'employer',
      workerId: uid,
      employerId,
      offerId,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    const requestRef = await db.collection('contactRequests').add(requestData);

    // Track "interested" interaction for stats
    const existingInteraction = await db.collection('offerInteractions')
      .where('offerId', '==', offerId)
      .where('userId', '==', uid)
      .where('type', '==', 'interested')
      .limit(1)
      .get();

    if (existingInteraction.empty) {
      await db.collection('offerInteractions').add({
        offerId,
        userId: uid,
        type: 'interested',
        createdAt: new Date()
      });

      // Update offer stats
      const currentStats = jobOfferData.stats || { interestedCount: 0, notInterestedCount: 0 };
      await db.collection('jobOffers').doc(offerId).update({
        stats: {
          ...currentStats,
          interestedCount: (currentStats.interestedCount || 0) + 1
        }
      });
    }

    // Get worker info for notification
    const workerDoc = await db.collection('workers').doc(uid).get();
    const workerData = workerDoc.exists ? workerDoc.data() : {};

    // Send notification to employer
    notificationService.notifyContactRequestReceived({
      recipientId: employerId,
      senderName: workerData.puesto || 'Un trabajador',
      offerTitle: jobOfferData.puesto || 'una oferta',
      requestId: requestRef.id,
      senderType: 'worker'
    }).catch(err => console.error('Notification error:', err));

    res.status(201).json({
      message: 'Contact request sent',
      matchCreated: false,
      request: {
        id: requestRef.id,
        ...requestData
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /employer-to-worker
 * Employer expresses interest in a worker for a specific job offer
 */
router.post('/employer-to-worker', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { workerId, offerId } = req.body;

    console.log('[ContactRequests] employer-to-worker:', { uid, workerId, offerId });

    if (!workerId || !offerId) {
      return res.status(400).json({ error: 'workerId and offerId are required' });
    }

    const db = getDb();

    // Verify user is an employer
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(403).json({ error: 'User not found' });
    }
    const userData = userDoc.data();
    const isEmployer = userData.role === 'employer' ||
      (userData.role === 'superuser' && userData.secondaryRole === 'employer');
    if (!isEmployer) {
      return res.status(403).json({ error: 'Only employers can request workers' });
    }

    // Verify job offer exists and belongs to employer
    const jobOfferDoc = await db.collection('jobOffers').doc(offerId).get();
    if (!jobOfferDoc.exists) {
      return res.status(404).json({ error: 'Job offer not found' });
    }
    const jobOfferData = jobOfferDoc.data();
    if (jobOfferData.employerId !== uid) {
      return res.status(403).json({ error: 'Job offer does not belong to you' });
    }

    // Verify worker exists
    const workerDoc = await db.collection('workers').doc(workerId).get();
    if (!workerDoc.exists) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    // Check if request already exists
    const existingRequest = await db.collection('contactRequests')
      .where('fromUid', '==', uid)
      .where('toUid', '==', workerId)
      .where('offerId', '==', offerId)
      .limit(1)
      .get();

    if (!existingRequest.empty) {
      return res.status(400).json({ error: 'Request already sent for this worker and offer' });
    }

    // Check if worker already requested this offer (mutual interest)
    console.log('[ContactRequests] Checking for reverse request (worker -> employer)');
    const reverseRequest = await findReverseRequest(db, uid, workerId, offerId);
    console.log('[ContactRequests] Reverse request found:', reverseRequest ? reverseRequest.id : 'none');

    if (reverseRequest) {
      // Mutual interest! Create match and update both requests
      console.log('[ContactRequests] Creating mutual match...');
      const match = await createMutualMatch(db, workerId, uid, offerId, jobOfferData);
      console.log('[ContactRequests] Match created:', { id: match.id, alreadyExisted: match.alreadyExisted });

      // Update the reverse request status
      await db.collection('contactRequests').doc(reverseRequest.id).update({
        status: 'matched',
        matchId: match.id,
        updatedAt: new Date()
      });

      // Create employer's request as matched too
      const requestData = {
        fromUid: uid,
        fromType: 'employer',
        toUid: workerId,
        toType: 'worker',
        workerId,
        employerId: uid,
        offerId,
        status: 'matched',
        matchId: match.id,
        createdAt: new Date()
      };
      await db.collection('contactRequests').add(requestData);

      // Send match notifications if it's a new match
      if (!match.alreadyExisted) {
        const workerData = workerDoc.data();
        const employerDoc2 = await db.collection('employers').doc(uid).get();
        const employerData = employerDoc2.exists ? employerDoc2.data() : {};

        // Get worker user info for better name
        const workerUserDoc = await db.collection('users').doc(workerId).get();
        const workerUserData = workerUserDoc.exists ? workerUserDoc.data() : {};
        const workerName = workerUserData.firstName
          ? `${workerUserData.firstName} ${workerUserData.lastName || ''}`.trim()
          : workerData.puesto || 'Candidato';

        notificationService.notifyMatchCreated({
          workerId,
          employerId: uid,
          workerName,
          employerName: employerData.businessName || 'Empresa',
          offerTitle: jobOfferData.puesto || 'oferta',
          matchId: match.id
        }).catch(err => console.error('Match notification error:', err));
      }

      return res.status(201).json({
        message: 'Mutual interest! Match created',
        matchCreated: true,
        match
      });
    }

    // No reverse request - create pending request
    const requestData = {
      fromUid: uid,
      fromType: 'employer',
      toUid: workerId,
      toType: 'worker',
      workerId,
      employerId: uid,
      offerId,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    const requestRef = await db.collection('contactRequests').add(requestData);

    // Get employer info for notification
    const employerDoc = await db.collection('employers').doc(uid).get();
    const employerData = employerDoc.exists ? employerDoc.data() : {};

    // Send notification to worker
    notificationService.notifyContactRequestReceived({
      recipientId: workerId,
      senderName: employerData.businessName || 'Una empresa',
      offerTitle: jobOfferData.puesto || 'una oferta',
      requestId: requestRef.id,
      senderType: 'employer'
    }).catch(err => console.error('Notification error:', err));

    res.status(201).json({
      message: 'Contact request sent',
      matchCreated: false,
      request: {
        id: requestRef.id,
        ...requestData
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /received
 * Get contact requests received by current user
 */
router.get('/received', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const db = getDb();

    const requestsSnapshot = await db.collection('contactRequests')
      .where('toUid', '==', uid)
      .where('status', '==', 'pending')
      .get();

    if (requestsSnapshot.empty) {
      return res.json([]);
    }

    // Collect all IDs we need to fetch
    const workerIds = new Set();
    const employerIds = new Set();
    const offerIds = new Set();

    const requestsRaw = requestsSnapshot.docs.map(doc => {
      const data = doc.data();
      if (data.fromType === 'worker') {
        workerIds.add(data.fromUid);
      } else {
        employerIds.add(data.fromUid);
      }
      offerIds.add(data.offerId);

      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        expiresAt: data.expiresAt?.toDate?.() || data.expiresAt
      };
    });

    // Batch fetch all related documents in parallel
    const [workerDocs, employerDocs, offerDocs] = await Promise.all([
      Promise.all(Array.from(workerIds).map(id => db.collection('workers').doc(id).get())),
      Promise.all(Array.from(employerIds).map(id => db.collection('employers').doc(id).get())),
      Promise.all(Array.from(offerIds).map(id => db.collection('jobOffers').doc(id).get()))
    ]);

    // Build lookup maps
    const workerMap = new Map();
    const employerMap = new Map();
    const offerMap = new Map();

    workerDocs.forEach(doc => {
      if (doc.exists) workerMap.set(doc.id, doc.data());
    });
    employerDocs.forEach(doc => {
      if (doc.exists) employerMap.set(doc.id, doc.data());
    });
    offerDocs.forEach(doc => {
      if (doc.exists) offerMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Enrich requests with related data
    const requests = requestsRaw.map(request => {
      const enriched = { ...request };

      if (request.fromType === 'worker') {
        enriched.worker = workerMap.get(request.fromUid) || null;
      } else {
        enriched.employer = employerMap.get(request.fromUid) || null;
      }

      enriched.jobOffer = offerMap.get(request.offerId) || null;

      return enriched;
    });

    // Sort by createdAt desc
    requests.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    res.json(requests);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /sent
 * Get contact requests sent by current user
 */
router.get('/sent', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const db = getDb();

    const requestsSnapshot = await db.collection('contactRequests')
      .where('fromUid', '==', uid)
      .get();

    if (requestsSnapshot.empty) {
      return res.json([]);
    }

    // Collect all IDs we need to fetch
    const workerIds = new Set();
    const employerIds = new Set();
    const offerIds = new Set();

    const requestsRaw = requestsSnapshot.docs.map(doc => {
      const data = doc.data();
      if (data.toType === 'worker') {
        workerIds.add(data.toUid);
      } else {
        employerIds.add(data.toUid);
      }
      offerIds.add(data.offerId);

      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        expiresAt: data.expiresAt?.toDate?.() || data.expiresAt
      };
    });

    // Batch fetch all related documents in parallel
    const [workerDocs, employerDocs, offerDocs] = await Promise.all([
      Promise.all(Array.from(workerIds).map(id => db.collection('workers').doc(id).get())),
      Promise.all(Array.from(employerIds).map(id => db.collection('employers').doc(id).get())),
      Promise.all(Array.from(offerIds).map(id => db.collection('jobOffers').doc(id).get()))
    ]);

    // Build lookup maps
    const workerMap = new Map();
    const employerMap = new Map();
    const offerMap = new Map();

    workerDocs.forEach(doc => {
      if (doc.exists) workerMap.set(doc.id, doc.data());
    });
    employerDocs.forEach(doc => {
      if (doc.exists) employerMap.set(doc.id, doc.data());
    });
    offerDocs.forEach(doc => {
      if (doc.exists) offerMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Enrich requests with related data
    const requests = requestsRaw.map(request => {
      const enriched = { ...request };

      if (request.toType === 'worker') {
        enriched.worker = workerMap.get(request.toUid) || null;
      } else {
        enriched.employer = employerMap.get(request.toUid) || null;
      }

      enriched.jobOffer = offerMap.get(request.offerId) || null;

      return enriched;
    });

    // Sort by createdAt desc
    requests.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    res.json(requests);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /:id/respond
 * Accept or reject a contact request
 */
router.patch('/:id/respond', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;
    const { response } = req.body;

    if (!response || !['accepted', 'rejected'].includes(response)) {
      return res.status(400).json({ error: 'Response must be "accepted" or "rejected"' });
    }

    const db = getDb();
    const requestRef = db.collection('contactRequests').doc(id);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Contact request not found' });
    }

    const requestData = requestDoc.data();

    // Verify ownership (only recipient can respond)
    if (requestData.toUid !== uid) {
      return res.status(403).json({ error: 'Only the recipient can respond to this request' });
    }

    // Check if already processed
    if (requestData.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    if (response === 'rejected') {
      await requestRef.update({
        status: 'rejected',
        updatedAt: new Date()
      });

      return res.json({
        message: 'Request rejected',
        matchCreated: false
      });
    }

    // Accepted - create match
    const jobOfferDoc = await db.collection('jobOffers').doc(requestData.offerId).get();
    const jobOfferData = jobOfferDoc.exists ? jobOfferDoc.data() : {};

    const match = await createMutualMatch(
      db,
      requestData.workerId,
      requestData.employerId,
      requestData.offerId,
      jobOfferData
    );

    await requestRef.update({
      status: 'accepted',
      matchId: match.id,
      updatedAt: new Date()
    });

    // Send match notification if it's a new match
    if (!match.alreadyExisted) {
      const workerDoc = await db.collection('workers').doc(requestData.workerId).get();
      const employerDoc = await db.collection('employers').doc(requestData.employerId).get();
      const workerData = workerDoc.exists ? workerDoc.data() : {};
      const employerData = employerDoc.exists ? employerDoc.data() : {};

      notificationService.notifyMatchCreated({
        workerId: requestData.workerId,
        employerId: requestData.employerId,
        workerName: workerData.description ? workerData.description.split(' ')[0] : 'Trabajador',
        employerName: employerData.businessName || 'Empresa',
        offerTitle: jobOfferData.puesto || 'oferta',
        matchId: match.id
      }).catch(err => console.error('Match notification error:', err));
    }

    res.json({
      message: 'Request accepted, match created',
      matchCreated: !match.alreadyExisted,
      match
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /status/:offerId
 * Check if current user has pending request for an offer
 */
router.get('/status/:offerId', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { offerId } = req.params;
    const db = getDb();

    // Run both queries in parallel
    const [sentSnapshot, receivedSnapshot] = await Promise.all([
      db.collection('contactRequests')
        .where('fromUid', '==', uid)
        .where('offerId', '==', offerId)
        .limit(1)
        .get(),
      db.collection('contactRequests')
        .where('toUid', '==', uid)
        .where('offerId', '==', offerId)
        .limit(1)
        .get()
    ]);

    res.json({
      hasSentRequest: !sentSnapshot.empty,
      sentRequest: sentSnapshot.empty ? null : {
        id: sentSnapshot.docs[0].id,
        status: sentSnapshot.docs[0].data().status
      },
      hasReceivedRequest: !receivedSnapshot.empty,
      receivedRequest: receivedSnapshot.empty ? null : {
        id: receivedSnapshot.docs[0].id,
        status: receivedSnapshot.docs[0].data().status
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
