/**
 * VALORHIVE Tournament WebSocket Service
 * 
 * Real-time updates for tournament matches and brackets
 * Port: 3003
 * 
 * Features:
 * - Redis-backed state (production) or in-memory fallback (development)
 * - HTTP health endpoint for Docker health checks
 * - Proper authentication via session validation
 * - Connection limits and rate limiting
 * 
 * Development: Works without Redis using in-memory state
 * Production: Requires Redis for horizontal scaling
 */

import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

// ============================================
// Logger (inline to avoid workspace issues)
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private service: string;
  private level: LogLevel;

  constructor(options: { service: string; level?: LogLevel }) {
    this.service = options.service;
    this.level = options.level || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.service}] ${message}${metaStr}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.level === 'debug') console.debug(this.formatMessage('debug', message, meta));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (['debug', 'info'].includes(this.level)) console.info(this.formatMessage('info', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (['debug', 'info', 'warn'].includes(this.level)) console.warn(this.formatMessage('warn', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatMessage('error', message, meta));
  }
}

function createLogger(options: { service: string; level?: LogLevel }): Logger {
  return new Logger(options);
}

// Local Redis key constants (copied from shared to avoid ESM issues)
const REDIS_KEYS = {
  WS_MATCH_STATE: 'ws:match:state:',
  WS_COURT_STATUS: 'court-status:',
  WS_CONNECTIONS: 'ws:connections:',
  WS_ROOM_PREFIX: 'tournament:room:',
};

// Types
interface CourtLiveState {
  tournamentId: string;
  courtId: string;
  courtName?: string;
  status: string;
  currentMatch?: {
    matchId: string;
    bracketMatchId: string;
    playerA: string;
    playerB: string;
    round: number;
    matchNumber: number;
    startedAt: string;
  };
  lastUpdated: number;
  updatedBy?: string;
}

interface MatchUpdateEvent {
  matchId: string;
  tournamentId: string;
  playerA: string;
  playerB: string;
  scoreA: number;
  scoreB: number;
  winner: string;
  status: string;
  timestamp: string;
  updatedBy?: string;
}

interface CourtStatusEvent {
  tournamentId: string;
  courtId: string;
  courtName?: string;
  status: string;
  currentMatchId?: string;
  timestamp: string;
}

interface TournamentEvent {
  tournamentId: string;
  status: string;
  liveMatches: number;
  completedMatches: number;
}

const logger = createLogger({ service: 'tournament-ws' });

const PORT = process.env.PORT || 3003;
const NODE_ENV = process.env.NODE_ENV || 'development';
const REDIS_URL = process.env.REDIS_URL;
const USE_REDIS = NODE_ENV === 'production' || REDIS_URL;
const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL;

// ============================================
// Types
// ============================================

type CourtStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';

interface StoredMatchState {
  matchId: string;
  tournamentId: string;
  state: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
  scoreA: number;
  scoreB: number;
  playerAId: string;
  playerBId: string;
  winnerId?: string;
  courtAssignment?: string;
  lastUpdated: number;
}

interface CourtStatusState {
  tournamentId: string;
  courtId: string;
  courtName?: string;
  status: CourtStatus;
  currentMatchId?: string;
  lastUpdated: number;
  updatedBy?: string;
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

// ============================================
// In-Memory State (Development Fallback)
// ============================================

const memoryState = {
  matchStates: new Map<string, StoredMatchState>(),
  courtStatuses: new Map<string, CourtStatusState>(),
  tournamentRooms: new Map<string, Set<string>>(),
  connectionCounts: new Map<string, number>(),
};

// ============================================
// Redis Setup (Optional)
// ============================================

let redis: Redis | null = null;
let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let redisHealthy = false;

async function initRedis(): Promise<boolean> {
  if (!USE_REDIS || !REDIS_URL) {
    logger.info('Running in development mode without Redis - using in-memory state');
    return false;
  }

  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: false,
    });
    
    pubClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
    });
    
    subClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
    });
    
    // Test connection
    await redis.ping();
    redisHealthy = true;
    
    // Set up health monitoring
    redis.on('error', (err) => {
      logger.error('Redis error:', { error: err.message });
      redisHealthy = false;
    });
    
    redis.on('connect', () => {
      logger.info('Redis connected');
      redisHealthy = true;
    });
    
    redis.on('close', () => {
      logger.warn('Redis connection closed');
      redisHealthy = false;
    });
    
    logger.info('Redis connection established');
    return true;
  } catch (error) {
    logger.error('Redis connection failed:', { error: error instanceof Error ? error.message : 'Unknown' });
    logger.info('Falling back to in-memory state');
    redisHealthy = false;
    return false;
  }
}

