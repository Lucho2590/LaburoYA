'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/services/api';
import { JOB_CATEGORIES, TRubro, getSuggestedSkills } from '@/config/constants';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { IJobOffer, IWorkerProfile } from '@/types';
import { Check, Plus, X, Users, Eye, MessageCircle, Clock } from 'lucide-react';

interface InterestedWorker extends IWorkerProfile {
  firstName?: string;
  lastName?: string;
  email?: string;
  hasBeenContacted: boolean;
}

interface DashboardOffer {
  id: string;
  rubro: string;
  puesto: string;
  description?: string;
  salary?: string;
  schedule?: string;
  zona?: string;
  businessName?: string;
  availability?: 'part-time' | 'full-time';
  requiredSkills?: string[];
  active: boolean;
  isExpired: boolean;
  durationDays: number;
  expiresAt?: string;
  createdAt?: string;
  stats: {
    interested: number;
    interestedNotContacted: number;
    candidates: number;
    matches: number;
  };
}

export default function EmployerJobsPage() {
  const router = useRouter();
  const { user, loading, authReady, getEffectiveAppRole } = useAuth();
  const { setPageConfig } = usePageTitle();
  const [jobs, setJobs] = useState<DashboardOffer[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<IJobOffer | null>(null);
  const [saving, setSaving] = useState(false);

  // Interested workers modal
  const [interestedModal, setInterestedModal] = useState<{ job: DashboardOffer; workers: InterestedWorker[] } | null>(null);
  const [loadingInterested, setLoadingInterested] = useState(false);
  const [contactingWorker, setContactingWorker] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    rubro: '',
    customRubro: '',
    puesto: '',
    customPuesto: '',
    description: '',
    salary: '',
    schedule: '',
    businessName: '',
    zona: '',
    availability: '' as '' | 'part-time' | 'full-time',
  });
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');

  const effectiveRole = getEffectiveAppRole();

  const resetForm = useCallback(() => {
    setFormData({ rubro: '', customRubro: '', puesto: '', customPuesto: '', description: '', salary: '', schedule: '', businessName: '', zona: '', availability: '' });
    setSelectedSkills([]);
    setCustomSkill('');
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
      const dashboard = await api.getEmployerDashboard();
      setJobs(dashboard.offers);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingJobs(false);
    }
  }, [user, authReady]);

  const openInterestedModal = async (job: DashboardOffer) => {
    setLoadingInterested(true);
    try {
      const data = await api.getOfferInterestedWorkers(job.id);
      setInterestedModal({ job, workers: data.interested });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar interesados');
    } finally {
      setLoadingInterested(false);
    }
  };

  const contactWorker = async (workerId: string) => {
    if (!interestedModal) return;

    setContactingWorker(workerId);
    try {
      const result = await api.sendEmployerToWorkerRequest(workerId, interestedModal.job.id);
      if (result.matchCreated) {
        toast.success('¡Match creado! Ya pueden chatear');
      } else {
        toast.success('Solicitud enviada');
      }
      // Update the worker's hasBeenContacted status in the modal
      setInterestedModal(prev => {
        if (!prev) return null;
        return {
          ...prev,
          workers: prev.workers.map(w =>
            w.uid === workerId ? { ...w, hasBeenContacted: true } : w
          )
        };
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar solicitud');
    } finally {
      setContactingWorker(null);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const availablePuestos = formData.rubro && formData.rubro !== 'otro'
    ? JOB_CATEGORIES[formData.rubro as TRubro]?.puestos || []
    : [];

  const handleEdit = (job: DashboardOffer) => {
    // Convert to IJobOffer-like for editing
    setEditingJob({
      id: job.id,
      employerId: '', // Not needed for edit
      rubro: job.rubro,
      puesto: job.puesto,
      description: job.description,
      salary: job.salary,
      schedule: job.schedule,
      zona: job.zona,
      active: job.active,
      requiredSkills: job.requiredSkills || [],
    });
    // Check if rubro is custom (not in JOB_CATEGORIES)
    const isCustomRubro = !JOB_CATEGORIES[job.rubro as TRubro];

    // Check if puesto is custom (not in available puestos)
    const category = JOB_CATEGORIES[job.rubro as TRubro];
    const availablePuestosForJob: readonly string[] = category?.puestos ?? [];
    const isCustomPuesto = isCustomRubro || !availablePuestosForJob.includes(job.puesto);

    setFormData({
      rubro: isCustomRubro ? 'otro' : job.rubro,
      customRubro: isCustomRubro ? job.rubro : '',
      puesto: isCustomPuesto ? 'otro' : job.puesto,
      customPuesto: isCustomPuesto ? job.puesto : '',
      description: job.description || '',
      salary: job.salary || '',
      schedule: job.schedule || '',
      businessName: job.businessName || '',
      zona: (job as DashboardOffer & { zona?: string }).zona || '',
      availability: ((job as DashboardOffer & { availability?: string }).availability || '') as '' | 'part-time' | 'full-time',
    });
    setSelectedSkills(job.requiredSkills || []);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const finalRubro = formData.rubro === 'otro' ? formData.customRubro : formData.rubro;
    const finalPuesto = formData.puesto === 'otro' ? formData.customPuesto : formData.puesto;

    if (!finalRubro || !finalPuesto) {
      toast.error('Seleccioná rubro y puesto');
      return;
    }

    setSaving(true);
    try {
      const offerData = {
        rubro: finalRubro,
        puesto: finalPuesto,
        description: formData.description || undefined,
        salary: formData.salary || undefined,
        schedule: formData.schedule || undefined,
        requiredSkills: selectedSkills.length > 0 ? selectedSkills : undefined,
        businessName: formData.businessName || undefined,
        zona: formData.zona || undefined,
        availability: formData.availability || undefined,
      };

      if (editingJob) {
        // Editar oferta existente
        await api.updateJobOffer(editingJob.id, offerData);
        toast.success('Oferta actualizada');
      } else {
        // Crear nueva oferta
        const result = await api.createJobOffer(offerData) as { newMatches: number };
        toast.success(`¡Oferta creada! ${result.newMatches} matches encontrados`);
      }
      resetForm();
      // Re-fetch in background without showing full-page spinner
      api.getEmployerDashboard().then(d => setJobs(d.offers)).catch(() => {});
    } catch {
      toast.error(editingJob ? 'Error al actualizar' : 'Error al crear la oferta');
    } finally {
      setSaving(false);
    }
  };

  const toggleJobStatus = async (jobId: string, currentStatus: boolean) => {
    try {
      await api.updateJobOffer(jobId, { active: !currentStatus });
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, active: !currentStatus } : j));
      toast.success(currentStatus ? 'Oferta pausada' : 'Oferta activada');
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      await api.deleteJobOffer(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      toast.success('Oferta eliminada');
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
        {/* Nombre del local */}
        <div>
          <label className="block text-sm font-medium theme-text-muted mb-2">
            Nombre del local / empresa (opcional)
          </label>
          <input
            type="text"
            value={formData.businessName}
            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
            placeholder="Ej: Café Central, Panadería Don José..."
            className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
          />
          <p className="text-xs theme-text-muted mt-1">
            Si reclutás para diferentes locales, podés cambiarlo en cada oferta
          </p>
        </div>

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
                onClick={() => setFormData({ ...formData, rubro: key, customRubro: '', puesto: '', customPuesto: '' })}
                className={`p-3 rounded-xl border-2 text-left transition-all active:scale-95 cursor-pointer ${
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
            {/* Otro rubro */}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, rubro: 'otro', puesto: 'otro', customPuesto: '' })}
              className={`p-3 rounded-xl border-2 text-left transition-all active:scale-95 cursor-pointer ${
                formData.rubro === 'otro'
                  ? 'border-[#E10600] bg-[#E10600]/10'
                  : 'theme-border theme-bg-card'
              }`}
            >
              <span className="text-xl">➕</span>
              <span className="font-medium theme-text-primary ml-2 text-sm">Otro</span>
            </button>
          </div>

          {/* Custom rubro input */}
          {formData.rubro === 'otro' && (
            <input
              type="text"
              value={formData.customRubro}
              onChange={(e) => setFormData({ ...formData, customRubro: e.target.value })}
              placeholder="Escribí el rubro..."
              className="w-full mt-3 p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
              autoFocus
            />
          )}
        </div>

        {/* Puesto */}
        {formData.rubro && (
          <div>
            <label className="block text-sm font-medium theme-text-muted mb-2">
              Puesto *
            </label>
            {/* Si el rubro es custom, solo mostrar input libre */}
            {formData.rubro === 'otro' ? (
              <input
                type="text"
                value={formData.customPuesto}
                onChange={(e) => setFormData({ ...formData, customPuesto: e.target.value })}
                placeholder="Escribí el puesto que buscás..."
                className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {availablePuestos.map((puesto) => (
                    <button
                      key={puesto}
                      type="button"
                      onClick={() => setFormData({ ...formData, puesto, customPuesto: '' })}
                      className={`px-4 py-2 rounded-full border-2 transition-all active:scale-95 cursor-pointer ${
                        formData.puesto === puesto
                          ? 'border-[#E10600] bg-[#E10600] text-white'
                          : 'theme-border theme-bg-card theme-text-secondary'
                      }`}
                    >
                      {puesto}
                    </button>
                  ))}
                  {/* Otro puesto */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, puesto: 'otro' })}
                    className={`px-4 py-2 rounded-full border-2 transition-all active:scale-95 cursor-pointer ${
                      formData.puesto === 'otro'
                        ? 'border-[#E10600] bg-[#E10600] text-white'
                        : 'theme-border theme-bg-card theme-text-secondary'
                    }`}
                  >
                    + Otro
                  </button>
                </div>

                {/* Custom puesto input */}
                {formData.puesto === 'otro' && (
                  <input
                    type="text"
                    value={formData.customPuesto}
                    onChange={(e) => setFormData({ ...formData, customPuesto: e.target.value })}
                    placeholder="Escribí el puesto que buscás..."
                    className="w-full mt-3 p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
                    autoFocus
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Required Skills */}
        {formData.rubro && (formData.puesto || formData.customPuesto) && (
          <div>
            <label className="block text-sm font-medium theme-text-muted mb-2">
              Habilidades requeridas
            </label>
            <p className="text-xs theme-text-muted mb-3">
              Seleccioná las habilidades que necesitás. Esto mejora el matching con candidatos.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {getSuggestedSkills(formData.rubro, formData.puesto === 'otro' ? formData.customPuesto : formData.puesto).map((skill) => {
                const isSelected = selectedSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedSkills(prev => prev.filter(s => s !== skill));
                      } else {
                        setSelectedSkills(prev => [...prev, skill]);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border-2 text-sm transition-all active:scale-95 ${
                      isSelected
                        ? 'border-[#E10600] bg-[#E10600] text-white'
                        : 'theme-border theme-bg-card theme-text-secondary'
                    }`}
                  >
                    {isSelected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {skill}
                  </button>
                );
              })}
            </div>

            {/* Add custom skill */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                placeholder="Agregar otra habilidad..."
                className="flex-1 p-3 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customSkill.trim()) {
                    e.preventDefault();
                    if (!selectedSkills.includes(customSkill.trim())) {
                      setSelectedSkills(prev => [...prev, customSkill.trim()]);
                    }
                    setCustomSkill('');
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (customSkill.trim() && !selectedSkills.includes(customSkill.trim())) {
                    setSelectedSkills(prev => [...prev, customSkill.trim()]);
                    setCustomSkill('');
                  }
                }}
                disabled={!customSkill.trim()}
                className="px-4 py-2 rounded-xl bg-[#E10600] text-white disabled:opacity-50 active:scale-95"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {/* Selected skills (including custom ones) */}
            {selectedSkills.length > 0 && (
              <div className="mt-3">
                <p className="text-xs theme-text-muted mb-2">
                  {selectedSkills.length} habilidad(es) seleccionada(s):
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedSkills.map(skill => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E10600] text-white text-sm"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => setSelectedSkills(prev => prev.filter(s => s !== skill))}
                        className="hover:bg-white/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
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

        {/* Zona / Barrio */}
        <div>
          <label className="block text-sm font-medium theme-text-muted mb-2">
            Barrio / Zona (opcional)
          </label>
          <input
            type="text"
            value={formData.zona}
            onChange={(e) => setFormData({ ...formData, zona: e.target.value })}
            placeholder="Ej: Centro, Güemes, Puerto..."
            className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
          />
        </div>

        {/* Availability */}
        <div>
          <label className="block text-sm font-medium theme-text-muted mb-2">
            Disponibilidad horaria (opcional)
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, availability: formData.availability === 'full-time' ? '' : 'full-time' })}
              className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all active:scale-95 cursor-pointer ${
                formData.availability === 'full-time'
                  ? 'border-[#E10600] bg-[#E10600] text-white'
                  : 'theme-border theme-bg-card theme-text-secondary'
              }`}
            >
              Full-time
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, availability: formData.availability === 'part-time' ? '' : 'part-time' })}
              className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all active:scale-95 cursor-pointer ${
                formData.availability === 'part-time'
                  ? 'border-[#E10600] bg-[#E10600] text-white'
                  : 'theme-border theme-bg-card theme-text-secondary'
              }`}
            >
              Part-time
            </button>
          </div>
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
          disabled={saving || !formData.rubro || (!formData.puesto && formData.rubro !== 'otro') || (formData.rubro === 'otro' && !formData.customRubro) || (formData.puesto === 'otro' && !formData.customPuesto) || (formData.rubro === 'otro' && !formData.customPuesto)}
          className="w-full bg-[#E10600] text-white py-4 rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform cursor-pointer"
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
            className="w-full py-3 theme-text-muted text-sm cursor-pointer"
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
        className="w-full bg-[#E10600] text-white py-4 rounded-xl font-semibold mb-6 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold theme-text-primary">{job.puesto}</h3>
                      {job.isExpired ? (
                        <Badge className="text-xs bg-gray-500">Expirada</Badge>
                      ) : !job.active ? (
                        <Badge variant="secondary" className="text-xs">Pausada</Badge>
                      ) : (
                        <Badge className="text-xs bg-[#12B76A]">Activa</Badge>
                      )}
                    </div>
                    <p className="theme-text-secondary text-sm mt-1">
                      {JOB_CATEGORIES[job.rubro as TRubro]?.label || job.rubro}
                      {job.businessName && ` • ${job.businessName}`}
                    </p>
                    {(job.salary || job.schedule) && (
                      <p className="theme-text-muted text-sm mt-1">
                        {job.salary && `💰 ${job.salary}`}
                        {job.salary && job.schedule && ' • '}
                        {job.schedule && `🕐 ${job.schedule}`}
                      </p>
                    )}
                  </div>
                  {/* Time remaining */}
                  {job.expiresAt && !job.isExpired && job.active && (
                    <div className="flex items-center gap-1 text-xs theme-text-muted ml-2">
                      <Clock className="w-3 h-3" />
                      {(() => {
                        const now = new Date();
                        const expires = new Date(job.expiresAt);
                        const diffMs = expires.getTime() - now.getTime();
                        if (diffMs <= 0) return 'Expirada';
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffDays = Math.floor(diffHours / 24);
                        return diffDays > 0 ? `${diffDays}d` : `${diffHours}h`;
                      })()}
                    </div>
                  )}
                </div>

                {/* Stats row */}
                <div className="mt-3 flex items-center gap-3 text-sm">
                  {/* Interested */}
                  {job.stats.interested > 0 ? (
                    <button
                      onClick={() => openInterestedModal(job)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg active:scale-95 transition-transform ${
                        job.stats.interestedNotContacted > 0
                          ? 'bg-[#E10600]/10 text-[#E10600]'
                          : 'theme-bg-secondary theme-text-secondary'
                      }`}
                    >
                      <Users className="h-4 w-4" />
                      <span className="font-medium">{job.stats.interested}</span>
                      {job.stats.interestedNotContacted > 0 && (
                        <Badge variant="destructive" className="text-xs bg-[#E10600] ml-0.5">
                          {job.stats.interestedNotContacted} nuevo{job.stats.interestedNotContacted !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 theme-text-muted">
                      <Users className="h-4 w-4" />
                      <span>0</span>
                    </div>
                  )}

                  {/* Candidates */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 theme-text-muted">
                    <Eye className="h-4 w-4" />
                    <span>{job.stats.candidates} candidato{job.stats.candidates !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Matches */}
                  {job.stats.matches > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 text-[#12B76A]">
                      <MessageCircle className="h-4 w-4" />
                      <span className="font-medium">{job.stats.matches}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex border-t theme-border">
                <button
                  onClick={() => handleEdit(job)}
                  className="flex-1 py-3 theme-text-secondary text-sm font-medium active:theme-bg-secondary cursor-pointer"
                >
                  ✏️ Editar
                </button>
                <div className="w-px theme-bg-secondary" />
                <button
                  onClick={() => toggleJobStatus(job.id, job.active)}
                  className="flex-1 py-3 theme-text-secondary text-sm font-medium active:theme-bg-secondary cursor-pointer"
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
                  className="flex-1 py-3 text-[#E10600] text-sm font-medium active:bg-[#E10600]/10 cursor-pointer"
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Interesados */}
      {interestedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="theme-bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b theme-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold theme-text-primary">Interesados</h3>
                <p className="text-sm theme-text-muted">
                  {interestedModal.job.puesto} - {interestedModal.workers.length} persona{interestedModal.workers.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setInterestedModal(null)}
                className="p-2 rounded-full theme-bg-secondary active:scale-95"
              >
                <X className="h-5 w-5 theme-text-primary" />
              </button>
            </div>

            {/* Workers list */}
            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-3">
              {loadingInterested ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]"></div>
                </div>
              ) : interestedModal.workers.length === 0 ? (
                <p className="text-center theme-text-muted py-8">
                  No hay interesados todavia
                </p>
              ) : (
                interestedModal.workers.map((worker) => (
                  <div
                    key={worker.uid}
                    className="theme-bg-secondary rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      {/* Photo */}
                      <div className="w-12 h-12 rounded-full bg-[#E10600]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {worker.photoUrl ? (
                          <img
                            src={worker.photoUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xl">👤</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium theme-text-primary truncate">
                            {worker.firstName && worker.lastName
                              ? `${worker.firstName} ${worker.lastName}`
                              : worker.puesto}
                          </h4>
                          {worker.hasBeenContacted && (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              Contactado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm theme-text-secondary truncate">
                          {worker.puesto} • {worker.rubro}
                        </p>
                        {worker.zona && (
                          <p className="text-xs theme-text-muted mt-1">
                            📍 {worker.zona}
                          </p>
                        )}
                        {worker.skills && worker.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {worker.skills.slice(0, 3).map(skill => (
                              <span
                                key={skill}
                                className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-xs theme-text-secondary"
                              >
                                {skill}
                              </span>
                            ))}
                            {worker.skills.length > 3 && (
                              <span className="text-xs theme-text-muted">
                                +{worker.skills.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contact button */}
                    {!worker.hasBeenContacted && (
                      <button
                        onClick={() => contactWorker(worker.uid!)}
                        disabled={contactingWorker === worker.uid}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#E10600] text-white font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
                      >
                        {contactingWorker === worker.uid ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Enviando...
                          </>
                        ) : (
                          <>
                            <MessageCircle className="h-4 w-4" />
                            Contactar
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
