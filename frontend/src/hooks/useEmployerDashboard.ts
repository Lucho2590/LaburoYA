'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export type EmployerDashboardData = Awaited<ReturnType<typeof api.getEmployerDashboard>>;

// Dashboard del empleador cacheado: es la query más pesada del backend, así que
// evitar re-fetchearla en cada visita a Home tiene alto impacto.
export function useEmployerDashboard(enabled: boolean) {
  const { user, authReady } = useAuth();
  const active = enabled && !!user && authReady;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['employerDashboard', user?.uid],
    queryFn: () => api.getEmployerDashboard(),
    enabled: active,
  });

  return {
    dashboard: data ?? null,
    loading: active && isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
