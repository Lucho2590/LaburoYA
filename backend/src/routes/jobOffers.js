const express = require('express');
const admin = require('firebase-admin');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const matchingService = require('../services/matchingService');
const FieldValue = admin.firestore.FieldValue;

const router = express.Router();

// Default duration for job offers in days
const DEFAULT_DURATION_DAYS = 3;

// Create job offer
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { rubro, puesto, description, requirements, salary, schedule, requiredSkills, zona, durationDays, businessName, availability } = req.body;

    if (!rubro || !puesto) {
      return res.status(400).json({ error: 'rubro and puesto are required' });
    }

    const db = getDb();

    // Verify user is registered as employer (or superuser with employer secondaryRole)
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(403).json({ error: 'User not found' });
    }
    const userData = userDoc.data();
    const isEmployer = userData.role === 'employer' ||
      (userData.role === 'superuser' && userData.secondaryRole === 'employer');
    if (!isEmployer) {
      return res.status(403).json({ error: 'User must be registered as employer' });
    }

    // Calculate expiration date
    const duration = durationDays || DEFAULT_DURATION_DAYS;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

    const jobOfferData = {
      employerId: uid,
      rubro,
      puesto,
      description: description || null,
      requirements: requirements || null,
      salary: salary || null,
      schedule: schedule || null,
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      zona: zona || null,
      businessName: businessName || null,
      availability: availability || null,
      active: true,
      durationDays: duration,
      expiresAt,
      createdAt: now,
      updatedAt: now
    };

    // Create job offer
    const jobRef = await db.collection('jobOffers').add(jobOfferData);

    // Run matching logic
    const newMatches = await matchingService.findMatchesForJobOffer(jobRef.id, jobOfferData);

    res.status(201).json({
      message: 'Job offer created',
      id: jobRef.id,
      jobOffer: jobOfferData,
      newMatches: newMatches.length,
      matches: newMatches
    });
  } catch (error) {
    next(error);
  }
});

// Get employer's job offers
router.get('/my-offers', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const db = getDb();

    const offersSnapshot = await db.collection('jobOffers')
      .where('employerId', '==', uid)
      .get();

    const offers = offersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    }));

    // Sort by createdAt desc in JS to avoid composite index
    offers.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    res.json(offers);
  } catch (error) {
    next(error);
  }
});

// Update job offer
router.patch('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;
    const updates = req.body;

    const db = getDb();
    const jobRef = db.collection('jobOffers').doc(id);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return res.status(404).json({ error: 'Job offer not found' });
    }

    // Verify ownership
    if (jobDoc.data().employerId !== uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Filter allowed updates
    const allowedFields = ['rubro', 'puesto', 'description', 'requirements', 'salary', 'schedule', 'requiredSkills', 'zona', 'active', 'durationDays', 'expiresAt', 'businessName', 'availability'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        // Convert expiresAt string to Date if needed
        if (field === 'expiresAt' && typeof updates[field] === 'string') {
          filteredUpdates[field] = new Date(updates[field]);
        } else {
          filteredUpdates[field] = updates[field];
        }
      }
    }

    // If durationDays is updated, recalculate expiresAt from createdAt
    if (filteredUpdates.durationDays !== undefined && !filteredUpdates.expiresAt) {
      const jobData = jobDoc.data();
      const createdAt = jobData.createdAt?.toDate?.() || jobData.createdAt || new Date();
      filteredUpdates.expiresAt = new Date(new Date(createdAt).getTime() + filteredUpdates.durationDays * 24 * 60 * 60 * 1000);
    }

    filteredUpdates.updatedAt = new Date();

    await jobRef.update(filteredUpdates);

    res.json({
      message: 'Job offer updated',
      id,
      updates: filteredUpdates
    });
  } catch (error) {
    next(error);
  }
});

// Mark offer as "not interested" (for workers)
router.post('/:id/not-interested', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;

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
      return res.status(403).json({ error: 'Only workers can mark offers as not interested' });
    }

    // Verify offer exists
    const offerDoc = await db.collection('jobOffers').doc(id).get();
    if (!offerDoc.exists) {
      return res.status(404).json({ error: 'Job offer not found' });
    }

    // Check if already marked
    const existingSnapshot = await db.collection('offerInteractions')
      .where('offerId', '==', id)
      .where('userId', '==', uid)
      .where('type', '==', 'not_interested')
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      return res.json({ message: 'Already marked as not interested', alreadyMarked: true });
    }

    // Create interaction record
    await db.collection('offerInteractions').add({
      offerId: id,
      userId: uid,
      type: 'not_interested',
      createdAt: new Date()
    });

    // Update offer stats (atomic increment)
    await db.collection('jobOffers').doc(id).update({
      'stats.notInterestedCount': FieldValue.increment(1)
    });

    res.json({ message: 'Marked as not interested', offerId: id });
  } catch (error) {
    next(error);
  }
});

// Get interested workers for an offer
router.get('/:id/interested', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;

    const db = getDb();

    // Get the offer
    const offerDoc = await db.collection('jobOffers').doc(id).get();
    if (!offerDoc.exists) {
      return res.status(404).json({ error: 'Job offer not found' });
    }

    // Verify ownership
    if (offerDoc.data().employerId !== uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get interested interactions
    const interactionsSnapshot = await db.collection('offerInteractions')
      .where('offerId', '==', id)
      .where('type', '==', 'interested')
      .get();

    if (interactionsSnapshot.empty) {
      return res.json({ interested: [], total: 0 });
    }

    // Get worker details for each interested user
    const workerIds = interactionsSnapshot.docs.map(doc => doc.data().userId);

    // Check which workers already have a contact request from this employer
    const contactRequestsSnapshot = await db.collection('contactRequests')
      .where('fromUid', '==', uid)
      .where('offerId', '==', id)
      .get();

    const contactedWorkerIds = new Set(
      contactRequestsSnapshot.docs.map(doc => doc.data().toUid)
    );

    // Get worker profiles and user info
    const interested = await Promise.all(
      workerIds.map(async (workerId) => {
        const [workerDoc, userDoc] = await Promise.all([
          db.collection('workers').doc(workerId).get(),
          db.collection('users').doc(workerId).get()
        ]);

        const workerData = workerDoc.exists ? workerDoc.data() : null;
        const userData = userDoc.exists ? userDoc.data() : null;

        if (!workerData) return null;

        return {
          uid: workerId,
          ...workerData,
          firstName: userData?.firstName,
          lastName: userData?.lastName,
          email: userData?.email,
          hasBeenContacted: contactedWorkerIds.has(workerId)
        };
      })
    );

    // Filter out nulls and sort by those not contacted first
    const filteredInterested = interested
      .filter(Boolean)
      .sort((a, b) => {
        if (a.hasBeenContacted === b.hasBeenContacted) return 0;
        return a.hasBeenContacted ? 1 : -1;
      });

    res.json({
      interested: filteredInterested,
      total: filteredInterested.length
    });
  } catch (error) {
    next(error);
  }
});

// Delete job offer
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;

    const db = getDb();
    const jobRef = db.collection('jobOffers').doc(id);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return res.status(404).json({ error: 'Job offer not found' });
    }

    // Verify ownership
    if (jobDoc.data().employerId !== uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await jobRef.delete();

    res.json({ message: 'Job offer deleted', id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
