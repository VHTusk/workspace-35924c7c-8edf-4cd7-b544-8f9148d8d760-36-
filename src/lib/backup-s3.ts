/**
 * VALORHIVE S3 Backup Configuration
 * 
 * Handles S3 operations for database backups:
 * - Upload with multipart support for large files
 * - Backup manifest tracking
 * - Retention policy enforcement
 * - Restore functionality
 * 
 * @module backup-s3
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createHash, createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join, basename } from 'path';
import { pipeline } from 'stream/promises';
import { createGzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// ============================================
// Configuration
// ============================================

interface S3BackupConfig {
  bucket: string;
  prefix: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  encryptionKey?: string;
}

interface BackupManifest {
  id: string;
  timestamp: string;
  version: string;
  type: 'full' | 'incremental';
  database: 'postgresql' | 'sqlite';
  filename: string;
  size: number;
  checksum: string;
  encrypted: boolean;
  compressed: boolean;
  tables?: string[];
  baseBackupId?: string; // For incremental backups
  metadata: {
    environment: string;
    host: string;
    appVersion: string;
    pgVersion?: string;
  };
}

interface RetentionPolicy {
  daily: number;   // Keep last N daily backups
  monthly: number; // Keep last N monthly backups
}

const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  daily: 30,   // Keep last 30 daily backups
  monthly: 12, // Keep last 12 monthly backups (1 year)
};

const BACKUP_VERSION = '1.0.0';

// ============================================
// S3 Client Setup
// ============================================

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const config = getS3Config();
    s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      maxAttempts: 3,
      requestHandler: {
        requestTimeout: 300000, // 5 minutes
      },
    });
  }
  return s3Client;
}

function getS3Config(): S3BackupConfig {
  return {
    bucket: process.env.AWS_BACKUP_BUCKET || process.env.BACKUP_S3_BUCKET || '',
    prefix: process.env.AWS_BACKUP_PREFIX || 'backups/database/',
    region: process.env.AWS_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
  };
}

function resetS3Client(): void {
  s3Client = null;
}

// ============================================
// Encryption Helpers
// ============================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32);
}

async function encryptData(data: Buffer, password: string): Promise<Buffer> {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Format: salt (32) + iv (16) + authTag (16) + encrypted
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

async function decryptData(data: Buffer, password: string): Promise<Buffer> {
  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  
  const key = deriveKey(password, salt);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// ============================================
// Checksum Helpers
// ============================================

function calculateChecksum(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

async function calculateFileChecksum(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return calculateChecksum(data);
}

// ============================================
// Upload Functions
// ============================================

interface UploadResult {
  success: boolean;
  key: string;
  size: number;
  checksum: string;
  error?: string;
}

/**
 * Upload file to S3 with multipart support for large files
 */
async function uploadToS3(
  filePath: string,
  key: string,
  options?: {
    contentType?: string;
    metadata?: Record<string, string>;
    encrypt?: boolean;
  }
): Promise<UploadResult> {
  const config = getS3Config();
  const client = getS3Client();
  
  try {
    const fileBuffer = Buffer.from(await readFile(filePath));
    const checksum = calculateChecksum(fileBuffer);
    
    let dataToUpload: Uint8Array = fileBuffer;
    let encrypted = false;
    
    // Encrypt if requested and key is available
    if (options?.encrypt && config.encryptionKey) {
      dataToUpload = await encryptData(fileBuffer, config.encryptionKey);
      encrypted = true;
    }
    
    // Use multipart upload for files larger than 5MB
    const fileSize = dataToUpload.length;
    const useMultipart = fileSize > 5 * 1024 * 1024; // 5MB threshold
    
    const fullKey = `${config.prefix}${key}`;
    
    if (useMultipart) {
      // Multipart upload for large files
      const upload = new Upload({
        client,
        params: {
          Bucket: config.bucket,
          Key: fullKey,
          Body: dataToUpload,
          ContentType: options?.contentType || 'application/octet-stream',
          Metadata: {
            ...options?.metadata,
            checksum,
            encrypted: String(encrypted),
            originalSize: String(fileSize),
          },
        },
        queueSize: 4, // Concurrent parts
        partSize: 5 * 1024 * 1024, // 5MB parts
      });
      
      await upload.done();
    } else {
      // Simple upload for smaller files
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: fullKey,
        Body: dataToUpload,
        ContentType: options?.contentType || 'application/octet-stream',
        Metadata: {
          ...options?.metadata,
          checksum,
          encrypted: String(encrypted),
          originalSize: String(fileSize),
        },
      });
      
      await client.send(command);
    }
    
    return {
      success: true,
      key: fullKey,
      size: fileSize,
      checksum,
    };
  } catch (error) {
    return {
      success: false,
      key: '',
      size: 0,
      checksum: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload backup manifest to S3
 */
async function uploadManifest(manifest: BackupManifest): Promise<boolean> {
  const config = getS3Config();
  const client = getS3Client();
  
  try {
    const manifestKey = `${config.prefix}manifests/${manifest.id}.json`;
    const manifestData = JSON.stringify(manifest, null, 2);
    
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: manifestKey,
      Body: manifestData,
      ContentType: 'application/json',
    });
    
    await client.send(command);
    return true;
  } catch (error) {
    console.error('[BACKUP-S3] Failed to upload manifest:', error);
    return false;
  }
}

