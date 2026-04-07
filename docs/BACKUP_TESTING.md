# VALORHIVE Backup Testing Runbook

**Document Version:** 2.0  
**Last Updated:** February 2025  
**Classification:** Internal - Operations Team  
**Owner:** DevOps Team Lead

---

## Table of Contents

1. [Overview](#overview)
2. [RTO/RPO Targets](#rtorpo-targets)
3. [Weekly Tests](#weekly-tests)
4. [Monthly Tests](#monthly-tests)
5. [Quarterly Tests](#quarterly-tests)
6. [Test Procedures](#test-procedures)
7. [Documentation Requirements](#documentation-requirements)
8. [Failure Escalation Procedures](#failure-escalation-procedures)
9. [Required Tools and Access](#required-tools-and-access)
10. [Appendices](#appendices)

---

## Overview

This runbook defines comprehensive testing procedures for VALORHIVE's backup and recovery systems. Regular testing ensures our ability to meet RTO (Recovery Time Objective) and RPO (Recovery Point Objective) targets while maintaining data integrity and business continuity.

### Purpose

- Validate backup integrity and recoverability
- Measure actual recovery times against targets
- Train team members on recovery procedures
- Identify and address gaps in disaster recovery plans
- Maintain compliance with data protection requirements

### Scope

This runbook covers:
- Production database backups (PostgreSQL via Prisma/SQLite development)
- File storage backups (S3 with versioning)
- Configuration backups (environment variables, feature flags)
- Cross-region disaster recovery
- Communication and escalation procedures

---

## RTO/RPO Targets

| Metric | Target | Critical Threshold | Description |
|--------|--------|-------------------|-------------|
| **RTO (Database)** | 15 minutes | 30 minutes | Time to restore database service |
| **RTO (Full Application)** | 1 hour | 2 hours | Time to restore full application |
| **RTO (DR Failover)** | 4 hours | 6 hours | Complete disaster recovery |
| **RPO** | 15 minutes | 30 minutes | Maximum acceptable data loss |
| **Backup Verification** | 100% | 99% | Percentage of backups verified |

### Recovery Tiers

| Tier | Systems | RTO Target | RPO Target |
|------|---------|------------|------------|
| **Tier 1 - Critical** | Database, Authentication, Payments | 15 min | 5 min |
| **Tier 2 - Important** | Tournament Management, Leaderboards | 1 hour | 15 min |
| **Tier 3 - Standard** | Analytics, Reports, Media | 4 hours | 1 hour |

---

## Weekly Tests

### Test Schedule

| Test | Frequency | Day/Time | Duration | Owner |
|------|-----------|----------|----------|-------|
| Database Backup Verification | Weekly | Sunday 6:00 AM IST | 15 min | DevOps |
| Backup File Integrity Check | Weekly | Sunday 6:15 AM IST | 10 min | DevOps |
| Restoration Time Measurement | Weekly | Sunday 6:30 AM IST | 30 min | DevOps |
| Test Credentials Rotation | Weekly | Sunday 7:00 AM IST | 15 min | Security |

---

### 1. Database Backup Verification

**Objective:** Confirm that database backups complete successfully and are accessible.

#### Pre-requisites
- [ ] Access to backup storage location
- [ ] Monitoring dashboard access
- [ ] Alert notification channels configured

#### Step-by-Step Procedure

```bash
# Step 1: Check backup job status
# Navigate to monitoring dashboard or run:
curl -s http://localhost:3000/api/admin/backup-status | jq '.latest_backup'

# Step 2: Verify backup file exists
ls -la /backup/db/
# Expected output: valorhive_backup_YYYYMMDD_HHMMSS.db

# Step 3: Check backup file size (should be > 0 and within expected range)
BACKUP_FILE=$(ls -t /backup/db/*.db | head -1)
BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE")
echo "Backup size: $BACKUP_SIZE bytes"

# Minimum size check (adjust based on your database)
if [ "$BACKUP_SIZE" -lt 1000000 ]; then
  echo "WARNING: Backup file size is smaller than expected"
  exit 1
fi

# Step 4: Verify backup timestamp is recent
BACKUP_AGE=$(( $(date +%s) - $(stat -f%m "$BACKUP_FILE" 2>/dev/null || stat -c%Y "$BACKUP_FILE") ))
if [ "$BACKUP_AGE" -gt 86400 ]; then
  echo "ERROR: Backup is older than 24 hours"
  exit 1
fi

# Step 5: Run checksum verification
CHECKSUM=$(md5sum "$BACKUP_FILE" | awk '{print $1}')
echo "Backup checksum: $CHECKSUM"

# Compare with stored checksum
if [ -f "/backup/db/checksums/latest.md5" ]; then
  STORED_CHECKSUM=$(cat /backup/db/checksums/latest.md5)
  if [ "$CHECKSUM" != "$STORED_CHECKSUM" ]; then
    echo "ERROR: Checksum mismatch"
    exit 1
  fi
fi
```

#### Success Criteria
- [ ] Backup file exists in expected location
- [ ] File size is within expected range (±20% of average)
- [ ] Backup timestamp is within last 24 hours
- [ ] Checksum matches stored value
- [ ] No error messages in backup logs

#### Failure Actions
1. **Backup missing:** Check backup job logs, verify storage connectivity
2. **Size abnormal:** Compare with previous backups, check for data loss
3. **Timestamp old:** Check if backup job is running, review cron schedule
4. **Checksum mismatch:** Re-run backup immediately, investigate corruption

---

### 2. Backup File Integrity Check

**Objective:** Validate that backup files are not corrupted and can be read.

#### Step-by-Step Procedure

```bash
# Step 1: Identify latest backup
BACKUP_FILE=$(ls -t /backup/db/*.db | head -1)
echo "Testing backup: $BACKUP_FILE"

# Step 2: Create temporary test database
TEST_DB="/tmp/backup_integrity_test_$$.db"
cp "$BACKUP_FILE" "$TEST_DB"

# Step 3: Verify database structure
sqlite3 "$TEST_DB" ".tables"
# Expected output: List of all tables

# Step 4: Run integrity check
sqlite3 "$TEST_DB" "PRAGMA integrity_check;"
# Expected output: ok

# Step 5: Verify critical tables have data
TABLES=("User" "Tournament" "Match" "Organization" "Payment")
for table in "${TABLES[@]}"; do
  COUNT=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM $table;")
  echo "$table: $COUNT records"
  if [ "$COUNT" -eq 0 ]; then
    echo "WARNING: $table is empty"
  fi
done

# Step 6: Check foreign key constraints
sqlite3 "$TEST_DB" "PRAGMA foreign_key_check;"

# Step 7: Verify recent transactions exist
sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM Match WHERE createdAt > datetime('now', '-1 day');"

# Step 8: Cleanup
rm -f "$TEST_DB"
```

#### Success Criteria
- [ ] Integrity check returns "ok"
- [ ] All critical tables have data
- [ ] No foreign key constraint violations
- [ ] Recent transactions are present
- [ ] Database structure is complete

---

### 3. Restoration Time Measurement

**Objective:** Measure actual restoration time and compare against RTO target.

#### Step-by-Step Procedure

```bash
# Step 1: Record start time
START_TIME=$(date +%s)
echo "Restoration started at: $(date)"

# Step 2: Stop application services (in test environment only)
# systemctl stop valorhive-app
# OR for development:
pkill -f "next start" || true

# Step 3: Create test restore location
TEST_RESTORE_DB="/tmp/valorhive_restore_test_$$.db"

# Step 4: Copy backup to test location
BACKUP_FILE=$(ls -t /backup/db/*.db | head -1)
time cp "$BACKUP_FILE" "$TEST_RESTORE_DB"
COPY_TIME=$?

# Step 5: Verify restored database
sqlite3 "$TEST_RESTORE_DB" "PRAGMA integrity_check;"

# Step 6: Run Prisma migrations check (if applicable)
# npx prisma migrate status

# Step 7: Start test application
# DATABASE_URL="file:$TEST_RESTORE_DB" npm run start &
# Wait for application to be ready
# curl -s http://localhost:3000/api/health

# Step 8: Record end time
END_TIME=$(date +%s)
echo "Restoration completed at: $(date)"

# Step 9: Calculate restoration time
RESTORE_TIME=$((END_TIME - START_TIME))
echo "Total restoration time: $RESTORE_TIME seconds"

# Step 10: Compare against RTO target
RTO_TARGET=900  # 15 minutes in seconds
if [ "$RESTORE_TIME" -le "$RTO_TARGET" ]; then
  echo "SUCCESS: Restoration time within RTO target"
else
  echo "WARNING: Restoration time exceeded RTO target"
fi

# Step 11: Cleanup
rm -f "$TEST_RESTORE_DB"
```

#### Metrics to Record

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| File Copy Time | ___ seconds | < 60s | [ ] |
| Integrity Check Time | ___ seconds | < 30s | [ ] |
| Application Startup Time | ___ seconds | < 120s | [ ] |
| Total Restoration Time | ___ seconds | < 900s | [ ] |

---

### 4. Test Credentials Rotation

**Objective:** Verify that test/backup credentials are rotated regularly.

#### Credentials to Rotate

| Credential | Rotation Frequency | Location |
|------------|-------------------|----------|
| Database Backup Encryption Key | Monthly | AWS Secrets Manager |
| S3 Backup Access Key | Monthly | AWS IAM |
| Test User Passwords | Weekly | Database |
| API Test Tokens | Weekly | Application |

#### Step-by-Step Procedure

```bash
# Step 1: Generate new test user password
NEW_PASSWORD=$(openssl rand -base64 16)
echo "New test password generated"

# Step 2: Update test user in database
# Using Prisma/SQLite:
sqlite3 /backup/test_credentials.db "UPDATE User SET passwordHash = '$(echo -n "$NEW_PASSWORD" | sha256sum | cut -d' ' -f1)' WHERE email = 'test@valorhive.com';"

# Step 3: Update stored credentials in secrets manager
# aws secretsmanager update-secret --secret-id valorhive/test-credentials --secret-string "{\"password\":\"$NEW_PASSWORD\"}"

# Step 4: Verify new credentials work
# curl -X POST http://localhost:3000/api/auth/login -d '{"email":"test@valorhive.com","password":"'"$NEW_PASSWORD"'"}'

# Step 5: Log rotation
echo "$(date): Test credentials rotated successfully" >> /var/log/valorhive/credential-rotation.log
```

#### Success Criteria
- [ ] All test credentials rotated
- [ ] New credentials stored securely
- [ ] Old credentials invalidated
- [ ] Rotation logged in audit trail
- [ ] Test login successful with new credentials

---

## Monthly Tests

### Test Schedule

| Test | Frequency | Day | Duration | Owner |
|------|-----------|-----|----------|-------|
| Full Restoration to Staging | Monthly | 1st Saturday | 2 hours | DevOps |
| Data Integrity Verification | Monthly | 1st Saturday | 1 hour | QA |
| RTO Measurement | Monthly | 1st Saturday | 30 min | DevOps |
| RPO Verification | Monthly | 1st Saturday | 30 min | DevOps |

---

### 1. Full Restoration to Staging Environment

**Objective:** Perform complete restoration to staging and verify functionality.

#### Pre-requisites
- [ ] Staging environment available
- [ ] Production backup from previous night accessible
- [ ] Maintenance window announced
- [ ] Rollback plan documented

#### Step-by-Step Procedure

##### Phase 1: Preparation (30 minutes)

```bash
# Step 1: Announce maintenance
./scripts/announce-maintenance.sh staging "Monthly backup restoration test"

# Step 2: Verify staging environment status
curl -s https://staging.valorhive.com/api/health

# Step 3: Take snapshot of current staging state (for rollback)
STAGING_SNAPSHOT="/backup/staging-snapshot-$(date +%Y%m%d).db"
cp /staging/valorhive.db "$STAGING_SNAPSHOT"

# Step 4: Download latest production backup
PROD_BACKUP=$(aws s3 ls s3://valorhive-backups/production/ | sort | tail -1 | awk '{print $4}')
aws s3 cp "s3://valorhive-backups/production/$PROD_BACKUP" /tmp/prod_backup.db

# Step 5: Verify downloaded backup
sqlite3 /tmp/prod_backup.db "PRAGMA integrity_check;"
```

##### Phase 2: Restoration (45 minutes)

```bash
# Step 1: Stop staging services
./scripts/stop-staging.sh

# Step 2: Backup current staging database
mv /staging/valorhive.db /staging/valorhive.db.pre-test

# Step 3: Restore production backup to staging
cp /tmp/prod_backup.db /staging/valorhive.db

# Step 4: Update database URLs for staging
export DATABASE_URL="file:/staging/valorhive.db"

# Step 5: Run Prisma migrations if needed
npx prisma migrate deploy

# Step 6: Update environment-specific data
# - Disable external integrations
# - Update payment gateway to test mode
# - Mask sensitive user data

sqlite3 /staging/valorhive.db "
UPDATE User SET email = REPLACE(email, '@', '+staging@') WHERE role != 'ADMIN';
UPDATE Organization SET phone = '9999999999' WHERE phone IS NOT NULL;
"

# Step 7: Start staging services
./scripts/start-staging.sh

# Step 8: Wait for services to be ready
sleep 30
curl -s https://staging.valorhive.com/api/health
```

##### Phase 3: Verification (30 minutes)

```bash
# Step 1: Run automated smoke tests
npm run test:smoke -- --env staging

# Step 2: Manual verification checklist
# - [ ] Login works
# - [ ] Tournament listing displays
# - [ ] Leaderboard loads
# - [ ] Registration flow works
# - [ ] Payment flow (test mode) works
# - [ ] Admin panel accessible
# - [ ] WebSocket connections work

# Step 3: Compare data counts
echo "Production record counts:"
sqlite3 /tmp/prod_backup.db "
SELECT 'Users', COUNT(*) FROM User UNION ALL
SELECT 'Tournaments', COUNT(*) FROM Tournament UNION ALL
SELECT 'Matches', COUNT(*) FROM Match;
"

echo "Staging record counts:"
sqlite3 /staging/valorhive.db "
SELECT 'Users', COUNT(*) FROM User UNION ALL
SELECT 'Tournaments', COUNT(*) FROM Tournament UNION ALL
SELECT 'Matches', COUNT(*) FROM Match;
"

# Step 4: Verify sensitive data is masked
sqlite3 /staging/valorhive.db "SELECT email FROM User LIMIT 5;"
```

##### Phase 4: Cleanup (15 minutes)

```bash
# Step 1: Restore staging to pre-test state
./scripts/stop-staging.sh
mv /staging/valorhive.db.pre-test /staging/valorhive.db
./scripts/start-staging.sh

# Step 2: Remove temporary files
rm -f /tmp/prod_backup.db "$STAGING_SNAPSHOT"

# Step 3: Announce completion
./scripts/announce-completion.sh staging "Monthly backup restoration test complete"
```

#### Success Criteria
- [ ] Restoration completed without errors
- [ ] All smoke tests pass
- [ ] Data counts match production
- [ ] Sensitive data properly masked
- [ ] Services restored to pre-test state
- [ ] No data leakage to external services

---

### 2. Data Integrity Verification After Restore

**Objective:** Comprehensive verification of data integrity post-restoration.

#### Verification Checklist

```bash
# Step 1: Record count verification
echo "=== Record Count Verification ==="
sqlite3 /staging/valorhive.db "
SELECT 
  'Users' as table_name, COUNT(*) as count FROM User
UNION ALL SELECT 'Tournaments', COUNT(*) FROM Tournament
UNION ALL SELECT 'Matches', COUNT(*) FROM Match
UNION ALL SELECT 'Organizations', COUNT(*) FROM Organization
UNION ALL SELECT 'Registrations', COUNT(*) FROM TournamentRegistration
UNION ALL SELECT 'Payments', COUNT(*) FROM Payment;
"

# Step 2: Foreign key integrity
echo "=== Foreign Key Verification ==="
sqlite3 /staging/valorhive.db "PRAGMA foreign_key_check;"

# Step 3: Constraint verification
echo "=== Constraint Verification ==="
# Check for orphaned records
sqlite3 /staging/valorhive.db "
SELECT 'Orphaned Registrations', COUNT(*) FROM TournamentRegistration tr
WHERE NOT EXISTS (SELECT 1 FROM Tournament t WHERE t.id = tr.tournamentId);
"

sqlite3 /staging/valorhive.db "
SELECT 'Orphaned Matches', COUNT(*) FROM Match m
WHERE NOT EXISTS (SELECT 1 FROM Tournament t WHERE t.id = m.tournamentId);
"

# Step 4: Data consistency checks
echo "=== Data Consistency ==="
# Check for duplicate emails
sqlite3 /staging/valorhive.db "
SELECT 'Duplicate Emails', COUNT(*) FROM (
  SELECT email FROM User GROUP BY email HAVING COUNT(*) > 1
);
"

# Check for invalid ELO ratings
sqlite3 /staging/valorhive.db "
SELECT 'Invalid ELO Ratings', COUNT(*) FROM PlayerRating WHERE eloRating < 0 OR eloRating > 3000;
"

# Step 5: Balance verification
echo "=== Payment Balance Verification ==="
sqlite3 /staging/valorhive.db "
SELECT 
  SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END) as net_balance
FROM PaymentLedger;
"

# Step 6: Timestamp validation
echo "=== Timestamp Validation ==="
sqlite3 /staging/valorhive.db "
SELECT 'Future Dates', COUNT(*) FROM Tournament WHERE startDate > datetime('now', '+1 year');
"

# Step 7: Index verification
echo "=== Index Verification ==="
sqlite3 /staging/valorhive.db "REINDEX;"

# Step 8: Schema version verification
sqlite3 /staging/valorhive.db "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
```

#### Data Integrity Report Template

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| User count | ___ | ___ | [ ] |
| Tournament count | ___ | ___ | [ ] |
| Match count | ___ | ___ | [ ] |
| FK violations | 0 | ___ | [ ] |
| Orphaned records | 0 | ___ | [ ] |
| Duplicate emails | 0 | ___ | [ ] |
| Invalid ELO ratings | 0 | ___ | [ ] |
| Schema version | Latest | ___ | [ ] |

---

### 3. RTO (Recovery Time Objective) Measurement

**Objective:** Measure and document actual RTO against target.

#### Measurement Procedure

```bash
# Initialize measurement log
LOG_FILE="/var/log/valorhive/rto-measurement-$(date +%Y%m%d).log"

# Function to log with timestamp
log_time() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Step 1: Record incident start
log_time "INCIDENT_START: Simulated database failure"
T0=$(date +%s)

# Step 2: Stop database service
log_time "DATABASE_STOP: Initiating database stop"
./scripts/stop-database.sh
log_time "DATABASE_STOPPED"

# Step 3: Begin recovery
log_time "RECOVERY_START: Beginning restoration from backup"
T1=$(date +%s)

# Step 4: Restore from backup
BACKUP_FILE=$(ls -t /backup/db/*.db | head -1)
cp "$BACKUP_FILE" /staging/valorhive.db
log_time "BACKUP_RESTORED: $BACKUP_FILE"
T2=$(date +%s)

# Step 5: Verify backup integrity
sqlite3 /staging/valorhive.db "PRAGMA integrity_check;"
log_time "INTEGRITY_VERIFIED"
T3=$(date +%s)

# Step 6: Start database service
./scripts/start-database.sh
log_time "DATABASE_STARTED"
T4=$(date +%s)

# Step 7: Start application
./scripts/start-app.sh
log_time "APPLICATION_START: Waiting for health check"
T5=$(date +%s)

# Step 8: Wait for application health
for i in {1..30}; do
  if curl -s http://localhost:3000/api/health | grep -q "healthy"; then
    log_time "APPLICATION_HEALTHY"
    break
  fi
  sleep 2
done
T6=$(date +%s)

# Step 9: Verify functionality
curl -s http://localhost:3000/api/tournaments > /dev/null
log_time "FUNCTIONALITY_VERIFIED"
T7=$(date +%s)

# Calculate times
DATABASE_RESTORE_TIME=$((T2 - T1))
INTEGRITY_CHECK_TIME=$((T3 - T2))
DATABASE_START_TIME=$((T4 - T3))
APP_START_TIME=$((T6 - T5))
TOTAL_RTO=$((T7 - T0))

echo "=== RTO MEASUREMENT RESULTS ===" >> "$LOG_FILE"
echo "Database Restore: ${DATABASE_RESTORE_TIME}s" >> "$LOG_FILE"
echo "Integrity Check: ${INTEGRITY_CHECK_TIME}s" >> "$LOG_FILE"
echo "Database Start: ${DATABASE_START_TIME}s" >> "$LOG_FILE"
echo "Application Start: ${APP_START_TIME}s" >> "$LOG_FILE"
echo "TOTAL RTO: ${TOTAL_RTO}s ($(echo "scale=2; $TOTAL_RTO/60" | bc) minutes)" >> "$LOG_FILE"
echo "RTO Target: 900s (15 minutes)" >> "$LOG_FILE"
echo "Status: $([ "$TOTAL_RTO" -le 900 ] && echo 'PASS' || echo 'FAIL')" >> "$LOG_FILE"
```

#### RTO Measurement Report

| Phase | Duration | Target | Status |
|-------|----------|--------|--------|
| Database Restore | ___ s | < 300s | [ ] |
| Integrity Check | ___ s | < 60s | [ ] |
| Database Start | ___ s | < 120s | [ ] |
| Application Start | ___ s | < 300s | [ ] |
| **Total RTO** | ___ s | < 900s | [ ] |

---

### 4. RPO (Recovery Point Objective) Verification

**Objective:** Verify that data loss is within acceptable RPO limits.

#### Verification Procedure

```bash
# Step 1: Record reference point in production
echo "=== Establishing Reference Point ==="
BEFORE_TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S")
BEFORE_COUNT=$(sqlite3 /production/valorhive.db "SELECT COUNT(*) FROM Match WHERE createdAt < '$BEFORE_TIMESTAMP';")
echo "Reference point: $BEFORE_TIMESTAMP"
echo "Matches before reference: $BEFORE_COUNT"

# Step 2: Create test data after reference point
echo "=== Creating Test Data ==="
TEST_MATCH_ID="test-$(date +%s)"
sqlite3 /production/valorhive.db "
INSERT INTO Match (id, tournamentId, status, createdAt, updatedAt)
VALUES ('$TEST_MATCH_ID', 'test-tournament', 'PENDING', datetime('now'), datetime('now'));
"
echo "Created test match: $TEST_MATCH_ID"

# Step 3: Trigger backup
echo "=== Triggering Backup ==="
./scripts/trigger-backup.sh
BACKUP_TIME=$(date -u +"%Y-%m-%d %H:%M:%S")
echo "Backup completed at: $BACKUP_TIME"

# Step 4: Restore from backup to test location
echo "=== Restoring from Backup ==="
BACKUP_FILE=$(ls -t /backup/db/*.db | head -1)
cp "$BACKUP_FILE" /tmp/rpo_test.db

# Step 5: Verify reference data exists
echo "=== Verifying Reference Data ==="
RESTORED_COUNT=$(sqlite3 /tmp/rpo_test.db "SELECT COUNT(*) FROM Match WHERE createdAt < '$BEFORE_TIMESTAMP';")
echo "Matches after restore: $RESTORED_COUNT"

# Step 6: Check for test data (should exist if backup captured it)
echo "=== Checking for Test Data ==="
TEST_DATA_EXISTS=$(sqlite3 /tmp/rpo_test.db "SELECT COUNT(*) FROM Match WHERE id = '$TEST_MATCH_ID';")
echo "Test data found: $TEST_DATA_EXISTS"

# Step 7: Calculate RPO
BACKUP_TIMESTAMP=$(stat -f%m "$BACKUP_FILE" 2>/dev/null || stat -c%Y "$BACKUP_FILE")
REFERENCE_TIMESTAMP=$(date -d "$BEFORE_TIMESTAMP" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$BEFORE_TIMESTAMP" +%s)
RPO_SECONDS=$((BACKUP_TIMESTAMP - REFERENCE_TIMESTAMP))

echo "=== RPO RESULTS ==="
echo "Reference time: $BEFORE_TIMESTAMP"
echo "Backup time: $BACKUP_TIME"
echo "RPO: $RPO_SECONDS seconds ($(echo "scale=2; $RPO_SECONDS/60" | bc) minutes)"
echo "RPO Target: 900 seconds (15 minutes)"
echo "Status: $([ "$RPO_SECONDS" -le 900 ] && echo 'PASS' || echo 'FAIL')"

# Step 8: Cleanup test data
sqlite3 /production/valorhive.db "DELETE FROM Match WHERE id = '$TEST_MATCH_ID';"
rm -f /tmp/rpo_test.db
```

#### RPO Verification Report

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Reference timestamp | ___ | - | - |
| Backup timestamp | ___ | - | - |
| Time difference (RPO) | ___ min | < 15 min | [ ] |
| Reference data preserved | ___ % | 100% | [ ] |
| Test data captured | Yes/No | - | [ ] |

---

## Quarterly Tests

### Test Schedule

| Test | Frequency | Month | Duration | Owner |
|------|-----------|-------|----------|-------|
| Disaster Recovery Drill | Quarterly | Jan/Apr/Jul/Oct | 4 hours | Full Team |
| Cross-Region Failover Test | Quarterly | Feb/May/Aug/Nov | 3 hours | DevOps |
| Communication Plan Verification | Quarterly | Mar/Jun/Sep/Dec | 2 hours | Operations |
| Team Training and Documentation Updates | Quarterly | Each Quarter End | 4 hours | Team Lead |

---

### 1. Disaster Recovery Drill

**Objective:** Simulate complete disaster scenario and execute full recovery.

#### Scenario Selection

Each quarter, select one of the following scenarios:

| Scenario | Description | Severity |
|----------|-------------|----------|
| **Database Server Failure** | Complete database server unavailable | High |
| **Region Outage** | Entire AWS region down | Critical |
| **Ransomware Attack** | Data encrypted by malware | Critical |
| **Data Center Fire** | Physical infrastructure destroyed | Critical |
| **Network Partition** | Network isolation between components | High |
| **Third-Party Outage** | Critical vendor (Razorpay, Email) down | Medium |

#### Pre-Drill Checklist

- [ ] All team members notified (minimum 1 week advance)
- [ ] War room/meeting link prepared
- [ ] Backup verification completed
- [ ] Rollback procedures documented
- [ ] Stakeholder approval obtained
- [ ] Monitoring dashboards ready
- [ ] Communication templates prepared

#### Drill Procedure: Database Server Failure

##### T+0: Incident Declaration (5 minutes)

```
INCIDENT DECLARATION

Date/Time: _______________
Scenario: Database Server Failure
Declared by: _______________
Severity: CRITICAL

Initial Assessment:
- Primary database server: [OFFLINE]
- Standby database: [AVAILABLE/NOT AVAILABLE]
- Application status: [DEGRADED/OFFLINE]
- User impact: [DESCRIPTION]

Communication sent:
- [ ] Slack: #incidents-critical
- [ ] Email: ops-team@valorhive.com
- [ ] SMS: On-call engineers
```

##### T+15: Assessment Phase (15 minutes)

```bash
# Check primary database status
ping db-primary.valorhive.local
ssh db-primary "systemctl status postgresql" || echo "Primary DB unreachable"

# Check standby database status
ssh db-standby "systemctl status postgresql"

# Verify replication status (if standby available)
ssh db-standby "psql -c 'SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();'"

# Check application error rates
curl -s http://localhost:3000/api/health/detailed | jq '.database'

# Document findings
echo "Assessment complete: $(date)" >> /var/log/dr-drill.log
```

##### T+30: Recovery Execution (90 minutes)

**Option A: Failover to Standby**

```bash
# Step 1: Verify standby is ready
ssh db-standby "psql -c 'SELECT pg_is_in_recovery();'"
# Should return 't' (true) - standby is in recovery mode

# Step 2: Promote standby to primary
ssh db-standby "pg_ctl promote -D /var/lib/postgresql/data"

# Step 3: Update application configuration
# Update DATABASE_URL in environment
sed -i 's/db-primary/db-standby/g' /app/.env

# Step 4: Restart application
systemctl restart valorhive-app

# Step 5: Verify connectivity
curl -s http://localhost:3000/api/health | jq '.database'

# Step 6: Update DNS (if using DNS-based failover)
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch file://dns-failover.json
```

**Option B: Restore from Backup**

```bash
# Step 1: Provision new database server
aws ec2 run-instances --image-id ami-xxxxx --instance-type t3.large \
  --key-name valorhive-db --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=valorhive-db-recovery}]'

# Step 2: Wait for instance to be ready
aws ec2 wait instance-running --instance-ids $NEW_INSTANCE_ID

# Step 3: Restore backup
scp /backup/db/latest.db ubuntu@$NEW_INSTANCE_IP:/tmp/
ssh ubuntu@$NEW_INSTANCE_IP "cp /tmp/latest.db /var/lib/valorhive/valorhive.db"

# Step 4: Configure application
# Update connection strings
./scripts/update-db-connection.sh "$NEW_INSTANCE_IP"

# Step 5: Start services
./scripts/start-all-services.sh
```

##### T+2:00: Application Recovery (60 minutes)

```bash
# Step 1: Run health checks
./scripts/health-check-full.sh

# Step 2: Verify critical services
curl -s http://localhost:3000/api/health/detailed

# Step 3: Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@valorhive.com","password":"[REDACTED]"}'

# Step 4: Test tournament operations
curl -s http://localhost:3000/api/tournaments | jq '.[0]'

# Step 5: Verify WebSocket connections
wscat -c ws://localhost:3003/tournament-updates

# Step 6: Test payment integration
curl -X POST http://localhost:3000/api/payments/test \
  -H "Content-Type: application/json" \
  -d '{"amount":100,"currency":"INR"}'

# Step 7: Run automated test suite
npm run test:smoke -- --env production
```

##### T+3:00: Validation Phase (30 minutes)

```bash
# Data integrity verification
./scripts/verify-data-integrity.sh

# Performance validation
./scripts/performance-check.sh

# Security verification
./scripts/security-check.sh

# User acceptance testing
# [Manual verification of critical user flows]

# Monitoring verification
curl -s http://localhost:3000/api/health/detailed | jq '.'
```

##### T+3:30: Stand Down (30 minutes)

```
RECOVERY COMPLETE

Date/Time: _______________
Total Recovery Time: _____ minutes
RTO Target: 240 minutes
RTO Status: [PASS/FAIL]

Data Loss Assessment:
- Last successful backup: _______________
- Data loss window: _____ minutes
- RPO Status: [PASS/FAIL]

Services Restored:
- [ ] Database
- [ ] Application
- [ ] WebSocket
- [ ] Payments
- [ ] Notifications

Post-Incident Actions Required:
1. ________________________________
2. ________________________________
3. ________________________________

Post-mortem scheduled for: _______________
```

#### Success Criteria

| Criteria | Target | Actual | Pass/Fail |
|----------|--------|--------|-----------|
| RTO | < 4 hours | ___ | [ ] |
| RPO | < 15 minutes | ___ | [ ] |
| Data Integrity | 100% | ___% | [ ] |
| All Services Restored | Yes | [ ] | [ ] |
| No Security Incidents | Yes | [ ] | [ ] |

---

### 2. Cross-Region Failover Test

**Objective:** Validate ability to failover to secondary region.

#### Architecture Overview

```
Primary Region (ap-south-1 - Mumbai)
├── Application Servers
├── Primary Database
├── S3 Primary Bucket
└── CloudFront CDN

Secondary Region (ap-southeast-1 - Singapore)
├── Standby Application Servers (scaled down)
├── Standby Database (replica)
├── S3 Replicated Bucket
└── CloudFront Failover Origin
```

#### Pre-Test Checklist

- [ ] Secondary region infrastructure provisioned
- [ ] Database replication confirmed active
- [ ] S3 cross-region replication verified
- [ ] DNS failover configuration ready
- [ ] Team access to secondary region confirmed

#### Failover Procedure

##### Phase 1: Preparation (30 minutes)

```bash
# Verify primary region status
aws ec2 describe-instance-status --region ap-south-1

# Verify secondary region readiness
aws ec2 describe-instance-status --region ap-southeast-1

# Check database replication lag
aws rds describe-db-instances --db-instance-identifier valorhive-standby \
  --query 'DBInstances[0].ReadReplicaSourceDBInstanceIdentifier'

# Verify S3 replication
aws s3 ls s3://valorhive-backups-dr/ | tail -5

# Scale up secondary region
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name valorhive-app-dr \
  --desired-capacity 2 \
  --region ap-southeast-1
```

##### Phase 2: Failover Execution (60 minutes)

```bash
# Step 1: Update Route 53 health checks
aws route53 update-health-check \
  --health-check-id $PRIMARY_HEALTH_CHECK_ID \
  --disabled

# Step 2: Wait for DNS propagation
echo "Waiting for DNS failover..."
sleep 300

# Step 3: Promote standby database
aws rds promote-read-replica \
  --db-instance-identifier valorhive-standby

# Step 4: Update application configuration
aws ssm put-parameter \
  --name "/valorhive/database-url" \
  --value "$DR_DATABASE_URL" \
  --type SecureString \
  --overwrite \
  --region ap-southeast-1

# Step 5: Restart application in DR region
aws ssm send-command \
  --document-name "AWS-RunShellScript" \
  --targets "Key=tag:Environment,Values=dr" \
  --parameters 'commands=["sudo systemctl restart valorhive-app"]' \
  --region ap-southeast-1

# Step 6: Verify failover
curl -s https://valorhive.com/api/health/detailed
```

##### Phase 3: Validation (30 minutes)

```bash
# Verify all services in DR region
./scripts/validate-dr-region.sh

# Compare data between regions
./scripts/compare-data.sh primary dr

# Run smoke tests against DR region
npm run test:smoke -- --baseUrl https://dr.valorhive.com

# Verify external integrations
./scripts/test-integrations.sh dr
```

##### Phase 4: Failback Planning (30 minutes)

```bash
# Document DR region status
./scripts/document-dr-status.sh

# Plan failback window
# - Requires maintenance window
# - Data sync from DR to Primary
# - DNS update back to primary

# Or remain on DR for drill duration
echo "Failback scheduled for: $(date -d '+4 hours')"
```

#### Cross-Region Failover Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| DNS Failover Time | < 5 min | ___ min |
| DB Promotion Time | < 10 min | ___ min |
| Application Ready | < 15 min | ___ min |
| Total Failover Time | < 30 min | ___ min |
| Data Replication Lag | < 1 min | ___ min |

---

### 3. Communication Plan Verification

**Objective:** Verify all communication channels work during an incident.

#### Communication Channels

| Channel | Purpose | Owner | Test Frequency |
|---------|---------|-------|----------------|
| Slack #incidents-critical | Primary incident communication | DevOps Lead | Monthly |
| PagerDuty | On-call alerts | Operations | Weekly |
| Email (ops-team) | Formal communications | Operations | Monthly |
| SMS Gateway | Emergency alerts | Security | Quarterly |
| Status Page | Customer communication | Marketing | Quarterly |
| Phone Tree | Escalation chain | Management | Quarterly |

#### Verification Procedure

##### Test 1: Slack Integration

```bash
# Test Slack webhook
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{
    "channel": "#incidents-critical",
    "username": "DR-Test-Bot",
    "text": "TEST: Quarterly DR communication test - $(date)",
    "icon_emoji": ":warning:"
  }'

# Verify message received in Slack
# [Manual verification required]
```

##### Test 2: PagerDuty Alert

```bash
# Trigger test incident
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "'$PAGERDUTY_KEY'",
    "event_action": "trigger",
    "dedup_key": "dr-test-'$(date +%s)'",
    "payload": {
      "summary": "DR Communication Test - $(date)",
      "severity": "info",
      "source": "DR-Test-Script"
    }
  }'

# Acknowledge and resolve test incident
# [Manual verification required]
```

##### Test 3: SMS Gateway

```bash
# Test SMS to on-call team
./scripts/send-test-sms.sh "DR Test: Please confirm receipt by replying YES"

# Verify responses received
# [Manual verification required]
```

##### Test 4: Status Page

```bash
# Create test incident on status page
curl -X POST https://api.statuspage.io/v1/pages/$STATUSPAGE_ID/incidents \
  -H "Authorization: OAuth $STATUSPAGE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "incident": {
      "name": "DR Test - Scheduled Maintenance",
      "status": "investigating",
      "body": "This is a test of the status page communication system."
    }
  }'

# Resolve test incident after verification
# [Manual verification required]
```

##### Test 5: Phone Tree Verification

```
ESCALATION PHONE TREE TEST

Test Date: _______________
Test Conducted By: _______________

Call each number and verify:
1. [ ] Primary On-Call: _______________ - Time: ___
2. [ ] Secondary On-Call: _______________ - Time: ___
3. [ ] DevOps Lead: _______________ - Time: ___
4. [ ] Engineering Manager: _______________ - Time: ___
5. [ ] VP Engineering: _______________ - Time: ___

All contacts reached within: ___ minutes
Target: 15 minutes
Status: [ ] PASS [ ] FAIL

Notes:
_________________________________
```

#### Communication Test Results

| Channel | Test Sent | Test Received | Latency | Status |
|---------|-----------|---------------|---------|--------|
| Slack | Yes/No | Yes/No | ___ ms | [ ] |
| PagerDuty | Yes/No | Yes/No | ___ ms | [ ] |
| Email | Yes/No | Yes/No | ___ ms | [ ] |
| SMS | Yes/No | Yes/No | ___ ms | [ ] |
| Status Page | Yes/No | Yes/No | ___ ms | [ ] |
| Phone Tree | Yes/No | Yes/No | ___ min | [ ] |

---

### 4. Team Training and Documentation Updates

**Objective:** Ensure team is trained and documentation is current.

#### Training Curriculum

##### Module 1: Backup System Overview (30 minutes)
- Backup architecture and components
- Backup types and schedules
- Storage locations and retention
- Monitoring and alerting

##### Module 2: Recovery Procedures (60 minutes)
- Database restoration steps
- Application recovery sequence
- Verification procedures
- Common issues and solutions

##### Module 3: Disaster Recovery (60 minutes)
- DR architecture overview
- Failover procedures
- Communication protocols
- Post-incident actions

##### Module 4: Hands-On Practice (90 minutes)
- Guided restoration exercise
- Simulated incident response
- Documentation review

#### Training Attendance Record

| Name | Role | Module 1 | Module 2 | Module 3 | Module 4 | Certified |
|------|------|----------|----------|----------|----------|-----------|
| ___ | ___ | [ ] | [ ] | [ ] | [ ] | [ ] |
| ___ | ___ | [ ] | [ ] | [ ] | [ ] | [ ] |
| ___ | ___ | [ ] | [ ] | [ ] | [ ] | [ ] |

#### Documentation Review Checklist

| Document | Location | Last Updated | Review Date | Status |
|----------|----------|--------------|-------------|--------|
| Backup Testing Runbook | docs/BACKUP_TESTING.md | ___ | ___ | [ ] |
| Performance SLIs | docs/PERFORMANCE_SLIS.md | ___ | ___ | [ ] |
| Incident Response Plan | docs/INCIDENT_RESPONSE.md | ___ | ___ | [ ] |
| Database Schema | prisma/schema.prisma | ___ | ___ | [ ] |
| Environment Setup | README.md | ___ | ___ | [ ] |
| API Documentation | docs/API.md | ___ | ___ | [ ] |

#### Documentation Update Tasks

```
DOCUMENTATION UPDATE TRACKER

Quarter: _______________
Updated By: _______________

Updates Required:
[ ] Update RTO/RPO targets based on test results
[ ] Add new failure scenarios discovered
[ ] Update contact information
[ ] Add new tools or procedures
[ ] Remove obsolete information
[ ] Update screenshots/diagrams

Changes Made:
1. ________________________________
2. ________________________________
3. ________________________________

Review Completed: [ ] Yes [ ] No
Next Review Due: _______________
```

---

## Test Procedures

### Standard Test Procedure Template

#### Test Information

| Field | Value |
|-------|-------|
| Test Name | _______________ |
| Test Type | [ ] Weekly [ ] Monthly [ ] Quarterly |
| Test Owner | _______________ |
| Scheduled Date | _______________ |
| Actual Date | _______________ |
| Duration | _______________ |

#### Pre-Test Checklist

- [ ] Test scheduled and team notified
- [ ] All prerequisites met
- [ ] Required access confirmed
- [ ] Backup verified to exist
- [ ] Monitoring active
- [ ] Rollback plan documented

#### Test Execution

```
Step 1: ________________________________
Expected Result: ________________________________
Actual Result: ________________________________
Status: [ ] PASS [ ] FAIL [ ] SKIP
Time: _____ minutes

Step 2: ________________________________
Expected Result: ________________________________
Actual Result: ________________________________
Status: [ ] PASS [ ] FAIL [ ] SKIP
Time: _____ minutes

[Continue for all steps...]
```

#### Post-Test Checklist

- [ ] All test resources cleaned up
- [ ] Production environment restored
- [ ] Results documented
- [ ] Issues logged for follow-up
- [ ] Stakeholders notified of completion

---

### Success Criteria Definitions

#### Test Pass Criteria

| Criteria | Definition |
|----------|------------|
| **PASS** | All test steps completed successfully within target thresholds |
| **PASS WITH ISSUES** | Test completed but minor issues identified (non-blocking) |
| **FAIL** | Critical test step failed or threshold exceeded |
| **INCONCLUSIVE** | Test could not be completed due to external factors |

#### Threshold Definitions

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| RTO | < 15 min | 15-30 min | > 30 min |
| RPO | < 5 min | 5-15 min | > 15 min |
| Data Loss | 0% | < 1% | > 1% |
| Backup Age | < 24 hrs | 24-48 hrs | > 48 hrs |
| Integrity Check | 100% pass | 99% pass | < 99% pass |

---

## Documentation Requirements

### Test Logs Template

```markdown
# Backup Test Log

## Test Information
- **Test ID:** BT-YYYY-MM-DD-###
- **Test Type:** [ ] Weekly [ ] Monthly [ ] Quarterly
- **Test Date:** _______________
- **Start Time:** _______________
- **End Time:** _______________
- **Duration:** _______________
- **Tester:** _______________
- **Environment:** [ ] Production [ ] Staging [ ] Test

## Test Scope
- **Systems Tested:**
  - [ ] Database Backup
  - [ ] File Storage Backup
  - [ ] Configuration Backup
  - [ ] Cross-Region Replication

## Results Summary
| Test Step | Expected | Actual | Status |
|-----------|----------|--------|--------|
| 1. Backup Verification | | | [ ] |
| 2. Integrity Check | | | [ ] |
| 3. Restoration | | | [ ] |
| 4. Verification | | | [ ] |

## Metrics Recorded
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| RTO | | | [ ] |
| RPO | | | [ ] |
| Data Integrity | | | [ ] |

## Issues Found
| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| | | | |

## Observations
[Free-form notes and observations]

## Recommendations
1.
2.
3.

## Sign-off
- **Tester Signature:** _______________ Date: _______
- **Reviewer Signature:** _______________ Date: _______
```

---

### Incident Report Template

```markdown
# Backup/Recovery Incident Report

## Incident Details
- **Incident ID:** INC-YYYY-MM-DD-###
- **Report Date:** _______________
- **Incident Date:** _______________
- **Incident Duration:** _______________
- **Severity:** [ ] Critical [ ] High [ ] Medium [ ] Low
- **Status:** [ ] Open [ ] In Progress [ ] Resolved [ ] Closed

## Summary
[Brief description of the incident]

## Timeline
| Time | Event | Actor |
|------|-------|-------|
| | | |

## Impact Assessment
- **Users Affected:** _______________
- **Data Loss:** [ ] None [ ] Minimal [ ] Significant
- **Service Downtime:** _______________
- **Business Impact:** _______________

## Root Cause Analysis
### What Happened
[Description]

### Why It Happened
[Root cause]

### Contributing Factors
1.
2.
3.

## Resolution
### Immediate Actions Taken
1.
2.
3.

### Long-term Fixes
1.
2.
3.

## Lessons Learned
1.
2.
3.

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| | | | |

## Attachments
- [ ] Test logs
- [ ] System logs
- [ ] Screenshots
- [ ] Communication records

## Approvals
| Role | Name | Signature | Date |
|------|------|-----------|------|
| Incident Commander | | | |
| DevOps Lead | | | |
| Engineering Manager | | | |
```

---

### Sign-off Requirements

#### Weekly Test Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Test Executor | | | |
| DevOps Engineer | | | |

#### Monthly Test Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Test Executor | | | |
| DevOps Lead | | | |
| QA Lead | | | |

#### Quarterly Test Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Test Executor | | | |
| DevOps Lead | | | |
| Engineering Manager | | | |
| VP Engineering | | | |

---

## Failure Escalation Procedures

### Escalation Matrix

| Severity | Response Time | Escalation Path |
|----------|---------------|-----------------|
| **Critical** | 5 minutes | On-call → DevOps Lead → VP Engineering |
| **High** | 15 minutes | On-call → DevOps Lead |
| **Medium** | 1 hour | On-call Engineer |
| **Low** | 24 hours | Ticket assignment |

### Escalation Triggers

#### Immediate Escalation (Critical)
- Production data loss detected
- Backup files corrupted or missing
- Restoration failure
- Security breach suspected
- RTO exceeded during recovery

#### Standard Escalation (High)
- Backup job failures
- Integrity check failures
- Replication lag > 5 minutes
- Storage capacity > 90%

### Escalation Procedure

```
ESCALATION FLOW

1. DETECT ISSUE
   └──→ Automated alert OR Manual discovery

2. INITIAL ASSESSMENT (5 min)
   └──→ Determine severity
   └──→ Check scope of impact

3. NOTIFICATION
   ├──→ Critical: Call on-call + Slack #incidents-critical
   ├──→ High: Slack #incidents + Page on-call
   └──→ Medium/Low: Slack #incidents

4. ENGAGEMENT
   ├──→ Critical: War room within 15 min
   ├──→ High: Response within 30 min
   └──→ Medium/Low: Next business day

5. RESOLUTION
   └──→ Follow incident response procedure
   └──→ Document all actions

6. POST-INCIDENT
   └──→ Blameless post-mortem within 48 hours
```

### Emergency Contacts

| Role | Primary | Backup |
|------|---------|--------|
| On-Call Engineer | [Name] - [Phone] | [Name] - [Phone] |
| DevOps Lead | [Name] - [Phone] | [Name] - [Phone] |
| Engineering Manager | [Name] - [Phone] | [Name] - [Phone] |
| VP Engineering | [Name] - [Phone] | [Name] - [Phone] |
| AWS Support | Enterprise Support | 1-800-XXX-XXXX |

---

## Required Tools and Access

### Tool Requirements

| Tool | Purpose | Access Level | Owner |
|------|---------|--------------|-------|
| AWS Console | Infrastructure management | Admin | DevOps |
| AWS CLI | Automation scripts | Programmatic | DevOps |
| SQLite CLI | Database operations | Read/Write | DBA |
| Prisma CLI | Schema migrations | Admin | Development |
| Slack | Communication | All team | Operations |
| PagerDuty | Alerting | On-call team | Operations |
| Monitoring Dashboard | System health | Read | All team |

### Access Requirements

| System | Access Type | Who Needs It | How to Obtain |
|--------|-------------|--------------|---------------|
| Production Database | SSH + DB Credentials | DevOps, DBA | Submit access request |
| Backup Storage | Read | DevOps | Auto-provisioned |
| AWS Secrets Manager | Read | DevOps, Apps | Via IAM role |
| Staging Environment | Full | DevOps, QA | Auto-provisioned |
| DNS Management | Admin | DevOps Lead | Submit request |
| Status Page | Admin | Operations | Contact Ops Lead |

### Tool Verification

Before each test, verify tool access:

```bash
# Verify AWS access
aws sts get-caller-identity

# Verify database access
sqlite3 /backup/db/test.db ".tables"

# Verify Slack webhook
curl -s $SLACK_WEBHOOK_URL -d '{"text":"Test"}' | grep -q "ok"

# Verify PagerDuty
curl -s -H "Authorization: Token token=$PAGERDUTY_KEY" \
  https://api.pagerduty.com/users | jq '.users | length'

# Verify monitoring access
curl -s http://localhost:3000/api/health | jq '.status'
```

---

## Appendices

### Appendix A: Backup File Naming Convention

```
Format: valorhive_backup_{type}_{YYYYMMDD}_{HHMMSS}.{ext}

Examples:
- valorhive_backup_full_20250215_020000.db
- valorhive_backup_incremental_20250215_140000.wal
- valorhive_backup_config_20250215_020000.tar.gz
```

### Appendix B: Retention Policy

| Backup Type | Retention Period | Storage Location |
|-------------|------------------|------------------|
| Daily Full | 30 days | S3 Standard |
| Weekly Full | 90 days | S3 Standard |
| Monthly Full | 1 year | S3 Glacier |
| WAL Archives | 7 days | S3 Standard |
| Configuration | 90 days | S3 Standard |

### Appendix C: Recovery Commands Quick Reference

```bash
# Check backup status
ls -la /backup/db/

# Verify backup integrity
sqlite3 /backup/db/latest.db "PRAGMA integrity_check;"

# Quick restore test
cp /backup/db/latest.db /tmp/test_restore.db
sqlite3 /tmp/test_restore.db ".tables"

# Full restore to staging
./scripts/restore-to-staging.sh /backup/db/latest.db

# Promote standby database
pg_ctl promote -D /var/lib/postgresql/data

# Check replication status
psql -c "SELECT * FROM pg_stat_replication;"

# Force backup
./scripts/trigger-backup.sh

# Verify data counts
sqlite3 valorhive.db "
SELECT 'Users', COUNT(*) FROM User UNION ALL
SELECT 'Tournaments', COUNT(*) FROM Tournament;
"
```

### Appendix D: Glossary

| Term | Definition |
|------|------------|
| **RTO** | Recovery Time Objective - Maximum time to restore service |
| **RPO** | Recovery Point Objective - Maximum acceptable data loss |
| **WAL** | Write-Ahead Log - Transaction log for point-in-time recovery |
| **PITR** | Point-in-Time Recovery - Recovery to a specific timestamp |
| **DR** | Disaster Recovery - Procedures for major incident recovery |
| **Failover** | Switching to redundant system upon failure |

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 2025 | DevOps Team | Initial creation |
| 2.0 | Feb 2025 | DevOps Team | Expanded weekly, monthly, quarterly procedures |

---

**End of Backup Testing Runbook**
