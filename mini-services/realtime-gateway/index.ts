/**
 * VALORHIVE Unified Realtime Gateway
 * 
 * Consolidates tournament-ws (port 3003) and court-status-ws (port 3005) into a single
 * stateless gateway with Redis adapter for horizontal scaling.
 * 
 * Features:
 * - Tournament live updates (match results, bracket updates)
 * - Court status tracking (venue management)
 * - Match queue management
 * - Reconnection support with state recovery
 * - Redis-backed state for horizontal scaling
 * - Socket.IO Redis adapter for multi-instance support
 * - Proper authentication using canonical auth module
 * - HTTP health endpoint for Kubernetes probes
 * 
 * @module realtime-gateway
 */

import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createServer } from 'http';
import { db } from '@valorhive/db';
import {
  validateSessionToken,
  extractTokenFromSocketHandshake,
} from '@valorhive/auth';

const PORT = process.env.REALTIME_PORT || 3003;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// Allow in-memory fallback ONLY in development with explicit opt-in
// This is NEVER allowed in production for multi-instance safety
const DEV_ALLOW_IN_MEMORY = !IS_PRODUCTION && process.env.DEV_ALLOW_IN_MEMORY_STATE === 'true';

// ============================================
// Configuration
// ============================================

const CONNECTION_LIMITS = {
  MAX_CONNECTIONS_PER_USER: 5,
  MAX_CONNECTIONS_PER_IP: 200,
  CONNECTION_WINDOW_MS: 60 * 60 * 1000,
};

const HEARTBEAT_CONFIG = {
  PING_INTERVAL: 15000,
  PING_TIMEOUT: 10000,
  MAX_MISSED_PINGS: 3,
};

// Redis key prefixes
const REDIS_KEYS = {
  MATCH_STATE: 'ws:match:state:',
  COURT_STATUS: 'ws:court:status:',
  TOURNAMENT_QUEUE: 'ws:queue:',
  USER_CONNECTIONS: 'ws:connections:user:',
  IP_CONNECTIONS: 'ws:connections:ip:',
};

// ============================================
// Types
// ============================================

type CourtLiveStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'BREAK' | 'MAINTENANCE';
type MatchState = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';

interface CourtLiveState {
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

interface StoredMatchState {
  matchId: string;
  tournamentId: string;
  state: MatchState;
  scoreA: number;
  scoreB: number;
  playerAId: string;
  playerBId: string;
  winnerId?: string;
  courtAssignment?: string;
  lastUpdated: number;
}

interface QueueItem {
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

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    orgId?: string;
    role?: string;
    isAuthenticated: boolean;
    clientIP?: string;
    clientType?: 'web' | 'mobile';
    missedPings?: number;
    lastPong?: number;
  };
}

// ============================================
// Redis Setup
// ============================================

let redis: ReturnType<typeof import('ioredis').default.prototype.constructor> | null = null;
let redisPubClient: ReturnType<typeof import('ioredis').default.prototype.constructor> | null = null;
let redisSubClient: ReturnType<typeof import('ioredis').default.prototype.constructor> | null = null;
let redisConnected = false;

