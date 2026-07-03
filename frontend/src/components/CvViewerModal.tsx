'use client';

import dynamic from 'next/dynamic';
import { X, ExternalLink, FileText, Loader2 } from 'lucide-react';

// El visor de Word (docx-preview) se carga sólo en el cliente y on-demand.
const CvDocxViewer = dynamic(() => import('./CvDocxViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full gap-2 text-sm theme-text-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
    </div>
  ),
});

// Popup para ver un CV en la misma página. Prioriza las imágenes de preview
// (previewUrls, generadas server-side para PDFs) para mostrarlo limpio "como
// imagen". Si no hay, cae por extensión: imagen → <img>, docx → docx-preview,
// pdf viejo sin preview → <iframe>, otros → link.
function cvKind(url: string): 'pdf' | 'image' | 'docx' | 'other' {
  const path = decodeURIComponent(url.split('?')[0]);
  const ext = (path.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  if (['docx', 'doc'].includes(ext)) return 'docx';
  return 'other';
}

export function CvViewerModal({
  open,
  fileUrl,
  previewUrls,
  name,
  onClose,
}: {
  open: boolean;
  fileUrl: string | null;
  previewUrls?: string[] | null;
  name?: string | null;
  onClose: () => void;
}) {
  if (!open || !fileUrl) return null;
  const hasPreviews = Array.isArray(previewUrls) && previewUrls.length > 0;
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
          {hasPreviews ? (
            // PDF (u otros) ya rasterizado a imágenes: se muestra limpio, sin chrome.
            <div className="w-full h-full overflow-auto flex flex-col items-center gap-3 p-3">
              {previewUrls!.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt={`${name || 'CV'} - página ${i + 1}`} className="max-w-full w-auto shadow-sm rounded" />
              ))}
            </div>
          ) : kind === 'image' ? (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl} alt={name || 'CV'} className="max-w-full max-h-full object-contain" />
            </div>
          ) : kind === 'docx' ? (
            <CvDocxViewer fileUrl={fileUrl} />
          ) : kind === 'pdf' ? (
            <iframe src={fileUrl} title="CV" className="w-full h-full border-0" />
          ) : (
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
