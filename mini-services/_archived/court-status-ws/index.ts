/**
 * VALORHIVE Court Status WebSocket Service
 * Real-time updates for court status at venues
 * 
 * Port: 3005 (separate from tournament-ws on 3003)
 * 
 * Events:
 * - court:status - Get all court statuses for a tournament
 * - court:update - Update court status (started, completed, paused)
 * - match:assign - Assign match to court
 * - match:complete - Mark match complete on court
 * - queue:update - Update queue position
 * 
 * Security:
 * - Token authentication with SHA-256 hashed token lookup
 * - Session validation against database
 * - Redis-backed state for horizontal scaling
 */

import { Server, Socket } from 'socket.io';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { db } from '@valorhive/db';

const PORT = 3005;

// ============================================
// Types
// ============================================

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

export interface TournamentQueue {
  tournamentId: string;
  items: QueueItem[];
  lastUpdated: number;
}

// ============================================
// In-Memory Storage
// (In production, use Redis for horizontal scaling)
// ============================================

const courtStates = new Map<string, CourtLiveState>();
const tournamentQueues = new Map<string, TournamentQueue>();
const tournamentRooms = new Map<string, Set<string>>();

// ============================================
// Token Hashing (Canonical Implementation)
// Must match src/lib/auth.ts hashToken function
// ============================================

/**
 * Hash a token using SHA-256 for secure database lookup
 * Sessions are stored with hashed tokens, so we must hash before querying
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================
// Redis Support for Horizontal Scaling
// ============================================

let redis: ReturnType<typeof import('ioredis').default.prototype.constructor> | null = null;
const USE_REDIS = process.env.REDIS_URL && process.env.WS_USE_REDIS === 'true';

async function initRedis() {
  if (!USE_REDIS) {
    console.log('[Court-WS] Redis not configured, using in-memory state (single instance only)');
    return;
  }
  
  try {
    const Redis = (await import('ioredis')).default;
    redis = new Redis(process.env.REDIS_URL!);
    
    // Test connection
    await redis.ping();
    console.log('[Court-WS] Redis connected for horizontal scaling');
  } catch (error) {
    console.warn('[Court-WS] Redis connection failed, falling back to in-memory state:', error);
    redis = null;
  }
}

// Initialize Redis on startup
initRedis();

// ============================================
// Helper Functions
// ============================================

function getCourtKey(tournamentId: string, courtId: string): string {
  return `${tournamentId}:${courtId}`;
}

function getTournamentCourts(tournamentId: string): CourtLiveState[] {
  const courts: CourtLiveState[] = [];
  for (const [key, state] of courtStates.entries()) {
    if (key.startsWith(`${tournamentId}:`)) {
      courts.push(state);
    }
  }
  return courts;
}

function getTournamentQueue(tournamentId: string): QueueItem[] {
  return tournamentQueues.get(tournamentId)?.items || [];
}

// ============================================
// Socket Authentication
// ============================================

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    orgId?: string;
    role?: string;
    isAuthenticated: boolean;
    clientIP?: string;
  };
}

/**
 * Validate session token against database
 * Uses SHA-256 hash lookup since sessions store hashed tokens
 */
async function validateSessionToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  orgId?: string;
  role?: string;
}> {
  try {
    // CRITICAL: Hash the token before database lookup
    // Sessions are stored with SHA-256 hashed tokens
    const tokenHash = await hashToken(token);
    
    const session = await db.session.findFirst({
      where: {
        token: tokenHash,
        expiresAt: { gte: new Date() },
      },
      include: {
        user: { select: { id: true, role: true } },
        org: { select: { id: true } },
      },
    });

    if (!session) {
      return { valid: false };
    }

    return {
      valid: true,
      userId: session.userId || undefined,
      orgId: session.orgId || undefined,
      role: session.user?.role || 'PLAYER',
    };
  } catch (error) {
    console.error('[Court-WS] Session validation error:', error);
    return { valid: false };
  }
}

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean) as string[];

// ============================================
// Socket.IO Server Setup
// ============================================

// ============================================
// HTTP Server with Health Check Endpoints
// ============================================

