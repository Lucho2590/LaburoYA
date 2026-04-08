const express = require('express');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create or update employer profile
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { businessName, rubro, localidad, photoUrl, description, address, phone } = req.body;

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
      localidad: localidad || null,
      photoUrl: photoUrl || null,
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

// GET /dashboard - Get employer dashboard with stats
router.get('/dashboard', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
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
      return res.status(403).json({ error: 'Only employers can access dashboard' });
    }

    // Get all job offers for this employer
    const offersSnapshot = await db.collection('jobOffers')
      .where('employerId', '==', uid)
      .get();

    if (offersSnapshot.empty) {
      return res.json({
        summary: {
          totalOffers: 0,
          activeOffers: 0,
          totalInterested: 0,
          interestedNotContacted: 0,
          totalCandidates: 0,
          totalMatches: 0
        },
        offers: []
      });
    }

    const offerIds = offersSnapshot.docs.map(doc => doc.id);

    // Get all contact requests FROM this employer (to know who was contacted)
    const sentRequestsSnapshot = await db.collection('contactRequests')
      .where('fromUid', '==', uid)
      .where('fromType', '==', 'employer')
      .get();

    const contactedWorkersByOffer = new Map();
    sentRequestsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!contactedWorkersByOffer.has(data.offerId)) {
        contactedWorkersByOffer.set(data.offerId, new Set());
      }
      contactedWorkersByOffer.get(data.offerId).add(data.toUid);
    });

    // Get all matches for this employer
    const matchesSnapshot = await db.collection('matches')
      .where('employerId', '==', uid)
      .get();

    const matchesByOffer = new Map();
    matchesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!matchesByOffer.has(data.offerId)) {
        matchesByOffer.set(data.offerId, []);
      }
      matchesByOffer.get(data.offerId).push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      });
    });

    // Get interested interactions for all offers
    const interactionsSnapshot = await db.collection('offerInteractions')
      .where('type', '==', 'interested')
      .get();

    const interestedByOffer = new Map();
    interactionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (offerIds.includes(data.offerId)) {
        if (!interestedByOffer.has(data.offerId)) {
          interestedByOffer.set(data.offerId, []);
        }
        interestedByOffer.get(data.offerId).push(data.userId);
      }
    });

    // Get worker profiles for candidate count estimation
    const workersSnapshot = await db.collection('workers')
      .where('active', '!=', false)
      .get();

    const activeWorkers = workersSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));

    // Process each offer
    let totalInterested = 0;
    let interestedNotContacted = 0;
    let totalCandidates = 0;
    let totalMatches = 0;
    let activeOffers = 0;

    const offers = offersSnapshot.docs.map(doc => {
      const data = doc.data();
      const offerId = doc.id;

      // Check if active and not expired
      const now = new Date();
      const expiresAt = data.expiresAt?.toDate?.() || data.expiresAt;
      const isExpired = expiresAt && new Date(expiresAt) < now;
      const isActive = data.active !== false && !isExpired;

      if (isActive) activeOffers++;

      // Interested workers
      const interested = interestedByOffer.get(offerId) || [];
      const contactedSet = contactedWorkersByOffer.get(offerId) || new Set();
      const interestedNotContactedCount = interested.filter(wId => !contactedSet.has(wId)).length;

      totalInterested += interested.length;
      interestedNotContacted += interestedNotContactedCount;

      // Matches
      const offerMatches = matchesByOffer.get(offerId) || [];
      const acceptedMatches = offerMatches.filter(m => m.status === 'accepted');
      totalMatches += acceptedMatches.length;

      // Candidate count (workers that match rubro/puesto)
      const candidates = activeWorkers.filter(worker => {
        // Full match: same rubro AND puesto
        if (worker.rubro === data.rubro && worker.puesto === data.puesto) return true;
        // Partial match: same rubro
        if (worker.rubro === data.rubro) return true;
        // Skills match
        if (data.requiredSkills && data.requiredSkills.length > 0 && worker.skills) {
          const matchingSkills = data.requiredSkills.filter(s => worker.skills.includes(s));
          if (matchingSkills.length > 0) return true;
        }
        return false;
      });

      totalCandidates += candidates.length;

      return {
        id: offerId,
        rubro: data.rubro,
        puesto: data.puesto,
        description: data.description,
        salary: data.salary,
        schedule: data.schedule,
        zona: data.zona,
        businessName: data.businessName || null,
        availability: data.availability || null,
        requiredSkills: data.requiredSkills || [],
        active: data.active !== false,
        isExpired,
        durationDays: data.durationDays || 3,
        expiresAt: expiresAt,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        stats: {
          interested: interested.length,
          interestedNotContacted: interestedNotContactedCount,
          candidates: candidates.length,
          matches: acceptedMatches.length
        }
      };
    });

    // Sort by createdAt desc
    offers.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    res.json({
      summary: {
        totalOffers: offers.length,
        activeOffers,
        totalInterested,
        interestedNotContacted,
        totalCandidates,
        totalMatches
      },
      offers
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
