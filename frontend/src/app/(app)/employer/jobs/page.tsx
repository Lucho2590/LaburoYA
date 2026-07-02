'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/services/api';
import { JOB_CATEGORIES, ZONAS_MDP, TRubro, getSuggestedSkills } from '@/config/constants';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { IJobOffer, IWorkerProfile, IAssessCvResponse, IPinnedCandidate, IGeoLocation, ICity } from '@/types';
import { scoreToStars, STAR_MAX, STAR_FILTERS } from '@/lib/stars';
import { haversineKm, getBrowserLocation } from '@/lib/geo';
import LocationPicker from '@/components/LocationPicker';
import { Check, Plus, X, Users, Eye, MessageCircle, Clock, FileSearch, Upload, Loader2, Sparkles, Trophy, Trash2, Star, ChevronDown, ChevronUp, Columns2, AlertTriangle, RotateCcw, MapPin } from 'lucide-react';

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
  aiAssessEnabled?: boolean;
  aiUsage?: { cvCount: number; inputTokens: number; outputTokens: number; costUsd: number };
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
  hash?: string;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: IAssessCvResponse;
  error?: string;
}

const MAX_CVS = 20;
const AI_PACING_MS = 1200; // espaciado entre llamadas de IA para no gatillar el rate-limit

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatUsd = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