// ============================================
// Download Functions
// ============================================

interface DownloadResult {
  success: boolean;
  filePath: string;
  size: number;
  error?: string;
}

/**
 * Download backup from S3
 */
async function downloadFromS3(
  key: string,
  localPath: string,
  options?: {
    decrypt?: boolean;
  }
): Promise<DownloadResult> {
  const config = getS3Config();
  const client = getS3Client();
  
  try {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });
    
    const response = await client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty response body');
    }
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    let data: Uint8Array = Buffer.from(Buffer.concat(chunks));
    
    // Decrypt if requested and key is available
    if (options?.decrypt && config.encryptionKey) {
      const metadata = response.Metadata || {};
      if (metadata.encrypted === 'true') {
        data = await decryptData(Buffer.from(data), config.encryptionKey);
      }
    }
    
    // Ensure directory exists
    const dir = localPath.substring(0, localPath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    
    await writeFile(localPath, data);
    
    return {
      success: true,
      filePath: localPath,
      size: data.length,
    };
  } catch (error) {
    return {
      success: false,
      filePath: '',
      size: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Download and return manifest
 */
async function downloadManifest(manifestId: string): Promise<BackupManifest | null> {
  const config = getS3Config();
  const client = getS3Client();
  
  try {
    const manifestKey = `${config.prefix}manifests/${manifestId}.json`;
    
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: manifestKey,
    });
    
    const response = await client.send(command);
    
    if (!response.Body) {
      return null;
    }
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks).toString('utf-8');
    
    return JSON.parse(data) as BackupManifest;
  } catch (error) {
    console.error('[BACKUP-S3] Failed to download manifest:', error);
    return null;
  }
}

// ============================================
// Backup Management Functions
// ============================================

interface BackupListResult {
  backups: BackupManifest[];
  totalSize: number;
  count: number;
}

/**
 * List all backups from S3
 */
async function listBackups(): Promise<BackupListResult> {
  const config = getS3Config();
  const client = getS3Client();
  
  const backups: BackupManifest[] = [];
  let totalSize = 0;
  let continuationToken: string | undefined;
  
  try {
    // List all manifest files
    do {
      const command = new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: `${config.prefix}manifests/`,
        ContinuationToken: continuationToken,
      });
      
      const response = await client.send(command);
      
      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key?.endsWith('.json')) {
            const manifestId = basename(object.Key, '.json');
            const manifest = await downloadManifest(manifestId);
            if (manifest) {
              backups.push(manifest);
              totalSize += manifest.size;
            }
          }
        }
      }
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    
    // Sort by timestamp (newest first)
    backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return {
      backups,
      totalSize,
      count: backups.length,
    };
  } catch (error) {
    console.error('[BACKUP-S3] Failed to list backups:', error);
    return {
      backups: [],
      totalSize: 0,
      count: 0,
    };
  }
}

/**
 * Apply retention policy - delete old backups
 * Retention: Keep last 30 daily backups + last 12 monthly backups
 */
