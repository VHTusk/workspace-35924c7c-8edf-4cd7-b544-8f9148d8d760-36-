import { Server, Socket } from 'socket.io';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { db } from '@valorhive/db';

const PORT = 3003;

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
// Production Scaling Configuration (v3.80.0)
// ============================================

// Connection limits configuration - optimized for mobile
const CONNECTION_LIMITS = {
  MAX_CONNECTIONS_PER_USER: 5,      // Prevent single user from opening too many connections
  MAX_CONNECTIONS_PER_IP: 200,       // Increased for mobile NATs (many users share one IP on cellular)
  CONNECTION_WINDOW_MS: 60 * 60 * 1000, // 1 hour window for rate limiting
};

// Heartbeat configuration - 15 second interval for production systems
const HEARTBEAT_CONFIG = {
  PING_INTERVAL: 15000,    // 15 seconds - send ping every 15s
  PING_TIMEOUT: 10000,     // 10 seconds - wait 10s for pong response
  MAX_MISSED_PINGS: 3,      // Disconnect after 3 missed pings
};

// Reconnection state storage key prefix
const MATCH_STATE_PREFIX = 'ws:match:state:';

// Court status storage key prefix
const COURT_STATUS_PREFIX = 'court-status:';

// ============================================
// Court Status Types (Task ID: 1-g)
// ============================================
type CourtStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';

interface CourtStatusState {
  tournamentId: string;
  courtId: string;
  courtName?: string;
  status: CourtStatus;
  currentMatchId?: string;
  lastUpdated: number;
  updatedBy?: string;
}

// In-memory court status storage (fallback when Redis unavailable)
const courtStatusStore = new Map<string, CourtStatusState>();

// Valid user sessions for WebSocket auth
interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    orgId?: string;
    role?: string;
    isAuthenticated: boolean;
    clientIP?: string;
    clientType?: 'web' | 'mobile';  // Track client type for analytics
    missedPings?: number;           // Track missed heartbeats
    lastPong?: number;              // Last pong timestamp
  };
}

// Connection tracking maps (in-memory fallback)
const userConnections = new Map<string, number>();  // userId -> connection count
const ipConnections = new Map<string, number>();     // IP -> connection count
const tournamentRooms = new Map<string, Set<string>>();
const adminSockets = new Set<string>();

// ============================================
// Match State Storage (for reconnection support)
// Production Scaling (v3.80.0)
// ============================================

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

// In-memory match state storage (fallback when Redis unavailable)
const matchStateStore = new Map<string, StoredMatchState>();

/**
 * Store match state for reconnection recovery
 * Uses Redis when available, falls back to in-memory
 */
async function storeMatchState(state: StoredMatchState): Promise<void> {
  const key = `${MATCH_STATE_PREFIX}${state.matchId}`;
  const data = JSON.stringify(state);
  
  if (redis) {
    // Store in Redis with 5 minute TTL
    await redis.setex(key, 300, data);
  } else {
    // Store in memory
    matchStateStore.set(key, state);
  }
}

/**
 * Retrieve match state for reconnection
 */
async function getMatchState(matchId: string): Promise<StoredMatchState | null> {
  const key = `${MATCH_STATE_PREFIX}${matchId}`;
  
  if (redis) {
    const data = await redis.get(key);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return null;
  } else {
    const state = matchStateStore.get(key);
    return state || null;
  }
}

/**
 * Delete match state (after match completed/verified)
 */
async function deleteMatchState(matchId: string): Promise<void> {
  const key = `${MATCH_STATE_PREFIX}${matchId}`;
  
  if (redis) {
    await redis.del(key);
  } else {
    matchStateStore.delete(key);
  }
}

// ============================================
// Court Status Storage (Task ID: 1-g)
// Redis storage with 24-hour TTL
// ============================================

/**
 * Store court status in Redis with 24-hour TTL
 */