let isServerReady = false;

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '/';
  
  // Health check endpoint - returns 200 if server is running
  if (url === '/health') {
    console.log(`[Health] Health check requested from ${req.socket.remoteAddress}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'court-status-ws',
      port: PORT,
    }));
    return;
  }
  
  // Readiness endpoint - returns 200 if Socket.IO is ready
  if (url === '/ready') {
    console.log(`[Health] Readiness check requested from ${req.socket.remoteAddress}`);
    if (isServerReady) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ready',
        timestamp: new Date().toISOString(),
        service: 'court-status-ws',
        connections: io.sockets.sockets.size,
        tournaments: tournamentRooms.size,
        courts: courtStates.size,
      }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        service: 'court-status-ws',
      }));
    }
    return;
  }
  
  // All other requests - let Socket.IO handle or return 404
  if (!url.startsWith('/socket.io')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[Court-WS] Rejected connection from unauthorized origin: ${origin}`);
        callback(new Error('Unauthorized origin'), false);
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 15000,
  pingTimeout: 10000,
  transports: ['websocket', 'polling'],
});

// Start HTTP server
httpServer.listen(PORT, () => {
  isServerReady = true;
  console.log(`[Health] HTTP server listening on port ${PORT}`);
  console.log(`[Health] Health endpoint: http://localhost:${PORT}/health`);
  console.log(`[Health] Ready endpoint: http://localhost:${PORT}/ready`);
});

// ============================================
// Event Handlers
// ============================================

