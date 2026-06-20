const { getDb } = require('../config/firebase');
const { normalizeStr } = require('../utils/constants');

// Radio por defecto (km) cuando una oferta no tiene ciudad asociada o la ciudad
// no define radiusKm. Equivale a "toda Mar del Plata".
const DEFAULT_RADIUS_KM = 15;
const TTL_MS = 60_000;

let cache = []; // array de docs { id, nombre, center, radiusKm, zonas, activo, ... }
let cacheAt = 0;
let inflight = null;

function indexCity(city) {
  return normalizeStr(city.id) + '|' + normalizeStr(city.nombre);
}

/**
 * Carga (y cachea por TTL) la colección de ciudades. Idempotente: llamadas
 * concurrentes comparten el mismo fetch en vuelo.
 */
async function ensureLoaded(force = false) {
  const fresh = Date.now() - cacheAt < TTL_MS;
  if (!force && fresh && cache.length >= 0 && cacheAt > 0) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const snap = await getDb().collection('cities').get();
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cacheAt = Date.now();
    } catch (err) {
      console.warn('[cities] no se pudo cargar la colección:', err.message);
    } finally {
      inflight = null;
    }
    return cache;
  })();
  return inflight;
}

/** Busca una ciudad por id o nombre (insensible a acentos/mayúsculas). */
function findCitySync(cityRef) {
  if (!cityRef) return null;
  const ref = normalizeStr(cityRef);
  if (!ref) return null;
  for (const c of cache) {
    if (normalizeStr(c.id) === ref || normalizeStr(c.nombre) === ref) return c;
  }
  return null;
}

/**
 * Radio (km) aplicable a una oferta. Prioridad: radio propio de la oferta →
 * radio de su ciudad → DEFAULT_RADIUS_KM. Lee el cache sincrónico (poblado por
 * ensureLoaded()).
 */
function radiusForOfferSync(offer) {
  const offerRadius = offer && Number(offer.radiusKm);
  if (Number.isFinite(offerRadius) && offerRadius > 0) return offerRadius;
  const city = findCitySync(offer && offer.city);
  const r = city && Number(city.radiusKm);
  return Number.isFinite(r) && r > 0 ? r : DEFAULT_RADIUS_KM;
}

/** Ciudad por defecto: la activa de menor `orden` (fallback: cualquiera). */
function defaultCitySync() {
  const active = cache.filter(c => c.activo !== false);
  const pool = active.length ? active : cache;
  if (!pool.length) return null;
  return pool.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0))[0];
}

module.exports = {
  DEFAULT_RADIUS_KM,
  ensureLoaded,
  findCitySync,
  radiusForOfferSync,
  defaultCitySync,
  indexCity
};
