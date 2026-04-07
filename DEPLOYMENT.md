# VALORHIVE Deployment Guide

This document explains how to deploy VALORHIVE in different environments.

---

## Quick Reference

| Environment | Method | Command |
|-------------|--------|---------|
| **Local Development** | Docker Compose | `docker compose up -d` |
| **Production Simulation** | Docker Compose | `docker compose -f docker-compose.prod.yml up -d` |
| **Production** | Terraform + ECS Fargate | `terraform apply` |

---

## Local Development

### Prerequisites
- Docker Desktop or Docker Engine
- Docker Compose v2+

### Starting Local Environment

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Stop all services
docker compose down
```

### Services Included
- **App** (port 3000) - Main application
- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Cache
- **Worker** - Background job processor
- **Realtime Gateway** (port 3004) - WebSocket server
- **Prometheus** (port 9090) - Metrics collection
- **Grafana** (port 3001) - Monitoring dashboards

### Files
- `docker-compose.yml` - Local development configuration

---

## Production Simulation (Local)

This is useful for testing production-like configurations locally.

```bash
# Start production simulation
docker compose -f docker-compose.prod.yml up -d

# Stop
docker compose -f docker-compose.prod.yml down
```

### Differences from Local Development
- Uses Docker secrets for sensitive data
- Includes PgBouncer for connection pooling
- More restrictive resource limits
- Production-like logging configuration

### Files
- `docker-compose.prod.yml` - Production simulation configuration

---

## Production Deployment

### Architecture
VALORHIVE uses **AWS ECS Fargate** for production deployments.

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Cloud                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │ CloudFront  │────▶│     ALB     │────▶│  ECS Fargate │   │
│  │    (CDN)    │     │ (Load Bal.) │     │   (App)      │   │
│  └─────────────┘     └─────────────┘     └─────────────┘   │
│                              │                   │          │
│                              ▼                   ▼          │
│                    ┌─────────────┐     ┌─────────────┐     │
│                    │  Aurora RDS │     │ ElastiCache │     │
│                    │ (PostgreSQL)│     │   (Redis)   │     │
│                    └─────────────┘     └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Why ECS Fargate?
- **Serverless containers** - No EC2 instances to manage
- **Auto-scaling** - Automatic scaling based on CPU/memory
- **Cost-effective** - Pay only for running containers
- **Simpler than EKS** - Lower operational overhead
- **Native AWS integration** - Works with ALB, CloudWatch, Secrets Manager

### Prerequisites
1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.5.0
3. ECR repository with container images
4. S3 bucket for Terraform state
5. DynamoDB table for state locking

### Deployment Steps

#### 1. Initialize Terraform
```bash
cd terraform
terraform init
```

#### 2. Configure Variables
Create `terraform.tfvars` or use environment variables:
```hcl
aws_region        = "ap-south-1"
environment       = "prod"
ecr_repository_url = "123456789012.dkr.ecr.ap-south-1.amazonaws.com/valorhive"
domain_name       = "valorhive.com"
```

#### 3. Plan Deployment
```bash
terraform plan -out=tfplan
```

#### 4. Apply Configuration
```bash
terraform apply tfplan
```

#### 5. Push Container Images
```bash
# Build and push to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.ap-south-1.amazonaws.com

docker build -t valorhive:latest .
docker tag valorhive:latest 123456789012.dkr.ecr.ap-south-1.amazonaws.com/valorhive:latest
docker push 123456789012.dkr.ecr.ap-south-1.amazonaws.com/valorhive:latest
```

### Terraform Files
- `terraform/main.tf` - Core infrastructure (VPC, RDS, Redis, S3, CloudFront)
- `terraform/ecs.tf` - ECS cluster, task definitions, services, auto-scaling
- `terraform/waf.tf` - Web Application Firewall rules
- `terraform/variables.tf` - Configurable variables
- `terraform/outputs.tf` - Output values (endpoints, etc.)

### ECS Services Deployed
| Service | Task Count | CPU | Memory |
|---------|------------|-----|--------|
| App | 2-10 (auto-scale) | 1024 | 2048 |
| Worker | 1-5 (auto-scale) | 512 | 1024 |
| Realtime Gateway | 1-5 (auto-scale) | 512 | 512 |

---

## Important Notes

### ⚠️ Docker Compose Limitations

Docker Compose files in this project are **NOT** suitable for production deployment because:

1. **No orchestration** - Containers run on a single host
2. **No auto-scaling** - Cannot automatically scale based on load
3. **No high availability** - Single point of failure
4. **No secrets management** - Secrets stored in files (not secure)
5. **No rolling updates** - Downtime during deployments

### Swarm-Only Features Removed

The following Docker Swarm features have been removed from compose files:
- `deploy.replicas` - Use ECS service `desired_count` instead
- `deploy.update_config` - Use ECS deployment configuration
- `deploy.rollback_config` - Use ECS deployment rollback settings

### Resource Limits

`deploy.resources` **does work** in Docker Compose and is kept for local resource management.

---

## Troubleshooting

### Local Development Issues

**Container won't start:**
```bash
# Check logs
docker compose logs app

# Rebuild containers
docker compose down -v
docker compose up -d --build
```

**Database connection errors:**
```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check secrets files exist
ls -la secrets/
```

### Production Issues

**ECS task won't start:**
1. Check CloudWatch logs for the task
2. Verify secrets exist in Secrets Manager
3. Check security group rules
4. Verify ECR image exists

**Application errors:**
1. Check CloudWatch logs: `/aws/ecs/valorhive-prod/app`
2. Check ALB target group health
3. Verify database connectivity

---

## Support

For deployment issues, contact the DevOps team or create an issue in the repository.
