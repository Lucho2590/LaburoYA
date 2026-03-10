'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { IPlan, ICreatePlanData } from '@/types';
import { toast } from 'sonner';

type ModalMode = 'create' | 'edit' | null;

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<IPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedPlan, setSelectedPlan] = useState<IPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<ICreatePlanData>({
    name: '',
    description: '',
    price: 0,
    maxOffers: 1,
    visibleCandidatesPerOffer: 1,
    offerDurationDays: 7,
    isDefault: false,
    active: true,
    order: 0,
  });

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getAdminPlans();
      setPlans(data.plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar planes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      maxOffers: 1,
      visibleCandidatesPerOffer: 1,
      offerDurationDays: 7,
      isDefault: false,
      active: true,
      order: plans.length,
    });
    setSelectedPlan(null);
    setModalMode('create');
  };

  const openEditModal = (plan: IPlan) => {
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price: plan.price,
      maxOffers: plan.maxOffers,
      visibleCandidatesPerOffer: plan.visibleCandidatesPerOffer,
      offerDurationDays: plan.offerDurationDays,
      isDefault: plan.isDefault || false,
      active: plan.active,
      order: plan.order || 0,
    });
    setSelectedPlan(plan);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedPlan(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (modalMode === 'create') {
        await api.createAdminPlan(formData);
        toast.success('Plan creado correctamente');
      } else if (modalMode === 'edit' && selectedPlan) {
        await api.updateAdminPlan(selectedPlan.id, formData);
        toast.success('Plan actualizado correctamente');
      }
      closeModal();
      fetchPlans();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('¿Estás seguro de eliminar este plan?')) return;

    setDeleting(planId);
    try {
      await api.deleteAdminPlan(planId);
      toast.success('Plan eliminado correctamente');
      fetchPlans();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (plan: IPlan) => {
    try {
      await api.updateAdminPlan(plan.id, { active: !plan.active });
      toast.success(plan.active ? 'Plan desactivado' : 'Plan activado');
      fetchPlans();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const formatPrice = (price: number) => {
    if (price === 0) return 'Gratis';
    return `$${price.toLocaleString('es-AR')}`;
  };

  const formatLimit = (value: number) => {
    if (value === -1) return 'Ilimitado';
    return value.toString();
  };

  if (loading) {
    return (
      <AdminLayout title="Planes">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Planes">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Planes">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="theme-text-secondary">
          Configurá los planes de búsqueda para monetizar la app
        </p>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-[#E10600] text-white px-4 py-2 rounded-lg hover:bg-[#c00500] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Plan
        </button>
      </div>

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <div className="text-center py-16 theme-bg-card rounded-xl border theme-border">
          <span className="text-5xl">💰</span>
          <p className="theme-text-primary font-medium mt-4">No hay planes creados</p>
          <p className="theme-text-muted text-sm mt-1">Creá tu primer plan para empezar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`theme-bg-card rounded-xl border theme-border p-6 relative ${
                !plan.active ? 'opacity-60' : ''
              }`}
            >
              {/* Default Badge */}
              {plan.isDefault && (
                <div className="absolute top-4 right-4 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  Default
                </div>
              )}

              {/* Status Badge */}
              {!plan.active && (
                <div className="absolute top-4 left-4 bg-gray-500 text-white text-xs px-2 py-1 rounded-full">
                  Inactivo
                </div>
              )}

              {/* Plan Name & Price */}
              <h3 className="text-xl font-bold theme-text-primary mt-2">{plan.name}</h3>
              <p className="text-3xl font-bold text-[#E10600] mt-2">{formatPrice(plan.price)}</p>

              {plan.description && (
                <p className="theme-text-secondary text-sm mt-2">{plan.description}</p>
              )}

              {/* Features */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="theme-text-secondary">
                    <strong>{formatLimit(plan.maxOffers)}</strong> ofertas laborales
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="theme-text-secondary">
                    <strong>{formatLimit(plan.visibleCandidatesPerOffer)}</strong> candidatos visibles/oferta
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="theme-text-secondary">
                    <strong>{plan.offerDurationDays}</strong> días de duración
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-6 pt-4 border-t theme-border">
                <button
                  onClick={() => openEditModal(plan)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm theme-bg-secondary rounded-lg hover:opacity-80 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Editar
                </button>
                <button
                  onClick={() => handleToggleActive(plan)}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg transition-opacity ${
                    plan.active
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {plan.active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  disabled={deleting === plan.id || plan.isDefault}
                  className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={plan.isDefault ? 'No se puede eliminar el plan default' : 'Eliminar'}
                >
                  {deleting === plan.id ? (
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="theme-bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b theme-border">
              <h2 className="text-xl font-bold theme-text-primary">
                {modalMode === 'create' ? 'Nuevo Plan' : 'Editar Plan'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-1">
                  Nombre del plan *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
                  placeholder="Ej: Plan Pro"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
                  placeholder="Descripción corta del plan"
                  rows={2}
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-1">
                  Precio (en pesos) *
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
                  placeholder="0 = Gratis"
                  min={0}
                  required
                />
                <p className="text-xs theme-text-muted mt-1">Ingresá 0 para plan gratuito</p>
              </div>

              {/* Max Offers */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-1">
                  Cantidad de ofertas permitidas *
                </label>
                <input
                  type="number"
                  value={formData.maxOffers}
                  onChange={(e) => setFormData({ ...formData, maxOffers: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
                  placeholder="Cantidad de ofertas"
                  min={-1}
                  required
                />
                <p className="text-xs theme-text-muted mt-1">Ingresá -1 para ilimitado</p>
              </div>

              {/* Visible Candidates */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-1">
                  Candidatos visibles por oferta *
                </label>
                <input
                  type="number"
                  value={formData.visibleCandidatesPerOffer}
                  onChange={(e) => setFormData({ ...formData, visibleCandidatesPerOffer: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
                  placeholder="Candidatos visibles"
                  min={-1}
                  required
                />
                <p className="text-xs theme-text-muted mt-1">Ingresá -1 para ilimitado. El resto aparece bloqueado.</p>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-1">
                  Duración de la oferta (días) *
                </label>
                <input
                  type="number"
                  value={formData.offerDurationDays}
                  onChange={(e) => setFormData({ ...formData, offerDurationDays: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
                  placeholder="Días de duración"
                  min={1}
                  required
                />
              </div>

              {/* Order */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-1">
                  Orden de visualización
                </label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
                  min={0}
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-[#E10600] focus:ring-[#E10600]"
                  />
                  <span className="text-sm theme-text-secondary">Plan por defecto (primera oferta gratis)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-[#E10600] focus:ring-[#E10600]"
                  />
                  <span className="text-sm theme-text-secondary">Activo</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border theme-border rounded-lg theme-text-secondary hover:theme-bg-secondary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-[#E10600] text-white rounded-lg hover:bg-[#c00500] transition-colors disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : modalMode === 'create' ? 'Crear Plan' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
