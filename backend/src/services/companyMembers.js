// Gestión del equipo de una cuenta empresa (multi-miembro).
//
// Un miembro es un usuario Firebase Auth propio (su login) con role:'company' y
// organizationId = uid de la empresa madre. El DUEÑO es el usuario donde
// uid === organizationId. Los miembros NO tienen doc en `companies` (el perfil
// de empresa es uno solo, el del dueño); comparten ofertas/talent pool vía el
// actingUid resuelto a organizationId (ver utils/actingContext.js).

const { sendInvitationEmail } = require('./emailService');

// Lista los miembros de una organización (dueño + invitados), con su email.
async function listMembers(db, auth, organizationId) {
  const snap = await db.collection('users')
    .where('organizationId', '==', organizationId)
    .where('role', '==', 'company')
    .get();

  const members = await Promise.all(snap.docs.map(async (doc) => {
    const data = doc.data();
    let email = data.email || null;
    try {
      const rec = await auth.getUser(doc.id);
      email = rec.email || email;
    } catch (e) {
      // El usuario podría no existir en Auth; usamos el de Firestore si hay.
    }
    return {
      uid: doc.id,
      email,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      isOwner: doc.id === organizationId,
      createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
    };
  }));

  // Dueño primero, luego por fecha de alta.
  members.sort((a, b) => {
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db_ = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return da - db_;
  });
  return members;
}

// Invita a un nuevo miembro a la organización (crea login + email de invitación).
// Lanza errores con .status para que las rutas respondan el código correcto.
async function inviteMember(db, auth, { organizationId, email, firstName, lastName, invitedBy }) {
  if (!email) {
    const err = new Error('Email es requerido');
    err.status = 400;
    throw err;
  }

  // Enforce el límite de miembros de la empresa (incluye al dueño).
  // maxMembers null/undefined → sin límite.
  const companyDoc = await db.collection('companies').doc(organizationId).get();
  const maxMembers = companyDoc.exists ? companyDoc.data().maxMembers : null;
  if (maxMembers != null) {
    const current = await db.collection('users')
      .where('organizationId', '==', organizationId)
      .where('role', '==', 'company')
      .get();
    if (current.size >= maxMembers) {
      const err = new Error(`La empresa alcanzó el límite de ${maxMembers} cuentas. Pedí al admin que lo amplíe.`);
      err.status = 403;
      throw err;
    }
  }

  // Evitar duplicados en Auth.
  try {
    await auth.getUserByEmail(email);
    const err = new Error('Ya existe un usuario con ese email');
    err.status = 400;
    throw err;
  } catch (e) {
    if (e.status) throw e;
    if (e.code !== 'auth/user-not-found') throw e;
  }

  const userRecord = await auth.createUser({
    email,
    emailVerified: true,
    displayName: firstName && lastName ? `${firstName} ${lastName}` : undefined,
  });

  await db.collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    role: 'company',
    organizationId,
    firstName: firstName || null,
    lastName: lastName || null,
    onboardingCompleted: true,
    invitedBy: invitedBy || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const resetLink = await auth.generatePasswordResetLink(email);
  await sendInvitationEmail({ to: email, firstName, resetLink });

  return { uid: userRecord.uid, email, firstName: firstName || null, lastName: lastName || null };
}

// Quita un miembro de la organización (borra su login). No permite borrar al dueño.
async function removeMember(db, auth, { organizationId, memberUid }) {
  if (memberUid === organizationId) {
    const err = new Error('No se puede eliminar la cuenta dueña de la empresa');
    err.status = 400;
    throw err;
  }

  const memberRef = db.collection('users').doc(memberUid);
  const memberDoc = await memberRef.get();
  if (!memberDoc.exists) {
    const err = new Error('Miembro no encontrado');
    err.status = 404;
    throw err;
  }
  const data = memberDoc.data();
  if (data.role !== 'company' || data.organizationId !== organizationId) {
    const err = new Error('El miembro no pertenece a esta empresa');
    err.status = 403;
    throw err;
  }

  await memberRef.delete();
  try {
    await auth.deleteUser(memberUid);
  } catch (e) {
    // Best-effort: si ya no existe en Auth, seguimos.
  }

  return { uid: memberUid };
}

module.exports = { listMembers, inviteMember, removeMember };
