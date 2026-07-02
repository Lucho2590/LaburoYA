'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { IDiscoveryOffersResponse, IDiscoveryWorkersResponse, IRelevantOffer, IRelevantWorker } from '@/types';

export function useDiscoveryOffers() {
  const { user, userData, authReady } = useAuth();
  const queryClient = useQueryClient();
  const enabled = authReady && !!user && (
    userData?.role === 'worker' ||
    (userData?.role === 'superuser' && userData?.secondaryRole === 'worker')
  );
  const queryKey = ['discovery', 'offers', user?.uid];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => api.discoverOffers(),
    enabled,
  });

  const requestOffer = async (offerId: string) => {
    const result = await api.sendWorkerToOfferRequest(offerId);
    queryClient.setQueryData<IDiscoveryOffersResponse>(queryKey, (prev) => {
      if (!prev) return prev;
      const updateOffer = (offer: IRelevantOffer) =>
        offer.id === offerId ? { ...offer, hasRequested: true } : offer;
      return {
        ...prev,
        fullMatch: prev.fullMatch.map(updateOffer),
        partialMatch: prev.partialMatch.map(updateOffer),
        skillsMatch: prev.skillsMatch.map(updateOffer),
      };
    });
    return result;
  };

  const markNotInterested = async (offerId: string) => {
    await api.markOfferNotInterested(offerId);
    queryClient.setQueryData<IDiscoveryOffersResponse>(queryKey, (prev) => {
      if (!prev) return prev;
      const filterOffer = (offer: IRelevantOffer) => offer.id !== offerId;
      return {
        ...prev,
        fullMatch: prev.fullMatch.filter(filterOffer),
        partialMatch: prev.partialMatch.filter(filterOffer),
        skillsMatch: prev.skillsMatch.filter(filterOffer),
        total: prev.total - 1,
      };
    });
    return { success: true };
  };

  return {
    offers: data ?? null,
    loading: !enabled || isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    requestOffer,
    markNotInterested,
  };
}

export function useDiscoveryWorkers() {
  const { user, userData, authReady } = useAuth();
  const queryClient = useQueryClient();
  // Empleadores, empresas, y superusers actuando como tales (secondaryRole o
  // impersonando una empresa) ven candidatos.
  const isEmployerView = userData?.role === 'employer' || userData?.role === 'company' ||
    (userData?.role === 'superuser' &&
      (userData?.secondaryRole === 'employer' || !!userData?.impersonating?.companyId));
  const enabled = authReady && !!user && isEmployerView;
  const queryKey = ['discovery', 'workers', user?.uid];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => api.discoverWorkers(),
    enabled,
  });

  const requestWorker = async (workerId: string, offerId: string) => {
    const result = await api.sendEmployerToWorkerRequest(workerId, offerId);
    queryClient.setQueryData<IDiscoveryWorkersResponse>(queryKey, (prev) => {
      if (!prev) return prev;
      const updateWorker = (worker: IRelevantWorker) =>
        worker.uid === workerId ? { ...worker, hasRequested: true } : worker;
      return {
        ...prev,
        fullMatch: prev.fullMatch.map(updateWorker),
        partialMatch: prev.partialMatch.map(updateWorker),
        skillsMatch: prev.skillsMatch.map(updateWorker),
      };
    });
    return result;
  };

  return {
    workers: data ?? null,
    loading: !enabled || isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    requestWorker,
  };
}

export function useDiscoveryWorkersForOffer(offerId: string) {
  const { user, authReady } = useAuth();
  const queryClient = useQueryClient();
  const enabled = authReady && !!user && !!offerId;
  const queryKey = ['discovery', 'workersForOffer', offerId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => api.discoverWorkersForOffer(offerId),
    enabled,
  });

  const requestWorker = async (workerId: string) => {
    const result = await api.sendEmployerToWorkerRequest(workerId, offerId);
    queryClient.setQueryData<IDiscoveryWorkersResponse>(queryKey, (prev) => {
      if (!prev) return prev;
      const updateWorker = (worker: IRelevantWorker) =>
        worker.uid === workerId ? { ...worker, hasRequested: true } : worker;
      return {
        ...prev,
        fullMatch: prev.fullMatch.map(updateWorker),
        partialMatch: prev.partialMatch.map(updateWorker),
        skillsMatch: prev.skillsMatch.map(updateWorker),
      };
    });
    return result;
  };

  return {
    workers: data ?? null,
    loading: !enabled || isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    requestWorker,
  };
}
