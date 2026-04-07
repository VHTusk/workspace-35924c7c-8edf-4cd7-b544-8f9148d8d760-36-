# Data Backup Strategy

## Overview

This document outlines VALORHIVE's data backup and disaster recovery strategy to ensure business continuity and data protection.

---

## 1. Database Backup

### 1.1 Development (SQLite)

SQLite databases should be backed up manually:

```bash
# Create backup
cp /home/z/my-project/db/custom.db /home/z/my-project/backups/custom_$(date +%Y%m%d_%H%M%S).db

# Or use SQLite online backup (no downtime)
sqlite3 /home/z/my-project/db/custom.db ".backup '/home/z/my-project/backups/backup.db'"
```

### 1.2 Production (PostgreSQL)

#### Automated Backups (Managed Services)

| Provider | Backup Type | Retention | Point-in-Time Recovery |
|----------|-------------|-----------|------------------------|
| Supabase | Daily automatic | 7 days (free) / 30 days (pro) | Yes (pro) |
| Neon | Automatic | 7 days | Yes |
| Railway | Daily | 7 days | Limited |

#### Manual Backup Commands

```bash
# Full database dump
pg_dump -h localhost -U postgres -d valorhive > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -h localhost -U postgres -d valorhive | gzip > backup_$(date +%Y%m%d).sql.gz

# Backup specific tables
pg_dump -h localhost -U postgres -d valorhive -t User -t Tournament > critical_backup.sql
```

#### Backup Script (Cron)

```bash
#!/bin/bash
# /home/z/my-project/scripts/backup.sh

BACKUP_DIR="/home/z/my-project/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_URL=$DATABASE_URL

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
pg_dump $DB_URL | gzip > $BACKUP_DIR/valorhive_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Upload to cloud storage (optional)
# aws s3 cp $BACKUP_DIR/valorhive_$DATE.sql.gz s3://valorhive-backups/

echo "Backup completed: valorhive_$DATE.sql.gz"
```

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /home/z/my-project/scripts/backup.sh >> /var/log/valorhive-backup.log 2>&1
```

---

## 2. Critical Data to Backup

### 2.1 Must Backup (Frequent)

| Data | Type | Frequency | Priority |
|------|------|-----------|----------|
| Users table | User accounts | Daily | Critical |
| PaymentLedger | Financial records | Daily | Critical |
| TournamentRegistration | Registration data | Daily | Critical |
| Tournament | Tournament configs | Daily | High |
| Match | Match results | Daily | High |
| Bracket | Tournament brackets | Daily | High |

### 2.2 Important (Weekly)

| Data | Type | Frequency |
|------|------|-----------|
| Notification | User notifications | Weekly |
| AuditLog | Audit trails | Weekly |
| PlayerRating | Player statistics | Weekly |
| Subscription | Subscription data | Weekly |

### 2.3 Can Recreate (On Demand)

| Data | Type | Recovery Method |
|------|------|-----------------|
| LeaderboardSnapshot | Snapshots | Recalculate from Match data |
| ActivityFeed | Activity | Regenerate from source data |

---

## 3. Backup Storage Locations

### 3.1 Recommended Strategy (3-2-1 Rule)

- **3 copies** of data
- **2 different storage types
- **1 offsite location

### 3.2 Implementation

```
┌─────────────────┐
│   Primary DB    │  ← Production PostgreSQL
└────────┬────────┘
         │
    ┌────▼────┐
    │ Backup 1│  ← Same server (daily)
    └────┬────┘
         │
    ┌────▼────┐
    │ Backup 2│  ← Different server/region (weekly)
    └────┬────┘
         │
    ┌────▼────┐
    │ Backup 3│  ← Cloud storage (S3/R2) (monthly)
    └─────────┘
