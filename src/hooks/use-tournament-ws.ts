"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface MatchUpdate {
  matchId: string;
  playerA: string;
  playerB: string;
  scoreA: number;
  scoreB: number;
  winner: string;
  status: string;
  timestamp: string;
}

interface TournamentState {
  tournamentId: string;
  status: string;
  liveMatches: number;
  completedMatches: number;
}

export function useTournamentWS(tournamentId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [tournamentState, setTournamentState] = useState<TournamentState | null>(null);
  const [matchUpdates, setMatchUpdates] = useState<MatchUpdate[]>([]);
  const [bracketUpdate, setBracketUpdate] = useState<{ timestamp: string } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!tournamentId) return;

    const socketInstance = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      setIsConnected(true);
      socketInstance.emit('join-tournament', tournamentId);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('tournament-state', (state: TournamentState) => {
      setTournamentState(state);
    });

    socketInstance.on('match-result', (update: MatchUpdate) => {
      setMatchUpdates((prev) => [update, ...prev.slice(0, 19)]);
    });

    socketInstance.on('bracket-refresh', (data: { timestamp: string }) => {
      setBracketUpdate(data);
    });

    return () => {
      socketInstance.emit('leave-tournament', tournamentId);
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [tournamentId]);

  const sendMatchUpdate = useCallback((data: {
    matchId: string;
    playerA: string;
    playerB: string;
    scoreA: number;
    scoreB: number;
    status: string;
  }) => {
    if (socketRef.current && isConnected && tournamentId) {
      socketRef.current.emit('match-update', {
        tournamentId,
        ...data,
      });
    }
  }, [isConnected, tournamentId]);

  return {
    isConnected,
    tournamentState,
    matchUpdates,
    bracketUpdate,
    sendMatchUpdate,
  };
}

export function useLeaderboardWS(sport: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [updates, setUpdates] = useState<Array<{ rank: number; name: string; points: number }>>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socketInstance = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('leaderboard-changed', (data: {
      sport: string;
      updates: Array<{ rank: number; name: string; points: number }>;
      timestamp: string;
    }) => {
      if (data.sport === sport) {
        setUpdates(data.updates);
      }
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [sport]);

  return { isConnected, updates };
}
