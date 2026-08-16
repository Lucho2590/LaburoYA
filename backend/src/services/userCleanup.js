// Borrado en cascada de todo lo que cuelga de un usuario.
//
// Antes esta lógica estaba copiada en cuatro lugares (el hard delete de
// admin.js, deleteWorkerAndRefs, deleteOfferAndRefs y los scripts delete-*.js)
// y ninguna copia era completa: el hard delete dejaba colgando matches, chats,
// solicitudes y notificaciones, y NADIE borraba los chats, sus mensajes ni los
// archivos de Storage. De ahí salieron los datos huérfanos que había que
// limpiar a mano.
//
// Lo que a propósito NO se borra está documentado abajo, en KEEP.

const FIRESTORE_BATCH_LIMIT = 500;

// Colecciones que referencian al usuario por un campo. [colección, campo].
// Un mismo uid puede aparecer en varios campos de la misma colección.
const USER_REF_FIELDS = [
  ['jobOffers', 'employerId'],
  ['matches', 'workerId'],
  ['matches', 'employerId'],
  ['contactRequests', 'fromUid'],
  ['contactRequests', 'toUid'],
  ['chats', 'workerId'],
  ['chats', 'employerId'],
  ['notifications', 'userId'],
  ['offerInteractions', 'userId'],
  ['pinnedCandidates', 'employerId'],
  ['fcmTokens', 'userId'],
  // Sólo los bloqueos HECHOS por este empleador/empresa. Los bloqueos por
  // email/teléfono contra este uid se conservan: ver KEEP.
  ['profileBlocks', 'orgId'],
];

// Colecciones donde el ID del documento ES el uid.
const USER_ID_COLLECTIONS = ['workers', 'employers', 'companies', 'emailSendCooldowns'];

// Subconjunto usable para DESCUBRIR uids muertos. emailSendCooldowns queda
// afuera: es data efímera y sus docs pueden tener id `pwd:{email}`, que no es
// un uid y se reportaría como usuario inexistente.
const USER_ID_DISCOVERY_COLLECTIONS = ['workers', 'employers', 'companies'];

// Prefijos de Storage que pertenecen al usuario. `talent-pool/` NO entra: los
// CVs migrados a talentProspects conservan el path bajo el prefijo de la
// empresa original y son la fuente del cvUrl de workers ya validados, así que
// borrar ese prefijo les rompería el CV.
const USER_STORAGE_PREFIXES = ['photos/', 'videos/'];

/**
 * Lo que se deja intacto a propósito:
 * - profileBlocks por emailNorm/phoneNorm: es reputación. Si se borran, alguien
 *   que se re-registra vuelve a aparecerle a empleadores que ya lo rechazaron.
 * - talentProspects: el prospecto es de la persona, no de la empresa que subió
 *   el CV; borrarlo rompe un link de validación ya enviado por mail.
 * - cvChecks: el límite de un análisis por email es antifraude ligado al email,
 *   no a la cuenta. Tiene su propio reset en el panel.
 * - leads, aiErrors, cities, rubros, plans, companyPlans, geocodeCache y los
 *   updatedBy de appConfig/settings: catálogos, métricas y auditoría.
 */
