"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Types matching the court-status-ws service
export type CourtLiveStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'BREAK' | 'MAINTENANCE';

export interface CourtLiveState {
  tournamentId: string;
  courtId: string;
  courtName: string;
  status: CourtLiveStatus;
  currentMatch?: {
    matchId: string;
    bracketMatchId: string;
    playerA: string;
    playerB: string;
    round: number;
    matchNumber: number;
    scoreA?: number;
    scoreB?: number;
    startedAt?: string;
  };
  lastUpdated: number;
  updatedBy?: string;
}

export interface QueueItem {
  matchId: string;
  bracketMatchId: string;
  playerA: string;
  playerB: string;
  round: number;
  matchNumber: number;
  position: number;
  priority: number;
  readiness: 'NOT_READY' | 'PARTIAL' | 'READY';
  readyAt?: string;
  queuedAt: string;
}

export interface CourtStatusResponse {
  tournamentId: string;
  courts: CourtLiveState[];
  queue: QueueItem[];
  timestamp: string;
}

export interface MatchCompletedEvent {
  tournamentId: string;
  courtId: string;
  matchId: string;
  scoreA: number;
  scoreB: number;
  winner: string;
  timestamp: string;
}

export interface UseCourtStatusOptions {
  sessionToken?: string;
  userId?: string;
  role?: string;
}

/**
 * Hook for real-time court status updates via WebSocket
 * 
 * Connects to the court-status-ws service on port 3005
 * 
 * @param tournamentId - The tournament ID to track
 * @param options - Optional authentication options
 * @returns courts, queue, connected status, and last update timestamp
 */
export function useCourtStatus(
  tournamentId: string | null,
  options: UseCourtStatusOptions = {}
) {
  const [connected, setConnected] = useState(false);
  const [courts, setCourts] = useState<CourtLiveState[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!tournamentId) return;

    // Connect to court-status-ws on port 3005 via gateway pattern
    const socketInstance = io('/?XTransformPort=3005', {
      transports: ['websocket', 'polling'],
      auth: {
        sessionToken: options.sessionToken,
        token: options.sessionToken,
        userId: options.userId,
        role: options.role,
      },
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      setConnected(true);
      setError(null);
      // Join the tournament room
      socketInstance.emit('join-tournament', tournamentId);
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    socketInstance.on('connect_error', (err: Error) => {
      setError(err.message);
      setConnected(false);
    });

    // Initial court status
    socketInstance.on('court:status', (data: CourtStatusResponse) => {
      setCourts(data.courts);
      setQueue(data.queue);
      setLastUpdate(new Date(data.timestamp));
    });

    // Court updated event
    socketInstance.on('court:updated', (data: { court: CourtLiveState; timestamp: string }) => {
      setCourts(prev => {
        const index = prev.findIndex(c => c.courtId === data.court.courtId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data.court;
          return updated;
        }
        return [...prev, data.court];
      });
      setLastUpdate(new Date(data.timestamp));
    });

    // Queue updated event
    socketInstance.on('queue:updated', (data: { queue: QueueItem[]; timestamp: string }) => {
      setQueue(data.queue);
      setLastUpdate(new Date(data.timestamp));
    });

    // Match completed event
    socketInstance.on('match:completed', (data: MatchCompletedEvent) => {
      // The court:updated event will handle clearing the court
      setLastUpdate(new Date(data.timestamp));
    });

    // Error event
    socketInstance.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    return () => {
      socketInstance.emit('leave-tournament', tournamentId);
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [tournamentId, options.sessionToken, options.userId, options.role]);

  /**
   * Request current court status
   */
  const refreshStatus = useCallback(() => {
    if (socketRef.current && connected && tournamentId) {
      socketRef.current.emit('court:status', { tournamentId });
    }
  }, [connected, tournamentId]);

  /**
   * Update court status
   */
  const updateCourtStatus = useCallback((data: {
    courtId: string;
    courtName: string;
    status: CourtLiveStatus;
  }) => {
    if (socketRef.current && connected && tournamentId) {
      socketRef.current.emit('court:update', {
        tournamentId,
        ...data,
      });
    }
  }, [connected, tournamentId]);

  /**
   * Assign match to court
   */
  const assignMatch = useCallback((data: {
    courtId: string;
    courtName: string;
    match: {
      matchId: string;
      bracketMatchId: string;
      playerA: string;
      playerB: string;
      round: number;
      matchNumber: number;
    };
  }) => {
    if (socketRef.current && connected && tournamentId) {
      socketRef.current.emit('match:assign', {
        tournamentId,
        ...data,
      });
    }
  }, [connected, tournamentId]);

  /**
   * Complete match on court
   */
  const completeMatch = useCallback((data: {
    courtId: string;
    matchId: string;
    scoreA: number;
    scoreB: number;
    winner: string;
  }) => {
    if (socketRef.current && connected && tournamentId) {
      socketRef.current.emit('match:complete', {
        tournamentId,
        ...data,
      });
    }
  }, [connected, tournamentId]);

  /**
   * Update queue
   */
  const updateQueue = useCallback((data: {
    action: 'ADD' | 'REMOVE' | 'REORDER' | 'UPDATE_READINESS';
    items?: QueueItem[];
    matchId?: string;
    newPosition?: number;
    readiness?: 'NOT_READY' | 'PARTIAL' | 'READY';
  }) => {
    if (socketRef.current && connected && tournamentId) {
      socketRef.current.emit('queue:update', {
        tournamentId,
        ...data,
      });
    }
  }, [connected, tournamentId]);

  /**
   * Initialize courts for tournament
   */
  const initializeCourts = useCallback((courtsData: Array<{
    courtId: string;
    courtName: string;
  }>) => {
    if (socketRef.current && connected && tournamentId) {
      socketRef.current.emit('court:initialize', {
        tournamentId,
        courts: courtsData,
      });
    }
  }, [connected, tournamentId]);

  /**
   * Initialize queue for tournament
   */
  const initializeQueue = useCallback((matches: QueueItem[]) => {
    if (socketRef.current && connected && tournamentId) {
      socketRef.current.emit('queue:initialize', {
        tournamentId,
        matches,
      });
    }
  }, [connected, tournamentId]);

  return {
    // State
    courts,
    queue,
    connected,
    lastUpdate,
    error,
    
    // Actions
    refreshStatus,
    updateCourtStatus,
    assignMatch,
    completeMatch,
    updateQueue,
    initializeCourts,
    initializeQueue,
  };
}

/**
 * Get status badge color for a court
 */
export function getCourtStatusColor(status: CourtLiveStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'BREAK':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'MAINTENANCE':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

/**
 * Get readiness badge color for a queue item
 */
export function getReadinessColor(readiness: QueueItem['readiness']): string {
  switch (readiness) {
    case 'READY':
      return 'bg-emerald-100 text-emerald-800';
    case 'PARTIAL':
      return 'bg-amber-100 text-amber-800';
    case 'NOT_READY':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}