async function initRedis(): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;

  // PRODUCTION: Redis is MANDATORY - no fallback allowed
  if (IS_PRODUCTION) {
    if (!redisUrl) {
      console.error('[Realtime] FATAL: REDIS_URL is required in production environment');
      console.error('[Realtime] Service cannot start without Redis for multi-instance safety');
      return false;
    }

    try {
      const Redis = (await import('ioredis')).default;

      // Main Redis client for state storage
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: false,
      });

      // Pub/Sub clients for Socket.IO adapter
      redisPubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
      });
      redisSubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
      });

      // Test connections
      await Promise.all([
        redis.ping(),
        redisPubClient.ping(),
        redisSubClient.ping(),
      ]);

      redisConnected = true;
      console.log('[Realtime] Redis connected successfully');
      console.log('[Realtime] Redis adapter enabled for horizontal scaling');
      return true;
    } catch (error) {
      console.error('[Realtime] FATAL: Redis connection failed in production:', error);
      console.error('[Realtime] Service cannot start - Redis is mandatory for production');
      return false;
    }
  }

  // DEVELOPMENT: Allow optional Redis with explicit opt-in for in-memory mode
  if (!redisUrl) {
    if (DEV_ALLOW_IN_MEMORY) {
      console.log('[Realtime] DEV MODE: Running in IN-MEMORY mode (single instance only)');
      console.log('[Realtime] WARNING: State will be lost on restart, horizontal scaling not possible');
      return true;
    }

    console.warn('[Realtime] REDIS_URL not configured.');
    console.warn('[Realtime] Set REDIS_URL for Redis mode, or DEV_ALLOW_IN_MEMORY_STATE=true for development in-memory mode.');
    return false;
  }

  try {
    const Redis = (await import('ioredis')).default;

    // Main Redis client for state storage
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: false,
    });

    // Pub/Sub clients for Socket.IO adapter
    redisPubClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });
    redisSubClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });

    // Test connections
    await Promise.all([
      redis.ping(),
      redisPubClient.ping(),
      redisSubClient.ping(),
    ]);

    redisConnected = true;
    console.log('[Realtime] Redis connected successfully');
    console.log('[Realtime] Redis adapter enabled for horizontal scaling');
    return true;
  } catch (error) {
    console.error('[Realtime] Redis connection failed:', error);

    if (DEV_ALLOW_IN_MEMORY) {
      console.warn('[Realtime] DEV MODE: Falling back to IN-MEMORY mode due to Redis connection failure');
      redis = null;
      redisPubClient = null;
      redisSubClient = null;
      return true;
    }

    return false;
  }
}

// ============================================
// Local Connection Tracking (NOT authoritative state)
// These track local socket connections only - they are NOT used for
// match/court/queue state which MUST be Redis-backed for multi-instance
// ============================================

const userConnections = new Map<string, number>();
const ipConnections = new Map<string, number>();
const tournamentRooms = new Map<string, Set<string>>();
const adminSockets = new Set<string>();

// Development-only in-memory stores (NEVER used in production)
let devMatchStateStore: Map<string, StoredMatchState> | null = null;
let devCourtStatusStore: Map<string, CourtLiveState> | null = null;
let devTournamentQueueStore: Map<string, QueueItem[]> | null = null;

if (DEV_ALLOW_IN_MEMORY) {
  devMatchStateStore = new Map();
  devCourtStatusStore = new Map();
  devTournamentQueueStore = new Map();
  console.warn('[Realtime] DEV MODE: Using in-memory state stores. NOT suitable for production!');
}

/**
 * Check if Redis is available for state operations.
 * Throws an error in production if Redis is not connected.
 */
function requireRedis(): void {
  if (!redis || !redisConnected) {
    if (IS_PRODUCTION) {
      throw new Error('REDIS_UNAVAILABLE: Redis is required for state storage in production');
    }
    if (!DEV_ALLOW_IN_MEMORY) {
      throw new Error('REDIS_UNAVAILABLE: Redis is not connected. Set DEV_ALLOW_IN_MEMORY_STATE=true for development mode.');
    }
  }
}

// ============================================
// State Storage Functions
// ============================================

async function storeMatchState(state: StoredMatchState): Promise<void> {
  requireRedis();
  const key = `${REDIS_KEYS.MATCH_STATE}${state.matchId}`;
  const data = JSON.stringify(state);

  if (redis && redisConnected) {
    await redis.setex(key, 300, data);
  } else if (DEV_ALLOW_IN_MEMORY && devMatchStateStore) {
    // Development fallback only
    devMatchStateStore.set(key, state);
  }
}

async function getMatchState(matchId: string): Promise<StoredMatchState | null> {
  requireRedis();
  const key = `${REDIS_KEYS.MATCH_STATE}${matchId}`;

  if (redis && redisConnected) {
    const data = await redis.get(key);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return null;
  } else if (DEV_ALLOW_IN_MEMORY && devMatchStateStore) {
    // Development fallback only
    return devMatchStateStore.get(key) || null;
  }
  return null;
}

async function deleteMatchState(matchId: string): Promise<void> {
  requireRedis();
  const key = `${REDIS_KEYS.MATCH_STATE}${matchId}`;

  if (redis && redisConnected) {
    await redis.del(key);
  } else if (DEV_ALLOW_IN_MEMORY && devMatchStateStore) {
    // Development fallback only
    devMatchStateStore.delete(key);
  }
}

