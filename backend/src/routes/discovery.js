const express = require('express');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const matchingService = require('../services/matchingService');
const { MATCH_TYPES } = require('../services/matchingService');

const router = express.Router();

/**
 * GET /offers
 * Worker discovers relevant job offers sorted by relevance
 */
router.get('/offers', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
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
      return res.status(403).json({ error: 'Only workers can discover offers' });
    }

    const relevantOffers = await matchingService.getRelevantOffersForWorker(uid);

    // Group by match type
    const grouped = {
      fullMatch: relevantOffers.filter(o => o.relevance.matchType === MATCH_TYPES.FULL_MATCH),
      partialMatch: relevantOffers.filter(o => o.relevance.matchType === MATCH_TYPES.PARTIAL_MATCH),
      skillsMatch: relevantOffers.filter(o => o.relevance.matchType === MATCH_TYPES.SKILLS_MATCH)
    };

    // Check which offers the worker has already requested
    const sentRequestsSnapshot = await db.collection('contactRequests')
      .where('fromUid', '==', uid)
      .get();

    const requestedOfferIds = new Set();
    sentRequestsSnapshot.docs.forEach(doc => {
      requestedOfferIds.add(doc.data().offerId);
    });

    // Mark offers that have been requested
    const markRequested = (offers) => offers.map(offer => ({
      ...offer,
      hasRequested: requestedOfferIds.has(offer.id)
    }));

    res.json({
      fullMatch: markRequested(grouped.fullMatch),
      partialMatch: markRequested(grouped.partialMatch),
      skillsMatch: markRequested(grouped.skillsMatch),
      total: relevantOffers.length
    });
  } catch (error) {
    if (error.message === 'Worker not found') {
      return res.status(404).json({ error: 'Worker profile not found. Please complete your profile first.' });
    }
    next(error);
  }
});

/**
 * GET /workers
 * Employer discovers relevant workers for all their offers
 */
router.get('/workers', authMiddleware, async (req, res, next) => {
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
      return res.status(403).json({ error: 'Only employers can discover workers' });
    }

    const grouped = await matchingService.getAllRelevantWorkersForEmployer(uid);

    // Check which workers the employer has already requested
    const sentRequestsSnapshot = await db.collection('contactRequests')
      .where('fromUid', '==', uid)
      .get();

    const requestedWorkerOfferPairs = new Set();
    sentRequestsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      requestedWorkerOfferPairs.add(`${data.workerId}:${data.offerId}`);
    });

    // Mark workers that have been requested for their best offer
    const markRequested = (workers) => workers.map(worker => ({
      ...worker,
      hasRequested: requestedWorkerOfferPairs.has(`${worker.uid}:${worker.bestOffer?.id}`)
    }));

    res.json({
      fullMatch: markRequested(grouped.fullMatch),
      partialMatch: markRequested(grouped.partialMatch),
      skillsMatch: markRequested(grouped.skillsMatch),
      total: grouped.fullMatch.length + grouped.partialMatch.length + grouped.skillsMatch.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /workers/for-offer/:offerId
 * Get relevant workers for a specific job offer
 */
router.get('/workers/for-offer/:offerId', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { offerId } = req.params;
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
      return res.status(403).json({ error: 'Only employers can discover workers' });
    }

    const relevantWorkers = await matchingService.getRelevantWorkersForOffer(offerId, uid);

    // Group by match type
    const grouped = {
      fullMatch: relevantWorkers.filter(w => w.relevance.matchType === MATCH_TYPES.FULL_MATCH),
      partialMatch: relevantWorkers.filter(w => w.relevance.matchType === MATCH_TYPES.PARTIAL_MATCH),
      skillsMatch: relevantWorkers.filter(w => w.relevance.matchType === MATCH_TYPES.SKILLS_MATCH)
    };

    // Check which workers have been requested for this offer
    const sentRequestsSnapshot = await db.collection('contactRequests')
      .where('fromUid', '==', uid)
      .where('offerId', '==', offerId)
      .get();

    const requestedWorkerIds = new Set();
    sentRequestsSnapshot.docs.forEach(doc => {
      requestedWorkerIds.add(doc.data().workerId);
    });

    // Mark workers that have been requested
    const markRequested = (workers) => workers.map(worker => ({
      ...worker,
      hasRequested: requestedWorkerIds.has(worker.uid)
    }));

    res.json({
      offerId,
      fullMatch: markRequested(grouped.fullMatch),
      partialMatch: markRequested(grouped.partialMatch),
      skillsMatch: markRequested(grouped.skillsMatch),
      total: relevantWorkers.length
    });
  } catch (error) {
    if (error.message === 'Job offer not found') {
      return res.status(404).json({ error: 'Job offer not found' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ error: 'This job offer does not belong to you' });
    }
    next(error);
  }
});

module.exports = router;
