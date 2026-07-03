'use client';

import { useState } from 'react';
import { X, Ban, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BLOCK_REASONS, TBlockReason } from '@/config/blockReasons';

// Modal reutilizable para bloquear un perfil pidiendo el motivo (lista predefinida
// + nota opcional). Lo usan: interesados/matches (por worker) y ranking/talent pool
// (por CV). El caller decide qué identificadores mandar al bloquear.
export function BlockProfileModal({
  open,
  name,
  submitting = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  name?: string | null;
  submitting?: boolean;
  onConfirm: (reason: TBlockReason, note: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<TBlockReason | ''>('');
  const [note, setNote] = useState('');

  if (!open) return null;

  const confirm = () => {
    if (!reason) return;
    onConfirm(reason, note.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60]" onClick={onClose}>
      <div
        className="theme-bg-card w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b theme-border">
          <h3 className="font-semibold theme-text-primary flex items-center gap-2">
            <Ban className="h-5 w-5 text-[#E10600]" />
            Bloquear perfil
          </h3>
          <button onClick={onClose} className="p-1 active:theme-bg-secondary rounded-lg cursor-pointer">
            <X className="h-5 w-5 theme-text-secondary" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {name && (
            <p className="text-sm theme-text-muted">
              Vas a bloquear a <span className="font-medium theme-text-primary">{name}</span>. No volverá a aparecerte en matches ni en tus búsquedas.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium theme-text-muted mb-1">Motivo del rechazo *</label>
            <Select value={reason || undefined} onValueChange={(v) => setReason(v as TBlockReason)}>
              <SelectTrigger className="w-full theme-bg-secondary theme-text-primary theme-border">
                <SelectValue placeholder="Elegí un motivo" />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_REASONS.map((r) => (
                  <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium theme-text-muted mb-1">Nota (opcional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Detalle opcional del motivo…"
              className="w-full p-3 rounded-lg border theme-border theme-bg-secondary theme-text-primary text-sm focus:border-[#7C3AED] focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 p-4 border-t theme-border">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl theme-bg-secondary theme-text-primary font-medium disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={submitting || !reason}
            className="flex-1 py-2.5 rounded-xl bg-[#E10600] text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            Bloquear
          </button>
        </div>
      </div>
    </div>
  );
}