```

### 3.3 Cloud Storage Options

| Provider | Cost | Region |
|----------|------|--------|
| AWS S3 | $0.023/GB | ap-south-1 |
| Cloudflare R2 | $0.015/GB | Automatic |
| Backblaze B2 | $0.005/GB | Various |

---

## 4. Disaster Recovery

### 4.1 Recovery Time Objectives (RTO)

| Severity | RTO | Description |
|----------|-----|-------------|
| Critical | 1 hour | Payment system down |
| High | 4 hours | Tournament in progress affected |
| Medium | 24 hours | Non-critical features down |
| Low | 72 hours | Development/staging |

### 4.2 Recovery Point Objectives (RPO)

| Data Type | RPO | Backup Frequency |
|-----------|-----|------------------|
| Financial | 1 hour | Continuous replication |
| User data | 24 hours | Daily backup |
| Logs | 24 hours | Daily backup |

### 4.3 Recovery Steps

#### Database Recovery

```bash
# 1. Stop application
systemctl stop valorhive

# 2. Restore from backup
gunzip -c backup_20250115.sql.gz | psql -h localhost -U postgres -d valorhive

# 3. Verify data integrity
psql -h localhost -U postgres -d valorhive -c "SELECT COUNT(*) FROM users;"

# 4. Restart application
systemctl start valorhive

# 5. Clear caches
redis-cli FLUSHALL
```

#### Partial Recovery (Single Table)

```bash
# Restore specific table
pg_dump -h localhost -U postgres -d valorhive_restore -t Tournament > tournament_backup.sql
psql -h localhost -U postgres -d valorhive -c "TRUNCATE Tournament;"
psql -h localhost -U postgres -d valorhive < tournament_backup.sql
```

---

## 5. Backup Testing

### 5.1 Monthly Backup Test

```bash
#!/bin/bash
# Test backup integrity monthly

# 1. Create test database
psql -c "CREATE DATABASE valorhive_test;"

# 2. Restore latest backup
LATEST=$(ls -t /backups/*.sql.gz | head -1)
gunzip -c $LATEST | psql -d valorhive_test

# 3. Verify tables
psql -d valorhive_test -c "SELECT COUNT(*) FROM users;"
psql -d valorhive_test -c "SELECT COUNT(*) FROM tournaments;"

# 4. Check data integrity
psql -d valorhive_test -c "SELECT SUM(amount) FROM payment_ledger;"

# 5. Cleanup
psql -c "DROP DATABASE valorhive_test;"

echo "Backup test completed successfully"
```

### 5.2 Quarterly Recovery Drill

1. Simulate database failure in staging
2. Practice full recovery procedure
3. Document time taken
4. Update runbook if needed

---

## 6. Monitoring & Alerts

### 6.1 Backup Health Checks

```typescript
// Add to health check endpoint
const backupHealth = {
  lastBackup: await getLastBackupTime(),
  backupSize: await getBackupSize(),
  backupAge: calculateBackupAge(),
  status: 'healthy' | 'warning' | 'critical',
};
```

### 6.2 Alert Rules

| Condition | Severity | Action |
|-----------|----------|--------|
| No backup in 48 hours | Critical | Immediate notification |
| Backup failed | High | Retry + notification |
| Backup size decreased > 50% | Warning | Investigation needed |
| Recovery test failed | Critical | Manual intervention |

---

## 7. Retention Policy

| Backup Type | Retention Period |
|-------------|------------------|
| Daily backups | 30 days |
| Weekly backups | 12 weeks |
| Monthly backups | 12 months |
| Yearly backups | 7 years (for GST) |

---

## 8. Compliance Notes

### 8.1 GST Requirements (India)

- Financial records must be retained for **8 years**
- Invoice data must be preserved in original format
- Audit trail must be maintained

### 8.2 Data Protection (DPDPA)

- Personal data retention: Duration of account + reasonable period
- Delete/anonymize on request (within 30 days)
- Maintain deletion records

---

## 9. Backup Checklist

### Pre-Launch

- [ ] Automated backup configured
- [ ] Offsite backup location set up
- [ ] Backup encryption enabled
- [ ] Recovery procedure documented
- [ ] Team trained on recovery

### Monthly

- [ ] Verify backup integrity
- [ ] Check backup storage usage
- [ ] Review retention policy
- [ ] Update contact information

### Quarterly

- [ ] Full recovery drill
- [ ] Update documentation
- [ ] Review access permissions
- [ ] Test offsite backup restore

---

## 10. Contact

**Backup Administrator:** admin@valorhive.com  
**Emergency Contact:** +91-XXXXXXXXXX  
**Backup Storage Location:** AWS S3 (ap-south-1) / Local server

---

*Last Updated: January 2025*
