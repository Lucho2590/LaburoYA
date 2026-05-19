'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface PinModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onVerified: (token: string) => void | Promise<void>;
}

export function PinModal({ open, title = 'Ingresá tu PIN', description, onClose, onVerified }: PinModalProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      toast.error('El PIN debe tener 4 dígitos');
      return;
    }
    setLoading(true);
    try {
      const { token } = await api.verifyAdminPin(pin);
      await onVerified(token);
      onClose();
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'PIN incorrecto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="theme-bg-card rounded-2xl p-6 w-full max-w-sm border theme-border">
        <h2 className="text-lg font-semibold theme-text-primary mb-2">{title}</h2>
        {description && <p className="text-sm theme-text-secondary mb-4">{description}</p>}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full text-center text-3xl tracking-[0.5em] font-mono px-4 py-4 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
            placeholder="••••"
          />
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border theme-border theme-text-secondary hover:theme-text-primary cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || pin.length !== 4}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white font-semibold disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
