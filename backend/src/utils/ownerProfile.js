// El dueño de una oferta puede ser un employer individual o una empresa, y cada
// uno guarda su perfil en una colección distinta bajo el mismo uid. Buscar sólo
// en `employers` deja a las empresas sin nombre: las notificaciones les salían
// como "Empresa" genérico.

/** Perfil del dueño (employers, con fallback a companies). null si no existe. */
async function loadOwnerProfile(db, ownerUid) {
  if (!ownerUid) return null;
  const employer = await db.collection('employers').doc(ownerUid).get();
  if (employer.exists) return employer.data();
  const company = await db.collection('companies').doc(ownerUid).get();
  return company.exists ? company.data() : null;
}

/** Nombre para mostrarle al worker. */
function ownerDisplayName(profile, fallback = 'Empresa') {
  return profile?.businessName || profile?.contactName || fallback;
}

module.exports = { loadOwnerProfile, ownerDisplayName };
