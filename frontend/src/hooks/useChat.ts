'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { IMessage, IChat } from '@/types';

export function useChat(matchId?: string) {
  const { user } = useAuth();
  const [chat, setChat] = useState<IChat | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initializeChat = useCallback(async () => {
    if (!user || !matchId) return;

    try {
      setLoading(true);
      setError(null);
      console.log('[useChat] Initializing chat for matchId:', matchId);
      const chatData = await api.getOrCreateChat(matchId) as IChat;
      console.log('[useChat] Chat data received:', chatData);
      setChat(chatData);

      const messagesData = await api.getChatMessages(chatData.id) as IMessage[];
      console.log('[useChat] Messages received:', messagesData.length);
      setMessages(messagesData);
    } catch (err) {
      console.error('[useChat] Error initializing chat:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [user, matchId]);

  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  const sendMessage = async (text: string) => {
    if (!chat) return;

    try {
      const newMessage = await api.sendMessage(chat.id, text) as IMessage;
      setMessages((prev) => [...prev, newMessage]);
      return newMessage;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      throw err;
    }
  };

  const refreshMessages = async () => {
    if (!chat) return;

    try {
      const messagesData = await api.getChatMessages(chat.id) as IMessage[];
      setMessages(messagesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh messages');
    }
  };

  return {
    chat,
    messages,
    loading,
    error,
    sendMessage,
    refreshMessages,
  };
}

export function useChats() {
  const { user } = useAuth();
  const [chats, setChats] = useState<IChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.getMyChats() as IChat[];
      setChats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chats');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  return {
    chats,
    loading,
    error,
    refetch: fetchChats,
  };
}
