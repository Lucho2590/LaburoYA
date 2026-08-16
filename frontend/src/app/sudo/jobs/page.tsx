'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { IAdminJobOffer, IAiUsage } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShareJobModal } from '@/components/ShareJobModal';
import { downloadCsv, formatCsvDate } from '@/lib/csv';

// Gasto de IA por análisis de CVs: info interna, solo visible acá (/sudo).
const formatUsd = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const totalTokens = (usage?: IAiUsage | null) =>
  (usage?.inputTokens || 0) + (usage?.outputTokens || 0);

export default function AdminJobsPage() {
  const [allJobOffers, setAllJobOffers] = useState<IAdminJobOffer[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<IAdminJobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [activeFilter, setActiveFilter] = useState<string>('all'); // 'all', 'active', 'inactive', 'expired'
  const [employerFilter, setEmployerFilter] = useState<string>('');
  const [rubroFilter, setRubroFilter] = useState<string>('');
  const [puestoFilter, setPuestoFilter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  // Ofertas que piden skills que no están en el catálogo (candidatas a revisar).
  const [onlyCustomSkills, setOnlyCustomSkills] = useState(false);

  // Compartir búsqueda (link + QR)
  const [shareJob, setShareJob] = useState<IAdminJobOffer | null>(null);

  // Listas para filtros
  const [employers, setEmployers] = useState<{ id: string; name: string }[]>([]);
  const [rubros, setRubros] = useState<string[]>([]);
  const [puestos, setPuestos] = useState<string[]>([]);

  // Paginacion
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [updating, setUpdating] = useState<string | null>(null);
  const [editingDuration, setEditingDuration] = useState<string | null>(null);
  const [durationValue, setDurationValue] = useState<number>(3);

  const fetchJobOffers = async () => {
    setLoading(true);
    try {
      // withAnalytics: matches, interacciones, postulaciones y skills por oferta.
      const data = await api.getAdminJobOffers({ limit: 500, withAnalytics: true });
      setAllJobOffers(data.jobOffers);

      // Extraer listas unicas para filtros
      const uniqueEmployers = new Map<string, string>();
      const uniqueRubros = new Set<string>();
      const uniquePuestos = new Set<string>();

      data.jobOffers.forEach((job) => {
        if (job.employer?.businessName && job.employerId) {
          uniqueEmployers.set(job.employerId, job.employer.businessName);
        }
        if (job.rubro) uniqueRubros.add(job.rubro);
        if (job.puesto) uniquePuestos.add(job.puesto);
      });

      setEmployers(
        Array.from(uniqueEmployers.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setRubros(Array.from(uniqueRubros).sort());
      setPuestos(Array.from(uniquePuestos).sort());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar ofertas');
    } finally {
      setLoading(false);
    }
  };

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...allJobOffers];

    // Filtro por estado
    if (activeFilter === 'active') {
      filtered = filtered.filter((job) => job.active !== false && !isExpired(job.expiresAt));
    } else if (activeFilter === 'inactive') {
      filtered = filtered.filter((job) => job.active === false);
    } else if (activeFilter === 'expired') {
      filtered = filtered.filter((job) => isExpired(job.expiresAt));
    }

    // Filtro por empleador
    if (employerFilter) {
      filtered = filtered.filter((job) => job.employerId === employerFilter);
    }

    // Filtro por rubro
    if (rubroFilter) {
      filtered = filtered.filter((job) => job.rubro === rubroFilter);
    }

    // Filtro por puesto
    if (puestoFilter) {
      filtered = filtered.filter((job) => job.puesto === puestoFilter);
    }

    if (onlyCustomSkills) {
      filtered = filtered.filter((job) => (job.analytics?.skills.custom.length || 0) > 0);
    }

    // Busqueda de texto
    if (searchText.trim()) {
      const search = searchText.toLowerCase().trim();
      filtered = filtered.filter((job) =>
        job.rubro?.toLowerCase().includes(search) ||
        job.puesto?.toLowerCase().includes(search) ||
        job.description?.toLowerCase().includes(search) ||
        job.employer?.businessName?.toLowerCase().includes(search) ||
        job.zona?.toLowerCase().includes(search) ||
        job.id.toLowerCase().includes(search)
      );
    }

    setFilteredOffers(filtered);
    setCurrentPage(1); // Reset a pagina 1 cuando cambian los filtros
  }, [allJobOffers, activeFilter, employerFilter, rubroFilter, puestoFilter, searchText, onlyCustomSkills]);

  // Calcular datos paginados
  const totalPages = Math.ceil(filteredOffers.length / pageSize);
  const paginatedOffers = filteredOffers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    fetchJobOffers();
  }, []);

  const formatDateTime = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getTimeRemaining = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expirada';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours % 24}h`;
    }
    return `${diffHours}h`;
  };

  const handleToggleActive = async (job: IAdminJobOffer) => {
    setUpdating(job.id);
    try {
      const updated = await api.updateAdminJobOffer(job.id, { active: !job.active });
      // Actualizar localmente sin recargar todo
      setAllJobOffers((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, ...updated } : j))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar oferta');
    } finally {
      setUpdating(null);
    }
  };

  const handleSaveDuration = async (jobId: string) => {
    setUpdating(jobId);
    try {
      const updated = await api.updateAdminJobOffer(jobId, { durationDays: durationValue });
      // Actualizar localmente sin recargar todo
      setAllJobOffers((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, ...updated } : j))
      );
      setEditingDuration(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar duracion');
    } finally {
      setUpdating(null);
    }
  };

  const startEditDuration = (job: IAdminJobOffer) => {
    setEditingDuration(job.id);
    setDurationValue(job.durationDays || 3);
  };

  const clearFilters = () => {
    setActiveFilter('all');
    setEmployerFilter('');
    setRubroFilter('');
    setPuestoFilter('');
    setSearchText('');
    setOnlyCustomSkills(false);
  };

  const hasActiveFilters =
    activeFilter !== 'all' || employerFilter || rubroFilter || puestoFilter || searchText || onlyCustomSkills;

  // Totales de las ofertas que quedaron después de filtrar.
  const totals = filteredOffers.reduce(
    (acc, job) => {
      const a = job.analytics;
      return {
        cvCount: acc.cvCount + (job.aiUsage?.cvCount || 0),
        tokens: acc.tokens + totalTokens(job.aiUsage),
        costUsd: acc.costUsd + (job.aiUsage?.costUsd || 0),
        matches: acc.matches + (a?.matches.total || 0),
        rejected: acc.rejected + (a?.matches.rejected || 0),
        notInterested: acc.notInterested + (a?.interactions.notInterested || 0),
        customSkills: acc.customSkills + (a?.skills.custom.length ? 1 : 0),
      };
    },
    { cvCount: 0, tokens: 0, costUsd: 0, matches: 0, rejected: 0, notInterested: 0, customSkills: 0 }
  );

  // Una fila por oferta con todos los números: la base para analizar afuera.
  const exportCsv = () => {
    downloadCsv(
      'ofertas-sudo.csv',
      filteredOffers.map((job) => {
        const a = job.analytics;
        return {
          offerId: job.id,
          rubro: job.rubro || '',
          puesto: job.puesto || '',
          empleador: job.employer?.businessName || '',
          empleadorId: job.employerId || '',
          estado: job.active === false ? 'inactiva' : 'activa',
          expirada: isExpired(job.expiresAt) ? 'si' : 'no',
          creada: formatCsvDate(job.createdAt),
          expira: formatCsvDate(job.expiresAt),
          duracionDias: job.durationDays || 3,
          zona: job.zona || '',
          salario: job.salary || '',
          horario: job.schedule || '',
          skillsPedidas: (job.requiredSkills || []).join(' | '),
          skillsFueraCatalogo: (a?.skills.custom || []).join(' | '),
          skillsDeOtroPuesto: (a?.skills.offCatalog || []).join(' | '),
          cvsAnalizados: job.aiUsage?.cvCount || 0,
          tokensIa: totalTokens(job.aiUsage),
          costoIaUsd: (job.aiUsage?.costUsd || 0).toFixed(4),
          matchesTotal: a?.matches.total || 0,
          matchesAceptados: a?.matches.accepted || 0,
          matchesPendientes: a?.matches.pending || 0,
          matchesRechazados: a?.matches.rejected || 0,
          leInteresoA: a?.interactions.interested || 0,
          laDescartaron: a?.interactions.notInterested || 0,
          postulacionesWorker: a?.requests.fromWorker || 0,
          invitacionesEmpleador: a?.requests.fromEmployer || 0,
          postulacionesPendientes: a?.requests.pending || 0,
          postulacionesRechazadas: a?.requests.rejected || 0,
          cvsEnRanking: a?.cvRanking.total || 0,
          cvScorePromedio: a?.cvRanking.avgScore || 0,
          cvsSeleccionados: a?.cvRanking.selected || 0,
          cvsRecomendadosSi: a?.cvRanking.byRecommendation?.yes || 0,
          cvsRecomendadosNo: a?.cvRanking.byRecommendation?.no || 0,
        };
      })
    );
  };

  return (
    <AdminLayout title="Ofertas de Trabajo">
      {/* Filtros */}
      <div className="mb-6 space-y-4">
        {/* Busqueda */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Buscar por rubro, puesto, empleador, zona o ID..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full theme-bg-card border theme-border rounded-lg px-4 py-2 text-sm theme-text-primary placeholder:theme-text-muted"
            />
          </div>
          <span className="theme-text-muted text-sm">
            {filteredOffers.length} de {allJobOffers.length} oferta{allJobOffers.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={exportCsv}
            disabled={filteredOffers.length === 0}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#E10600] text-white hover:bg-[#c10500] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Descargar CSV
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-[#E10600] hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Totales de lo filtrado (el detalle por oferta está en cada fila) */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm theme-text-muted">
          <span title="Gasto estimado de IA (análisis de CVs) de las ofertas filtradas">
            💸 U$D {formatUsd(totals.costUsd)} · {formatTokens(totals.tokens)} tokens · {totals.cvCount} CVs
          </span>
          <span>🤝 {totals.matches} matches ({totals.rejected} rechazados)</span>
          <span>🙅 {totals.notInterested} descartes de workers</span>
          <span>🏷️ {totals.customSkills} ofertas con skills fuera del catálogo</span>
        </div>

        {/* Filtros en fila */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Estado */}
          <div className="flex items-center gap-2">
            <label className="theme-text-secondary text-xs">Estado:</label>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="theme-bg-card theme-border rounded-lg px-3 py-1.5 text-sm theme-text-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="inactive">Inactivas</SelectItem>
                <SelectItem value="expired">Expiradas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Empleador */}
          <div className="flex items-center gap-2">
            <label className="theme-text-secondary text-xs">Empleador:</label>
            <Select
              value={employerFilter || '__all__'}
              onValueChange={(v) => setEmployerFilter(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="theme-bg-card theme-border rounded-lg px-3 py-1.5 text-sm theme-text-primary max-w-[200px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {employers.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rubro */}
          <div className="flex items-center gap-2">
            <label className="theme-text-secondary text-xs">Rubro:</label>
            <Select
              value={rubroFilter || '__all__'}
              onValueChange={(v) => {
                setRubroFilter(v === '__all__' ? '' : v);
                setPuestoFilter(''); // Reset puesto cuando cambia el rubro
              }}
            >
              <SelectTrigger className="theme-bg-card theme-border rounded-lg px-3 py-1.5 text-sm theme-text-primary">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {rubros.map((rubro) => (
                  <SelectItem key={rubro} value={rubro}>
                    {rubro}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Puesto */}
          <div className="flex items-center gap-2">
            <label className="theme-text-secondary text-xs">Puesto:</label>
            <Select
              value={puestoFilter || '__all__'}
              onValueChange={(v) => setPuestoFilter(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="theme-bg-card theme-border rounded-lg px-3 py-1.5 text-sm theme-text-primary">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {(rubroFilter
                  ? puestos.filter((p) =>
                      allJobOffers.some((j) => j.rubro === rubroFilter && j.puesto === p)
                    )
                  : puestos
                ).map((puesto) => (
                  <SelectItem key={puesto} value={puesto}>
                    {puesto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-xs theme-text-secondary">
            <input
              type="checkbox"
              checked={onlyCustomSkills}
              onChange={(e) => setOnlyCustomSkills(e.target.checked)}
            />
            Solo con skills fuera del catálogo
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
          <button
            onClick={() => setError('')}
            className="ml-4 underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="theme-bg-card rounded-xl border theme-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="theme-bg-secondary">
              <tr>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">ID</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Rubro / Puesto</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Empleador</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Estado</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Duracion</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Expira</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">IA (CVs)</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Matches</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Interés</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Skills</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y theme-border">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]"></div>
                    </div>
                  </td>
                </tr>
              ) : paginatedOffers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center theme-text-muted">
                    {hasActiveFilters ? 'No se encontraron ofertas con los filtros aplicados' : 'No se encontraron ofertas'}
                  </td>
                </tr>
              ) : (
                paginatedOffers.map((job) => (
                  <tr key={job.id} className="hover:theme-bg-secondary transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/sudo/jobs/${job.id}`}
                        className="font-mono text-xs text-[#E10600] hover:underline"
                      >
                        {job.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/sudo/jobs/${job.id}`} className="block hover:opacity-80">
                        <div className="theme-text-primary font-medium text-sm">{job.rubro}</div>
                        <div className="theme-text-muted text-xs">{job.puesto}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {job.employer ? (
                        <Link
                          href={`/sudo/users/${job.employerId}`}
                          className="text-[#E10600] hover:underline text-sm"
                        >
                          {job.employer.businessName}
                        </Link>
                      ) : (
                        <span className="theme-text-muted text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(job)}
                        disabled={updating === job.id}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          job.active !== false
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                        } ${updating === job.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {updating === job.id ? '...' : job.active !== false ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {editingDuration === job.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={durationValue}
                            onChange={(e) => setDurationValue(Number(e.target.value))}
                            className="w-14 px-2 py-1 text-sm border theme-border rounded theme-bg-card theme-text-primary"
                          />
                          <span className="text-xs theme-text-muted">dias</span>
                          <button
                            onClick={() => handleSaveDuration(job.id)}
                            disabled={updating === job.id}
                            className="ml-1 text-green-600 hover:text-green-700 text-xs"
                          >
                            {updating === job.id ? '...' : '✓'}
                          </button>
                          <button
                            onClick={() => setEditingDuration(null)}
                            className="text-red-600 hover:text-red-700 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditDuration(job)}
                          className="text-sm theme-text-primary hover:underline"
                        >
                          {job.durationDays || 3} dias
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {isExpired(job.expiresAt) ? (
                          <span className="text-red-600 font-medium">Expirada</span>
                        ) : (
                          <span className={`${
                            getTimeRemaining(job.expiresAt)?.includes('h') && !getTimeRemaining(job.expiresAt)?.includes('d')
                              ? 'text-orange-600'
                              : 'theme-text-primary'
                          }`}>
                            {getTimeRemaining(job.expiresAt) || '-'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs theme-text-muted">
                        {formatDateTime(job.expiresAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(job.aiUsage?.cvCount ?? 0) > 0 ? (
                        <div title="Gasto estimado de IA por analizar CVs en esta oferta">
                          <div className="text-sm theme-text-primary">
                            U$D {formatUsd(job.aiUsage!.costUsd)}
                          </div>
                          <div className="text-xs theme-text-muted">
                            {formatTokens(totalTokens(job.aiUsage))} tokens · {job.aiUsage!.cvCount} CV
                            {job.aiUsage!.cvCount !== 1 ? 's' : ''}
                          </div>
                          {(job.analytics?.cvRanking.total ?? 0) > 0 && (
                            <div className="text-xs theme-text-muted">
                              score prom. {job.analytics!.cvRanking.avgScore}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="theme-text-muted text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {job.analytics ? (
                        <Link href={`/sudo/jobs/${job.id}`} className="block hover:opacity-80">
                          <div className="text-sm theme-text-primary">{job.analytics.matches.total}</div>
                          <div className="text-xs theme-text-muted">
                            <span className="text-green-600">{job.analytics.matches.accepted} ok</span>
                            {' · '}
                            <span className="text-yellow-600">{job.analytics.matches.pending} pend</span>
                            {' · '}
                            <span className="text-red-600">{job.analytics.matches.rejected} rech</span>
                          </div>
                        </Link>
                      ) : (
                        <span className="theme-text-muted text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {job.analytics ? (
                        <div title="Workers que marcaron interés o descartaron la oferta, y postulaciones">
                          <div className="text-xs">
                            <span className="text-green-600">
                              👍 {job.analytics.interactions.interested}
                            </span>
                            {' · '}
                            <span className="text-red-600">
                              👎 {job.analytics.interactions.notInterested}
                            </span>
                          </div>
                          <div className="text-xs theme-text-muted">
                            {job.analytics.requests.total} postulaciones
                          </div>
                        </div>
                      ) : (
                        <span className="theme-text-muted text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {job.analytics ? (
                        <div className="text-xs theme-text-muted">
                          <div>{job.analytics.skills.total} pedidas</div>
                          {job.analytics.skills.custom.length > 0 && (
                            <div
                              className="text-purple-500"
                              title={job.analytics.skills.custom.join(', ')}
                            >
                              {job.analytics.skills.custom.length} fuera de catálogo
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="theme-text-muted text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/sudo/jobs/${job.id}`}
                          className="text-xs text-[#E10600] hover:underline"
                        >
                          Ver detalle
                        </Link>
                        <button
                          onClick={() => setShareJob(job)}
                          disabled={isExpired(job.expiresAt)}
                          title={isExpired(job.expiresAt) ? 'La búsqueda venció: el link no sirve' : undefined}
                          className="text-xs text-[#E10600] hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                        >
                          Compartir
                        </button>
                        <Link
                          href={`/sudo/users/${job.employerId}`}
                          className="text-xs theme-text-secondary hover:theme-text-primary"
                        >
                          Ver empleador
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginacion */}
        {filteredOffers.length > 0 && (
          <div className="px-4 py-3 border-t theme-border flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="theme-text-secondary text-sm">Mostrar:</label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="theme-bg-secondary theme-border rounded px-2 py-1 text-sm theme-text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="theme-text-muted text-sm">
                Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredOffers.length)} de {filteredOffers.length}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded theme-bg-secondary theme-text-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
              >
                ««
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded theme-bg-secondary theme-text-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
              >
                «
              </button>

              {/* Numeros de pagina */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  // Mostrar primera, ultima, actual y 2 alrededor de la actual
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 2) return true;
                  return false;
                })
                .reduce((acc: (number | string)[], page, idx, arr) => {
                  // Agregar ... entre gaps
                  if (idx > 0 && typeof arr[idx - 1] === 'number' && page - (arr[idx - 1] as number) > 1) {
                    acc.push('...');
                  }
                  acc.push(page);
                  return acc;
                }, [])
                .map((page, idx) =>
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 theme-text-muted">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page as number)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-[#E10600] text-white'
                          : 'theme-bg-secondary theme-text-primary hover:opacity-80'
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded theme-bg-secondary theme-text-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
              >
                »
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded theme-bg-secondary theme-text-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>

      <ShareJobModal
        open={!!shareJob}
        offerId={shareJob?.id ?? null}
        puesto={shareJob?.puesto}
        rubro={shareJob?.rubro}
        onClose={() => setShareJob(null)}
      />
    </AdminLayout>
  );
}