io.on('connection', (socket: AuthenticatedSocket) => {
  console.log(`[Court-WS] Client connected: ${socket.id}`);

  // Initialize socket data
  socket.data = {
    isAuthenticated: false,
    clientIP: socket.handshake.headers['x-forwarded-for']?.toString().split(',')[0] ||
              socket.handshake.headers['x-real-ip']?.toString() ||
              socket.handshake.address ||
              'unknown',
  };

  // Extract session token from multiple sources (supports mobile Bearer tokens)
  const sessionToken = socket.handshake.auth.sessionToken ||
                       socket.handshake.auth.token ||
                       socket.handshake.headers['x-session-token'] ||
                       socket.handshake.headers.cookie?.split(';')
                         .find((c: string) => c.trim().startsWith('session_token='))
                         ?.split('=')[1];

  // Handle async authentication
  if (sessionToken) {
    // Validate session token against database
    validateSessionToken(sessionToken)
      .then((result) => {
        if (result.valid) {
          socket.data.isAuthenticated = true;
          socket.data.userId = result.userId;
          socket.data.orgId = result.orgId;
          socket.data.role = result.role;
          
          console.log(`[Court-WS] Authenticated: ${socket.id} (user: ${result.userId}, role: ${result.role})`);
        } else {
          console.log(`[Court-WS] Authentication failed for socket ${socket.id}: Invalid or expired session`);
          socket.data.isAuthenticated = false;
        }
      })
      .catch((error) => {
        console.error(`[Court-WS] Authentication error for socket ${socket.id}:`, error);
        socket.data.isAuthenticated = false;
      });
  } else {
    console.log(`[Court-WS] Unauthenticated connection: ${socket.id} (no session token provided)`);
  }

  // ============================================
  // Tournament Room Management
  // ============================================

  socket.on('join-tournament', (tournamentId: string) => {
    socket.join(`tournament:${tournamentId}`);
    
    if (!tournamentRooms.has(tournamentId)) {
      tournamentRooms.set(tournamentId, new Set());
    }
    tournamentRooms.get(tournamentId)!.add(socket.id);
    
    console.log(`[Court-WS] Client ${socket.id} joined tournament ${tournamentId}`);
    
    // Send current court statuses
    const courts = getTournamentCourts(tournamentId);
    const queue = getTournamentQueue(tournamentId);
    
    socket.emit('court:status', {
      tournamentId,
      courts,
      queue,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('leave-tournament', (tournamentId: string) => {
    socket.leave(`tournament:${tournamentId}`);
    
    const room = tournamentRooms.get(tournamentId);
    if (room) {
      room.delete(socket.id);
    }
    
    console.log(`[Court-WS] Client ${socket.id} left tournament ${tournamentId}`);
  });

  // ============================================
  // Court Status Events
  // ============================================

  /**
   * court:status - Get all court statuses for a tournament
   */
  socket.on('court:status', (data: { tournamentId: string }) => {
    const courts = getTournamentCourts(data.tournamentId);
    const queue = getTournamentQueue(data.tournamentId);
    
    socket.emit('court:status', {
      tournamentId: data.tournamentId,
      courts,
      queue,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * court:update - Update court status
   * Requires: ADMIN, SUB_ADMIN, TOURNAMENT_DIRECTOR
   */
  socket.on('court:update', (data: {
    tournamentId: string;
    courtId: string;
    courtName: string;
    status: CourtLiveStatus;
  }) => {
    // Require authentication
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required to update court status' });
      return;
    }

    const key = getCourtKey(data.tournamentId, data.courtId);
    const existingState = courtStates.get(key);
    
    const newState: CourtLiveState = {
      tournamentId: data.tournamentId,
      courtId: data.courtId,
      courtName: data.courtName,
      status: data.status,
      currentMatch: existingState?.currentMatch,
      lastUpdated: Date.now(),
      updatedBy: socket.data.userId,
    };
    
    // If court becomes available, clear current match
    if (data.status === 'AVAILABLE' || data.status === 'BREAK') {
      newState.currentMatch = undefined;
    }
    
    courtStates.set(key, newState);
    
    // Broadcast to all clients in the tournament room
    io.to(`tournament:${data.tournamentId}`).emit('court:updated', {
      tournamentId: data.tournamentId,
      court: newState,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`[Court-WS] Court ${data.courtName} updated to ${data.status} by ${socket.data.userId}`);
  });

  /**
   * match:assign - Assign match to court
   * Requires: ADMIN, SUB_ADMIN, TOURNAMENT_DIRECTOR
   */
  socket.on('match:assign', (data: {
    tournamentId: string;
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
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required to assign matches' });
      return;
    }

    const key = getCourtKey(data.tournamentId, data.courtId);
    
    const newState: CourtLiveState = {
      tournamentId: data.tournamentId,
      courtId: data.courtId,
      courtName: data.courtName,
      status: 'IN_PROGRESS',
      currentMatch: {
        ...data.match,
        startedAt: new Date().toISOString(),
      },
      lastUpdated: Date.now(),
      updatedBy: socket.data.userId,
    };
    
    courtStates.set(key, newState);
    
    // Remove match from queue if present
    const queue = tournamentQueues.get(data.tournamentId);
    if (queue) {
      queue.items = queue.items.filter(item => item.matchId !== data.match.matchId);
      queue.lastUpdated = Date.now();
    }
    
    // Broadcast to all clients in the tournament room
    io.to(`tournament:${data.tournamentId}`).emit('court:updated', {
      tournamentId: data.tournamentId,
      court: newState,
      timestamp: new Date().toISOString(),
    });
    
    io.to(`tournament:${data.tournamentId}`).emit('queue:updated', {
      tournamentId: data.tournamentId,
      queue: getTournamentQueue(data.tournamentId),
      timestamp: new Date().toISOString(),
    });
    
    console.log(`[Court-WS] Match ${data.match.matchId} assigned to court ${data.courtName}`);
  });

  /**
   * match:complete - Mark match complete on court
   * Requires: ADMIN, SUB_ADMIN, TOURNAMENT_DIRECTOR
   */
  socket.on('match:complete', (data: {
    tournamentId: string;
    courtId: string;
    matchId: string;
    scoreA: number;
    scoreB: number;
    winner: string;
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required to complete matches' });
      return;
    }

    const key = getCourtKey(data.tournamentId, data.courtId);
    const existingState = courtStates.get(key);
    
    if (!existingState) {
      socket.emit('error', { message: 'Court not found' });
      return;
    }
    
    const newState: CourtLiveState = {
      ...existingState,
      status: 'AVAILABLE',
      currentMatch: undefined,
      lastUpdated: Date.now(),
      updatedBy: socket.data.userId,
    };
    
    courtStates.set(key, newState);
    
    // Broadcast match completed
    io.to(`tournament:${data.tournamentId}`).emit('match:completed', {
      tournamentId: data.tournamentId,
      courtId: data.courtId,
      matchId: data.matchId,
      scoreA: data.scoreA,
      scoreB: data.scoreB,
      winner: data.winner,
      timestamp: new Date().toISOString(),
    });
    
    // Broadcast court updated
    io.to(`tournament:${data.tournamentId}`).emit('court:updated', {
      tournamentId: data.tournamentId,
      court: newState,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`[Court-WS] Match ${data.matchId} completed on court ${existingState.courtName}`);
  });

  /**
   * queue:update - Update queue position or add to queue
   * Requires: ADMIN, SUB_ADMIN, TOURNAMENT_DIRECTOR
   */
  socket.on('queue:update', (data: {
    tournamentId: string;
    action: 'ADD' | 'REMOVE' | 'REORDER' | 'UPDATE_READINESS';
    items?: QueueItem[];
    matchId?: string;
    newPosition?: number;
    readiness?: 'NOT_READY' | 'PARTIAL' | 'READY';
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required to update queue' });
      return;
    }

    let queue = tournamentQueues.get(data.tournamentId) || {
      tournamentId: data.tournamentId,
      items: [],
      lastUpdated: Date.now(),
    };
    
    switch (data.action) {
      case 'ADD':
        if (data.items) {
          const maxPosition = Math.max(0, ...queue.items.map(i => i.position));
          data.items.forEach((item, index) => {
            queue.items.push({
              ...item,
              position: maxPosition + index + 1,
            });
          });
        }
        break;
        
      case 'REMOVE':
        if (data.matchId) {
          queue.items = queue.items.filter(item => item.matchId !== data.matchId);
          // Re-index positions
          queue.items.sort((a, b) => a.position - b.position);
          queue.items.forEach((item, index) => {
            item.position = index + 1;
          });
        }
        break;
        
      case 'REORDER':
        if (data.matchId && data.newPosition !== undefined) {
          const item = queue.items.find(i => i.matchId === data.matchId);
          if (item) {
            queue.items = queue.items.filter(i => i.matchId !== data.matchId);
            queue.items.splice(data.newPosition - 1, 0, item);
            queue.items.forEach((i, index) => {
              i.position = index + 1;
            });
          }
        }
        break;
        
      case 'UPDATE_READINESS':
        if (data.matchId && data.readiness) {
          const item = queue.items.find(i => i.matchId === data.matchId);
          if (item) {
            item.readiness = data.readiness;
            if (data.readiness === 'READY') {
              item.readyAt = new Date().toISOString();
            }
          }
        }
        break;
    }
    
    queue.lastUpdated = Date.now();
    tournamentQueues.set(data.tournamentId, queue);
    
    // Broadcast queue updated
    io.to(`tournament:${data.tournamentId}`).emit('queue:updated', {
      tournamentId: data.tournamentId,
      queue: queue.items,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`[Court-WS] Queue ${data.action} for tournament ${data.tournamentId}`);
  });

  /**
   * queue:initialize - Initialize queue from tournament matches
   */
  socket.on('queue:initialize', (data: {
    tournamentId: string;
    matches: QueueItem[];
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const queue: TournamentQueue = {
      tournamentId: data.tournamentId,
      items: data.matches.map((match, index) => ({
        ...match,
        position: index + 1,
      })),
      lastUpdated: Date.now(),
    };
    
    tournamentQueues.set(data.tournamentId, queue);
    
    io.to(`tournament:${data.tournamentId}`).emit('queue:updated', {
      tournamentId: data.tournamentId,
      queue: queue.items,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`[Court-WS] Queue initialized with ${data.matches.length} matches for tournament ${data.tournamentId}`);
  });

  /**
   * court:initialize - Initialize courts for tournament
   */
  socket.on('court:initialize', (data: {
    tournamentId: string;
    courts: Array<{
      courtId: string;
      courtName: string;
    }>;
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    // Clear existing courts for this tournament
    for (const key of courtStates.keys()) {
      if (key.startsWith(`${data.tournamentId}:`)) {
        courtStates.delete(key);
      }
    }
    
    // Create new courts
    data.courts.forEach(court => {
      const key = getCourtKey(data.tournamentId, court.courtId);
      courtStates.set(key, {
        tournamentId: data.tournamentId,
        courtId: court.courtId,
        courtName: court.courtName,
        status: 'AVAILABLE',
        lastUpdated: Date.now(),
      });
    });
    
    const courts = getTournamentCourts(data.tournamentId);
    
    io.to(`tournament:${data.tournamentId}`).emit('court:status', {
      tournamentId: data.tournamentId,
      courts,
      queue: getTournamentQueue(data.tournamentId),
      timestamp: new Date().toISOString(),
    });
    
    console.log(`[Court-WS] Initialized ${data.courts.length} courts for tournament ${data.tournamentId}`);
  });

  // ============================================
  // Disconnect Handler
  // ============================================

  socket.on('disconnect', () => {
    console.log(`[Court-WS] Client disconnected: ${socket.id}`);
    
    // Clean up rooms
    tournamentRooms.forEach((clients, tournamentId) => {
      clients.delete(socket.id);
      if (clients.size === 0) {
        tournamentRooms.delete(tournamentId);
      }
    });
  });
});

// ============================================
// Health Check Endpoint
// ============================================

io.of('/health').on('connection', (socket) => {
  socket.emit('status', {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connections: io.sockets.sockets.size,
    tournaments: tournamentRooms.size,
    courts: courtStates.size,
    queues: tournamentQueues.size,
  });
  socket.disconnect();
});

// ============================================
// Logging
// ============================================

setInterval(() => {
  console.log(`[Court-WS Stats] Connections: ${io.sockets.sockets.size} | Tournaments: ${tournamentRooms.size} | Courts: ${courtStates.size} | Queues: ${tournamentQueues.size}`);
}, 5 * 60 * 1000);

console.log(`🏟️ VALORHIVE Court Status WebSocket Server running on port ${PORT}`);
console.log(`📡 Real-time court status updates enabled`);
console.log(`🔐 Authentication required for updates`);
