const express = require('express');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create or update employer profile
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { businessName, rubro, description, address, phone } = req.body;

    if (!businessName || !rubro) {
      return res.status(400).json({ error: 'businessName and rubro are required' });
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

    const employerData = {
      uid,
      businessName,
      rubro,
      description: description || null,
      address: address || null,
      phone: phone || null,
      active: true,
      updatedAt: new Date()
    };

    // Check if profile exists
    const existingProfile = await db.collection('employers').doc(uid).get();
    const isNewProfile = !existingProfile.exists;

    if (isNewProfile) {
      employerData.createdAt = new Date();
    }

    // Save employer profile
    await db.collection('employers').doc(uid).set(employerData, { merge: true });

    res.json({
      message: isNewProfile ? 'Employer profile created' : 'Employer profile updated',
      profile: employerData
    });
  } catch (error) {
    next(error);
  }
});

// Get employer profile
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const db = getDb();

    const employerDoc = await db.collection('employers').doc(uid).get();

    if (!employerDoc.exists) {
      return res.status(404).json({ error: 'Employer profile not found' });
    }

    res.json(employerDoc.data());
  } catch (error) {
    next(error);
  }
});

module.exports = router;
