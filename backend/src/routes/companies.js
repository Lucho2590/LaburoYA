const express = require('express');
const { getDb, getAuth } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const { resolveActingContext } = require('../utils/actingContext');
const companyCandidates = require('../services/companyCandidates');
const companyMembers = require('../services/companyMembers');
const companySubscription = require('../utils/companySubscription');
const matchingService = require('../services/matchingService');
const citiesService = require('../services/citiesService');

const router = express.Router();

// Resuelve la organización efectiva (uid de la empresa) de la request, o null
// si quien llama no es una empresa (ni superuser impersonando una).
async function resolveCompany(req) {
  const { actingUid, effectiveRole } = await resolveActingContext(req);
  if (effectiveRole !== 'company') return null;
  return actingUid;
}

// Resuelve la organización SOLO si quien llama es el dueño (uid === organizationId)
// o un superuser impersonando. Un miembro invitado recibe null → 403.
async function resolveCompanyOwner(req) {
  const { actingUid, effectiveRole, isImpersonating } = await resolveActingContext(req);
  if (effectiveRole !== 'company') return null;
  const isOwner = isImpersonating || req.user.uid === actingUid;
  return isOwner ? actingUid : null;
}

// GET /api/companies/me - Perfil de la empresa
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const organizationId = await resolveCompany(req);
    if (!organizationId) {
      return res.status(403).json({ error: 'Solo cuentas empresa pueden acceder a este recurso' });
    }
    const db = getDb();
    const companyDoc = await db.collection('companies').doc(organizationId).get();
    if (!companyDoc.exists) {
      return res.status(404).json({ error: 'Perfil de empresa no encontrado' });
    }
    res.json(companyDoc.data());
  } catch (error) {
    next(error);
  }
});

// PATCH /api/companies/me - Actualizar el perfil de la empresa (campos editables).
// No se bloquea por vencimiento (el perfil se puede editar siempre).
router.patch('/me', authMiddleware, async (req, res, next) => {
  try {
    const organizationId = await resolveCompany(req);
    if (!organizationId) {
      return res.status(403).json({ error: 'Solo cuentas empresa pueden editar este perfil' });
    }
    const db = getDb();

    const allowed = ['businessName', 'rubro', 'localidad', 'city', 'address', 'phone', 'description', 'photoUrl', 'contactName'];
    const updates = { updatedAt: new Date() };
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field] === '' ? null : req.body[field];
      }
    }
    if (updates.businessName === null) {
      return res.status(400).json({ error: 'La razón social no puede quedar vacía' });
    }

    await db.collection('companies').doc(organizationId).update(updates);
    const updated = await db.collection('companies').doc(organizationId).get();
    res.json({ message: 'Perfil actualizado', profile: updated.data() });
  } catch (error) {
    next(error);
  }
});

// GET /api/companies/talent-pool - Lista el talent pool de la organización
router.get('/talent-pool', authMiddleware, async (req, res, next) => {
  try {
    const organizationId = await resolveCompany(req);
    if (!organizationId) {
      return res.status(403).json({ error: 'Solo cuentas empresa pueden acceder al talent pool' });
    }
    const db = getDb();
    await companySubscription.loadActiveCompanyOrThrow(db, organizationId);
    const candidates = await companyCandidates.listForOrganization(db, organizationId);
    res.json({ candidates, total: candidates.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/companies/talent-pool/match?offerId=... - Re-puntúa el talent pool
// guardado contra una oferta, sin re-subir CVs. Reutiliza los datos parseados
// (skills/puesto/zona/ciudad/ubicación) ya almacenados.
router.get('/talent-pool/match', authMiddleware, async (req, res, next) => {
  try {
    const organizationId = await resolveCompany(req);
    if (!organizationId) {
      return res.status(403).json({ error: 'Solo cuentas empresa pueden acceder al talent pool' });
    }
    const { offerId } = req.query;
    if (!offerId) {
      return res.status(400).json({ error: 'offerId es requerido' });
    }
    const db = getDb();
    await companySubscription.loadActiveCompanyOrThrow(db, organizationId);
    await citiesService.ensureLoaded();

    const offerDoc = await db.collection('jobOffers').doc(offerId).get();
    if (!offerDoc.exists) {
      return res.status(404).json({ error: 'Oferta no encontrada' });
    }
    const offer = offerDoc.data();
    // La oferta debe pertenecer a la organización (mismo uid que employerId).
    if (offer.employerId !== organizationId) {
      return res.status(403).json({ error: 'La oferta no pertenece a tu empresa' });
    }

    const pool = await companyCandidates.listForOrganization(db, organizationId);

    const scored = pool.map(entry => {
      const candidate = entry.candidate || {};
      const relevance = matchingService.calculateRelevanceScore(candidate, offer);
      return {
        id: entry.id,
        candidate,
        fileUrl: entry.fileUrl || null,
        sourceOfferIds: entry.sourceOfferIds || [],
        lastAssessment: entry.lastAssessment || null,
        relevance,
      };
    });

    scored.sort((a, b) => (b.relevance.score || 0) - (a.relevance.score || 0));

    res.json({ offerId, candidates: scored, total: scored.length });
  } catch (error) {
    next(error);
  }
});

// ----- Equipo de la empresa (gestión por el dueño) -----

// GET /api/companies/members - Lista el equipo (cualquier miembro puede verlo)
router.get('/members', authMiddleware, async (req, res, next) => {
  try {
    const organizationId = await resolveCompany(req);
    if (!organizationId) {
      return res.status(403).json({ error: 'Solo cuentas empresa pueden acceder a este recurso' });
    }
    const members = await companyMembers.listMembers(getDb(), getAuth(), organizationId);
    res.json({ members, total: members.length });
  } catch (error) {
    next(error);
  }
});

// POST /api/companies/members - Invitar un miembro (solo el dueño)
router.post('/members', authMiddleware, async (req, res, next) => {
  try {
    const organizationId = await resolveCompanyOwner(req);
    if (!organizationId) {
      return res.status(403).json({ error: 'Solo la cuenta dueña puede gestionar el equipo' });
    }
    const { email, firstName, lastName } = req.body;
    const member = await companyMembers.inviteMember(getDb(), getAuth(), {
      organizationId,
      email,
      firstName,
      lastName,
      invitedBy: req.user.uid,
    });
    res.status(201).json({ success: true, message: 'Invitación enviada', member });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// DELETE /api/companies/members/:memberUid - Quitar un miembro (solo el dueño)
router.delete('/members/:memberUid', authMiddleware, async (req, res, next) => {
  try {
    const organizationId = await resolveCompanyOwner(req);
    if (!organizationId) {
      return res.status(403).json({ error: 'Solo la cuenta dueña puede gestionar el equipo' });
    }
    await companyMembers.removeMember(getDb(), getAuth(), {
      organizationId,
      memberUid: req.params.memberUid,
    });
    res.json({ success: true, message: 'Miembro eliminado' });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

module.exports = router;
