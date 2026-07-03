'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Loader2, Check, Maximize2, X } from 'lucide-react';
import { useCvAnalysis } from '@/contexts/CvAnalysisContext';

// Widget flotante de progreso del análisis de CVs. Se monta en (app)/layout.tsx,
// así que es visible en cualquier pantalla. Se muestra siempre que haya un análisis
// activo pero el modal detallado (en Ofertas) no esté a la vista.
export function CvAnalysisWidget() {
  const cv = useCvAnalysis();
  const pathname = usePathname();
  const router = useRouter();

  if (!cv.session) return null;

  const onJobs = !!pathname && pathname.startsWith('/employer/jobs');
  // Si estás en Ofertas y el modal está abierto (no minimizado), el modal ya
  // muestra el progreso: no hace falta el widget.
  if (onJobs && !cv.minimized) return null;

  const total = cv.items.length;
  const done = cv.items.filter((i) => i.status === 'done' || i.status === 'error').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const finished = !cv.running && total > 0 && done >= total;

  const expand = () => {
    cv.restore();
    if (!onJobs) router.push('/employer/jobs');
  };

  return (
    <div className="fixed bottom-20 sm:bottom-4 right-4 z-40 w-64 max-w-[calc(100vw-2rem)] theme-bg-card border theme-border rounded-xl shadow-lg overflow-hidden">
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={expand}
            className="flex items-center gap-2 min-w-0 cursor-pointer text-left"
            title="Abrir el detalle"
          >
            {finished ? (
              <Check className="h-4 w-4 text-green-600 shrink-0" />
            ) : (
              <Loader2 className="h-4 w-4 text-[#7C3AED] animate-spin shrink-0" />
            )}
            <span className="text-sm font-medium theme-text-primary truncate">
              {finished ? `Listo — ${done} analizados` : `Analizando ${Math.min(done + 1, total)} de ${total}…`}
            </span>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={expand} title="Abrir" className="p-1 rounded-lg active:theme-bg-secondary cursor-pointer">
              <Maximize2 className="h-4 w-4 theme-text-secondary" />
            </button>
            <button onClick={cv.close} title="Cerrar" className="p-1 rounded-lg active:theme-bg-secondary cursor-pointer">
              <X className="h-4 w-4 theme-text-secondary" />
            </button>
          </div>
        </div>
        <p className="text-xs theme-text-muted truncate mt-0.5">{cv.session.job.puesto}</p>
        <div className="mt-2 h-1.5 rounded-full theme-bg-secondary overflow-hidden">
          <div className="h-full bg-[#7C3AED] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
