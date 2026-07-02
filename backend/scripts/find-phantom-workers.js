/**
 * Diagnóstico (SOLO LECTURA): encuentra perfiles de `workers` que aparecen como
 * candidatos en la app pero no en el panel de admin.
 *
 * El descubrimiento de candidatos lee la colección `workers` (active == true)
 * de forma independiente de `users`. Si un worker está activo pero su doc en
 * `users` fue borrado o no tiene nombre, aparece en la app (con el puesto como
 * nombre, ej. "Mozo") pero NO en el panel de admin (que lista `users`).
 *
 * Uso: node scripts/find-phantom-workers.js
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
const auth = admin.auth();

async function main() {
  const snap = await db.collection('workers').get();
  const rows = [];

  for (const doc of snap.docs) {
    const w = doc.data();
    const userDoc = await db.collection('users').doc(doc.id).get();
    const u = userDoc.exists ? userDoc.data() : null;
    let authExists = false;
    try { await auth.getUser(doc.id); authExists = true; } catch { /* no auth user */ }
    const name = u ? [u.firstName, u.lastName].filter(Boolean).join(' ') : '';
    rows.push({
      uid: doc.id,
      active: w.active !== false,
      puesto: w.puesto || null,
      rubro: w.rubro || null,
      zona: w.zona || null,
      hasVideo: !!w.videoUrl,
      hasUsersDoc: !!u,
      name: name || null,
      authExists,
    });
  }

  const activos = rows.filter(r => r.active);
  const phantom = activos.filter(r => !r.hasUsersDoc || !r.name);

  console.log(`\nTotal workers: ${rows.length}  |  activos: ${activos.length}`);
  console.log(`Candidatos "fantasma" (activos sin users doc o sin nombre): ${phantom.length}\n`);
  console.log('=== FANTASMA (candidatos a eliminar) ===');
  phantom.forEach(r => console.log(
    `- uid=${r.uid} | ${r.puesto || '?'} / ${r.rubro || '?'} | zona=${r.zona || '?'} | ` +
    `usersDoc=${r.hasUsersDoc} name=${r.name || '(sin nombre)'} auth=${r.authExists} video=${r.hasVideo}`
  ));

  console.log('\n=== Referencia: todos los workers activos ===');
  activos.forEach(r => console.log(
    `- uid=${r.uid} | ${r.puesto || '?'} / ${r.rubro || '?'} | name=${r.name || '(sin nombre)'} | usersDoc=${r.hasUsersDoc}`
  ));

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
