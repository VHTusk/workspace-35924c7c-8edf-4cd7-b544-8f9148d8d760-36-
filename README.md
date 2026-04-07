# VALORHIVE

Multi-sport tournament management platform for grassroots sports in India. Currently supporting **Cornhole** and **Darts** with plans for expansion.

## Overview

VALORHIVE connects players, tournament organizers, and sports organizations through a unified platform for tournament discovery, registration, bracket management, and competitive rankings.

### Key Features

- **Player Experience**: Tournament discovery, registration, check-in, live brackets, results tracking, and ELO-based rankings
- **Organization Portal**: School, college, and corporate sports program management with team rosters and internal competitions
- **Tournament Director Tools**: Bracket generation, score entry, check-in management, and real-time updates
- **Admin Governance**: User verification, dispute resolution, and platform moderation

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 with shadcn/ui components
- **Database**: Prisma ORM with SQLite (development) / PostgreSQL (production)
- **Authentication**: NextAuth.js with email/password, Google OAuth, WhatsApp OTP
- **Real-time**: Socket.io for live match updates and bracket synchronization
- **Payments**: Razorpay integration for tournament entry fees and subscriptions

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Initialize database
npm run db:push
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests with Vitest |
| `npm run test:e2e` | Run E2E tests with Playwright |
| `npm run db:push` | Push schema changes to database |
| `npm run db:studio` | Open Prisma Studio |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── [sport]/           # Sport-specific routes (cornhole, darts)
│   │   ├── dashboard/     # Player dashboard
│   │   ├── tournaments/   # Tournament browsing and registration
│   │   ├── admin/         # Admin panel
│   │   ├── director/      # Tournament director tools
│   │   └── org/           # Organization portal
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui primitives
│   ├── layout/           # Layout components (sidebar, header)
│   ├── tournament/       # Tournament-related components
│   ├── auth/             # Authentication components
│   └── ...
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries and business logic
└── __tests__/            # Unit and integration tests

prisma/
├── schema.prisma         # Database schema
└── seed.ts               # Database seeding

mini-services/            # Microservices
├── tournament-ws/        # Tournament WebSocket service
├── court-status-ws/      # Court status WebSocket service
└── cron-service/         # Background job scheduler
```

## User Types

| Role | Description |
|------|-------------|
| **Player** | Individual competitors registering for tournaments |
| **Organization** | Schools, colleges, corporates managing sports programs |
| **Director** | Tournament organizers with scoring and management tools |
| **Admin** | Platform administrators with governance capabilities |

## Tournament Flow

1. **Discovery**: Players browse tournaments by location, skill level, and format
2. **Registration**: Online registration with payment processing
3. **Check-in**: Day-of check-in via QR code or manual verification
4. **Competition**: Live bracket updates with real-time scoring
5. **Results**: Automatic ELO calculation and ranking updates

## Development

### Environment Variables

Required environment variables (see `.env.example`):

```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
RAZORPAY_KEY_ID="your-razorpay-key"
RAZORPAY_KEY_SECRET="your-razorpay-secret"
```

### Database

```bash
# Create a new migration
npm run db:migrate

# Reset database (development only)
npm run db:reset

# View data in Prisma Studio
npm run db:studio
```

### Testing

```bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Deployment

### Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# Run migrations
docker-compose exec app npm run db:migrate:deploy
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure PostgreSQL database
- [ ] Set up Redis for sessions and caching
- [ ] Configure Razorpay webhook endpoint
- [ ] Enable Sentry for error monitoring
- [ ] Set up CDN for static assets

## Contributing

1. Create a feature branch from `main`
2. Make changes with appropriate tests
3. Run `npm run lint` and `npm run test`
4. Submit a pull request

## License

Proprietary - All rights reserved.
