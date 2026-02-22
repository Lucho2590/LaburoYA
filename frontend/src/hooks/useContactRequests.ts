'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { IContactRequest } from '@/types';

export function useReceivedContactRequests() {
  const { user, authReady } = useAuth();
  const [requests, setRequests] = useState<IContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user || !authReady) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.getReceivedContactRequests();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  }, [user, authReady]);

  useEffect(() => {
    if (authReady) fetchRequests();
  }, [fetchRequests, authReady]);

  const respondToRequest = async (requestId: string, response: 'accepted' | 'rejected') => {
    try {
      const result = await api.respondToContactRequest(requestId, response);

      // Remove the request from local state
      setRequests(prev => prev.filter(r => r.id !== requestId));

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond');
      throw err;
    }
  };

  return {
    requests,
    loading,
    error,
    refetch: fetchRequests,
    respondToRequest,
  };
}

export function useSentContactRequests() {
  const { user, authReady } = useAuth();
  const [requests, setRequests] = useState<IContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user || !authReady) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.getSentContactRequests();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  }, [user, authReady]);

  useEffect(() => {
    if (authReady) fetchRequests();
  }, [fetchRequests, authReady]);

  return {
    requests,
    loading,
    error,
    refetch: fetchRequests,
  };
}

export function useContactRequestStatus(offerId: string | null) {
  const { user, authReady } = useAuth();
  const [status, setStatus] = useState<{
    hasSentRequest: boolean;
    sentRequest: { id: string; status: string } | null;
    hasReceivedRequest: boolean;
    receivedRequest: { id: string; status: string } | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!user || !authReady || !offerId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.getContactRequestStatus(offerId);
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, [user, authReady, offerId]);

  useEffect(() => {
    if (authReady && offerId) {
      fetchStatus();
    }
  }, [fetchStatus, authReady, offerId]);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus,
  };
}
