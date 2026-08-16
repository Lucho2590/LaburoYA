/**
 * Limpieza de datos que quedaron colgando de usuarios que ya no existen.
 *
 * Un uid está "muerto" cuando alguna colección lo referencia pero no existe ni
 * en `users` ni en Firebase Auth. Pasa cuando se borra una cuenta a mano desde
 * la consola, o por los borrados que no limpiaban en cascada.
 *
 * Comparte toda la lógica con la pantalla /sudo/limpieza del panel
 * (services/userCleanup), así que los dos muestran exactamente lo mismo.
 *
 * Uso:
 *   node scripts/cleanup-orphan-users.js                  # dry-run, no toca nada
 *   node scripts/cleanup-orphan-users.js --apply          # ejecuta el borrado
 *   node scripts/cleanup-orphan-users.js --list-abandoned # cuentas de Auth sin perfil
 *
 * El dry-run es el default a propósito: esto borra sin vuelta atrás.
 */

require('dotenv').config();
const { initializeFirebase, getDb, getAuth, getBucket } = require('../src/config/firebase');
const {
  buildCleanupReport,
  listAbandonedAccounts,
  deleteUserData,
} = require('../src/services/userCleanup');

initializeFirebase();

const APPLY = process.argv.includes('--apply');
const LIST_ABANDONED = process.argv.includes('--list-abandoned');

const fmt = (obj) => Object.entries(obj)
  .filter(([k]) => k !== 'storageBytes')
  .map(([k, v]) => `${k}=${v}`).join(' ') || '(nada)';

async function listAbandoned(db) {
  const cuentas = await listAbandonedAccounts(db, getAuth());
  console.log(`\nCuentas de Firebase Auth sin doc en 'users' (se registraron y nunca eligieron rol): ${cuentas.length}\n`);
  cuentas.forEach((u) => {
    console.log(`  ${(u.email || '(sin email)').padEnd(34)} ${String(u.ageDays).padStart(4)}d  verificado=${u.emailVerified}  ${u.uid}`);
  });
  console.log('\nEste modo NO borra nada. Son personas reales que abandonaron el registro:');
  console.log('decidí una por una antes de tocarlas.\n');
}

async function main() {
  const db = getDb();

  if (LIST_ABANDONED) return listAbandoned(db);

  console.log(APPLY ? '\n=== BORRANDO ===\n' : '\n=== DRY-RUN (no se toca nada; usá --apply para ejecutar) ===\n');

  const { items, totals, keep } = await buildCleanupReport(db, getAuth(), { bucket: getBucket() });

  if (items.length === 0) {
    console.log('No hay referencias a usuarios inexistentes. Nada que limpiar.\n');
    return;
  }

  console.log(`Uids que ya no existen y siguen referenciados: ${items.length}\n`);

  const borrado = {};
  for (const item of items) {
    console.log(`  ${item.uid}`);
    console.log(`     aparece en: ${item.foundIn.join(', ')}`);
    console.log(`     a borrar:   ${fmt(item.counts)}`);

    if (APPLY) {
      const deleted = await deleteUserData(db, item.uid, { bucket: getBucket() });
      Object.entries(deleted).forEach(([k, v]) => { borrado[k] = (borrado[k] || 0) + v; });
      console.log(`     BORRADO:    ${fmt(deleted)}`);
    }
    console.log('');
  }

  const total = APPLY ? borrado : totals;
  console.log('Total', APPLY ? 'borrado:' : 'de documentos únicos a borrar:');
  Object.entries(total).forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${v}`));
  console.log(`\nSe conserva a propósito: ${keep.join(', ')}`);
  if (!APPLY) console.log('\nNada de esto se ejecutó. Repetí con --apply cuando estés seguro.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('FALLÓ:', err); process.exit(1); });
