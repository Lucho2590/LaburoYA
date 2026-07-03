// Bloqueo de perfiles por parte de un empleador/empresa (colección `profileBlocks`).
//
// Un empleador puede bloquear un perfil desde un match/interesado (identidad por
// `workerUid`, usuario registrado) o desde un CV analizado (identidad por
// `emailNorm`/`phoneNorm`, sin uid). El bloqueo aplica a nivel ORGANIZACIÓN
// (todas las ofertas del empleador/empresa) y sirve para:
//   - ocultar el perfil de futuros matches/listas de ese empleador,
//   - llevar un registro de rechazos por perfil (reputación en /sudo/users/[id]).
//
// `orgId` = actingUid (para empresas ya es el organizationId; para employer, su uid).

const { normEmail, normPhone } = require('./companyCandidates');

const COLLECTION = 'profileBlocks';

// Motivos predefinidos (fuente de verdad; el front tiene un espejo para el select).
const REASONS = [
  { key: 'no_cumple_requisitos', label: 'No cumple los requisitos' },
  { key: 'mala_experiencia', label: 'Mala experiencia previa' },
  { key: 'no_se_presento', label: 'No se presentó / no respondió' },
  { key: 'datos_falsos', label: 'Datos falsos o perfil sospechoso' },
  { key: 'otro', label: 'Otro' },
];
const REASON_KEYS = REASONS.map((r) => r.key);
const reasonLabel = (key) => (REASONS.find((r) => r.key === key)?.label) || key;

// Busca un bloqueo activo existente del org para dedupe (por uid o email o phone).
async function findExistingBlock(db, orgId, { workerUid, emailNorm, phoneNorm }) {
  const col = db.collection(COLLECTION);
  if (workerUid) {
    const s = await col.where('orgId', '==', orgId).where('workerUid', '==', workerUid).limit(1).get();
    if (!s.empty) return s.docs[0];
  }
  if (emailNorm) {
    const s = await col.where('orgId', '==', orgId).where('emailNorm', '==', emailNorm).limit(1).get();
    if (!s.empty) return s.docs[0];
  }
  if (phoneNorm) {
    const s = await col.where('orgId', '==', orgId).where('phoneNorm', '==', phoneNorm).limit(1).get();
    if (!s.empty) return s.docs[0];
  }
  return null;
}

// Crea (o actualiza si ya existe) el bloqueo del perfil para ese org.
async function blockProfile(db, {
  orgId, blockedByUid = null, source = null, workerUid = null,
  email = null, phone = null, candidateName = null, offerId = null, reason, note = null,
}) {
  const emailNorm = normEmail(email);
  const phoneNorm = normPhone(phone);
  const existing = await findExistingBlock(db, orgId, { workerUid, emailNorm, phoneNorm });

  if (existing) {
    const prev = existing.data();
    await existing.ref.update({
      // Completar identificadores que falten y refrescar motivo/nota.
      workerUid: workerUid || prev.workerUid || null,
      emailNorm: emailNorm || prev.emailNorm || null,
      phoneNorm: phoneNorm || prev.phoneNorm || null,
      candidateName: candidateName || prev.candidateName || null,
      offerId: offerId || prev.offerId || null,
      source: source || prev.source || null,
      reason,
      note: note || null,
      updatedAt: new Date(),
    });
    return { id: existing.id, created: false };
  }

  const ref = await db.collection(COLLECTION).add({
    orgId,
    blockedByUid,
    source,
    workerUid: workerUid || null,
    emailNorm: emailNorm || null,
    phoneNorm: phoneNorm || null,
    candidateName: candidateName || null,
    offerId: offerId || null,
    reason,
    note: note || null,
    createdAt: new Date(),
  });
  return { id: ref.id, created: true };
}

async function unblockProfile(db, id) {
  await db.collection(COLLECTION).doc(id).delete();
}

// Sets de identificadores bloqueados por un org, para filtrar listas.
async function listBlockedKeysForOrg(db, orgId) {
  const snap = await db.collection(COLLECTION).where('orgId', '==', orgId).get();
  const uids = new Set();
  const emails = new Set();
  const phones = new Set();
  snap.docs.forEach((d) => {
    const b = d.data();
    if (b.workerUid) uids.add(b.workerUid);
    if (b.emailNorm) emails.add(b.emailNorm);
    if (b.phoneNorm) phones.add(b.phoneNorm);
  });
  return { uids, emails, phones };
}

async function isWorkerBlocked(db, orgId, workerUid) {
  if (!orgId || !workerUid) return false;
  const s = await db.collection(COLLECTION)
    .where('orgId', '==', orgId).where('workerUid', '==', workerUid).limit(1).get();
  return !s.empty;
}

// Bloqueos que aplican a un usuario (para reputación en admin): matchea por uid
// O email O teléfono (Firestore no hace OR entre campos → 3 queries + merge).
async function getBlocksForUser(db, { uid = null, emailNorm = null, phoneNorm = null }) {
  const col = db.collection(COLLECTION);
  const queries = [];
  if (uid) queries.push(col.where('workerUid', '==', uid).get());
  if (emailNorm) queries.push(col.where('emailNorm', '==', emailNorm).get());
  if (phoneNorm) queries.push(col.where('phoneNorm', '==', phoneNorm).get());
  if (queries.length === 0) return { count: 0, blocks: [] };

  const snaps = await Promise.all(queries);
  const byId = new Map();
  snaps.forEach((s) => s.docs.forEach((d) => {
    if (byId.has(d.id)) return;
    const b = d.data();
    byId.set(d.id, {
      id: d.id,
      reason: b.reason,
      reasonLabel: reasonLabel(b.reason),
      note: b.note || null,
      source: b.source || null,
      orgId: b.orgId || null,
      offerId: b.offerId || null,
      createdAt: b.createdAt?.toDate?.() || b.createdAt || null,
    });
  }));

  const blocks = Array.from(byId.values()).sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dbb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dbb - da;
  });
  return { count: blocks.length, blocks };
}

module.exports = {
  COLLECTION,
  REASONS,
  REASON_KEYS,
  reasonLabel,
  blockProfile,
  unblockProfile,
  listBlockedKeysForOrg,
  isWorkerBlocked,
  getBlocksForUser,
  findExistingBlock,
};
