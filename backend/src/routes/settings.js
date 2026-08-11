const express = require('express');
const { getDb } = require('../config/firebase');
const appFeatures = require('../services/appFeatures');

const router = express.Router();

// GET /api/settings/features - Feature flags públicos (PUBLIC)
router.get('/features', async (req, res, next) => {
  try {
    const features = await appFeatures.getFeatures();
    res.json(features);
  } catch (error) {
    next(error);
  }
});

// GET /api/settings/terms - Get terms and conditions (PUBLIC)
router.get('/terms', async (req, res, next) => {
  try {
    const db = getDb();
    const termsDoc = await db.collection('settings').doc('terms').get();

    if (!termsDoc.exists) {
      return res.json({
        content: 'Términos y condiciones no disponibles.',
        updatedAt: null
      });
    }

    const data = termsDoc.data();
    res.json({
      content: data.content || 'Términos y condiciones no disponibles.',
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
