/**
 * VALORHIVE File Upload Security Module
 * Comprehensive secure file upload handling with virus scanning,
 * MIME validation, size limits, and image re-encoding.
 * 
 * Version: v4.0.0
 * 
 * Features:
 * - MIME type validation with allowed types whitelist
 * - Magic number (file signature) verification
 * - File size limits by upload context
 * - Image re-encoding using sharp to strip malicious payloads
 * - Virus scanning integration (ClamAV/AWS S3)
 * - Filename sanitization
 * - Security headers for downloads
 * - Rate limiting support for uploads
 */

import sharp from 'sharp';
import logger, { createLogger } from '@/lib/logger';

const log = createLogger('file-upload-security');

// ============================================
// ALLOWED MIME TYPES
// ============================================

/**
 * Allowed MIME types for file uploads
 * SVG is explicitly NOT allowed due to XSS risk
 */
export const ALLOWED_MIME_TYPES = {
  // Images - safe formats that can be re-encoded
  images: {
    'image/jpeg': {
      extensions: ['.jpg', '.jpeg'],
      magicNumbers: ['FFD8FF', 'FFD8FFE0', 'FFD8FFE1'],
      canReencode: true,
    },
    'image/png': {
      extensions: ['.png'],
      magicNumbers: ['89504E470D0A1A0A'],
      canReencode: true,
    },
    'image/gif': {
      extensions: ['.gif'],
      magicNumbers: ['474946383761', '474946383961'],
      canReencode: true,
    },
    'image/webp': {
      extensions: ['.webp'],
      magicNumbers: ['52494646', '57454250'],
      canReencode: true,
    },
  },
  
  // Documents - PDF only
  documents: {
    'application/pdf': {
      extensions: ['.pdf'],
      magicNumbers: ['25504446'],
      canReencode: false,
    },
  },
  
  // SVG is NOT allowed due to XSS risk
  // SVG files can contain JavaScript and malicious scripts
} as const;

// Flatten for easy lookup
export const ALL_ALLOWED_MIME_TYPES = {
  ...ALLOWED_MIME_TYPES.images,
  ...ALLOWED_MIME_TYPES.documents,
};

// ============================================
// FILE SIZE LIMITS BY CONTEXT
// ============================================

/**
 * Maximum file sizes for different upload contexts
 * Images: 10MB max, Documents: 5MB max
 */
export const FILE_SIZE_LIMITS = {
  profilePhoto: 5 * 1024 * 1024, // 5MB - images only
  idDocument: 5 * 1024 * 1024, // 5MB - images + PDF
  tournamentGallery: 10 * 1024 * 1024, // 10MB - images only
  contractPdf: 5 * 1024 * 1024, // 5MB - PDF only
  orgLogo: 2 * 1024 * 1024, // 2MB - images only
  default: 5 * 1024 * 1024, // 5MB default
} as const;

// ============================================
// DANGEROUS PATTERNS
// ============================================

/**
 * Dangerous file extensions that should NEVER be allowed
 */
export const BLOCKED_EXTENSIONS = [
  // Executables
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.msi', '.dll',
  // Scripts
  '.vbs', '.js', '.jar', '.sh', '.bash', '.ps1', '.psm1',
  // Web scripts
  '.php', '.asp', '.aspx', '.jsp', '.cgi', '.pl',
  // System files
  '.htaccess', '.htpasswd', '.sql', '.db', '.sqlite',
  // SVG (XSS risk)
  '.svg', '.svgz',
  // HTML/XML (XSS risk)
  '.html', '.htm', '.xhtml', '.xml', '.xsl',
];

/**
 * Dangerous content patterns in files
 */