const KEEP = ['profileBlocks(email/phone)', 'talentProspects', 'cvChecks', 'leads', 'aiErrors'];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Borra refs en lotes de 500: el límite de un batch de Firestore. El código
// anterior usaba un solo batch por colección, que se rompe en silencio al
// crecer (pinnedCandidates ya está en ~100 docs).
async function deleteRefs(db, refs) {
  for (const group of chunk(refs, FIRESTORE_BATCH_LIMIT)) {
    const batch = db.batch();
    group.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return refs.length;
}

/** Todos los uids que existen hoy, por cualquiera de las dos vías. */
async function loadLiveUids(db, auth) {
  const users = new Set((await db.collection('users').get()).docs.map((d) => d.id));
  const authUids = new Set();
  let page = await auth.listUsers(1000);
  page.users.forEach((u) => authUids.add(u.uid));
  while (page.pageToken) {
    page = await auth.listUsers(1000, page.pageToken);
    page.users.forEach((u) => authUids.add(u.uid));
  }
  return { users, authUids, isLive: (uid) => users.has(uid) || authUids.has(uid) };
}

/**
 * Uids referenciados en la base que ya no existen ni en `users` ni en Auth.
 * Devuelve un Map uid -> Set(dónde aparece).
 */
async function findDeadUids(db, isLive, { bucket = null } = {}) {
  const dead = new Map();
  const note = (uid, where) => {
    if (!uid || isLive(uid)) return;
    if (!dead.has(uid)) dead.set(uid, new Set());
    dead.get(uid).add(where);
  };

  for (const [collection, field] of USER_REF_FIELDS) {
    const snap = await db.collection(collection).get();
    snap.docs.forEach((d) => note(d.data()[field], collection));
  }
  for (const collection of USER_ID_DISCOVERY_COLLECTIONS) {
    const snap = await db.collection(collection).get();
    snap.docs.forEach((d) => note(d.id, collection));
  }

  // Storage también: hay usuarios que no dejaron ningún rastro en Firestore
  // pero sí sus fotos y videos. Buscando sólo en las colecciones, esos archivos
  // quedaban afuera de la limpieza para siempre.
  if (bucket) {
    try {
      for (const prefix of USER_STORAGE_PREFIXES) {
        const [files] = await bucket.getFiles({ prefix });
        files.forEach((f) => {
          const uid = f.name.split('/')[1];
          if (uid) note(uid, 'storage');
        });
      }
    } catch (err) {
      console.warn('[userCleanup] no pude revisar Storage:', err.message);
    }
  }

  return dead;
}

/**
 * Informe completo de qué hay para limpiar, sin borrar nada. Lo consumen el
 * script (dry-run) y la pantalla del panel, para que muestren lo mismo.
 *
 * El total se deduplica POR DOCUMENTO: un match con los dos extremos muertos
 * aparece bajo dos uids pero es un solo doc, y sumando por uid daría el doble
 * de lo que hay en la colección.
 */
async function buildCleanupReport(db, auth, { bucket = null } = {}) {
  const { isLive } = await loadLiveUids(db, auth);
  const dead = await findDeadUids(db, isLive, { bucket });

  const unique = new Map(); // colección -> Set(doc path)
  const items = [];

  for (const [uid, where] of dead) {
    const { counts, paths } = await collectUserRefs(db, uid, { bucket });
    items.push({ uid, foundIn: [...where], counts });
    Object.entries(paths).forEach(([collection, list]) => {
      if (!unique.has(collection)) unique.set(collection, new Set());
      list.forEach((p) => unique.get(collection).add(p));
    });
  }

  const totals = {};
  for (const [collection, set] of unique) totals[collection] = set.size;

  return { items, totals, deadUids: items.length, keep: KEEP };
}

/** Cuentas de Auth sin doc en `users`: registros abandonados, no borrados. */
async function listAbandonedAccounts(db, auth) {
  const users = new Set((await db.collection('users').get()).docs.map((d) => d.id));
  const { users: authUsers } = await auth.listUsers(1000);
  return authUsers
    .filter((u) => !users.has(u.uid))
    .map((u) => ({
      uid: u.uid,
      email: u.email || null,
      emailVerified: u.emailVerified,
      createdAt: u.metadata.creationTime,
      ageDays: Math.round((Date.now() - new Date(u.metadata.creationTime)) / 86400000),
    }))
    .sort((a, b) => a.ageDays - b.ageDays);
}

/**
 * Borra una oferta + lo que cuelga de ella. Vivía duplicada en admin.js y en
 * scripts/delete-offers.js. Devuelve los conteos borrados.
 */
async function deleteOfferAndRefs(db, offerId) {
  const counts = {};
  const add = (key, n) => { if (n) counts[key] = (counts[key] || 0) + n; };

  const offerRef = db.collection('jobOffers').doc(offerId);
  if ((await offerRef.get()).exists) {
    await offerRef.delete();
    add('jobOffers', 1);
  }

  for (const collection of ['offerInteractions', 'matches', 'contactRequests', 'pinnedCandidates']) {
    const snap = await db.collection(collection).where('offerId', '==', offerId).get();
    add(collection, await deleteRefs(db, snap.docs.map((d) => d.ref)));
  }

  return counts;
}

/**
 * Qué se borraría para este uid, sin borrar nada. Es lo que habilita el dry-run.
 *
 * Devuelve además `paths` (colección -> lista de doc paths) para que quien
 * agregue varios uids pueda deduplicar: un match con los DOS extremos muertos
 * es un solo documento, y sumando por uid el total daría el doble.
 */
async function collectUserRefs(db, uid, { bucket = null } = {}) {
  const counts = {};
  const paths = {};
  const add = (key, n) => { if (n) counts[key] = (counts[key] || 0) + n; };
  const track = (collection, path) => {
    if (!paths[collection]) paths[collection] = [];
    paths[collection].push(path);
  };

  for (const collection of USER_ID_COLLECTIONS) {
    const doc = await db.collection(collection).doc(uid).get();
    if (doc.exists) { add(collection, 1); track(collection, doc.ref.path); }
  }

  const offerIds = new Set();
  const chatIds = new Set();

  // Se deduplica por doc: un match con el uid muerto en workerId Y employerId
  // es UN documento, no dos. Sin esto el reporte del dry-run dice más de lo que
  // hay realmente en la colección.
  const seen = new Map(); // colección -> Set(docId)
  for (const [collection, field] of USER_REF_FIELDS) {
    const snap = await db.collection(collection).where(field, '==', uid).get();
    if (!snap.size) continue;
    if (!seen.has(collection)) seen.set(collection, new Set());
    const ids = seen.get(collection);
    snap.docs.forEach((d) => {
      if (ids.has(d.id)) return;
      ids.add(d.id);
      add(collection, 1);
      track(collection, d.ref.path);
      if (collection === 'jobOffers') offerIds.add(d.id);
      if (collection === 'chats') chatIds.add(d.id);
    });
  }

  // Los mensajes son subcolección: borrar el chat NO los borra.
  let messages = 0;
  for (const chatId of chatIds) {
    const snap = await db.collection('chats').doc(chatId).collection('messages').get();
    snap.docs.forEach((d) => track('chatMessages', d.ref.path));
    messages += snap.size;
  }
  add('chatMessages', messages);

  // Archivos de Storage. Van al reporte para que el dry-run no oculte que se
  // borran megas de fotos y videos.
  if (bucket) {
    let files = 0;
    let bytes = 0;
    for (const prefix of USER_STORAGE_PREFIXES) {
      try {
        const [found] = await bucket.getFiles({ prefix: `${prefix}${uid}/` });
        found.forEach((f) => { files++; bytes += Number(f.metadata?.size || 0); track('storageFiles', f.name); });
      } catch {
        // Sin permisos o sin bucket: el dry-run sigue, sólo no reporta archivos.
      }
    }
    add('storageFiles', files);
    if (bytes) counts.storageBytes = bytes;
  }

  return { counts, paths, offerIds: [...offerIds], chatIds: [...chatIds] };
}

/**
 * Borra todo lo del usuario. `bucket` es opcional: si no viene, no se tocan los
 * archivos de Storage.
 */
async function deleteUserData(db, uid, { bucket = null } = {}) {
  const deleted = {};
  const add = (key, n) => { if (n) deleted[key] = (deleted[key] || 0) + n; };

  // 1. Ofertas primero: arrastran sus propias interacciones, matches,
  //    solicitudes y candidatos rankeados.
  const offersSnap = await db.collection('jobOffers').where('employerId', '==', uid).get();
  for (const offerDoc of offersSnap.docs) {
    const c = await deleteOfferAndRefs(db, offerDoc.id);
    Object.entries(c).forEach(([k, v]) => add(k, v));
  }

  // 2. Chats: primero los mensajes (subcolección), después el chat.
  //    Se deduplica por id: si el uid está en los dos extremos, es un solo chat.
  const chatRefs = [];
  const chatSeen = new Set();
  for (const field of ['workerId', 'employerId']) {
    const snap = await db.collection('chats').where(field, '==', uid).get();
    snap.docs.forEach((d) => {
      if (chatSeen.has(d.id)) return;
      chatSeen.add(d.id);
      chatRefs.push(d.ref);
    });
  }
  for (const chatRef of chatRefs) {
    const msgs = await chatRef.collection('messages').get();
    add('chatMessages', await deleteRefs(db, msgs.docs.map((d) => d.ref)));
  }
  add('chats', await deleteRefs(db, chatRefs));

  // 3. El resto de las referencias por campo, deduplicadas por doc.
  const byCollection = new Map();
  for (const [collection, field] of USER_REF_FIELDS) {
    if (collection === 'jobOffers' || collection === 'chats') continue; // ya arriba
    const snap = await db.collection(collection).where(field, '==', uid).get();
    if (!byCollection.has(collection)) byCollection.set(collection, new Map());
    snap.docs.forEach((d) => byCollection.get(collection).set(d.id, d.ref));
  }
  for (const [collection, refs] of byCollection) {
    add(collection, await deleteRefs(db, [...refs.values()]));
  }

  // 4. Documentos cuyo id es el uid.
  for (const collection of USER_ID_COLLECTIONS) {
    const ref = db.collection(collection).doc(uid);
    if ((await ref.get()).exists) {
      await ref.delete();
      add(collection, 1);
    }
  }

  // 5. Archivos de Storage.
  if (bucket) {
    let files = 0;
    for (const prefix of USER_STORAGE_PREFIXES) {
      try {
        const [found] = await bucket.getFiles({ prefix: `${prefix}${uid}/` });
        await Promise.all(found.map((f) => f.delete()));
        files += found.length;
      } catch (err) {
        // Un fallo de Storage no debe dejar el borrado de Firestore a medias.
        console.warn(`[userCleanup] no pude borrar ${prefix}${uid}/:`, err.message);
      }
    }
    add('storageFiles', files);
  }

  return deleted;
}

module.exports = {
  collectUserRefs,
  deleteUserData,
  deleteOfferAndRefs,
  loadLiveUids,
  findDeadUids,
  buildCleanupReport,
  listAbandonedAccounts,
  USER_REF_FIELDS,
  USER_ID_COLLECTIONS,
  USER_ID_DISCOVERY_COLLECTIONS,
  USER_STORAGE_PREFIXES,
  KEEP,
};
