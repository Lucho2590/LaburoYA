'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Message, Chat } from '@/types';

export function useChat(matchId?: string) {
  const { user } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initializeChat = useCallback(async () => {
    if (!user || !matchId) return;

    try {
      setLoading(true);
      setError(null);
      const chatData = await api.getOrCreateChat(matchId) as Chat;
      setChat(chatData);

      const messagesData = await api.getChatMessages(chatData.id) as Message[];
      setMessages(messagesData);
    } catch (err) {
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
      const newMessage = await api.sendMessage(chat.id, text) as Message;
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
      const messagesData = await api.getChatMessages(chat.id) as Message[];
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
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.getMyChats() as Chat[];
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
