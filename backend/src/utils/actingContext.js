const { getDb } = require('../config/firebase');

// Resuelve el "contexto efectivo" de una request para endpoints de negocio.
//
// La cuenta empresa es un único usuario (un uid) que actúa con su propio uid,
// igual que un employer. El único caso especial es el superuser:
//  - Si está impersonando una empresa (impersonatingCompanyId), actúa COMO esa
//    empresa: el uid efectivo es el de la empresa (gana sobre secondaryRole).
//  - Si tiene secondaryRole, actúa como worker/employer con su propio uid (legacy).
//  - Si no, actúa como superuser.
//
// Devuelve { actingUid, effectiveRole, isImpersonating, userData }.
// actingUid es el uid que los endpoints deben usar como dueño (employerId, etc.).
async function resolveActingContext(req) {
  const db = getDb();
  const uid = req.user.uid;
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.exists ? userDoc.data() : null;

  if (userData && userData.role === 'superuser') {
    if (userData.impersonatingCompanyId) {
      return {
        actingUid: userData.impersonatingCompanyId,
        effectiveRole: 'company',
        isImpersonating: true,
        userData,
      };
    }
    if (userData.secondaryRole) {
      return {
        actingUid: uid,
        effectiveRole: userData.secondaryRole,
        isImpersonating: false,
        userData,
      };
    }
    return { actingUid: uid, effectiveRole: 'superuser', isImpersonating: false, userData };
  }

  // Cuenta empresa (dueño o miembro): actúa SIEMPRE sobre el uid de la
  // organización, así dueño y miembros comparten ofertas/talent pool/dashboard.
  // Para el dueño organizationId === su uid (no cambia nada).
  if (userData && userData.role === 'company') {
    return {
      actingUid: userData.organizationId || uid,
      effectiveRole: 'company',
      isImpersonating: false,
      userData,
    };
  }

  return {
    actingUid: uid,
    effectiveRole: userData ? userData.role : null,
    isImpersonating: false,
    userData,
  };
}

// True si el rol efectivo es dueño de ofertas/flujo de CV (employer o company).
function isEmployerLike(effectiveRole) {
  return effectiveRole === 'employer' || effectiveRole === 'company';
}

module.exports = { resolveActingContext, isEmployerLike };
