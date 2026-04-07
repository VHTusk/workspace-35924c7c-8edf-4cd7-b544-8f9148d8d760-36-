#!/usr/bin/env npx tsx
/**
 * VALORHIVE Database Restore Script
 * 
 * Restores database from S3 backup with safety checks:
 * - Download from S3
 * - Decrypt if encrypted
 * - Verify checksum
 * - Restore to database with confirmation
 * - Safety checks before overwriting
 * 
 * Usage:
 *   npx tsx scripts/restore-database.ts --id <backup-id> [--dry-run] [--force]
 *   npx tsx scripts/restore-database.ts --list
 *   npx tsx scripts/restore-database.ts --latest
 * 
 * Environment Variables:
 *   DATABASE_URL - Database connection string
 *   AWS_BACKUP_BUCKET - S3 bucket for backups
 *   AWS_BACKUP_PREFIX - S3 prefix/folder
 *   BACKUP_ENCRYPTION_KEY - Key for decrypting backups
 */

import { createReadStream, createWriteStream, existsSync, mkdirSync, rmSync, statSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { spawn } from 'child_process';
import { createGunzip } from 'zlib';
import {
  downloadFromS3,
  downloadManifest,
  listBackups,
  verifyBackup,
  prepareRestore,
  isS3Configured,
  type BackupManifest,
} from '../src/lib/backup-s3';

// ============================================
// Configuration
// ============================================

interface RestoreConfig {
  backupId?: string;
  useLatest: boolean;
  listOnly: boolean;
  dryRun: boolean;
  force: boolean;
  targetDatabase?: string;
}

interface RestoreResult {
  success: boolean;
  backupId: string;
  manifest: BackupManifest | null;
  localPath: string;
  verificationPassed: boolean;
  restored: boolean;
  duration: number;
  error?: string;
}

// ============================================
// Logging
// ============================================

function log(level: 'info' | 'warn' | 'error' | 'success', message: string, details?: Record<string, unknown>): void {
  const prefix = {
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
    success: '[SUCCESS]',
  }[level];
  
  console.log(`${prefix} ${message}`);
  if (details) {
    console.log(JSON.stringify(details, null, 2));
  }
}

// ============================================
// Database Restore Functions
// ============================================

async function restorePostgresql(sqlPath: string, databaseUrl: string): Promise<{ success: boolean; error?: string }> {
  log('info', 'Restoring to PostgreSQL database...');
  
  const url = new URL(databaseUrl);
  const host = url.hostname;
  const port = url.port || '5432';
  const database = url.pathname.substring(1);
  const username = url.username;
  const password = url.password;
  
  return new Promise((resolve) => {
    const psql = spawn('psql', [
      '-h', host,
      '-p', port,
      '-U', username,
      '-d', database,
      '-f', sqlPath,
      '-v', 'ON_ERROR_STOP=1',
      '--quiet',
    ], {
      env: { ...process.env, PGPASSWORD: password },
    });
    
    let stderrOutput = '';
    psql.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });
    
    psql.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
    
    psql.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: `psql exited with code ${code}: ${stderrOutput}` });
        return;
      }
      
      resolve({ success: true });
    });
  });
}

async function restoreSqlite(sqlPath: string, databaseUrl: string): Promise<{ success: boolean; error?: string }> {
  log('info', 'Restoring to SQLite database...');
  
  let dbPath = databaseUrl;
  if (dbPath.startsWith('file:')) {
    dbPath = dbPath.substring(5);
  }
  
  // Create backup of existing database
  if (existsSync(dbPath)) {
    const backupPath = `${dbPath}.pre-restore-${Date.now()}.bak`;
    log('info', `Creating backup of existing database at ${backupPath}`);
    
    const fs = await import('fs');
    await fs.promises.copyFile(dbPath, backupPath);
  }
  
  return new Promise((resolve) => {
    // For SQLite, we need to read the SQL and pipe it to sqlite3
    const sqlite3 = spawn('sqlite3', [dbPath]);
    
    // Read SQL file and pipe to sqlite3 stdin
    const sqlStream = createReadStream(sqlPath);
    
    sqlStream.pipe(sqlite3.stdin);
    
    let stderrOutput = '';
    sqlite3.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });
    
    sqlite3.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
    
    sqlite3.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: `sqlite3 exited with code ${code}: ${stderrOutput}` });
        return;
      }
      
      resolve({ success: true });
    });
  });
}

