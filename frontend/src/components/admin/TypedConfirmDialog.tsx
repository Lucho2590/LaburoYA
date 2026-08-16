'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface TypedConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Palabra que hay que escribir para habilitar el botón. */
  keyword: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmación para acciones irreversibles: el botón queda deshabilitado hasta
 * escribir una palabra exacta. Mismo criterio que el editor de TyC, que ya usaba
 * este patrón; acá queda como componente para no copiarlo una tercera vez.
 *
 * Es a propósito más fricción que ConfirmDialog: se usa donde un click de más
 * borra datos que no vuelven.
 */
export function TypedConfirmDialog({
  open,
  title,
  description,
  keyword,
  confirmLabel = 'Eliminar',
  loading = false,
  onConfirm,
  onCancel,
}: TypedConfirmDialogProps) {
  const [text, setText] = useState('');

  if (!open) return null;

  const enabled = text === keyword && !loading;

  const close = () => {
    setText('');
    onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={loading ? undefined : close}
    >
      <div
        className="theme-bg-card w-full max-w-md rounded-xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold theme-text-primary">{title}</h2>
            <p className="mt-1 text-sm theme-text-secondary">{description}</p>
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-sm theme-text-secondary mb-2">
            Escribí <span className="font-mono font-semibold theme-text-primary">{keyword}</span> para confirmar
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            className="w-full px-4 py-3 rounded-lg border-2 theme-border theme-bg-secondary theme-text-primary font-mono focus:border-red-600 focus:outline-none"
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={close}
            disabled={loading}
            className="flex-1 rounded-lg border theme-border px-4 py-2 theme-text-secondary transition-colors hover:theme-bg-secondary disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { setText(''); onConfirm(); }}
            disabled={!enabled}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
