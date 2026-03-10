'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { IRubro } from '@/types';
import { X, Bell, CheckCircle, Loader2, ArrowLeft, FileText } from 'lucide-react';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = 'form' | 'terms' | 'success';

export function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [view, setView] = useState<ModalView>('form');
  const [rubros, setRubros] = useState<IRubro[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rubroId, setRubroId] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Terms content
  const [termsContent, setTermsContent] = useState('');
  const [loadingTerms, setLoadingTerms] = useState(false);

  useEffect(() => {
    const fetchRubros = async () => {
      try {
        const data = await api.getRubros();
        setRubros(data.rubros);
      } catch (err) {
        console.error('Error fetching rubros:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchRubros();
      setView('form');
    }
  }, [isOpen]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits;
  };

  const handleShowTerms = async () => {
    setLoadingTerms(true);
    try {
      const data = await api.getTerms();
      setTermsContent(data.content);
      setView('terms');
    } catch (err) {
      console.error('Error fetching terms:', err);
      setTermsContent('Error al cargar los términos y condiciones.');
      setView('terms');
    } finally {
      setLoadingTerms(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!acceptedTerms) {
      setError('Debés aceptar los términos y condiciones');
      return;
    }

    setSubmitting(true);

    try {
      await api.createLead({
        nombre,
        telefono: formatPhone(telefono),
        rubroId,
      });
      setView('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    localStorage.setItem('waitlistModalShown', 'true');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md relative overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>

        {view === 'success' ? (
          // Success State
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ¡Listo!
            </h2>
            <p className="text-gray-600 mb-6">
              Te avisaremos por WhatsApp cuando tengamos ofertas de trabajo para vos.
            </p>
            <button
              onClick={handleClose}
              className="w-full py-3 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Entendido
            </button>
          </div>
        ) : view === 'terms' ? (
          // Terms View
          <>
            <div className="bg-gradient-to-r from-[#E10600] to-[#FF6A00] p-6 text-white">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setView('form')}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  <h2 className="text-xl font-bold">Términos y Condiciones</h2>
                </div>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {loadingTerms ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {termsContent || 'No hay términos y condiciones disponibles.'}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setAcceptedTerms(true);
                  setView('form');
                }}
                className="w-full py-3 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                Aceptar y volver
              </button>
            </div>
          </>
        ) : (
          // Form State
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-[#E10600] to-[#FF6A00] p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Bell className="w-6 h-6" />
                <h2 className="text-xl font-bold">¿Buscás trabajo?</h2>
              </div>
              <p className="text-white/90 text-sm">
                Dejanos tus datos y te avisamos cuando tengamos ofertas para vos
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tu nombre
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#E10600] focus:border-transparent transition-all text-gray-900 bg-white"
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#E10600] focus:border-transparent transition-all text-gray-900 bg-white"
                  placeholder="Ej: 223 456 7890"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Te contactaremos por WhatsApp
                </p>
              </div>

              {/* Rubro */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ¿En qué rubro buscás trabajo?
                </label>
                {loading ? (
                  <div className="w-full px-4 py-3 rounded-xl border border-gray-300 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <select
                    value={rubroId}
                    onChange={(e) => setRubroId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#E10600] focus:border-transparent transition-all text-gray-900 bg-white"
                    required
                  >
                    <option value="">Seleccionar rubro</option>
                    {rubros.map((rubro) => (
                      <option key={rubro.id} value={rubro.id}>
                        {rubro.icono} {rubro.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-[#E10600] focus:ring-[#E10600]"
                />
                <label htmlFor="acceptTerms" className="text-sm text-gray-600">
                  Acepto los{' '}
                  <button
                    type="button"
                    onClick={handleShowTerms}
                    disabled={loadingTerms}
                    className="text-[#E10600] hover:underline font-medium"
                  >
                    {loadingTerms ? 'Cargando...' : 'términos y condiciones'}
                  </button>
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || loading || !acceptedTerms}
                className="w-full py-3 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Bell className="w-5 h-5" />
                    Avisame
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                No compartimos tu información con terceros
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
