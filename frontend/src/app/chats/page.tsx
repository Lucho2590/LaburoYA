'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useChats } from '@/hooks/useChat';
import { MobileLayout } from '@/components/MobileLayout';

export default function ChatsPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const { chats, loading: chatsLoading } = useChats();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading || chatsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  const isWorker = userData?.role === 'worker';

  return (
    <MobileLayout title="Chats">
      {chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] px-8">
          <span className="text-6xl mb-4">💬</span>
          <p className="theme-text-primary font-medium text-lg text-center">
            No tenés conversaciones
          </p>
          <p className="theme-text-secondary text-sm text-center mt-2">
            Cuando aceptes un match, vas a poder chatear con {isWorker ? 'el empleador' : 'el trabajador'}
          </p>
          <Link href="/matches" className="mt-6">
            <button className="bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white px-6 py-3 rounded-xl font-medium active:scale-95 transition-transform">
              Ver matches
            </button>
          </Link>
        </div>
      ) : (
        <div className="divide-y theme-border">
          {chats.map((chat) => {
            const participantName = isWorker
              ? chat.participant?.businessName || 'Empresa'
              : chat.participant?.puesto || 'Trabajador';

            const initials = participantName
              .split(' ')
              .map(w => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            const timeAgo = chat.lastMessageAt
              ? formatTimeAgo(new Date(chat.lastMessageAt))
              : '';

            return (
              <Link key={chat.id} href={`/chat/${chat.matchId}`}>
                <div className="flex items-center px-4 py-3 active:opacity-70 transition-colors">
                  {/* Avatar */}
                  <div className="w-14 h-14 bg-gradient-to-br from-[#E10600] to-[#FF6A00] rounded-full flex items-center justify-center text-white font-semibold text-lg mr-3">
                    {initials}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold theme-text-primary truncate">
                        {participantName}
                      </h3>
                      {timeAgo && (
                        <span className="theme-text-muted text-xs ml-2 shrink-0">
                          {timeAgo}
                        </span>
                      )}
                    </div>
                    {chat.lastMessage ? (
                      <p className="theme-text-secondary text-sm truncate mt-0.5">
                        {chat.lastMessage}
                      </p>
                    ) : (
                      <p className="text-[#FF6A00] text-sm mt-0.5">
                        ¡Empezá la conversación!
                      </p>
                    )}
                  </div>

                  {/* Chevron */}
                  <svg className="w-5 h-5 theme-text-muted ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </MobileLayout>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
