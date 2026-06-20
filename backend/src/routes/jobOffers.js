const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const admin = require('firebase-admin');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const matchingService = require('../services/matchingService');
const cvAssessment = require('../services/cvAssessment');
const aiProvider = require('../services/aiProvider');
const locationService = require('../services/locationService');
const { normalizeZona } = require('../utils/constants');
const FieldValue = admin.firestore.FieldValue;

const router = express.Router();

// Default duration for job offers in days
const DEFAULT_DURATION_DAYS = 3;

// CV upload for assessment (in-memory, 5MB cap). Accepts PDF, JPG/PNG and .docx.
const ALLOWED_CV_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const ALLOWED_CV_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'docx']);
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname || '').toLowerCase().split('.').pop();
    if (ALLOWED_CV_MIME.has(file.mimetype) || ALLOWED_CV_EXT.has(ext)) {
      return cb(null, true);
    }
    const err = new Error('Formato no soportado. Subí un PDF, una imagen (JPG/PNG) o un Word (.docx).');
    err.status = 422;
    cb(err);
  }
});

// Create job offer
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { rubro, puesto, description, requirements, salary, schedule, requiredSkills, zona, durationDays, businessName, availability, location, city, radiusKm } = req.body;

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

    const canonicalZona = normalizeZona(zona) || zona || null;
    // Resuelve ubicación + ciudad (GPS del form, o geocoding de zona/ciudad).
    const enriched = await locationService.enrichLocation({ location, city, zona: canonicalZona });

    const jobOfferData = {
      employerId: uid,
      rubro,
      puesto,
      description: description || null,
      requirements: requirements || null,
      salary: salary || null,
      schedule: schedule || null,
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      zona: canonicalZona,
      city: enriched.city,
      radiusKm: Number(radiusKm) > 0 ? Number(radiusKm) : null,
      location: enriched.location,
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
    const allowedFields = ['rubro', 'puesto', 'description', 'requirements', 'salary', 'schedule', 'requiredSkills', 'zona', 'city', 'radiusKm', 'active', 'durationDays', 'expiresAt', 'businessName', 'availability', 'aiAssessEnabled', 'location'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        // Convert expiresAt string to Date if needed
        if (field === 'expiresAt' && typeof updates[field] === 'string') {
          filteredUpdates[field] = new Date(updates[field]);
        } else if (field === 'aiAssessEnabled') {
          filteredUpdates[field] = Boolean(updates[field]);
        } else if (field === 'location') {
          filteredUpdates[field] = matchingService.sanitizeLocation(updates[field]);
        } else if (field === 'zona') {
          filteredUpdates[field] = normalizeZona(updates[field]) || updates[field] || null;
        } else if (field === 'radiusKm') {
          filteredUpdates[field] = Number(updates[field]) > 0 ? Number(updates[field]) : null;
        } else {
          filteredUpdates[field] = updates[field];
        }
      }
    }

    // Si cambió zona o ciudad y no se mandó GPS, re-geocodificar para mantener
    // el match por proximidad (sin pisar un GPS existente válido).
    if ((filteredUpdates.zona !== undefined || filteredUpdates.city !== undefined) && updates.location === undefined) {
      const merged = { ...jobDoc.data(), ...filteredUpdates };
      if (!matchingService.sanitizeLocation(merged.location)) {
        const enriched = await locationService.enrichLocation({ location: null, city: merged.city, zona: merged.zona });
        filteredUpdates.location = enriched.location;
        filteredUpdates.city = enriched.city;
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

// Assess a CV (PDF) against a specific job offer
router.post('/:offerId/assess-cv', authMiddleware, pdfUpload.single('cv'), async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { offerId } = req.params;
    const db = getDb();

    const offerDoc = await db.collection('jobOffers').doc(offerId).get();
    if (!offerDoc.exists) {
      return res.status(404).json({ error: 'Oferta no encontrada' });
    }
    const offer = offerDoc.data();

    if (offer.employerId !== uid) {
      return res.status(403).json({ error: 'No tenés permiso sobre esta oferta' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Falta el archivo PDF (campo "cv")' });
    }

    // Fingerprint of the exact file, to detect the same CV uploaded twice.
    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    // Load the offer's existing ranking once; reuse it for both dedup checks.
    const existingSnap = await db.collection('pinnedCandidates')
      .where('offerId', '==', offerId)
      .get();
    const existingDocs = existingSnap.docs
      .filter(d => d.data().employerId === uid)
      .map(d => ({ id: d.id, ...d.data() }));

    // a) Same file already in the ranking → don't re-run AI nor duplicate.
    const sameFile = existingDocs.find(d => d.fileHash && d.fileHash === fileHash);
    if (sameFile) {
      return res.json({
        duplicate: 'file',
        existingId: sameFile.id,
        id: sameFile.id,
        mode: sameFile.assessment?.mode || 'basic',
        source: sameFile.assessment?.source,
        candidate: sameFile.candidate,
        assessment: sameFile.assessment,
      });
    }

    // The per-employer aiCvEnabled flag decides the evaluation mode:
    //  - enabled  → AI extraction (reads scanned PDFs too) + structural match
    //  - disabled → basic text reading + keyword match (no AI)
    const userDoc = await db.collection('users').doc(uid).get();
    const userAi = userDoc.exists && userDoc.data().aiCvEnabled === true;
    // Per-offer toggle: default ON when undefined (backward compatible).
    const aiEnabled = userAi && offer.aiAssessEnabled !== false;

    // b) Evaluate (AI or basic) and normalize into { mode, source, candidate, assessment }.
    let result;
    let aiUsage = null;
    if (aiEnabled) {
      const a = await cvAssessment.assessFit(req.file.buffer, req.file.mimetype, req.file.originalname, offer);
      aiUsage = a.usage || null;
      result = {
        mode: 'ai',
        source: a.source,
        candidate: {
          firstName: a.firstName || null,
          lastName: a.lastName || null,
          email: a.email || null,
          phone: a.phone || null
        },
        assessment: {
          score: a.fitScore,
          stars: matchingService.scoreToStars(a.fitScore),
          recommendation: a.recommendation,
          summary: a.summary,
          strengths: Array.isArray(a.strengths) ? a.strengths : [],
          gaps: Array.isArray(a.gaps) ? a.gaps : [],
          matchingSkills: Array.isArray(a.matchingSkills) ? a.matchingSkills : [],
          missingSkills: Array.isArray(a.missingSkills) ? a.missingSkills : []
        }
      };
    } else {
      // Basic mode (no AI): read the CV (text or OCR), build a profile from the
      // taxonomy and score it with the same engine as the real match.
      const r = await cvAssessment.assessBasic(req.file.buffer, req.file.mimetype, req.file.originalname, offer);
      result = { mode: 'basic', source: r.source, candidate: r.candidate, assessment: r.assessment };
    }

    // c) Same person already in the ranking (different file): keep both so the
    // employer can compare; just flag it so the UI can warn.
    const email = result.candidate.email ? String(result.candidate.email).trim().toLowerCase() : null;
    const phone = result.candidate.phone ? String(result.candidate.phone).replace(/\D/g, '') : null;
    const samePerson = existingDocs.find(d => {
      const dEmail = d.candidate?.email ? String(d.candidate.email).trim().toLowerCase() : null;
      const dPhone = d.candidate?.phone ? String(d.candidate.phone).replace(/\D/g, '') : null;
      return (email && dEmail && email === dEmail) || (phone && dPhone && phone === dPhone);
    });

    // d) Persist the new ranking entry.
    const docData = await buildCandidateDoc(uid, offerId, fileHash, result, offer);
    const ref = await db.collection('pinnedCandidates').add(docData);

    // e) Accumulate AI spend on the offer (only when a real AI call happened).
    if (aiUsage) {
      try {
        const cost = aiProvider.estimateCostUsd(aiUsage.model, aiUsage);
        await db.collection('jobOffers').doc(offerId).update({
          'aiUsage.cvCount': FieldValue.increment(1),
          'aiUsage.inputTokens': FieldValue.increment(aiUsage.inputTokens || 0),
          'aiUsage.outputTokens': FieldValue.increment(aiUsage.outputTokens || 0),
          'aiUsage.costUsd': FieldValue.increment(cost),
          'aiUsage.updatedAt': new Date(),
        });
      } catch (e) {
        console.error('[assess-cv] no se pudo actualizar aiUsage:', e.message);
      }
    }

    return res.json({
      id: ref.id,
      ...(samePerson ? { duplicate: 'person', existingId: samePerson.id } : {}),
      mode: result.mode,
      source: result.source,
      candidate: result.candidate,
      assessment: result.assessment,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        rateLimited: !!error.rateLimited,
        rateScope: error.rateScope,
        retryAfter: error.retryAfter,
      });
    }
    next(error);
  }
});

// ----- Pinned candidates (evaluated CVs the employer wants to keep on an offer) -----

// Loads an offer and ensures the requesting user owns it.
async function loadOwnedOffer(db, offerId, uid) {
  const offerDoc = await db.collection('jobOffers').doc(offerId).get();
  if (!offerDoc.exists) {
    const err = new Error('Oferta no encontrada');
    err.status = 404;
    throw err;
  }
  if (offerDoc.data().employerId !== uid) {
    const err = new Error('No tenés permiso sobre esta oferta');
    err.status = 403;
    throw err;
  }
  return offerDoc;
}

// Builds the Firestore doc for a ranking entry from a normalized assessment result.
async function buildCandidateDoc(uid, offerId, fileHash, result, offer = {}) {
  const candidate = result.candidate || {};
  const assessment = result.assessment || {};
  const canonicalZona = normalizeZona(candidate.zona) || candidate.zona || null;
  // Geocodifica el candidato (zona/ciudad de la oferta) si todavía no trae coords,
  // para que aparezca con proximidad en el ranking. Reutiliza coords ya resueltas.
  const enriched = await locationService.enrichLocation({
    location: candidate.location,
    city: candidate.city || offer.city,
    zona: canonicalZona
  });
  return {
    offerId,
    employerId: uid,
    fileHash: fileHash || null,
    selected: false,
    candidate: {
      firstName: candidate.firstName || null,
      lastName: candidate.lastName || null,
      email: candidate.email || null,
      phone: candidate.phone || null,
      puesto: candidate.puesto || null,
      zona: canonicalZona,
      city: enriched.city,
      location: enriched.location,
      skills: Array.isArray(candidate.skills) ? candidate.skills : []
    },
    assessment: {
      mode: result.mode || assessment.mode || 'basic',
      source: result.source || null,
      score: Number(assessment.score) || 0,
      stars: Number(assessment.stars) || 0,
      matchType: assessment.matchType || null,
      recommendation: assessment.recommendation || null,
      summary: assessment.summary || null,
      strengths: Array.isArray(assessment.strengths) ? assessment.strengths : [],
      gaps: Array.isArray(assessment.gaps) ? assessment.gaps : [],
      matchingSkills: Array.isArray(assessment.matchingSkills) ? assessment.matchingSkills : [],
      missingSkills: Array.isArray(assessment.missingSkills) ? assessment.missingSkills : []
    },
    createdAt: new Date()
  };
}

// List pinned candidates of an offer
router.get('/:offerId/pinned-candidates', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { offerId } = req.params;
    const db = getDb();
    await loadOwnedOffer(db, offerId, uid);

    const snapshot = await db.collection('pinnedCandidates')
      .where('offerId', '==', offerId)
      .where('employerId', '==', uid)
      .get();

    const pinned = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      }))
      .sort((a, b) => (b.assessment?.score || 0) - (a.assessment?.score || 0));

    res.json({ pinned });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// Remove a pinned candidate