async function storeCourtStatus(state: CourtLiveState): Promise<void> {
  requireRedis();
  const key = `${REDIS_KEYS.COURT_STATUS}${state.tournamentId}:${state.courtId}`;
  const data = JSON.stringify(state);

  if (redis && redisConnected) {
    await redis.setex(key, 86400, data);
  } else if (DEV_ALLOW_IN_MEMORY && devCourtStatusStore) {
    // Development fallback only
    devCourtStatusStore.set(key, state);
  }
}

async function getCourtStatus(tournamentId: string, courtId: string): Promise<CourtLiveState | null> {
  requireRedis();
  const key = `${REDIS_KEYS.COURT_STATUS}${tournamentId}:${courtId}`;

  if (redis && redisConnected) {
    const data = await redis.get(key);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return null;
  } else if (DEV_ALLOW_IN_MEMORY && devCourtStatusStore) {
    // Development fallback only
    return devCourtStatusStore.get(key) || null;
  }
  return null;
}

async function getAllCourtStatuses(tournamentId: string): Promise<CourtLiveState[]> {
  requireRedis();

  if (redis && redisConnected) {
    const pattern = `${REDIS_KEYS.COURT_STATUS}${tournamentId}:*`;
    const keys: string[] = [];
    let cursor = '0';

    do {
      const result = await redis.scan(cursor, 'MATCH', pattern);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    const statuses: CourtLiveState[] = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        try {
          statuses.push(JSON.parse(data));
        } catch {
          // Skip invalid entries
        }
      }
    }
    return statuses;
  } else if (DEV_ALLOW_IN_MEMORY && devCourtStatusStore) {
    // Development fallback only
    const statuses: CourtLiveState[] = [];
    for (const [key, state] of devCourtStatusStore.entries()) {
      if (key.startsWith(`${REDIS_KEYS.COURT_STATUS}${tournamentId}:`)) {
        statuses.push(state);
      }
    }
    return statuses;
  }
  return [];
}

async function deleteAllCourtStatuses(tournamentId: string): Promise<void> {
  requireRedis();

  if (redis && redisConnected) {
    const pattern = `${REDIS_KEYS.COURT_STATUS}${tournamentId}:*`;
    let cursor = '0';

    do {
      const result = await redis.scan(cursor, 'MATCH', pattern);
      cursor = result[0];

      if (result[1].length > 0) {
        await redis.del(...result[1]);
      }
    } while (cursor !== '0');
  } else if (DEV_ALLOW_IN_MEMORY && devCourtStatusStore) {
    // Development fallback only
    for (const key of devCourtStatusStore.keys()) {
      if (key.startsWith(`${REDIS_KEYS.COURT_STATUS}${tournamentId}:`)) {
        devCourtStatusStore.delete(key);
      }
    }
  }
}

async function getTournamentQueue(tournamentId: string): Promise<QueueItem[]> {
  requireRedis();
  const key = `${REDIS_KEYS.TOURNAMENT_QUEUE}${tournamentId}`;

  if (redis && redisConnected) {
    const data = await redis.get(key);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return [];
      }
    }
    return [];
  } else if (DEV_ALLOW_IN_MEMORY && devTournamentQueueStore) {
    // Development fallback only
    return devTournamentQueueStore.get(tournamentId) || [];
  }
  return [];
}

async function storeTournamentQueue(tournamentId: string, items: QueueItem[]): Promise<void> {
  requireRedis();
  const key = `${REDIS_KEYS.TOURNAMENT_QUEUE}${tournamentId}`;
  const data = JSON.stringify(items);

  if (redis && redisConnected) {
    await redis.setex(key, 86400, data);
  } else if (DEV_ALLOW_IN_MEMORY && devTournamentQueueStore) {
    // Development fallback only
    devTournamentQueueStore.set(tournamentId, items);
  }
}

// ============================================
// Connection Tracking
// ============================================

