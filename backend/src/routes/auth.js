const express = require('express');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Register/update user role
router.post('/register', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { role } = req.body;

    if (!role || !['worker', 'employer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "worker" or "employer"' });
    }

    const db = getDb();

    // Create or update user document
    await db.collection('users').doc(uid).set({
      uid,
      role,
      createdAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });

    res.json({
      message: 'User registered successfully',
      uid,
      role
    });
  } catch (error) {
    next(error);
  }
});

// Get current user info
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const db = getDb();

    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    let profileData = null;

    // Get profile based on role
    if (userData.role === 'worker') {
      const workerDoc = await db.collection('workers').doc(uid).get();
      if (workerDoc.exists) {
        profileData = workerDoc.data();
      }
    } else if (userData.role === 'employer') {
      const employerDoc = await db.collection('employers').doc(uid).get();
      if (employerDoc.exists) {
        profileData = employerDoc.data();
      }
    }

    res.json({
      user: userData,
      profile: profileData
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
