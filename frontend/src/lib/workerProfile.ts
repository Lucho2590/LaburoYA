import { IWorkerProfile } from '@/types';

/**
 * Porcentaje de completitud del perfil laboral (0-100), o null si todavía no hay
 * perfil. Los cuatro primeros campos son los que usa el matching para acercarle
 * ofertas: sin ellos el feed viene vacío.
 */
export function getWorkerProfileCompletion(profile?: IWorkerProfile | null): number | null {
  if (!profile) return null;

  const filled = [
    !!profile.rubro,
    !!profile.puesto,
    !!profile.zona,
    !!profile.localidad,
    !!profile.experience,
    !!profile.description,
    !!profile.skills && profile.skills.length > 0,
    !!profile.videoUrl,
  ];

  return Math.round((filled.filter(Boolean).length / filled.length) * 100);
}
