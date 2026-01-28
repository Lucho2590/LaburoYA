const express = require('express');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const matchingService = require('../services/matchingService');

const router = express.Router();

// Create job offer
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { rubro, puesto, description, requirements, salary, schedule } = req.body;

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

    const jobOfferData = {
      employerId: uid,
      rubro,
      puesto,
      description: description || null,
      requirements: requirements || null,
      salary: salary || null,
      schedule: schedule || null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
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
    const allowedFields = ['rubro', 'puesto', 'description', 'requirements', 'salary', 'schedule', 'active'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
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
