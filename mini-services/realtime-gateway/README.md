# VALORHIVE Unified Realtime Gateway

The unified WebSocket gateway for all realtime functionality.

## Overview

This service consolidates:
- **Tournament WebSocket** (formerly `tournament-ws` on port 3003)
- **Court Status WebSocket** (formerly `court-status-ws` on port 3005)

Into a single stateless gateway with Redis adapter for horizontal scaling.

## Port

**Default:** 3004 (configurable via `REALTIME_PORT` env var)

## Features

- Tournament live updates (match results, bracket updates)
- Court status tracking (venue management)
- Match queue management
- Reconnection support with state recovery
- Redis-backed state for horizontal scaling
- Socket.IO Redis adapter for multi-instance support
- Proper authentication using canonical auth module
- HTTP health endpoints for Kubernetes probes

## Health Endpoints

- `GET /health` - Liveness check
- `GET /ready` - Readiness check

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REALTIME_PORT` | Server port | 3004 |
| `NODE_ENV` | Environment | development |
| `REDIS_URL` | Redis connection URL | - |
| `ALLOW_IN_MEMORY_STATE` | Allow fallback to in-memory | false |
| `NEXT_PUBLIC_APP_URL` | Allowed CORS origin | http://localhost:3000 |

## Events

### Tournament Room Management

- `join-tournament(tournamentId)` - Join a tournament room
- `leave-tournament(tournamentId)` - Leave a tournament room

### Match Updates

- `match-update(data)` - Update match scores (auth required)
- `match-result` - Emitted when match is updated
- `match-state-recovered` - Emitted on reconnection

### Bracket Updates

- `bracket-update(data)` - Update bracket data (auth required)
- `bracket-refresh` - Emitted when bracket is updated

### Court Status

- `court-status-update(data)` - Update court status (auth required)
- `court-statuses(data)` - Request all court statuses
- `court-status-changed` - Emitted when court status changes
- `court:updated` - Emitted with full court state

### Match Queue

- `match:assign(data)` - Assign match to court (auth required)
- `match:complete(data)` - Complete a match (auth required)
- `queue:update(data)` - Update match queue (auth required)
- `queue:initialize(data)` - Initialize queue (auth required)
- `queue:updated` - Emitted when queue changes

## Authentication

Authentication is required for write operations:
- `match-update`
- `bracket-update`
- `court-status-update`
- `match:assign`
- `match:complete`
- `queue:update`
- `queue:initialize`

Authentication is done via session token in:
- `auth.token` in handshake auth
- `Authorization` header
- Cookie

## Connection Limits

- 5 connections per user
- 200 connections per IP
- 15-second ping interval
- 10-second ping timeout

## Docker

Build:
```bash
docker build -f mini-services/realtime-gateway/Dockerfile -t valorhive-realtime-gateway .
```

Run:
```bash
docker run -p 3004:3004 -e REDIS_URL=redis://... valorhive-realtime-gateway
```

## Local Development

```bash
cd mini-services/realtime-gateway
bun install
bun dev
```

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Realtime Gateway            │
                    │           (Port 3004)               │
                    │                                     │
Clients ───────────►│  ┌─────────────────────────────┐   │
                    │  │     Socket.IO Server        │   │
                    │  └──────────┬──────────────────┘   │
                    │             │                       │
                    │  ┌──────────▼──────────────────┐   │
                    │  │     Redis Adapter           │   │
                    │  │  (Pub/Sub for scaling)      │   │
                    │  └──────────┬──────────────────┘   │
                    │             │                       │
                    │  ┌──────────▼──────────────────┐   │
                    │  │     Redis State Store       │   │
                    │  │  - Match states             │   │
                    │  │  - Court statuses           │   │
                    │  │  - Match queues             │   │
                    │  └─────────────────────────────┘   │
                    └─────────────────────────────────────┘
```

## Migration from Old Services

If you were using `tournament-ws` or `court-status-ws`:

1. Change connection URL from `ws://host:3003` or `ws://host:3005` to `ws://host:3004`
2. Event names remain the same
3. All old functionality is preserved

---

**Service:** valorhive-realtime-gateway
**Version:** 1.0.0
**Maintainer:** Platform team
