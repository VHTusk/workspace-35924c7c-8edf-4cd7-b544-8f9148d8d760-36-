/**
 * VALORHIVE Court Status WebSocket Service
 * 
 * Real-time updates for court status at venues
 * Port: 3005
 * 
 * Features:
 * - Redis-backed state (production) or in-memory fallback (development)
 * - HTTP health endpoint for Docker health checks
 * - Proper authentication via session validation
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

// Local Redis key constants
const REDIS_KEYS = {
  COURT_WS_STATE: 'court-ws:state:',
  COURT_WS_QUEUE: 'court-ws:queue:',
};

// Types
type CourtLiveStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'BREAK' | 'MAINTENANCE';

interface CourtLiveState {
  tournamentId: string;
  courtId: string;
  courtName?: string;
  status: CourtLiveStatus;
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

interface QueueItem {
  matchId: string;
  bracketMatchId: string;
  playerA: string;
  playerB: string;
  round: number;
  matchNumber: number;
  position: number;
  readiness: 'NOT_READY' | 'PARTIAL' | 'READY';
  readyAt?: string;
}

interface TournamentQueue {
  tournamentId: string;
  items: QueueItem[];
  lastUpdated: number;
}

const logger = createLogger({ service: 'court-status-ws' });

const PORT = process.env.PORT || 3005;
const NODE_ENV = process.env.NODE_ENV || 'development';
const REDIS_URL = process.env.REDIS_URL;
const USE_REDIS = NODE_ENV === 'production' || REDIS_URL;
const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL;

// ============================================
// In-Memory State (Development Fallback)
// ============================================

const memoryState = {
  courts: new Map<string, CourtLiveState>(),
  queues: new Map<string, QueueItem[]>(),
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

function getCourtKey(tournamentId: string, courtId: string): string {
  return `${tournamentId}:${courtId}`;
}

async function getCourtState(tournamentId: string, courtId: string): Promise<CourtLiveState | null> {
  const key = getCourtKey(tournamentId, courtId);
  
  if (redis && redisHealthy) {
    const redisKey = `${REDIS_KEYS.COURT_WS_STATE}${key}`;
    const data = await redis.get(redisKey);
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
  return memoryState.courts.get(key) || null;
}

async function setCourtState(state: CourtLiveState): Promise<void> {
  const key = getCourtKey(state.tournamentId, state.courtId);
  
  if (redis && redisHealthy) {
    const redisKey = `${REDIS_KEYS.COURT_WS_STATE}${key}`;
    await redis.setex(redisKey, 86400, JSON.stringify(state));
    return;
  }
  
  // In-memory fallback
  memoryState.courts.set(key, state);
}

async function deleteCourtState(tournamentId: string, courtId: string): Promise<void> {
  const key = getCourtKey(tournamentId, courtId);
  
  if (redis && redisHealthy) {
    const redisKey = `${REDIS_KEYS.COURT_WS_STATE}${key}`;
    await redis.del(redisKey);
    return;
  }
  
  // In-memory fallback
  memoryState.courts.delete(key);
}

async function getTournamentCourts(tournamentId: string): Promise<CourtLiveState[]> {
  if (redis && redisHealthy) {
    const pattern = `${REDIS_KEYS.COURT_WS_STATE}${tournamentId}:*`;
    const keys: string[] = [];
    let cursor = '0';
    
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');
    
    const courts: CourtLiveState[] = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        try {
          courts.push(JSON.parse(data));
        } catch {
          // Skip invalid
        }
      }
    }
    return courts;
  }
  
  // In-memory fallback
  const courts: CourtLiveState[] = [];
  for (const [key, state] of memoryState.courts) {
    if (key.startsWith(`${tournamentId}:`)) {
      courts.push(state);
    }
  }
  return courts;
}

async function clearTournamentCourts(tournamentId: string): Promise<void> {
  if (redis && redisHealthy) {
    const pattern = `${REDIS_KEYS.COURT_WS_STATE}${tournamentId}:*`;
    let cursor = '0';
    
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern);
      cursor = result[0];
      if (result[1].length > 0) {
        await redis.del(...result[1]);
      }
    } while (cursor !== '0');
    return;
  }
  
  // In-memory fallback
  for (const key of memoryState.courts.keys()) {
    if (key.startsWith(`${tournamentId}:`)) {
      memoryState.courts.delete(key);
    }
  }
}

async function getQueue(tournamentId: string): Promise<QueueItem[]> {
  if (redis && redisHealthy) {
    const key = `${REDIS_KEYS.COURT_WS_QUEUE}${tournamentId}`;
    const data = await redis.get(key);
    if (data) {
      try {
        const queue = JSON.parse(data) as TournamentQueue;
        return queue.items;
      } catch {
        return [];
      }
    }
    return [];
  }
  
  // In-memory fallback
  return memoryState.queues.get(tournamentId) || [];
}

async function setQueue(tournamentId: string, items: QueueItem[]): Promise<void> {
  if (redis && redisHealthy) {
    const key = `${REDIS_KEYS.COURT_WS_QUEUE}${tournamentId}`;
    const queue: TournamentQueue = {
      tournamentId,
      items,
      lastUpdated: Date.now(),
    };
    await redis.setex(key, 86400, JSON.stringify(queue));
    return;
  }
  
  // In-memory fallback
  memoryState.queues.set(tournamentId, items);
}

// ============================================
// HTTP Server with Health Endpoint
// ============================================

const httpServer = createServer((req, res) => {
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
  
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      connections: io?.sockets.sockets.size || 0,
      redis: USE_REDIS ? (redisHealthy ? 'connected' : 'disconnected') : 'not-required',
      mode: USE_REDIS ? 'production' : 'development',
    }));
    return;
  }
  
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
  pingInterval: 15000,
  pingTimeout: 10000,
  transports: ['websocket', 'polling'],
});

// ============================================
// Types
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

// ============================================
// Authentication Middleware
// ============================================

io.use(async (socket: AuthenticatedSocket, next) => {
  const clientIP = socket.handshake.headers['x-forwarded-for']?.toString().split(',')[0] ||
                   socket.handshake.headers['x-real-ip']?.toString() ||
                   socket.handshake.address ||
                   'unknown';
  
  socket.data = {
    isAuthenticated: false,
    clientIP,
  };

  // Extract session token
  const sessionToken = socket.handshake.auth.sessionToken ||
                       socket.handshake.auth.token ||
                       socket.handshake.headers['x-session-token'];

  if (!sessionToken) {
    logger.info(`Unauthenticated connection: ${socket.id} from ${clientIP}`);
    return next();
  }

  try {
    // Validate session via API
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
      return next();
    }

    const session = await response.json();
    
    socket.data = {
      userId: session.user?.id,
      orgId: session.orgId,
      role: session.user?.role || 'PLAYER',
      isAuthenticated: true,
      clientIP,
    };

    logger.info(`Authenticated: ${socket.id} (user: ${socket.data.userId}, role: ${socket.data.role})`);
    next();
  } catch (error) {
    logger.error('Auth error:', { error: error instanceof Error ? error.message : 'Unknown' });
    next();
  }
});

// ============================================
// Event Handlers
// ============================================

io.on('connection', (socket: AuthenticatedSocket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Join tournament room
  socket.on('join-tournament', async (tournamentId: string) => {
    socket.join(`tournament:${tournamentId}`);
    logger.info(`Client ${socket.id} joined tournament ${tournamentId}`);
    
    // Send current state
    try {
      const courts = await getTournamentCourts(tournamentId);
      const queue = await getQueue(tournamentId);
      
      socket.emit('court:status', {
        tournamentId,
        courts,
        queue,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching court state:', { error: error instanceof Error ? error.message : 'Unknown' });
    }
  });

  socket.on('leave-tournament', (tournamentId: string) => {
    socket.leave(`tournament:${tournamentId}`);
    logger.info(`Client ${socket.id} left tournament ${tournamentId}`);
  });

  // Get court status
  socket.on('court:status', async (data: { tournamentId: string }) => {
    try {
      const courts = await getTournamentCourts(data.tournamentId);
      const queue = await getQueue(data.tournamentId);
      
      socket.emit('court:status', {
        tournamentId: data.tournamentId,
        courts,
        queue,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching court status:', { error: error instanceof Error ? error.message : 'Unknown' });
      socket.emit('error', { message: 'Failed to fetch court status' });
    }
  });

  // Update court status - requires auth
  socket.on('court:update', async (data: {
    tournamentId: string;
    courtId: string;
    courtName: string;
    status: CourtLiveStatus;
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    try {
      const existingState = await getCourtState(data.tournamentId, data.courtId);
      
      const newState: CourtLiveState = {
        tournamentId: data.tournamentId,
        courtId: data.courtId,
        courtName: data.courtName,
        status: data.status,
        currentMatch: existingState?.currentMatch,
        lastUpdated: Date.now(),
        updatedBy: socket.data.userId,
      };
      
      if (data.status === 'AVAILABLE' || data.status === 'BREAK') {
        newState.currentMatch = undefined;
      }
      
      await setCourtState(newState);
      
      io.to(`tournament:${data.tournamentId}`).emit('court:updated', {
        tournamentId: data.tournamentId,
        court: newState,
        timestamp: new Date().toISOString(),
      });
      
      logger.info(`Court ${data.courtName} updated to ${data.status}`);
    } catch (error) {
      logger.error('Error updating court:', { error: error instanceof Error ? error.message : 'Unknown' });
      socket.emit('error', { message: 'Failed to update court' });
    }
  });

  // Assign match to court
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

    try {
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
      
      await setCourtState(newState);
      
      // Remove from queue
      const queue = await getQueue(data.tournamentId);
      const newQueue = queue.filter(item => item.matchId !== data.match.matchId);
      await setQueue(data.tournamentId, newQueue);
      
      io.to(`tournament:${data.tournamentId}`).emit('court:updated', {
        tournamentId: data.tournamentId,
        court: newState,
        timestamp: new Date().toISOString(),
      });
      
      io.to(`tournament:${data.tournamentId}`).emit('queue:updated', {
        tournamentId: data.tournamentId,
        queue: newQueue,
        timestamp: new Date().toISOString(),
      });
      
      logger.info(`Match ${data.match.matchId} assigned to court ${data.courtName}`);
    } catch (error) {
      logger.error('Error assigning match:', { error: error instanceof Error ? error.message : 'Unknown' });
      socket.emit('error', { message: 'Failed to assign match' });
    }
  });

  // Complete match
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

    try {
      const existingState = await getCourtState(data.tournamentId, data.courtId);
      
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
      
      await setCourtState(newState);
      
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
      
      logger.info(`Match ${data.matchId} completed on court ${existingState.courtName}`);
    } catch (error) {
      logger.error('Error completing match:', { error: error instanceof Error ? error.message : 'Unknown' });
      socket.emit('error', { message: 'Failed to complete match' });
    }
  });

  // Queue management
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

    try {
      let queue = await getQueue(data.tournamentId);
      
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
      
      await setQueue(data.tournamentId, queue);
      
      io.to(`tournament:${data.tournamentId}`).emit('queue:updated', {
        tournamentId: data.tournamentId,
        queue,
        timestamp: new Date().toISOString(),
      });
      
      logger.info(`Queue ${data.action} for tournament ${data.tournamentId}`);
    } catch (error) {
      logger.error('Error updating queue:', { error: error instanceof Error ? error.message : 'Unknown' });
      socket.emit('error', { message: 'Failed to update queue' });
    }
  });

  // Initialize courts
  socket.on('court:initialize', async (data: {
    tournamentId: string;
    courts: Array<{ courtId: string; courtName: string }>;
  }) => {
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    try {
      // Clear existing courts
      await clearTournamentCourts(data.tournamentId);
      
      // Create new courts
      for (const court of data.courts) {
        await setCourtState({
          tournamentId: data.tournamentId,
          courtId: court.courtId,
          courtName: court.courtName,
          status: 'AVAILABLE',
          lastUpdated: Date.now(),
        });
      }
      
      const courts = await getTournamentCourts(data.tournamentId);
      const queue = await getQueue(data.tournamentId);
      
      io.to(`tournament:${data.tournamentId}`).emit('court:status', {
        tournamentId: data.tournamentId,
        courts,
        queue,
        timestamp: new Date().toISOString(),
      });
      
      logger.info(`Initialized ${data.courts.length} courts for tournament ${data.tournamentId}`);
    } catch (error) {
      logger.error('Error initializing courts:', { error: error instanceof Error ? error.message : 'Unknown' });
      socket.emit('error', { message: 'Failed to initialize courts' });
    }
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
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis adapter enabled for horizontal scaling');
  }

  httpServer.listen(PORT, () => {
    logger.info(`VALORHIVE Court Status WebSocket Server running on port ${PORT}`);
    logger.info(`Mode: ${USE_REDIS ? 'production (Redis)' : 'development (in-memory)'}`);
    logger.info('Real-time court status updates enabled');
    logger.info('Authentication required for updates');
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
