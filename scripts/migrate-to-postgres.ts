#!/usr/bin/env ts-node
/**
 * VALORHIVE SQLite to PostgreSQL Migration Script
 * 
 * This script migrates data from SQLite (development) to PostgreSQL (production).
 * 
 * Usage:
 *   # Dry run (preview what would be migrated)
 *   npx ts-node scripts/migrate-to-postgres.ts --dry-run
 * 
 *   # Full migration
 *   npx ts-node scripts/migrate-to-postgres.ts
 * 
 *   # Migrate specific tables
 *   npx ts-node scripts/migrate-to-postgres.ts --tables=User,Team,Tournament
 * 
 *   # With batch size control
 *   npx ts-node scripts/migrate-to-postgres.ts --batch-size=100
 * 
 * Prerequisites:
 *   1. Set up PostgreSQL database
 *   2. Configure DATABASE_URL_PRODUCTION in .env
 *   3. Run: prisma migrate deploy --schema=./prisma/schema.postgresql.prisma
 * 
 * Environment Variables:
 *   DATABASE_URL              - SQLite connection (source)
 *   DATABASE_URL_PRODUCTION   - PostgreSQL connection (target)
 *   DATABASE_URL_PRODUCTION_DIRECT - Direct PostgreSQL connection (no pooler, for migrations)
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const tablesArg = args.find(arg => arg.startsWith('--tables='));
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const specificTables = tablesArg ? tablesArg.split('=')[1].split(',') : null;
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 500;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logProgress(current: number, total: number, table: string) {
  const percentage = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
  process.stdout.write(`\r${colors.cyan}[${bar}] ${percentage}% - ${table}: ${current}/${total}${colors.reset}`);
}

// Source SQLite client
const sourceDb = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

// Target PostgreSQL client
const targetDb = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL_PRODUCTION,
});

// Migration order based on foreign key dependencies
// Tables must be migrated in the correct order to satisfy FK constraints
const MIGRATION_ORDER = [
  // Independent tables first (no FK dependencies)
  'SportRules',
  'BadgeDefinition',
  'FeatureFlag',
  'SystemConfig',
  
  // User-related (depends on nothing)
  'User',
  'Organization',
  
  // Session and auth (depend on User/Org)
  'Session',
  'MfaSecret',
  'MfaRecoveryCode',
  'Wallet',
  'Subscription',
  'OrgSubscription',
  'NotificationPreference',
  
  // Teams (depend on User)
  'Team',
  'TeamMember',
  'TeamInvitation',
  
  // Tournaments (depend on Org, User)
  'Tournament',
  'TournamentTemplate',
  'TournamentSeries',
  'RecurringTournament',
  
  // Tournament registrations
  'TournamentRegistration',
  'OrgTournamentRegistration',
  'TournamentTeam',
  'TournamentWaitlist',
  
  // Tournament details
  'TournamentSponsor',
  'TournamentMedia',
  'TournamentMediaItem',
  'TournamentCheckin',
  'TournamentStaff',
  'ScheduleSlot',
  'TournamentAnnouncement',
  'Announcement',
  
  // Brackets and matches
  'Bracket',
  'BracketMatch',
  'Match',
  'MatchResultHistory',
  
  // Results and payouts
  'TournamentResult',
  'PrizePayoutRecord',
  
  // Organization relations
  'OrgRosterPlayer',
  'OrgRosterRequest',
  'OrgAdmin',
  'OrgStatistics',
  
  // Follow system
  'UserFollow',
  'UserFollowsOrg',
  'OrgFollowsUser',
  
  // Player data
  'PlayerRating',
  'PlayerAchievement',
  'PlayerAvailability',
  'PlayerSearchIndex',
  'PlayerPerformanceTrend',
  'PlayerFormIndicator',
  'HeadToHeadRecord',
  
  // Sport-specific analytics
  'DartsScoringHeatmap',
  'CornholeScoringHeatmap',
  
  // Notifications
  'Notification',
  'EmailNotificationSetting',
  'WhatsAppNotificationSetting',
  'DeviceToken',
  'PushNotificationLog',
  
  // Disputes and moderation
  'Dispute',
  'ContentReport',
  
  // Audit and logging
  'AuditLog',
  'WebhookEvent',
  
  // Identity and transfers
  'TransferCooldown',
  'IdentityChangeRequest',
  
  // Contracts and scouting
  'PlayerContract',
  'InterOrgTeamSelection',
  'InterOrgTeamPlayer',
  'PlayerIdVerification',
  
  // GDPR
  'GdprConsent',
  
  // Referrals
  'Referral',
  
  // Milestones and achievements
  'Milestone',
  
  // Activity and messaging
  'ActivityFeed',
  'Conversation',
  'ConversationParticipant',
  'Message',
  
  // Leaderboards
  'LeaderboardSnapshot',
  'SeriesStanding',
  
  // Video and media
  'VideoHighlight',
  'TournamentRecap',
  'ShareableResultCard',
  
  // Short URLs
  'ShortUrlRedirect',
  
  // Archived data
  'ArchivedTournament',
  'ArchivedMatch',
  
  // Payments
  'PaymentLedger',
];

// Helper function to convert SQLite boolean strings to actual booleans
function convertBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return Boolean(value);
}

// Helper function to parse JSON strings
function parseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

// Field type conversions per model
const FIELD_CONVERSIONS: Record<string, Record<string, (value: unknown) => unknown>> = {
  User: {
    identityLocked: convertBoolean,
    verified: convertBoolean,
    hideElo: convertBoolean,
    showOnLeaderboard: convertBoolean,
    isActive: convertBoolean,
    isAnonymized: convertBoolean,
  },
  Tournament: {
    isPublic: convertBoolean,
  },
  Team: {
    isMute: convertBoolean,
  },
  TeamInvitation: {
    message: (v) => v, // Will be @db.Text in PostgreSQL
  },
  Notification: {
    message: (v) => v,
  },
  AuditLog: {
    metadata: parseJson,
  },
  ActivityFeed: {
    metadata: parseJson,
  },
  Milestone: {
    metadata: parseJson,
  },
  WebhookEvent: {
    payload: parseJson,
  },
  SystemConfig: {
    value: parseJson,
  },
  PushNotificationLog: {
    data: parseJson,
  },
  VideoHighlight: {
    playerIds: parseJson,
  },
  TournamentRecap: {
    highlights: parseJson,
    longestMatch: parseJson,
    highestScore: parseJson,
    standings: parseJson,
  },
  SeriesStanding: {
    placementCount: parseJson,
    tournamentBreakdown: parseJson,
  },
  TournamentSeries: {
    placementPoints: parseJson,
    prizeDistribution: parseJson,
  },
  PlayerFormIndicator: {
    recentResults: parseJson,
  },
  HeadToHeadRecord: {
    recentMatches: parseJson,
  },
  ShareableResultCard: {
    stats: parseJson,
  },
  TournamentMediaItem: {
    taggedPlayerIds: parseJson,
  },
};

// Count records in a table
async function countRecords(db: PrismaClient, table: string): Promise<number> {
  try {
    // @ts-expect-error - Dynamic table access
    return await db[table].count();
  } catch (error) {
    log(`  Error counting ${table}: ${error}`, 'red');
    return 0;
  }
}

// Get all records from a table with pagination
async function getRecords(db: PrismaClient, table: string, skip: number, take: number): Promise<unknown[]> {
  try {
    // @ts-expect-error - Dynamic table access
    return await db[table].findMany({
      skip,
      take,
      orderBy: { id: 'asc' },
    });
  } catch (error) {
    log(`  Error fetching ${table}: ${error}`, 'red');
    return [];
  }
}

// Convert record fields based on model
function convertRecord(table: string, record: Record<string, unknown>): Record<string, unknown> {
  const conversions = FIELD_CONVERSIONS[table] || {};
  const converted = { ...record };
  
  for (const [field, converter] of Object.entries(conversions)) {
    if (field in converted && converted[field] !== null) {
      converted[field] = converter(converted[field]);
    }
  }
  
  return converted;
}

// Insert records into target database
async function insertRecords(
  db: PrismaClient,
  table: string,
  records: Record<string, unknown>[]
): Promise<{ success: number; errors: number }> {
  let success = 0;
  let errors = 0;
  
  for (const record of records) {
    try {
      const converted = convertRecord(table, record);
      // @ts-expect-error - Dynamic table access
      await db[table].create({
        data: converted,
      });
      success++;
    } catch (error) {
      errors++;
      if (errors <= 5) {
        log(`  Error inserting into ${table}: ${error}`, 'red');
      }
    }
  }
  
  return { success, errors };
}

// Migrate a single table
async function migrateTable(table: string): Promise<{ total: number; success: number; errors: number }> {
  const total = await countRecords(sourceDb, table);
  
  if (total === 0) {
    log(`  ${table}: No records to migrate`, 'gray');
    return { total: 0, success: 0, errors: 0 };
  }
  
  if (isDryRun) {
    log(`  ${table}: Would migrate ${total} records`, 'yellow');
    return { total, success: total, errors: 0 };
  }
  
  let success = 0;
  let errors = 0;
  const batches = Math.ceil(total / batchSize);
  
  for (let i = 0; i < batches; i++) {
    const skip = i * batchSize;
    const records = await getRecords(sourceDb, table, skip, batchSize);
    
    if (records.length > 0) {
      const result = await insertRecords(targetDb, table, records as Record<string, unknown>[]);
      success += result.success;
      errors += result.errors;
    }
    
    logProgress(Math.min(skip + batchSize, total), total, table);
  }
  
  console.log(); // New line after progress
  return { total, success, errors };
}

// Main migration function
async function main() {
  console.log('\n' + '='.repeat(60));
  log('VALORHIVE SQLite to PostgreSQL Migration', 'cyan');
  console.log('='.repeat(60) + '\n');
  
  // Check environment variables
  if (!process.env.DATABASE_URL) {
    log('ERROR: DATABASE_URL not set (SQLite source)', 'red');
    process.exit(1);
  }
  
  if (!process.env.DATABASE_URL_PRODUCTION) {
    log('ERROR: DATABASE_URL_PRODUCTION not set (PostgreSQL target)', 'red');
    process.exit(1);
  }
  
  // Log configuration
  log('Configuration:', 'blue');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`);
  console.log(`  Batch size: ${batchSize}`);
  console.log(`  Specific tables: ${specificTables ? specificTables.join(', ') : 'All tables'}`);
  console.log('');
  
  if (isDryRun) {
    log('⚠ This is a dry run. No data will be written to PostgreSQL.', 'yellow');
    console.log('');
  }
  
  // Test connections
  log('Testing database connections...', 'blue');
  try {
    await sourceDb.$queryRaw`SELECT 1`;
    log('  ✓ SQLite connection successful', 'green');
  } catch (error) {
    log(`  ✗ SQLite connection failed: ${error}`, 'red');
    process.exit(1);
  }
  
  try {
    await targetDb.$queryRaw`SELECT 1`;
    log('  ✓ PostgreSQL connection successful', 'green');
  } catch (error) {
    log(`  ✗ PostgreSQL connection failed: ${error}`, 'red');
    process.exit(1);
  }
  console.log('');
  
  // Determine tables to migrate
  const tablesToMigrate = specificTables || MIGRATION_ORDER;
  
  // Get record counts for summary
  log('Counting records...', 'blue');
  const counts: Record<string, number> = {};
  for (const table of tablesToMigrate) {
    counts[table] = await countRecords(sourceDb, table);
  }
  
  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`  Total records to migrate: ${totalRecords.toLocaleString()}`);
  console.log('');
  
  if (isDryRun) {
    log('Records per table:', 'blue');
    for (const [table, count] of Object.entries(counts)) {
      if (count > 0) {
        console.log(`  ${table}: ${count.toLocaleString()}`);
      }
    }
    console.log('');
    log('Dry run complete. Run without --dry-run to perform actual migration.', 'green');
    return;
  }
  
  // Confirm before proceeding
  log(`⚠ About to migrate ${totalRecords.toLocaleString()} records to PostgreSQL.`, 'yellow');
  log('This will INSERT data into the target database.', 'yellow');
  log('Make sure the target tables are empty or handle duplicates appropriately.', 'yellow');
  console.log('');
  
  // Start migration
  const startTime = Date.now();
  const results: Record<string, { total: number; success: number; errors: number }> = {};
  
  log('Starting migration...', 'blue');
  console.log('');
  
  for (const table of tablesToMigrate) {
    if (counts[table] === 0) continue;
    
    log(`Migrating ${table}...`, 'cyan');
    results[table] = await migrateTable(table);
    
    if (results[table].errors > 0) {
      log(`  ⚠ ${results[table].errors} errors occurred`, 'yellow');
    }
  }
  
  // Summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '='.repeat(60));
  log('Migration Summary', 'cyan');
  console.log('='.repeat(60));
  
  let totalSuccess = 0;
  let totalErrors = 0;
  
  for (const [table, result] of Object.entries(results)) {
    if (result.total > 0) {
      const status = result.errors === 0 ? '✓' : '⚠';
      const statusColor = result.errors === 0 ? 'green' : 'yellow';
      log(
        `  ${status} ${table}: ${result.success}/${result.total} (${result.errors} errors)`,
        statusColor
      );
      totalSuccess += result.success;
      totalErrors += result.errors;
    }
  }
  
  console.log('');
  log(`Total records migrated: ${totalSuccess.toLocaleString()}`, 'green');
  if (totalErrors > 0) {
    log(`Total errors: ${totalErrors.toLocaleString()}`, 'yellow');
  }
  log(`Duration: ${duration}s`, 'blue');
  
  if (totalErrors === 0) {
    log('\n✓ Migration completed successfully!', 'green');
  } else {
    log('\n⚠ Migration completed with errors. Review the logs above.', 'yellow');
  }
}

// Run migration
main()
  .catch((error) => {
    log(`\n✗ Migration failed: ${error}`, 'red');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await sourceDb.$disconnect();
    await targetDb.$disconnect();
  });
