# VALORHIVE Railway Deployment Guide

## Quick Deploy Checklist

### ✅ Ready
- [x] `railway.toml` - Railway configuration
- [x] `Procfile` - Multi-process configuration
- [x] `package.json` - Build scripts with postinstall
- [x] Health endpoint at `/api/health`
- [x] `.env.example` - Environment template
- [x] Standalone output in `next.config.ts`

### ⚠️ Required Actions

#### 1. Database Setup
Railway provides PostgreSQL. You need to:

**Option A: Use Railway PostgreSQL (Recommended)**
```bash
# In Railway dashboard:
# 1. Add PostgreSQL service
# 2. Link it to your app
# 3. DATABASE_URL will be auto-injected
```

**Option B: External PostgreSQL**
Set `DATABASE_URL` in Railway environment variables:
```
DATABASE_URL=postgresql://user:password@host:5432/valorhive?schema=public
```

#### 2. Run Migrations on Deploy
Add this to your Railway start command or use a release phase:

```toml
# In railway.toml, add:
[deploy]
releaseCommand = "bunx prisma migrate deploy"
```

Or modify the Procfile:
```
web: bunx prisma migrate deploy && bun run start
```

#### 3. Required Environment Variables
Set these in Railway Dashboard → Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ Yes | 32+ char secret for sessions |
| `REDIS_URL` | ✅ Yes | Redis connection (add Redis service) |
| `RAZORPAY_KEY_ID` | ✅ Yes | Razorpay key |
| `RAZORPAY_KEY_SECRET` | ✅ Yes | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ Yes | Webhook verification |
| `SMTP_HOST` | ⚠️ Recommended | Email service |
| `SMTP_USER` | ⚠️ Recommended | Email user |
| `SMTP_PASS` | ⚠️ Recommended | Email password |
| `AWS_ACCESS_KEY_ID` | ⚠️ Recommended | S3 storage |
| `AWS_SECRET_ACCESS_KEY` | ⚠️ Recommended | S3 storage |
| `AWS_S3_BUCKET` | ⚠️ Recommended | S3 bucket name |
| `ENCRYPTION_KEY` | ⚠️ Recommended | 32-byte key for KYC encryption |

---

## Deployment Options

### Option 1: Single Service with Procfile (Current Setup)

Deploy everything in one Railway service:
- Uses Procfile to run multiple processes
- Simpler but all services share resources

```
railway.toml + Procfile
```

### Option 2: Separate Services (Recommended for Production)

Create 3 separate Railway services:

**Service 1: Web (Main App)**
```bash
# Root directory
# Start command: bun run start
# Port: 3000
```

**Service 2: WebSocket**
```bash
# Root directory: mini-services/tournament-ws
# Start command: bun run start
# Port: 3003
# Env: REDIS_URL (same as main)
```

**Service 3: Cron**
```bash
# Root directory: mini-services/cron-service
# Start command: bun run start
# Port: 3004
# Env: DATABASE_URL, REDIS_URL (same as main)
```

### Option 3: Simplified Single Service

If you don't need WebSocket/cron initially:

1. Delete Procfile
2. Deploy only the main app
3. Add services later

---

## Step-by-Step Railway Deploy

### 1. Install Railway CLI (optional)
```bash
npm i -g @railway/cli
railway login
```

### 2. Create New Project
```bash
railway init
# Or connect GitHub repo in Railway dashboard
```

### 3. Add PostgreSQL
```bash
railway add --plugin postgresql
```

### 4. Add Redis
```bash
railway add --plugin redis
```

### 5. Set Environment Variables
```bash
# Via CLI:
railway variables set SESSION_SECRET="your-32-char-secret"
railway variables set RAZORPAY_KEY_ID="rzp_live_xxx"
railway variables set RAZORPAY_KEY_SECRET="xxx"
# ... etc

# Or in Railway Dashboard → Variables tab
```

### 6. Deploy
```bash
railway up
# Or push to GitHub and auto-deploy
```

### 7. Run Database Migrations
```bash
railway run bunx prisma migrate deploy
```

### 8. Generate Domain
```bash
railway domain
# Or add custom domain in dashboard
```

---

## Troubleshooting

### Build Fails
- Check `bun.lock` is committed
- Verify `DATABASE_URL` is set
- Check build logs for specific errors

### App Crashes on Start
- Check if `prisma generate` ran (should auto-run via postinstall)
- Verify all required env vars are set
- Check health endpoint: `/api/health`

### Database Connection Fails
- Verify PostgreSQL service is running
- Check DATABASE_URL format
- Ensure SSL is configured (Railway provides SSL by default)

### WebSocket Not Working
- Check REDIS_URL is set
- Verify port 3003 is accessible
- Check WebSocket logs in Railway

---

## Production Checklist

Before going live:
- [ ] Rotate Razorpay keys (use live keys)
- [ ] Set up proper CORS origins
- [ ] Configure custom domain with SSL
- [ ] Set up error monitoring (Sentry)
- [ ] Configure backup for PostgreSQL
- [ ] Set up monitoring alerts
- [ ] Review all environment variables for production values
