/**
 * Borra ofertas laborales por id, junto con su data relacionada
 * (offerInteractions, matches, contactRequests, pinnedCandidates).
 *
 * Usa la misma cascada que el panel de admin (services/userCleanup): antes este
 * script tenía su propia copia.
 *
 * Uso: node scripts/delete-offers.js <offerId> [<offerId> ...]
 */

require('dotenv').config();
const { initializeFirebase, getDb } = require('../src/config/firebase');
const { deleteOfferAndRefs } = require('../src/services/userCleanup');

initializeFirebase();

async function main() {
  const ids = process.argv.slice(2);
  if (!ids.length) {
    console.error('Uso: node scripts/delete-offers.js <offerId> [<offerId> ...]');
    process.exit(1);
  }

  const db = getDb();
  for (const id of ids) {
    const deleted = await deleteOfferAndRefs(db, id);
    const detalle = Object.entries(deleted).map(([k, v]) => `${k}=${v}`).join(' ') || '(nada)';
    console.log(`${id}: ${detalle}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
