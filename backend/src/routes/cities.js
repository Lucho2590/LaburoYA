const express = require('express');
const { getDb } = require('../config/firebase');

const router = express.Router();

function serializeCity(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    nombre: data.nombre,
    center: data.center,
    radiusKm: data.radiusKm,
    zonas: data.zonas || [],
    activo: data.activo,
    orden: data.orden || 0
  };
}

// GET /api/cities - Get all active cities (PUBLIC - no auth required)
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const { includeInactive } = req.query;

    let snapshot;
    try {
      let query = db.collection('cities');
      if (includeInactive !== 'true') {
        query = query.where('activo', '==', true);
      }
      snapshot = await query.orderBy('orden', 'asc').get();
    } catch (error) {
      // Falta de índice: traer y ordenar en memoria
      if (error.code === 9) {
        snapshot = includeInactive !== 'true'
          ? await db.collection('cities').where('activo', '==', true).get()
          : await db.collection('cities').get();
      } else {
        throw error;
      }
    }

    const cities = snapshot.docs.map(serializeCity);
    cities.sort((a, b) => (a.orden || 0) - (b.orden || 0));

    res.json({ cities });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
