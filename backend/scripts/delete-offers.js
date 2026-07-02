/**
 * Borra ofertas laborales por id, junto con su data relacionada
 * (offerInteractions, matches, contactRequests, pinnedCandidates).
 *
 * Uso: node scripts/delete-offers.js <offerId> [<offerId> ...]
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

async function deleteOffer(offerId) {
  const counts = { offer: 0, offerInteractions: 0, matches: 0, contactRequests: 0, pinnedCandidates: 0 };

  const offerRef = db.collection('jobOffers').doc(offerId);
  if ((await offerRef.get()).exists) {
    await offerRef.delete();
    counts.offer = 1;
  }

  const deleteWhere = async (collection, key) => {
    const snap = await db.collection(collection).where('offerId', '==', offerId).get();
    if (!snap.size) return;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    counts[key] += snap.size;
  };

  await deleteWhere('offerInteractions', 'offerInteractions');
  await deleteWhere('matches', 'matches');
  await deleteWhere('contactRequests', 'contactRequests');
  await deleteWhere('pinnedCandidates', 'pinnedCandidates');

  return counts;
}

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error('Uso: node scripts/delete-offers.js <offerId> [<offerId> ...]');
    process.exit(1);
  }
  for (const id of ids) {
    const c = await deleteOffer(id);
    console.log(`✓ ${id} → offer:${c.offer} interactions:${c.offerInteractions} matches:${c.matches} contactRequests:${c.contactRequests} pinned:${c.pinnedCandidates}`);
  }
  console.log('\nListo.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