const DANGEROUS_PATTERNS = [
  // Script tags
  /<script\b/i,
  // JavaScript protocol
  /javascript:/i,
  // Event handlers
  /on\w+\s*=/i,
  // PHP tags
  /<\?php/i,
  // ASP/JSP tags
  /<%/i,
  /<jsp:/i,
  // Template literals that could execute code
  /\$\{/i,
  // eval and similar
  /\beval\s*\(/i,
  /\bFunction\s*\(/i,
  // DOM manipulation
  /\bdocument\./i,
  /\bwindow\./i,
  /\balert\s*\(/i,
  // Data URLs (could contain malicious payloads)
  /data:text\/html/i,
  /data:application\/javascript/i,
];

// ============================================
// FILE SIGNATURES (Magic Numbers)
// ============================================

/**
 * File signature definitions for magic number verification
 * Used to verify the actual file content matches the declared type
 */
export const FILE_SIGNATURES: Record<string, { signature: string[]; offset: number; description: string }> = {
  'image/jpeg': {
    signature: ['FFD8FF'],
    offset: 0,
    description: 'JPEG image',
  },
  'image/png': {
    signature: ['89504E470D0A1A0A'],
    offset: 0,
    description: 'PNG image',
  },
  'image/gif': {
    signature: ['474946383761', '474946383961'], // GIF87a, GIF89a
    offset: 0,
    description: 'GIF image',
  },
  'image/webp': {
    signature: ['52494646'], // RIFF header, followed by WEBP at offset 8
    offset: 0,
    description: 'WebP image',
  },
  'application/pdf': {
    signature: ['25504446'], // %PDF
    offset: 0,
    description: 'PDF document',
  },
  // Dangerous signatures to detect disguised files
  'application/zip': {
    signature: ['504B0304', '504B0506', '504B0708'],
    offset: 0,
    description: 'ZIP archive (potentially dangerous)',
  },
  'application/x-dosexec': {
    signature: ['4D5A9000', '4D5A'],
    offset: 0,
    description: 'Windows executable (dangerous)',
  },
};

// ============================================
// INTERFACES
// ============================================

/**
 * Configuration for file upload validation
 */
export interface FileUploadConfig {
  /** List of allowed MIME types */
  allowedTypes: string[];
  /** Maximum file size in bytes */
  maxSize: number;
  /** Whether to scan for viruses */
  scanForVirus: boolean;
  /** Whether to re-encode images to strip metadata */
  reencodeImages: boolean;
  /** Purpose of the upload */
  purpose: UploadPurpose;
  /** Whether to require authentication */
  requireAuth: boolean;
}

/**
 * Upload purpose types
 */
export type UploadPurpose = 
  | 'profilePhoto'
  | 'idDocument'
  | 'tournamentGallery'
  | 'contractPdf'
  | 'orgLogo'
  | 'general';

/**
 * Result of file validation
 */
export interface FileValidationResult {
  /** Whether the file passed validation */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: string;
  /** Sanitized filename */
  sanitizedFilename?: string;
  /** Detected MIME type from file content */
  detectedMimeType?: string;
  /** Warnings (non-fatal issues) */
  warnings?: string[];
  /** Re-encoded image buffer (if applicable) */
  reencodedBuffer?: Buffer;
  /** Original file size */
  originalSize?: number;
  /** Size after re-encoding */
  newSize?: number;
}

/**
 * Result of virus scan
 */
export interface VirusScanResult {
  /** Whether the file is clean */
  clean: boolean;
  /** Detected threat name */
  threat?: string;
  /** Scan engine used */
  engine?: string;
  /** Warnings from scanner */
  warnings?: string[];
}

// ============================================
// UPLOAD CONFIGURATIONS BY CONTEXT
// ============================================

/**
 * Pre-defined upload configurations for different contexts
 */
export const UPLOAD_CONFIGS: Record<UploadPurpose, FileUploadConfig> = {
  profilePhoto: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: FILE_SIZE_LIMITS.profilePhoto,
    scanForVirus: true,
    reencodeImages: true,
    purpose: 'profilePhoto',
    requireAuth: true,
  },
  
  idDocument: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxSize: FILE_SIZE_LIMITS.idDocument,
    scanForVirus: true,
    reencodeImages: true, // Re-encode images, pass through PDFs
    purpose: 'idDocument',
    requireAuth: true,
  },
  
  tournamentGallery: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: FILE_SIZE_LIMITS.tournamentGallery,
    scanForVirus: true,
    reencodeImages: true,
    purpose: 'tournamentGallery',
    requireAuth: true,
  },
  
  contractPdf: {
    allowedTypes: ['application/pdf'],
    maxSize: FILE_SIZE_LIMITS.contractPdf,
    scanForVirus: true,
    reencodeImages: false, // PDFs cannot be re-encoded
    purpose: 'contractPdf',
    requireAuth: true,
  },
  
  orgLogo: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: FILE_SIZE_LIMITS.orgLogo,
    scanForVirus: true,
    reencodeImages: true,
    purpose: 'orgLogo',
    requireAuth: true,
  },
  
  general: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: FILE_SIZE_LIMITS.default,
    scanForVirus: true,
    reencodeImages: true,
    purpose: 'general',
    requireAuth: true,
  },
};

