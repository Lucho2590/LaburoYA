'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { IMatch } from '@/types';

export function useMatches() {
  const { user, authReady } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!user && authReady;
  const queryKey = ['matches', user?.uid];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => api.getMatches() as Promise<IMatch[]>,
    enabled,
  });

  const updateMatchStatus = async (matchId: string, status: 'accepted' | 'rejected') => {
    await api.updateMatchStatus(matchId, status);
    await queryClient.invalidateQueries({ queryKey });
  };

  return {
    matches: data ?? [],
    // Spinner solo en la primera carga; al volver con cache no hay loading.
    loading: !enabled || isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    updateMatchStatus,
  };
}
