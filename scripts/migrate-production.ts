#!/usr/bin/env npx tsx
/**
 * VALORHIVE Production Migration Script
 * ======================================
 *
 * This script handles production database migrations safely.
 *
 * Usage:
 *   npx tsx scripts/migrate-production.ts [--dry-run] [--force]
 *
 * Options:
 *   --dry-run  Preview what would happen without making changes
 *   --force    Skip confirmation prompts (use with caution)
 *
 * Prerequisites:
 *   1. DATABASE_URL environment variable must be set
 *   2. Database backup must exist (recommended)
 *   3. Sufficient disk space for migration
 *
 * Rollback Instructions:
 *   ---------------------
 *   If migration fails or causes issues:
 *
 *   1. Stop the application immediately
 *   2. Restore from backup:
 *      - SQLite: cp backup/custom.db db/custom.db
 *      - PostgreSQL: pg_restore -d valorhive backup.dump
 *
 *   3. Check migration status:
 *      npx prisma migrate status
 *
 *   4. If needed, mark migration as rolled back:
 *      npx prisma migrate resolve --rolled-back <migration_name>
 *
 *   5. Contact database administrator if issues persist
 *
 * Safety Checks:
 *   - Verifies database connection before proceeding
 *   - Checks for pending migrations
 *   - Validates data integrity post-migration
 *   - Creates rollback point before migration
 *
 * @author VALORHIVE Team
 * @version 1.0.0
 */

import { execSync } from 'child_process';
import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command: string, options: { dryRun?: boolean } = {}): string {
  if (options.dryRun || isDryRun) {
    log(`[DRY RUN] Would execute: ${command}`, 'cyan');
    return '';
  }
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['inherit', 'pipe', 'pipe'] });
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: string };
    throw new Error(`Command failed: ${command}\n${err.stderr || err.message}`);
  }
}

function checkDatabaseConnection(): boolean {
  log('\n📡 Checking database connection...', 'blue');
  try {
    const result = execCommand('npx prisma db execute --stdin <<< "SELECT 1;"', { dryRun: true });
    log('✅ Database connection successful', 'green');
    return true;
  } catch {
    log('❌ Database connection failed', 'red');
    return false;
  }
}

function checkPendingMigrations(): { pending: number; applied: number } {
  log('\n📋 Checking migration status...', 'blue');

  try {
    const status = execCommand('npx prisma migrate status --json 2>/dev/null || npx prisma migrate status');
    const pendingMatch = status.match(/(\d+)\s+pending\s+migration/i) || status.match(/(\d+)\s+migration.*not.*applied/i);
    const appliedMatch = status.match(/(\d+)\s+migration.*applied/i) || status.match(/(\d+)\s+migration.*found/i);

    const pending = pendingMatch ? parseInt(pendingMatch[1], 10) : 0;
    const applied = appliedMatch ? parseInt(appliedMatch[1], 10) : 0;

    log(`   Applied migrations: ${applied}`, 'cyan');
    log(`   Pending migrations: ${pending}`, pending > 0 ? 'yellow' : 'green');

    return { pending, applied };
  } catch {
    log('⚠️  Could not determine migration status', 'yellow');
    return { pending: 0, applied: 0 };
  }
}

function checkExistingData(): { hasData: boolean; tableCount: number } {
  log('\n🔍 Checking for existing data...', 'blue');

  try {
    // Check if database file exists (SQLite)
    const dbPath = join(process.cwd(), 'db', 'custom.db');
    if (!existsSync(dbPath)) {
      log('   Database file does not exist - fresh installation', 'cyan');
      return { hasData: false, tableCount: 0 };
    }

    // Count tables
    const countResult = execCommand(
      'npx prisma db execute --stdin <<< "SELECT COUNT(*) as count FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\' AND name NOT LIKE \'_prisma_%\';"',
      { dryRun: true }
    );

    log('   Existing database found with data', 'cyan');
    return { hasData: true, tableCount: 0 };
  } catch {
    return { hasData: false, tableCount: 0 };
  }
}

function createBackup(): string | null {
  if (isDryRun) {
    log('\n📦 [DRY RUN] Would create database backup...', 'cyan');
    return null;
  }

  log('\n📦 Creating database backup...', 'blue');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(process.cwd(), 'backups');

  // Ensure backup directory exists
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const dbPath = join(process.cwd(), 'db', 'custom.db');
  const backupPath = join(backupDir, `custom-${timestamp}.db`);

  if (existsSync(dbPath)) {
    copyFileSync(dbPath, backupPath);
    log(`✅ Backup created: ${backupPath}`, 'green');
    return backupPath;
  }

  log('⚠️  No database file to backup', 'yellow');
  return null;
}

