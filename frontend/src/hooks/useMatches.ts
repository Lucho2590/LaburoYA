'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { IMatch } from '@/types';

export function useMatches() {
  const { user, authReady } = useAuth();
  const [matches, setMatches] = useState<IMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    if (!user || !authReady) return;

    try {
      setLoading(true);
      setError(null);
      console.log('[useMatches] Fetching matches...');
      const data = await api.getMatches() as IMatch[];
      console.log('[useMatches] Matches received:', data.length, data);
      setMatches(data);
    } catch (err) {
      console.error('[useMatches] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  }, [user, authReady]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const updateMatchStatus = async (matchId: string, status: 'accepted' | 'rejected') => {
    try {
      await api.updateMatchStatus(matchId, status);
      await fetchMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update match');
      throw err;
    }
  };

  return {
    matches,
    loading,
    error,
    refetch: fetchMatches,
    updateMatchStatus,
  };
}
