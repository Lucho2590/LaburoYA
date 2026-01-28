'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { AdminJobOffer } from '@/types';

export default function AdminJobsPage() {
  const [jobOffers, setJobOffers] = useState<AdminJobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [total, setTotal] = useState(0);

  const fetchJobOffers = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminJobOffers(
        activeFilter !== undefined ? { active: activeFilter } : undefined
      );
      setJobOffers(data.jobOffers);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar ofertas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobOffers();
  }, [activeFilter]);

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <AdminLayout title="Ofertas de Trabajo">
      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="theme-text-secondary text-sm">Filtrar por estado:</label>
          <select
            value={activeFilter === undefined ? '' : activeFilter.toString()}
            onChange={(e) => {
              const val = e.target.value;
              setActiveFilter(val === '' ? undefined : val === 'true');
            }}
            className="theme-bg-card border theme-border rounded-lg px-3 py-2 text-sm theme-text-primary"
          >
            <option value="">Todas</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </select>
        </div>
        <span className="theme-text-muted text-sm">
          {total} oferta{total !== 1 ? 's' : ''}
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
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Rubro</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Puesto</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Empleador</th>
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
            ) : jobOffers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center theme-text-muted">
                  No se encontraron ofertas
                </td>
              </tr>
            ) : (
              jobOffers.map((job) => (
                <tr key={job.id} className="hover:theme-bg-secondary transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm theme-text-primary">
                      {job.id.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="px-6 py-4 theme-text-primary">
                    {job.rubro}
                  </td>
                  <td className="px-6 py-4 theme-text-primary">
                    {job.puesto}
                  </td>
                  <td className="px-6 py-4">
                    {job.employer ? (
                      <Link
                        href={`/sudo/users/${job.employerId}`}
                        className="text-[#E10600] hover:underline"
                      >
                        {job.employer.businessName}
                      </Link>
                    ) : (
                      <span className="theme-text-muted">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {job.active !== false ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Activa
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                        Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 theme-text-secondary text-sm">
                    {formatDate(job.createdAt)}
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
