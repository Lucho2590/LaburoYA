'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Diálogo de confirmación in-app (reemplaza al window.confirm nativo).
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="theme-bg-card w-full max-w-sm rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                isDanger ? 'bg-red-100' : 'bg-blue-100'
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 ${isDanger ? 'text-red-600' : 'text-blue-600'}`}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold theme-text-primary">{title}</h2>
              {description && (
                <p className="mt-1 text-sm theme-text-secondary">{description}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-lg border theme-border px-4 py-2 theme-text-secondary transition-colors hover:theme-bg-secondary disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium text-white transition-colors disabled:opacity-50 ${
                isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#E10600] hover:bg-[#c00500]'
              }`}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
