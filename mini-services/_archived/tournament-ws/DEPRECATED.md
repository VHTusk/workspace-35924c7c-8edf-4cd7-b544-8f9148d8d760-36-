# DEPRECATED - Do Not Use

This service is deprecated and will be removed in a future version.

## Replacement

Use the unified **realtime-gateway** service instead:
- Location: `mini-services/realtime-gateway/`
- Port: 3004
- Dockerfile: `mini-services/realtime-gateway/Dockerfile`

## Migration

Replace any references to this service with `realtime-gateway`:
- `tournament-ws:3003` → `realtime-gateway:3004`
- `court-status-ws:3005` → `realtime-gateway:3004`

## Timeline

- Deprecated since: 2025
- Removal planned: TBD
