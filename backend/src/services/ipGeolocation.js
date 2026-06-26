// Geolocalización por IP server-side.
//
// Se hace en el backend (no en el browser) para evitar el error de "Mixed
// Content": la app corre sobre HTTPS y el tier gratuito de ip-api.com solo
// expone HTTP. Desde el server, HTTP es válido y no lo bloquea el navegador.
//
// Nota: al correr desde el server, todos los lookups cuentan contra la IP única
// del backend frente al rate limit de ip-api (45 req/min). Suficiente para el
// volumen actual; si crece, considerar un proveedor con API key / HTTPS.

const IPS_PRIVADAS = /^(::1|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/;

// Devuelve { city, region, country, ip } o null si falla (best-effort: nunca lanza).
async function lookupIp(ip) {
  // Para IPs locales/privadas (dev) mandamos string vacío: ip-api geolocaliza
  // por la IP saliente del server en vez de fallar.
  const target = ip && !IPS_PRIVADAS.test(ip) ? ip : '';
  try {
    const response = await fetch(
      `http://ip-api.com/json/${target}?fields=city,regionName,country,query`
    );
    if (!response.ok) return null;

    const data = await response.json();
    return {
      city: data.city || null,
      region: data.regionName || null,
      country: data.country || null,
      ip: data.query || null,
    };
  } catch {
    return null;
  }
}

module.exports = { lookupIp };
