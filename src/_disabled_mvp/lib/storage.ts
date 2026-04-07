/**
 * AWS S3 Storage Service for VALORHIVE
 * 
 * Provides production-grade object storage for:
 * - User profile images
 * - Tournament media and banners
 * - Document uploads
 * - Tournament galleries
 * 
 * Features:
 * - Signed URLs for secure direct uploads
 * - CDN-backed public URLs
 * - Automatic image optimization
 * - Presigned POST policies for large files
 * - Bucket lifecycle management
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost, type PresignedPostOptions } from '@aws-sdk/s3-presigned-post';
import { Upload } from '@aws-sdk/lib-storage';
import { log } from './logger';

// ============================================
// Types and Interfaces
// ============================================

export type StorageBucket = 'uploads' | 'media' | 'documents' | 'backups';

export interface UploadOptions {
  bucket?: StorageBucket;
  folder?: string;
  filename?: string;
  contentType?: string;
  acl?: 'private' | 'public-read';
  maxFileSize?: number;
  expiresIn?: number;
}

export interface SignedUploadResult {
  uploadUrl: string;
  fileUrl: string;
  fields: Record<string, string>;
  expiresIn: number;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// ============================================
// S3 Client Configuration
// ============================================

const getS3Client = (): S3Client => {
  const region = process.env.AWS_REGION || 'ap-south-1';
  
  return new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    maxAttempts: 3,
    requestHandler: {
      requestTimeout: 30000,
    },
  });
};

let s3Client: S3Client | null = null;

const getClient = (): S3Client => {
  if (!s3Client) {
    s3Client = getS3Client();
  }
  return s3Client;
};

// ============================================
// Bucket Configuration
// ============================================

const getBucketName = (bucket: StorageBucket): string => {
  const baseBucket = process.env.S3_BUCKET_NAME || 'valorhive';
  const environment = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
  
  const bucketMap: Record<StorageBucket, string> = {
    uploads: `${baseBucket}-${environment}-uploads`,
    media: `${baseBucket}-${environment}-media`,
    documents: `${baseBucket}-${environment}-documents`,
    backups: `${baseBucket}-${environment}-backups`,
  };
  
  return bucketMap[bucket];
};

const CDN_BASE_URL = process.env.CDN_BASE_URL || `https://cdn.valorhive.com`;

// ============================================
// Storage Service Class
// ============================================

class StorageService {
  private client: S3Client;

  constructor() {
    this.client = getClient();
  }

  /**
   * Generate a signed URL for direct file upload
   */
  async getSignedUploadUrl(
    key: string,
    options: UploadOptions = {}
  ): Promise<SignedUploadResult> {
    const {
      bucket = 'uploads',
      contentType = 'application/octet-stream',
      expiresIn = 3600,
    } = options;

    const bucketName = getBucketName(bucket);
    const fullKey = options.folder ? `${options.folder}/${key}` : key;

    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fullKey,
        ContentType: contentType,
        ACL: options.acl || 'public-read',
      });

      const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });

      const fileUrl = `${CDN_BASE_URL}/${fullKey}`;

      return {
        uploadUrl,
        fileUrl,
        fields: {},
        expiresIn,
      };
    } catch (error) {
      log.error('Failed to generate signed upload URL', {
        key: fullKey,
        bucket: bucketName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate presigned POST for multipart uploads (better for large files)
   */
  async getPresignedPost(
    key: string,
    options: UploadOptions = {}
  ): Promise<{ url: string; fields: Record<string, string> }> {
    const {
      bucket = 'uploads',
      contentType = 'application/octet-stream',
      maxFileSize = 10 * 1024 * 1024, // 10MB default
      expiresIn = 3600,
    } = options;

    const bucketName = getBucketName(bucket);
    const fullKey = options.folder ? `${options.folder}/${key}` : key;

    try {
      const presignedPost = await createPresignedPost(this.client, {
        Bucket: bucketName,
        Key: fullKey,
        Conditions: [
          ['content-length-range', 0, maxFileSize],
          ['starts-with', '$Content-Type', contentType.split('/')[0]],
        ],
        Fields: {
          'Content-Type': contentType,
        },
        Expires: expiresIn,
      });

      return presignedPost;
    } catch (error) {
      log.error('Failed to generate presigned POST', {
        key: fullKey,
        bucket: bucketName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Upload a file directly (server-side)
   */
  async uploadFile(
    key: string,
    body: Buffer | ReadableStream,
    options: UploadOptions = {}
  ): Promise<string> {
    const {
      bucket = 'uploads',
      contentType = 'application/octet-stream',
    } = options;

    const bucketName = getBucketName(bucket);
    const fullKey = options.folder ? `${options.folder}/${key}` : key;

    try {
      const input: PutObjectCommandInput = {
        Bucket: bucketName,
        Key: fullKey,
        Body: body,
        ContentType: contentType,
        ACL: options.acl || 'public-read',
      };

      // Use multipart upload for large files
      if (body instanceof Buffer && body.length > 5 * 1024 * 1024) {
        const upload = new Upload({
          client: this.client,
          params: input,
        });

        await upload.done();
      } else {
        await this.client.send(new PutObjectCommand(input));
      }

      const fileUrl = `${CDN_BASE_URL}/${fullKey}`;
      log.info('File uploaded', { key: fullKey, bucket: bucketName });

      return fileUrl;
    } catch (error) {
      log.error('Failed to upload file', {
        key: fullKey,
        bucket: bucketName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get a signed URL for downloading a file
   */
  async getSignedDownloadUrl(
    key: string,
    options: { bucket?: StorageBucket; expiresIn?: number } = {}
  ): Promise<string> {
    const { bucket = 'uploads', expiresIn = 3600 } = options;
    const bucketName = getBucketName(bucket);

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      log.error('Failed to generate signed download URL', {
        key,
        bucket: bucketName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(key: string, bucket: StorageBucket = 'uploads'): string {
    return `${CDN_BASE_URL}/${key}`;
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string, bucket: StorageBucket = 'uploads'): Promise<void> {
    const bucketName = getBucketName(bucket);

    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      }));

      log.info('File deleted', { key, bucket: bucketName });
    } catch (error) {
      log.error('Failed to delete file', {
        key,
        bucket: bucketName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(keys: string[], bucket: StorageBucket = 'uploads'): Promise<void> {
    if (keys.length === 0) return;

    const bucketName = getBucketName(bucket);

    try {
      await this.client.send(new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
        },
      }));

      log.info('Files deleted', { count: keys.length, bucket: bucketName });
    } catch (error) {
      log.error('Failed to delete files', {
        count: keys.length,
        bucket: bucketName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(key: string, bucket: StorageBucket = 'uploads'): Promise<boolean> {
    const bucketName = getBucketName(bucket);

    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string, bucket: StorageBucket = 'uploads'): Promise<FileMetadata | null> {
    const bucketName = getBucketName(bucket);

    try {
      const response = await this.client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      }));

      return {
        key,
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
        etag: response.ETag || '',
      };
    } catch {
      return null;
    }
  }

  /**
   * Copy a file
   */
  async copyFile(
    sourceKey: string,
    destinationKey: string,
    options: {
      sourceBucket?: StorageBucket;
      destinationBucket?: StorageBucket;
    } = {}
  ): Promise<string> {
    const sourceBucket = getBucketName(options.sourceBucket || 'uploads');
    const destinationBucket = getBucketName(options.destinationBucket || 'uploads');

    try {
      await this.client.send(new CopyObjectCommand({
        Bucket: destinationBucket,
        Key: destinationKey,
        CopySource: `${sourceBucket}/${sourceKey}`,
      }));

      return this.getPublicUrl(destinationKey, options.destinationBucket || 'uploads');
    } catch (error) {
      log.error('Failed to copy file', {
        sourceKey,
        destinationKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(
    prefix: string,
    bucket: StorageBucket = 'uploads'
  ): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    const bucketName = getBucketName(bucket);
    const files: Array<{ key: string; size: number; lastModified: Date }> = [];

    try {
      let continuationToken: string | undefined;

      do {
        const response = await this.client.send(new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }));

        if (response.Contents) {
          for (const object of response.Contents) {
            if (object.Key) {
              files.push({
                key: object.Key,
                size: object.Size || 0,
                lastModified: object.LastModified || new Date(),
              });
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return files;
    } catch (error) {
      log.error('Failed to list files', {
        prefix,
        bucket: bucketName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique file key
 */
export function generateFileKey(
  originalFilename: string,
  options: { prefix?: string; userId?: string } = {}
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalFilename.split('.').pop() || '';
  const baseName = originalFilename.replace(/\.[^/.]+$/, '').substring(0, 50);

  const parts = [options.prefix, options.userId, `${baseName}-${timestamp}-${random}`]
    .filter(Boolean);

  return `${parts.join('/')}.${extension}`;
}

/**
 * Validate file type
 */
export function validateFileType(
  filename: string,
  allowedTypes: string[]
): boolean {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return allowedTypes.includes(extension);
}

/**
 * Get content type from filename
 */
export function getContentType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Check if file is an image
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return imageExtensions.includes(extension);
}

// ============================================
// Export singleton instance
// ============================================

export const storage = new StorageService();

// Default bucket configurations
export const BUCKET_CONFIGS = {
  uploads: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'],
  },
  media: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm'],
  },
  documents: {
    maxFileSize: 20 * 1024 * 1024, // 20MB
    allowedTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
  },
  backups: {
    maxFileSize: 1024 * 1024 * 1024, // 1GB
    allowedTypes: ['zip', 'sql', 'json'],
  },
};
