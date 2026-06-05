export type LatLng = { lat: number; lng: number };

/**
 * Pide la ubicación del dispositivo vía la API del navegador.
 * Resuelve con { lat, lng } o rechaza con un mensaje en español listo para toast.
 */
export function getBrowserLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Tu navegador no soporta geolocalización.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        let message = 'No se pudo obtener tu ubicación.';
        if (err.code === err.PERMISSION_DENIED) {
          message = 'Permiso de ubicación denegado. Activalo en el navegador para usar la cercanía.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          message = 'Tu ubicación no está disponible en este momento.';
        } else if (err.code === err.TIMEOUT) {
          message = 'Se agotó el tiempo para obtener tu ubicación. Probá de nuevo.';
        }
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  });
}