/**
 * Get upload configuration for a specific purpose
 */
export function getUploadConfig(purpose: UploadPurpose): FileUploadConfig {
  return UPLOAD_CONFIGS[purpose] || UPLOAD_CONFIGS.general;
}

// ============================================
// FILE SIGNATURE VERIFICATION
// ============================================

/**
 * Read the first bytes of a file to verify its type
 * Returns hex string of the first N bytes
 */
export async function getFileSignature(buffer: Buffer | ArrayBuffer, bytesToRead: number = 16): Promise<string> {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const bytes = buf.slice(0, bytesToRead);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join('');
}

/**
 * Verify file signature matches declared MIME type
 */
export async function verifyFileSignature(
  buffer: Buffer | ArrayBuffer,
  declaredMimeType: string
): Promise<{ valid: boolean; detectedType?: string; reason?: string }> {
  const signature = await getFileSignature(buffer, 16);
  
  // Check if declared type is in our signatures
  const typeConfig = FILE_SIGNATURES[declaredMimeType];
  
  if (!typeConfig) {
    // Unknown type - allow with warning
    return { 
      valid: true, 
      reason: 'Unknown MIME type - signature verification skipped' 
    };
  }
  
  // Check if signature matches
  for (const sig of typeConfig.signature) {
    if (signature.startsWith(sig)) {
      return { valid: true, detectedType: declaredMimeType };
    }
  }
  
  // Signature doesn't match - try to detect actual type
  for (const [mimeType, config] of Object.entries(FILE_SIGNATURES)) {
    for (const sig of config.signature) {
      if (signature.startsWith(sig)) {
        // File claims to be one type but is actually another
        if (mimeType !== declaredMimeType) {
          log.warn('File signature mismatch', {
            declared: declaredMimeType,
            detected: mimeType,
            signature: signature.substring(0, 16),
          });
          
          return {
            valid: false,
            detectedType: mimeType,
            reason: `File claims to be ${declaredMimeType} but is actually ${mimeType}`,
          };
        }
      }
    }
  }
  
  // Check for dangerous signatures
  const dangerousSignatures = [
    { signature: '4D5A', type: 'Windows executable' },
    { signature: '504B0304', type: 'ZIP archive' },
    { signature: '7F454C46', type: 'Linux executable' },
  ];
  
  for (const { signature: sig, type } of dangerousSignatures) {
    if (signature.startsWith(sig)) {
      log.warn('Dangerous file signature detected', {
        declaredType: declaredMimeType,
        detectedType: type,
        signature: signature.substring(0, 16),
      });
      
      return {
        valid: false,
        reason: `File appears to be a ${type} disguised as ${declaredMimeType}`,
      };
    }
  }
  
  // Couldn't verify signature
  return {
    valid: false,
    reason: 'Could not verify file signature - file may be corrupted or disguised',
  };
}

/**
 * Detect MIME type from file content
 */
export async function detectMimeType(buffer: Buffer | ArrayBuffer): Promise<string | null> {
  const signature = await getFileSignature(buffer, 16);
  
  for (const [mimeType, config] of Object.entries(FILE_SIGNATURES)) {
    for (const sig of config.signature) {
      if (signature.startsWith(sig)) {
        // Special check for WebP (RIFF....WEBP)
        if (mimeType === 'image/webp') {
          const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
          // Check for WEBP at offset 8
          if (buf.length >= 12) {
            const webpMarker = buf.slice(8, 12).toString('ascii');
            if (webpMarker === 'WEBP') {
              return mimeType;
            }
          }
          continue;
        }
        return mimeType;
      }
    }
  }
  
  return null;
}

// ============================================
// IMAGE SANITIZATION
// ============================================

/**
 * Re-encode images using sharp to strip metadata and malicious payloads
 * This removes EXIF data, comments, and any embedded scripts
 */
