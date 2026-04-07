# VALORHIVE Complete Setup Guide

## 📋 Overview of Required Services

| Service | Purpose | Free Tier | Required |
|---------|---------|-----------|----------|
| **Railway** | Hosting Platform | $5/month credit | ✅ Yes |
| **PostgreSQL** | Database | Free on Railway | ✅ Yes |
| **Redis** | Caching & Sessions | Free on Railway | ✅ Yes |
| **Razorpay** | Payment Gateway | Free | ✅ Yes |
| **Google OAuth** | Social Login | Free | ⚠️ Recommended |
| **AWS S3** | File Storage | Free tier available | ⚠️ Recommended |
| **Email (SMTP)** | Notifications | Gmail free | ⚠️ Recommended |
| **Sentry** | Error Monitoring | Free tier | Optional |
| **Firebase** | Push Notifications | Free tier | Optional |

---

## Step 1: Download & Extract Project

```bash
# Extract the downloaded project
unzip valorhive-project.zip
cd valorhive

# Install dependencies
bun install
```

---

## Step 2: Set Up GitHub Repository

```bash
# Initialize git if not already
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - VALORHIVE v3.26.0"

# Create repo on GitHub, then push
git remote add origin https://github.com/YOUR_USERNAME/valorhive.git
git branch -M main
git push -u origin main
```

---

## Step 3: Create Railway Account & Project

