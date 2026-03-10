'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { FileText, Save, AlertTriangle, Loader2 } from 'lucide-react';

export default function AdminSettingsPage() {
  const [termsContent, setTermsContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const fetchTerms = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getAdminTerms();
      setTermsContent(data.content || '');
      setOriginalContent(data.content || '');
      setLastUpdated(data.updatedAt || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar términos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, []);

  const hasChanges = termsContent !== originalContent;

  const handleSaveClick = () => {
    if (!hasChanges) {
      toast.info('No hay cambios para guardar');
      return;
    }
    setShowConfirmModal(true);
    setConfirmText('');
  };

  const handleConfirmSave = async () => {
    if (confirmText !== 'CONFIRMAR') {
      toast.error('Escribí "CONFIRMAR" para continuar');
      return;
    }

    setSaving(true);
    try {
      const result = await api.updateAdminTerms(termsContent, true);
      setOriginalContent(termsContent);
      setLastUpdated(result.updatedAt || null);
      setShowConfirmModal(false);
      setConfirmText('');
      toast.success('Términos actualizados correctamente');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <AdminLayout title="Configuración">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Configuración">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Configuración">
      {/* Terms Section */}
      <div className="theme-bg-card rounded-xl border theme-border overflow-hidden">
        <div className="p-6 border-b theme-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold theme-text-primary">
                  Términos y Condiciones
                </h2>
                <p className="text-sm theme-text-muted">
                  Última actualización: {formatDate(lastUpdated)}
                </p>
              </div>
            </div>
            <button
              onClick={handleSaveClick}
              disabled={!hasChanges || saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                hasChanges
                  ? 'bg-[#E10600] text-white hover:bg-[#c00500]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              Guardar cambios
            </button>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm theme-text-secondary mb-4">
            Este texto se mostrará a los usuarios cuando se registren en la waitlist.
            Podés usar saltos de línea para formatear el contenido.
          </p>

          <textarea
            value={termsContent}
            onChange={(e) => setTermsContent(e.target.value)}
            className="w-full h-96 px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent resize-none font-mono text-sm"
            placeholder="Escribí los términos y condiciones aquí..."
          />

          {hasChanges && (
            <div className="mt-4 flex items-center gap-2 text-yellow-600 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Tenés cambios sin guardar</span>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="theme-bg-card rounded-xl w-full max-w-md">
            <div className="p-6 border-b theme-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <h2 className="text-xl font-bold theme-text-primary">
                  Confirmar cambios
                </h2>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="theme-text-secondary">
                Estás por actualizar los términos y condiciones. Estos cambios afectarán
                a todos los nuevos usuarios que se registren.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  Para confirmar, escribí <strong>CONFIRMAR</strong> en el campo de abajo:
                </p>
              </div>

              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent text-center font-mono tracking-widest"
                placeholder="CONFIRMAR"
                autoFocus
              />

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setConfirmText('');
                  }}
                  className="flex-1 px-4 py-2 border theme-border rounded-lg theme-text-secondary hover:theme-bg-secondary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={confirmText !== 'CONFIRMAR' || saving}
                  className="flex-1 px-4 py-2 bg-[#E10600] text-white rounded-lg hover:bg-[#c00500] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
