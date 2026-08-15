const express = require('express');
const admin = require('firebase-admin');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const matchingService = require('../services/matchingService');
const { MATCH_TYPES } = require('../services/matchingService');
const citiesService = require('../services/citiesService');
const { resolveActingContext, isEmployerLike } = require('../utils/actingContext');
const companySubscription = require('../utils/companySubscription');
const profileBlocks = require('../services/profileBlocks');

const router = express.Router();
const FieldValue = admin.firestore.FieldValue;

// Una solicitud de contacto cuenta como "ya solicitada" sólo si sigue activa:
// pendiente vigente o ya matcheada. Las rechazadas/vencidas permiten re-postularse.
function isActiveRequest(data) {
  if (!data) return false;
  if (data.status === 'matched') return true;
  if (data.status !== 'pending') return false;
  const expiry = data.expiresAt?.toDate ? data.expiresAt.toDate() : (data.expiresAt ? new Date(data.expiresAt) : null);
  return expiry ? expiry.getTime() >= Date.now() : true;
}

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

    // El perfil laboral (workers/{uid}) se crea recién en /worker/profile, así que
    // un recién registrado todavía no lo tiene. En vez de cortar con 404, seguimos
    // con el feed vacío: igual puede haber una oferta compartida para fijar.
    let relevantOffers = [];
    let hasWorkerProfile = true;
    try {
      relevantOffers = await matchingService.getRelevantOffersForWorker(uid);
    } catch (err) {
      if (err.message !== 'Worker not found') throw err;
      hasWorkerProfile = false;
    }

    // Get offers marked as "not interested" by this worker
    const notInterestedSnapshot = await db.collection('offerInteractions')
      .where('userId', '==', uid)
      .where('type', '==', 'not_interested')
      .get();

    const notInterestedOfferIds = new Set();
    notInterestedSnapshot.docs.forEach(doc => {
      notInterestedOfferIds.add(doc.data().offerId);
    });

    // Filter out not interested offers AND offers without a valid matchType
    // (offers can have score > 0 from bonuses but no actual match)
    const filteredOffers = relevantOffers.filter(o =>
      !notInterestedOfferIds.has(o.id) && o.relevance.matchType !== null
    );

    // Group by match type
    const grouped = {
      fullMatch: filteredOffers.filter(o => o.relevance.matchType === MATCH_TYPES.FULL_MATCH),
      partialMatch: filteredOffers.filter(o => o.relevance.matchType === MATCH_TYPES.PARTIAL_MATCH),
      skillsMatch: filteredOffers.filter(o => o.relevance.matchType === MATCH_TYPES.SKILLS_MATCH)
    };

    // Check which offers the worker has already requested
    const sentRequestsSnapshot = await db.collection('contactRequests')
      .where('fromUid', '==', uid)
      .get();

    const requestedOfferIds = new Set();
    sentRequestsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (isActiveRequest(data)) requestedOfferIds.add(data.offerId);
    });

    // Mark offers that have been requested
    const markRequested = (offers) => offers.map(offer => ({
      ...offer,
      hasRequested: requestedOfferIds.has(offer.id)
    }));

    // Oferta compartida por link/QR: se fija arriba del feed aunque no matchee,
    // hasta que el worker se postule o la descarte (ahí se limpia el campo).
    const pinned = await resolveSharedOffer(db, uid, userData.sharedOfferId, {
      notInterestedOfferIds,
      requestedOfferIds
    });

    res.json({
      pinned,
      hasWorkerProfile,
      fullMatch: markRequested(grouped.fullMatch).filter(o => o.id !== pinned?.id),
      partialMatch: markRequested(grouped.partialMatch).filter(o => o.id !== pinned?.id),
      skillsMatch: markRequested(grouped.skillsMatch).filter(o => o.id !== pinned?.id),
      total: filteredOffers.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Devuelve la oferta compartida a fijar, o null. Si dejó de ser fijable (borrada,
 * pausada, vencida, ya postulada o descartada) limpia sharedOfferId del usuario
 * para no volver a mirarla en cada carga del feed.
 */
async function resolveSharedOffer(db, uid, sharedOfferId, { notInterestedOfferIds, requestedOfferIds }) {
  if (!sharedOfferId) return null;

  const clear = async () => {
    await db.collection('users').doc(uid).update({
      sharedOfferId: FieldValue.delete()
    });
    return null;
  };

  if (notInterestedOfferIds.has(sharedOfferId) || requestedOfferIds.has(sharedOfferId)) {
    return clear();
  }

  const offerDoc = await db.collection('jobOffers').doc(sharedOfferId).get();
  if (!offerDoc.exists) return clear();

  const offer = { id: offerDoc.id, ...offerDoc.data() };
  if (offer.active === false || matchingService.isOfferExpired(offer)) return clear();

  // calculateRelevanceScore resuelve ciudades de forma síncrona; si el worker no
  // tenía perfil no pasamos por getRelevantOffersForWorker, que es quien las carga.
  await citiesService.ensureLoaded();

  // El dueño puede ser un employer individual o una empresa; mismo lookup que
  // matchingService al armar el feed.
  let owner = await db.collection('employers').doc(offer.employerId).get();
  if (!owner.exists) owner = await db.collection('companies').doc(offer.employerId).get();

  // El worker puede no tener perfil todavía: la relevancia da matchType null y
  // la card se muestra igual, sin estrellas.
  const workerDoc = await db.collection('workers').doc(uid).get();
  const relevance = matchingService.calculateRelevanceScore(
    workerDoc.exists ? workerDoc.data() : {},
    offer
  );

  return {
    ...offer,
    employer: owner.exists ? owner.data() : null,
    relevance,
    createdAt: offer.createdAt?.toDate?.() || offer.createdAt,
    hasRequested: false
  };
}

/**
 * GET /workers
 * Employer discovers relevant workers for all their offers
 */
router.get('/workers', authMiddleware, async (req, res, next) => {
  try {
    const { actingUid: uid, effectiveRole } = await resolveActingContext(req);
    const db = getDb();

    // Verify user is an employer/company (o superuser actuando como tal)
    if (!isEmployerLike(effectiveRole)) {
      return res.status(403).json({ error: 'Only employers can discover workers' });
    }
    // Empresa: bloquear ver candidatos si el plan venció.
    if (effectiveRole === 'company') {
      await companySubscription.loadActiveCompanyOrThrow(getDb(), uid);
    }

    const grouped = await matchingService.getAllRelevantWorkersForEmployer(uid);

    // Excluir workers bloqueados por este empleador/empresa (no volver a verlos).
    const { uids: blockedUids } = await profileBlocks.listBlockedKeysForOrg(db, uid);
    const filterBlocked = (workers) => workers.filter(w => !blockedUids.has(w.uid));
    const fullMatch = filterBlocked(grouped.fullMatch);
    const partialMatch = filterBlocked(grouped.partialMatch);
    const skillsMatch = filterBlocked(grouped.skillsMatch);
    const locked = filterBlocked(grouped.locked || []);

    // Check which workers the employer has already requested
    const sentRequestsSnapshot = await db.collection('contactRequests')
      .where('fromUid', '==', uid)
      .get();

    const requestedWorkerOfferPairs = new Set();
    sentRequestsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (isActiveRequest(data)) requestedWorkerOfferPairs.add(`${data.workerId}:${data.offerId}`);
    });

    // Mark workers that have been requested for their best offer
    const markRequested = (workers) => workers.map(worker => ({
      ...worker,
      hasRequested: requestedWorkerOfferPairs.has(`${worker.uid}:${worker.bestOffer?.id}`)
    }));

    res.json({
      fullMatch: markRequested(fullMatch),
      partialMatch: markRequested(partialMatch),
      skillsMatch: markRequested(skillsMatch),
      // Candidatos de búsquedas pausadas o vencidas: vienen ya redactados
      // desde matchingService y se muestran bloqueados.
      locked,
      total: fullMatch.length + partialMatch.length + skillsMatch.length
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
    const { actingUid: uid, effectiveRole } = await resolveActingContext(req);
    const { offerId } = req.params;
    const db = getDb();

    // Verify user is an employer/company (o superuser actuando como tal)
    if (!isEmployerLike(effectiveRole)) {
      return res.status(403).json({ error: 'Only employers can discover workers' });
    }
    // Empresa: bloquear ver candidatos si el plan venció.
    if (effectiveRole === 'company') {
      await companySubscription.loadActiveCompanyOrThrow(getDb(), uid);
    }

    const relevantWorkersAll = await matchingService.getRelevantWorkersForOffer(offerId, uid);

    // Excluir workers bloqueados por este empleador/empresa.
    const { uids: blockedUids } = await profileBlocks.listBlockedKeysForOrg(db, uid);
    const relevantWorkers = relevantWorkersAll.filter(w => !blockedUids.has(w.uid));

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
      const data = doc.data();
      if (isActiveRequest(data)) requestedWorkerIds.add(data.workerId);
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
