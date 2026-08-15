const express = require('express');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const { resolveActingContext, isEmployerLike } = require('../utils/actingContext');
const matchingService = require('../services/matchingService');
const profileBlocks = require('../services/profileBlocks');
const citiesService = require('../services/citiesService');

const router = express.Router();

// Firestore permite hasta 10 valores en un filtro `in`. Parte un array en lotes.
function chunk10(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i += 10) out.push(arr.slice(i, i + 10));
  return out;
}

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
    const { actingUid: uid, effectiveRole } = await resolveActingContext(req);
    const db = getDb();

    // Verify user is an employer/company (o superuser actuando como tal)
    if (!isEmployerLike(effectiveRole)) {
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
          totalCandidatesLocked: 0,
          totalMatches: 0
        },
        offers: []
      });
    }

    const offerIds = offersSnapshot.docs.map(doc => doc.id);

    // Lecturas independientes en paralelo (antes eran secuenciales).
    // - Las interacciones "interested" se consultan por offerId en lotes de 10
    //   (filtro `in`), en vez de escanear TODA la colección offerInteractions.
    // - Los workers activos se toman del cache compartido de matchingService
    //   (TTL 60s), evitando un full-scan duplicado con discovery.
    const [
      sentRequestsSnapshot,
      matchesSnapshot,
      interactionChunks,
      pinnedSnapshot,
      activeWorkers,
      blocked
    ] = await Promise.all([
      db.collection('contactRequests')
        .where('fromUid', '==', uid)
        .where('fromType', '==', 'employer')
        .get(),
      db.collection('matches')
        .where('employerId', '==', uid)
        .get(),
      Promise.all(
        chunk10(offerIds).map(ids =>
          db.collection('offerInteractions')
            .where('type', '==', 'interested')
            .where('offerId', 'in', ids)
            .get()
        )
      ),
      db.collection('pinnedCandidates')
        .where('employerId', '==', uid)
        .get(),
      matchingService.getActiveWorkers(db),
      // Mismos bloqueados que descuenta /discovery/workers, para que el número
      // del dashboard no cuente gente que la lista nunca va a mostrar.
      profileBlocks.listBlockedKeysForOrg(db, uid)
    ]);

    // El matching real necesita las ciudades cargadas (calculateRelevanceScore
    // las resuelve de forma síncrona).
    await citiesService.ensureLoaded();
    const blockedUids = blocked.uids;

    const contactedWorkersByOffer = new Map();
    sentRequestsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!contactedWorkersByOffer.has(data.offerId)) {
        contactedWorkersByOffer.set(data.offerId, new Set());
      }
      contactedWorkersByOffer.get(data.offerId).add(data.toUid);
    });

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

    const interestedByOffer = new Map();
    interactionChunks.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!interestedByOffer.has(data.offerId)) {
          interestedByOffer.set(data.offerId, []);
        }
        interestedByOffer.get(data.offerId).push(data.userId);
      });
    });

    const pinnedByOffer = new Map();
    pinnedSnapshot.docs.forEach(doc => {
      const oId = doc.data().offerId;
      pinnedByOffer.set(oId, (pinnedByOffer.get(oId) || 0) + 1);
    });

    // Process each offer
    let totalInterested = 0;
    let interestedNotContacted = 0;
    let totalMatches = 0;
    let activeOffers = 0;
    // Los totales del resumen se acumulan como sets de uid: un mismo worker que
    // matchea con varias ofertas es UN candidato, no uno por oferta. Se separan
    // vigentes de bloqueados para poder mostrar los dos números.
    const candidateUids = new Set();
    const lockedCandidateUids = new Set();

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

      // Candidatos: el MISMO criterio que usa /discovery/workers para armar la
      // lista (calculateRelevanceScore + matchType real), en vez de la lógica
      // propia que había acá. Antes bastaba con que coincidiera el rubro, no
      // deduplicaba y no descontaba bloqueados: por eso el dashboard decía 10
      // y la pantalla de candidatos mostraba 0.
      const offerForMatch = { ...data, id: offerId };
      const candidates = activeWorkers.filter(worker => {
        if (blockedUids.has(worker.uid)) return false;
        return matchingService.calculateRelevanceScore(worker, offerForMatch).matchType !== null;
      });

      // Una oferta vencida o pausada sigue teniendo candidatos, pero no se
      // pueden ver hasta republicarla: van contados aparte.
      const bucket = isActive ? candidateUids : lockedCandidateUids;
      candidates.forEach(w => bucket.add(w.uid));

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
        aiAssessEnabled: data.aiAssessEnabled !== false,
        aiUsage: data.aiUsage || null,
        requiredSkills: data.requiredSkills || [],
        active: data.active !== false,
        isExpired,
        durationDays: data.durationDays || 3,
        expiresAt: expiresAt,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        stats: {
          interested: interested.length,
          interestedNotContacted: interestedNotContactedCount,
          // candidates son los visibles; candidatesLocked, los que quedaron
          // detrás de una oferta vencida o pausada.
          candidates: isActive ? candidates.length : 0,
          candidatesLocked: isActive ? 0 : candidates.length,
          matches: acceptedMatches.length,
          pinned: pinnedByOffer.get(offerId) || 0
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
        totalCandidates: candidateUids.size,
        // Sólo los que no están ya contados como visibles: si un worker matchea
        // con una oferta vigente y otra vencida, cuenta como visible.
        totalCandidatesLocked: [...lockedCandidateUids].filter(u => !candidateUids.has(u)).length,
        totalMatches
      },
      offers
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