// ============================================
// State Operations (Redis or Memory)
// ============================================

async function checkAndIncrementConnectionLimit(
  key: string,
  maxLimit: number,
  identifier: string
): Promise<{ allowed: boolean; current: number }> {
  const fullKey = `${key}:${identifier}`;
  
  if (redis && redisHealthy) {
    const redisKey = `${REDIS_KEYS.WS_CONNECTIONS}${fullKey}`;
    const current = await redis.incr(redisKey);
    
    if (current === 1) {
      await redis.expire(redisKey, CONNECTION_LIMITS.CONNECTION_WINDOW_MS / 1000);
    }
    
    if (current > maxLimit) {
      await redis.decr(redisKey);
      return { allowed: false, current };
    }
    
    return { allowed: true, current };
  }
  
  // In-memory fallback
  const current = (memoryState.connectionCounts.get(fullKey) || 0) + 1;
  memoryState.connectionCounts.set(fullKey, current);
  
  if (current > maxLimit) {
    memoryState.connectionCounts.set(fullKey, current - 1);
    return { allowed: false, current };
  }
  
  return { allowed: true, current };
}

async function decrementConnectionCount(key: string, identifier: string): Promise<void> {
  const fullKey = `${key}:${identifier}`;
  
  if (redis && redisHealthy) {
    const redisKey = `${REDIS_KEYS.WS_CONNECTIONS}${fullKey}`;
    await redis.decr(redisKey);
    return;
  }
  
  // In-memory fallback
  const current = memoryState.connectionCounts.get(fullKey) || 0;
  if (current > 0) {
    memoryState.connectionCounts.set(fullKey, current - 1);
  }
}

async function storeMatchState(state: StoredMatchState): Promise<void> {
  if (redis && redisHealthy) {
    const key = `${REDIS_KEYS.WS_MATCH_STATE}${state.matchId}`;
    await redis.setex(key, 300, JSON.stringify(state));
    return;
  }
  
  // In-memory fallback
  memoryState.matchStates.set(state.matchId, state);
}

async function getMatchState(matchId: string): Promise<StoredMatchState | null> {
  if (redis && redisHealthy) {
    const key = `${REDIS_KEYS.WS_MATCH_STATE}${matchId}`;
    const data = await redis.get(key);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return null;
  }
  
  // In-memory fallback
  return memoryState.matchStates.get(matchId) || null;
}

async function storeCourtStatus(state: CourtStatusState): Promise<void> {
  if (redis && redisHealthy) {
    const key = `${REDIS_KEYS.WS_COURT_STATUS}${state.tournamentId}:${state.courtId}`;
    await redis.setex(key, 86400, JSON.stringify(state));
    return;
  }
  
  // In-memory fallback
  const key = `${state.tournamentId}:${state.courtId}`;
  memoryState.courtStatuses.set(key, state);
}

async function getAllCourtStatuses(tournamentId: string): Promise<CourtStatusState[]> {
  if (redis && redisHealthy) {
    const pattern = `${REDIS_KEYS.WS_COURT_STATUS}${tournamentId}:*`;
    const keys: string[] = [];
    let cursor = '0';
    
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');
    
    const statuses: CourtStatusState[] = [];
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
  }
  
  // In-memory fallback
  const statuses: CourtStatusState[] = [];
  for (const [key, state] of memoryState.courtStatuses) {
    if (key.startsWith(`${tournamentId}:`)) {
      statuses.push(state);
    }
  }
  return statuses;
}

async function joinTournamentRoom(tournamentId: string, socketId: string): Promise<void> {
  if (redis && redisHealthy) {
    const key = `${REDIS_KEYS.WS_ROOM_PREFIX}${tournamentId}`;
    await redis.sadd(key, socketId);
    await redis.expire(key, 86400);
    return;
  }
  
  // In-memory fallback
  if (!memoryState.tournamentRooms.has(tournamentId)) {
    memoryState.tournamentRooms.set(tournamentId, new Set());
  }
  memoryState.tournamentRooms.get(tournamentId)!.add(socketId);
}

async function leaveTournamentRoom(tournamentId: string, socketId: string): Promise<void> {
  if (redis && redisHealthy) {
    const key = `${REDIS_KEYS.WS_ROOM_PREFIX}${tournamentId}`;
    await redis.srem(key, socketId);
    return;
  }
  
  // In-memory fallback
  memoryState.tournamentRooms.get(tournamentId)?.delete(socketId);
}