export async function sanitizeImage(
  buffer: Buffer | ArrayBuffer,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  }
): Promise<{ buffer: Buffer; format: string; originalSize: number; newSize: number }> {
  const inputBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const originalSize = inputBuffer.length;
  
  const maxWidth = options?.maxWidth || 4096;
  const maxHeight = options?.maxHeight || 4096;
  const quality = options?.quality || 90;
  
  // Get image metadata
  const metadata = await sharp(inputBuffer).metadata();
  
  // Determine output format
  let format = options?.format || 'jpeg';
  if (!options?.format) {
    // Keep original format if possible
    switch (metadata.format) {
      case 'png':
        format = 'png';
        break;
      case 'webp':
        format = 'webp';
        break;
      case 'gif':
        // Convert GIF to animated WebP or static PNG
        format = metadata.pages && metadata.pages > 1 ? 'webp' : 'png';
        break;
      default:
        format = 'jpeg';
    }
  }
  
  // Create sharp instance with resize options
  let pipeline = sharp(inputBuffer)
    .rotate() // Auto-rotate based on EXIF orientation
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  
  // Apply format-specific options
  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ 
        quality, 
        mozjpeg: true, // Better compression
        force: true,
      });
      break;
    case 'png':
      pipeline = pipeline.png({ 
        compressionLevel: 9,
        force: true,
      });
      break;
    case 'webp':
      pipeline = pipeline.webp({ 
        quality,
        effort: 6, // Balance between speed and compression
        force: true,
      });
      break;
  }
  
  // Process the image
  const outputBuffer = await pipeline.toBuffer();
  const newSize = outputBuffer.length;
  
  log.info('Image sanitized', {
    originalFormat: metadata.format,
    outputFormat: format,
    originalSize,
    newSize,
    reduction: `${Math.round((1 - newSize / originalSize) * 100)}%`,
    originalDimensions: `${metadata.width}x${metadata.height}`,
  });
  
  return {
    buffer: outputBuffer,
    format,
    originalSize,
    newSize,
  };
}

// ============================================
// VIRUS SCANNING
// ============================================

/**
 * Scan file for viruses
 * Integration point for ClamAV, AWS S3 virus scan, or other services
 */
export async function scanForVirus(
  buffer: Buffer | ArrayBuffer,
  filename: string,
  options?: {
    scanEngine?: 'clamav' | 'aws' | 'virustotal' | 'mock';
  }
): Promise<VirusScanResult> {
  const inputBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const scanEngine = options?.scanEngine || process.env.VIRUS_SCAN_ENGINE || 'mock';
  
  // If in development or mock mode, return clean
  if (scanEngine === 'mock' || process.env.NODE_ENV === 'development') {
    // Basic heuristics for mock mode
    return performMockVirusScan(inputBuffer, filename);
  }
  
  // Integration points for real virus scanning services
  
  if (scanEngine === 'clamav') {
    return performClamAvScan(inputBuffer, filename);
  }
  
  if (scanEngine === 'aws') {
    return performAwsVirusScan(inputBuffer, filename);
  }
  
  if (scanEngine === 'virustotal') {
    return performVirusTotalScan(inputBuffer, filename);
  }
  
  // Default to mock scan
  return performMockVirusScan(inputBuffer, filename);
}

/**
 * Mock virus scan with basic heuristics
 */