router.delete('/:offerId/pinned-candidates/:pinId', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { offerId, pinId } = req.params;
    const db = getDb();
    await loadOwnedOffer(db, offerId, uid);

    const pinRef = db.collection('pinnedCandidates').doc(pinId);
    const pinDoc = await pinRef.get();
    if (!pinDoc.exists || pinDoc.data().offerId !== offerId || pinDoc.data().employerId !== uid) {
      return res.status(404).json({ error: 'Candidato fijado no encontrado' });
    }
    await pinRef.delete();
    res.json({ message: 'Candidato quitado', id: pinId });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// Mark/unmark a ranked candidate as selected (shortlist)
router.patch('/:offerId/pinned-candidates/:pinId', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { offerId, pinId } = req.params;
    const db = getDb();
    await loadOwnedOffer(db, offerId, uid);

    const pinRef = db.collection('pinnedCandidates').doc(pinId);
    const pinDoc = await pinRef.get();
    if (!pinDoc.exists || pinDoc.data().offerId !== offerId || pinDoc.data().employerId !== uid) {
      return res.status(404).json({ error: 'Candidato no encontrado' });
    }
    const selected = Boolean(req.body?.selected);
    await pinRef.update({ selected });
    res.json({ id: pinId, selected });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

module.exports = router;