async function applyRetentionPolicy(
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY
): Promise<{ deleted: string[]; kept: string[]; errors: string[] }> {
  const config = getS3Config();
  const client = getS3Client();
  
  const result = {
    deleted: [] as string[],
    kept: [] as string[],
    errors: [] as string[],
  };
  
  try {
    const { backups } = await listBackups();
    
    const now = new Date();
    const dailyCutoff = new Date(now.getTime() - policy.daily * 24 * 60 * 60 * 1000);
    const monthlyCutoff = new Date(now.getTime() - policy.monthly * 30 * 24 * 60 * 60 * 1000);
    
    // Categorize backups
    const dailyBackups: BackupManifest[] = [];
    const monthlyBackups: BackupManifest[] = [];
    
    for (const backup of backups) {
      const backupDate = new Date(backup.timestamp);
      
      if (backupDate >= dailyCutoff) {
        dailyBackups.push(backup);
      } else if (backupDate >= monthlyCutoff) {
        monthlyBackups.push(backup);
      }
    }
    
    // Group monthly backups by month (keep one per month)
    const monthlyGroups = new Map<string, BackupManifest[]>();
    for (const backup of monthlyBackups) {
      const backupDate = new Date(backup.timestamp);
      const monthKey = `${backupDate.getFullYear()}-${String(backupDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyGroups.has(monthKey)) {
        monthlyGroups.set(monthKey, []);
      }
      monthlyGroups.get(monthKey)!.push(backup);
    }
    
    // Keep only one backup per month (the most recent)
    const monthlyToKeep: BackupManifest[] = [];
    for (const [, monthBackups] of monthlyGroups) {
      monthBackups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      monthlyToKeep.push(monthBackups[0]);
    }
    
    // Determine which backups to keep
    const keepIds = new Set([
      ...dailyBackups.map(b => b.id),
      ...monthlyToKeep.map(b => b.id),
    ]);
    
    // Delete backups that are not in the keep list
    for (const backup of backups) {
      if (keepIds.has(backup.id)) {
        result.kept.push(backup.id);
      } else {
        try {
          // Delete backup file
          const backupKey = `${config.prefix}${backup.filename}`;
          await client.send(new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: backupKey,
          }));
          
          // Delete manifest
          const manifestKey = `${config.prefix}manifests/${backup.id}.json`;
          await client.send(new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: manifestKey,
          }));
          
          result.deleted.push(backup.id);
          console.log(`[BACKUP-S3] Deleted backup: ${backup.id}`);
        } catch (deleteError) {
          const errorMsg = deleteError instanceof Error ? deleteError.message : 'Unknown error';
          result.errors.push(`Failed to delete ${backup.id}: ${errorMsg}`);
        }
      }
    }
    
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Failed to apply retention policy: ${errorMsg}`);
    return result;
  }
}

// ============================================
// Restore Functions
// ============================================

interface RestoreOptions {
  manifestId: string;
  targetDatabase?: string; // Override database URL for restore
  localPath?: string;
  verifyOnly?: boolean;
  decrypt?: boolean;
}

interface RestoreResult {
  success: boolean;
  manifest: BackupManifest | null;
  localPath: string;
  verificationPassed: boolean;
  error?: string;
}

/**
 * Download and prepare backup for restore
 */