async function storeCourtStatus(state: CourtStatusState): Promise<void> {
  const key = `${COURT_STATUS_PREFIX}${state.tournamentId}:${state.courtId}`;
  const data = JSON.stringify(state);
  
  if (redis) {
    // Store in Redis with 24 hour TTL (86400 seconds)
    await redis.setex(key, 86400, data);
  } else {
    // Store in memory
    courtStatusStore.set(key, state);
  }
}

/**
 * Retrieve court status
 */
async function getCourtStatus(tournamentId: string, courtId: string): Promise<CourtStatusState | null> {
  const key = `${COURT_STATUS_PREFIX}${tournamentId}:${courtId}`;
  
  if (redis) {
    const data = await redis.get(key);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return null;
  } else {
    const state = courtStatusStore.get(key);
    return state || null;
  }
}

/**
 * Get all court statuses for a tournament
 */
async function getAllCourtStatuses(tournamentId: string): Promise<CourtStatusState[]> {
  if (redis) {
    // Scan for all keys matching the pattern
    const pattern = `${COURT_STATUS_PREFIX}${tournamentId}:*`;
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
  } else {
    // In-memory: filter by tournament ID
    const statuses: CourtStatusState[] = [];
    for (const [key, state] of courtStatusStore.entries()) {
      if (key.startsWith(`${COURT_STATUS_PREFIX}${tournamentId}:`)) {
        statuses.push(state);
      }
    }
    return statuses;
  }
}

/**
 * Delete court status (cleanup)
 */
async function deleteCourtStatus(tournamentId: string, courtId: string): Promise<void> {
  const key = `${COURT_STATUS_PREFIX}${tournamentId}:${courtId}`;
  
  if (redis) {
    await redis.del(key);
  } else {
    courtStatusStore.delete(key);
  }
}

/**
 * Delete all court statuses for a tournament
 */
async function deleteAllCourtStatuses(tournamentId: string): Promise<void> {
  if (redis) {
    const pattern = `${COURT_STATUS_PREFIX}${tournamentId}:*`;
    let cursor = '0';
    
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern);
      cursor = result[0];
      
      if (result[1].length > 0) {
        await redis.del(...result[1]);
      }
    } while (cursor !== '0');
  } else {
    // In-memory: delete all matching keys
    for (const key of courtStatusStore.keys()) {
      if (key.startsWith(`${COURT_STATUS_PREFIX}${tournamentId}:`)) {
        courtStatusStore.delete(key);
      }
    }
  }
}

// Redis client (optional - for horizontal scaling)
let redis: ReturnType<typeof import('ioredis').default.prototype.constructor> | null = null;
const USE_REDIS = process.env.REDIS_URL && process.env.WS_USE_REDIS === 'true';

// Initialize Redis if available
async function initRedis() {
  if (!USE_REDIS) return;
  
  try {
    const Redis = (await import('ioredis')).default;
    redis = new Redis(process.env.REDIS_URL!);
    console.log('[WS] Redis connection tracking enabled for horizontal scaling');
  } catch (error) {
    console.warn('[WS] Redis not available, using in-memory connection tracking (single instance only)');
    redis = null;
  }
}

// Initialize Redis on startup
initRedis();

// FIX: Origin validation for WebSocket connections
// Prevents malicious pages from establishing connections using victim's cookies
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  process.env.NEXT_PUBLIC_BASE_URL,
  'https://valorhive.com',
  'https://www.valorhive.com',
  // Development origins
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean) as string[];

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
      service: 'tournament-ws',
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
        service: 'tournament-ws',
        connections: io.sockets.sockets.size,
      }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        service: 'tournament-ws',
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
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[WS] Rejected connection from unauthorized origin: ${origin}`);
        callback(new Error('Unauthorized origin'), false);
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // ============================================
  // Production Heartbeat Configuration (v3.80.0)
  // 15-second heartbeat for reliable connection monitoring
  // ============================================
  pingInterval: HEARTBEAT_CONFIG.PING_INTERVAL,  // 15 seconds - send ping
  pingTimeout: HEARTBEAT_CONFIG.PING_TIMEOUT,    // 10 seconds - wait for pong
  connectTimeout: 45000,   // 45 seconds - allow time for slow mobile connections
  // Allow upgrades from polling to websocket (better for mobile)
  allowUpgrades: true,
  // Transport settings for mobile reliability
  transports: ['websocket', 'polling'],
  // Maximum HTTP headers size (for large cookie headers)
  maxHttpBufferSize: 1e6,
});

// Start HTTP server
httpServer.listen(PORT, () => {
  isServerReady = true;
  console.log(`[Health] HTTP server listening on port ${PORT}`);
  console.log(`[Health] Health endpoint: http://localhost:${PORT}/health`);
  console.log(`[Health] Ready endpoint: http://localhost:${PORT}/ready`);
});