async function checkAndIncrementConnectionLimit(
  key: string,
  maxLimit: number,
  identifier: string
): Promise<{ allowed: boolean; current: number }> {
  if (redis) {
    const redisKey = key === 'user'
      ? `${REDIS_KEYS.USER_CONNECTIONS}${identifier}`
      : `${REDIS_KEYS.IP_CONNECTIONS}${identifier}`;
    const current = await redis.incr(redisKey);

    if (current === 1) {
      await redis.expire(redisKey, CONNECTION_LIMITS.CONNECTION_WINDOW_MS / 1000);
    }

    if (current > maxLimit) {
      await redis.decr(redisKey);
      return { allowed: false, current };
    }

    return { allowed: true, current };
  } else {
    const current = (key === 'user' ? userConnections : ipConnections).get(identifier) || 0;
    if (current >= maxLimit) {
      return { allowed: false, current };
    }
    (key === 'user' ? userConnections : ipConnections).set(identifier, current + 1);
    return { allowed: true, current: current + 1 };
  }
}

async function decrementConnectionCount(key: string, identifier: string): Promise<void> {
  if (redis) {
    const redisKey = key === 'user'
      ? `${REDIS_KEYS.USER_CONNECTIONS}${identifier}`
      : `${REDIS_KEYS.IP_CONNECTIONS}${identifier}`;
    await redis.decr(redisKey);
  } else {
    const map = key === 'user' ? userConnections : ipConnections;
    const current = map.get(identifier) || 1;
    map.set(identifier, Math.max(0, current - 1));
  }
}

// ============================================
// HTTP Server & Health Endpoint
// ============================================

const httpServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz') {
    // In production, Redis MUST be connected for healthy status
    // In development, allow in-memory mode with explicit opt-in
    const isHealthy = redisConnected || (!IS_PRODUCTION && DEV_ALLOW_IN_MEMORY);

    const healthStatus = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'valorhive-realtime-gateway',
      version: '1.0.0',
      environment: NODE_ENV,
      redis: {
        connected: redisConnected,
        mode: redisConnected ? 'redis' : (DEV_ALLOW_IN_MEMORY ? 'in-memory-dev' : 'unavailable'),
        required: IS_PRODUCTION,
      },
      connections: {
        total: io?.sockets?.sockets?.size || 0,
        byIP: ipConnections.size,
        byUser: userConnections.size,
      },
      limits: CONNECTION_LIMITS,
    };

    // Return 503 in production if Redis is not connected
    const statusCode = isHealthy ? 200 : 503;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthStatus, null, 2));
    return;
  }

  if (req.url === '/ready' || req.url === '/readyz') {
    // Readiness check - service is ready to accept traffic
    // In production: Redis MUST be connected
    // In development: Allow in-memory mode with explicit opt-in
    const isReady = redisConnected || (!IS_PRODUCTION && DEV_ALLOW_IN_MEMORY);

    const readyStatus = {
      ready: isReady,
      timestamp: new Date().toISOString(),
      redis: redisConnected,
      mode: redisConnected ? 'redis' : (DEV_ALLOW_IN_MEMORY ? 'in-memory-dev' : 'unavailable'),
      productionMode: IS_PRODUCTION,
    };

    res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readyStatus, null, 2));
    return;
  }

  // Unknown route
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ============================================
// Socket Server Setup
// ============================================

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  process.env.NEXT_PUBLIC_BASE_URL,
  'https://valorhive.com',
  'https://www.valorhive.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean) as string[];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[Realtime] Rejected connection from unauthorized origin: ${origin}`);
        callback(new Error('Unauthorized origin'), false);
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: HEARTBEAT_CONFIG.PING_INTERVAL,
  pingTimeout: HEARTBEAT_CONFIG.PING_TIMEOUT,
  connectTimeout: 45000,
  allowUpgrades: true,
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6,
});

// ============================================
// Authentication Middleware
// ============================================

function getClientIP(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.toString().split(',')[0].trim();
  }

  const realIP = socket.handshake.headers['x-real-ip'];
  if (realIP) {
    return realIP.toString().trim();
  }

  return socket.handshake.address || 'unknown';
}