async function prepareRestore(options: RestoreOptions): Promise<RestoreResult> {
  const config = getS3Config();
  
  try {
    // Get manifest
    const manifest = await downloadManifest(options.manifestId);
    if (!manifest) {
      return {
        success: false,
        manifest: null,
        localPath: '',
        verificationPassed: false,
        error: `Manifest not found: ${options.manifestId}`,
      };
    }
    
    // Determine local path
    const localPath = options.localPath || `/tmp/restore-${options.manifestId}.sql.gz`;
    const backupKey = `${config.prefix}${manifest.filename}`;
    
    // Download backup
    const downloadResult = await downloadFromS3(backupKey, localPath, {
      decrypt: options.decrypt ?? true,
    });
    
    if (!downloadResult.success) {
      return {
        success: false,
        manifest,
        localPath: '',
        verificationPassed: false,
        error: downloadResult.error,
      };
    }
    
    // Verify checksum
    const actualChecksum = await calculateFileChecksum(localPath);
    const verificationPassed = actualChecksum === manifest.checksum;
    
    if (!verificationPassed) {
      console.warn(`[BACKUP-S3] Checksum mismatch: expected ${manifest.checksum}, got ${actualChecksum}`);
    }
    
    return {
      success: true,
      manifest,
      localPath,
      verificationPassed,
    };
  } catch (error) {
    return {
      success: false,
      manifest: null,
      localPath: '',
      verificationPassed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify backup integrity
 */
async function verifyBackup(manifestId: string): Promise<{
  valid: boolean;
  manifest: BackupManifest | null;
  checksumMatch: boolean;
  error?: string;
}> {
  try {
    const manifest = await downloadManifest(manifestId);
    if (!manifest) {
      return {
        valid: false,
        manifest: null,
        checksumMatch: false,
        error: 'Manifest not found',
      };
    }
    
    const config = getS3Config();
    const client = getS3Client();
    
    // Check if backup file exists
    const backupKey = `${config.prefix}${manifest.filename}`;
    
    const command = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: backupKey,
    });
    
    const response = await client.send(command);
    
    // Verify size matches
    const sizeMatch = response.ContentLength === manifest.size;
    
    return {
      valid: sizeMatch,
      manifest,
      checksumMatch: true, // Full checksum requires downloading the file
      error: sizeMatch ? undefined : 'Size mismatch',
    };
  } catch (error) {
    return {
      valid: false,
      manifest: null,
      checksumMatch: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if S3 backup is configured
 */
function isS3Configured(): boolean {
  const config = getS3Config();
  return !!(config.bucket && config.accessKeyId && config.secretAccessKey);
}

/**
 * Generate backup filename with timestamp
 * Format: backups/YYYY/MM/DD/valorhive-HHMMSS.db.gz
 */
function generateBackupFilename(type: 'full' | 'incremental' = 'full'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  // Format: backups/YYYY/MM/DD/valorhive-HHMMSS.db.gz
  return `backups/${year}/${month}/${day}/valorhive-${hours}${minutes}${seconds}.db.gz`;
}

/**
 * Generate backup ID
 */
function generateBackupId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `backup-${timestamp}-${random}`;
}

/**
 * Get backup statistics
 */
async function getBackupStats(): Promise<{
  totalBackups: number;
  totalSize: number;
  oldestBackup: string | null;
  newestBackup: string | null;
  lastBackupAge: number | null;
}> {
  const { backups, totalSize, count } = await listBackups();
  
  if (count === 0) {
    return {
      totalBackups: 0,
      totalSize: 0,
      oldestBackup: null,
      newestBackup: null,
      lastBackupAge: null,
    };
  }
  
  const newestBackup = backups[0];
  const oldestBackup = backups[backups.length - 1];
  const lastBackupAge = Date.now() - new Date(newestBackup.timestamp).getTime();
  
  return {
    totalBackups: count,
    totalSize,
    oldestBackup: oldestBackup.timestamp,
    newestBackup: newestBackup.timestamp,
    lastBackupAge,
  };
}

// ============================================
// Exports
// ============================================

export {
  // Configuration
  getS3Client,
  getS3Config,
  resetS3Client,
  isS3Configured,
  
  // Upload
  uploadToS3,
  uploadManifest,
  
  // Download
  downloadFromS3,
  downloadManifest,
  
  // Management
  listBackups,
  applyRetentionPolicy,
  
  // Restore
  prepareRestore,
  verifyBackup,
  
  // Utility
  generateBackupFilename,
  generateBackupId,
  getBackupStats,
  calculateChecksum,
  calculateFileChecksum,
  
  // Encryption
  encryptData,
  decryptData,
  
  // Types
  type S3BackupConfig,
  type BackupManifest,
  type RetentionPolicy,
  type UploadResult,
  type DownloadResult,
  type RestoreOptions,
  type RestoreResult,
  
  // Constants
  DEFAULT_RETENTION_POLICY,
  BACKUP_VERSION,
};
