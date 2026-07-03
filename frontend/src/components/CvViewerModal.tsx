'use client';

import { X, ExternalLink, FileText } from 'lucide-react';

// Popup para ver un CV (PDF/imagen) sin salir de la página. El fileUrl es una URL
// de Firebase Storage que sirve el archivo inline y cuyo path incluye la extensión.
// PDF → <iframe>, imagen → <img>, otros (docx) → fallback a abrir en pestaña.
function cvKind(url: string): 'pdf' | 'image' | 'other' {
  const path = decodeURIComponent(url.split('?')[0]);
  const ext = (path.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  return 'other';
}

export function CvViewerModal({
  open,
  fileUrl,
  name,
  onClose,
}: {
  open: boolean;
  fileUrl: string | null;
  name?: string | null;
  onClose: () => void;
}) {
  if (!open || !fileUrl) return null;
  const kind = cvKind(fileUrl);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-2 sm:p-6" onClick={onClose}>
      <div
        className="theme-bg-card w-full max-w-4xl h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 p-3 border-b theme-border">
          <h3 className="font-semibold theme-text-primary truncate flex items-center gap-2 min-w-0">
            <FileText className="h-5 w-5 text-[#E10600] shrink-0" />
            <span className="truncate">{name || 'CV'}</span>
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs theme-text-secondary hover:theme-bg-secondary"
              title="Abrir en una pestaña nueva"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Abrir en pestaña</span>
            </a>
            <button onClick={onClose} className="p-1 rounded-lg active:theme-bg-secondary cursor-pointer" title="Cerrar">
              <X className="h-5 w-5 theme-text-secondary" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 theme-bg-secondary">
          {kind === 'pdf' && (
            <iframe src={fileUrl} title="CV" className="w-full h-full border-0" />
          )}
          {kind === 'image' && (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl} alt={name || 'CV'} className="max-w-full max-h-full object-contain" />
            </div>
          )}
          {kind === 'other' && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
              <FileText className="h-10 w-10 theme-text-muted" />
              <p className="text-sm theme-text-secondary">No se puede previsualizar este formato acá.</p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E10600] text-white text-sm font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir / descargar CV
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