io.use(async (socket: AuthenticatedSocket, next) => {
  const clientIP = getClientIP(socket);
  socket.data.clientIP = clientIP;

  // IP-based connection limit
  const ipCheck = await checkAndIncrementConnectionLimit(
    'ip',
    CONNECTION_LIMITS.MAX_CONNECTIONS_PER_IP,
    clientIP
  );

  if (!ipCheck.allowed) {
    console.warn(`[Realtime] Connection rejected - IP limit exceeded: ${clientIP}`);
    return next(new Error('Too many connections from this IP address'));
  }

  // Extract and validate session token
  const sessionToken = extractTokenFromSocketHandshake(socket);

  // Detect client type
  const userAgent = socket.handshake.headers['user-agent'] || '';
  const isMobileClient = socket.handshake.auth.clientType === 'mobile' ||
    userAgent.includes('ReactNative') ||
    userAgent.includes('Flutter') ||
    userAgent.includes('VALORHIVE-Mobile');

  socket.data.clientType = isMobileClient ? 'mobile' : 'web';

  // Allow unauthenticated connections for viewing only
  if (!sessionToken) {
    console.log(`[Realtime] Unauthenticated connection: ${socket.id} from ${clientIP}`);
    socket.data = { isAuthenticated: false, clientIP, clientType: socket.data.clientType };

    socket.on('disconnect', async () => {
      await decrementConnectionCount('ip', clientIP);
    });

    return next();
  }

  try {
    // Validate session using canonical auth
    const session = await validateSessionToken(sessionToken);

    if (!session) {
      console.log(`[Realtime] Invalid session for socket: ${socket.id}`);
      socket.data = { isAuthenticated: false, clientIP, clientType: socket.data.clientType };
      return next();
    }

    const userId = session.userId || undefined;

    // User-based connection limit
    if (userId) {
      const userCheck = await checkAndIncrementConnectionLimit(
        'user',
        CONNECTION_LIMITS.MAX_CONNECTIONS_PER_USER,
        userId
      );

      if (!userCheck.allowed) {
        await decrementConnectionCount('ip', clientIP);
        console.warn(`[Realtime] Connection rejected - User limit exceeded: ${userId}`);
        return next(new Error('Connection limit exceeded for user'));
      }
    }

    socket.data = {
      userId,
      orgId: session.orgId || undefined,
      role: session.user?.role || 'PLAYER',
      isAuthenticated: true,
      clientIP,
      clientType: socket.data.clientType,
    };

    // Track admin sockets
    if (['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR'].includes(socket.data.role || '')) {
      adminSockets.add(socket.id);
    }

    console.log(`[Realtime] Authenticated: ${socket.id} (user: ${userId}, role: ${socket.data.role})`);

    socket.on('disconnect', async () => {
      await decrementConnectionCount('ip', clientIP);
      if (userId) {
        await decrementConnectionCount('user', userId);
      }
      adminSockets.delete(socket.id);
    });

    next();
  } catch (error) {
    console.error('[Realtime] Socket auth error:', error);
    socket.data = { isAuthenticated: false, clientIP, clientType: socket.data.clientType };
    next();
  }
});

// ============================================
// Event Handlers
// ============================================

