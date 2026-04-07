# VALORHIVE Disaster Recovery Plan

**Version:** 1.0  
**Last Updated:** February 2025  
**Status:** Production Ready

---

## 1. Executive Summary

This document outlines VALORHIVE's comprehensive disaster recovery (DR) strategy to ensure business continuity in case of system failures, data corruption, or catastrophic events.

---

## 2. Recovery Objectives

### 2.1 Recovery Time Objective (RTO)

| Severity Level | RTO Target | Scenario | Priority |
|----------------|------------|----------|----------|
| **Critical (P0)** | 1 hour | Payment system down, Active tournament data loss | Immediate |
| **High (P1)** | 4 hours | Tournament in progress affected, User authentication failure | High |
| **Medium (P2)** | 24 hours | Non-critical features down, Leaderboard issues | Normal |
| **Low (P3)** | 72 hours | Development/staging environment, Historical data | Low |

### 2.2 Recovery Point Objective (RPO)

| Data Category | RPO Target | Backup Frequency | Method |
|---------------|------------|------------------|--------|
| **Financial Data** | 1 hour | Continuous | Transaction logs + Real-time replication |
| **User Data** | 24 hours | Daily | Full database backup |
| **Tournament Data** | 4 hours | Every 4 hours | Incremental backup |
| **Audit Logs** | 24 hours | Daily | Full backup + Archive |
| **Media Files** | 24 hours | Daily | S3 cross-region replication |

---

## 3. Disaster Categories & Response

### 3.1 Category A: Database Failure

**Symptoms:**
- Database connection errors
- Query timeouts
- Data corruption detected
- Storage failure

**Response Procedure:**

```bash
# 1. Identify the scope
psql -c "SELECT COUNT(*) FROM users;"  # Check if data accessible

# 2. If primary DB is down, switch to standby (if available)
# For managed PostgreSQL (Supabase/Neon):
# - Use the provided standby connection string
# - Update DATABASE_URL in production environment

# 3. Restore from backup if needed
gunzip -c /backups/valorhive_$(date +%Y%m%d).sql.gz | psql $DATABASE_URL

# 4. Verify data integrity
psql -c "SELECT COUNT(*) FROM tournaments WHERE status = 'IN_PROGRESS';"
psql -c "SELECT SUM(amount) FROM payment_ledger WHERE status = 'PAID';"
```

**Communication:**
- Alert sent to: admin@valorhive.com, dev-team@valorhive.com
- User notification: Banner on platform
- Update frequency: Every 30 minutes during incident

### 3.2 Category B: Payment System Failure

**Symptoms:**
- Razorpay API errors
- Payment webhook failures
- Incorrect transaction records

**Response Procedure:**

```bash
# 1. Check Razorpay status
curl -X GET "https://api.razorpay.com/v1/payments" \
  -u "$RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET"

# 2. Reconcile payments with database
# Run reconciliation script
bun run scripts/reconcile-payments.ts

# 3. Check webhook logs
# Review failed webhooks in Razorpay dashboard

# 4. Manual intervention if needed
# Update PaymentLedger status manually with audit log
```

**Critical Actions:**
- Halt all tournament registrations if payment system is down > 30 minutes
- Log all manual interventions in AuditLog table
- Notify affected users via email/notification

### 3.3 Category C: Tournament Data Loss

**Symptoms:**
- Missing bracket data
- Incorrect match results
- Lost tournament registrations

**Response Procedure:**

```bash
# 1. Isolate affected tournaments
psql -c "SELECT id, name, status FROM tournaments WHERE id IN ('affected_ids');"

# 2. Restore from backup (point-in-time recovery)
pg_restore --clean --dbname valorhive_pitr backup.dump

# 3. Cross-reference with offline data
# Check localStorage sync data from tournament directors

# 4. Validate bracket integrity
bun run scripts/validate-brackets.ts

# 5. Notify affected participants
bun run scripts/notify-tournament-participants.ts <tournament_id>
```

### 3.4 Category D: Infrastructure Failure

**Symptoms:**
- Server unresponsive
- Network outage
- CDN failure
- SSL certificate expiry

