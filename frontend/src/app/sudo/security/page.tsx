'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { Lock, Shield } from 'lucide-react';

export default function SecurityPage() {
  const [loading, setLoading] = useState(true);
  const [isPinSet, setIsPinSet] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [initialPin, setInitialPin] = useState('');
  const [confirmInitialPin, setConfirmInitialPin] = useState('');

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const { isSet } = await api.getAdminPinStatus();
      setIsPinSet(isSet);
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Error al cargar estado del PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleSetInitial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (initialPin.length !== 4) return toast.error('El PIN debe tener 4 dígitos');
    if (initialPin !== confirmInitialPin) return toast.error('Los PINs no coinciden');

    setSubmitting(true);
    try {
      await api.setInitialAdminPin(initialPin);
      toast.success('PIN configurado correctamente');
      setInitialPin('');
      setConfirmInitialPin('');
      setIsPinSet(true);
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Error al configurar PIN');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPin.length !== 4) return toast.error('Ingresá el PIN actual');
    if (newPin.length !== 4) return toast.error('El nuevo PIN debe tener 4 dígitos');
    if (newPin !== confirmNewPin) return toast.error('Los PINs nuevos no coinciden');

    setSubmitting(true);
    try {
      await api.changeAdminPin(currentPin, newPin);
      toast.success('PIN actualizado');
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Error al cambiar PIN');
    } finally {
      setSubmitting(false);
    }
  };

  const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 4);

  return (
    <AdminLayout title="Seguridad">
      <div className="max-w-xl space-y-6">
        <div className="theme-bg-card rounded-xl p-6 border theme-border">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-[#E10600] to-[#FF6A00] rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold theme-text-primary">PIN de administrador</h1>
              <p className="text-sm theme-text-secondary">
                PIN global de 4 dígitos requerido para ver, copiar o cambiar la API key de IA.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="theme-bg-card rounded-xl p-6 border theme-border">
            <p className="theme-text-secondary">Cargando...</p>
          </div>
        ) : !isPinSet ? (
          <form onSubmit={handleSetInitial} className="theme-bg-card rounded-xl p-6 border theme-border space-y-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-sm">
              <Lock className="w-4 h-4" />
              <span>Todavía no hay PIN configurado. Configurá uno para proteger las acciones sensibles.</span>
            </div>

            <div>
              <label className="block text-sm font-medium theme-text-primary mb-2">PIN inicial (4 dígitos)</label>
              <input
                type="password"
                inputMode="numeric"
                value={initialPin}
                onChange={(e) => setInitialPin(onlyDigits(e.target.value))}
                className="w-full text-center text-2xl tracking-[0.4em] font-mono px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                placeholder="••••"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium theme-text-primary mb-2">Confirmar PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={confirmInitialPin}
                onChange={(e) => setConfirmInitialPin(onlyDigits(e.target.value))}
                className="w-full text-center text-2xl tracking-[0.4em] font-mono px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                placeholder="••••"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || initialPin.length !== 4 || confirmInitialPin.length !== 4}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white font-semibold disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Guardando...' : 'Configurar PIN'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleChange} className="theme-bg-card rounded-xl p-6 border theme-border space-y-4">
            <h2 className="text-lg font-semibold theme-text-primary">Cambiar PIN</h2>

            <div>
              <label className="block text-sm font-medium theme-text-primary mb-2">PIN actual</label>
              <input
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={(e) => setCurrentPin(onlyDigits(e.target.value))}
                className="w-full text-center text-2xl tracking-[0.4em] font-mono px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                placeholder="••••"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium theme-text-primary mb-2">Nuevo PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(onlyDigits(e.target.value))}
                className="w-full text-center text-2xl tracking-[0.4em] font-mono px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                placeholder="••••"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium theme-text-primary mb-2">Confirmar nuevo PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={confirmNewPin}
                onChange={(e) => setConfirmNewPin(onlyDigits(e.target.value))}
                className="w-full text-center text-2xl tracking-[0.4em] font-mono px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                placeholder="••••"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || currentPin.length !== 4 || newPin.length !== 4 || confirmNewPin.length !== 4}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white font-semibold disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Guardando...' : 'Cambiar PIN'}
            </button>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
