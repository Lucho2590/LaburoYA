const citiesService = require('./citiesService');
const geocodingService = require('./geocodingService');
const { sanitizeLocation } = require('./matchingService');
const { normalizeZona } = require('../utils/constants');

// Resuelve la ubicación de una entidad (worker / oferta / candidato de CV) a un
// par { location, city } listo para persistir:
//  - Si trae coords explícitas (GPS / punto del mapa), se usan tal cual.
//  - Si no, se geocodifica a partir de dirección / localidad / zona + ciudad.
//  - La ciudad se resuelve por nombre/id; si no, se usa la ciudad por defecto.
//
// Nunca lanza: si el geocoding falla, devuelve location=null (el matching cae
// igual al fallback de centroide de zona).
async function enrichLocation(input = {}) {
  const { location, city, zona, localidad, address } = input;
  await citiesService.ensureLoaded();

  // Resolver ciudad
  let cityName = city && String(city).trim() ? String(city).trim() : null;
  let cityDoc = cityName ? citiesService.findCitySync(cityName) : null;
  if (!cityDoc) {
    cityDoc = citiesService.defaultCitySync();
    if (cityDoc) cityName = cityDoc.nombre;
  }

  // Coords explícitas ganan
  let coords = sanitizeLocation(location);

  // Fallback: geocodificar texto
  if (!coords) {
    const canonicalZona = normalizeZona(zona);
    const parts = [address, localidad, canonicalZona || zona, cityName, 'Argentina']
      .map(p => (p ? String(p).trim() : ''))
      .filter(Boolean);
    if (parts.length) {
      const hint = cityDoc && cityDoc.center
        ? { center: cityDoc.center, radiusKm: cityDoc.radiusKm }
        : undefined;
      try {
        const geo = await geocodingService.geocode(parts.join(', '), hint);
        if (geo) coords = sanitizeLocation(geo);
      } catch {
        // best-effort: seguimos sin coords
      }
    }
  }

  return { location: coords, city: cityName || null };
}

module.exports = { enrichLocation };
