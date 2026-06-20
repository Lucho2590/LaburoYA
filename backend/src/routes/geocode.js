const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const geocodingService = require('../services/geocodingService');
const citiesService = require('../services/citiesService');

const router = express.Router();

// Proxy autenticado de geocoding para el frontend (autocompletado de direcciones).
// Centraliza el User-Agent, el rate-limit y el cache de Nominatim; el browser
// nunca llama a Nominatim directo.
//
// GET /api/geocode?q=<texto>&city=<nombre|id>&limit=5
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ results: [] });
    }

    let cityHint;
    if (req.query.city) {
      await citiesService.ensureLoaded();
      const city = citiesService.findCitySync(req.query.city);
      if (city && city.center) {
        cityHint = { center: city.center, radiusKm: city.radiusKm };
      }
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 10);
    const results = await geocodingService.searchAddresses(q, { limit, cityHint });
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

// GET /api/geocode/reverse?lat=&lng= -> { result: { lat, lng, displayName, city } | null }
// Reconoce la ciudad/localidad a partir de un punto (ej: el pin del mapa).
router.get('/reverse', authMiddleware, async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.json({ result: null });
    }
    const result = await geocodingService.reverseGeocode(lat, lng);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
