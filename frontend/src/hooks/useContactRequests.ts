'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { IContactRequest } from '@/types';

export function useReceivedContactRequests() {
  const { user, authReady } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!user && authReady;
  const queryKey = ['contactRequests', 'received', user?.uid];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => api.getReceivedContactRequests(),
    enabled,
  });

  const respondToRequest = async (requestId: string, response: 'accepted' | 'rejected') => {
    const result = await api.respondToContactRequest(requestId, response);
    // Sacar la solicitud del cache de inmediato (optimista).
    queryClient.setQueryData<IContactRequest[]>(queryKey, (prev) =>
      (prev ?? []).filter((r) => r.id !== requestId)
    );
    return result;
  };

  return {
    requests: data ?? [],
    loading: !enabled || isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    respondToRequest,
  };
}

export function useSentContactRequests() {
  const { user, authReady } = useAuth();
  const enabled = !!user && authReady;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['contactRequests', 'sent', user?.uid],
    queryFn: () => api.getSentContactRequests(),
    enabled,
  });

  return {
    requests: data ?? [],
    loading: !enabled || isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}

export function useContactRequestStatus(offerId: string | null) {
  const { user, authReady } = useAuth();
  const enabled = !!user && authReady && !!offerId;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['contactRequestStatus', offerId],
    queryFn: () => api.getContactRequestStatus(offerId as string),
    enabled,
  });

  return {
    status: data ?? null,
    // Este hook original arrancaba en loading=false; mantenemos: solo hay
    // spinner si está habilitado y realmente cargando por primera vez.
    loading: enabled && isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
