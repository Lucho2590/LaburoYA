'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { AdminStats } from '@/types';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.getAdminStats();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar estadisticas');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Dashboard">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    {
      label: 'Total Usuarios',
      value: stats?.totalUsers || 0,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      color: 'bg-blue-500',
    },
    {
      label: 'Total Matches',
      value: stats?.totalMatches || 0,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-green-500',
    },
    {
      label: 'Total Ofertas',
      value: stats?.totalJobOffers || 0,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      color: 'bg-orange-500',
    },
    {
      label: 'Ofertas Activas',
      value: stats?.activeJobOffers || 0,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      color: 'bg-emerald-500',
    },
  ];

  return (
    <AdminLayout title="Dashboard">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, index) => (
          <div key={index} className="theme-bg-card rounded-xl p-6 border theme-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="theme-text-secondary text-sm">{card.label}</p>
                <p className="text-3xl font-bold theme-text-primary mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} p-3 rounded-lg text-white`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by Role */}
        <div className="theme-bg-card rounded-xl p-6 border theme-border">
          <h3 className="text-lg font-semibold theme-text-primary mb-4">Usuarios por Rol</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="theme-text-secondary">Trabajadores</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${stats?.totalUsers ? (stats.usersByRole.worker / stats.totalUsers) * 100 : 0}%`
                    }}
                  />
                </div>
                <span className="theme-text-primary font-medium w-8 text-right">
                  {stats?.usersByRole.worker || 0}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="theme-text-secondary">Empleadores</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{
                      width: `${stats?.totalUsers ? (stats.usersByRole.employer / stats.totalUsers) * 100 : 0}%`
                    }}
                  />
                </div>
                <span className="theme-text-primary font-medium w-8 text-right">
                  {stats?.usersByRole.employer || 0}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="theme-text-secondary">Superusers</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#E10600] rounded-full"
                    style={{
                      width: `${stats?.totalUsers ? (stats.usersByRole.superuser / stats.totalUsers) * 100 : 0}%`
                    }}
                  />
                </div>
                <span className="theme-text-primary font-medium w-8 text-right">
                  {stats?.usersByRole.superuser || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Matches by Status */}
        <div className="theme-bg-card rounded-xl p-6 border theme-border">
          <h3 className="text-lg font-semibold theme-text-primary mb-4">Matches por Estado</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="theme-text-secondary">Pendientes</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 rounded-full"
                    style={{
                      width: `${stats?.totalMatches ? (stats.matchesByStatus.pending / stats.totalMatches) * 100 : 0}%`
                    }}
                  />
                </div>
                <span className="theme-text-primary font-medium w-8 text-right">
                  {stats?.matchesByStatus.pending || 0}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="theme-text-secondary">Aceptados</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{
                      width: `${stats?.totalMatches ? (stats.matchesByStatus.accepted / stats.totalMatches) * 100 : 0}%`
                    }}
                  />
                </div>
                <span className="theme-text-primary font-medium w-8 text-right">
                  {stats?.matchesByStatus.accepted || 0}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="theme-text-secondary">Rechazados</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{
                      width: `${stats?.totalMatches ? (stats.matchesByStatus.rejected / stats.totalMatches) * 100 : 0}%`
                    }}
                  />
                </div>
                <span className="theme-text-primary font-medium w-8 text-right">
                  {stats?.matchesByStatus.rejected || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
