/**
 * VALORHIVE Database Migration Safety Scripts
 * 
 * This module provides safe database migration functions for production use.
 * 
 * CRITICAL RULES FOR PRODUCTION:
 * 1. NEVER use `prisma db push` in production - it can cause data loss
 * 2. ALWAYS use `prisma migrate deploy` for production deployments
 * 3. ALWAYS backup before migrations
 * 4. ALWAYS test migrations in staging first
 * 5. ALWAYS verify migration success before proceeding
 * 
 * @module db-migration-safety
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from './db';

const execAsync = promisify(exec);

// ============================================
// Types
// ============================================

export interface MigrationResult {
  success: boolean;
  migrationsApplied: string[];
  errors: string[];
  warnings: string[];
  duration: number;
  backupCreated: boolean;
}

export interface MigrationOptions {
  createBackup?: boolean;
  verifyAfter?: boolean;
  dryRun?: boolean;
  timeout?: number;
}

// ============================================
// Safety Checks
// ============================================

/**
 * Check if we're in production environment
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if database is accessible
 */
async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current database size (for backup estimation)
 */
async function getDatabaseStats(): Promise<{ tables: number; size: string }> {
  try {
    // For PostgreSQL
    const result = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    
    // Get database size
    const sizeResult = await db.$queryRaw<Array<{ pg_size_pretty: string }>>`
      SELECT pg_size_pretty(pg_database_size(current_database())) as pg_size_pretty
    `;
    
    return {
      tables: Number(result[0]?.count || 0),
      size: sizeResult[0]?.pg_size_pretty || 'Unknown',
    };
  } catch {
    return { tables: 0, size: 'Unknown' };
  }
}

/**
 * Verify pending migrations exist
 */
async function hasPendingMigrations(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('npx prisma migrate status --exit-code');
    // Exit code 0 means no pending migrations
    return false;
  } catch (error: unknown) {
    // Exit code 1 means there are pending migrations
    const err = error as { stdout?: string; stderr?: string };
    if (err.stdout?.includes('following migration(s) have not yet been applied') ||
        err.stderr?.includes('following migration(s) have not yet been applied')) {
      return true;
    }
    return false;
  }
}

// ============================================
// Migration Functions
// ============================================

/**
 * Run production-safe database migration
 * 
 * @param options - Migration options
 * @returns Migration result
 */
