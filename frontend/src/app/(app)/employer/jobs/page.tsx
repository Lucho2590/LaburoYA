'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/services/api';
import { JOB_CATEGORIES, TRubro } from '@/config/constants';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { IJobOffer } from '@/types';

export default function EmployerJobsPage() {
  const router = useRouter();
  const { user, loading, authReady, getEffectiveAppRole } = useAuth();
  const { setPageConfig } = usePageTitle();
  const [jobs, setJobs] = useState<IJobOffer[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<IJobOffer | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    rubro: '',
    puesto: '',
    description: '',
    salary: '',
    schedule: '',
  });

  const effectiveRole = getEffectiveAppRole();

  const resetForm = useCallback(() => {
    setFormData({ rubro: '', puesto: '', description: '', salary: '', schedule: '' });
    setEditingJob(null);
    setShowForm(false);
  }, []);

  // Set page config based on current view
  useEffect(() => {
    if (showForm) {
      setPageConfig({
        title: editingJob ? 'Editar Oferta' : 'Nueva Oferta',
        showBack: true,
        onBack: resetForm
      });
    } else {
      setPageConfig({
        title: 'Mis Ofertas',
        showBack: true,
        backHref: '/home',
        onBack: undefined
      });
    }
  }, [setPageConfig, showForm, editingJob, resetForm]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && effectiveRole !== 'employer') {
      router.push('/home');
    }
  }, [loading, user, effectiveRole, router]);

  const fetchJobs = useCallback(async () => {
    if (!user || !authReady) return;

    try {
      setLoadingJobs(true);
      const data = await api.getMyJobOffers() as IJobOffer[];
      setJobs(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingJobs(false);
    }
  }, [user, authReady]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const availablePuestos = formData.rubro
    ? JOB_CATEGORIES[formData.rubro as TRubro]?.puestos || []
    : [];

  const handleEdit = (job: IJobOffer) => {
    setEditingJob(job);
    setFormData({
      rubro: job.rubro,
      puesto: job.puesto,
      description: job.description || '',
      salary: job.salary || '',
      schedule: job.schedule || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.rubro || !formData.puesto) {
      toast.error('Seleccioná rubro y puesto');
      return;
    }

    setSaving(true);
    try {
      if (editingJob) {
        // Editar oferta existente
        await api.updateJobOffer(editingJob.id, {
          rubro: formData.rubro,
          puesto: formData.puesto,
          description: formData.description || undefined,
          salary: formData.salary || undefined,
          schedule: formData.schedule || undefined,
        });
        toast.success('Oferta actualizada');
      } else {
        // Crear nueva oferta
        const result = await api.createJobOffer(formData) as { newMatches: number };
        toast.success(`¡Oferta creada! ${result.newMatches} matches encontrados`);
      }
      resetForm();
      fetchJobs();
    } catch {
      toast.error(editingJob ? 'Error al actualizar' : 'Error al crear la oferta');
    } finally {
      setSaving(false);
    }
  };

  const toggleJobStatus = async (jobId: string, currentStatus: boolean) => {
    try {
      await api.updateJobOffer(jobId, { active: !currentStatus });
      toast.success(currentStatus ? 'Oferta pausada' : 'Oferta activada');
      fetchJobs();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      await api.deleteJobOffer(jobId);
      toast.success('Oferta eliminada');
      fetchJobs();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  if (loading || loadingJobs) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  // Create/Edit form view
  if (showForm) {
    return (
      <div className="px-4 py-6 space-y-6">
        {/* Rubro */}
        <div>
          <label className="block text-sm font-medium theme-text-muted mb-2">
            Rubro *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(JOB_CATEGORIES).map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFormData({ ...formData, rubro: key, puesto: '' })}
                className={`p-3 rounded-xl border-2 text-left transition-all active:scale-95 ${
                  formData.rubro === key
                    ? 'border-[#E10600] bg-[#E10600]/10'
                    : 'theme-border theme-bg-card'
                }`}
              >
                <span className="text-xl">
                  {key === 'gastronomia' && '🍳'}
                  {key === 'comercio' && '🏪'}
                  {key === 'construccion' && '🏗️'}
                  {key === 'limpieza' && '🧹'}
                  {key === 'transporte' && '🚗'}
                  {key === 'administracion' && '💼'}
                </span>
                <span className="font-medium theme-text-primary ml-2 text-sm">{value.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Puesto */}
        {formData.rubro && (
          <div>
            <label className="block text-sm font-medium theme-text-muted mb-2">
              Puesto *
            </label>
            <div className="flex flex-wrap gap-2">
              {availablePuestos.map((puesto) => (
                <button
                  key={puesto}
                  type="button"
                  onClick={() => setFormData({ ...formData, puesto })}
                  className={`px-4 py-2 rounded-full border-2 transition-all active:scale-95 ${
                    formData.puesto === puesto
                      ? 'border-[#E10600] bg-[#E10600] text-white'
                      : 'theme-border theme-bg-card theme-text-secondary'
                  }`}
                >
                  {puesto}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Salary */}
        <div>
          <label className="block text-sm font-medium theme-text-muted mb-2">
            Salario (opcional)
          </label>
          <input
            type="text"
            value={formData.salary}
            onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
            placeholder="Ej: $500.000 mensuales"
            className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
          />
        </div>

        {/* Schedule */}
        <div>
          <label className="block text-sm font-medium theme-text-muted mb-2">
            Horario (opcional)
          </label>
          <input
            type="text"
            value={formData.schedule}
            onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
            placeholder="Ej: Lun-Vie 9 a 18hs"
            className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium theme-text-muted mb-2">
            Descripción (opcional)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describí las tareas del puesto..."
            rows={3}
            className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none resize-none"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving || !formData.rubro || !formData.puesto}
          className="w-full bg-[#E10600] text-white py-4 rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {saving
            ? (editingJob ? 'Guardando...' : 'Publicando...')
            : (editingJob ? 'Guardar cambios' : 'Publicar oferta')
          }
        </button>

        {/* Cancel button for edit mode */}
        {editingJob && (
          <button
            onClick={resetForm}
            className="w-full py-3 theme-text-muted text-sm"
          >
            Cancelar
          </button>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="px-4 py-4">
      {/* Add Button */}
      <button
        onClick={() => setShowForm(true)}
        className="w-full bg-[#E10600] text-white py-4 rounded-xl font-semibold mb-6 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Nueva oferta
      </button>

      {jobs.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-5xl">📋</span>
          <p className="theme-text-secondary mt-4">No tenés ofertas publicadas</p>
          <p className="theme-text-muted text-sm mt-1">
            Creá tu primera oferta para encontrar candidatos
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="theme-bg-card rounded-2xl border theme-border overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold theme-text-primary">{job.puesto}</h3>
                      <Badge
                        variant={job.active ? 'default' : 'secondary'}
                        className={`text-xs ${job.active ? 'bg-[#12B76A] text-white' : 'theme-bg-secondary theme-text-muted'}`}
                      >
                        {job.active ? 'Activa' : 'Pausada'}
                      </Badge>
                    </div>
                    <p className="theme-text-secondary text-sm mt-1">
                      {JOB_CATEGORIES[job.rubro as TRubro]?.label || job.rubro}
                    </p>
                    {(job.salary || job.schedule) && (
                      <p className="theme-text-muted text-sm mt-1">
                        {job.salary && `💰 ${job.salary}`}
                        {job.salary && job.schedule && ' • '}
                        {job.schedule && `🕐 ${job.schedule}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex border-t theme-border">
                <button
                  onClick={() => handleEdit(job)}
                  className="flex-1 py-3 theme-text-secondary text-sm font-medium active:theme-bg-secondary"
                >
                  ✏️ Editar
                </button>
                <div className="w-px theme-bg-secondary" />
                <button
                  onClick={() => toggleJobStatus(job.id, job.active)}
                  className="flex-1 py-3 theme-text-secondary text-sm font-medium active:theme-bg-secondary"
                >
                  {job.active ? '⏸️ Pausar' : '▶️ Activar'}
                </button>
                <div className="w-px theme-bg-secondary" />
                <button
                  onClick={() => {
                    if (confirm('¿Eliminar esta oferta?')) {
                      deleteJob(job.id);
                    }
                  }}
                  className="flex-1 py-3 text-[#E10600] text-sm font-medium active:bg-[#E10600]/10"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