**Response Procedure:**

```bash
# 1. Check server health
curl -I https://api.valorhive.com/health

# 2. Failover to backup region (if applicable)
# Update DNS to point to backup server

# 3. Check SSL certificates
certbot certificates

# 4. Review CDN status (Cloudflare/S3)
aws s3 ls s3://valorhive-media --recursive | head -10
```

---

## 4. Backup Infrastructure

### 4.1 Backup Locations

| Location | Type | Purpose | Access |
|----------|------|---------|--------|
| Primary DB Server | Local | Hot standby | SSH key |
| AWS S3 (ap-south-1) | Cloud | Daily backups | IAM role |
| Cloudflare R2 | Cloud | Media files | API token |
| Local NAS | Physical | Weekly archive | VPN access |

### 4.2 Backup Schedule

```cron
# Every hour - Transaction logs
0 * * * * /scripts/backup-transaction-logs.sh

# Every 4 hours - Incremental database
0 */4 * * * /scripts/backup-incremental.sh

# Daily at 2 AM - Full backup
0 2 * * * /scripts/backup-full.sh

# Weekly on Sunday - Archive
0 3 * * 0 /scripts/backup-archive.sh

# Monthly on 1st - Long-term archive
0 4 1 * * /scripts/backup-monthly.sh
```

### 4.3 Backup Retention Policy

| Backup Type | Retention | Location |
|-------------|-----------|----------|
| Transaction logs | 7 days | Primary + S3 |
| Incremental | 14 days | S3 |
| Daily full | 30 days | S3 + Local |
| Weekly archive | 12 weeks | S3 + Local |
| Monthly archive | 7 years | Cold storage |

---

## 5. Recovery Procedures by Scenario

### 5.1 Full Database Recovery

```bash
#!/bin/bash
# Full Database Recovery Script

# 1. Stop application
systemctl stop valorhive

# 2. Drop existing database (if corrupted)
psql -c "DROP DATABASE valorhive;"

# 3. Create fresh database
psql -c "CREATE DATABASE valorhive;"

# 4. Restore from latest backup
LATEST=$(ls -t /backups/*.sql.gz | head -1)
echo "Restoring from: $LATEST"
gunzip -c $LATEST | psql -d valorhive

# 5. Run migrations (if schema changed)
bun run prisma migrate deploy

# 6. Verify data integrity
bun run scripts/verify-data-integrity.ts

# 7. Clear all caches
redis-cli FLUSHALL

# 8. Start application
systemctl start valorhive

# 9. Smoke tests
curl -f https://api.valorhive.com/health || exit 1

echo "Recovery complete"
```

### 5.2 Point-in-Time Recovery (PostgreSQL)

```bash
#!/bin/bash
# Point-in-Time Recovery for PostgreSQL

# 1. Stop PostgreSQL
systemctl stop postgresql

# 2. Clear data directory
rm -rf /var/lib/postgresql/data/*

# 3. Restore base backup
tar -xzf /backups/base.tar.gz -C /var/lib/postgresql/data

# 4. Configure recovery
cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'cp /backups/wal_archive/%f %p'
recovery_target_time = '2025-02-15 14:30:00'
recovery_target_action = 'promote'
EOF

# 5. Start PostgreSQL
systemctl start postgresql

# 6. Monitor recovery
tail -f /var/log/postgresql/recovery.log
```

### 5.3 Partial Table Recovery

```bash
#!/bin/bash
# Single Table Recovery

# 1. Create temporary database
psql -c "CREATE DATABASE valorhive_restore;"

# 2. Restore backup to temp database
gunzip -c /backups/latest.sql.gz | psql -d valorhive_restore

# 3. Export specific table
pg_dump -t Tournament valorhive_restore > tournament_backup.sql

# 4. Truncate production table (CAREFUL!)
psql -d valorhive -c "TRUNCATE Tournament CASCADE;"

# 5. Import recovered data
psql -d valorhive < tournament_backup.sql

# 6. Cleanup
psql -c "DROP DATABASE valorhive_restore;"
```

---

## 6. Communication Plan

