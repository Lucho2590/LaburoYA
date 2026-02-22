'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { IAppNotification } from '@/types';

export function useNotifications() {
  const { user, authReady } = useAuth();
  const [notifications, setNotifications] = useState<IAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user || !authReady) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.getNotifications({ limit: 50 });
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [user, authReady]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user || !authReady) return;

    try {
      const { count } = await api.getUnreadNotificationCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, [user, authReady]);

  useEffect(() => {
    if (authReady) fetchNotifications();
  }, [fetchNotifications, authReady]);

  // Poll for unread count every 30 seconds
  useEffect(() => {
    if (!user || !authReady) return;

    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user, authReady, fetchUnreadCount]);

  const markAsRead = async (notificationId: string) => {
    try {
      await api.markNotificationAsRead(notificationId);

      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as read');
      throw err;
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all as read');
      throw err;
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}

export function useUnreadNotificationCount() {
  const { user, authReady } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    if (!user || !authReady) return;

    try {
      setLoading(true);
      const { count: unreadCount } = await api.getUnreadNotificationCount();
      setCount(unreadCount);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    } finally {
      setLoading(false);
    }
  }, [user, authReady]);

  useEffect(() => {
    if (authReady) fetchCount();
  }, [fetchCount, authReady]);

  // Poll every 30 seconds
  useEffect(() => {
    if (!user || !authReady) return;

    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user, authReady, fetchCount]);

  return { count, loading, refetch: fetchCount };
}