### 3.1 Sign Up for Railway
1. Go to [railway.app](https://railway.app)
2. Click **"Start a New Project"**
3. Sign up with **GitHub** (easier for auto-deploy)

### 3.2 Create New Project
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Select your `valorhive` repository
4. Railway will start building automatically

---

## Step 4: Add Database & Redis

### 4.1 Add PostgreSQL
1. In your Railway project, click **"+"** (Add New)
2. Select **"Database"** → **"PostgreSQL"**
3. Railway creates it automatically
4. Click on PostgreSQL → **"Variables"** tab
5. Copy the `DATABASE_URL` value

### 4.2 Add Redis
1. Click **"+"** again
2. Select **"Database"** → **"Redis"**
3. Railway creates it automatically
4. Copy the `REDIS_URL` value

### 4.3 Link Services
1. Click on your **main service** (the web app)
2. Go to **"Variables"** tab
3. Click **"Add Variable"** → **"Add Reference"**
4. Select `DATABASE_URL` from PostgreSQL
5. Select `REDIS_URL` from Redis

---

## Step 5: Set Up Razorpay (Payment Gateway)

### 5.1 Create Razorpay Account
1. Go to [razorpay.com](https://razorpay.com)
2. Click **"Sign Up"**
3. Complete business verification (KYC)

### 5.2 Get API Keys
1. Go to **Dashboard** → **Settings** → **API Keys**
2. Click **"Generate Key"**
3. Copy:
   - **Key ID** (starts with `rzp_test_` or `rzp_live_`)
   - **Key Secret** (shown only once!)

### 5.3 Create Webhook Secret
1. Go to **Settings** → **Webhooks**
2. Click **"Add New Webhook"**
3. Enter webhook URL: `https://your-domain.railway.app/api/payments/webhook`
4. Copy the **Webhook Secret**

### 5.4 Add to Railway Variables
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx
```

---

## Step 6: Set Up Google OAuth (Social Login)

### 6.1 Go to Google Cloud Console
1. Visit [console.cloud.google.com](https://console.cloud.google.com)
2. Create a **New Project** (or select existing)
3. Name it "VALORHIVE"

### 6.2 Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **"External"** (unless you have Google Workspace)
3. Fill in:
   - App name: **VALORHIVE**
   - User support email: Your email
   - Developer contact: Your email
4. Click **"Save and Continue"**
5. Add **Scopes**: email, profile (just click "Add" for each)
6. Add **Test Users**: Your email address

### 6.3 Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Select **"Web application"**
4. Name: **VALORHIVE Web**
5. Add **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   https://your-railway-app.railway.app
   ```
6. Add **Authorized redirect URIs**:
   ```
   http://localhost:3000/api/auth/google
   https://your-railway-app.railway.app/api/auth/google
   ```
7. Click **"Create"**
8. Copy:
   - **Client ID**
   - **Client Secret**

### 6.4 Add to Railway Variables
```
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxx
```

---

## Step 7: Set Up Email (SMTP)

### Option A: Gmail (Free, Easiest)

#### 7.1 Enable 2FA on Gmail
1. Go to [myaccount.google.com](https://myaccount.google.com)
2. **Security** → **2-Step Verification** → Enable

#### 7.2 Create App Password
1. Go to **Security** → **2-Step Verification** → **App passwords**
2. Select **"Mail"** and **"Other (Custom name)"**
3. Name it "VALORHIVE"
4. Click **"Generate"**
5. Copy the 16-character password

#### 7.3 Add to Railway Variables
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
EMAIL_FROM=noreply@yourdomain.com
```

### Option B: Resend (Better for Production)
1. Go to [resend.com](https://resend.com)
2. Sign up free
3. Create API Key
4. Add variable:
```
RESEND_API_KEY=re_xxxxxxxxxxxx
```

---

## Step 8: Set Up AWS S3 (File Storage)

### 8.1 Create AWS Account
1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Sign up (free tier for 12 months)

### 8.2 Create S3 Bucket
1. Go to **S3** service
2. Click **"Create bucket"**
3. Name: `valorhive-uploads` (must be globally unique)
4. Region: **Asia Pacific (Mumbai)** or closest
5. Block Public Access: **Uncheck** "Block all" (for public images)
6. Click **"Create bucket"**

### 8.3 Create IAM User
1. Go to **IAM** → **Users** → **"Create user"**
2. Name: `valorhive-s3`
3. Select **"Attach policies directly"**
4. Search and select: `AmazonS3FullAccess`
5. Click **"Create user"**
6. Click on user → **"Security credentials"** tab
7. Click **"Create access key"**
8. Copy:
   - **Access Key ID**
   - **Secret Access Key**

### 8.4 Add to Railway Variables
```
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-south-1
AWS_S3_BUCKET=valorhive-uploads
```

---

## Step 9: Set Up Session Secret

Generate a secure random string:

```bash
# Run this command to generate a secret
openssl rand -base64 32
```

Or use an online generator: [generate-random.org](https://generate-random.org/encryption-key-generator)

Add to Railway Variables:
```
SESSION_SECRET=your-generated-32-character-secret-here
NEXTAUTH_SECRET=your-generated-32-character-secret-here
```

---

## Step 10: Complete Railway Variables

Go to Railway → Your Service → Variables tab, add all these:

```
# ===========================================
# REQUIRED - Must Set
# ===========================================
DATABASE_URL=[Auto-injected from PostgreSQL service]
REDIS_URL=[Auto-injected from Redis service]
SESSION_SECRET=[Generate 32-char random string]
NEXTAUTH_SECRET=[Generate 32-char random string]
NEXTAUTH_URL=https://your-app.railway.app

# ===========================================
# PAYMENT - Razorpay
# ===========================================
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx

# ===========================================
# AUTH - Google OAuth
# ===========================================
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxx

# ===========================================
# EMAIL - SMTP (Gmail)
# ===========================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
EMAIL_FROM=noreply@yourdomain.com

# ===========================================
# FILE STORAGE - AWS S3
# ===========================================
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-south-1
AWS_S3_BUCKET=valorhive-uploads

# ===========================================
# OPTIONAL - Error Monitoring
# ===========================================
# NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Step 11: Deploy & Run Migrations

### 11.1 Trigger Deploy
- Railway auto-deploys when you push to GitHub
- Or click **"Redeploy"** in Railway dashboard

### 11.2 Run Database Migrations
1. Go to Railway → Your Service
2. Click **"Settings"** → **"Terminal"**
3. Run:
```bash
bunx prisma migrate deploy
bunx prisma db seed
```

Or use Railway CLI:
```bash
railway run bunx prisma migrate deploy
railway run bunx prisma db seed
```

---

## Step 12: Generate Domain

### 12.1 Get Railway Domain
1. Go to Railway → Your Service → **"Settings"**
2. Click **"Generate Domain"**
3. Copy your domain: `https://your-app.railway.app`

### 12.2 Update Variables with Domain
Update these variables:
```
NEXTAUTH_URL=https://your-app.railway.app
NEXT_PUBLIC_APP_URL=https://your-app.railway.app
```

---

## Step 13: Configure Webhooks

### 13.1 Update Razorpay Webhook
1. Go to Razorpay Dashboard → Settings → Webhooks
2. Update webhook URL to: `https://your-app.railway.app/api/payments/webhook`
3. Select events: `payment.captured`, `payment.failed`, `order.paid`

---

## Step 14: Test Your Deployment

### 14.1 Check Health
Visit: `https://your-app.railway.app/api/health`

Should return:
```json
{
  "status": "ok",
  "timestamp": "2025-02-21T...",
  "service": "VALORHIVE",
  "version": "3.26.0"
}
```

### 14.2 Test Registration
1. Go to `https://your-app.railway.app/cornhole/register`
2. Create a test account
3. Check email for verification

### 14.3 Test Payment
1. Use Razorpay test card: `4111 1111 1111 1111`
2. Any future expiry, any CVV
3. Complete test payment

---

## 📊 Complete Services Checklist

| # | Service | Status |
|---|---------|--------|
| 1 | GitHub Repository | ⬜ Created |
| 2 | Railway Account | ⬜ Created |
| 3 | Railway Project | ⬜ Created |
| 4 | PostgreSQL (Railway) | ⬜ Added |
| 5 | Redis (Railway) | ⬜ Added |
| 6 | Razorpay Account | ⬜ Created |
| 7 | Razorpay API Keys | ⬜ Copied |
| 8 | Razorpay Webhook | ⬜ Configured |
| 9 | Google Cloud Project | ⬜ Created |
| 10 | Google OAuth Credentials | ⬜ Created |
| 11 | Gmail App Password | ⬜ Generated |
| 12 | AWS Account | ⬜ Created |
| 13 | AWS S3 Bucket | ⬜ Created |
| 14 | AWS IAM User | ⬜ Created |
| 15 | Railway Variables | ⬜ All Set |
| 16 | Database Migrations | ⬜ Run |
| 17 | Domain Generated | ⬜ Done |
| 18 | Health Check | ⬜ Passing |

---

## 🆘 Troubleshooting

### Build Fails
```
Check Railway logs → Build tab
Common fixes:
- Ensure bun.lock is committed
- Check DATABASE_URL is set
```

### App Crashes
```
Check Railway logs → Deploy tab
Common fixes:
- Check SESSION_SECRET is set
- Run prisma migrate deploy
```

### Database Connection Error
```
Error: Can't reach database server
Fix: Ensure PostgreSQL is running and DATABASE_URL is correct
```

### Google OAuth Not Working
```
Error: redirect_uri_mismatch
Fix: Add exact Railway URL to Authorized redirect URIs in Google Console
```

---

## 📞 Need Help?

1. **Railway Logs**: Railway Dashboard → Your Service → Logs
2. **Database Issues**: Railway → PostgreSQL → Query tab
3. **Variable Issues**: Railway → Your Service → Variables

---

**Estimated Setup Time: 1-2 hours** (first time)
