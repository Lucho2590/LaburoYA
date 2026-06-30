// Ciclo de vida del talent pool al cumplir 6 meses.
//
// Cuando un CV cargado por una empresa cumple RETENTION_DAYS, en vez de borrarlo:
//  - Si NO tiene email detectable → se descarta (se borra doc + archivo).
//  - Si tiene email y la persona YA es usuario de LaburoYa → se descarta del pool
//    (ya está en la plataforma).
//  - Si tiene email y no es usuario → se migra a `talentProspects` (perfil de
//    worker PENDIENTE, inactivo, sin cuenta) y se le manda un mail para validar.
// Al validar (claim), recién ahí se crea el worker ACTIVO y entra al matching.

const crypto = require('crypto');
const companyCandidates = require('./companyCandidates');
const cvStorage = require('./cvStorage');
const locationService = require('./locationService');
const { sendNotificationEmail } = require('./emailService');

const PROSPECTS = 'talentProspects';

function appUrl() {
  return process.env.APP_URL || process.env.FRONTEND_URL || null;
}

// Procesa los CVs vencidos (>6 meses). Idempotente. Devuelve un resumen.
async function processExpiredTalentPool(db, auth) {
  const cutoff = new Date(Date.now() - companyCandidates.RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const snap = await db.collection(companyCandidates.COLLECTION)
    .where('createdAt', '<', cutoff)
    .get();

  const summary = { processed: 0, migrated: 0, discarded: 0, alreadyUsers: 0, errors: 0 };

  for (const doc of snap.docs) {
    summary.processed++;
    try {
      const data = doc.data();
      const candidate = data.candidate || {};
      const email = candidate.email ? String(candidate.email).trim() : null;

      // a) Sin email → descartar (borrar archivo + doc).
      if (!email) {
        await cvStorage.deleteCv(data.filePath);
        await doc.ref.delete();
        summary.discarded++;
        continue;
      }

      // b) ¿Ya es usuario de LaburoYa? → no migrar, solo sacar del pool.
      try {
        await auth.getUserByEmail(email);
        await doc.ref.delete();
        summary.alreadyUsers++;
        continue;
      } catch (e) {
        if (e.code !== 'auth/user-not-found') throw e;
      }

      const emailNorm = companyCandidates.normEmail(email);

      // c) ¿Ya existe un prospecto para este email? → no duplicar ni re-mailear.
      const existing = await db.collection(PROSPECTS)
        .where('emailNorm', '==', emailNorm)
        .limit(1)
        .get();
      if (!existing.empty) {
        await doc.ref.delete();
        summary.migrated++;
        continue;
      }

      // d) Crear prospecto pendiente + enviar mail de validación.
      const claimToken = crypto.randomUUID();
      const base = appUrl();
      let notifiedAt = null;
      if (base) {
        try {
          await sendNotificationEmail({
            to: email,
            subject: 'Validá tu perfil en LaburoYA',
            heading: '¡Tu perfil puede seguir activo en LaburoYA!',
            message: 'Una empresa cargó tu CV en LaburoYA. Si querés, validá tu perfil para que te lleguen ofertas que coincidan con vos. Es gratis y lo controlás vos.',
            ctaText: 'Validar mi perfil',
            ctaLink: `${base}/validar-perfil/${claimToken}`,
          });
          notifiedAt = new Date();
        } catch (e) {
          console.error('[talentProspects] no se pudo enviar el mail de validación:', e.message);
        }
      } else {
        console.warn('[talentProspects] APP_URL/FRONTEND_URL no configurado: no se envía el mail de validación');
      }

      await db.collection(PROSPECTS).add({
        emailNorm,
        phoneNorm: companyCandidates.normPhone(candidate.phone),
        claimToken,
        status: 'pending',
        candidate,
        fileUrl: data.fileUrl || null,
        filePath: data.filePath || null,
        sourceOrganizationId: data.organizationId || null,
        notifiedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await doc.ref.delete();
      summary.migrated++;
    } catch (e) {
      summary.errors++;
      console.error('[talentProspects] error procesando candidato vencido:', e.message);
    }
  }

  if (summary.processed > 0) {
    console.log('[talentProspects] vencidos procesados:', JSON.stringify(summary));
  }
  return summary;
}

// Preview público del prospecto por token (para la página de validación).
async function getByToken(db, token) {
  const snap = await db.collection(PROSPECTS).where('claimToken', '==', token).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const d = doc.data();
  const c = d.candidate || {};
  return {
    id: doc.id,
    status: d.status,
    firstName: c.firstName || null,
    lastName: c.lastName || null,
    email: c.email || null,
    puesto: c.puesto || null,
    skills: Array.isArray(c.skills) ? c.skills : [],
  };
}

// Reclama el prospecto: crea (o vincula) la cuenta worker y la activa.
async function claim(db, auth, token, { password }) {
  const snap = await db.collection(PROSPECTS).where('claimToken', '==', token).limit(1).get();
  if (snap.empty) {
    const err = new Error('Link inválido o vencido'); err.status = 404; throw err;
  }
  const doc = snap.docs[0];
  const data = doc.data();
  if (data.status === 'claimed') {
    const err = new Error('Este perfil ya fue validado. Iniciá sesión.'); err.status = 409; throw err;
  }

  const candidate = data.candidate || {};
  const email = candidate.email ? String(candidate.email).trim() : null;
  if (!email) {
    const err = new Error('El perfil no tiene un email asociado'); err.status = 400; throw err;
  }

  // ¿Ya existe la cuenta? (alguien que se registró por otro lado)
  let uid = null;
  let alreadyHadAccount = false;
  try {
    const rec = await auth.getUserByEmail(email);
    uid = rec.uid;
    alreadyHadAccount = true;
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }

  if (!alreadyHadAccount) {
    if (!password || String(password).length < 6) {
      const err = new Error('La contraseña debe tener al menos 6 caracteres'); err.status = 400; throw err;
    }
    const displayName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || undefined;
    const rec = await auth.createUser({ email, password, emailVerified: true, displayName });
    uid = rec.uid;
    await db.collection('users').doc(uid).set({
      uid,
      role: 'worker',
      firstName: candidate.firstName || null,
      lastName: candidate.lastName || null,
      phone: candidate.phone || null,
      onboardingCompleted: true,
      claimedFromTalentPool: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });
  }

  // Crear/activar el perfil de worker desde los datos del CV.
  const canonicalZona = candidate.zona || null;
  let location = candidate.location || null;
  let city = candidate.city || null;
  if (!location) {
    try {
      const enriched = await locationService.enrichLocation({ city, zona: canonicalZona });
      location = enriched.location ? { ...enriched.location, updatedAt: new Date() } : null;
      city = enriched.city || city;
    } catch (e) { /* best-effort */ }
  }

  await db.collection('workers').doc(uid).set({
    uid,
    rubro: candidate.rubro || null,
    puesto: candidate.puesto || null,
    zona: canonicalZona,
    city: city || null,
    location: location || null,
    description: candidate.description || null,
    experience: candidate.experience || null,
    skills: Array.isArray(candidate.skills) ? candidate.skills : [],
    cvUrl: data.fileUrl || null,
    photoUrl: null,
    videoUrl: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }, { merge: true });

  await doc.ref.update({ status: 'claimed', claimedUid: uid, updatedAt: new Date() });

  return { uid, email, alreadyHadAccount };
}

module.exports = { processExpiredTalentPool, getByToken, claim };
