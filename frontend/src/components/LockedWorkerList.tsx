'use client';

import Link from 'next/link';
import { Lock, MapPin } from 'lucide-react';
import { ILockedWorker } from '@/types';
import { JOB_CATEGORIES, TRubro } from '@/config/constants';
import { STAR_MAX } from '@/lib/stars';

interface LockedWorkerListProps {
  workers: ILockedWorker[];
}

// Nombres de relleno para el placeholder borroso. El nombre real NO llega al
// browser (el backend lo omite del payload), así que no hay nada que difuminar:
// esto es decoración para que el bloqueo se lea como "acá hay un nombre" en vez
// de como un rectángulo. Ninguno corresponde a un candidato real.
const FILLER_NAMES = [
  'Martín Gómez',
  'Lucía Fernández',
  'Sebastián Rodríguez',
  'Ana Paula Díaz',
  'Nicolás Ferrari',
  'Camila Sosa',
  'Joaquín Benítez',
  'Valentina Ríos',
];

// Determinista por uid: la misma card muestra siempre el mismo relleno y no
// parpadea entre renders.
function fillerName(uid: string) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  return FILLER_NAMES[Math.abs(hash) % FILLER_NAMES.length];
}

/**
 * Candidatos que matchean con búsquedas pausadas o vencidas. Se muestran en vez
 * de desaparecer, porque el dashboard los sigue contando y una lista vacía
 * después de "tenés N candidatos" no se entiende.
 *
 * El nombre y la foto no se difuminan con CSS: no vienen. El backend los omite
 * del payload (ver matchingService.getAllRelevantWorkersForEmployer), así que
 * acá sólo queda dibujar el placeholder.
 */
export function LockedWorkerList({ workers }: LockedWorkerListProps) {
  if (workers.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-1.5 mb-1 theme-text-primary">
        <Lock className="h-4 w-4" />
        <h3 className="font-semibold text-sm">
          {workers.length} candidato{workers.length !== 1 ? 's' : ''} bloqueado{workers.length !== 1 ? 's' : ''}
        </h3>
      </div>
      <p className="theme-text-muted text-xs mb-3">
        Matchean con búsquedas tuyas que están vencidas o pausadas.
      </p>

      <div className="space-y-3">
        {workers.map((worker) => (
          <div
            key={worker.uid}
            className="theme-bg-card rounded-xl border theme-border p-4 relative overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* Relleno borroso: el nombre real nunca llega al browser.
                      aria-hidden para que un lector de pantalla no lea un
                      nombre inventado. */}
                  <span
                    aria-hidden="true"
                    className="font-semibold theme-text-primary blur-[5px] select-none whitespace-nowrap"
                  >
                    {fillerName(worker.uid)}
                  </span>
                  <span className="sr-only">Nombre oculto</span>
                  {!!worker.bestStars && (
                    <span className="text-sm">
                      <span className="text-yellow-500">{'★'.repeat(worker.bestStars)}</span>
                      <span className="text-gray-300">{'☆'.repeat(Math.max(0, STAR_MAX - worker.bestStars))}</span>
                    </span>
                  )}
                </div>

                <p className="theme-text-secondary text-sm truncate mt-1">
                  {worker.puesto} • {JOB_CATEGORIES[worker.rubro as TRubro]?.label || worker.rubro}
                </p>

                {worker.bestOffer?.puesto && (
                  <p className="text-xs theme-text-muted mt-1 truncate">
                    → Para tu búsqueda: {worker.bestOffer.puesto}
                  </p>
                )}

                {worker.zona && (
                  <div className="flex items-center gap-0.5 mt-1 text-xs theme-text-muted">
                    <MapPin className="h-3 w-3" />
                    {worker.zona}
                  </div>
                )}
              </div>

              <Lock className="h-4 w-4 theme-text-muted flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/employer/jobs"
        className="mt-3 block rounded-xl theme-bg-secondary px-4 py-3 text-center text-sm theme-text-secondary active:scale-[0.98] transition-transform"
      >
        Republicá la búsqueda para{' '}
        <span className="text-[#E10600] font-medium">ver y contactar a estos candidatos →</span>
      </Link>
    </div>
  );
}
