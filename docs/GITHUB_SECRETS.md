# VALORHIVE GitHub Secrets Configuration

This document describes all required GitHub secrets for the CI/CD pipeline to deploy VALORHIVE to AWS.

## Table of Contents

- [AWS Credentials](#aws-credentials)
- [Database Configuration](#database-configuration)
- [ECR Configuration](#ecr-configuration)
- [ECS Configuration](#ecs-configuration)
- [CloudFront Configuration](#cloudfront-configuration)
- [Application Secrets](#application-secrets)
- [Payment Gateway](#payment-gateway)
- [Communication Services](#communication-services)
- [Optional Services](#optional-services)
- [Setting Up Secrets](#setting-up-secrets)

---

## AWS Credentials

Required for AWS API access during deployment.

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key ID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | AWS region for deployment | `ap-south-1` |

### IAM Policy Requirements

The IAM user needs the following minimum permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:DescribeTasks",
        "ecs:ListTasks",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:WaitServicesStable"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Database Configuration

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/valorhive?schema=public` |

### Connection String Format

```
postgresql://[user]:[password]@[host]:[port]/[database]?schema=public
```

### AWS RDS Configuration

If using AWS RDS:
- Ensure the RDS instance is in the same VPC as ECS
- Configure security groups to allow ECS access
- Use IAM database authentication for enhanced security (optional)

---

## ECR Configuration

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `ECR_REPOSITORY` | ECR repository name | `valorhive` |

### Creating ECR Repository

```bash
aws ecr create-repository \
  --repository-name valorhive \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256
```

---

## ECS Configuration

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `ECS_CLUSTER` | ECS cluster name | `valorhive-production` |
| `ECS_SERVICE` | ECS service name | `valorhive-web` |

### Creating ECS Resources

```bash
# Create cluster
aws ecs create-cluster --cluster-name valorhive-production

# Create service (after task definition)
aws ecs create-service \
  --cluster valorhive-production \
  --service-name valorhive-web \
  --task-definition valorhive-task \
  --desired-count 2 \
  --launch-type FARGATE
```

---

## CloudFront Configuration

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID | `E1ABCD2EFGHIJ3` |

### Finding Distribution ID

```bash
aws cloudfront list-distributions --query "DistributionList.Items[*].{ID:Id,Domain:DomainName}"
```

---

## Application Secrets

| Secret Name | Description | Min Length |
|-------------|-------------|------------|
| `SESSION_SECRET` | Secret for session encryption | 32 chars |
| `NEXTAUTH_SECRET` | NextAuth.js secret | 32 chars |

### Generating Secrets

```bash
# Generate random secret
openssl rand -base64 32
```

---

## Payment Gateway

### Razorpay Configuration

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `RAZORPAY_KEY_ID` | Razorpay key ID | `rzp_live_xxxxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret | `xxxxx` |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook verification secret | `xxxxx` |

---

## Communication Services

### SendGrid (Email)

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SENDGRID_API_KEY` | SendGrid API key | `SG.xxxxx` |
| `SENDGRID_FROM_EMAIL` | Sender email address | `noreply@valorhive.in` |

### MSG91 (SMS)

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `MSG91_AUTH_KEY` | MSG91 authentication key | `xxxxx` |
| `MSG91_TEMPLATE_ID` | SMS template ID | `xxxxx` |

### Twilio (WhatsApp)

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID | `ACxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | `xxxxx` |
| `TWILIO_WHATSAPP_NUMBER` | WhatsApp business number | `+91xxxxxxxxxx` |

---

## Optional Services

### Redis (ElastiCache)

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `REDIS_URL` | Redis connection URL | `redis://elasticache.xxxxx.cache.amazonaws.com:6379` |

### Firebase Cloud Messaging

| Secret Name | Description |
|-------------|-------------|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |

### Google OAuth

| Secret Name | Description |
|-------------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

### reCAPTCHA

| Secret Name | Description |
|-------------|-------------|
| `RECAPTCHA_SITE_KEY` | reCAPTCHA site key |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA secret key |

### Codecov (Coverage Reports)

| Secret Name | Description |
|-------------|-------------|
| `CODECOV_TOKEN` | Codecov upload token |

---

## Setting Up Secrets

### Via GitHub Web Interface

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

### Via GitHub CLI

```bash
# Set a single secret
gh secret set AWS_ACCESS_KEY_ID --body "your-access-key-id"

# Set secrets from a file
gh secret set AWS_ACCESS_KEY_ID < secret.txt

# List all secrets (names only)
gh secret list
```

### Via GitHub API

```bash
curl -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/OWNER/REPO/actions/secrets/SECRET_NAME \
  -d '{"encrypted_value":"ENCRYPTED_VALUE","key_id":"KEY_ID"}'
```

---

## Environment-Specific Secrets

For staging and production environments, use **Environment Secrets**:

1. Go to **Settings** → **Environments**
2. Create environments: `staging` and `production`
3. Add secrets to each environment
4. Configure protection rules:
   - Required reviewers for production
   - Wait timer for deployments
   - Deployment branches

### Environment Secret Mapping

| Secret | Staging | Production |
|--------|---------|------------|
| `DATABASE_URL` | Staging DB | Production DB |
| `ECR_REPOSITORY` | `valorhive-staging` | `valorhive` |
| `ECS_CLUSTER` | `valorhive-staging` | `valorhive-production` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Staging distribution | Production distribution |
| `RAZORPAY_KEY_ID` | Test key | Live key |

---

## Security Best Practices

### 1. Rotate Secrets Regularly

- AWS access keys: Every 90 days
- API keys: Every 180 days
- Session secrets: Every year

### 2. Use Least Privilege

- Create dedicated IAM users for CI/CD
- Restrict API key permissions to minimum required
- Use environment-specific credentials

### 3. Audit Secret Access

- Review GitHub Actions logs for secret exposure
- Enable AWS CloudTrail for API audit
- Monitor for leaked credentials in commits

### 4. Never Commit Secrets

Use `.gitignore` to exclude:
```gitignore
.env
.env.local
.env.production
secrets/
*.pem
*.key
```

### 5. Use Secret Scanning

Enable GitHub's secret scanning:
1. Go to **Settings** → **Security & analysis**
2. Enable **Secret scanning**
3. Configure **Push protection**

---

## Troubleshooting

### Common Issues

#### 1. "Access Denied" during ECR push

**Solution:** Verify IAM policy includes ECR permissions and check if access key is not expired.

#### 2. "Service not found" during ECS deployment

**Solution:** Ensure `ECS_CLUSTER` and `ECS_SERVICE` match actual resource names in AWS.

#### 3. Database migration fails

**Solution:** 
- Check `DATABASE_URL` format
- Verify ECS task has network access to RDS
- Check if migrations are compatible

#### 4. CloudFront invalidation times out

**Solution:** This is a warning, not an error. Invalidations complete asynchronously.

---

## Quick Reference Card

```bash
# Required secrets (minimum for deployment)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=ap-south-1
ECR_REPOSITORY=valorhive
ECS_CLUSTER=valorhive-production
ECS_SERVICE=valorhive-web
DATABASE_URL=postgresql://user:pass@host:5432/valorhive
CLOUDFRONT_DISTRIBUTION_ID=E1ABCD2EFGHIJ3
SESSION_SECRET=your-32-char-secret-here
NEXTAUTH_SECRET=your-32-char-secret-here

# Payment (for live transactions)
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
```

---

## Support

For issues with secrets configuration:
- Create an issue in the repository
- Contact DevOps team
- Check AWS service health dashboard

---

*Last updated: $(date +%Y-%m-%d)*
