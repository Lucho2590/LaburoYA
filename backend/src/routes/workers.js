const express = require('express');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const matchingService = require('../services/matchingService');

const router = express.Router();

// Create or update worker profile
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { rubro, puesto, zona, videoUrl, description, experience } = req.body;

    if (!rubro || !puesto) {
      return res.status(400).json({ error: 'rubro and puesto are required' });
    }

    const db = getDb();

    // Verify user is registered as worker
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'worker') {
      return res.status(403).json({ error: 'User must be registered as worker' });
    }

    const workerData = {
      uid,
      rubro,
      puesto,
      zona: zona || null,
      videoUrl: videoUrl || null,
      description: description || null,
      experience: experience || null,
      active: true,
      updatedAt: new Date()
    };

    // Check if profile exists
    const existingProfile = await db.collection('workers').doc(uid).get();
    const isNewProfile = !existingProfile.exists;

    if (isNewProfile) {
      workerData.createdAt = new Date();
    }

    // Save worker profile
    await db.collection('workers').doc(uid).set(workerData, { merge: true });

    // Run matching logic
    const newMatches = await matchingService.findMatchesForWorker(uid, workerData);

    res.json({
      message: isNewProfile ? 'Worker profile created' : 'Worker profile updated',
      profile: workerData,
      newMatches: newMatches.length,
      matches: newMatches
    });
  } catch (error) {
    next(error);
  }
});

// Get worker profile
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const db = getDb();

    const workerDoc = await db.collection('workers').doc(uid).get();

    if (!workerDoc.exists) {
      return res.status(404).json({ error: 'Worker profile not found' });
    }

    res.json(workerDoc.data());
  } catch (error) {
    next(error);
  }
});

// Update worker active status
router.patch('/status', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'active must be a boolean' });
    }

    const db = getDb();
    await db.collection('workers').doc(uid).update({
      active,
      updatedAt: new Date()
    });

    res.json({ message: 'Status updated', active });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
