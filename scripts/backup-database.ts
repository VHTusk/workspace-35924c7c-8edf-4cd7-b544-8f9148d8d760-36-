#!/usr/bin/env npx tsx
/**
 * VALORHIVE Database Backup Script
 * 
 * Creates database backups with the following features:
 * - Support for PostgreSQL (production) and SQLite (development)
 * - Compressed with gzip
 * - Encrypted backup option
 * - Upload to S3 with multipart support
 * - Retention policy enforcement
 * - Incremental backup support for large databases
 * - Comprehensive logging
 * 
 * Usage:
 *   npx tsx scripts/backup-database.ts [--type full|incremental] [--dry-run] [--no-upload]
 * 
 * Environment Variables:
 *   DATABASE_URL - Database connection string
 *   AWS_BACKUP_BUCKET - S3 bucket for backups
 *   AWS_BACKUP_PREFIX - S3 prefix/folder
 *   BACKUP_ENCRYPTION_KEY - Key for encrypting backups
 *   BACKUP_RETENTION_DAILY - Days to keep daily backups (default: 30)
 *   BACKUP_RETENTION_MONTHLY - Months to keep monthly backups (default: 12)
 */

import { exec, spawn } from 'child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync, renameSync } from 'fs';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { tmpdir, hostname } from 'os';
import { join, dirname } from 'path';
import { promisify } from 'util';
import { createGzip } from 'zlib';
import {
  generateBackupFilename,
  generateBackupId,
  uploadToS3,
  uploadManifest,
  applyRetentionPolicy,
  isS3Configured,
  calculateFileChecksum,
  type BackupManifest,
  type RetentionPolicy,
  BACKUP_VERSION,
} from '../src/lib/backup-s3';

const execAsync = promisify(exec);

// ============================================
// Configuration
// ============================================

interface BackupConfig {
  databaseUrl: string;
  databaseType: 'postgresql' | 'sqlite';
  outputPath: string;
  type: 'full' | 'incremental';
  encrypt: boolean;
  upload: boolean;
  dryRun: boolean;
  retention: RetentionPolicy;
}

interface BackupResult {
  success: boolean;
  backupId: string;
  manifest: BackupManifest | null;
  localPath: string;
  uploadKey: string;
  duration: number;
  error?: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: Record<string, unknown>;
}

// ============================================
// Logging
// ============================================

const logs: LogEntry[] = [];

function log(level: LogEntry['level'], message: string, details?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    details,
  };
  
  logs.push(entry);
  
  const prefix = {
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
    debug: '[DEBUG]',
  }[level];
  
  console.log(`${prefix} ${message}`);
  if (details && level !== 'info') {
    console.log(JSON.stringify(details, null, 2));
  }
}

// ============================================
// Database Type Detection
// ============================================

function detectDatabaseType(databaseUrl: string): 'postgresql' | 'sqlite' {
  if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    return 'postgresql';
  }
  if (databaseUrl.startsWith('file:') || databaseUrl.endsWith('.db') || databaseUrl.endsWith('.sqlite')) {
    return 'sqlite';
  }
  // Default to PostgreSQL for production
  return 'postgresql';
}

// ============================================
// PostgreSQL Backup
// ============================================

async function backupPostgresql(config: BackupConfig): Promise<{ path: string; size: number }> {
  const backupPath = config.outputPath;
  const tempPath = `${backupPath}.tmp`;
  
  log('info', 'Starting PostgreSQL backup...');
  
  // Parse connection string to get individual components
  const url = new URL(config.databaseUrl);
  const host = url.hostname;
  const port = url.port || '5432';
  const database = url.pathname.substring(1);
  const username = url.username;
  const password = url.password;
  
  // Build pg_dump command with options
  const pgDumpArgs = [
    '-h', host,
    '-p', port,
    '-U', username,
    '-d', database,
    '-F', 'p', // Plain SQL format
    '-Z', '0', // No compression (we'll do it ourselves)
    '--no-owner', // Don't output owner commands
    '--no-acl', // Don't output ACL commands
    '--exclude-table=pg_catalog.*', // Exclude system tables
    '--exclude-table=information_schema.*', // Exclude information schema
    '--exclude-table=_prisma_migrations', // Exclude Prisma migrations table from backup
    '--verbose',
  ];
  
  // Add incremental backup options
  if (config.type === 'incremental') {
    // For incremental, we use --data-only with specific tables
    // This is a simplified approach; true incremental requires more setup
    pgDumpArgs.push('--data-only');
  }
  
  log('debug', 'Running pg_dump', { host, database, port });
  
  return new Promise((resolve, reject) => {
    const pgDump = spawn('pg_dump', pgDumpArgs, {
      env: {
        ...process.env,
        PGPASSWORD: password,
      },
    });
    
    const outputStream = createWriteStream(tempPath);
    const gzipStream = createGzip({ level: 9 }); // Maximum compression
    
    pgDump.stdout.pipe(gzipStream).pipe(outputStream);
    
    let stderrOutput = '';
    pgDump.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });
    
    pgDump.on('error', (error) => {
      log('error', 'pg_dump process error', { error: error.message });
      reject(error);
    });
    
    pgDump.on('close', (code) => {
      if (code !== 0) {
        log('error', 'pg_dump failed', { code, stderr: stderrOutput });
        reject(new Error(`pg_dump exited with code ${code}`));
        return;
      }
      
      outputStream.end();
      
      // Get file size
      const stats = statSync(tempPath);
      const size = stats.size;
      
      // Rename to final path
      renameSync(tempPath, backupPath);
      
      log('info', 'PostgreSQL backup completed', { path: backupPath, size });
      
      resolve({ path: backupPath, size });
    });
  });
}