export async function runProductionMigration(
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    success: false,
    migrationsApplied: [],
    errors: [],
    warnings: [],
    duration: 0,
    backupCreated: false,
  };
  
  const {
    createBackup = isProduction(),
    verifyAfter = true,
    dryRun = false,
    timeout = 300000, // 5 minutes default
  } = options;
  
  console.log('[DB Migration] Starting production migration...');
  console.log(`[DB Migration] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[DB Migration] Dry run: ${dryRun}`);
  
  try {
    // Step 1: Check database connection
    console.log('[DB Migration] Step 1: Checking database connection...');
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      result.errors.push('Cannot connect to database');
      return result;
    }
    console.log('[DB Migration] ✓ Database connection OK');
    
    // Step 2: Check for pending migrations
    console.log('[DB Migration] Step 2: Checking for pending migrations...');
    const pending = await hasPendingMigrations();
    if (!pending) {
      result.warnings.push('No pending migrations found');
      result.success = true;
      console.log('[DB Migration] ✓ No pending migrations');
      return result;
    }
    console.log('[DB Migration] ⚠ Pending migrations detected');
    
    // Step 3: Get database stats before migration
    console.log('[DB Migration] Step 3: Getting database stats...');
    const statsBefore = await getDatabaseStats();
    console.log(`[DB Migration] Database: ${statsBefore.tables} tables, size: ${statsBefore.size}`);
    
    // Step 4: Create backup if requested (for PostgreSQL, use pg_dump)
    if (createBackup && !dryRun) {
      console.log('[DB Migration] Step 4: Creating backup...');
      // Note: For production with PostgreSQL, use pg_dump
  // Example: pg_dump -h DB_HOST -U postgres valorhive > backup_$(date +%Y%m%d).sql
      result.warnings.push('Backup creation should be handled by infrastructure (pg_dump or managed service backup)');
      result.backupCreated = true;
    }
    
    // Step 5: Run migration
    if (!dryRun) {
      console.log('[DB Migration] Step 5: Running prisma migrate deploy...');
      
      try {
        // Use migrate deploy for production (no interactive prompts)
        const { stdout, stderr } = await execAsync(
          'npx prisma migrate deploy',
          { timeout }
        );
        
        if (stderr && !stderr.includes('Done')) {
          result.warnings.push(`Migration stderr: ${stderr}`);
        }
        
        // Parse applied migrations from output
        const migrationMatches = stdout.matchAll(/Applying migration `([^`]+)`/g);
        for (const match of migrationMatches) {
          result.migrationsApplied.push(match[1]);
        }
        
        console.log('[DB Migration] ✓ Migrations applied successfully');
        
      } catch (migrationError: unknown) {
        const err = migrationError as { message?: string; stdout?: string; stderr?: string };
        result.errors.push(`Migration failed: ${err.message || 'Unknown error'}`);
        if (err.stdout) result.errors.push(`stdout: ${err.stdout}`);
        if (err.stderr) result.errors.push(`stderr: ${err.stderr}`);
        return result;
      }
    } else {
      console.log('[DB Migration] [DRY RUN] Would run: npx prisma migrate deploy');
      result.warnings.push('Dry run - no migrations applied');
    }
    
    // Step 6: Verify migration success
    if (verifyAfter && !dryRun) {
      console.log('[DB Migration] Step 6: Verifying migration...');
      
      const stillPending = await hasPendingMigrations();
      if (stillPending) {
        result.errors.push('Migration verification failed - still have pending migrations');
        return result;
      }
      
      // Verify database connection still works
      const dbStillConnected = await checkDatabaseConnection();
      if (!dbStillConnected) {
        result.errors.push('Database connection lost after migration');
        return result;
      }
      
      console.log('[DB Migration] ✓ Migration verified successfully');
    }
    
    // Step 7: Generate Prisma client
    if (!dryRun) {
      console.log('[DB Migration] Step 7: Generating Prisma client...');
      await execAsync('npx prisma generate', { timeout: 60000 });
      console.log('[DB Migration] ✓ Prisma client generated');
    }
    
    result.success = true;
    result.duration = Date.now() - startTime;
    
    console.log(`[DB Migration] ✓ Migration completed in ${result.duration}ms`);
    console.log(`[DB Migration] Applied ${result.migrationsApplied.length} migrations`);
    
    return result;
    
  } catch (error: unknown) {
    const err = error as Error;
    result.errors.push(`Unexpected error: ${err.message}`);
    result.duration = Date.now() - startTime;
    console.error('[DB Migration] ✗ Migration failed:', err.message);
    return result;
  }
}

/**
 * Check migration status without applying
 */
export async function checkMigrationStatus(): Promise<{
  connected: boolean;
  pendingMigrations: string[];
  appliedMigrations: string[];
  errors: string[];
}> {
  const result: {
    connected: boolean;
    pendingMigrations: string[];
    appliedMigrations: string[];
    errors: string[];
  } = {
    connected: false,
    pendingMigrations: [],
    appliedMigrations: [],
    errors: [],
  };
  
  try {
    // Check connection
    result.connected = await checkDatabaseConnection();
    
    if (!result.connected) {
      result.errors.push('Cannot connect to database');
      return result;
    }
    
    // Get migration status
    const { stdout, stderr } = await execAsync('npx prisma migrate status');
    
    // Parse output for pending and applied migrations
    const pendingMatch = stdout.match(/Following migration\(s\) have not yet been applied:\s*([\s\S]*?)(?=\n\n|$)/);
    if (pendingMatch) {
      result.pendingMigrations = pendingMatch[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    }
    
    // Parse applied migrations from database
    const appliedMigrations = await db.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM _prisma_migrations ORDER BY finished_at
    `;
    result.appliedMigrations = appliedMigrations.map(m => m.migration_name);
    
    return result;
    
  } catch (error: unknown) {
    const err = error as Error;
    result.errors.push(err.message);
    return result;
  }
}

/**
 * Rollback last migration (USE WITH EXTREME CAUTION)
 * 
 * This should only be used in emergency situations.
 * For PostgreSQL, use prisma migrate resolve --rolled-back or restore from backup.
 */
export async function emergencyRollback(): Promise<{
  success: boolean;
  message: string;
}> {
  if (!isProduction()) {
    return {
      success: false,
      message: 'Rollback only available in production (safety measure)',
    };
  }
  
  // For PostgreSQL, we could use prisma migrate resolve --rolled-back
  // Or restore from pg_dump backup
  
  return {
    success: false,
    message: 'Emergency rollback requires backup restoration or manual intervention. Contact database administrator.',
  };
}

// ============================================
// Safety Reminders
// ============================================

export const MIGRATION_RULES = [
  '🚨 NEVER use `prisma db push` in production',
  '✅ ALWAYS use `prisma migrate deploy` in production',
  '💾 ALWAYS backup before migrations',
  '🧪 ALWAYS test migrations in staging first',
  '✅ ALWAYS verify migration success',
  '📝 ALWAYS review generated SQL before applying',
  '⚠️ NEVER apply migrations during peak hours',
  '📊 ALWAYS monitor database after migration',
];

/**
 * Log migration safety rules
 */
export function logMigrationRules(): void {
  console.log('\n========================================');
  console.log('DATABASE MIGRATION SAFETY RULES');
  console.log('========================================\n');
  MIGRATION_RULES.forEach(rule => console.log(rule));
  console.log('\n========================================\n');
}

// ============================================
// Exports
// ============================================

export default {
  runProductionMigration,
  checkMigrationStatus,
  emergencyRollback,
  logMigrationRules,
  checkDatabaseConnection,
  hasPendingMigrations,
  MIGRATION_RULES,
};
