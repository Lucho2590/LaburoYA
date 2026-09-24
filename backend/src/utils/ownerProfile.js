// El dueño de una oferta puede ser un employer individual o una empresa, y cada
// uno guarda su perfil en una colección distinta bajo el mismo uid. Buscar sólo
// en `employers` deja a las empresas sin nombre: las notificaciones les salían
// como "Empresa" genérico.

const { getDocMapByIds } = require('./firestore');

/** Perfil del dueño (employers, con fallback a companies). null si no existe. */
async function loadOwnerProfile(db, ownerUid) {
  if (!ownerUid) return null;
  const employer = await db.collection('employers').doc(ownerUid).get();
  if (employer.exists) return employer.data();
  const company = await db.collection('companies').doc(ownerUid).get();
  return company.exists ? company.data() : null;
}

/**
 * Igual que loadOwnerProfile pero para muchos uids: Map uid -> perfil, sólo con
 * los que existen. Dos round-trips como máximo (db.getAll por colección) en vez
 * de uno o dos gets por uid.
 */
async function loadOwnerProfilesByIds(db, ownerUids) {
  const ids = Array.from(new Set((ownerUids || []).filter(Boolean)));
  const profiles = await getDocMapByIds(db, 'employers', ids);
  const missing = ids.filter((id) => !profiles.has(id));
  if (missing.length > 0) {
    const companies = await getDocMapByIds(db, 'companies', missing);
    companies.forEach((data, id) => profiles.set(id, data));
  }
  return profiles;
}

/** Nombre para mostrarle al worker. */
function ownerDisplayName(profile, fallback = 'Empresa') {
  return profile?.businessName || profile?.contactName || fallback;
}

module.exports = { loadOwnerProfile, loadOwnerProfilesByIds, ownerDisplayName };
