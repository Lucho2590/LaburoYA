const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const { resolveActingContext, isEmployerLike } = require('../utils/actingContext');
const profileBlocks = require('../services/profileBlocks');
const { normEmail, normPhone } = require('../services/companyCandidates');

// Lista de motivos (para el select del front).
router.get('/reasons', authMiddleware, (req, res) => {
  res.json({ reasons: profileBlocks.REASONS });
});

// Bloquear un perfil (desde un match/interesado o desde un CV analizado).
// Body: { source, workerUid?, email?, phone?, candidateName?, offerId?, reason, note? }
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { actingUid, effectiveRole } = await resolveActingContext(req);
    if (!isEmployerLike(effectiveRole)) {
      return res.status(403).json({ error: 'Solo empleadores o empresas pueden bloquear perfiles' });
    }

    const { source, workerUid, email, phone, candidateName, offerId, reason, note } = req.body || {};
    if (!reason || !profileBlocks.REASON_KEYS.includes(reason)) {
      return res.status(400).json({ error: 'Motivo inválido' });
    }
    if (!workerUid && !email && !phone) {
      return res.status(400).json({ error: 'Falta identificar el perfil (workerUid o email/teléfono)' });
    }

    const db = getDb();
    const orgId = actingUid;

    const result = await profileBlocks.blockProfile(db, {
      orgId,
      blockedByUid: req.user.uid,
      source: source || (workerUid ? 'match' : 'cv'),
      workerUid: workerUid || null,
      email: email || null,
      phone: phone || null,
      candidateName: candidateName || null,
      offerId: offerId || null,
      reason,
      note: note || null,
    });

    // Efecto (a): worker con uid → marcar sus matches con este org como rechazados.
    if (workerUid) {
      const ms = await db.collection('matches')
        .where('employerId', '==', orgId)
        .where('workerId', '==', workerUid)
        .get();
      await Promise.all(ms.docs.map((d) =>
        d.ref.update({ status: 'rejected', blocked: true, updatedAt: new Date() })
      ));
    }

    // Efecto (b): candidato de CV → quitar del ranking (pinnedCandidates) y del
    // talent pool (companyCandidates) del org, matcheando por email/teléfono.
    const emailNorm = normEmail(email);
    const phoneNorm = normPhone(phone);
    if (emailNorm || phoneNorm) {
      const pins = await db.collection('pinnedCandidates').where('employerId', '==', orgId).get();
      await Promise.all(pins.docs
        .filter((d) => {
          const c = d.data().candidate || {};
          const e = normEmail(c.email);
          const p = normPhone(c.phone);
          return (emailNorm && e === emailNorm) || (phoneNorm && p === phoneNorm);
        })
        .map((d) => d.ref.delete()));

      const tp = await db.collection('companyCandidates').where('organizationId', '==', orgId).get();
      await Promise.all(tp.docs
        .filter((d) => {
          const b = d.data();
          return (emailNorm && b.emailNorm === emailNorm) || (phoneNorm && b.phoneNorm === phoneNorm);
        })
        .map((d) => d.ref.delete()));
    }

    res.json({ ok: true, id: result.id });
  } catch (error) {
    next(error);
  }
});

// Desbloquear: solo el org dueño del bloqueo o un superuser.
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { actingUid, effectiveRole } = await resolveActingContext(req);
    const db = getDb();
    const doc = await db.collection(profileBlocks.COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Bloqueo no encontrado' });
    const isOwner = doc.data().orgId === actingUid;
    if (!isOwner && effectiveRole !== 'superuser') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    await profileBlocks.unblockProfile(db, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
