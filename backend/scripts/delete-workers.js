/**
 * Borra de forma permanente perfiles de `workers` por uid, junto con TODA su
 * data relacionada. Pensado para limpiar workers "huérfanos" (sin doc en
 * `users` ni Auth) que quedaron tras borrar el usuario a mano en la consola.
 *
 * Usa la misma cascada que el panel de admin (services/userCleanup): antes este
 * script tenía su propia copia, que no borraba chats, mensajes ni archivos.
 *
 * Uso: node scripts/delete-workers.js <uid> [<uid> ...]
 *
 * Para una limpieza masiva de todos los huérfanos, con dry-run previo, usá
 * scripts/cleanup-orphan-users.js.
 */

require('dotenv').config();
const { initializeFirebase, getDb, getBucket } = require('../src/config/firebase');
const { deleteUserData } = require('../src/services/userCleanup');

initializeFirebase();

async function main() {
  const uids = process.argv.slice(2);
  if (!uids.length) {
    console.error('Uso: node scripts/delete-workers.js <uid> [<uid> ...]');
    process.exit(1);
  }

  const db = getDb();
  for (const uid of uids) {
    const deleted = await deleteUserData(db, uid, { bucket: getBucket() });
    const detalle = Object.entries(deleted).map(([k, v]) => `${k}=${v}`).join(' ') || '(nada)';
    console.log(`${uid}: ${detalle}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
