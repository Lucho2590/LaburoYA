import QRCode from 'qrcode';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://laburo-ya.com.ar';

// Prefijo que distingue un ref de oferta de los refs de campaña (qr_worker, etc.).
// Lo lee /register para fijar la oferta apenas la persona entra a la app.
export const JOB_REF_PREFIX = 'job_';

/**
 * Link para difundir una búsqueda. Va derecho a /register con el rol worker
 * preseleccionado: no hay vista pública de la oferta, se ve una vez adentro.
 */
export function buildJobShareUrl(offerId: string) {
  return `${BASE_URL}/register?ref=${JOB_REF_PREFIX}${offerId}&role=worker`;
}

/** Devuelve el offerId si el ref corresponde a una oferta compartida. */
export function parseJobRef(ref: string | null): string | null {
  if (!ref || !ref.startsWith(JOB_REF_PREFIX)) return null;
  return ref.slice(JOB_REF_PREFIX.length) || null;
}

export function generateJobQrDataUrl(offerId: string, width = 400) {
  return QRCode.toDataURL(buildJobShareUrl(offerId), {
    width,
    margin: 2,
    color: {
      dark: '#1a1a1a',
      light: '#ffffff',
    },
  });
}