/**
 * Extract client IP from socket handshake
 * Handles proxies (x-forwarded-for) and direct connections
 */
function getClientIP(socket: Socket): string {
  // Check x-forwarded-for header (client may be behind proxy/load balancer)
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) {
    // Take the first IP in the chain (original client)
    return forwarded.toString().split(',')[0].trim();
  }

  // Check x-real-ip header (nginx)
  const realIP = socket.handshake.headers['x-real-ip'];
  if (realIP) {
    return realIP.toString().trim();
  }

  // Fallback to socket remote address
  return socket.handshake.address || 'unknown';
}

/**
 * Check connection limit with Redis (for horizontal scaling)
 * Falls back to in-memory if Redis is not available
 */
async function checkAndIncrementConnectionLimit(
  key: string,
  maxLimit: number,
  identifier: string
): Promise<{ allowed: boolean; current: number }> {
  if (redis) {
    // Redis-backed tracking (works across multiple server instances)
    const redisKey = `ws:connections:${key}:${identifier}`;
    const current = await redis.incr(redisKey);
    
    if (current === 1) {
      // Set expiry on first increment
      await redis.expire(redisKey, CONNECTION_LIMITS.CONNECTION_WINDOW_MS / 1000);
    }
    
    if (current > maxLimit) {
      // Roll back increment - limit exceeded
      await redis.decr(redisKey);
      return { allowed: false, current };
    }
    
    return { allowed: true, current };
  } else {
    // In-memory tracking (single instance only)
    const current = (key === 'user' ? userConnections : ipConnections).get(identifier) || 0;
    if (current >= maxLimit) {
      return { allowed: false, current };
    }
    (key === 'user' ? userConnections : ipConnections).set(identifier, current + 1);
    return { allowed: true, current: current + 1 };
  }
}

/**
 * Decrement connection count
 */
async function decrementConnectionCount(key: string, identifier: string): Promise<void> {
  if (redis) {
    const redisKey = `ws:connections:${key}:${identifier}`;
    await redis.decr(redisKey);
  } else {
    const map = key === 'user' ? userConnections : ipConnections;
    const current = map.get(identifier) || 1;
    map.set(identifier, Math.max(0, current - 1));
  }
}

