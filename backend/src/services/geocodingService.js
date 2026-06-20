const crypto = require('crypto');
const { getDb } = require('../config/firebase');
const { normalizeStr } = require('../utils/constants');

// Geocoding contra Nominatim (OpenStreetMap). Gratis y sin API key, pero con
// política de uso estricta: identificar la app vía User-Agent, máx ~1 req/seg y
// cachear resultados. Por eso TODO geocoding del sistema pasa por este servicio
// (no se llama a Nominatim directo desde el frontend).

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = process.env.NOMINATIM_USER_AGENT
  || 'LaburoYA/1.0 (https://laburoya.com; contacto@laburoya.com)';
const MIN_INTERVAL_MS = 1100; // espaciado mínimo entre llamadas a Nominatim
const CACHE_COLLECTION = 'geocodeCache';
const MEM_CACHE_MAX = 500;

// --- Cache LRU en memoria ----------------------------------------------------
const memCache = new Map(); // key -> results[]
function memGet(key) {
  if (!memCache.has(key)) return undefined;
  const val = memCache.get(key);
  memCache.delete(key);
  memCache.set(key, val); // refresca orden LRU
  return val;
}
function memSet(key, val) {
  if (memCache.has(key)) memCache.delete(key);
  memCache.set(key, val);
  if (memCache.size > MEM_CACHE_MAX) {
    memCache.delete(memCache.keys().next().value);
  }
}

// --- Throttle global (cola serializada con espaciado >= MIN_INTERVAL_MS) ------
let lastCallAt = 0;
let chain = Promise.resolve();
function throttled(fn) {
  const run = chain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastCallAt));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    try {
      return await fn();
    } finally {
      lastCallAt = Date.now();
    }
  });
  // Evita que un error rompa la cadena para las próximas llamadas.
  chain = run.then(() => {}, () => {});
  return run;
}

// --- Helpers de cache en Firestore -------------------------------------------
function cacheKey(query, limit, viewbox) {
  const raw = `${normalizeStr(query)}|${limit}|${viewbox || ''}`;
  return crypto.createHash('sha1').update(raw).digest('hex');
}

async function cacheGetFs(key) {
  try {
    const doc = await getDb().collection(CACHE_COLLECTION).doc(key).get();
    return doc.exists ? (doc.data().results || []) : undefined;
  } catch {
    return undefined;
  }
}

async function cacheSetFs(key, query, results) {
  try {
    await getDb().collection(CACHE_COLLECTION).doc(key).set({
      query,
      results,
      updatedAt: new Date()
    });
  } catch {
    // El cache es best-effort: si falla, no rompemos el geocoding.
  }
}

// Construye un viewbox (bounding box) alrededor del centro de una ciudad para
// sesgar la búsqueda. cityHint: { center:{lat,lng}, radiusKm }.
function viewboxFor(cityHint) {
  if (!cityHint || !cityHint.center) return null;
  const { lat, lng } = cityHint.center;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const radiusKm = Number(cityHint.radiusKm) > 0 ? Number(cityHint.radiusKm) : 15;
  const dLat = radiusKm / 111; // ~111 km por grado de latitud
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  // viewbox = lng_min,lat_max,lng_max,lat_min (left,top,right,bottom)
  return `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`;
}

function parseResults(json) {
  if (!Array.isArray(json)) return [];
  return json
    .map(r => {
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng, displayName: r.display_name || null };
    })
    .filter(Boolean);
}

/**
 * Busca direcciones en Nominatim. Devuelve hasta `limit` candidatos
 * { lat, lng, displayName }. Usa cache (memoria + Firestore) y throttle.
 * @param {string} query - dirección / texto a geocodificar
 * @param {Object} [opts]
 * @param {number} [opts.limit=5]
 * @param {{center:{lat,lng}, radiusKm:number}} [opts.cityHint] - sesgo geográfico
 */
async function searchAddresses(query, opts = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const limit = Math.min(Math.max(Number(opts.limit) || 5, 1), 10);
  const viewbox = viewboxFor(opts.cityHint);
  const key = cacheKey(q, limit, viewbox);

  const mem = memGet(key);
  if (mem !== undefined) return mem;

  const fs = await cacheGetFs(key);
  if (fs !== undefined) {
    memSet(key, fs);
    return fs;
  }

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: String(limit),
    countrycodes: 'ar',
    addressdetails: '0'
  });
  if (viewbox) {
    // Sólo sesgo (sin bounded=1): prioriza la ciudad pero igual devuelve
    // resultados de otras ciudades, para poder avisar "fuera del área de servicio".
    params.set('viewbox', viewbox);
  }

  let results = [];
  try {
    const resp = await throttled(() =>
      fetch(`${NOMINATIM_URL}?${params.toString()}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' }
      })
    );
    if (resp.ok) {
      results = parseResults(await resp.json());
    } else {
      console.warn('[geocoding] Nominatim respondió', resp.status);
    }
  } catch (err) {
    console.warn('[geocoding] error consultando Nominatim:', err.message);
    return []; // no cacheamos errores de red
  }

  memSet(key, results);
  await cacheSetFs(key, q, results);
  return results;
}

/**
 * Geocodifica un texto a un único punto { lat, lng, displayName } o null.
 * @param {string} query
 * @param {{center:{lat,lng}, radiusKm:number}} [cityHint]
 */
async function geocode(query, cityHint) {
  const results = await searchAddresses(query, { limit: 1, cityHint });
  return results.length > 0 ? results[0] : null;
}

/**
 * Reverse geocoding: de coordenadas a una dirección legible (o null).
 */
async function reverseGeocode(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  const key = cacheKey(`rev:${la.toFixed(5)},${ln.toFixed(5)}`, 1, '');

  const mem = memGet(key);
  if (mem !== undefined) return mem[0] || null;
  const fs = await cacheGetFs(key);
  if (fs !== undefined) {
    memSet(key, fs);
    return fs[0] || null;
  }

  const params = new URLSearchParams({
    lat: String(la),
    lon: String(ln),
    format: 'json',
    addressdetails: '1'
  });
  let result = null;
  try {
    const resp = await throttled(() =>
      fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' }
      })
    );
    if (resp.ok) {
      const json = await resp.json();
      if (json && json.display_name) {
        const addr = json.address || {};
        const city =
          addr.city || addr.town || addr.village || addr.municipality ||
          addr.county || addr.state_district || null;
        result = { lat: la, lng: ln, displayName: json.display_name, city };
      }
    }
  } catch (err) {
    console.warn('[geocoding] error en reverse:', err.message);
    return null;
  }

  const arr = result ? [result] : [];
  memSet(key, arr);
  await cacheSetFs(key, `rev:${la},${ln}`, arr);
  return result;
}

module.exports = { geocode, searchAddresses, reverseGeocode };