async function decompressBackup(compressedPath: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
  log('info', `Decompressing backup to ${outputPath}...`);
  
  return new Promise((resolve) => {
    const gunzip = createGunzip();
    
    const inputStream = createReadStream(compressedPath);
    const outputStream = createWriteStream(outputPath);
    
    inputStream.pipe(gunzip).pipe(outputStream);
    
    inputStream.on('error', (error: Error) => {
      resolve({ success: false, error: `Input error: ${error.message}` });
    });
    
    outputStream.on('error', (error: Error) => {
      resolve({ success: false, error: `Output error: ${error.message}` });
    });
    
    outputStream.on('finish', () => {
      resolve({ success: true });
    });
  });
}

// ============================================
// Main Restore Function
// ============================================

async function runRestore(config: RestoreConfig): Promise<RestoreResult> {
  const startTime = Date.now();
  
  log('info', 'VALORHIVE Database Restore Script', {
    backupId: config.backupId,
    useLatest: config.useLatest,
    dryRun: config.dryRun,
    force: config.force,
  });
  
  // Check S3 configuration
  if (!isS3Configured()) {
    return {
      success: false,
      backupId: config.backupId || '',
      manifest: null,
      localPath: '',
      verificationPassed: false,
      restored: false,
      duration: Date.now() - startTime,
      error: 'S3 not configured. Set AWS_BACKUP_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY',
    };
  }
  
  try {
    // Determine backup ID
    let backupId = config.backupId;
    
    if (config.useLatest || config.listOnly) {
      log('info', 'Fetching backup list...');
      const { backups } = await listBackups();
      
      if (backups.length === 0) {
        return {
          success: false,
          backupId: '',
          manifest: null,
          localPath: '',
          verificationPassed: false,
          restored: false,
          duration: Date.now() - startTime,
          error: 'No backups found',
        };
      }
      
      if (config.listOnly) {
        log('info', 'Available backups:');
        console.log('');
        console.log('ID                               | Timestamp           | Type      | Database    | Size      | Encrypted');
        console.log('-'.repeat(110));
        for (const backup of backups) {
          const size = formatBytes(backup.size);
          console.log(`${backup.id.padEnd(32)} | ${backup.timestamp.substring(0, 19)} | ${backup.type.padEnd(9)} | ${backup.database.padEnd(11)} | ${size.padEnd(9)} | ${backup.encrypted}`);
        }
        
        return {
          success: true,
          backupId: '',
          manifest: null,
          localPath: '',
          verificationPassed: true,
          restored: false,
          duration: Date.now() - startTime,
        };
      }
      
      // Use latest backup
      backupId = backups[0].id;
      log('info', `Using latest backup: ${backupId}`);
    }
    
    if (!backupId) {
      return {
        success: false,
        backupId: '',
        manifest: null,
        localPath: '',
        verificationPassed: false,
        restored: false,
        duration: Date.now() - startTime,
        error: 'No backup ID specified. Use --id <backup-id>, --latest, or --list',
      };
    }
    
    // Verify backup exists
    log('info', `Verifying backup: ${backupId}...`);
    const verifyResult = await verifyBackup(backupId);
    
    if (!verifyResult.valid) {
      return {
        success: false,
        backupId,
        manifest: verifyResult.manifest || null,
        localPath: '',
        verificationPassed: false,
        restored: false,
        duration: Date.now() - startTime,
        error: `Backup verification failed: ${verifyResult.error}`,
      };
    }
    
    const manifest = verifyResult.manifest!;
    log('info', 'Backup verified:', {
      id: manifest.id,
      timestamp: manifest.timestamp,
      type: manifest.type,
      database: manifest.database,
      size: formatBytes(manifest.size),
      encrypted: manifest.encrypted,
    });
    
    // Safety check
    const databaseUrl = config.targetDatabase || process.env.DATABASE_URL || '';
    if (!databaseUrl) {
      return {
        success: false,
        backupId,
        manifest,
        localPath: '',
        verificationPassed: true,
        restored: false,
        duration: Date.now() - startTime,
        error: 'DATABASE_URL not set',
      };
    }
    
    // Confirm restore if not forced
    if (!config.force && !config.dryRun) {
      log('warn', '');
      log('warn', '⚠️  WARNING: This will OVERWRITE your current database!');
      log('warn', `Target database: ${databaseUrl.substring(0, 50)}...`);
      log('warn', `Backup to restore: ${manifest.id} (${manifest.timestamp})`);
      log('warn', '');
      log('warn', 'Use --force to skip this warning.');
      log('warn', 'Use --dry-run to test without making changes.');
      
      return {
        success: false,
        backupId,
        manifest,
        localPath: '',
        verificationPassed: true,
        restored: false,
        duration: Date.now() - startTime,
        error: 'Restore cancelled. Use --force to proceed.',
      };
    }
    
    // Download and prepare backup
    const outputDir = join(tmpdir(), 'valorhive-restore');
    await mkdir(outputDir, { recursive: true });
    
    const compressedPath = join(outputDir, manifest.filename);
    const sqlPath = compressedPath.replace('.gz', '');
    
    if (config.dryRun) {
      log('info', '[DRY RUN] Would download and restore backup');
      
      return {
        success: true,
        backupId,
        manifest,
        localPath: compressedPath,
        verificationPassed: true,
        restored: false,
        duration: Date.now() - startTime,
      };
    }
    
    // Download backup
    log('info', 'Downloading backup from S3...');
    const downloadResult = await downloadFromS3(
      `backups/database/${manifest.filename}`,
      compressedPath,
      { decrypt: manifest.encrypted }
    );
    
    if (!downloadResult.success) {
      return {
        success: false,
        backupId,
        manifest,
        localPath: '',
        verificationPassed: false,
        restored: false,
        duration: Date.now() - startTime,
        error: `Download failed: ${downloadResult.error}`,
      };
    }
    
    log('info', `Downloaded ${formatBytes(downloadResult.size)} to ${compressedPath}`);
    
    // Decompress
    const decompressResult = await decompressBackup(compressedPath, sqlPath);
    if (!decompressResult.success) {
      return {
        success: false,
        backupId,
        manifest,
        localPath: compressedPath,
        verificationPassed: true,
        restored: false,
        duration: Date.now() - startTime,
        error: `Decompression failed: ${decompressResult.error}`,
      };
    }
    
    log('info', `Decompressed to ${sqlPath}`);
    
    // Restore to database
    let restoreResult;
    if (manifest.database === 'postgresql') {
      restoreResult = await restorePostgresql(sqlPath, databaseUrl);
    } else {
      restoreResult = await restoreSqlite(sqlPath, databaseUrl);
    }
    
    if (!restoreResult.success) {
      return {
        success: false,
        backupId,
        manifest,
        localPath: sqlPath,
        verificationPassed: true,
        restored: false,
        duration: Date.now() - startTime,
        error: `Restore failed: ${restoreResult.error}`,
      };
    }
    
    // Cleanup temp files
    try {
      rmSync(compressedPath, { force: true });
      rmSync(sqlPath, { force: true });
    } catch {
      // Ignore cleanup errors
    }
    
    const duration = Date.now() - startTime;
    
    log('success', `Restore completed successfully in ${duration}ms`);
    
    return {
      success: true,
      backupId,
      manifest,
      localPath: sqlPath,
      verificationPassed: true,
      restored: true,
      duration,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      backupId: config.backupId || '',
      manifest: null,
      localPath: '',
      verificationPassed: false,
      restored: false,
      duration: Date.now() - startTime,
      error: errorMsg,
    };
  }
}

// ============================================
// Helpers
// ============================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================
// CLI Entry Point
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  const config: RestoreConfig = {
    backupId: args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--id')),
    useLatest: args.includes('--latest'),
    listOnly: args.includes('--list'),
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    targetDatabase: args[args.indexOf('--target') + 1],
  };
  
  // Handle --id flag
  const idIndex = args.indexOf('--id');
  if (idIndex !== -1 && args[idIndex + 1]) {
    config.backupId = args[idIndex + 1];
  }
  
  const result = await runRestore(config);
  
  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Export for programmatic use
export {
  runRestore,
  restorePostgresql,
  restoreSqlite,
  decompressBackup,
  type RestoreConfig,
  type RestoreResult,
};

// Run if called directly
main().catch((error) => {
  log('error', 'Unhandled error', { error: error.message });
  process.exit(1);
});