io.on('connection', (socket: AuthenticatedSocket) => {
  console.log(`[Realtime] Client connected: ${socket.id} (auth: ${socket.data.isAuthenticated})`);

  // ============================================
  // Tournament Room Management
  // ============================================

  socket.on('join-tournament', async (tournamentId: string) => {
    socket.join(`tournament:${tournamentId}`);

    if (!tournamentRooms.has(tournamentId)) {
      tournamentRooms.set(tournamentId, new Set());
    }
    tournamentRooms.get(tournamentId)!.add(socket.id);

    console.log(`[Realtime] Client ${socket.id} joined tournament ${tournamentId}`);

    // Send current state
    socket.emit('tournament-state', {
      tournamentId,
      status: 'IN_PROGRESS',
    });

    // Send court statuses for reconnection
    try {
      const courtStatuses = await getAllCourtStatuses(tournamentId);
      if (courtStatuses.length > 0) {
        socket.emit('court-statuses', {
          tournamentId,
          courts: courtStatuses,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`[Realtime] Error fetching court statuses:`, error);
    }
  });

  socket.on('leave-tournament', (tournamentId: string) => {
    socket.leave(`tournament:${tournamentId}`);

    const room = tournamentRooms.get(tournamentId);
    if (room) {
      room.delete(socket.id);
    }

    console.log(`[Realtime] Client ${socket.id} left tournament ${tournamentId}`);
  });

  // ============================================
  // Match Result Updates
  // ============================================

  socket.on('match-update', async (data: {
    tournamentId: string;
    matchId: string;
    playerA: string;
    playerB: string;
    scoreA: number;
    scoreB: number;
    status: string;
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const allowedRoles = ['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR'];
    const isOrg = socket.data.orgId !== undefined;

    if (!allowedRoles.includes(socket.data.role || '') && !isOrg) {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }

    io.to(`tournament:${data.tournamentId}`).emit('match-result', {
      matchId: data.matchId,
      playerA: data.playerA,
      playerB: data.playerB,
      scoreA: data.scoreA,
      scoreB: data.scoreB,
      winner: data.scoreA > data.scoreB ? data.playerA : data.playerB,
      status: data.status,
      timestamp: new Date().toISOString(),
      updatedBy: socket.data.userId || socket.data.orgId,
    });

    await storeMatchState({
      matchId: data.matchId,
      tournamentId: data.tournamentId,
      state: data.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
      scoreA: data.scoreA,
      scoreB: data.scoreB,
      playerAId: data.playerA,
      playerBId: data.playerB,
      winnerId: data.scoreA > data.scoreB ? data.playerA : data.playerB,
      lastUpdated: Date.now(),
    });

    console.log(`[Realtime] Match ${data.matchId} updated by ${socket.data.userId || socket.data.orgId}`);
  });

  // ============================================
  // Bracket Updates
  // ============================================

  socket.on('bracket-update', (data: {
    tournamentId: string;
    bracketData: unknown;
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const allowedRoles = ['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR'];
    const isOrg = socket.data.orgId !== undefined;

    if (!allowedRoles.includes(socket.data.role || '') && !isOrg) {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }

    io.to(`tournament:${data.tournamentId}`).emit('bracket-refresh', {
      bracketData: data.bracketData,
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================
  // Court Status Events
  // ============================================

  socket.on('court-status-update', async (data: {
    tournamentId: string;
    courtId: string;
    courtName?: string;
    status: CourtLiveStatus;
    currentMatchId?: string;
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const allowedRoles = ['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR'];
    const isOrg = socket.data.orgId !== undefined;

    if (!allowedRoles.includes(socket.data.role || '') && !isOrg) {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }

    const courtState: CourtLiveState = {
      tournamentId: data.tournamentId,
      courtId: data.courtId,
      courtName: data.courtName || `Court ${data.courtId}`,
      status: data.status,
      currentMatch: undefined,
      lastUpdated: Date.now(),
      updatedBy: socket.data.userId || socket.data.orgId,
    };

    await storeCourtStatus(courtState);

    io.to(`tournament:${data.tournamentId}`).emit('court-status-changed', {
      tournamentId: data.tournamentId,
      courtId: data.courtId,
      courtName: courtState.courtName,
      status: data.status,
      currentMatchId: data.currentMatchId,
      lastUpdated: courtState.lastUpdated,
      updatedBy: courtState.updatedBy,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Realtime] Court ${data.courtId} updated to ${data.status}`);
  });

  socket.on('court-statuses', async (data: { tournamentId: string }) => {
    try {
      const courtStatuses = await getAllCourtStatuses(data.tournamentId);
      const queue = await getTournamentQueue(data.tournamentId);

      socket.emit('court-statuses', {
        tournamentId: data.tournamentId,
        courts: courtStatuses,
        queue,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[Realtime] Error fetching court statuses:`, error);
      socket.emit('error', { message: 'Failed to fetch court statuses' });
    }
  });

  // ============================================
  // Match Queue Events
  // ============================================

  socket.on('match:assign', async (data: {
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
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const courtState: CourtLiveState = {
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

    await storeCourtStatus(courtState);

    // Remove match from queue
    const queue = await getTournamentQueue(data.tournamentId);
    const updatedQueue = queue.filter(item => item.matchId !== data.match.matchId);
    await storeTournamentQueue(data.tournamentId, updatedQueue);

    io.to(`tournament:${data.tournamentId}`).emit('court:updated', {
      tournamentId: data.tournamentId,
      court: courtState,
      timestamp: new Date().toISOString(),
    });

    io.to(`tournament:${data.tournamentId}`).emit('queue:updated', {
      tournamentId: data.tournamentId,
      queue: updatedQueue,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Realtime] Match ${data.match.matchId} assigned to court ${data.courtName}`);
  });

  socket.on('match:complete', async (data: {
    tournamentId: string;
    courtId: string;
    matchId: string;
    scoreA: number;
    scoreB: number;
    winner: string;
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const existingState = await getCourtStatus(data.tournamentId, data.courtId);

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

    await storeCourtStatus(newState);

    io.to(`tournament:${data.tournamentId}`).emit('match:completed', {
      tournamentId: data.tournamentId,
      courtId: data.courtId,
      matchId: data.matchId,
      scoreA: data.scoreA,
      scoreB: data.scoreB,
      winner: data.winner,
      timestamp: new Date().toISOString(),
    });

    io.to(`tournament:${data.tournamentId}`).emit('court:updated', {
      tournamentId: data.tournamentId,
      court: newState,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Realtime] Match ${data.matchId} completed on court ${existingState.courtName}`);
  });

  socket.on('queue:update', async (data: {
    tournamentId: string;
    action: 'ADD' | 'REMOVE' | 'REORDER' | 'UPDATE_READINESS';
    items?: QueueItem[];
    matchId?: string;
    newPosition?: number;
    readiness?: 'NOT_READY' | 'PARTIAL' | 'READY';
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    let queue = await getTournamentQueue(data.tournamentId);

    switch (data.action) {
      case 'ADD':
        if (data.items) {
          const maxPosition = Math.max(0, ...queue.map(i => i.position));
          data.items.forEach((item, index) => {
            queue.push({
              ...item,
              position: maxPosition + index + 1,
            });
          });
        }
        break;

      case 'REMOVE':
        if (data.matchId) {
          queue = queue.filter(item => item.matchId !== data.matchId);
          queue.sort((a, b) => a.position - b.position);
          queue.forEach((item, index) => {
            item.position = index + 1;
          });
        }
        break;

      case 'REORDER':
        if (data.matchId && data.newPosition !== undefined) {
          const item = queue.find(i => i.matchId === data.matchId);
          if (item) {
            queue = queue.filter(i => i.matchId !== data.matchId);
            queue.splice(data.newPosition - 1, 0, item);
            queue.forEach((i, index) => {
              i.position = index + 1;
            });
          }
        }
        break;

      case 'UPDATE_READINESS':
        if (data.matchId && data.readiness) {
          const item = queue.find(i => i.matchId === data.matchId);
          if (item) {
            item.readiness = data.readiness;
            if (data.readiness === 'READY') {
              item.readyAt = new Date().toISOString();
            }
          }
        }
        break;
    }

    await storeTournamentQueue(data.tournamentId, queue);

    io.to(`tournament:${data.tournamentId}`).emit('queue:updated', {
      tournamentId: data.tournamentId,
      queue,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Realtime] Queue ${data.action} for tournament ${data.tournamentId}`);
  });

  socket.on('queue:initialize', async (data: {
    tournamentId: string;
    matches: QueueItem[];
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const queue: QueueItem[] = data.matches.map((match, index) => ({
      ...match,
      position: index + 1,
    }));

    await storeTournamentQueue(data.tournamentId, queue);

    io.to(`tournament:${data.tournamentId}`).emit('queue:updated', {
      tournamentId: data.tournamentId,
      queue,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Realtime] Queue initialized with ${data.matches.length} matches`);
  });

  // ============================================
  // Reconnection Support
  // ============================================

  socket.on('recover-match-state', async (matchId: string) => {
    const state = await getMatchState(matchId);

    if (state) {
      socket.emit('match-state-recovered', {
        matchId: state.matchId,
        tournamentId: state.tournamentId,
        state: state.state,
        scoreA: state.scoreA,
        scoreB: state.scoreB,
        playerAId: state.playerAId,
        playerBId: state.playerBId,
        winnerId: state.winnerId,
        courtAssignment: state.courtAssignment,
        recoveredAt: Date.now(),
      });

      console.log(`[Realtime] Match state recovered for ${matchId}`);
    } else {
      socket.emit('match-state-not-found', { matchId });
    }
  });

  // ============================================
  // Heartbeat
  // ============================================

  socket.on('pong', () => {
    socket.data.lastPong = Date.now();
    socket.data.missedPings = 0;
  });

  // ============================================
  // Disconnect
  // ============================================

  socket.on('disconnect', () => {
    console.log(`[Realtime] Client disconnected: ${socket.id}`);

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
// Socket.IO Health Check Namespace (Legacy)
// ============================================

io.of('/health').on('connection', (socket) => {
  const isHealthy = redisConnected || (!IS_PRODUCTION && DEV_ALLOW_IN_MEMORY);

  socket.emit('status', {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    connections: {
      total: io.sockets.sockets.size,
      byIP: ipConnections.size,
      byUser: userConnections.size,
      redisEnabled: redisConnected,
    },
    limits: CONNECTION_LIMITS,
    productionMode: IS_PRODUCTION,
  });
  socket.disconnect();
});

// ============================================
// Initialization
// ============================================

async function start() {
  // Initialize Redis first
  const redisOk = await initRedis();

  if (!redisOk) {
    console.error('[Realtime] Failed to initialize required dependencies. Exiting.');
    process.exit(1);
  }

  // Configure Socket.IO Redis adapter if Redis is available
  if (redisPubClient && redisSubClient) {
    try {
      io.adapter(createAdapter(redisPubClient, redisSubClient));
      console.log('[Realtime] Socket.IO Redis adapter configured for horizontal scaling');
    } catch (error) {
      console.error('[Realtime] Failed to configure Redis adapter:', error);
      if (IS_PRODUCTION) {
        console.error('[Realtime] FATAL: Redis adapter required in production');
        process.exit(1);
      }
    }
  }

  // Start HTTP server
  httpServer.listen(PORT, () => {
    console.log(`🎮 VALORHIVE Unified Realtime Gateway running on port ${PORT}`);
    console.log(`📡 Tournament updates + Court status tracking enabled`);
    console.log(`🔐 Authentication required for updates`);
    console.log(`🛡️ Connection limits: ${CONNECTION_LIMITS.MAX_CONNECTIONS_PER_USER}/user, ${CONNECTION_LIMITS.MAX_CONNECTIONS_PER_IP}/IP`);
    console.log(`💓 Heartbeat: ${HEARTBEAT_CONFIG.PING_INTERVAL}ms interval, ${HEARTBEAT_CONFIG.PING_TIMEOUT}ms timeout`);
    console.log(`🔄 Redis: ${redisConnected ? 'enabled (adapter + state)' : 'disabled'}${DEV_ALLOW_IN_MEMORY ? ' (DEV in-memory mode)' : ''}`);
    console.log(`🏥 Health endpoints: http://localhost:${PORT}/health, http://localhost:${PORT}/ready`);
    console.log(`🌍 Environment: ${NODE_ENV}${IS_PRODUCTION ? ' (PRODUCTION - Redis mandatory)' : ''}`);
  });

  // Log stats every 5 minutes
  setInterval(() => {
    console.log(`[Realtime Stats] Total: ${io.sockets.sockets.size} | IPs: ${ipConnections.size} | Users: ${userConnections.size} | Redis: ${redisConnected ? 'connected' : 'disconnected'}`);
  }, 5 * 60 * 1000);
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`[Realtime] Received ${signal}, shutting down gracefully...`);

  // Close Socket.IO server
  io.close(() => {
    console.log('[Realtime] Socket.IO server closed');
  });

  // Close Redis connections
  if (redis) {
    await redis.quit();
    console.log('[Realtime] Redis main client closed');
  }
  if (redisPubClient) {
    await redisPubClient.quit();
    console.log('[Realtime] Redis pub client closed');
  }
  if (redisSubClient) {
    await redisSubClient.quit();
    console.log('[Realtime] Redis sub client closed');
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