// SHA-256 hex of a file (Web Crypto) — used to detect the same file twice.
async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
  const [pinnedMinStars, setPinnedMinStars] = useState(0);
  const [pinnedOnlySelected, setPinnedOnlySelected] = useState(false);
  const [expandedRank, setExpandedRank] = useState<string | null>(null);
  const [compareGroup, setCompareGroup] = useState<IPinnedCandidate[] | null>(null);

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
  const [location, setLocation] = useState<IGeoLocation | null>(null);
  const [cities, setCities] = useState<ICity[]>([]);
  const [citiesError, setCitiesError] = useState(false);
  const [cityName, setCityName] = useState('');
  // Radio de búsqueda propio de la oferta (null = usar el radio de la ciudad).
  const [offerRadius, setOfferRadius] = useState<number | null>(null);

  const effectiveRole = getEffectiveAppRole();
  const aiOn = !!userData?.aiCvEnabled;

  const resetForm = useCallback(() => {
    setFormData({ rubro: '', customRubro: '', puesto: '', customPuesto: '', description: '', salary: '', schedule: '', businessName: '', zona: '', availability: '' });
    setSelectedSkills([]);
    setCustomSkill('');
    setLocation(null);
    setCityName('');
    setOfferRadius(null);
    setEditingJob(null);
    setShowForm(false);
  }, []);

  // Abre el form de oferta nueva y toma la ubicación del dispositivo como punto
  // por defecto. El efecto de auto-selección de ciudad (más abajo) se encarga de
  // fijar la ciudad donde cae. Si el GPS falla/deniega, queda el alta manual.
  const openNewOfferForm = useCallback(async () => {
    setShowForm(true);
    try {
      const coords = await getBrowserLocation();
      setLocation(coords);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo obtener tu ubicación');
    }
  }, []);

  // Carga las ciudades donde opera la app (centro/radio para el mapa).
  useEffect(() => {
    api.getCities()
      .then(({ cities }) => {
        setCitiesError(false);
        setCities(cities);
        // La oferta debe tener ciudad: preseleccionamos la primera si no hay una elegida.
        setCityName((prev) => prev || cities[0]?.nombre || '');
      })
      .catch(() => {
        // No tragamos el error: sin ciudades no se puede publicar (ciudad obligatoria).
        setCitiesError(true);
        toast.error('No se pudieron cargar las ciudades. Recargá la página o intentá más tarde.');
      });
  }, []);

  // Al mover el pin, auto-selecciona la ciudad cubierta donde cae.
  useEffect(() => {
    if (!location || cities.length === 0) return;
    const match = cities.find((c) => haversineKm(location, c.center) <= c.radiusKm);
    if (match) setCityName((prev) => (prev === match.nombre ? prev : match.nombre));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, cities]);

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

  // Background refresh without flipping loadingJobs (no full-page spinner / remount).
  const refreshJobsSilent = useCallback(async () => {
    try {
      const d = await api.getEmployerDashboard();
      setJobs(d.offers);
    } catch { /* noop */ }
  }, []);

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

  const selectedCity = useMemo(
    () => cities.find((c) => c.nombre === cityName) || cities[0] || null,
    [cities, cityName],
  );
  const zonaOptions = useMemo(
    () => (selectedCity?.zonas?.length ? selectedCity.zonas : (ZONAS_MDP as readonly string[])),
    [selectedCity],
  );
  // Radio efectivo del círculo/slider: el propio de la oferta o el de la ciudad.
  const effectiveRadius = useMemo(
    () => offerRadius ?? Math.min(selectedCity?.radiusKm ?? 15, 20),
    [offerRadius, selectedCity],
  );
  // ¿La ubicación elegida cae en alguna ciudad donde opera la app?
  // (itera todas las ciudades con haversine → memoizar para no rehacerlo por render)
  const locationCovered = useMemo(
    () => !location || cities.some((c) => haversineKm(location, c.center) <= c.radiusKm),
    [location, cities],
  );

  const availablePuestos = useMemo(
    () =>
      formData.rubro && formData.rubro !== 'otro'
        ? JOB_CATEGORIES[formData.rubro as TRubro]?.puestos || []
        : [],
    [formData.rubro],
  );

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
    setLocation((job as DashboardOffer & { location?: IGeoLocation | null }).location || null);
    setCityName((job as DashboardOffer & { city?: string }).city || '');
    setOfferRadius((job as DashboardOffer & { radiusKm?: number | null }).radiusKm ?? null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const finalRubro = formData.rubro === 'otro' ? formData.customRubro : formData.rubro;
    const finalPuesto = formData.puesto === 'otro' ? formData.customPuesto : formData.puesto;

    if (!finalRubro || !finalPuesto) {
      toast.error('Seleccioná rubro y puesto');
      return;
    }

    const finalCity = cityName || selectedCity?.nombre || '';
    if (!finalCity) {
      toast.error('Seleccioná la ciudad de la oferta');
      return;
    }

    // Solo se puede publicar dentro de ciudades habilitadas: si el punto marcado
    // cae fuera de toda ciudad, no dejamos crear/actualizar.
    if (location && !locationCovered) {
      toast.error('La ubicación está fuera de las ciudades donde operamos. Movela a una ciudad habilitada para publicar.');
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
        city: finalCity,
        radiusKm: offerRadius ?? undefined,
        availability: formData.availability || undefined,
        location,
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
      refreshJobsSilent();
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

  // Per-offer AI toggle (only visible when the employer's AI module is active).
  const toggleJobAi = async (jobId: string, current: boolean) => {
    const next = !current;
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, aiAssessEnabled: next } : j));
    try {
      await api.updateJobOffer(jobId, { aiAssessEnabled: next });
      toast.success(next ? 'IA activada para esta oferta' : 'IA desactivada para esta oferta');
    } catch {
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, aiAssessEnabled: current } : j));
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

  const handleAssessFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (valid.length === 0) return;

    // Hash each file to drop duplicates already queued in this batch.
    const hashed = await Promise.all(
      valid.map(async (file) => ({ file, hash: await hashFile(file) }))
    );

    setAssessItems((prev) => {
      const seen = new Set(prev.map((it) => it.hash).filter(Boolean) as string[]);
      const fresh: { file: File; hash: string }[] = [];
      const dupeNames: string[] = [];
      for (const h of hashed) {
        if (seen.has(h.hash)) { dupeNames.push(h.file.name); continue; }
        seen.add(h.hash);
        fresh.push(h);
      }
      if (dupeNames.length > 0) {
        toast.error(
          dupeNames.length === 1
            ? `Ese archivo ya lo agregaste: ${dupeNames[0]}`
            : `${dupeNames.length} archivos repetidos se omitieron: ${dupeNames.join(', ')}`
        );
      }

      const room = MAX_CVS - prev.length;
      if (room <= 0) {
        toast.error(`Máximo ${MAX_CVS} CVs`);
        return prev;
      }
      if (fresh.length > room) {
        toast.error(`Máximo ${MAX_CVS} CVs (se agregaron ${room})`);
      }
      const toAdd = fresh.slice(0, room).map(({ file, hash }, i) => ({
        id: `${file.name}-${file.size}-${hash.slice(0, 8)}-${prev.length + i}`,
        file,
        hash,
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

  // Evalúa un único CV. Devuelve el resultado para que el llamador (lote o reintento)
  // decida cómo seguir. El detalle técnico del error queda en el log de admin.
  const assessOne = async (item: AssessItem): Promise<{ outcome: 'done' | 'error' | 'rate_limited'; rateScope?: string }> => {
    if (!assessModal) return { outcome: 'error' };
    updateItem(item.id, { status: 'running', error: undefined });
    try {
      const result = await api.assessOfferCv(assessModal.job.id, item.file);
      updateItem(item.id, { status: 'done', result });
      return { outcome: 'done' };
    } catch (error) {
      const e = error as { rateLimited?: boolean; rateScope?: string; message?: string };
      if (e?.rateLimited) {
        // Límite de IA: dejamos el item pendiente para reintentar luego.
        updateItem(item.id, { status: 'pending', error: undefined });
        return { outcome: 'rate_limited', rateScope: e.rateScope };
      }
      updateItem(item.id, { status: 'error', error: e?.message || 'Error al evaluar el CV' });
      return { outcome: 'error' };
    }
  };

  const runAssessment = async () => {
    if (!assessModal) return;
    setAssessRunning(true);
    // Snapshot of items to process (those not yet done) — evaluate one by one.
    const pending = assessItems.filter((it) => it.status === 'pending' || it.status === 'error');
    // AI mode bursts hit provider rate limits → space the calls a bit.
    const willUseAi = aiOn && assessModal.job.aiAssessEnabled !== false;
    let done = 0;
    for (let i = 0; i < pending.length; i++) {
      const r = await assessOne(pending[i]);
      if (r.outcome === 'rate_limited') {
        const remaining = pending.length - done;
        toast.error(
          (r.rateScope === 'day'
            ? 'Límite diario de la IA alcanzado. '
            : 'Límite por minuto de la IA alcanzado. ') +
          `Se analizaron ${done}; quedaron ${remaining} sin analizar. Reintentá más tarde con "Evaluar".`
        );
        break;
      }
      done++;
      // Pacing between AI calls (skip after the last one).
      if (willUseAi && i < pending.length - 1) {
        await sleep(AI_PACING_MS);
      }
    }
    setAssessRunning(false);
    refreshJobsSilent(); // update ranking count + AI spend without the full-page spinner
  };

  // Reintenta la evaluación de un único CV (botón "Reintentar" del item).
  const retryAssessItem = async (item: AssessItem) => {
    setAssessRunning(true);
    const r = await assessOne(item);
    if (r.outcome === 'rate_limited') {
      toast.error(
        (r.rateScope === 'day'
          ? 'Límite diario de la IA alcanzado. '
          : 'Límite por minuto de la IA alcanzado. ') + 'Reintentá en unos minutos.'
      );
    }
    setAssessRunning(false);
    refreshJobsSilent();
  };

  const openPinnedModal = async (job: DashboardOffer) => {
    setPinnedModal({ job, items: [] });
    setPinnedMinStars(0);
    setPinnedOnlySelected(false);
    setExpandedRank(null);
    setCompareGroup(null);
    setLoadingPinned(true);
    try {
      const { pinned } = await api.getPinnedCandidates(job.id);
      setPinnedModal({ job, items: pinned });
    } catch {
      toast.error('No se pudo cargar el ranking');
      setPinnedModal(null);
    } finally {
      setLoadingPinned(false);
    }
  };

  const toggleSelected = async (item: IPinnedCandidate) => {
    if (!pinnedModal) return;
    const next = !item.selected;
    setPinnedModal((m) => m && { ...m, items: m.items.map((p) => p.id === item.id ? { ...p, selected: next } : p) });
    try {
      await api.setCandidateSelected(pinnedModal.job.id, item.id, next);
    } catch {
      setPinnedModal((m) => m && { ...m, items: m.items.map((p) => p.id === item.id ? { ...p, selected: item.selected } : p) });
      toast.error('No se pudo actualizar la selección');
    }
  };

  const removePin = async (pinId: string) => {
    if (!pinnedModal) return;
    try {
      await api.deletePinnedCandidate(pinnedModal.job.id, pinId);
      setPinnedModal({ ...pinnedModal, items: pinnedModal.items.filter(p => p.id !== pinId) });
      // Sync the card's ranking count locally — no full refetch / no spinner.
      setJobs(prev => prev.map(j =>
        j.id === pinnedModal.job.id
          ? { ...j, stats: { ...j.stats, pinned: Math.max(0, (j.stats.pinned ?? 0) - 1) } }
          : j
      ));
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

  // Estrellas unificadas 1-5: el backend calcula `stars` desde el puntaje 0-100
  // (IA y básico usan la misma escala). Fallback a scoreToStars por seguridad.
  const matchStars = (r: IAssessCvResponse): number =>
    r.assessment.stars ?? scoreToStars(r.assessment.score);

  const renderStars = (level: number) => (
    <span className="text-lg leading-none">
      <span className="text-yellow-500">{'★'.repeat(level)}</span>
      <span className="text-gray-400">{'☆'.repeat(Math.max(0, STAR_MAX - level))}</span>
    </span>
  );

  // Badge de ubicación del candidato respecto a la oferta (fuera de zona / no detectada).
  const renderLocationBadge = (
    a: { locationStatus?: string | null; distanceKm?: number | null },
    candidate?: { city?: string | null }
  ) => {
    const status = a.locationStatus || 'in_zone';
    if (status === 'out_of_zone') {
      const city = candidate?.city ? ` · ${candidate.city}` : '';
      const km = a.distanceKm != null ? ` · ${a.distanceKm} km` : '';
      return (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Fuera de zona{city}{km}
        </span>
      );
    }
    if (status === 'unknown') {
      return (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full theme-bg-secondary theme-text-muted flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Ubicación no detectada
        </span>
      );
    }
    return null;
  };

  // Devolución detallada (resumen/fortalezas/brechas/skills) — usada en el ranking y en comparar.
  const renderAssessmentDetail = (a: IPinnedCandidate['assessment']) => {
    const hasDetail = a.summary || (a.strengths?.length ?? 0) > 0 || (a.gaps?.length ?? 0) > 0 || a.matchingSkills?.length > 0 || a.missingSkills?.length > 0;
    return (
      <div className="space-y-3">
        {a.summary && <p className="text-sm theme-text-primary">{a.summary}</p>}
        {(a.strengths?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs theme-text-muted mb-1">Fortalezas</p>
            <ul className="text-sm theme-text-secondary list-disc pl-5 space-y-0.5">{a.strengths!.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
        {(a.gaps?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs theme-text-muted mb-1">Brechas / a tener en cuenta</p>
            <ul className="text-sm theme-text-secondary list-disc pl-5 space-y-0.5">{a.gaps!.map((g, i) => <li key={i}>{g}</li>)}</ul>
          </div>
        )}
        {a.matchingSkills?.length > 0 && (
          <div>
            <p className="text-xs theme-text-muted mb-1">Skills coincidentes</p>
            <div className="flex flex-wrap gap-1.5">{a.matchingSkills.map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{s}</span>)}</div>
          </div>
        )}
        {a.missingSkills?.length > 0 && (
          <div>
            <p className="text-xs theme-text-muted mb-1">Skills que pide la oferta y faltan</p>
            <div className="flex flex-wrap gap-1.5">{a.missingSkills.map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full theme-bg-secondary theme-text-muted">{s}</span>)}</div>
          </div>
        )}
        {!hasDetail && <p className="text-xs theme-text-muted">Sin detalle adicional.</p>}
      </div>
    );
  };

  // Clave para agrupar evaluaciones de la misma persona (email o teléfono normalizado).
  const personKey = (p: IPinnedCandidate): string | null =>
    p.candidate.email ? p.candidate.email.trim().toLowerCase()
      : p.candidate.phone ? p.candidate.phone.replace(/\D/g, '')
      : null;

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

        {/* Ciudad (obligatoria) */}
        {cities.length > 0 && (
          <div>
            <label className="block text-sm font-medium theme-text-muted mb-2">
              Ciudad <span className="text-[#E10600]">*</span>
            </label>
            <select
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary focus:border-[#E10600] focus:outline-none"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.nombre}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Sin ciudades: el error ya no es silencioso. La ciudad es obligatoria. */}
        {cities.length === 0 && citiesError && (
          <div className="rounded-xl border-2 border-[#E10600]/40 bg-[#E10600]/5 p-4 text-sm theme-text-primary">
            No se pudieron cargar las ciudades. Recargá la página o intentá más tarde.
          </div>
        )}

        {/* Zona / Barrio */}
        <div>
          <label className="block text-sm font-medium theme-text-muted mb-2">
            Barrio / Zona (opcional)
          </label>
          <select
            value={formData.zona}
            onChange={(e) => setFormData({ ...formData, zona: e.target.value })}
            className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary focus:border-[#E10600] focus:outline-none"
          >
            <option value="">Sin especificar</option>
            {zonaOptions.map((zona) => (
              <option key={zona} value={zona}>{zona}</option>
            ))}
          </select>

          {/* Ubicación del lugar de trabajo (para ordenar por cercanía) */}
          <div className="mt-3">
            <p className="text-sm theme-text-muted mb-2">
              Marcá la ubicación del trabajo en el mapa, buscá la dirección o usá tu GPS. Ajustá el radio para definir qué tan lejos buscamos candidatos.
            </p>
            <LocationPicker
              value={location}
              onChange={setLocation}
              center={selectedCity?.center}
              radiusKm={effectiveRadius}
              onRadiusChange={setOfferRadius}
              cityName={selectedCity?.nombre}
              isLocationServed={(loc) => cities.some((c) => haversineKm(loc, c.center) <= c.radiusKm)}
            />
            {!locationCovered && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  No operamos en esta ciudad todavía, así que no podés publicar la oferta acá.
                  {cities.length > 0 && ` Por ahora trabajamos en ${cities.map((c) => c.nombre).join(', ')}.`}
                  {' '}Movés el punto a una ciudad habilitada para poder publicar.
                </span>
              </div>
            )}
          </div>
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
          disabled={saving || !formData.rubro || (!formData.puesto && formData.rubro !== 'otro') || (formData.rubro === 'otro' && !formData.customRubro) || (formData.puesto === 'otro' && !formData.customPuesto) || (formData.rubro === 'otro' && !formData.customPuesto) || (!!location && !locationCovered)}
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
        onClick={openNewOfferForm}
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
                    {(job.aiUsage?.cvCount ?? 0) > 0 && (
                      <p className="text-xs theme-text-muted mt-1" title="Gasto estimado de IA (aprox)">
                        💸 U$D {formatUsd(job.aiUsage!.costUsd)} · {formatTokens(job.aiUsage!.inputTokens + job.aiUsage!.outputTokens)} tokens · {job.aiUsage!.cvCount} CV{job.aiUsage!.cvCount !== 1 ? 's' : ''}
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

                  {/* Ranking de CVs cargados */}
                  {(job.stats.pinned ?? 0) > 0 && (
                    <button
                      onClick={() => openPinnedModal(job)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[#7C3AED] bg-[#7C3AED]/10 active:scale-95 transition-transform cursor-pointer"
                    >
                      <Trophy className="h-4 w-4" />
                      <span className="font-medium">Ranking ({job.stats.pinned})</span>
                    </button>
                  )}

                  {/* Switch IA por oferta (solo si el módulo de IA está activo) */}
                  {aiOn && (
                    <button
                      type="button"
                      onClick={() => toggleJobAi(job.id, job.aiAssessEnabled !== false)}
                      role="switch"
                      aria-checked={job.aiAssessEnabled !== false}
                      title={job.aiAssessEnabled !== false ? 'Evaluación con IA activada' : 'Evaluación con IA desactivada'}
                      className="ml-auto inline-flex items-center gap-1.5 px-1 py-1 rounded-lg active:scale-95 transition cursor-pointer"
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${job.aiAssessEnabled !== false ? 'text-[#7C3AED]' : 'theme-text-muted'}`} />
                      <span className={`text-xs font-medium ${job.aiAssessEnabled !== false ? 'text-[#7C3AED]' : 'theme-text-muted'}`}>IA</span>
                      <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${job.aiAssessEnabled !== false ? 'bg-[#7C3AED]' : 'theme-bg-secondary'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${job.aiAssessEnabled !== false ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </span>
                    </button>
                  )}

                  {/* Evaluar CV (delicado, alineado a la derecha) */}
                  <button
                    onClick={() => openAssessModal(job)}
                    className={`${aiOn ? '' : 'ml-auto'} inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition active:scale-95 cursor-pointer ${
                      aiOn && job.aiAssessEnabled !== false
                        ? 'bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/15'
                        : 'theme-bg-secondary theme-text-secondary hover:opacity-80'
                    }`}
                  >
                    {aiOn && job.aiAssessEnabled !== false ? <Sparkles className="h-3.5 w-3.5" /> : <FileSearch className="h-3.5 w-3.5" />}
                    {aiOn && job.aiAssessEnabled !== false ? 'Evaluar CV ✨' : 'Evaluar CV'}
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
                  {aiOn && assessModal.job.aiAssessEnabled !== false ? <Sparkles className="h-5 w-5 text-[#7C3AED]" /> : <FileSearch className="h-5 w-5 text-[#7C3AED]" />}
                  {aiOn && assessModal.job.aiAssessEnabled !== false ? 'Evaluar CV con IA' : 'Evaluar CV'}
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

              {/* Items list (compacto: el detalle se ve en el Ranking) */}
              {assessItems.map((item) => (
                <div key={item.id} className="border theme-border rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium theme-text-primary truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-[#7C3AED]" />}
                      {item.status === 'pending' && <span className="text-xs theme-text-muted">Pendiente</span>}
                      {item.status === 'done' && item.result && (
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm">{renderStars(matchStars(item.result))}</span>
                          <span className="text-xs theme-text-muted">{item.result.assessment.score}{item.result.mode === 'ai' ? '%' : ' pts'}</span>
                        </span>
                      )}
                      {item.status === 'error' && <span className="text-xs text-[#E10600]">Error</span>}
                      {!assessRunning && item.status !== 'running' && (
                        <button onClick={() => removeAssessItem(item.id)} className="p-1 active:theme-bg-secondary rounded-lg cursor-pointer" title="Quitar">
                          <X className="h-4 w-4 theme-text-secondary" />
                        </button>
                      )}
                    </div>
                  </div>

                  {item.status === 'error' && (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-[#E10600]">No se pudo leer el CV</p>
                      {!assessRunning && (
                        <button
                          onClick={() => retryAssessItem(item)}
                          className="text-xs flex items-center gap-1 text-[#7C3AED] font-medium cursor-pointer shrink-0"
                        >
                          <RotateCcw className="h-3 w-3" /> Reintentar
                        </button>
                      )}
                    </div>
                  )}

                  {item.status === 'done' && item.result && (
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <p className="text-xs">
                        {item.result.duplicate === 'file' ? (
                          <span className="text-amber-600">Ya cargado (CV duplicado)</span>
                        ) : item.result.duplicate === 'person' ? (
                          <button onClick={() => openPinnedModal(assessModal.job)} className="text-amber-600 underline cursor-pointer">
                            Perfil ya en el ranking — comparar
                          </button>
                        ) : (
                          <span className="text-green-600">Agregado al ranking</span>
                        )}
                      </p>
                      {renderLocationBadge(item.result.assessment, item.result.candidate)}
                    </div>
                  )}
                </div>
              ))}

              {/* Evaluar */}
              {(() => {
                const pendingCount = assessItems.filter((i) => i.status === 'pending' || i.status === 'error').length;
                const total = assessItems.length;
                const doneCount = assessItems.filter((i) => i.status === 'done' || i.status === 'error').length;
                return (
                  <button
                    onClick={runAssessment}
                    disabled={assessRunning || pendingCount === 0}
                    className="w-full py-3 rounded-xl bg-[#7C3AED] text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {assessRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analizando {Math.min(doneCount + 1, total)} de {total}…
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

      {/* Modal Ranking de CVs */}
      {pinnedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="theme-bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b theme-border">
              <div>
                <h3 className="font-semibold theme-text-primary flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-[#7C3AED]" />
                  Ranking de CVs
                </h3>
                <p className="text-sm theme-text-muted">{pinnedModal.job.puesto}</p>
              </div>
              <button onClick={() => setPinnedModal(null)} className="p-1 active:theme-bg-secondary rounded-lg cursor-pointer">
                <X className="h-5 w-5 theme-text-secondary" />
              </button>
            </div>

            {/* Filtros: estrellas + seleccionados */}
            {!loadingPinned && pinnedModal.items.length > 0 && (
              <div className="flex items-center gap-1.5 px-4 py-2 border-b theme-border overflow-x-auto">
                {STAR_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setPinnedMinStars(f.value)}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition active:scale-95 cursor-pointer ${
                      pinnedMinStars === f.value
                        ? 'bg-[#7C3AED] text-white'
                        : 'theme-bg-secondary theme-text-secondary hover:opacity-80'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  onClick={() => setPinnedOnlySelected((v) => !v)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                    pinnedOnlySelected ? 'bg-amber-500 text-white' : 'theme-bg-secondary theme-text-secondary hover:opacity-80'
                  }`}
                >
                  <Star className="h-3 w-3" /> Seleccionados
                </button>
              </div>
            )}

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {loadingPinned ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#7C3AED]" /></div>
              ) : pinnedModal.items.length === 0 ? (
                <p className="text-sm theme-text-muted text-center py-8">Todavía no cargaste CVs para esta oferta.</p>
              ) : (() => {
                const groups = new Map<string, IPinnedCandidate[]>();
                pinnedModal.items.forEach((p) => {
                  const k = personKey(p);
                  if (k) { const arr = groups.get(k) || []; arr.push(p); groups.set(k, arr); }
                });
                const list = pinnedModal.items
                  .filter((p) => (p.assessment.stars ?? scoreToStars(p.assessment.score)) >= pinnedMinStars)
                  .filter((p) => !pinnedOnlySelected || p.selected)
                  .sort((a, b) =>
                    Number(b.selected) - Number(a.selected)
                    || (b.assessment.stars ?? scoreToStars(b.assessment.score)) - (a.assessment.stars ?? scoreToStars(a.assessment.score))
                    || b.assessment.score - a.assessment.score
                  );
                if (list.length === 0) {
                  return <p className="text-sm theme-text-muted text-center py-8">No hay CVs que cumplan el filtro.</p>;
                }
                const renderCard = (p: IPinnedCandidate) => {
                  const k = personKey(p);
                  const group = k ? groups.get(k) : null;
                  const isDup = !!group && group.length > 1;
                  const expanded = expandedRank === p.id;
                  return (
                    <div key={p.id} className={`border rounded-xl p-3 ${p.selected ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-900/10' : 'theme-border'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium theme-text-primary truncate flex items-center gap-2">
                            {[p.candidate.firstName, p.candidate.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
                            {isDup && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Duplicado</span>}
                          </p>
                          {p.candidate.email && <p className="text-xs theme-text-muted truncate">{p.candidate.email}</p>}
                          {p.candidate.phone && <p className="text-xs theme-text-muted">{p.candidate.phone}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => toggleSelected(p)} title={p.selected ? 'Quitar de seleccionados' : 'Marcar como mejor'} className="p-2 rounded-lg cursor-pointer active:scale-95">
                            <Star className={`h-4 w-4 ${p.selected ? 'text-amber-500 fill-amber-500' : 'theme-text-muted'}`} />
                          </button>
                          <button onClick={() => removePin(p.id)} className="p-2 text-[#E10600] hover:bg-[#E10600]/10 rounded-lg transition-colors cursor-pointer" title="Quitar">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-sm font-bold theme-text-primary">
                          {p.assessment.score}{p.assessment.mode === 'ai' ? '%' : ' pts'}
                        </span>
                        {renderStars(p.assessment.stars ?? scoreToStars(p.assessment.score))}
                        {p.assessment.mode === 'ai' && p.assessment.recommendation && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RECOMMENDATION[p.assessment.recommendation]?.cls || ''}`}>
                            {RECOMMENDATION[p.assessment.recommendation]?.label}
                          </span>
                        )}
                        {p.assessment.mode === 'basic' && p.assessment.matchType && (
                          <Badge variant="secondary" className="text-xs">{MATCH_LABELS[p.assessment.matchType]}</Badge>
                        )}
                        {renderLocationBadge(p.assessment, p.candidate)}
                        {isDup && (
                          <button onClick={() => setCompareGroup(group)} className="text-xs text-amber-600 flex items-center gap-1 cursor-pointer">
                            <Columns2 className="h-3 w-3" /> Comparar
                          </button>
                        )}
                        <button onClick={() => setExpandedRank(expanded ? null : p.id)} className="ml-auto text-xs theme-text-secondary flex items-center gap-1 cursor-pointer">
                          {expanded ? <>Ocultar <ChevronUp className="h-3 w-3" /></> : <>Ver detalle <ChevronDown className="h-3 w-3" /></>}
                        </button>
                      </div>
                      {expanded && <div className="mt-3 pt-3 border-t theme-border">{renderAssessmentDetail(p.assessment)}</div>}
                    </div>
                  );
                };
                const statusOf = (p: IPinnedCandidate) => p.assessment.locationStatus || 'in_zone';
                const inZone = list.filter((p) => statusOf(p) === 'in_zone');
                const outZone = list.filter((p) => statusOf(p) === 'out_of_zone');
                const unknown = list.filter((p) => statusOf(p) === 'unknown');
                const sectionHeader = (label: string, count: number) => (
                  <div key={label} className="flex items-center gap-2 pt-3 text-xs font-semibold theme-text-muted">
                    <span>{label}</span>
                    <span className="theme-bg-secondary rounded-full px-1.5 py-0.5">{count}</span>
                  </div>
                );
                return (
                  <>
                    {inZone.map(renderCard)}
                    {outZone.length > 0 && (
                      <>
                        {sectionHeader('Fuera de zona', outZone.length)}
                        {outZone.map(renderCard)}
                      </>
                    )}
                    {unknown.length > 0 && (
                      <>
                        {sectionHeader('Ubicación no detectada', unknown.length)}
                        {unknown.map(renderCard)}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal Comparar (mismo perfil) */}
      {compareGroup && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60]">
          <div className="theme-bg-card w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b theme-border">
              <div>
                <h3 className="font-semibold theme-text-primary flex items-center gap-2">
                  <Columns2 className="h-5 w-5 text-[#7C3AED]" /> Comparar CVs del mismo perfil
                </h3>
                <p className="text-sm theme-text-muted">
                  {[compareGroup[0].candidate.firstName, compareGroup[0].candidate.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
                </p>
              </div>
              <button onClick={() => setCompareGroup(null)} className="p-1 active:theme-bg-secondary rounded-lg cursor-pointer">
                <X className="h-5 w-5 theme-text-secondary" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {compareGroup.map((p) => (
                <div key={p.id} className="border theme-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs theme-text-muted">
                      {p.assessment.mode === 'ai' ? 'IA' : 'Básico'}{p.createdAt ? ` · ${new Date(p.createdAt).toLocaleDateString()}` : ''}
                    </span>
                    <button
                      onClick={() => {
                        removePin(p.id);
                        setCompareGroup((g) => {
                          const ng = (g || []).filter((x) => x.id !== p.id);
                          return ng.length > 1 ? ng : null;
                        });
                      }}
                      className="p-1.5 text-[#E10600] hover:bg-[#E10600]/10 rounded-lg cursor-pointer"
                      title="Quitar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold theme-text-primary">{p.assessment.score}{p.assessment.mode === 'ai' ? '%' : ' pts'}</span>
                    {renderStars(p.assessment.stars ?? scoreToStars(p.assessment.score))}
                  </div>
                  {p.assessment.mode === 'ai' && p.assessment.recommendation && (
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${RECOMMENDATION[p.assessment.recommendation]?.cls || ''}`}>
                      {RECOMMENDATION[p.assessment.recommendation]?.label}
                    </span>
                  )}
                  {renderAssessmentDetail(p.assessment)}
                </div>
              ))}
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
