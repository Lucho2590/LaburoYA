const { getDb } = require('../config/firebase');
const { zonaCentroid, normalizeZona } = require('../utils/constants');
const citiesService = require('./citiesService');

// Match type constants
const MATCH_TYPES = {
  FULL_MATCH: 'full_match',      // rubro + puesto + zona
  PARTIAL_MATCH: 'partial_match', // rubro + puesto (different zona)
  SKILLS_MATCH: 'skills_match'    // only skills match
};

// Score weights (granular, normalized to a 0-100 scale)
const SCORES = {
  RUBRO_MATCH: 15,        // same rubro
  PUESTO_MATCH: 25,       // same puesto (rubro + puesto = 40)
  ZONA_MATCH: 15,         // same zona (rubro + puesto + zona = 55)
  SKILLS_MAX: 30,         // proportional to required-skills coverage
  NO_SKILLS_ROLE_CREDIT: 20, // offer lists no skills: don't penalize a strong role match
  VIDEO_BONUS: 8,         // profile quality
  DESCRIPTION_BONUS: 4,
  EXPERIENCE_BONUS: 3
};

// Proximity (geolocation-based) tuning.
// El "radio" de match lo define la ciudad de la oferta (citiesService). Si una
// entidad no tiene GPS, se cae al centroide de su zona (aprox). Dentro del radio
// cuenta como "en zona" (puntaje pleno); entre radio y 2x radio decae linealmente.
const PROXIMITY = {
  ZONA_APPROX_CAP: 12 // tope de puntos cuando algún lado usa centroide de zona (aprox)
};

