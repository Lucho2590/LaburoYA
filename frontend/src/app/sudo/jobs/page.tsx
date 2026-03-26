'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { IAdminJobOffer, IAdminMatch } from '@/types';

interface MatchesModalData {
  offerId: string;
  matches: {
    pending: IAdminMatch[];
    accepted: IAdminMatch[];
    rejected: IAdminMatch[];
  };
  counts: { pending: number; accepted: number; rejected: number };
}

interface JobOfferStats {
  interestedCount: number;
  notInterestedCount: number;
}

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
  const [matchesModal, setMatchesModal] = useState<MatchesModalData | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [detailModal, setDetailModal] = useState<IAdminJobOffer | null>(null);

  const fetchJobOffers = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminJobOffers({ limit: 500 }); // Traer todas para filtrar client-side
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
  }, [allJobOffers, activeFilter, employerFilter, rubroFilter, puestoFilter, searchText]);

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

  const handleViewMatches = async (jobId: string) => {
    setLoadingMatches(true);
    try {
      const data = await api.getAdminJobOfferMatches(jobId);
      setMatchesModal(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar matches');
    } finally {
      setLoadingMatches(false);
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
  };

  const hasActiveFilters = activeFilter !== 'all' || employerFilter || rubroFilter || puestoFilter || searchText;

  return (
    <AdminLayout title="Ofertas de Trabajo">
      {/* Filtros */}
      <div className="mb-6 space-y-4">
        {/* Busqueda */}
        <div className="flex items-center gap-4">
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
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-[#E10600] hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Filtros en fila */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Estado */}
          <div className="flex items-center gap-2">
            <label className="theme-text-secondary text-xs">Estado:</label>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="theme-bg-card border theme-border rounded-lg px-3 py-1.5 text-sm theme-text-primary"
            >
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
              <option value="expired">Expiradas</option>
            </select>
          </div>

          {/* Empleador */}
          <div className="flex items-center gap-2">
            <label className="theme-text-secondary text-xs">Empleador:</label>
            <select
              value={employerFilter}
              onChange={(e) => setEmployerFilter(e.target.value)}
              className="theme-bg-card border theme-border rounded-lg px-3 py-1.5 text-sm theme-text-primary max-w-[200px]"
            >
              <option value="">Todos</option>
              {employers.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rubro */}
          <div className="flex items-center gap-2">
            <label className="theme-text-secondary text-xs">Rubro:</label>
            <select
              value={rubroFilter}
              onChange={(e) => {
                setRubroFilter(e.target.value);
                setPuestoFilter(''); // Reset puesto cuando cambia el rubro
              }}
              className="theme-bg-card border theme-border rounded-lg px-3 py-1.5 text-sm theme-text-primary"
            >
              <option value="">Todos</option>
              {rubros.map((rubro) => (
                <option key={rubro} value={rubro}>
                  {rubro}
                </option>
              ))}
            </select>
          </div>

          {/* Puesto */}
          <div className="flex items-center gap-2">
            <label className="theme-text-secondary text-xs">Puesto:</label>
            <select
              value={puestoFilter}
              onChange={(e) => setPuestoFilter(e.target.value)}
              className="theme-bg-card border theme-border rounded-lg px-3 py-1.5 text-sm theme-text-primary"
            >
              <option value="">Todos</option>
              {(rubroFilter
                ? puestos.filter((p) =>
                    allJobOffers.some((j) => j.rubro === rubroFilter && j.puesto === p)
                  )
                : puestos
              ).map((puesto) => (
                <option key={puesto} value={puesto}>
                  {puesto}
                </option>
              ))}
            </select>
          </div>
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
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Matches</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y theme-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]"></div>
                    </div>
                  </td>
                </tr>
              ) : paginatedOffers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center theme-text-muted">
                    {hasActiveFilters ? 'No se encontraron ofertas con los filtros aplicados' : 'No se encontraron ofertas'}
                  </td>
                </tr>
              ) : (
                paginatedOffers.map((job) => (
                  <tr key={job.id} className="hover:theme-bg-secondary transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailModal(job)}
                        className="font-mono text-xs text-[#E10600] hover:underline"
                      >
                        {job.id.slice(0, 8)}...
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailModal(job)}
                        className="text-left hover:opacity-80"
                      >
                        <div className="theme-text-primary font-medium text-sm">{job.rubro}</div>
                        <div className="theme-text-muted text-xs">{job.puesto}</div>
                      </button>
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
                      <button
                        onClick={() => handleViewMatches(job.id)}
                        disabled={loadingMatches}
                        className="text-sm text-[#E10600] hover:underline"
                      >
                        Ver matches
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
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
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="theme-bg-secondary border theme-border rounded px-2 py-1 text-sm theme-text-primary"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
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

      {/* Modal de Detalles */}
      {detailModal && (
        <JobDetailModal
          job={detailModal}
          onClose={() => setDetailModal(null)}
          onViewMatches={(jobId) => {
            setDetailModal(null);
            handleViewMatches(jobId);
          }}
          onToggleActive={async () => {
            await handleToggleActive(detailModal);
            // Actualizar el modal con el nuevo estado
            setDetailModal((prev) => prev ? { ...prev, active: !prev.active } : null);
          }}
          isUpdating={updating === detailModal.id}
          formatDateTime={formatDateTime}
          getTimeRemaining={getTimeRemaining}
          isExpired={isExpired}
        />
      )}

      {/* Modal de Matches */}
      {matchesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="theme-bg-card rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b theme-border flex justify-between items-center">
              <h3 className="text-lg font-semibold theme-text-primary">
                Matches de la oferta
              </h3>
              <button
                onClick={() => setMatchesModal(null)}
                className="theme-text-muted hover:theme-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {/* Contadores */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="theme-bg-secondary rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{matchesModal.counts.pending}</div>
                  <div className="text-xs theme-text-muted">Pendientes</div>
                </div>
                <div className="theme-bg-secondary rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{matchesModal.counts.accepted}</div>
                  <div className="text-xs theme-text-muted">Aceptados</div>
                </div>
                <div className="theme-bg-secondary rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">{matchesModal.counts.rejected}</div>
                  <div className="text-xs theme-text-muted">Rechazados</div>
                </div>
              </div>

              {/* Lista de matches */}
              {matchesModal.counts.pending + matchesModal.counts.accepted + matchesModal.counts.rejected === 0 ? (
                <p className="text-center theme-text-muted py-8">
                  Esta oferta no tiene matches todavia
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Aceptados */}
                  {matchesModal.matches.accepted.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-green-600 mb-2">Aceptados ({matchesModal.matches.accepted.length})</h4>
                      <div className="space-y-2">
                        {matchesModal.matches.accepted.map((match) => (
                          <MatchCard key={match.id} match={match} status="accepted" />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pendientes */}
                  {matchesModal.matches.pending.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-yellow-600 mb-2">Pendientes ({matchesModal.matches.pending.length})</h4>
                      <div className="space-y-2">
                        {matchesModal.matches.pending.map((match) => (
                          <MatchCard key={match.id} match={match} status="pending" />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rechazados */}
                  {matchesModal.matches.rejected.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-red-600 mb-2">Rechazados ({matchesModal.matches.rejected.length})</h4>
                      <div className="space-y-2">
                        {matchesModal.matches.rejected.map((match) => (
                          <MatchCard key={match.id} match={match} status="rejected" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function MatchCard({ match, status }: { match: IAdminMatch; status: string }) {
  const statusColors = {
    pending: 'border-yellow-500',
    accepted: 'border-green-500',
    rejected: 'border-red-500',
  };

  return (
    <div className={`border-l-4 ${statusColors[status as keyof typeof statusColors]} theme-bg-secondary rounded-r-lg p-3`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium theme-text-primary text-sm">
            {match.worker?.puesto || 'Sin puesto'}
          </div>
          <div className="text-xs theme-text-muted">
            {match.worker?.rubro} - {match.worker?.zona || 'Sin zona'}
          </div>
        </div>
        <Link
          href={`/sudo/users/${match.workerId}`}
          className="text-xs text-[#E10600] hover:underline"
        >
          Ver trabajador
        </Link>
      </div>
      {match.worker?.skills && match.worker.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {match.worker.skills.slice(0, 5).map((skill) => (
            <span
              key={skill}
              className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-xs theme-text-secondary"
            >
              {skill}
            </span>
          ))}
          {match.worker.skills.length > 5 && (
            <span className="text-xs theme-text-muted">
              +{match.worker.skills.length - 5} mas
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface JobDetailModalProps {
  job: IAdminJobOffer & { stats?: JobOfferStats };
  onClose: () => void;
  onViewMatches: (jobId: string) => void;
  onToggleActive: () => void;
  isUpdating: boolean;
  formatDateTime: (date?: string) => string;
  getTimeRemaining: (date?: string) => string | null;
  isExpired: (date?: string) => boolean;
}

function JobDetailModal({
  job,
  onClose,
  onViewMatches,
  onToggleActive,
  isUpdating,
  formatDateTime,
  getTimeRemaining,
  isExpired,
}: JobDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="theme-bg-card rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b theme-border flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold theme-text-primary">
                {job.rubro}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                job.active !== false
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
              }`}>
                {job.active !== false ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <p className="theme-text-secondary text-sm">{job.puesto}</p>
          </div>
          <button
            onClick={onClose}
            className="theme-text-muted hover:theme-text-primary text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Empleador */}
            <div className="theme-bg-secondary rounded-lg p-3">
              <div className="text-xs theme-text-muted mb-1">Empleador</div>
              {job.employer ? (
                <Link
                  href={`/sudo/users/${job.employerId}`}
                  className="text-sm text-[#E10600] hover:underline font-medium"
                >
                  {job.employer.businessName}
                </Link>
              ) : (
                <span className="text-sm theme-text-primary">-</span>
              )}
            </div>

            {/* Zona */}
            <div className="theme-bg-secondary rounded-lg p-3">
              <div className="text-xs theme-text-muted mb-1">Zona</div>
              <div className="text-sm theme-text-primary font-medium">
                {job.zona || '-'}
              </div>
            </div>

            {/* Duracion */}
            <div className="theme-bg-secondary rounded-lg p-3">
              <div className="text-xs theme-text-muted mb-1">Duracion</div>
              <div className="text-sm theme-text-primary font-medium">
                {job.durationDays || 3} dias
              </div>
            </div>

            {/* Expiracion */}
            <div className="theme-bg-secondary rounded-lg p-3">
              <div className="text-xs theme-text-muted mb-1">Expiracion</div>
              <div className={`text-sm font-medium ${
                isExpired(job.expiresAt)
                  ? 'text-red-600'
                  : getTimeRemaining(job.expiresAt)?.includes('h') && !getTimeRemaining(job.expiresAt)?.includes('d')
                    ? 'text-orange-600'
                    : 'theme-text-primary'
              }`}>
                {isExpired(job.expiresAt) ? 'Expirada' : getTimeRemaining(job.expiresAt) || '-'}
              </div>
              <div className="text-xs theme-text-muted">
                {formatDateTime(job.expiresAt)}
              </div>
            </div>
          </div>

          {/* Estadisticas */}
          <div className="mb-6">
            <h4 className="text-sm font-medium theme-text-primary mb-2">Estadisticas</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="theme-bg-secondary rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {job.stats?.interestedCount || 0}
                </div>
                <div className="text-xs theme-text-muted">Interesados</div>
              </div>
              <div className="theme-bg-secondary rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {job.stats?.notInterestedCount || 0}
                </div>
                <div className="text-xs theme-text-muted">No interesados</div>
              </div>
            </div>
          </div>

          {/* Descripcion */}
          {job.description && (
            <div className="mb-4">
              <h4 className="text-sm font-medium theme-text-primary mb-2">Descripcion</h4>
              <p className="text-sm theme-text-secondary whitespace-pre-wrap">
                {job.description}
              </p>
            </div>
          )}

          {/* Requisitos */}
          {job.requirements && (
            <div className="mb-4">
              <h4 className="text-sm font-medium theme-text-primary mb-2">Requisitos</h4>
              <p className="text-sm theme-text-secondary whitespace-pre-wrap">
                {job.requirements}
              </p>
            </div>
          )}

          {/* Salario y Horario */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {job.salary && (
              <div>
                <h4 className="text-sm font-medium theme-text-primary mb-1">Salario</h4>
                <p className="text-sm theme-text-secondary">{job.salary}</p>
              </div>
            )}
            {job.schedule && (
              <div>
                <h4 className="text-sm font-medium theme-text-primary mb-1">Horario</h4>
                <p className="text-sm theme-text-secondary">{job.schedule}</p>
              </div>
            )}
          </div>

          {/* Skills requeridos */}
          {job.requiredSkills && job.requiredSkills.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium theme-text-primary mb-2">Skills requeridos</h4>
              <div className="flex flex-wrap gap-2">
                {job.requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 bg-[#E10600] text-white rounded-full text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fechas */}
          <div className="border-t theme-border pt-4 mt-4">
            <div className="grid grid-cols-2 gap-4 text-xs theme-text-muted">
              <div>
                <span className="font-medium">Creada:</span> {formatDateTime(job.createdAt)}
              </div>
              <div>
                <span className="font-medium">Actualizada:</span> {formatDateTime(job.updatedAt)}
              </div>
            </div>
            <div className="mt-2 text-xs theme-text-muted">
              <span className="font-medium">ID:</span> <span className="font-mono">{job.id}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t theme-border flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={onToggleActive}
              disabled={isUpdating}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                job.active !== false
                  ? 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                  : 'bg-green-600 text-white hover:bg-green-700'
              } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isUpdating ? '...' : job.active !== false ? 'Desactivar' : 'Activar'}
            </button>
            <button
              onClick={() => onViewMatches(job.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#E10600] text-white hover:bg-[#c10500] transition-colors"
            >
              Ver matches
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium theme-bg-secondary theme-text-primary hover:opacity-80 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
