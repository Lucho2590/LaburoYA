// Talent pool de la empresa (colección `companyCandidates`).
//
// Cada vez que una empresa analiza un CV en una oferta, además de guardarlo en
// el ranking de esa oferta (pinnedCandidates), lo persistimos a nivel
// ORGANIZACIÓN acá para reutilizarlo en futuras búsquedas sin re-subir el CV.
//
// Dedup por persona dentro de la organización:
//   1) organizationId + fileHash (mismo archivo)
//   2) organizationId + (emailNorm || phoneNorm) (misma persona, otro archivo)

const COLLECTION = 'companyCandidates';

// El talent pool no debe durar más de 6 meses: los CVs guardados hace más de
// RETENTION_DAYS dejan de aparecer y se borran de forma lazy.
const RETENTION_DAYS = 180;

function normEmail(email) {
  return email ? String(email).trim().toLowerCase() : null;
}

function normPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits || null;
}

// Busca un candidato existente del talent pool por archivo o por persona.
async function findExisting(db, organizationId, { fileHash, emailNorm, phoneNorm }) {
  if (fileHash) {
    const byFile = await db.collection(COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('fileHash', '==', fileHash)
      .limit(1)
      .get();
    if (!byFile.empty) return byFile.docs[0];
  }
  if (emailNorm) {
    const byEmail = await db.collection(COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('emailNorm', '==', emailNorm)
      .limit(1)
      .get();
    if (!byEmail.empty) return byEmail.docs[0];
  }
  if (phoneNorm) {
    const byPhone = await db.collection(COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('phoneNorm', '==', phoneNorm)
      .limit(1)
      .get();
    if (!byPhone.empty) return byPhone.docs[0];
  }
  return null;
}

// Upsert del candidato analizado en el talent pool de la organización.
// `candidate` y `assessment` provienen del doc ya normalizado de pinnedCandidates.
async function upsertFromAssessment({ db, organizationId, offerId, fileHash, candidate, assessment }) {
  if (!organizationId) return null;
  const emailNorm = normEmail(candidate?.email);
  const phoneNorm = normPhone(candidate?.phone);

  const lastAssessment = {
    score: Number(assessment?.score) || 0,
    stars: Number(assessment?.stars) || 0,
    recommendation: assessment?.recommendation || null,
    summary: assessment?.summary || null,
    strengths: Array.isArray(assessment?.strengths) ? assessment.strengths : [],
    gaps: Array.isArray(assessment?.gaps) ? assessment.gaps : [],
    matchingSkills: Array.isArray(assessment?.matchingSkills) ? assessment.matchingSkills : [],
    missingSkills: Array.isArray(assessment?.missingSkills) ? assessment.missingSkills : [],
    mode: assessment?.mode || null,
    offerId: offerId || null,
    assessedAt: new Date(),
  };

  const existing = await findExisting(db, organizationId, { fileHash, emailNorm, phoneNorm });

  if (existing) {
    const prev = existing.data();
    const sourceOfferIds = Array.isArray(prev.sourceOfferIds) ? prev.sourceOfferIds.slice() : [];
    if (offerId && !sourceOfferIds.includes(offerId)) sourceOfferIds.push(offerId);
    await existing.ref.update({
      // Refrescamos datos del candidato (pueden venir más completos esta vez).
      candidate: { ...prev.candidate, ...candidate },
      emailNorm: emailNorm || prev.emailNorm || null,
      phoneNorm: phoneNorm || prev.phoneNorm || null,
      lastAssessment,
      sourceOfferIds,
      updatedAt: new Date(),
    });
    return { id: existing.id, created: false };
  }

  const ref = await db.collection(COLLECTION).add({
    organizationId,
    fileHash: fileHash || null,
    emailNorm,
    phoneNorm,
    fileUrl: null, // PLACEHOLDER: subir a Storage si el bucket está configurado.
    candidate: candidate || {},
    lastAssessment,
    sourceOfferIds: offerId ? [offerId] : [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { id: ref.id, created: true };
}

// Lista el talent pool vigente de una organización (excluye los > 6 meses).
async function listForOrganization(db, organizationId) {
  const snap = await db.collection(COLLECTION)
    .where('organizationId', '==', organizationId)
    .get();

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const expiredRefs = [];

  const items = snap.docs
    .map(d => {
      const data = d.data();
      const createdAt = data.createdAt?.toDate?.() || data.createdAt;
      return {
        ref: d.ref,
        createdMs: createdAt ? new Date(createdAt).getTime() : 0,
        value: {
          id: d.id,
          ...data,
          createdAt,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        },
      };
    })
    .filter(it => {
      // Vencidos (más de 6 meses desde que se guardaron): excluir + borrar lazy.
      if (it.createdMs && it.createdMs < cutoff) {
        expiredRefs.push(it.ref);
        return false;
      }
      return true;
    });

  // Borrado lazy best-effort de los vencidos (no bloquea la respuesta).
  if (expiredRefs.length > 0) {
    const batch = db.batch();
    expiredRefs.forEach(ref => batch.delete(ref));
    batch.commit().catch(() => {});
  }

  return items
    .map(it => it.value)
    .sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db_ = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db_ - da;
    });
}

module.exports = { upsertFromAssessment, listForOrganization, normEmail, normPhone };
