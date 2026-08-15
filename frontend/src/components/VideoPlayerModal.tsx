'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ExternalLink, VideoOff, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Visor de video unificado (Discover, Solicitudes/Matches y panel admin).
// Se abre SIEMPRE en la misma pantalla y crece desde el box que se tocó.
//
// Dos cosas importantes:
// 1) Los videos se graban desde el celular, así que casi siempre son verticales
//    (9:16). El box arranca vertical y se corrige leyendo videoWidth/videoHeight
//    en onLoadedMetadata (el backend no guarda orientación, solo la URL).
//    El <video> va con object-contain: nunca recorta ni deforma.
// 2) playsInline evita que iOS se lleve la reproducción al player nativo a
//    pantalla completa (que es lo que se sentía como "se abrió en otra pantalla").
//
// Se apoya en las primitivas de Radix (no en un overlay propio) porque este
// visor puede abrirse ARRIBA de otro Dialog —el perfil del trabajador—: Radix
// maneja el stack de capas, así que Escape y el click afuera cierran solo el
// video y no el modal de atrás. Además DialogContent tiene un transform, y un
// `fixed` anidado ahí adentro se posicionaría contra el modal en vez del viewport.

const ANIM_MS = 280;
const PORTRAIT_RATIO = 9 / 16;
const BASE_TRANSFORM = 'translate(-50%, -50%)';
/** Tope de ancho para videos horizontales en desktop. */
const MAX_W_PX = 880;
/** Alto máximo del box (deja aire para el header flotante y los controles). */
const MAX_H_VH = 82;

export interface IVideoTarget {
  url: string;
  name?: string | null;
  /** Rect del box que disparó la apertura: la animación crece desde ahí. */
  rect?: DOMRect | null;
}

/**
 * Helper para los triggers: mide el elemento tocado para poder animar desde él.
 * Uso: onClick={(e) => setVideo(videoTargetFromEvent(e, url, nombre))}
 */
export function videoTargetFromEvent(
  e: { currentTarget: HTMLElement },
  url: string,
  name?: string | null,
): IVideoTarget {
  return { url, name, rect: e.currentTarget.getBoundingClientRect() };
}

export function VideoPlayerModal({
  target,
  onClose,
}: {
  target: IVideoTarget | null;
  onClose: () => void;
}) {
  // `visible` sobrevive al cierre del padre para poder animar la salida.
  const [visible, setVisible] = useState<IVideoTarget | null>(null);
  const [exiting, setExiting] = useState(false);
  const [ratio, setRatio] = useState(PORTRAIT_RATIO);
  const [failed, setFailed] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const flipRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitingRef = useRef(false);

  const startExit = useCallback(
    (notifyParent: boolean) => {
      if (exitingRef.current) return;
      exitingRef.current = true;
      setExiting(true);
      videoRef.current?.pause();

      const el = panelRef.current;
      if (el) {
        el.style.transition = `transform ${ANIM_MS}ms cubic-bezier(0.4, 0, 1, 1), opacity ${ANIM_MS}ms ease-in`;
        el.style.transform = flipRef.current ?? `${BASE_TRANSFORM} scale(0.94)`;
        el.style.opacity = flipRef.current ? '0.15' : '0';
      }

      timerRef.current = setTimeout(() => {
        exitingRef.current = false;
        setVisible(null);
        setExiting(false);
        if (notifyParent) onClose();
      }, ANIM_MS);
    },
    [onClose],
  );

  const visibleRef = useRef<IVideoTarget | null>(null);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (target) {
      if (timerRef.current) clearTimeout(timerRef.current);
      exitingRef.current = false;
      flipRef.current = null;
      setExiting(false);
      setFailed(false);
      setRatio(PORTRAIT_RATIO);
      setVisible(target);
    } else if (visibleRef.current) {
      // El padre cerró por su cuenta: animamos la salida sin volver a avisarle.
      startExit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // FLIP: medimos el box final, lo pisamos con el transform que lo lleva a la
  // miniatura, forzamos reflow y lo soltamos hasta su posición real.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!visible || !el) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = visible.rect;
    const to = el.getBoundingClientRect();

    if (reduceMotion) {
      flipRef.current = null;
      el.style.transform = BASE_TRANSFORM;
      el.style.opacity = '0';
    } else {
      if (from && from.width > 0 && to.width > 0) {
        const scale = Math.max(0.05, from.width / to.width);
        const dx = from.left + from.width / 2 - (to.left + to.width / 2);
        const dy = from.top + from.height / 2 - (to.top + to.height / 2);
        flipRef.current = `${BASE_TRANSFORM} translate(${dx}px, ${dy}px) scale(${scale})`;
      } else {
        flipRef.current = `${BASE_TRANSFORM} scale(0.9)`;
      }
      el.style.transform = flipRef.current;
      el.style.opacity = '0.2';
    }

    el.style.transition = 'none';
    void el.offsetWidth; // fuerza el reflow para que el estado inicial "exista"

    el.style.transition = reduceMotion
      ? `opacity ${ANIM_MS}ms ease-out`
      : `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${ANIM_MS}ms ease-out, width 200ms ease`;
    el.style.transform = BASE_TRANSFORM;
    el.style.opacity = '1';
  }, [visible]);

  if (!visible) return null;

  const { url, name } = visible;
  const widthCss = `min(${MAX_W_PX}px, calc(100vw - 1.5rem), calc(${MAX_H_VH}vh * ${ratio}))`;

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) startExit(true);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm duration-300',
            exiting ? 'animate-out fade-out-0' : 'animate-in fade-in-0',
          )}
        />
        <DialogPrimitive.Content
          ref={panelRef}
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-[70] flex flex-col overflow-hidden rounded-2xl bg-black shadow-2xl outline-none will-change-transform"
          style={{ width: widthCss, transform: BASE_TRANSFORM }}
        >
          {/* Header flotante: el box es el video, sin marco extra */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-sm font-semibold text-white drop-shadow">
              {name || 'Video de presentación'}
            </DialogPrimitive.Title>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg p-1.5 text-white/80 active:bg-white/20 hover:text-white"
              title="Abrir en una pestaña nueva"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => startExit(true)}
              className="cursor-pointer rounded-lg p-1.5 text-white/80 active:bg-white/20 hover:text-white"
              title="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className="w-full transition-[aspect-ratio] duration-200"
            style={{ aspectRatio: String(ratio) }}
          >
            {failed ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
                <VideoOff className="h-10 w-10 text-white/50" />
                <p className="text-sm text-white/80">
                  No se puede reproducir este video en este navegador.
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#E10600] px-4 py-2 text-sm font-medium text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir / descargar video
                </a>
              </div>
            ) : (
              <video
                ref={videoRef}
                src={url}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="h-full w-full object-contain"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.videoWidth > 0 && v.videoHeight > 0) {
                    setRatio(v.videoWidth / v.videoHeight);
                  }
                }}
                onError={() => setFailed(true)}
              />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