// Authentication middleware with connection limits
io.use(async (socket: AuthenticatedSocket, next) => {
  const clientIP = getClientIP(socket);
  socket.data.clientIP = clientIP;

  // === IP-based connection limit (DDoS protection) ===
  const ipCheck = await checkAndIncrementConnectionLimit(
    'ip',
    CONNECTION_LIMITS.MAX_CONNECTIONS_PER_IP,
    clientIP
  );
  
  if (!ipCheck.allowed) {
    console.warn(`[WS] Connection rejected - IP limit exceeded: ${clientIP} (${ipCheck.current} connections)`);
    return next(new Error('Too many connections from this IP address'));
  }

  // Get session token from multiple sources (supports mobile Bearer tokens)
  const sessionToken = socket.handshake.auth.sessionToken || 
                       socket.handshake.auth.token ||  // Mobile apps may send as 'token'
                       socket.handshake.headers['x-session-token'] ||  // Header from middleware
                       socket.handshake.headers.cookie?.split(';')
                         .find(c => c.trim().startsWith('session_token='))
                         ?.split('=')[1];
  
  // Detect client type (mobile vs web)
  const userAgent = socket.handshake.headers['user-agent'] || '';
  const isMobileClient = socket.handshake.auth.clientType === 'mobile' ||
                         userAgent.includes('ReactNative') ||
                         userAgent.includes('Flutter') ||
                         userAgent.includes('VALORHIVE-Mobile');
  
  socket.data.clientType = isMobileClient ? 'mobile' : 'web';

  // Allow unauthenticated connections (for viewing only) but still track by IP
  if (!sessionToken) {
    console.log(`[WS] Unauthenticated connection: ${socket.id} from ${clientIP} (${socket.data.clientType})`);
    socket.data = { isAuthenticated: false, clientIP, clientType: socket.data.clientType };
    
    // Setup cleanup on disconnect
    socket.on('disconnect', async () => {
      await decrementConnectionCount('ip', clientIP);
    });
    
    return next();
  }

  try {
    // CRITICAL: Hash the token before database lookup
    // Sessions are stored with SHA-256 hashed tokens, not plaintext
    const tokenHash = await hashToken(sessionToken);
    
    // Validate session against database using hashed token
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
      console.log(`[WS] Invalid session for socket: ${socket.id}: Token not found or expired`);
      socket.data = { isAuthenticated: false, clientIP, clientType: socket.data.clientType };
      return next();
    }

    const userId = session.userId || undefined;

    // === User-based connection limit ===
    if (userId) {
      const userCheck = await checkAndIncrementConnectionLimit(
        'user',
        CONNECTION_LIMITS.MAX_CONNECTIONS_PER_USER,
        userId
      );
      
      if (!userCheck.allowed) {
        // Roll back IP increment since we're rejecting
        await decrementConnectionCount('ip', clientIP);
        console.warn(`[WS] Connection rejected - User limit exceeded: ${userId} (${userCheck.current} connections)`);
        return next(new Error('Connection limit exceeded for user. Close other tabs/windows.'));
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

    console.log(`[WS] Authenticated: ${socket.id} (user: ${userId}, role: ${socket.data.role}, IP: ${clientIP}, client: ${socket.data.clientType})`);

    // Setup cleanup on disconnect
    socket.on('disconnect', async () => {
      // Decrement IP count
      await decrementConnectionCount('ip', clientIP);

      // Decrement user count
      if (userId) {
        await decrementConnectionCount('user', userId);
      }
    });

    next();
  } catch (error) {
    console.error('[WS] Socket auth error:', error);
    socket.data = { isAuthenticated: false, clientIP, clientType: socket.data.clientType };
    next();
  }
});

io.on('connection', (socket: AuthenticatedSocket) => {
  console.log(`[WS] Client connected: ${socket.id} (auth: ${socket.data.isAuthenticated}, IP: ${socket.data.clientIP})`);

  // Join tournament room for live updates (anyone can join to view)
  socket.on('join-tournament', async (tournamentId: string) => {
    socket.join(`tournament:${tournamentId}`);
    
    if (!tournamentRooms.has(tournamentId)) {
      tournamentRooms.set(tournamentId, new Set());
    }
    tournamentRooms.get(tournamentId)!.add(socket.id);
    
    console.log(`[WS] Client ${socket.id} joined tournament ${tournamentId}`);
    
    // Send current tournament state
    socket.emit('tournament-state', {
      tournamentId,
      status: 'IN_PROGRESS',
      liveMatches: 3,
      completedMatches: 12,
    });
    
    // ============================================
    // Reconnection Support - Emit Court Statuses (Task ID: 1-g)
    // ============================================
    try {
      const courtStatuses = await getAllCourtStatuses(tournamentId);
      if (courtStatuses.length > 0) {
        socket.emit('court-statuses', {
          tournamentId,
          courts: courtStatuses,
          timestamp: new Date().toISOString(),
        });
        console.log(`[WS] Sent ${courtStatuses.length} court statuses to ${socket.id} for tournament ${tournamentId}`);
      }
    } catch (error) {
      console.error(`[WS] Error fetching court statuses for tournament ${tournamentId}:`, error);
    }
  });

  // Leave tournament room
  socket.on('leave-tournament', (tournamentId: string) => {
    socket.leave(`tournament:${tournamentId}`);
    
    const room = tournamentRooms.get(tournamentId);
    if (room) {
      room.delete(socket.id);
    }
    
    console.log(`[WS] Client ${socket.id} left tournament ${tournamentId}`);
  });

  // Match result update - ADMIN/ORG ONLY
  socket.on('match-update', async (data: {
    tournamentId: string;
    matchId: string;
    playerA: string;
    playerB: string;
    scoreA: number;
    scoreB: number;
    status: string;
  }) => {
    // Require authentication
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required to update matches' });
      return;
    }

    // Require admin or org role
    const allowedRoles = ['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR'];
    const isOrg = socket.data.orgId !== undefined;
    
    if (!allowedRoles.includes(socket.data.role || '') && !isOrg) {
      socket.emit('error', { message: 'Unauthorized: Admin or Org role required' });
      console.warn(`[WS] Unauthorized match-update attempt from socket ${socket.id}`);
      return;
    }

    // Broadcast to all clients in the tournament room
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
    
    // Store match state for reconnection support (v3.80.0)
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
    
    console.log(`[WS] Match ${data.matchId} updated by ${socket.data.userId || socket.data.orgId}: ${data.scoreA}-${data.scoreB}`);
  });

  // Bracket update - ADMIN/ORG ONLY
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

  // Leaderboard update - ADMIN ONLY
  socket.on('leaderboard-update', (data: {
    sport: string;
    updates: Array<{ rank: number; name: string; points: number }>;
  }) => {
    if (!socket.data.isAuthenticated || socket.data.role !== 'ADMIN') {
      socket.emit('error', { message: 'Admin only operation' });
      return;
    }

    io.emit('leaderboard-changed', {
      sport: data.sport,
      updates: data.updates,
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================
  // Reconnection Support (v3.80.0)
  // ============================================
  
  /**
   * Client requests match state recovery after reconnection
   * Used when client reconnects and needs to resume watching a match
   */
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
      
      console.log(`[WS] Match state recovered for ${matchId} by ${socket.id}`);
    } else {
      socket.emit('match-state-not-found', { matchId });
    }
  });

  /**
   * Store match state for reconnection support
   * Called by match-update handler automatically
   */
  socket.on('store-match-state', async (data: {
    matchId: string;
    tournamentId: string;
    state: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
    scoreA: number;
    scoreB: number;
    playerAId: string;
    playerBId: string;
    winnerId?: string;
    courtAssignment?: string;
  }) => {
    // Require authentication
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }
    
    await storeMatchState({
      ...data,
      lastUpdated: Date.now(),
    });
    
    socket.emit('match-state-stored', { matchId: data.matchId });
  });

  /**
   * Heartbeat pong response handler
   * Tracks connection health for monitoring
   */
  socket.on('pong', () => {
    socket.data.lastPong = Date.now();
    socket.data.missedPings = 0;
  });

  // ============================================
  // Court Status Events (Task ID: 1-g)
  // ============================================

  /**
   * court-status-update - Admin/director updates court status
   * Requires ADMIN, SUB_ADMIN, or TOURNAMENT_DIRECTOR role
   */
  socket.on('court-status-update', async (data: {
    tournamentId: string;
    courtId: string;
    status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';
    currentMatchId?: string;
    courtName?: string;
  }) => {
    // Require authentication
    if (!socket.data.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required to update court status' });
      return;
    }

    // Verify admin/director role
    const allowedRoles = ['ADMIN', 'SUB_ADMIN', 'TOURNAMENT_DIRECTOR'];
    const isOrg = socket.data.orgId !== undefined;
    
    if (!allowedRoles.includes(socket.data.role || '') && !isOrg) {
      socket.emit('error', { message: 'Unauthorized: Admin or Tournament Director role required to update court status' });
      console.warn(`[WS] Unauthorized court-status-update attempt from socket ${socket.id} (role: ${socket.data.role})`);
      return;
    }

    // Validate status value
    const validStatuses: CourtStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE'];
    if (!validStatuses.includes(data.status)) {
      socket.emit('error', { message: `Invalid court status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    try {
      // Create court status state
      const courtState: CourtStatusState = {
        tournamentId: data.tournamentId,
        courtId: data.courtId,
        courtName: data.courtName,
        status: data.status,
        currentMatchId: data.currentMatchId,
        lastUpdated: Date.now(),
        updatedBy: socket.data.userId || socket.data.orgId,
      };

      // Store in Redis with 24-hour TTL
      await storeCourtStatus(courtState);

      // Broadcast to all clients in the tournament room
      io.to(`tournament:${data.tournamentId}`).emit('court-status-changed', {
        tournamentId: data.tournamentId,
        courtId: data.courtId,
        courtName: data.courtName,
        status: data.status,
        currentMatchId: data.currentMatchId,
        lastUpdated: courtState.lastUpdated,
        updatedBy: courtState.updatedBy,
        timestamp: new Date().toISOString(),
      });

      console.log(`[WS] Court ${data.courtId} status updated to ${data.status} by ${socket.data.userId || socket.data.orgId} for tournament ${data.tournamentId}`);
    } catch (error) {
      console.error(`[WS] Error updating court status:`, error);
      socket.emit('error', { message: 'Failed to update court status' });
    }
  });

  /**
   * court-statuses - Get all court statuses for a tournament
   * Available to all authenticated users in the tournament room
   */
  socket.on('court-statuses', async (data: { tournamentId: string }) => {
    try {
      const courtStatuses = await getAllCourtStatuses(data.tournamentId);
      
      socket.emit('court-statuses', {
        tournamentId: data.tournamentId,
        courts: courtStatuses,
        timestamp: new Date().toISOString(),
      });

      console.log(`[WS] Sent ${courtStatuses.length} court statuses to ${socket.id} for tournament ${data.tournamentId}`);
    } catch (error) {
      console.error(`[WS] Error fetching court statuses:`, error);
      socket.emit('error', { message: 'Failed to fetch court statuses' });
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
    
    adminSockets.delete(socket.id);
    
    // Clean up rooms
    tournamentRooms.forEach((clients, tournamentId) => {
      clients.delete(socket.id);
      if (clients.size === 0) {
        tournamentRooms.delete(tournamentId);
      }
    });
  });
});

// Health check endpoint
io.of('/health').on('connection', (socket) => {
  socket.emit('status', { 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    connections: {
      total: io.sockets.sockets.size,
      byIP: ipConnections.size,
      byUser: userConnections.size,
      redisEnabled: redis !== null,
    },
    limits: CONNECTION_LIMITS,
  });
  socket.disconnect();
});

// Log connection stats every 5 minutes
setInterval(() => {
  console.log(`[WS Stats] Total: ${io.sockets.sockets.size} | IPs tracked: ${ipConnections.size} | Users tracked: ${userConnections.size} | Match states: ${matchStateStore.size} | Court states: ${courtStatusStore.size} | Redis: ${redis ? 'enabled' : 'disabled'}`);
}, 5 * 60 * 1000);

console.log(`🎮 VALORHIVE WebSocket Server running on port ${PORT}`);
console.log(`📡 Tournament real-time updates enabled`);
console.log(`🔐 Authentication required for score updates`);
console.log(`🛡️ Connection limits: ${CONNECTION_LIMITS.MAX_CONNECTIONS_PER_USER}/user, ${CONNECTION_LIMITS.MAX_CONNECTIONS_PER_IP}/IP`);
console.log(`💓 Heartbeat: ${HEARTBEAT_CONFIG.PING_INTERVAL}ms interval, ${HEARTBEAT_CONFIG.PING_TIMEOUT}ms timeout`);
console.log(`🔄 Redis tracking: ${USE_REDIS ? 'enabled' : 'disabled'} (set WS_USE_REDIS=true to enable)`);
console.log(`🔄 Match state recovery: enabled (for reconnection support)`);
console.log(`🏟️ Court status tracking: enabled (24-hour TTL, admin/director auth required)`);
