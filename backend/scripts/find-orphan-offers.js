/**
 * Diagnóstico (SOLO LECTURA): ofertas laborales para limpiar.
 *  - "orphan": el employerId no tiene doc en `users` (dueño borrado a mano).
 *  - "superuser": el employerId es una cuenta con role 'superuser' (ofertas de prueba).
 *
 * Uso: node scripts/find-orphan-offers.js
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

async function getUsersMap(ids) {
  const map = new Map();
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 100) {
    const refs = uniq.slice(i, i + 100).map(id => db.collection('users').doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach(d => { if (d.exists) map.set(d.id, d.data()); });
  }
  return map;
}

async function main() {
  const snap = await db.collection('jobOffers').get();
  const usersMap = await getUsersMap(snap.docs.map(d => d.data().employerId));

  const rows = snap.docs.map(d => {
    const o = d.data();
    const owner = o.employerId ? usersMap.get(o.employerId) : null;
    let category = 'normal';
    if (!owner) category = 'orphan';
    else if (owner.role === 'superuser') category = 'superuser';
    return {
      id: d.id,
      puesto: o.puesto || null,
      rubro: o.rubro || null,
      employerId: o.employerId || null,
      ownerRole: owner ? owner.role : '(sin users doc)',
      active: o.active !== false,
      category,
    };
  });

  const orphan = rows.filter(r => r.category === 'orphan');
  const superuser = rows.filter(r => r.category === 'superuser');

  console.log(`\nTotal ofertas: ${rows.length} | orphan: ${orphan.length} | superuser: ${superuser.length} | normales: ${rows.length - orphan.length - superuser.length}\n`);

  console.log('=== ORPHAN (employerId sin users doc) ===');
  orphan.forEach(r => console.log(`- ${r.id} | ${r.puesto || '?'} / ${r.rubro || '?'} | employerId=${r.employerId} | active=${r.active}`));

  console.log('\n=== SUPERUSER (employerId con role superuser) ===');
  superuser.forEach(r => console.log(`- ${r.id} | ${r.puesto || '?'} / ${r.rubro || '?'} | employerId=${r.employerId} | active=${r.active}`));

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