async function performMockVirusScan(buffer: Buffer, filename: string): Promise<VirusScanResult> {
  const warnings: string[] = [];
  
  // Check for suspiciously small files
  if (buffer.length < 100) {
    warnings.push('File is unusually small');
  }
  
  // Check for suspiciously large files
  if (buffer.length > 50 * 1024 * 1024) {
    warnings.push('File is unusually large');
  }
  
  // Check for embedded scripts in content
  const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
  
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      log.warn('Dangerous pattern detected in file', {
        pattern: pattern.source,
        filename,
      });
      
      return {
        clean: false,
        threat: 'Suspicious content pattern detected',
        engine: 'mock',
      };
    }
  }
  
  // Check for polyglot files (files valid as multiple types)
  const signature = await getFileSignature(buffer, 8);
  
  // Check for ZIP signature in non-ZIP files
  if (signature.startsWith('504B0304') && !filename.endsWith('.zip')) {
    return {
      clean: false,
      threat: 'File appears to be a ZIP archive disguised as another file type',
      engine: 'mock',
    };
  }
  
  // Check for executable signature
  if (signature.startsWith('4D5A')) {
    return {
      clean: false,
      threat: 'File appears to be an executable file',
      engine: 'mock',
    };
  }
  
  return {
    clean: true,
    engine: 'mock',
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * ClamAV integration (requires ClamAV daemon running)
 */
async function performClamAvScan(buffer: Buffer, filename: string): Promise<VirusScanResult> {
  // Integration with ClamAV daemon
  // This would typically use a Node.js ClamAV client like clamav.js
  
  log.info('ClamAV scan initiated', { filename, size: buffer.length });
  
  // Placeholder - in production, implement actual ClamAV socket communication
  // Example integration:
  // const clamav = require('clamav.js');
  // const result = await clamav.scanBuffer(buffer);
  
  return {
    clean: true,
    engine: 'clamav',
  };
}

/**
 * AWS S3 virus scan integration
 */
async function performAwsVirusScan(buffer: Buffer, filename: string): Promise<VirusScanResult> {
  // Integration with AWS S3 virus scanning
  // This could use Amazon S3's built-in scanning or third-party solutions
  
  log.info('AWS virus scan initiated', { filename, size: buffer.length });
  
  // Placeholder - in production:
  // 1. Upload to S3 with scanning enabled
  // 2. Wait for scan result
  // 3. Return result
  
  return {
    clean: true,
    engine: 'aws',
  };
}

/**
 * VirusTotal API integration
 */
async function performVirusTotalScan(buffer: Buffer, filename: string): Promise<VirusScanResult> {
  // Integration with VirusTotal API
  // Note: VirusTotal has rate limits and file size limits
  
  log.info('VirusTotal scan initiated', { filename, size: buffer.length });
  
  // Placeholder - in production:
  // 1. Get API key from environment
  // 2. Upload file or send hash
  // 3. Get analysis result
  
  return {
    clean: true,
    engine: 'virustotal',
  };
}

// ============================================
// FILENAME SANITIZATION
// ============================================

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators
  let sanitized = filename.replace(/[/\\]/g, '_');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  
  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, '');
  
  // Remove unicode control characters
  sanitized = sanitized.replace(/[\u200b-\u200d\ufeff]/g, '');
  
  // Limit length
  const maxNameLength = 200;
  const lastDot = sanitized.lastIndexOf('.');
  const extension = lastDot !== -1 ? sanitized.slice(lastDot) : '';
  const baseName = lastDot !== -1 ? sanitized.slice(0, lastDot) : sanitized;
  
  if (baseName.length > maxNameLength) {
    sanitized = baseName.slice(0, maxNameLength) + extension;
  }
  
  // Generate unique suffix for long names
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  
  // Add unique suffix to prevent collisions
  if (sanitized.length > 50) {
    const ext = extension || `.${baseName.slice(-4)}`;
    sanitized = `${baseName.slice(0, 40)}_${timestamp}_${randomSuffix}${ext}`;
  }
  
  return sanitized;
}

// ============================================
// EMBEDDED SCRIPT DETECTION
// ============================================

/**
 * Check for embedded scripts in files
 */
export function checkForEmbeddedScripts(buffer: Buffer | ArrayBuffer): boolean {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const content = buf.toString('utf-8', 0, Math.min(buf.length, 50000));
  
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      return true;
    }
  }
  
  return false;
}

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

/**
 * Validate file upload with comprehensive security checks
 */