async function getTournamentRoomSize(tournamentId: string): Promise<number> {
  if (redis && redisHealthy) {
    const key = `${REDIS_KEYS.WS_ROOM_PREFIX}${tournamentId}`;
    return redis.scard(key);
  }
  
  // In-memory fallback
  return memoryState.tournamentRooms.get(tournamentId)?.size || 0;
}

// ============================================
// HTTP Server with Health Endpoint
// ============================================

const httpServer = createServer((req, res) => {
  // Health check endpoint for Docker
  if (req.url === '/health' || req.url === '/healthz') {
    const healthy = !USE_REDIS || redisHealthy;
    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      connections: io?.sockets.sockets.size || 0,
      redis: USE_REDIS ? (redisHealthy ? 'connected' : 'disconnected') : 'not-required',
      mode: USE_REDIS ? 'production' : 'development',
    }));
    return;
  }
  
  // Metrics endpoint
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      connections: io?.sockets.sockets.size || 0,
      redis: USE_REDIS ? (redisHealthy ? 'connected' : 'disconnected') : 'not-required',
      mode: USE_REDIS ? 'production' : 'development',
    }));
    return;
  }
  
  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ============================================
// Socket.IO Server Setup
// ============================================

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_BASE_URL,
  'https://valorhive.com',
  'https://www.valorhive.com',
].filter(Boolean) as string[];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`Rejected connection from unauthorized origin: ${origin}`);
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
// Helper Functions
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

// ============================================
// Authentication Middleware
// ============================================

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
    logger.warn(`Connection rejected - IP limit exceeded: ${clientIP}`);
    return next(new Error('Too many connections from this IP address'));
  }

  // Get session token
  const sessionToken = socket.handshake.auth.sessionToken || 
                       socket.handshake.auth.token ||
                       socket.handshake.headers['x-session-token'] ||
                       socket.handshake.headers.cookie?.split(';')
                         .find(c => c.trim().startsWith('session_token='))
                         ?.split('=')[1];
  
  // Detect client type
  const userAgent = socket.handshake.headers['user-agent'] || '';
  const isMobileClient = socket.handshake.auth.clientType === 'mobile' ||
                         userAgent.includes('ReactNative') ||
                         userAgent.includes('Flutter') ||
                         userAgent.includes('VALORHIVE-Mobile');
  
  socket.data.clientType = isMobileClient ? 'mobile' : 'web';

  // Allow unauthenticated connections (view only)
  if (!sessionToken) {
    logger.info(`Unauthenticated connection: ${socket.id} from ${clientIP}`);
    socket.data = { isAuthenticated: false, clientIP, clientType: socket.data.clientType };
    
    socket.on('disconnect', async () => {
      await decrementConnectionCount('ip', clientIP);
    });
    
    return next();
  }

  try {
    // Validate session - use fetch to API endpoint
    const apiUrl = INTERNAL_API_URL;
    if (!apiUrl) {
      logger.warn('Skipping session validation because INTERNAL_API_URL/NEXT_PUBLIC_APP_URL is not configured');
      return next();
    }

    const response = await fetch(`${apiUrl}/api/auth/check`, {
      headers: {
        'Cookie': `session_token=${sessionToken}`,
        'Authorization': `Bearer ${sessionToken}`,
      },
    });

    if (!response.ok) {
      logger.info(`Invalid session for socket: ${socket.id}`);
      socket.data = { isAuthenticated: false, clientIP, clientType: socket.data.clientType };
      return next();
    }

    const session = await response.json();
    const userId = session.user?.id;

    // User-based connection limit
    if (userId) {
      const userCheck = await checkAndIncrementConnectionLimit(
        'user',
        CONNECTION_LIMITS.MAX_CONNECTIONS_PER_USER,
        userId
      );
      
      if (!userCheck.allowed) {
        await decrementConnectionCount('ip', clientIP);
        logger.warn(`Connection rejected - User limit exceeded: ${userId}`);
        return next(new Error('Connection limit exceeded for user. Close other tabs/windows.'));
      }
    }

    socket.data = {
      userId,
      orgId: session.orgId,
      role: session.user?.role || 'PLAYER',
      isAuthenticated: true,
      clientIP,
      clientType: socket.data.clientType,
    };

    logger.info(`Authenticated: ${socket.id} (user: ${userId}, role: ${socket.data.role})`);

    socket.on('disconnect', async () => {
      await decrementConnectionCount('ip', clientIP);
      if (userId) {
        await decrementConnectionCount('user', userId);
      }
    });

    next();
  } catch (error) {
    logger.error('Socket auth error:', { error: error instanceof Error ? error.message : 'Unknown' });
    socket.data = { isAuthenticated: false, clientIP, clientType: socket.data.clientType };
    next();
  }
});