### 6.1 Internal Notification

| Severity | Recipients | Channel | Response Time |
|----------|------------|---------|---------------|
| P0 Critical | All hands | PagerDuty + Slack + SMS | 15 minutes |
| P1 High | Dev team + Management | Slack + Email | 1 hour |
| P2 Medium | Dev team | Slack | 4 hours |
| P3 Low | On-call engineer | Email | 24 hours |

### 6.2 User Communication

**Template: Service Disruption**

```
Subject: VALORHIVE Service Disruption - [Date/Time]

Dear VALORHIVE User,

We are currently experiencing technical difficulties with [SYSTEM].

Impact: [Brief description of what's affected]

Our team is actively working to resolve this issue. 
Estimated resolution time: [Time]

Current tournament status: [Status]
Your data is safe and backed up.

We apologize for any inconvenience.

Updates: [Link to status page]
Support: support@valorhive.com

VALORHIVE Team
```

### 6.3 Status Page

- URL: https://status.valorhive.com
- Provider: StatusPage.io or custom solution
- Update frequency: Every 30 minutes during incidents

---

## 7. Testing & Validation

### 7.1 Monthly DR Drill

```markdown
## Monthly DR Drill Checklist

Date: _______________
Conducted by: _______________

- [ ] Simulate database failure
- [ ] Execute recovery procedure
- [ ] Measure actual RTO
- [ ] Verify data integrity
- [ ] Document any issues
- [ ] Update procedures if needed

Results:
- Actual RTO: _____ minutes
- Actual RPO: _____ hours
- Issues found: _______________
- Recommended changes: _______________
```

### 7.2 Quarterly Full DR Test

1. **Backup Validation**
   - Restore latest backup to test environment
   - Verify all tables and relationships
   - Check data completeness

2. **Failover Test**
   - Switch to backup server
   - Verify all services operational
   - Test payment processing
   - Switch back to primary

3. **Documentation Review**
   - Update contact information
   - Review and update procedures
   - Train new team members

---

## 8. Contact Information

### 8.1 Emergency Contacts

| Role | Name | Phone | Email | Backup |
|------|------|-------|-------|--------|
| Platform Lead | _____________ | _____________ | _____________ | _____________ |
| DevOps Engineer | _____________ | _____________ | _____________ | _____________ |
| Database Admin | _____________ | _____________ | _____________ | _____________ |
| Security Officer | _____________ | _____________ | _____________ | _____________ |

### 8.2 Vendor Contacts

| Service | Support | Phone | Account ID |
|---------|---------|-------|------------|
| Razorpay | support@razorpay.com | +91-80-4569-4569 | _____________ |
| AWS | aws-support | +1-800-XXX-XXXX | _____________ |
| Supabase/Neon | support@supabase.com | N/A | _____________ |
| Cloudflare | support@cloudflare.com | N/A | _____________ |

---

## 9. Appendix

### 9.1 Recovery Scripts Location

```
/scripts/
├── backup-full.sh
├── backup-incremental.sh
├── backup-transaction-logs.sh
├── restore-full.sh
├── restore-pitr.sh
├── reconcile-payments.ts
├── verify-data-integrity.ts
└── notify-users.ts
```

### 9.2 Critical SQL Queries for Verification

```sql
-- Check user count
SELECT COUNT(*) FROM users WHERE "isActive" = true;

-- Check active tournaments
SELECT id, name, status FROM tournaments WHERE status = 'IN_PROGRESS';

-- Check payment totals
SELECT 
  status,
  COUNT(*) as count,
  SUM(amount) as total
FROM payment_ledger
WHERE "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY status;

-- Check for orphaned records
SELECT 
  (SELECT COUNT(*) FROM tournaments t 
   LEFT JOIN organizations o ON t."orgId" = o.id 
   WHERE t."orgId" IS NOT NULL AND o.id IS NULL) as orphan_tournaments;
```

---

## 10. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 2025 | Platform Team | Initial document |

**Review Schedule:** Quarterly  
**Next Review:** May 2025

---

*This document is confidential and should only be shared with authorized personnel.*