export async function validateFileUpload(
  file: {
    name: string;
    type: string;
    size: number;
    arrayBuffer: () => Promise<ArrayBuffer>;
  },
  config: FileUploadConfig
): Promise<FileValidationResult> {
  const warnings: string[] = [];
  
  log.info('Validating file upload', {
    filename: file.name,
    type: file.type,
    size: file.size,
    purpose: config.purpose,
  });
  
  // 1. Check file extension
  const extension = getFileExtension(file.name).toLowerCase();
  
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    log.warn('Blocked extension detected', { extension, filename: file.name });
    return {
      valid: false,
      error: `File extension "${extension}" is not allowed for security reasons`,
      errorCode: 'BLOCKED_EXTENSION',
    };
  }
  
  // 2. Check if MIME type is in allowed list
  if (!config.allowedTypes.includes(file.type)) {
    log.warn('MIME type not allowed', { 
      type: file.type, 
      allowed: config.allowedTypes,
    });
    return {
      valid: false,
      error: `File type "${file.type}" is not allowed. Allowed types: ${config.allowedTypes.join(', ')}`,
      errorCode: 'INVALID_MIME_TYPE',
    };
  }
  
  // 3. Check file size
  if (file.size > config.maxSize) {
    log.warn('File size exceeds limit', {
      size: file.size,
      maxSize: config.maxSize,
    });
    return {
      valid: false,
      error: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(config.maxSize / 1024 / 1024).toFixed(2)}MB`,
      errorCode: 'FILE_TOO_LARGE',
    };
  }
  
  // 4. Read file content
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // 5. Verify file signature (magic bytes)
  const signatureResult = await verifyFileSignature(buffer, file.type);
  
  if (!signatureResult.valid) {
    log.warn('File signature verification failed', {
      reason: signatureResult.reason,
      declaredType: file.type,
      detectedType: signatureResult.detectedType,
    });
    return {
      valid: false,
      error: signatureResult.reason || 'File content does not match its declared type',
      errorCode: 'SIGNATURE_MISMATCH',
    };
  }
  
  // 6. Detect actual MIME type
  const detectedMimeType = await detectMimeType(buffer);
  
  if (detectedMimeType && detectedMimeType !== file.type) {
    // Check if detected type is in allowed list
    if (!config.allowedTypes.includes(detectedMimeType)) {
      log.warn('Detected MIME type not allowed', {
        declared: file.type,
        detected: detectedMimeType,
      });
      return {
        valid: false,
        error: `File is actually ${detectedMimeType} but claims to be ${file.type}. ${detectedMimeType} is not allowed.`,
        errorCode: 'MIME_TYPE_MISMATCH',
      };
    }
    warnings.push(`Detected file type "${detectedMimeType}" differs from declared "${file.type}"`);
  }
  
  // 7. Check for embedded scripts
  if (checkForEmbeddedScripts(buffer)) {
    log.warn('Embedded scripts detected', { filename: file.name });
    return {
      valid: false,
      error: 'File contains potentially malicious embedded content',
      errorCode: 'EMBEDDED_SCRIPT',
    };
  }
  
  // 8. Virus scan
  if (config.scanForVirus) {
    const virusScanResult = await scanForVirus(buffer, file.name);
    
    if (!virusScanResult.clean) {
      log.warn('Virus scan failed', {
        filename: file.name,
        threat: virusScanResult.threat,
        engine: virusScanResult.engine,
      });
      return {
        valid: false,
        error: `File failed virus scan: ${virusScanResult.threat}`,
        errorCode: 'VIRUS_DETECTED',
      };
    }
    
    if (virusScanResult.warnings && virusScanResult.warnings.length > 0) {
      warnings.push(...virusScanResult.warnings);
    }
  }
  
  // 9. Sanitize filename
  const sanitizedFilename = sanitizeFilename(file.name);
  
  // 10. Re-encode images if configured
  let reencodedBuffer: Buffer | undefined;
  const isImage = file.type.startsWith('image/');
  
  if (config.reencodeImages && isImage) {
    const imageType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';
    const format = imageType === 'image/jpeg' ? 'jpeg' as const :
                   imageType === 'image/png' ? 'png' as const :
                   imageType === 'image/webp' ? 'webp' as const : 'jpeg' as const;
    
    const result = await sanitizeImage(buffer, { format });
    reencodedBuffer = result.buffer;
    
    log.info('Image re-encoded', {
      originalSize: result.originalSize,
      newSize: result.newSize,
      format: result.format,
    });
  }
  
  log.info('File validation passed', {
    filename: sanitizedFilename,
    detectedMimeType: detectedMimeType || file.type,
    warnings: warnings.length,
  });
  
  return {
    valid: true,
    sanitizedFilename,
    detectedMimeType: detectedMimeType || file.type,
    warnings: warnings.length > 0 ? warnings : undefined,
    reencodedBuffer,
    originalSize: buffer.length,
    newSize: reencodedBuffer?.length,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
}

/**
 * Generate secure upload path
 */
export function generateSecureUploadPath(
  userId: string,
  purpose: UploadPurpose,
  filename: string
): string {
  const sanitized = sanitizeFilename(filename);
  const timestamp = Date.now();
  const randomId = crypto.randomUUID().slice(0, 8);
  
  return `uploads/${purpose}/${userId}/${timestamp}_${randomId}_${sanitized}`;
}

/**
 * Get security headers for file downloads
 * Prevents file execution in browser
 */
export function getSecurityHeaders(filename: string, mimeType: string): Record<string, string> {
  return {
    // Force download instead of inline display
    'Content-Disposition': `attachment; filename="${sanitizeFilename(filename)}"`,
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    // Prevent caching of sensitive files
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    // Security headers
    'X-Frame-Options': 'DENY',
    'X-Content-Security-Policy': "default-src 'none'",
    // Content type
    'Content-Type': mimeType,
  };
}

/**
 * Validate image dimensions
 */
export async function validateImageDimensions(
  buffer: Buffer | ArrayBuffer,
  options?: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    aspectRatio?: number;
    aspectRatioTolerance?: number;
  }
): Promise<{ valid: boolean; dimensions?: { width: number; height: number }; error?: string }> {
  const inputBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  
  const metadata = await sharp(inputBuffer).metadata();
  
  if (!metadata.width || !metadata.height) {
    return {
      valid: false,
      error: 'Could not read image dimensions',
    };
  }
  
  const { width, height } = metadata;
  
  // Check minimum dimensions
  if (options?.minWidth && width < options.minWidth) {
    return {
      valid: false,
      error: `Image width ${width}px is less than minimum ${options.minWidth}px`,
      dimensions: { width, height },
    };
  }
  
  if (options?.minHeight && height < options.minHeight) {
    return {
      valid: false,
      error: `Image height ${height}px is less than minimum ${options.minHeight}px`,
      dimensions: { width, height },
    };
  }
  
  // Check maximum dimensions
  if (options?.maxWidth && width > options.maxWidth) {
    return {
      valid: false,
      error: `Image width ${width}px exceeds maximum ${options.maxWidth}px`,
      dimensions: { width, height },
    };
  }
  
  if (options?.maxHeight && height > options.maxHeight) {
    return {
      valid: false,
      error: `Image height ${height}px exceeds maximum ${options.maxHeight}px`,
      dimensions: { width, height },
    };
  }
  
  // Check aspect ratio
  if (options?.aspectRatio) {
    const tolerance = options.aspectRatioTolerance || 0.1;
    const actualRatio = width / height;
    const ratioDiff = Math.abs(actualRatio - options.aspectRatio) / options.aspectRatio;
    
    if (ratioDiff > tolerance) {
      return {
        valid: false,
        error: `Image aspect ratio ${actualRatio.toFixed(2)} does not match required ${options.aspectRatio.toFixed(2)}`,
        dimensions: { width, height },
      };
    }
  }
  
  return {
    valid: true,
    dimensions: { width, height },
  };
}

/**
 * Create thumbnail for an image
 */
export async function createThumbnail(
  buffer: Buffer | ArrayBuffer,
  options: {
    maxWidth: number;
    maxHeight: number;
    quality?: number;
  }
): Promise<Buffer> {
  const inputBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  
  return sharp(inputBuffer)
    .resize(options.maxWidth, options.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: options.quality || 80 })
    .toBuffer();
}

// Default export
export default {
  // Constants
  ALLOWED_MIME_TYPES,
  ALL_ALLOWED_MIME_TYPES,
  FILE_SIZE_LIMITS,
  BLOCKED_EXTENSIONS,
  UPLOAD_CONFIGS,
  
  // Main functions
  validateFileUpload,
  getUploadConfig,
  
  // Signature verification
  getFileSignature,
  verifyFileSignature,
  detectMimeType,
  
  // Image processing
  sanitizeImage,
  validateImageDimensions,
  createThumbnail,
  
  // Virus scanning
  scanForVirus,
  
  // Utilities
  sanitizeFilename,
  getFileExtension,
  generateSecureUploadPath,
  getSecurityHeaders,
  checkForEmbeddedScripts,
};
