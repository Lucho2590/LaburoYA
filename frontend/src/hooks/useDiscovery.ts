'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { IDiscoveryOffersResponse, IDiscoveryWorkersResponse, IRelevantOffer, IRelevantWorker } from '@/types';

export function useDiscoveryOffers() {
  const { user, userData, authReady } = useAuth();
  const [data, setData] = useState<IDiscoveryOffersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    if (!user || !authReady) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.discoverOffers();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch offers');
    } finally {
      setLoading(false);
    }
  }, [user, authReady]);

  useEffect(() => {
    if (authReady && (userData?.role === 'worker' ||
        (userData?.role === 'superuser' && userData?.secondaryRole === 'worker'))) {
      fetchOffers();
    }
  }, [fetchOffers, userData, authReady]);

  const requestOffer = async (offerId: string) => {
    try {
      const result = await api.sendWorkerToOfferRequest(offerId);

      // Update local state to mark offer as requested
      if (data) {
        const updateOffer = (offer: IRelevantOffer) =>
          offer.id === offerId ? { ...offer, hasRequested: true } : offer;

        setData({
          ...data,
          fullMatch: data.fullMatch.map(updateOffer),
          partialMatch: data.partialMatch.map(updateOffer),
          skillsMatch: data.skillsMatch.map(updateOffer),
        });
      }

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
      throw err;
    }
  };

  return {
    offers: data,
    loading,
    error,
    refetch: fetchOffers,
    requestOffer,
  };
}

export function useDiscoveryWorkers() {
  const { user, userData, authReady } = useAuth();
  const [data, setData] = useState<IDiscoveryWorkersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkers = useCallback(async () => {
    if (!user || !authReady) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.discoverWorkers();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workers');
    } finally {
      setLoading(false);
    }
  }, [user, authReady]);

  useEffect(() => {
    if (authReady && (userData?.role === 'employer' ||
        (userData?.role === 'superuser' && userData?.secondaryRole === 'employer'))) {
      fetchWorkers();
    }
  }, [fetchWorkers, userData, authReady]);

  const requestWorker = async (workerId: string, offerId: string) => {
    try {
      const result = await api.sendEmployerToWorkerRequest(workerId, offerId);

      // Update local state to mark worker as requested
      if (data) {
        const updateWorker = (worker: IRelevantWorker) =>
          worker.uid === workerId ? { ...worker, hasRequested: true } : worker;

        setData({
          ...data,
          fullMatch: data.fullMatch.map(updateWorker),
          partialMatch: data.partialMatch.map(updateWorker),
          skillsMatch: data.skillsMatch.map(updateWorker),
        });
      }

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
      throw err;
    }
  };

  return {
    workers: data,
    loading,
    error,
    refetch: fetchWorkers,
    requestWorker,
  };
}

export function useDiscoveryWorkersForOffer(offerId: string) {
  const { user, authReady } = useAuth();
  const [data, setData] = useState<IDiscoveryWorkersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkers = useCallback(async () => {
    if (!user || !authReady || !offerId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.discoverWorkersForOffer(offerId);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workers');
    } finally {
      setLoading(false);
    }
  }, [user, authReady, offerId]);

  useEffect(() => {
    if (authReady) {
      fetchWorkers();
    }
  }, [fetchWorkers, authReady]);

  const requestWorker = async (workerId: string) => {
    try {
      const result = await api.sendEmployerToWorkerRequest(workerId, offerId);

      // Update local state to mark worker as requested
      if (data) {
        const updateWorker = (worker: IRelevantWorker) =>
          worker.uid === workerId ? { ...worker, hasRequested: true } : worker;

        setData({
          ...data,
          fullMatch: data.fullMatch.map(updateWorker),
          partialMatch: data.partialMatch.map(updateWorker),
          skillsMatch: data.skillsMatch.map(updateWorker),
        });
      }

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
      throw err;
    }
  };

  return {
    workers: data,
    loading,
    error,
    refetch: fetchWorkers,
    requestWorker,
  };
}
