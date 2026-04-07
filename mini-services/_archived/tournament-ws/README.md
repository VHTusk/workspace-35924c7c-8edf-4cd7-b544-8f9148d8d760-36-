# ⚠️ DEPRECATED: Tournament WebSocket Service

**This service has been archived and is no longer in use.**

## Migration Notice

This service has been consolidated into the **Unified Realtime Gateway**.

### What happened?
- The `tournament-ws` service (port 3003) and `court-status-ws` service (port 3005) have been merged into a single unified gateway.
- The new service is located at `/mini-services/realtime-gateway/` and runs on port **3004**.

### Why was this changed?
1. **Reduced complexity** - One service instead of two
2. **Better scalability** - Redis adapter for horizontal scaling
3. **Consistent auth** - Uses canonical auth module
4. **Unified state** - All realtime state in one place

### Migration Guide

**Old endpoint:** `ws://localhost:3003`
**New endpoint:** `ws://localhost:3004`

**Old events:**
- `join-tournament`
- `match-update`
- `bracket-update`
- `match-result`

**New events (same names, new endpoint):**
All events are now available on the unified gateway. See `/mini-services/realtime-gateway/index.ts` for the full list.

### What to do
1. Update your client connections from port 3003 to port 3004
2. No code changes required - all events are compatible
3. Remove any references to this service from docker-compose files

### Files kept for reference
- `index.ts` - Original service code
- `package.json` - Dependencies
- `Dockerfile` - Build configuration

### Deletion schedule
This directory will be removed in a future cleanup. Please migrate before then.

---

**Migrated:** 2024
**Replacement:** `mini-services/realtime-gateway`
**Contact:** Platform team for questions
