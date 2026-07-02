/**
 * Borra de forma permanente perfiles de `workers` por uid, junto con su data
 * relacionada (matches, offerInteractions, contactRequests, notifications).
 * Pensado para limpiar workers "huérfanos" (sin doc en `users` ni Auth) que
 * quedaron tras borrar el usuario a mano en la consola de Firebase.
 *
 * Uso: node scripts/delete-workers.js <uid> [<uid> ...]
 */

require('dotenv').config();
const admin = require('firebase-admin');

let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey
  })
});

const db = admin.firestore();

async function deleteWorker(uid) {
  const counts = { worker: 0, matches: 0, offerInteractions: 0, contactRequests: 0, notifications: 0 };

  // Perfil worker
  const workerRef = db.collection('workers').doc(uid);
  if ((await workerRef.get()).exists) {
    await workerRef.delete();
    counts.worker = 1;
  }

  // Colecciones que referencian al uid.
  const deleteWhere = async (collection, field, key) => {
    const snap = await db.collection(collection).where(field, '==', uid).get();
    // Firestore limita batches a 500 ops; a esta escala alcanza uno.
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    if (snap.size) await batch.commit();
    counts[key] += snap.size;
  };

  await deleteWhere('matches', 'workerId', 'matches');
  await deleteWhere('offerInteractions', 'userId', 'offerInteractions');
  await deleteWhere('contactRequests', 'fromUid', 'contactRequests');
  await deleteWhere('contactRequests', 'toUid', 'contactRequests');
  await deleteWhere('notifications', 'userId', 'notifications');

  return counts;
}

async function main() {
  const uids = process.argv.slice(2);
  if (uids.length === 0) {
    console.error('Uso: node scripts/delete-workers.js <uid> [<uid> ...]');
    process.exit(1);
  }

  for (const uid of uids) {
    const c = await deleteWorker(uid);
    console.log(`✓ ${uid} → worker:${c.worker} matches:${c.matches} interactions:${c.offerInteractions} contactRequests:${c.contactRequests} notifications:${c.notifications}`);
  }

  console.log('\nListo.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