// ============================================
// SQLite Backup
// ============================================

async function backupSqlite(config: BackupConfig): Promise<{ path: string; size: number }> {
  const backupPath = config.outputPath;
  const tempPath = `${backupPath}.tmp`;
  
  log('info', 'Starting SQLite backup...');
  
  // Get the actual database file path
  let dbPath = config.databaseUrl;
  if (dbPath.startsWith('file:')) {
    dbPath = dbPath.substring(5);
  }
  
  if (!existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}`);
  }
  
  // For SQLite, we use .dump command to create SQL export
  const sqliteArgs = [dbPath, '.dump'];
  
  log('debug', 'Running sqlite3 dump', { dbPath });
  
  return new Promise((resolve, reject) => {
    const sqliteDump = spawn('sqlite3', sqliteArgs);
    
    const outputStream = createWriteStream(tempPath);
    const gzipStream = createGzip({ level: 9 }); // Maximum compression
    
    // Add header comment
    outputStream.write('-- VALORHIVE SQLite Database Backup\n');
    outputStream.write(`-- Generated: ${new Date().toISOString()}\n`);
    outputStream.write(`-- Version: ${BACKUP_VERSION}\n`);
    outputStream.write('--\n\n');
    
    sqliteDump.stdout.pipe(gzipStream).pipe(outputStream);
    
    let stderrOutput = '';
    sqliteDump.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });
    
    sqliteDump.on('error', (error) => {
      log('error', 'sqlite3 process error', { error: error.message });
      reject(error);
    });
    
    sqliteDump.on('close', (code) => {
      if (code !== 0) {
        log('error', 'sqlite3 dump failed', { code, stderr: stderrOutput });
        reject(new Error(`sqlite3 exited with code ${code}`));
        return;
      }
      
      outputStream.end();
      
      // Get file size
      const stats = statSync(tempPath);
      const size = stats.size;
      
      // Rename to final path
      renameSync(tempPath, backupPath);
      
      log('info', 'SQLite backup completed', { path: backupPath, size });
      
      resolve({ path: backupPath, size });
    });
  });
}

// ============================================
// Create Backup Manifest
// ============================================

async function createManifest(
  config: BackupConfig,
  backupPath: string,
  backupId: string,
  checksum: string,
  size: number
): Promise<BackupManifest> {
  const filename = backupPath.split('/').pop() || '';
  
  // Get database version info
  let pgVersion: string | undefined;
  if (config.databaseType === 'postgresql') {
    try {
      const { stdout } = await execAsync('pg_config --version');
      pgVersion = stdout.trim();
    } catch {
      // pg_config may not be available
    }
  }
  
  const manifest: BackupManifest = {
    id: backupId,
    timestamp: new Date().toISOString(),
    version: BACKUP_VERSION,
    type: config.type,
    database: config.databaseType,
    filename,
    size,
    checksum,
    encrypted: config.encrypt && !!process.env.BACKUP_ENCRYPTION_KEY,
    compressed: true,
    metadata: {
      environment: process.env.NODE_ENV || 'development',
      host: hostname(),
      appVersion: process.env.npm_package_version || '1.0.0',
      pgVersion,
    },
  };
  
  return manifest;
}

// ============================================
// Main Backup Function
// ============================================

async function runBackup(config: BackupConfig): Promise<BackupResult> {
  const startTime = Date.now();
  const backupId = generateBackupId();
  const filename = generateBackupFilename(config.type);
  const outputPath = join(config.outputPath, '..', filename);
  
  log('info', `Starting ${config.type} backup`, {
    backupId,
    databaseType: config.databaseType,
    outputPath,
    encrypt: config.encrypt,
    upload: config.upload,
    dryRun: config.dryRun,
  });
  
  try {
    // Ensure output directory exists
    await mkdir(dirname(outputPath), { recursive: true });
    
    // Create backup based on database type
    let backupResult: { path: string; size: number };
    
    if (config.dryRun) {
      log('info', '[DRY RUN] Would create backup', { outputPath });
      backupResult = { path: outputPath, size: 0 };
    } else {
      if (config.databaseType === 'postgresql') {
        backupResult = await backupPostgresql({ ...config, outputPath });
      } else {
        backupResult = await backupSqlite({ ...config, outputPath });
      }
    }
    
    // Calculate checksum
    let checksum = '';
    if (!config.dryRun) {
      checksum = await calculateFileChecksum(backupResult.path);
      log('info', 'Backup checksum calculated', { checksum });
    }
    
    // Create manifest
    const manifest = await createManifest(
      config,
      backupResult.path,
      backupId,
      checksum,
      backupResult.size
    );
    
    let uploadKey = '';
    
    // Upload to S3
    if (config.upload && isS3Configured() && !config.dryRun) {
      log('info', 'Uploading backup to S3...');
      
      const uploadResult = await uploadToS3(backupResult.path, filename, {
        contentType: 'application/gzip',
        metadata: {
          'backup-id': backupId,
          'backup-type': config.type,
          'database-type': config.databaseType,
        },
        encrypt: config.encrypt,
      });
      
      if (!uploadResult.success) {
        log('error', 'Failed to upload backup to S3', { error: uploadResult.error });
        throw new Error(`S3 upload failed: ${uploadResult.error}`);
      }
      
      uploadKey = uploadResult.key;
      log('info', 'Backup uploaded to S3', { key: uploadKey });
      
      // Upload manifest
      const manifestUploaded = await uploadManifest(manifest);
      if (!manifestUploaded) {
        log('warn', 'Failed to upload manifest to S3');
      }
      
      // Apply retention policy
      log('info', 'Applying retention policy...');
      const retentionResult = await applyRetentionPolicy(config.retention);
      log('info', 'Retention policy applied', {
        deleted: retentionResult.deleted.length,
        kept: retentionResult.kept.length,
        errors: retentionResult.errors.length,
      });
      
      // Clean up local file after successful upload
      try {
        unlinkSync(backupResult.path);
        log('info', 'Local backup file cleaned up');
      } catch {
        log('warn', 'Failed to clean up local backup file');
      }
    } else if (!config.upload || !isS3Configured()) {
      log('info', 'S3 upload skipped', {
        configured: isS3Configured(),
        upload: config.upload,
      });
    }
    
    const duration = Date.now() - startTime;
    
    log('info', 'Backup completed successfully', {
      backupId,
      duration: `${duration}ms`,
      size: backupResult.size,
      uploadKey,
    });
    
    return {
      success: true,
      backupId,
      manifest,
      localPath: backupResult.path,
      uploadKey,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    log('error', 'Backup failed', { error: errorMsg, duration });
    
    return {
      success: false,
      backupId,
      manifest: null,
      localPath: '',
      uploadKey: '',
      duration,
      error: errorMsg,
    };
  }
}

// ============================================
// CLI Entry Point
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const config: BackupConfig = {
    databaseUrl: process.env.DATABASE_URL || '',
    databaseType: 'postgresql',
    outputPath: join(tmpdir(), 'valorhive-backups', `backup-${Date.now()}.sql.gz`),
    type: args.includes('--incremental') ? 'incremental' : 'full',
    encrypt: !!process.env.BACKUP_ENCRYPTION_KEY,
    upload: !args.includes('--no-upload'),
    dryRun: args.includes('--dry-run'),
    retention: {
      daily: parseInt(process.env.BACKUP_RETENTION_DAILY || '30', 10),
      monthly: parseInt(process.env.BACKUP_RETENTION_MONTHLY || '12', 10),
    },
  };
  
  // Detect database type
  config.databaseType = detectDatabaseType(config.databaseUrl);
  
  log('info', 'VALORHIVE Database Backup Script', {
    version: BACKUP_VERSION,
    nodeEnv: process.env.NODE_ENV,
    databaseType: config.databaseType,
    type: config.type,
  });
  
  // Validate configuration
  if (!config.databaseUrl) {
    log('error', 'DATABASE_URL environment variable is required');
    process.exit(1);
  }
  
  // Run backup
  const result = await runBackup(config);
  
  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Export for programmatic use
export {
  runBackup,
  backupPostgresql,
  backupSqlite,
  detectDatabaseType,
  type BackupConfig,
  type BackupResult,
};

// Run if called directly
main().catch((error) => {
  log('error', 'Unhandled error', { error: error.message });
  process.exit(1);
});
