# Archived Legacy Services

**WARNING: These services are DEPRECATED and should NOT be used.**

This folder contains legacy WebSocket services that have been replaced by the unified `realtime-gateway` service.

---

## Archived Services

| Service | Original Location | Port | Replacement |
|---------|-------------------|------|-------------|
| `tournament-ws` | `mini-services/tournament-ws/` | 3003 | `realtime-gateway` (port 3004) |
| `court-status-ws` | `mini-services/court-status-ws/` | 3005 | `realtime-gateway` (port 3004) |

---

## Replacement Service

The **realtime-gateway** (`mini-services/realtime-gateway/`) is the unified WebSocket service that handles all realtime functionality:

- Tournament room management
- Match result updates
- Bracket updates
- Court status tracking
- Match queue management
- Reconnection support with state recovery

### Migration

Replace any references to legacy services:

| Legacy | Replacement |
|--------|-------------|
| `tournament-ws:3003` | `realtime-gateway:3004` |
| `court-status-ws:3005` | `realtime-gateway:3004` |

---

## Why These Were Archived

1. **Code Duplication**: Both services had similar authentication, Redis integration, and connection handling logic
2. **Resource Efficiency**: Single service uses fewer resources than two separate services
3. **Consistency**: Unified authentication and state management
4. **Maintainability**: Easier to maintain one codebase than two

---

## Timeline

- **Deprecated since:** 2025
- **Archived:** 2025
- **Planned removal:** After 6 months of stable realtime-gateway operation

---

## DO NOT USE

These archived services are kept for reference purposes only. They may have:
- Security vulnerabilities (authentication issues were fixed before deprecation)
- Outdated dependencies
- Missing features that exist in realtime-gateway

For all new development and production use, use the `realtime-gateway` service.
