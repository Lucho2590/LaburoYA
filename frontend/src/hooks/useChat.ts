'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { IMessage, IChat } from '@/types';

interface ChatData {
  chat: IChat;
  messages: IMessage[];
}

export function useChat(matchId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!user && !!matchId;
  const queryKey = ['chat', matchId];

  const { data, isLoading, error, refetch } = useQuery<ChatData>({
    queryKey,
    queryFn: async () => {
      const chat = (await api.getOrCreateChat(matchId as string)) as IChat;
      const messages = (await api.getChatMessages(chat.id)) as IMessage[];
      return { chat, messages };
    },
    enabled,
    // Los mensajes cambian seguido: revalidar al abrir el chat.
    staleTime: 0,
  });

  const sendMessage = async (text: string) => {
    if (!data?.chat) return;
    const newMessage = (await api.sendMessage(data.chat.id, text)) as IMessage;
    queryClient.setQueryData<ChatData>(queryKey, (prev) =>
      prev ? { ...prev, messages: [...prev.messages, newMessage] } : prev
    );
    return newMessage;
  };

  const refreshMessages = async () => {
    if (!data?.chat) return;
    await refetch();
  };

  return {
    chat: data?.chat ?? null,
    messages: data?.messages ?? [],
    loading: enabled && isLoading,
    error: error ? (error as Error).message : null,
    sendMessage,
    refreshMessages,
  };
}

export function useChats() {
  const { user } = useAuth();
  const enabled = !!user;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['chats', user?.uid],
    queryFn: () => api.getMyChats() as Promise<IChat[]>,
    enabled,
  });

  return {
    chats: data ?? [],
    loading: !enabled || isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
