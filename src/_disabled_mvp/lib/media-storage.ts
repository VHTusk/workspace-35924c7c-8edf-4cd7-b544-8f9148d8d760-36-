/**
 * Media Storage Service
 * Supports AWS S3 and Uploadthing for file uploads
 * 
 * Configure either:
 * - AWS S3: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET
 * - Uploadthing: UPLOADTHING_SECRET
 */

import { db } from '@/lib/db';
import crypto from 'crypto';

// Storage configuration
const STORAGE_CONFIG = {
  // AWS S3
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION || 'ap-south-1',
  s3Bucket: process.env.S3_BUCKET,
  
  // Uploadthing
  uploadthingSecret: process.env.UPLOADTHING_SECRET,
  uploadthingAppId: process.env.UPLOADTHING_APP_ID,
  
  // Fallback: local storage path
  localStoragePath: process.env.LOCAL_STORAGE_PATH || './uploads',
};

// Determine which storage provider to use
function getStorageProvider(): 's3' | 'uploadthing' | 'local' {
  if (STORAGE_CONFIG.awsAccessKeyId && STORAGE_CONFIG.s3Bucket) {
    return 's3';
  }
  if (STORAGE_CONFIG.uploadthingSecret) {
    return 'uploadthing';
  }
  return 'local';
}

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

export interface UploadOptions {
  folder?: string;
  maxSizeBytes?: number;
  allowedTypes?: string[];
  generateThumbnail?: boolean;
}

/**
 * Generate a unique file key
 */
function generateFileKey(folder: string, originalName: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const ext = originalName.split('.').pop() || 'bin';
  return `${folder}/${timestamp}-${random}.${ext}`;
}

/**
 * Upload file to S3
 */
async function uploadToS3(
  file: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  
  const client = new S3Client({
    region: STORAGE_CONFIG.awsRegion!,
    credentials: {
      accessKeyId: STORAGE_CONFIG.awsAccessKeyId!,
      secretAccessKey: STORAGE_CONFIG.awsSecretAccessKey!,
    },
  });
  
  try {
    await client.send(new PutObjectCommand({
      Bucket: STORAGE_CONFIG.s3Bucket!,
      Key: key,
      Body: file,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1 year cache
    }));
    
    const url = `https://${STORAGE_CONFIG.s3Bucket}.s3.${STORAGE_CONFIG.awsRegion}.amazonaws.com/${key}`;
    
    return { success: true, url, key };
  } catch (error) {
    console.error('S3 upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'S3 upload failed',
    };
  }
}

/**
 * Upload file to Uploadthing
 */
