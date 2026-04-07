# VALORHIVE - Developer Handoff Document

**Project:** VALORHIVE Multi-Sport Tournament Platform  
**Version:** 3.8.0  
**Handoff Date:** January 2025  
**Status:** Production Ready (PostgreSQL Migration Required)

---

## Quick Start

```bash
# Clone/restore project
cd /home/z/my-project

# Install dependencies
bun install

# Setup database
bun run db:push

# Run development server
bun run dev

# Run lint
bun run lint

# Build for production
bun run build
```

---

## Project Overview

VALORHIVE is a multi-sport tournament management platform supporting **Cornhole** and **Darts**. It handles:

- Player registration, subscriptions, and tournament participation
- Organization management with roster systems
- Tournament creation, bracket generation, and match management
- Payment processing via Razorpay with GST invoicing
- Real-time notifications and WebSocket updates

---

## Key Files & Locations

### Database
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Complete schema with 55+ models |
| `db/custom.db` | SQLite development database |

### Authentication & Authorization
| File | Purpose |
|------|---------|
| `src/lib/auth/rbac.ts` | Role-based access control with tournament scoping |
| `src/lib/auth/session-revocation.ts` | Session invalidation on password change |
| `src/lib/auth/org-session.ts` | Organization session management |

### Payment Integration
| File | Purpose |
|------|---------|
| `src/lib/payments/razorpay.ts` | Razorpay integration with timing-safe verification |
| `src/lib/invoice/index.ts` | GST invoice generation |

### Tournament System
| File | Purpose |
|------|---------|
| `src/lib/bracket/index.ts` | Bracket generation (Single/Double Elim, Round Robin) |

### Rate Limiting & Security
| File | Purpose |
|------|---------|
| `src/lib/rate-limit-redis.ts` | Redis-backed rate limiting (Upstash) |
| `src/lib/rate-limit.ts` | In-memory rate limiting (dev fallback) |

### Email & Notifications
| File | Purpose |
|------|---------|
| `src/lib/email.ts` | Email templates |
| `src/lib/email-queue.ts` | Async email queue service |
| `src/lib/notifications.ts` | In-app notifications |

### Media Storage
| File | Purpose |
|------|---------|
| `src/lib/media-storage.ts` | S3/Uploadthing integration |

### Mini Services
| Location | Port | Purpose |
|----------|------|---------|
| `mini-services/tournament-ws/` | 3003 | WebSocket real-time updates |
| `mini-services/cron-service/` | 3005 | Scheduled tasks (subscriptions, no-shows, waitlist) |

### PWA Files
| File | Purpose |
|------|---------|
| `public/manifest.json` | PWA manifest |
| `public/sw.js` | Service worker for offline support |

---

## Database Schema Summary

### Core Models (55+ total)

| Category | Models |
|----------|--------|
| Users | User, Session, MfaSecret, MfaRecoveryCode |
| Organizations | Organization, OrgAdmin, OrgRosterPlayer, OrgSubscription |
| Tournaments | Tournament, TournamentRegistration, TournamentWaitlist, TournamentResult |
| Brackets | Bracket, BracketMatch |
| Matches | Match, MatchResultHistory |
| Payments | PaymentLedger, Invoice, Wallet |
| Ratings | PlayerRating, PlayerAchievement |
| Security | AuditLog, Dispute, DocumentVerification |
| Communications | Notification, EmailJob, PushSubscription, Conversation, Message |
| Infrastructure | Venue, EmailJob, PushSubscription |

### Key Enums

```typescript
enum SportType { CORNHOLE, DARTS }
enum Role { PLAYER, ORG_ADMIN, SUB_ADMIN, ADMIN, TOURNAMENT_DIRECTOR }
enum TournamentStatus { DRAFT, REGISTRATION_OPEN, REGISTRATION_CLOSED, BRACKET_GENERATED, IN_PROGRESS, COMPLETED, CANCELLED }
enum BracketFormat { SINGLE_ELIMINATION, DOUBLE_ELIMINATION, ROUND_ROBIN }
enum PaymentLedgerStatus { INITIATED, PAID, FAILED, REFUNDED }
```

---