// Great-circle distance in km between two { lat, lng } points.
function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Returns a valid { lat, lng } from a location-like object, or null.
function validCoords(loc) {
  if (!loc) return null;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Resuelve coordenadas usables para una entidad (worker u oferta):
// prefiere GPS preciso; si falta, cae al centro de su CIUDAD; y como último
// recurso, al centroide de la zona (legacy, sólo zonas de Mar del Plata).
// Devuelve { lat, lng, source: 'gps'|'city'|'zona' } o null.
function resolveCoords(entity) {
  if (!entity) return null;
  const gps = validCoords(entity.location);
  if (gps) return { ...gps, source: 'gps' };
  const cityDoc = entity.city ? citiesService.findCitySync(entity.city) : null;
  const cityCenter = cityDoc && validCoords(cityDoc.center);
  if (cityCenter) return { ...cityCenter, source: 'city' };
  const centroid = zonaCentroid(entity.zona);
  if (centroid) return { ...centroid, source: 'zona' };
  return null;
}

// Sanitize a location payload before persisting: validate and round to ~3
// decimals (~100 m) for privacy. Returns { lat, lng } or null if invalid.
function sanitizeLocation(loc) {
  const coords = validCoords(loc);
  if (!coords) return null;
  return {
    lat: Math.round(coords.lat * 1000) / 1000,
    lng: Math.round(coords.lng * 1000) / 1000
  };
}

// Map a 0-100 relevance/fit score to a 1-5 star rating (single source of truth).
function scoreToStars(score) {
  const s = Number(score) || 0;
  if (s >= 80) return 5;
  if (s >= 60) return 4;
  if (s >= 40) return 3;
  if (s >= 20) return 2;
  if (s >= 1) return 1;
  return 0;
}

// True si la oferta ya venció (expiresAt en el pasado). Tolera Timestamp/Date/string
// y ofertas sin expiresAt (legacy → no se consideran vencidas).
function isOfferExpired(offer) {
  const raw = offer && offer.expiresAt;
  if (!raw) return false;
  const d = raw.toDate ? raw.toDate() : new Date(raw);
  return d instanceof Date && !isNaN(d) && d.getTime() < Date.now();
}

// Caché en memoria (TTL corto) para las lecturas de colección completa más caras
// del matching: ofertas activas y workers activos. Reduce lecturas repetidas a
// Firestore en cada carga de discovery sin cambiar resultados. Mismo patrón que
// citiesService. Tolera staleness de hasta ACTIVE_TTL_MS (una oferta/worker nuevo
// puede tardar ese tiempo en aparecer).
const ACTIVE_TTL_MS = 60_000;
const _activeCache = { offers: null, workers: null };

async function getActiveOffers(db) {
  const now = Date.now();
  if (_activeCache.offers && now - _activeCache.offers.ts < ACTIVE_TTL_MS) {
    return _activeCache.offers.data;
  }
  const snap = await db.collection('jobOffers').where('active', '==', true).get();
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _activeCache.offers = { data, ts: now };
  return data;
}

async function getActiveWorkers(db) {
  const now = Date.now();
  if (_activeCache.workers && now - _activeCache.workers.ts < ACTIVE_TTL_MS) {
    return _activeCache.workers.data;
  }
  const snap = await db.collection('workers').where('active', '==', true).get();
  const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  _activeCache.workers = { data, ts: now };
  return data;
}

class MatchingService {
  /**
   * Calculate relevance score between a worker and a job offer
   * @param {Object} worker - Worker profile data
   * @param {Object} offer - Job offer data
   * @returns {Object} { score, matchType, details }
   */
  calculateRelevanceScore(worker, offer) {
    let score = 0;
    let matchType = null;
    const details = {
      rubroMatch: false,
      puestoMatch: false,
      zonaMatch: false,
      distanceKm: null,
      matchingSkills: [],
      bonuses: []
    };

    // --- Role: rubro + puesto (scored independently for finer granularity) ---
    const rubroMatch = !!worker.rubro && worker.rubro === offer.rubro;
    const puestoMatch = !!worker.puesto && worker.puesto === offer.puesto;
    details.rubroMatch = rubroMatch;
    details.puestoMatch = puestoMatch;
    if (rubroMatch) score += SCORES.RUBRO_MATCH;
    if (puestoMatch) score += SCORES.PUESTO_MATCH;

    // --- Proximity: coords resueltas (GPS preciso, con fallback al centroide de
    // la zona). El radio del match lo define la ciudad de la oferta. Dentro del
    // radio ⇒ "en zona" (puntaje pleno); entre radio y 2x radio ⇒ decae.
    // Filtro por ciudad (blando): si ambos tienen ciudad y son distintas, no hay
    // puntaje de zona (la zona "Centro" de una ciudad no equivale a la de otra).
    // Si el worker no tiene ciudad, se cae a proximidad por GPS/zona como antes.
    const offerCityDoc = offer.city ? citiesService.findCitySync(offer.city) : null;
    const workerCityDoc = worker.city ? citiesService.findCitySync(worker.city) : null;
    const differentCity = !!(offerCityDoc && workerCityDoc && offerCityDoc.id !== workerCityDoc.id);

    const wRes = resolveCoords(worker);
    const oRes = resolveCoords(offer);
    const radiusKm = citiesService.radiusForOfferSync(offer);
    let zonaMatch = false;
    details.approximate = false;
    if (!differentCity && wRes && oRes) {
      const distanceKm = haversineKm(wRes, oRes);
      details.distanceKm = Math.round(distanceKm * 10) / 10;
      // Aproximado si algún lado provino de un centroide de zona (no GPS).
      const approximate = wRes.source === 'zona' || oRes.source === 'zona';
      details.approximate = approximate;
      if (distanceKm <= radiusKm) {
        // Dentro del catchment de la ciudad ⇒ "en zona", puntaje pleno.
        zonaMatch = true;
        let pts = SCORES.ZONA_MATCH;
        if (approximate) pts = Math.min(pts, PROXIMITY.ZONA_APPROX_CAP);
        score += pts;
      } else if (distanceKm <= radiusKm * 2) {
        // Buffer: decaimiento lineal para zonas/ciudades vecinas.
        const decay = Math.max(0, 1 - (distanceKm - radiusKm) / radiusKm);
        let pts = Math.round(decay * SCORES.ZONA_MATCH);
        if (approximate) pts = Math.min(pts, PROXIMITY.ZONA_APPROX_CAP);
        score += pts;
      }
    }
    details.zonaMatch = zonaMatch;

    // --- Skills: proportional to required-skills coverage ---
    const workerSkills = worker.skills || [];
    const requiredSkills = offer.requiredSkills || [];
    if (requiredSkills.length > 0) {
      const matchingSkills = workerSkills.filter(skill => requiredSkills.includes(skill));
      details.matchingSkills = matchingSkills;
      const ratio = matchingSkills.length / requiredSkills.length; // 0..1
      score += Math.round(ratio * SCORES.SKILLS_MAX);
    } else if (puestoMatch) {
      // Offer lists no skills: don't penalize a strong role match.
      score += SCORES.NO_SKILLS_ROLE_CREDIT;
    }

    // --- Profile quality bonuses ---
    if (worker.videoUrl) {
      score += SCORES.VIDEO_BONUS;
      details.bonuses.push('video');
    }
    if (worker.description && worker.description.length >= 50) {
      score += SCORES.DESCRIPTION_BONUS;
      details.bonuses.push('description');
    }
    if (worker.experience && worker.experience.length >= 20) {
      score += SCORES.EXPERIENCE_BONUS;
      details.bonuses.push('experience');
    }

    score = Math.min(score, 100);

    // --- Match type (kept for badges & discovery grouping; inclusion unchanged) ---
    if (rubroMatch && puestoMatch) {
      matchType = zonaMatch ? MATCH_TYPES.FULL_MATCH : MATCH_TYPES.PARTIAL_MATCH;
    } else if (details.matchingSkills.length > 0) {
      matchType = MATCH_TYPES.SKILLS_MATCH;
    }

    return {
      score,
      stars: scoreToStars(score),
      matchType,
      details
    };
  }

  /**
   * Get relevant offers for a worker, sorted by relevance
   * @param {string} workerId - Worker UID
   * @returns {Array} Sorted array of offers with relevance info
   */
  async getRelevantOffersForWorker(workerId) {
    const db = getDb();
    await citiesService.ensureLoaded();

    // Get worker profile
    const workerDoc = await db.collection('workers').doc(workerId).get();
    if (!workerDoc.exists) {
      throw new Error('Worker not found');
    }
    const worker = workerDoc.data();

    // Get all active job offers (cacheado, TTL corto)
    const activeOffers = await getActiveOffers(db);

    // First pass: calculate relevance and collect employer IDs
    const relevantOffersTemp = [];
    const employerIds = new Set();

    for (const offer of activeOffers) {
      // No mostrar ofertas vencidas.
      if (isOfferExpired(offer)) continue;
      const relevance = this.calculateRelevanceScore(worker, offer);

      // Sólo matches reales (mismo rubro+puesto o skills en común); descarta
      // falsos positivos por bonus de perfil / coincidencia floja.
      if (relevance.matchType) {
        relevantOffersTemp.push({ offer, relevance });
        employerIds.add(offer.employerId);
      }
    }

    // Batch fetch all owners at once. El dueño puede ser un employer individual
    // o una empresa (companies); el employerId es el mismo campo en ambos casos,
    // así que probamos employers y caemos a companies si no está.
    const employerMap = new Map();
    if (employerIds.size > 0) {
      const ownerDocs = await Promise.all(Array.from(employerIds).map(async id => {
        const emp = await db.collection('employers').doc(id).get();
        if (emp.exists) return { id, data: emp.data() };
        const comp = await db.collection('companies').doc(id).get();
        if (comp.exists) return { id, data: comp.data() };
        return null;
      }));
      ownerDocs.forEach(d => {
        if (d) employerMap.set(d.id, d.data);
      });
    }

    // Build final result with employer data
    const relevantOffers = relevantOffersTemp.map(({ offer, relevance }) => ({
      ...offer,
      employer: employerMap.get(offer.employerId) || null,
      relevance,
      createdAt: offer.createdAt?.toDate?.() || offer.createdAt
    }));

    // Sort by score descending, then by createdAt descending
    relevantOffers.sort((a, b) => {
      if (b.relevance.score !== a.relevance.score) {
        return b.relevance.score - a.relevance.score;
      }
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return relevantOffers;
  }

  /**
   * Get relevant workers for an employer's job offer, sorted by relevance
   * @param {string} offerId - Job offer ID
   * @param {string} employerId - Employer UID (for verification)
   * @returns {Array} Sorted array of workers with relevance info
   */
  async getRelevantWorkersForOffer(offerId, employerId) {
    const db = getDb();
    await citiesService.ensureLoaded();

    // Get job offer
    const offerDoc = await db.collection('jobOffers').doc(offerId).get();
    if (!offerDoc.exists) {
      throw new Error('Job offer not found');
    }
    const offer = offerDoc.data();

    if (employerId && offer.employerId !== employerId) {
      throw new Error('Unauthorized');
    }

    // Get all active workers (cacheado, TTL corto)
    const activeWorkers = await getActiveWorkers(db);

    const relevantWorkers = [];

    for (const worker of activeWorkers) {
      const relevance = this.calculateRelevanceScore(worker, offer);

      // Sólo candidatos con match real (rubro+puesto o skills en común).
      if (relevance.matchType) {
        relevantWorkers.push({
          ...worker,
          relevance,
          createdAt: worker.createdAt?.toDate?.() || worker.createdAt
        });
      }
    }

    // Sort by score descending
    relevantWorkers.sort((a, b) => {
      if (b.relevance.score !== a.relevance.score) {
        return b.relevance.score - a.relevance.score;
      }
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return relevantWorkers;
  }

  /**
   * Get all relevant workers for all employer's offers
   * @param {string} employerId - Employer UID
   * @returns {Object} Workers grouped by match type
   */
  async getAllRelevantWorkersForEmployer(employerId) {
    const db = getDb();
    await citiesService.ensureLoaded();

    // Get all employer's active offers
    const offersSnapshot = await db.collection('jobOffers')
      .where('employerId', '==', employerId)
      .where('active', '==', true)
      .get();

    if (offersSnapshot.empty) {
      return { fullMatch: [], partialMatch: [], skillsMatch: [] };
    }

    // Get all active workers (cacheado, TTL corto)
    const activeWorkers = await getActiveWorkers(db);

    const workerScores = new Map(); // uid -> { worker, bestScore, bestMatchType, bestOffer }

    for (const offerDoc of offersSnapshot.docs) {
      const offer = { id: offerDoc.id, ...offerDoc.data() };
      // Ignorar ofertas vencidas al armar el listado de candidatos.
      if (isOfferExpired(offer)) continue;

      for (const worker of activeWorkers) {
        const relevance = this.calculateRelevanceScore(worker, offer);

        if (relevance.matchType) {
          const existing = workerScores.get(worker.uid);
          if (!existing || relevance.score > existing.bestScore) {
            workerScores.set(worker.uid, {
              ...worker,
              bestScore: relevance.score,
              bestStars: relevance.stars,
              bestMatchType: relevance.matchType,
              bestOffer: offer,
              relevance
            });
          }
        }
      }
    }

    // Batch fetch user info (name, email) for all workers at once
    const workerUids = Array.from(workerScores.keys());
    const userInfoMap = new Map();

    if (workerUids.length > 0) {
      const userPromises = workerUids.map(uid =>
        db.collection('users').doc(uid).get()
      );
      const userDocs = await Promise.all(userPromises);
      userDocs.forEach(doc => {
        if (doc.exists) {
          const userData = doc.data();
          userInfoMap.set(doc.id, {
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email
          });
        }
      });
    }

    // Group by match type
    const result = {
      fullMatch: [],
      partialMatch: [],
      skillsMatch: []
    };

    for (const workerData of workerScores.values()) {
      const userInfo = userInfoMap.get(workerData.uid) || {};
      const entry = {
        ...workerData,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        email: userInfo.email,
        createdAt: workerData.createdAt?.toDate?.() || workerData.createdAt
      };

      switch (workerData.bestMatchType) {
        case MATCH_TYPES.FULL_MATCH:
          result.fullMatch.push(entry);
          break;
        case MATCH_TYPES.PARTIAL_MATCH:
          result.partialMatch.push(entry);
          break;
        case MATCH_TYPES.SKILLS_MATCH:
          result.skillsMatch.push(entry);
          break;
      }
    }

    // Sort each group by score
    Object.keys(result).forEach(key => {
      result[key].sort((a, b) => b.bestScore - a.bestScore);
    });

    return result;
  }
  // DISABLED: Auto-matching removed - matches are now created only through mutual interest
  // via contact requests (see contactRequests.js)
  async findMatchesForWorker(workerId, workerData) {
    // No longer auto-create matches when worker creates profile
    // Matches are created when both parties express interest
    return [];
  }

  // DISABLED: Auto-matching removed - matches are now created only through mutual interest
  // via contact requests (see contactRequests.js)
  async findMatchesForJobOffer(offerId, jobOfferData) {
    // No longer auto-create matches when employer creates job offer
    // Matches are created when both parties express interest
    return [];
  }

  // Get all matches for a user (worker or employer)
  async getMatchesForUser(uid, role) {
    const db = getDb();
    let matchesSnapshot;

    console.log('[MatchingService] getMatchesForUser:', { uid, role });

    // Query without orderBy to avoid index requirement, then sort in memory
    if (role === 'worker') {
      matchesSnapshot = await db.collection('matches')
        .where('workerId', '==', uid)
        .get();
    } else {
      matchesSnapshot = await db.collection('matches')
        .where('employerId', '==', uid)
        .get();
    }

    console.log('[MatchingService] Found matches:', matchesSnapshot.size);

    if (matchesSnapshot.empty) {
      return [];
    }

    // Collect all IDs we need to fetch
    const employerIds = new Set();
    const workerIds = new Set();
    const offerIds = new Set();

    const matchesRaw = matchesSnapshot.docs.map(doc => {
      const matchData = doc.data();
      if (role === 'worker') {
        employerIds.add(matchData.employerId);
        offerIds.add(matchData.offerId);
      } else {
        workerIds.add(matchData.workerId);
      }
      return {
        id: doc.id,
        ...matchData,
        createdAt: matchData.createdAt?.toDate?.() || matchData.createdAt
      };
    });

    // Batch fetch all related documents in parallel
    const fetchPromises = [];

    if (role === 'worker') {
      // Fetch employers and job offers in parallel
      fetchPromises.push(
        Promise.all(Array.from(employerIds).map(id =>
          db.collection('employers').doc(id).get()
        )),
        Promise.all(Array.from(offerIds).map(id =>
          db.collection('jobOffers').doc(id).get()
        ))
      );
    } else {
      // Fetch workers
      fetchPromises.push(
        Promise.all(Array.from(workerIds).map(id =>
          db.collection('workers').doc(id).get()
        ))
      );
    }

    const results = await Promise.all(fetchPromises);

    // Build lookup maps
    const employerMap = new Map();
    const workerMap = new Map();
    const offerMap = new Map();

    if (role === 'worker') {
      results[0].forEach(doc => {
        if (doc.exists) employerMap.set(doc.id, doc.data());
      });
      results[1].forEach(doc => {
        if (doc.exists) offerMap.set(doc.id, doc.data());
      });
    } else {
      results[0].forEach(doc => {
        if (doc.exists) workerMap.set(doc.id, doc.data());
      });
    }

    // Enrich matches with related data
    const matches = matchesRaw.map(match => {
      if (role === 'worker') {
        return {
          ...match,
          employer: employerMap.get(match.employerId) || null,
          jobOffer: offerMap.get(match.offerId) || null
        };
      } else {
        return {
          ...match,
          worker: workerMap.get(match.workerId) || null
        };
      }
    });

    // Sort by createdAt descending (newest first)
    matches.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return matches;
  }

  // Update match status
  async updateMatchStatus(matchId, uid, status) {
    const db = getDb();
    const matchRef = db.collection('matches').doc(matchId);
    const matchDoc = await matchRef.get();

    if (!matchDoc.exists) {
      throw new Error('Match not found');
    }

    const matchData = matchDoc.data();

    // Verify ownership
    if (matchData.workerId !== uid && matchData.employerId !== uid) {
      throw new Error('Unauthorized');
    }

    await matchRef.update({
      status,
      updatedAt: new Date()
    });

    return { id: matchId, status };
  }
}

const matchingServiceInstance = new MatchingService();

module.exports = matchingServiceInstance;
module.exports.MATCH_TYPES = MATCH_TYPES;
module.exports.SCORES = SCORES;
module.exports.scoreToStars = scoreToStars;
module.exports.sanitizeLocation = sanitizeLocation;
module.exports.resolveCoords = resolveCoords;
module.exports.haversineKm = haversineKm;