async function uploadToUploadthing(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<UploadResult> {
  try {
    const formData = new FormData();
    const blob = new Blob([file], { type: contentType });
    formData.append('files', blob, fileName);
    
    const response = await fetch('https://uploadthing.com/api/upload', {
      method: 'POST',
      headers: {
        'X-Uploadthing-Secret': STORAGE_CONFIG.uploadthingSecret!,
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Uploadthing error: ${response.status}`);
    }
    
    const data = await response.json();
    const uploadedFile = data[0];
    
    return {
      success: true,
      url: uploadedFile.url,
      key: uploadedFile.key,
    };
  } catch (error) {
    console.error('Uploadthing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Uploadthing upload failed',
    };
  }
}

/**
 * Upload file to local storage (dev fallback)
 */
async function uploadToLocal(
  file: Buffer,
  key: string
): Promise<UploadResult> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  try {
    const fullPath = path.join(STORAGE_CONFIG.localStoragePath, key);
    const dir = path.dirname(fullPath);
    
    // Create directory if needed
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(fullPath, file);
    
    // Return relative URL (served by Next.js public or custom endpoint)
    const url = `/uploads/${key}`;
    
    return { success: true, url, key };
  } catch (error) {
    console.error('Local upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Local upload failed',
    };
  }
}

/**
 * Main upload function - routes to appropriate provider
 */
export async function uploadFile(
  file: Buffer,
  originalName: string,
  contentType: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const provider = getStorageProvider();
  const folder = options.folder || 'general';
  const key = generateFileKey(folder, originalName);
  
  // Validate file size
  if (options.maxSizeBytes && file.length > options.maxSizeBytes) {
    return {
      success: false,
      error: `File too large. Max size: ${Math.round(options.maxSizeBytes / 1024 / 1024)}MB`,
    };
  }
  
  // Validate content type
  if (options.allowedTypes && !options.allowedTypes.includes(contentType)) {
    return {
      success: false,
      error: `File type not allowed. Allowed: ${options.allowedTypes.join(', ')}`,
    };
  }
  
  switch (provider) {
    case 's3':
      return uploadToS3(file, key, contentType);
    case 'uploadthing':
      return uploadToUploadthing(file, originalName, contentType);
    case 'local':
    default:
      return uploadToLocal(file, key);
  }
}

/**
 * Delete file from storage
 */
export async function deleteFile(key: string): Promise<boolean> {
  const provider = getStorageProvider();
  
  try {
    switch (provider) {
      case 's3': {
        const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
        const client = new S3Client({
          region: STORAGE_CONFIG.awsRegion!,
          credentials: {
            accessKeyId: STORAGE_CONFIG.awsAccessKeyId!,
            secretAccessKey: STORAGE_CONFIG.awsSecretAccessKey!,
          },
        });
        await client.send(new DeleteObjectCommand({
          Bucket: STORAGE_CONFIG.s3Bucket!,
          Key: key,
        }));
        return true;
      }
      
      case 'uploadthing': {
        const response = await fetch(`https://uploadthing.com/api/delete`, {
          method: 'POST',
          headers: {
            'X-Uploadthing-Secret': STORAGE_CONFIG.uploadthingSecret!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fileKeys: [key] }),
        });
        return response.ok;
      }
      
      case 'local': {
        const fs = await import('fs/promises');
        const path = await import('path');
        const fullPath = path.join(STORAGE_CONFIG.localStoragePath, key);
        await fs.unlink(fullPath);
        return true;
      }
    }
  } catch (error) {
    console.error('Delete file error:', error);
    return false;
  }
  
  return false;
}

/**
 * Upload profile image for user
 */
export async function uploadProfileImage(
  userId: string,
  file: Buffer,
  originalName: string
): Promise<UploadResult> {
  const result = await uploadFile(file, originalName, 'image/jpeg', {
    folder: `profiles/${userId}`,
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  
  if (result.success && result.url) {
    // Update user profile with new image
    await db.user.update({
      where: { id: userId },
      data: {
        profileImageUrl: result.url,
        profileImageKey: result.key,
      },
    });
  }
  
  return result;
}

/**
 * Upload logo for organization
 */
export async function uploadOrgLogo(
  orgId: string,
  file: Buffer,
  originalName: string
): Promise<UploadResult> {
  const result = await uploadFile(file, originalName, 'image/png', {
    folder: `orgs/${orgId}`,
    maxSizeBytes: 2 * 1024 * 1024, // 2MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  
  if (result.success && result.url) {
    await db.organization.update({
      where: { id: orgId },
      data: {
        logoUrl: result.url,
        logoImageKey: result.key,
      },
    });
  }
  
  return result;
}

/**
 * Upload document for verification
 */
export async function uploadVerificationDocument(
  userId: string,
  documentType: string,
  file: Buffer,
  originalName: string
): Promise<UploadResult> {
  const result = await uploadFile(file, originalName, 'image/jpeg', {
    folder: `documents/${userId}/${documentType}`,
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  });
  
  return result;
}

/**
 * Get presigned URL for direct upload (S3 only)
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string | null> {
  if (getStorageProvider() !== 's3') {
    return null;
  }
  
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  
  const client = new S3Client({
    region: STORAGE_CONFIG.awsRegion!,
    credentials: {
      accessKeyId: STORAGE_CONFIG.awsAccessKeyId!,
      secretAccessKey: STORAGE_CONFIG.awsSecretAccessKey!,
    },
  });
  
  const command = new PutObjectCommand({
    Bucket: STORAGE_CONFIG.s3Bucket!,
    Key: key,
    ContentType: contentType,
  });
  
  return getSignedUrl(client, command, { expiresIn });
}
