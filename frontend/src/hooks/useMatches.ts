'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Match } from '@/types';

export function useMatches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.getMatches() as Match[];
      setMatches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  }, [user]);

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