// ============================================
// Event Handlers
// ============================================

io.on('connection', (socket: AuthenticatedSocket) => {
  logger.info(`Client connected: ${socket.id} (auth: ${socket.data.isAuthenticated})`);

  // Join tournament room
  socket.on('join-tournament', async (tournamentId: string) => {
    socket.join(`tournament:${tournamentId}`);
    await joinTournamentRoom(tournamentId, socket.id);
    
    const roomSize = await getTournamentRoomSize(tournamentId);
    logger.info(`Client ${socket.id} joined tournament ${tournamentId} (${roomSize} viewers)`);
    
    // Send current state
    socket.emit('tournament-state', {
      tournamentId,
      status: 'IN_PROGRESS',
      liveMatches: 3,
      completedMatches: 12,
    });
    
    // Send court statuses
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
      logger.error('Error fetching court statuses:', { error: error instanceof Error ? error.message : 'Unknown' });
    }
  });

  socket.on('leave-tournament', async (tournamentId: string) => {
    socket.leave(`tournament:${tournamentId}`);
    await leaveTournamentRoom(tournamentId, socket.id);
    logger.info(`Client ${socket.id} left tournament ${tournamentId}`);
  });

  // Match update - requires auth
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
    
    logger.info(`Match ${data.matchId} updated: ${data.scoreA}-${data.scoreB}`);
  });

  // Bracket update
  socket.on('bracket-update', (data: { tournamentId: string; bracketData: unknown }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const allowedRoles = ['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR'];
    if (!allowedRoles.includes(socket.data.role || '') && !socket.data.orgId) {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }

    io.to(`tournament:${data.tournamentId}`).emit('bracket-refresh', {
      bracketData: data.bracketData,
      timestamp: new Date().toISOString(),
    });
  });

  // Court status update
  socket.on('court-status-update', async (data: {
    tournamentId: string;
    courtId: string;
    status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';
    currentMatchId?: string;
    courtName?: string;
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const allowedRoles = ['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR'];
    if (!allowedRoles.includes(socket.data.role || '') && !socket.data.orgId) {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }

    const courtState: CourtStatusState = {
      tournamentId: data.tournamentId,
      courtId: data.courtId,
      courtName: data.courtName,
      status: data.status,
      currentMatchId: data.currentMatchId,
      lastUpdated: Date.now(),
      updatedBy: socket.data.userId || socket.data.orgId,
    };

    await storeCourtStatus(courtState);

    io.to(`tournament:${data.tournamentId}`).emit('court-status-changed', {
      ...courtState,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Court ${data.courtId} status updated to ${data.status}`);
  });

  // Match state recovery
  socket.on('recover-match-state', async (matchId: string) => {
    const state = await getMatchState(matchId);
    if (state) {
      socket.emit('match-state-recovered', {
        ...state,
        recoveredAt: Date.now(),
      });
    } else {
      socket.emit('match-state-not-found', { matchId });
    }
  });

  // Heartbeat
  socket.on('pong', () => {
    socket.data.lastPong = Date.now();
    socket.data.missedPings = 0;
  });

  // Disconnect
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// ============================================
// Startup
// ============================================

async function start() {
  const redisConnected = await initRedis();
  
  if (pubClient && subClient && redisConnected) {
    // Configure Redis adapter for horizontal scaling
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis adapter enabled for horizontal scaling');
  }

  httpServer.listen(PORT, () => {
    logger.info(`VALORHIVE WebSocket Server running on port ${PORT}`);
    logger.info(`Mode: ${USE_REDIS ? 'production (Redis)' : 'development (in-memory)'}`);
    logger.info('Tournament real-time updates enabled');
    logger.info('Authentication required for score updates');
    logger.info(`Connection limits: ${CONNECTION_LIMITS.MAX_CONNECTIONS_PER_USER}/user, ${CONNECTION_LIMITS.MAX_CONNECTIONS_PER_IP}/IP`);
    logger.info(`Heartbeat: ${HEARTBEAT_CONFIG.PING_INTERVAL}ms interval`);
    logger.info(`Health endpoint: /health (port ${PORT})`);
  });
}

// Stats logging
setInterval(() => {
  logger.info(`Stats: ${io.sockets.sockets.size} connections | Redis: ${USE_REDIS ? (redisHealthy ? 'healthy' : 'unhealthy') : 'not-required'}`);
}, 5 * 60 * 1000);

start().catch((err) => {
  logger.error('Failed to start:', { error: err.message });
  process.exit(1);
});
