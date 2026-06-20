// Seed idempotente de la colección `cities`. Crea Mar del Plata (radio 15 km)
// con sus zonas si todavía no existe. Ejecutar con: node src/scripts/seedCities.js
require('dotenv').config();
const { initializeFirebase, getDb } = require('../config/firebase');
const { ZONAS_MDP, MDP_CENTER } = require('../utils/constants');

const SEED_CITIES = [
  {
    nombre: 'Mar del Plata',
    center: MDP_CENTER,
    radiusKm: 15,
    zonas: ZONAS_MDP,
    activo: true,
    orden: 0
  }
];

async function seedCities() {
  const db = getDb();
  for (const city of SEED_CITIES) {
    const existing = await db.collection('cities')
      .where('nombre', '==', city.nombre)
      .limit(1)
      .get();
    if (!existing.empty) {
      console.log(`✓ Ciudad ya existe: ${city.nombre}`);
      continue;
    }
    await db.collection('cities').add({
      ...city,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`+ Ciudad creada: ${city.nombre} (radio ${city.radiusKm} km)`);
  }
}

// Permite usarlo como script CLI o importarlo (seed on-boot).
if (require.main === module) {
  initializeFirebase();
  seedCities()
    .then(() => {
      console.log('Seed de ciudades completado.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error en seed de ciudades:', err);
      process.exit(1);
    });
}

module.exports = { seedCities, SEED_CITIES };