## API Endpoints Summary

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/send-otp
POST /api/auth/verify-otp
POST /api/auth/google
```

### Tournaments
```
GET  /api/tournaments
GET  /api/tournaments/[id]
POST /api/tournaments/[id]/register
POST /api/tournaments/[id]/checkin
POST /api/tournaments/[id]/withdraw
GET  /api/tournaments/[id]/bracket
POST /api/tournaments/[id]/bracket/generate
```

### Payments
```
POST /api/payments/create-order
POST /api/payments/verify
POST /api/payments/webhook
POST /api/payments/refund
```

### Admin
```
POST /api/admin/tournaments/[id]/approve
POST /api/admin/players/[id]/ban
GET  /api/admin/audit-logs
```

---

## Environment Variables Required

```bash
# Database
DATABASE_URL=file:/home/z/my-project/db/custom.db

# Razorpay
RAZORPAY_KEY_ID=rzp_test_SGjrWSbc9vr3vV
RAZORPAY_KEY_SECRET=I3uU6G1aqPveJiSBn6kqOJe7
RAZORPAY_WEBHOOK_SECRET=<set-in-production>

# Pricing (paise)
PLAYER_SUBSCRIPTION_YEARLY=120000
ORG_SCHOOL_CLUB_YEARLY=1500000
ORG_CORPORATE_YEARLY=10000000

# GST
PLATFORM_GSTIN=29XXXXX1234X1XX
PLATFORM_ADDRESS="Bangalore, Karnataka, India"

# Redis (production)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Media Storage (choose one)
# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
S3_BUCKET=

# Or Uploadthing
UPLOADTHING_SECRET=
UPLOADTHING_APP_ID=

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

---

## Business Rules

### Subscription Pricing
| User Type | Annual Fee |
|-----------|------------|
| Player | ₹1,200/year per sport |
| Org (School/Club) | ₹15,000/year |
| Org (Corporate) | ₹1,00,000/year |

### Rating System
- **Hidden Elo**: Used for bracket seeding, never shown to players
- **Visible Points**: Weighted by tournament scope (City/District/State/National)

### Refund Rules
| Timing | Refund |
|--------|--------|
| > 7 days before | 100% |
| 3-7 days before | 75% |
| 1-3 days before | 50% |
| < 24 hours | 0% |

---

## Production Checklist

### Before Launch
- [ ] Migrate to PostgreSQL
- [ ] Configure Redis for rate limiting
- [ ] Set production Razorpay keys
- [ ] Configure webhook secret
- [ ] Set up email provider
- [ ] Configure GSTIN
- [ ] Set up SSL/TLS
- [ ] Configure CDN

### PostgreSQL Migration
See `docs/POSTGRES_MIGRATION.md` for complete guide.

---

## Known Limitations (Current State)

1. **SQLite in Dev**: Works fine, but PostgreSQL required for production scale
2. **In-memory Rate Limiting**: Falls back automatically if Redis not configured
3. **Email Queue**: Uses database, consider Redis-backed BullMQ for high volume
4. **Web Push**: Service worker ready but push server not implemented

---

## Testing Credentials

### Razorpay (Test Mode)
```
Key ID: rzp_test_SGjrWSbc9vr3vV
Key Secret: I3uU6G1aqPveJiSBn6kqOJe7
```

### Test Cards
Use Razorpay test card numbers for payment testing.

---

## Documentation Files

| File | Description |
|------|-------------|
| `PROJECT_SPEC.md` | Complete system specification (1052 lines) |
| `worklog.md` | Development history with all tasks |
| `docs/POSTGRES_MIGRATION.md` | PostgreSQL migration guide |

---

## Support & Maintenance

### Cron Jobs (Port 3005)
- Subscription expiry reminders
- Waitlist promotion
- No-show marking
- Email queue processing

### WebSocket Events (Port 3003)
- `match:result` - Match result updates
- `bracket:update` - Bracket progression
- `notification:new` - New notifications

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        VALORHIVE Platform                       │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 16 App Router (Port 3000)                              │
│  ├── /api/* - REST API Routes                                   │
│  └── /[sport]/* - Dynamic Sport Pages                           │
├─────────────────────────────────────────────────────────────────┤
│  Mini Services                                                  │
│  ├── WebSocket Service (Port 3003) - Real-time updates          │
│  └── Cron Service (Port 3005) - Scheduled tasks                 │
├─────────────────────────────────────────────────────────────────┤
│  External Services                                              │
│  ├── Razorpay - Payments                                        │
│  ├── Upstash Redis - Rate Limiting (optional)                   │
│  ├── AWS S3 / Uploadthing - Media Storage                       │
│  └── SMTP Provider - Email                                      │
├─────────────────────────────────────────────────────────────────┤
│  Database                                                       │
│  ├── SQLite (Development)                                       │
│  └── PostgreSQL (Production)                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

*This document provides everything needed to understand, maintain, and extend the VALORHIVE platform.*
