'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';

// Renderiza un .docx en el cliente con docx-preview (docx-preview manipula el DOM
// directo, por eso renderizamos en un ref). Se carga on-demand vía next/dynamic
// desde CvViewerModal, así la lib no entra en el bundle principal.
export default function CvDocxViewer({ fileUrl }: { fileUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const [{ renderAsync }, res] = await Promise.all([
          import('docx-preview'),
          fetch(fileUrl),
        ]);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const blob = await res.blob();
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        await renderAsync(blob, containerRef.current, undefined, { inWrapper: true, className: 'docx' });
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl]);

  return (
    <div className="w-full h-full overflow-auto bg-white">
      {status === 'loading' && (
        <div className="flex items-center justify-center h-full gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando CV…
        </div>
      )}
      {status === 'error' && (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
          <p className="text-sm text-gray-600">No pudimos mostrar este Word acá.</p>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E10600] text-white text-sm font-medium"
          >
            <ExternalLink className="h-4 w-4" /> Abrir / descargar CV
          </a>
        </div>
      )}
      {/* docx-preview inyecta el contenido acá */}
      <div ref={containerRef} className={status === 'ready' ? 'block' : 'hidden'} />
    </div>
  );
}