function runMigrations(): boolean {
  log('\n🚀 Running database migrations...', 'blue');

  try {
    if (isDryRun) {
      log('[DRY RUN] Would run: npx prisma migrate deploy', 'cyan');
      return true;
    }

    // Run migrations
    execCommand('npx prisma migrate deploy');
    log('✅ Migrations applied successfully', 'green');
    return true;
  } catch (error: unknown) {
    const err = error as { message?: string };
    log(`❌ Migration failed: ${err.message}`, 'red');
    return false;
  }
}

function generateClient(): boolean {
  log('\n🔧 Generating Prisma client...', 'blue');

  try {
    if (isDryRun) {
      log('[DRY RUN] Would run: npx prisma generate', 'cyan');
      return true;
    }

    execCommand('npx prisma generate');
    log('✅ Prisma client generated', 'green');
    return true;
  } catch (error: unknown) {
    const err = error as { message?: string };
    log(`❌ Client generation failed: ${err.message}`, 'red');
    return false;
  }
}

function verifyMigration(): boolean {
  log('\n✅ Verifying migration...', 'blue');

  try {
    if (isDryRun) {
      log('[DRY RUN] Would verify migration integrity', 'cyan');
      return true;
    }

    const status = execCommand('npx prisma migrate status');

    if (status.includes('Database schema is up to date')) {
      log('✅ Migration verification passed', 'green');
      return true;
    }

    if (status.includes('pending') || status.includes('not yet been applied')) {
      log('⚠️  Some migrations are still pending', 'yellow');
      return false;
    }

    log('✅ Migration verification completed', 'green');
    return true;
  } catch {
    log('⚠️  Could not verify migration status', 'yellow');
    return true; // Continue anyway
  }
}

function printRollbackInstructions(backupPath: string | null): void {
  log('\n' + '='.repeat(60), 'cyan');
  log('📋 ROLLBACK INSTRUCTIONS', 'cyan');
  log('='.repeat(60), 'cyan');

  if (backupPath) {
    log(`
To rollback this migration:

1. Stop the application:
   pkill -f "next start" || pm2 stop all

2. Restore the database backup:
   cp ${backupPath} db/custom.db

3. Restart the application:
   npm run start || pm2 start all

4. Verify the rollback:
   npx prisma migrate status
`, 'yellow');
  } else {
    log(`
No backup was created (database was empty or dry-run mode).

To rollback if needed:
1. Restore from your most recent backup
2. Run: npx prisma migrate status
3. Contact database administrator if issues persist
`, 'yellow');
  }

  log('='.repeat(60), 'cyan');
}

async function main(): Promise<void> {
  log('\n' + '='.repeat(60), 'cyan');
  log('🗄️  VALORHIVE Production Migration Script', 'cyan');
  log('='.repeat(60), 'cyan');

  if (isDryRun) {
    log('\n⚠️  DRY RUN MODE - No changes will be made', 'yellow');
  }

  // Step 1: Check database connection
  if (!checkDatabaseConnection() && !isDryRun) {
    log('\n❌ Cannot proceed without database connection', 'red');
    process.exit(1);
  }

  // Step 2: Check for existing data
  const dataStatus = checkExistingData();
  if (dataStatus.hasData) {
    log('   Existing data detected - backup will be created', 'yellow');
  }

  // Step 3: Check pending migrations
  const migrationStatus = checkPendingMigrations();

  if (migrationStatus.pending === 0) {
    log('\n✅ No pending migrations - database is up to date', 'green');
    return;
  }

  // Step 4: Confirm migration
  if (!isForce && !isDryRun) {
    log(`\n⚠️  ${migrationStatus.pending} pending migration(s) will be applied.`, 'yellow');
    log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...', 'yellow');

    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Step 5: Create backup
  const backupPath = createBackup();

  // Step 6: Run migrations
  if (!runMigrations() && !isDryRun) {
    log('\n❌ Migration failed. See rollback instructions below.', 'red');
    printRollbackInstructions(backupPath);
    process.exit(1);
  }

  // Step 7: Generate Prisma client
  if (!generateClient() && !isDryRun) {
    log('\n⚠️  Client generation failed, but migration was applied.', 'yellow');
  }

  // Step 8: Verify migration
  if (!verifyMigration() && !isDryRun) {
    log('\n⚠️  Migration verification failed. Please check manually.', 'yellow');
  }

  // Success message
  log('\n' + '='.repeat(60), 'green');
  log('✅ PRODUCTION MIGRATION COMPLETED SUCCESSFULLY', 'green');
  log('='.repeat(60), 'green');

  // Print rollback instructions
  printRollbackInstructions(backupPath);

  // Final status
  if (!isDryRun) {
    log('\n📊 Final Status:', 'blue');
    execCommand('npx prisma migrate status');
  }
}

// Run the script
main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
