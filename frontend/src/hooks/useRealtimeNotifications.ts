'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { IAppNotification } from '@/types';
import { toast } from 'sonner';

export function useRealtimeNotifications() {
  const { user, authReady } = useAuth();
  const [notifications, setNotifications] = useState<IAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user || !authReady || !db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Query notifications for this user, ordered by createdAt desc
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs: IAppNotification[] = [];
        let unread = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const notification: IAppNotification = {
            id: doc.id,
            userId: data.userId,
            type: data.type,
            title: data.title,
            body: data.body,
            data: data.data || {},
            read: data.read || false,
            readAt: data.readAt?.toDate?.()?.toISOString(),
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
          };
          notifs.push(notification);
          if (!notification.read) unread++;
        });

        // Check for new notifications (compare with previous state)
        setNotifications((prev) => {
          // Find truly new notifications (not in previous list)
          const prevIds = new Set(prev.map(n => n.id));
          const newNotifs = notifs.filter(n => !prevIds.has(n.id) && !n.read);

          // Show toast for new notifications
          newNotifs.forEach((notif) => {
            showNotificationToast(notif);
          });

          return notifs;
        });

        setUnreadCount(unread);
        setLoading(false);
      },
      (err) => {
        console.error('[RealtimeNotifications] Error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [user, authReady]);

  // Mark a single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!db) return;

    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, {
        read: true,
        readAt: new Date(),
      });
      // State will be updated automatically by the listener
    } catch (err) {
      console.error('[RealtimeNotifications] Error marking as read:', err);
      throw err;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!db || !user) return;

    try {
      const firestore = db; // Local variable for TypeScript narrowing
      const batch = writeBatch(firestore);
      const unreadNotifs = notifications.filter(n => !n.read);

      unreadNotifs.forEach((notif) => {
        const notifRef = doc(firestore, 'notifications', notif.id);
        batch.update(notifRef, {
          read: true,
          readAt: new Date(),
        });
      });

      await batch.commit();
      // State will be updated automatically by the listener
    } catch (err) {
      console.error('[RealtimeNotifications] Error marking all as read:', err);
      throw err;
    }
  }, [notifications, user]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
  };
}

// Helper to show toast notification
function showNotificationToast(notification: IAppNotification) {
  const icon = getNotificationIcon(notification.type);
  toast(notification.title, {
    description: notification.body,
    icon,
    duration: 5000,
  });
}

// Get appropriate icon for notification type
function getNotificationIcon(type: string): string {
  switch (type) {
    case 'match_created':
      return '🎉';
    case 'contact_request_received':
      return '📩';
    case 'contact_request_accepted':
      return '✅';
    case 'contact_request_rejected':
      return '❌';
    case 'new_message':
      return '💬';
    default:
      return '🔔';
  }
}
