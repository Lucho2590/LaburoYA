'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/hooks/useChat';

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.matchId as string;
  const { user, userData, loading } = useAuth();
  const { chat, messages, loading: chatLoading, error: chatError, sendMessage, refreshMessages } = useChat(matchId);

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(refreshMessages, 5000);
    return () => clearInterval(interval);
  }, [refreshMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(newMessage.trim());
      setNewMessage('');
      inputRef.current?.focus();
    } catch {
      // Error handled in hook
    } finally {
      setSending(false);
    }
  };

  if (loading || chatLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  const isWorker = userData?.role === 'worker' ||
    (userData?.role === 'superuser' && userData?.secondaryRole === 'worker');

  // Handle error - e.g., worker trying to access a chat that hasn't been created yet
  if (chatError || !chat) {
    return (
      <div className="min-h-screen theme-bg-primary flex flex-col">
        <header className="theme-bg-secondary border-b theme-border sticky top-0 z-40 safe-area-top">
          <div className="flex items-center px-2 h-14">
            <Link href="/matches" className="p-2 touch-manipulation">
              <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="font-semibold theme-text-primary ml-2 flex-1">Chat</h1>
            <span className="text-sm font-bold bg-gradient-to-r from-[#E10600] to-[#FF6A00] bg-clip-text text-transparent mr-2">
              LaburoYA
            </span>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-20 h-20 bg-[#FF6A00]/20 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">⏳</span>
          </div>
          <h2 className="text-xl font-semibold theme-text-primary mb-2">
            {isWorker ? 'Esperando al empleador' : 'Chat no disponible'}
          </h2>
          <p className="theme-text-secondary mb-6">
            {isWorker
              ? 'El empleador te va a contactar pronto. Te avisaremos cuando inicie el chat.'
              : 'Hubo un problema al cargar el chat.'}
          </p>
          <Link href="/matches">
            <button className="bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white px-6 py-3 rounded-xl font-medium active:scale-95 transition-transform">
              Volver a matches
            </button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen theme-bg-primary flex flex-col">
      {/* Header */}
      <header className="theme-bg-secondary border-b theme-border sticky top-0 z-40 safe-area-top">
        <div className="flex items-center px-2 h-14">
          <Link href="/chats" className="p-2 touch-manipulation">
            <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="flex items-center flex-1 ml-2">
            <div className="w-10 h-10 bg-gradient-to-br from-[#E10600] to-[#FF6A00] rounded-full flex items-center justify-center text-white font-semibold mr-3">
              {isWorker ? '🏢' : '👤'}
            </div>
            <div>
              <h1 className="font-semibold theme-text-primary">
                {isWorker
                  ? (chat?.participant?.businessName || 'Empresa')
                  : (chat?.participant?.firstName && chat?.participant?.lastName
                      ? `${chat.participant.firstName} ${chat.participant.lastName}`
                      : chat?.participant?.puesto || 'Trabajador')}
              </h1>
              <p className="text-xs theme-text-muted">
                {isWorker
                  ? (chat?.participant?.rubro || '')
                  : (chat?.participant?.puesto || '')}
              </p>
            </div>
          </div>

          {/* Logo */}
          <span className="text-sm font-bold bg-gradient-to-r from-[#E10600] to-[#FF6A00] bg-clip-text text-transparent mr-2">
            LaburoYA
          </span>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-[#E10600]/20 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">👋</span>
            </div>
            <p className="theme-text-secondary">
              {isWorker ? '¡El empleador inició el chat!' : '¡Empezá la conversación!'}
            </p>
            <p className="theme-text-muted text-sm mt-1">
              {isWorker ? 'Presentate y contale sobre tu experiencia' : 'Presentate y coordiná una entrevista'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => {
              const isOwn = message.senderId === user?.uid;
              const showTime = index === messages.length - 1 ||
                messages[index + 1]?.senderId !== message.senderId;

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                      isOwn
                        ? 'bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-br-md'
                        : 'theme-bg-card theme-text-primary rounded-bl-md'
                    }`}
                  >
                    <p className="break-words">{message.text}</p>
                    {showTime && (
                      <p
                        className={`text-[10px] mt-1 ${
                          isOwn ? 'text-white/60' : 'theme-text-muted'
                        }`}
                      >
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Input */}
      <div className="theme-bg-secondary border-t theme-border safe-area-bottom">
        <form onSubmit={handleSend} className="flex items-center p-2 gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribí un mensaje..."
            className="flex-1 theme-bg-card rounded-full px-4 py-3 theme-text-primary placeholder:theme-text-muted focus:outline-none focus:ring-2 focus:ring-[#E10600]"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="w-12 h-12 bg-gradient-to-r from-[#E10600] to-[#FF6A00] rounded-full flex items-center justify-center text-white disabled:opacity-50 active:scale-95 transition-transform"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
