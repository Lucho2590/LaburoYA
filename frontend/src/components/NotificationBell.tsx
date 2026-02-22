'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { IAppNotification } from '@/types';

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useRealtimeNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: IAppNotification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.data?.matchId) {
      router.push(`/chat/${notification.data.matchId}`);
    } else if (notification.data?.chatId) {
      router.push(`/chats`);
    } else if (notification.data?.requestId) {
      router.push('/matches');
    }

    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full theme-text-secondary hover:theme-bg-secondary transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#E10600] text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] theme-bg-card rounded-xl border theme-border shadow-lg overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b theme-border">
            <h3 className="font-semibold theme-text-primary">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-[#E10600] hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Marcar todas
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:theme-bg-secondary"
              >
                <X className="w-4 h-4 theme-text-muted" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E10600] mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-10 h-10 theme-text-muted mx-auto mb-2" />
                <p className="theme-text-muted text-sm">No hay notificaciones</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onClick,
}: {
  notification: IAppNotification;
  onClick: () => void;
}) {
  const icon = getNotificationIcon(notification.type);
  const timeAgo = formatTimeAgo(new Date(notification.createdAt));

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b theme-border last:border-b-0 hover:theme-bg-secondary transition-colors ${
        !notification.read ? 'bg-[#E10600]/5' : ''
      }`}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#E10600] to-[#FF6A00] flex items-center justify-center text-lg">
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm ${!notification.read ? 'font-semibold' : ''} theme-text-primary line-clamp-1`}>
              {notification.title}
            </p>
            {!notification.read && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-[#E10600] mt-1.5"></span>
            )}
          </div>
          <p className="text-sm theme-text-secondary line-clamp-2 mt-0.5">
            {notification.body}
          </p>
          <p className="text-xs theme-text-muted mt-1">{timeAgo}</p>
        </div>
      </div>
    </button>
  );
}

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

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `hace ${diffMins}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;

  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
