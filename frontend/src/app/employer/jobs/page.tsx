'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { JOB_CATEGORIES, Rubro } from '@/config/constants';
import { MobileLayout } from '@/components/MobileLayout';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { JobOffer } from '@/types';

export default function EmployerJobsPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    rubro: '',
    puesto: '',
    description: '',
    salary: '',
    schedule: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && userData?.role !== 'employer') {
      router.push('/home');
    }
  }, [loading, user, userData, router]);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const data = await api.getMyJobOffers() as JobOffer[];
      setJobs(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingJobs(false);
    }
  };

  const availablePuestos = formData.rubro
    ? JOB_CATEGORIES[formData.rubro as Rubro]?.puestos || []
    : [];

  const handleSubmit = async () => {
    if (!formData.rubro || !formData.puesto) {
      toast.error('Seleccioná rubro y puesto');
      return;
    }

    setSaving(true);
    try {
      const result = await api.createJobOffer(formData) as { newMatches: number };
      toast.success(`¡Oferta creada! ${result.newMatches} matches encontrados`);
      setShowForm(false);
      setFormData({ rubro: '', puesto: '', description: '', salary: '', schedule: '' });
      fetchJobs();
    } catch (error) {
      toast.error('Error al crear la oferta');
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

  // Create form view
  if (showForm) {
    return (
      <MobileLayout title="Nueva Oferta" showBack backHref="/employer/jobs">
        <div className="px-4 py-6 space-y-6">
          {/* Rubro */}
          <div>
            <label className="block text-sm font-medium text-[#98A2B3] mb-2">
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
                      : 'border-[#344054] bg-[#1F2937]'
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
                  <span className="font-medium text-white ml-2 text-sm">{value.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Puesto */}
          {formData.rubro && (
            <div>
              <label className="block text-sm font-medium text-[#98A2B3] mb-2">
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
                        : 'border-[#344054] bg-[#1F2937] text-[#98A2B3]'
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
            <label className="block text-sm font-medium text-[#98A2B3] mb-2">
              Salario (opcional)
            </label>
            <input
              type="text"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              placeholder="Ej: $500.000 mensuales"
              className="w-full p-4 rounded-xl border-2 border-[#344054] bg-[#1F2937] text-white placeholder-[#667085] focus:border-[#E10600] focus:outline-none"
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-[#98A2B3] mb-2">
              Horario (opcional)
            </label>
            <input
              type="text"
              value={formData.schedule}
              onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
              placeholder="Ej: Lun-Vie 9 a 18hs"
              className="w-full p-4 rounded-xl border-2 border-[#344054] bg-[#1F2937] text-white placeholder-[#667085] focus:border-[#E10600] focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#98A2B3] mb-2">
              Descripción (opcional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describí las tareas del puesto..."
              rows={3}
              className="w-full p-4 rounded-xl border-2 border-[#344054] bg-[#1F2937] text-white placeholder-[#667085] focus:border-[#E10600] focus:outline-none resize-none"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving || !formData.rubro || !formData.puesto}
            className="w-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {saving ? 'Publicando...' : 'Publicar oferta'}
          </button>
        </div>
      </MobileLayout>
    );
  }

  // List view
  return (
    <MobileLayout title="Mis Ofertas">
      <div className="px-4 py-4">
        {/* Add Button */}
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold mb-6 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nueva oferta
        </button>

        {jobs.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl">📋</span>
            <p className="text-[#98A2B3] mt-4">No tenés ofertas publicadas</p>
            <p className="text-[#667085] text-sm mt-1">
              Creá tu primera oferta para encontrar candidatos
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="bg-[#1F2937] rounded-2xl border border-[#344054] overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{job.puesto}</h3>
                        <Badge
                          variant={job.active ? 'default' : 'secondary'}
                          className={`text-xs ${job.active ? 'bg-[#12B76A] text-white' : 'bg-[#344054] text-[#98A2B3]'}`}
                        >
                          {job.active ? 'Activa' : 'Pausada'}
                        </Badge>
                      </div>
                      <p className="text-[#98A2B3] text-sm mt-1">
                        {JOB_CATEGORIES[job.rubro as Rubro]?.label || job.rubro}
                      </p>
                      {(job.salary || job.schedule) && (
                        <p className="text-[#667085] text-sm mt-1">
                          {job.salary && `💰 ${job.salary}`}
                          {job.salary && job.schedule && ' • '}
                          {job.schedule && `🕐 ${job.schedule}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex border-t border-[#344054]">
                  <button
                    onClick={() => toggleJobStatus(job.id, job.active)}
                    className="flex-1 py-3 text-[#98A2B3] text-sm font-medium active:bg-[#111827]"
                  >
                    {job.active ? '⏸️ Pausar' : '▶️ Activar'}
                  </button>
                  <div className="w-px bg-[#344054]" />
                  <button
                    onClick={() => {
                      if (confirm('¿Eliminar esta oferta?')) {
                        deleteJob(job.id);
                      }
                    }}
                    className="flex-1 py-3 text-[#E10600] text-sm font-medium active:bg-[#E10600]/10"
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
