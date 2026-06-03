'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/services/api';
import { JOB_CATEGORIES, TRubro, getSuggestedSkills } from '@/config/constants';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { IJobOffer, IWorkerProfile, IAssessCvResponse, IPinnedCandidate } from '@/types';
import { Check, Plus, X, Users, Eye, MessageCircle, Clock, FileSearch, Upload, Loader2, Sparkles, Pin, Trash2 } from 'lucide-react';

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
    pinned?: number;
  };
}

interface AssessItem {
  id: string;
  file: File;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: IAssessCvResponse;
  error?: string;
  pinned?: boolean;
  pinning?: boolean;
}

const MAX_CVS = 5;

export default function EmployerJobsPage() {
  const router = useRouter();
  const { user, userData, loading, authReady, getEffectiveAppRole } = useAuth();
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

  // CV assessment modal (up to 5 CVs, evaluated one by one)
  const [assessModal, setAssessModal] = useState<{ job: DashboardOffer } | null>(null);
  const [assessItems, setAssessItems] = useState<AssessItem[]>([]);
  const [assessRunning, setAssessRunning] = useState(false);

  // Pinned candidates modal
  const [pinnedModal, setPinnedModal] = useState<{ job: DashboardOffer; items: IPinnedCandidate[] } | null>(null);
  const [loadingPinned, setLoadingPinned] = useState(false);

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
  const aiOn = !!userData?.aiCvEnabled;

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

  const openAssessModal = (job: DashboardOffer) => {
    setAssessModal({ job });
    setAssessItems([]);
    setAssessRunning(false);
  };

  const closeAssessModal = () => {
    setAssessModal(null);
    setAssessItems([]);
    setAssessRunning(false);
  };

  const isAllowedCvFile = (file: File) => {
    const allowedMime = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const ext = file.name.toLowerCase().split('.').pop() || '';
    const allowedExt = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];
    return allowedMime.includes(file.type) || allowedExt.includes(ext);
  };

  const handleAssessFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-picking the same file
    if (picked.length === 0) return;

    const valid: File[] = [];
    for (const file of picked) {
      if (!isAllowedCvFile(file)) {
        toast.error(`${file.name}: formato no soportado`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: supera el límite de 5MB`);
        continue;
      }
      valid.push(file);
    }

    setAssessItems((prev) => {
      const room = MAX_CVS - prev.length;
      if (room <= 0) {
        toast.error(`Máximo ${MAX_CVS} CVs`);
        return prev;
      }
      if (valid.length > room) {
        toast.error(`Máximo ${MAX_CVS} CVs (se agregaron ${room})`);
      }
      const toAdd = valid.slice(0, room).map((file, i) => ({
        id: `${file.name}-${file.size}-${prev.length + i}`,
        file,
        status: 'pending' as const,
      }));
      return [...prev, ...toAdd];
    });
  };

  const removeAssessItem = (id: string) => {
    setAssessItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateItem = (id: string, patch: Partial<AssessItem>) => {
    setAssessItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const runAssessment = async () => {
    if (!assessModal) return;
    setAssessRunning(true);
    // Snapshot of items to process (those not yet done) — evaluate one by one.
    const pending = assessItems.filter((it) => it.status === 'pending' || it.status === 'error');
    for (const item of pending) {
      updateItem(item.id, { status: 'running', error: undefined });
      try {
        const result = await api.assessOfferCv(assessModal.job.id, item.file);
        updateItem(item.id, { status: 'done', result });
      } catch (error) {
        updateItem(item.id, { status: 'error', error: error instanceof Error ? error.message : 'Error al evaluar el CV' });
      }
    }
    setAssessRunning(false);
  };

  const pinItem = async (item: AssessItem) => {
    if (!assessModal || !item.result) return;
    updateItem(item.id, { pinning: true });
    try {
      await api.pinCandidate(assessModal.job.id, {
        candidate: item.result.candidate,
        assessment: {
          ...item.result.assessment,
          mode: item.result.mode,
          stars: matchStars(item.result),
        },
      });
      updateItem(item.id, { pinned: true, pinning: false });
      toast.success('Candidato fijado a la oferta');
      fetchJobs();
    } catch (error) {
      updateItem(item.id, { pinning: false });
      toast.error(error instanceof Error ? error.message : 'Error al fijar el candidato');
    }
  };

  const openPinnedModal = async (job: DashboardOffer) => {
    setPinnedModal({ job, items: [] });
    setLoadingPinned(true);
    try {
      const { pinned } = await api.getPinnedCandidates(job.id);
      setPinnedModal({ job, items: pinned });
    } catch {
      toast.error('No se pudieron cargar los candidatos fijados');
      setPinnedModal(null);
    } finally {
      setLoadingPinned(false);
    }
  };

  const removePin = async (pinId: string) => {
    if (!pinnedModal) return;
    try {
      await api.deletePinnedCandidate(pinnedModal.job.id, pinId);
      setPinnedModal({ ...pinnedModal, items: pinnedModal.items.filter(p => p.id !== pinId) });
      fetchJobs();
    } catch {
      toast.error('No se pudo quitar el candidato');
    }
  };

  const RECOMMENDATION: Record<string, { label: string; cls: string }> = {
    yes: { label: 'Recomendado', cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    maybe: { label: 'A revisar', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
    no: { label: 'No recomendado', cls: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  };

  const MATCH_LABELS: Record<string, string> = {
    full_match: 'Match completo',
    partial_match: 'Match parcial',
    skills_match: 'Match por skills',
  };

  // Catalogación por estrellas, misma lógica que el match de perfiles en la app
  // (full=3, partial=2, skills=1). En modo IA se deriva del puntaje 0-100.
  const matchStars = (r: IAssessCvResponse): number => {
    if (r.mode === 'ai') {
      const s = r.assessment.score;
      return s >= 75 ? 3 : s >= 50 ? 2 : s > 0 ? 1 : 0;
    }
    const mt = r.assessment.matchType;
    return mt === 'full_match' ? 3 : mt === 'partial_match' ? 2 : mt === 'skills_match' ? 1 : 0;
  };

  const renderStars = (level: number) => (
    <span className="text-lg leading-none">
      <span className="text-yellow-500">{'★'.repeat(level)}</span>
      <span className="text-gray-400">{'☆'.repeat(3 - level)}</span>
    </span>
  );

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

                  {/* Pinned candidates */}
                  {(job.stats.pinned ?? 0) > 0 && (
                    <button
                      onClick={() => openPinnedModal(job)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[#7C3AED] bg-[#7C3AED]/10 active:scale-95 transition-transform cursor-pointer"
                    >
                      <Pin className="h-4 w-4" />
                      <span className="font-medium">{job.stats.pinned}</span>
                    </button>
                  )}

                  {/* Evaluar CV (delicado, alineado a la derecha) */}
                  <button
                    onClick={() => openAssessModal(job)}
                    className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition active:scale-95 cursor-pointer ${
                      aiOn
                        ? 'bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/15'
                        : 'theme-bg-secondary theme-text-secondary hover:opacity-80'
                    }`}
                  >
                    {aiOn ? <Sparkles className="h-3.5 w-3.5" /> : <FileSearch className="h-3.5 w-3.5" />}
                    {aiOn ? 'Evaluar CV ✨' : 'Evaluar CV'}
                  </button>
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

      {/* Modal Evaluar CV */}
      {assessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="theme-bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b theme-border">
              <div>
                <h3 className="font-semibold theme-text-primary flex items-center gap-2">
                  {aiOn ? <Sparkles className="h-5 w-5 text-[#7C3AED]" /> : <FileSearch className="h-5 w-5 text-[#7C3AED]" />}
                  {aiOn ? 'Evaluar CV con IA' : 'Evaluar CV'}
                </h3>
                <p className="text-sm theme-text-muted">{assessModal.job.puesto}</p>
              </div>
              <button onClick={closeAssessModal} className="p-1 active:theme-bg-secondary rounded-lg cursor-pointer">
                <X className="h-5 w-5 theme-text-secondary" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* File picker (hasta 5) */}
              <label className="block">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleAssessFilesChange}
                  className="hidden"
                  disabled={assessRunning || assessItems.length >= MAX_CVS}
                />
                <div className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed theme-border text-sm ${assessRunning || assessItems.length >= MAX_CVS ? 'opacity-50' : 'hover:border-[#7C3AED] cursor-pointer'} theme-text-secondary`}>
                  <Upload className="h-4 w-4" />
                  {assessItems.length >= MAX_CVS
                    ? `Máximo ${MAX_CVS} CVs (${assessItems.length}/${MAX_CVS})`
                    : assessItems.length > 0
                      ? `Agregar más CVs (${assessItems.length}/${MAX_CVS})`
                      : `Subí hasta ${MAX_CVS} CVs (PDF, JPG/PNG o .docx) — máx 5MB c/u`}
                </div>
              </label>

              {/* Items list */}
              {assessItems.map((item) => (
                <div key={item.id} className="border theme-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium theme-text-primary truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-[#7C3AED]" />}
                      {item.status === 'pending' && <span className="text-xs theme-text-muted">Pendiente</span>}
                      {item.status === 'done' && <Check className="h-4 w-4 text-green-600" />}
                      {item.status === 'error' && <span className="text-xs text-[#E10600]">Error</span>}
                      {!assessRunning && item.status !== 'running' && (
                        <button onClick={() => removeAssessItem(item.id)} className="p-1 active:theme-bg-secondary rounded-lg cursor-pointer" title="Quitar">
                          <X className="h-4 w-4 theme-text-secondary" />
                        </button>
                      )}
                    </div>
                  </div>

                  {item.status === 'error' && (
                    <p className="text-xs text-[#E10600]">{item.error}</p>
                  )}

                  {item.status === 'done' && item.result && (
                    <div className="space-y-3 pt-1">
                      {/* Score + verdict */}
                      <div className="flex items-center gap-4 p-3 rounded-xl theme-bg-secondary">
                        <div className="flex flex-col">
                          <div className="text-2xl font-bold theme-text-primary leading-none">
                            {item.result.assessment.score}
                            <span className="text-sm theme-text-muted">{item.result.mode === 'ai' ? '%' : ' pts'}</span>
                          </div>
                          <div className="mt-1">{renderStars(matchStars(item.result))}</div>
                        </div>
                        {item.result.mode === 'ai' && item.result.assessment.recommendation ? (
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${RECOMMENDATION[item.result.assessment.recommendation]?.cls || ''}`}>
                            {RECOMMENDATION[item.result.assessment.recommendation]?.label}
                          </span>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {item.result.assessment.matchType ? MATCH_LABELS[item.result.assessment.matchType] : 'Sin coincidencia'}
                          </Badge>
                        )}
                      </div>

                      {/* Candidate summary */}
                      <div className="text-sm theme-text-secondary space-y-1">
                        <p><span className="theme-text-muted">Candidato:</span> {[item.result.candidate.firstName, item.result.candidate.lastName].filter(Boolean).join(' ') || '—'}</p>
                        {item.result.candidate.email && <p><span className="theme-text-muted">Email:</span> {item.result.candidate.email}</p>}
                        {item.result.candidate.phone && <p><span className="theme-text-muted">Teléfono:</span> {item.result.candidate.phone}</p>}
                      </div>

                      {/* AI verdict */}
                      {item.result.mode === 'ai' && item.result.assessment.summary && (
                        <p className="text-sm theme-text-primary">{item.result.assessment.summary}</p>
                      )}
                      {item.result.mode === 'ai' && (item.result.assessment.strengths?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs theme-text-muted mb-1">Fortalezas</p>
                          <ul className="text-sm theme-text-secondary list-disc pl-5 space-y-0.5">
                            {item.result.assessment.strengths!.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                      {item.result.mode === 'ai' && (item.result.assessment.gaps?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs theme-text-muted mb-1">Brechas / a tener en cuenta</p>
                          <ul className="text-sm theme-text-secondary list-disc pl-5 space-y-0.5">
                            {item.result.assessment.gaps!.map((g, i) => <li key={i}>{g}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Skills */}
                      {item.result.assessment.matchingSkills.length > 0 && (
                        <div>
                          <p className="text-xs theme-text-muted mb-1">Skills coincidentes</p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.result.assessment.matchingSkills.map((s) => (
                              <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.result.assessment.missingSkills.length > 0 && (
                        <div>
                          <p className="text-xs theme-text-muted mb-1">Skills que pide la oferta y faltan</p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.result.assessment.missingSkills.map((s) => (
                              <span key={s} className="text-xs px-2 py-0.5 rounded-full theme-bg-secondary theme-text-muted">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fijar */}
                      <button
                        onClick={() => pinItem(item)}
                        disabled={item.pinning || item.pinned}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer disabled:opacity-70 ${
                          item.pinned
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-[#7C3AED] text-white hover:opacity-90 active:scale-[0.99]'
                        }`}
                      >
                        {item.pinned ? <Check className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        {item.pinning ? 'Fijando...' : item.pinned ? 'Fijado a la oferta' : '📌 Fijar a esta oferta'}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Evaluar */}
              {(() => {
                const pendingCount = assessItems.filter((i) => i.status === 'pending' || i.status === 'error').length;
                return (
                  <button
                    onClick={runAssessment}
                    disabled={assessRunning || pendingCount === 0}
                    className="w-full py-3 rounded-xl bg-[#7C3AED] text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {assessRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analizando...
                      </>
                    ) : (
                      `Evaluar${pendingCount > 0 ? ` (${pendingCount})` : ''}`
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Candidatos fijados */}
      {pinnedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="theme-bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b theme-border">
              <div>
                <h3 className="font-semibold theme-text-primary flex items-center gap-2">
                  <Pin className="h-5 w-5 text-[#7C3AED]" />
                  Candidatos fijados
                </h3>
                <p className="text-sm theme-text-muted">{pinnedModal.job.puesto}</p>
              </div>
              <button onClick={() => setPinnedModal(null)} className="p-1 active:theme-bg-secondary rounded-lg cursor-pointer">
                <X className="h-5 w-5 theme-text-secondary" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {loadingPinned ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#7C3AED]" /></div>
              ) : pinnedModal.items.length === 0 ? (
                <p className="text-sm theme-text-muted text-center py-8">Todavía no fijaste candidatos a esta oferta.</p>
              ) : (
                pinnedModal.items.map((p) => (
                  <div key={p.id} className="border theme-border rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium theme-text-primary truncate">
                          {[p.candidate.firstName, p.candidate.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
                        </p>
                        {p.candidate.email && <p className="text-xs theme-text-muted truncate">{p.candidate.email}</p>}
                        {p.candidate.phone && <p className="text-xs theme-text-muted">{p.candidate.phone}</p>}
                      </div>
                      <button
                        onClick={() => removePin(p.id)}
                        className="p-2 text-[#E10600] hover:bg-[#E10600]/10 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Quitar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-bold theme-text-primary">
                        {p.assessment.score}{p.assessment.mode === 'ai' ? '%' : ' pts'}
                      </span>
                      {renderStars(p.assessment.stars ?? 0)}
                      {p.assessment.mode === 'ai' && p.assessment.recommendation && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RECOMMENDATION[p.assessment.recommendation]?.cls || ''}`}>
                          {RECOMMENDATION[p.assessment.recommendation]?.label}
                        </span>
                      )}
                      {p.assessment.mode === 'basic' && p.assessment.matchType && (
                        <Badge variant="secondary" className="text-xs">{MATCH_LABELS[p.assessment.matchType]}</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
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
