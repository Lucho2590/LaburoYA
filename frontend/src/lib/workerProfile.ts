import { IWorkerProfile } from '@/types';

/** Campos del perfil laboral que cuentan para la completitud. */
export interface IWorkerProfileFields {
  rubro?: string;
  puesto?: string;
  zona?: string;
  localidad?: string;
  experience?: string;
  description?: string;
  skills?: string[];
  photoUrl?: string;
  videoUrl?: string;
}

// Fuente única de la completitud. Antes esto vivía duplicado con dos listas
// distintas: /home ponderaba 8 campos y /worker/profile 9 (sumaba la foto), así
// que la misma persona veía dos porcentajes diferentes según la pantalla.
// Los dos primeros son los únicos que el backend exige (workers.js:36-38).
const PROFILE_FIELDS: { key: keyof IWorkerProfileFields; label: string; required: boolean }[] = [
  { key: 'rubro', label: 'Rubro', required: true },
  { key: 'puesto', label: 'Puesto', required: true },
  { key: 'skills', label: 'Habilidades', required: false },
  { key: 'zona', label: 'Zona de trabajo', required: false },
  { key: 'localidad', label: 'Localidad', required: false },
  { key: 'experience', label: 'Experiencia', required: false },
  { key: 'description', label: 'Descripción', required: false },
  { key: 'photoUrl', label: 'Foto', required: false },
  { key: 'videoUrl', label: 'Video', required: false },
];

function isFilled(fields: IWorkerProfileFields, key: keyof IWorkerProfileFields): boolean {
  const value = fields[key];
  return Array.isArray(value) ? value.length > 0 : !!value;
}

/** Porcentaje 0-100 más las etiquetas de lo que falta, para mostrar progreso. */
export function getProfileFieldStatus(fields: IWorkerProfileFields) {
  const completed: string[] = [];
  const missing: string[] = [];

  PROFILE_FIELDS.forEach((field) => {
    (isFilled(fields, field.key) ? completed : missing).push(field.label);
  });

  return {
    percentage: Math.round((completed.length / PROFILE_FIELDS.length) * 100),
    completed,
    missing,
  };
}

/**
 * Completitud del perfil guardado, o null si todavía no existe. El null importa:
 * distingue "no cargó nada" de "cargó 0 campos", y los banners lo usan para
 * decidir qué mostrar.
 */
export function getWorkerProfileCompletion(profile?: IWorkerProfile | null): number | null {
  if (!profile) return null;
  return getProfileFieldStatus(profile).percentage;
}
