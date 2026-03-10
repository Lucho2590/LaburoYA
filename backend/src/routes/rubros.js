const express = require('express');
const { getDb } = require('../config/firebase');

const router = express.Router();

// GET /api/rubros - Get all active rubros (PUBLIC - no auth required)
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const { includeInactive } = req.query;

    let query = db.collection('rubros');

    // By default, only return active rubros
    if (includeInactive !== 'true') {
      query = query.where('activo', '==', true);
    }

    const snapshot = await query.orderBy('orden', 'asc').get();

    const rubros = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ rubros });
  } catch (error) {
    // If orderBy fails due to missing index, try without it
    if (error.code === 9) {
      try {
        const db = getDb();
        let snapshot;

        if (req.query.includeInactive !== 'true') {
          snapshot = await db.collection('rubros').where('activo', '==', true).get();
        } else {
          snapshot = await db.collection('rubros').get();
        }

        const rubros = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort in memory
        rubros.sort((a, b) => (a.orden || 0) - (b.orden || 0));

        return res.json({ rubros });
      } catch (err) {
        return next(err);
      }
    }
    next(error);
  }
});

// GET /api/rubros/:id - Get a single rubro (PUBLIC)
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const rubroDoc = await db.collection('rubros').doc(id).get();

    if (!rubroDoc.exists) {
      return res.status(404).json({ error: 'Rubro no encontrado' });
    }

    res.json({
      id: rubroDoc.id,
      ...rubroDoc.data()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
