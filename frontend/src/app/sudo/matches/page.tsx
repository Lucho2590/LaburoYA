'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { AdminMatch, MatchStatus } from '@/types';

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<MatchStatus | ''>('');
  const [total, setTotal] = useState(0);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminMatches(
        statusFilter ? { status: statusFilter } : undefined
      );
      setMatches(data.matches);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar matches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [statusFilter]);

  const getStatusBadge = (status: MatchStatus) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    const labels = {
      pending: 'Pendiente',
      accepted: 'Aceptado',
      rejected: 'Rechazado',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <AdminLayout title="Matches">
      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="theme-text-secondary text-sm">Filtrar por estado:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MatchStatus | '')}
            className="theme-bg-card border theme-border rounded-lg px-3 py-2 text-sm theme-text-primary"
          >
            <option value="">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="accepted">Aceptados</option>
            <option value="rejected">Rechazados</option>
          </select>
        </div>
        <span className="theme-text-muted text-sm">
          {total} match{total !== 1 ? 'es' : ''}
        </span>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="theme-bg-card rounded-xl border theme-border overflow-hidden">
        <table className="w-full">
          <thead className="theme-bg-secondary">
            <tr>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">ID</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Trabajador</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Empleador</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Puesto</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Estado</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y theme-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]"></div>
                  </div>
                </td>
              </tr>
            ) : matches.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center theme-text-muted">
                  No se encontraron matches
                </td>
              </tr>
            ) : (
              matches.map((match) => (
                <tr key={match.id} className="hover:theme-bg-secondary transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm theme-text-primary">
                      {match.id.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {match.worker ? (
                      <Link
                        href={`/sudo/users/${match.workerId}`}
                        className="text-[#E10600] hover:underline"
                      >
                        {match.worker.puesto} - {match.worker.zona || 'Sin zona'}
                      </Link>
                    ) : (
                      <span className="theme-text-muted">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {match.employer ? (
                      <Link
                        href={`/sudo/users/${match.employerId}`}
                        className="text-[#E10600] hover:underline"
                      >
                        {match.employer.businessName}
                      </Link>
                    ) : (
                      <span className="theme-text-muted">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 theme-text-primary">
                    {match.puesto}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(match.status)}
                  </td>
                  <td className="px-6 py-4 theme-text-secondary text-sm">
                    {formatDate(match.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
