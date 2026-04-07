"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface GroupChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
  };
  content: string;
  type: 'TEXT' | 'IMAGE' | 'SYSTEM' | 'ANNOUNCEMENT';
  imageUrl?: string | null;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
}

export interface TypingUser {
  userId: string;
  timestamp: string;
}

export interface UseGroupChatOptions {
  chatId: string | null;
  enabled?: boolean;
}

export function useGroupChat({ chatId, enabled = true }: UseGroupChatOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!chatId || !enabled) return;

    // Connect to WebSocket server
    const socketInstance = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setError(null);
      // Join the group chat room
      socketInstance.emit('join-group-chat', chatId);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      setError('Failed to connect to chat server');
      console.error('[GroupChat] Connection error:', err);
    });

    // Handle incoming messages
    socketInstance.on('group-message', (message: GroupChatMessage) => {
      setMessages((prev) => {
        // Avoid duplicates
        const exists = prev.some((m) => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });
    });

    // Handle typing indicators
    socketInstance.on('user-typing', (data: { chatId: string; userId: string; timestamp: string }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(data.userId, { userId: data.userId, timestamp: data.timestamp });
        return next;
      });
    });

    socketInstance.on('user-stopped-typing', (data: { chatId: string; userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    });

    // Handle errors
    socketInstance.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    // Handle read confirmation
    socketInstance.on('read-confirmed', (data: { chatId: string; timestamp: string }) => {
      // Could be used to update UI
    });

    return () => {
      if (chatId) {
        socketInstance.emit('leave-group-chat', chatId);
      }
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [chatId, enabled]);

  // Send message via WebSocket
  const sendMessage = useCallback((content: string, type: 'TEXT' | 'IMAGE' | 'ANNOUNCEMENT' = 'TEXT', imageUrl?: string) => {
    if (!socketRef.current || !isConnected || !chatId) {
      return false;
    }

    socketRef.current.emit('send-group-message', {
      chatId,
      content,
      type,
      imageUrl,
    });

    return true;
  }, [isConnected, chatId]);

  // Start typing indicator
  const startTyping = useCallback(() => {
    if (!socketRef.current || !isConnected || !chatId) return;
    socketRef.current.emit('typing-start', chatId);
  }, [isConnected, chatId]);

  // Stop typing indicator
  const stopTyping = useCallback(() => {
    if (!socketRef.current || !isConnected || !chatId) return;
    socketRef.current.emit('typing-stop', chatId);
  }, [isConnected, chatId]);

  // Mark messages as read
  const markAsRead = useCallback(() => {
    if (!socketRef.current || !isConnected || !chatId) return;
    socketRef.current.emit('mark-read', chatId);
  }, [isConnected, chatId]);

  // Set initial messages (from API fetch)
  const setInitialMessages = useCallback((msgs: GroupChatMessage[]) => {
    setMessages(msgs);
  }, []);

  // Add a single message
  const addMessage = useCallback((message: GroupChatMessage) => {
    setMessages((prev) => {
      const exists = prev.some((m) => m.id === message.id);
      if (exists) return prev;
      return [...prev, message];
    });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isConnected,
    messages,
    typingUsers: Array.from(typingUsers.values()),
    error,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    setInitialMessages,
    addMessage,
    clearError,
  };
}

// Hook to list all group chats for a tournament
export function useTournamentChats(tournamentId: string | null) {
  const [chats, setChats] = useState<Array<{
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    isReadOnly: boolean;
    membersCount: number;
    unreadCount: number;
    userRole: string | null;
    lastMessage?: {
      content: string;
      createdAt: string;
      sender: { firstName: string; lastName: string };
    };
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    if (!tournamentId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/group-chats?tournamentId=${tournamentId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chats');
      }

      const data = await response.json();
      setChats(data.groupChats.map((chat: Record<string, unknown>) => ({
        id: chat.id,
        name: chat.name,
        type: chat.type,
        isActive: chat.isActive,
        isReadOnly: chat.isReadOnly,
        membersCount: (chat.members as Array<unknown>)?.length || 0,
        unreadCount: chat.unreadCount || 0,
        userRole: chat.userRole,
        lastMessage: (chat.messages as Array<Record<string, unknown>>)?.[0] ? {
          content: (chat.messages as Array<Record<string, unknown>>)[0].content as string,
          createdAt: (chat.messages as Array<Record<string, unknown>>)[0].createdAt as string,
          sender: (chat.messages as Array<Record<string, unknown>>)[0].sender as { firstName: string; lastName: string },
        } : undefined,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chats');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  return { chats, loading, error, refetch: fetchChats };
}
