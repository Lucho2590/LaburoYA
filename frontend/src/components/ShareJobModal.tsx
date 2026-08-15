'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Check, Copy, Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildJobShareUrl, generateJobQrDataUrl } from '@/lib/shareJob';

interface ShareJobModalProps {
  offerId: string | null;
  puesto?: string | null;
  rubro?: string | null;
  open: boolean;
  onClose: () => void;
}

// Modal para difundir una búsqueda: QR para mostrar en persona (flyer, vidriera)
// y link para pegar en WhatsApp. Quien lo abre cae en /register como worker y ve
// la oferta fijada arriba del feed apenas entra.
export function ShareJobModal({ offerId, puesto, rubro, open, onClose }: ShareJobModalProps) {
  // El QR se guarda junto a su offerId para no mostrar el de la búsqueda
  // anterior mientras se genera el nuevo.
  const [qr, setQr] = useState<{ offerId: string; dataUrl: string } | null>(null);
  const [copiedFor, setCopiedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !offerId) return;
    let cancelled = false;

    generateJobQrDataUrl(offerId)
      .then((dataUrl) => {
        if (!cancelled) setQr({ offerId, dataUrl });
      })
      .catch((err) => {
        console.error('Error generating QR:', err);
        toast.error('Error al generar el QR');
      });

    return () => {
      cancelled = true;
    };
  }, [open, offerId]);

  if (!offerId) return null;

  const qrDataUrl = qr?.offerId === offerId ? qr.dataUrl : '';
  const copied = copiedFor === offerId;

  const url = buildJobShareUrl(offerId);
  const shareText = puesto
    ? `Estoy buscando ${puesto}. Postulate en LaburoYA:`
    : 'Mirá esta búsqueda en LaburoYA:';

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedFor(offerId);
      toast.success('Link copiado');
      setTimeout(() => setCopiedFor(null), 2000);
    } catch {
      toast.error('No se pudo copiar el link');
    }
  };

  const downloadQr = async () => {
    try {
      const dataUrl = await generateJobQrDataUrl(offerId, 1024);
      const link = document.createElement('a');
      link.download = `qr-busqueda-${offerId}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('QR descargado');
    } catch {
      toast.error('Error al descargar el QR');
    }
  };

  const shareNative = async () => {
    try {
      await navigator.share({ title: puesto || 'Búsqueda en LaburoYA', text: shareText, url });
    } catch (err) {
      // El usuario cerró la hoja de compartir: no es un error que valga avisar.
      if ((err as Error)?.name !== 'AbortError') {
        toast.error('No se pudo compartir');
      }
    }
  };

  const canShareNative = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="my-2 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compartir búsqueda</DialogTitle>
          <DialogDescription>
            {puesto || 'Esta búsqueda'}
            {rubro ? ` · ${rubro}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center">
          <div className="bg-white p-5 rounded-2xl shadow-sm">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Código QR de la búsqueda" className="w-52 h-52" />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]" />
              </div>
            )}
          </div>

          <div className="w-full mt-5">
            <label className="block text-xs theme-text-muted mb-1">Link para compartir</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border theme-border theme-bg-secondary theme-text-primary text-xs font-mono"
              />
              <button
                type="button"
                onClick={copyUrl}
                title="Copiar link"
                className="p-2 theme-bg-secondary border theme-border rounded-lg active:scale-95 transition-transform cursor-pointer"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5 theme-text-muted" />
                )}
              </button>
            </div>
          </div>

          <div className="w-full mt-4 flex gap-3">
            <button
              type="button"
              onClick={downloadQr}
              disabled={!qrDataUrl}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 theme-bg-secondary border theme-border rounded-xl text-sm font-medium theme-text-primary active:scale-[0.98] transition-transform disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Descargar QR
            </button>
            {canShareNative && (
              <button
                type="button"
                onClick={shareNative}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Compartir
              </button>
            )}
          </div>

          <p className="mt-5 text-xs theme-text-muted text-center">
            Quien escanee el QR o abra el link se registra como trabajador y le aparece
            esta búsqueda para darle &quot;Me interesa&quot;.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
