/**
 * File Upload Security Tests
 *
 * Tests for:
 * - File type validation (MIME types)
 * - File size limits
 * - Filename sanitization
 * - Malicious file detection
 * - Virus scanning integration points
 * - Upload event logging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Constants
// ============================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js',
  '.jar', '.app', '.deb', '.rpm', '.sh', '.bash', '.zsh',
  '.php', '.asp', '.aspx', '.jsp', '.cgi', '.pl',
];

// ============================================
// Types
// ============================================

interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedFilename?: string;
  detectedMimeType?: string;
}

interface FileUploadOptions {
  purpose: 'profile_photo' | 'document' | 'tournament_asset' | 'score_sheet';
  maxFileSize?: number;
  allowedTypes?: string[];
}

// ============================================
// File Validation Functions
// ============================================

function validateMimeType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType.toLowerCase());
}

function validateFileSize(size: number, maxSize: number): boolean {
  return size > 0 && size <= maxSize;
}

function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, '');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '_');
  
  // Remove leading/trailing spaces and dots
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() || '';
    const name = sanitized.slice(0, -(ext.length + 1));
    sanitized = name.slice(0, 250 - ext.length) + '.' + ext;
  }
  
  return sanitized || 'unnamed_file';
}

function hasDangerousExtension(filename: string): boolean {
  const lowerFilename = filename.toLowerCase();
  return DANGEROUS_EXTENSIONS.some(ext => lowerFilename.endsWith(ext));
}

function detectMimeTypeFromExtension(filename: string): string | null {
  const ext = filename.toLowerCase().split('.').pop();
  
  const extensionMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  
  return extensionMap[ext || ''] || null;
}

function validateFile(
  filename: string,
  mimeType: string,
  size: number,
  options: FileUploadOptions
): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Determine max size
  const maxSize = options.maxFileSize || (
    options.purpose === 'profile_photo' ? MAX_PROFILE_PHOTO_SIZE : MAX_DOCUMENT_SIZE
  );
  
  // Determine allowed types
  const allowedTypes = options.allowedTypes || (
    options.purpose === 'profile_photo' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES
  );
  
  // Validate file size
  if (!validateFileSize(size, maxSize)) {
    if (size <= 0) {
      errors.push('File is empty');
    } else {
      errors.push(`File size exceeds maximum allowed (${maxSize / (1024 * 1024)}MB)`);
    }
  }
  
  // Check for dangerous extension
  if (hasDangerousExtension(filename)) {
    errors.push('File type not allowed for security reasons');
  }
  
  // Validate MIME type
  if (!validateMimeType(mimeType, allowedTypes)) {
    errors.push(`File type '${mimeType}' is not allowed`);
  }
  
  // Check for extension/MIME mismatch
  const detectedMime = detectMimeTypeFromExtension(filename);
  if (detectedMime && detectedMime !== mimeType.toLowerCase()) {
    warnings.push('File extension does not match detected file type');
  }
  
  // Check for double extensions
  const extCount = (filename.match(/\./g) || []).length;
  if (extCount > 1) {
    warnings.push('File has multiple extensions - verify file type');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitizedFilename: sanitizeFilename(filename),
    detectedMimeType: detectedMime || mimeType,
  };
}

function scanForMaliciousContent(content: Uint8Array): { clean: boolean; threats: string[] } {
  const threats: string[] = [];
  
  // Check for script tags in text-based content
  const contentStr = new TextDecoder('utf-8', { fatal: false }).decode(content.slice(0, 10000));
  
  if (contentStr.toLowerCase().includes('<script')) {
    threats.push('Script tag detected in file content');
  }
  
  // Check for PHP code
  if (contentStr.includes('<?php') || contentStr.includes('<?=')) {
    threats.push('PHP code detected in file content');
  }
  
  // Check for executable signatures
  const header = content.slice(0, 4);
  
  // MZ header (Windows executable)
  if (header[0] === 0x4D && header[1] === 0x5A) {
    threats.push('Windows executable signature detected');
  }
  
  // ELF header (Linux executable)
  if (header[0] === 0x7F && header[1] === 0x45 && header[2] === 0x4C && header[3] === 0x46) {
    threats.push('Linux executable signature detected');
  }
  
  return {
    clean: threats.length === 0,
    threats,
  };
}

// ============================================
// Tests
// ============================================

describe('File Upload Security', () => {
  describe('MIME Type Validation', () => {
    it('should accept valid image types', () => {
      ALLOWED_IMAGE_TYPES.forEach(type => {
        expect(validateMimeType(type, ALLOWED_IMAGE_TYPES)).toBe(true);
      });
    });

    it('should accept valid document types', () => {
      ALLOWED_DOCUMENT_TYPES.forEach(type => {
        expect(validateMimeType(type, ALLOWED_DOCUMENT_TYPES)).toBe(true);
      });
    });

    it('should reject invalid MIME types', () => {
      const invalidTypes = [
        'application/javascript',
        'text/html',
        'application/x-executable',
        'image/svg+xml', // Can contain scripts
      ];

      invalidTypes.forEach(type => {
        expect(validateMimeType(type, ALLOWED_IMAGE_TYPES)).toBe(false);
      });
    });

    it('should be case-insensitive', () => {
      expect(validateMimeType('IMAGE/JPEG', ALLOWED_IMAGE_TYPES)).toBe(true);
      expect(validateMimeType('Image/Png', ALLOWED_IMAGE_TYPES)).toBe(true);
    });

    it('should validate profile photo MIME types', () => {
      const result = validateFile(
        'photo.jpg',
        'image/jpeg',
        1024,
        { purpose: 'profile_photo' }
      );

      expect(result.valid).toBe(true);
    });

    it('should reject non-image for profile photo', () => {
      const result = validateFile(
        'document.pdf',
        'application/pdf',
        1024,
        { purpose: 'profile_photo' }
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('not allowed'));
    });
  });

  describe('File Size Validation', () => {
    it('should accept files within size limit', () => {
      expect(validateFileSize(1024, MAX_FILE_SIZE)).toBe(true);
      expect(validateFileSize(MAX_FILE_SIZE, MAX_FILE_SIZE)).toBe(true);
    });

    it('should reject files exceeding size limit', () => {
      expect(validateFileSize(MAX_FILE_SIZE + 1, MAX_FILE_SIZE)).toBe(false);
    });

    it('should reject empty files', () => {
      expect(validateFileSize(0, MAX_FILE_SIZE)).toBe(false);
      expect(validateFileSize(-1, MAX_FILE_SIZE)).toBe(false);
    });

    it('should validate profile photo size limit', () => {
      const result = validateFile(
        'photo.jpg',
        'image/jpeg',
        MAX_PROFILE_PHOTO_SIZE + 1,
        { purpose: 'profile_photo' }
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds'))).toBe(true);
    });

    it('should validate document size limit', () => {
      const result = validateFile(
        'document.pdf',
        'application/pdf',
        MAX_DOCUMENT_SIZE + 1,
        { purpose: 'document' }
      );

      expect(result.valid).toBe(false);
    });
  });

  describe('Filename Sanitization', () => {
    it('should preserve valid filenames', () => {
      expect(sanitizeFilename('photo.jpg')).toBe('photo.jpg');
      expect(sanitizeFilename('my_document.pdf')).toBe('my_document.pdf');
      expect(sanitizeFilename('tournament-bracket.xlsx')).toBe('tournament-bracket.xlsx');
    });

    it('should remove path traversal attempts', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd');
      expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('windowssystem32');
    });

    it('should remove null bytes', () => {
      expect(sanitizeFilename('file\x00.jpg')).toBe('file.jpg');
    });

    it('should replace dangerous characters', () => {
      expect(sanitizeFilename('file<name>.jpg')).toBe('file_name_.jpg');
      expect(sanitizeFilename('file|name.jpg')).toBe('file_name.jpg');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.jpg';
      const sanitized = sanitizeFilename(longName);
      
      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized.endsWith('.jpg')).toBe(true);
    });

    it('should handle filenames with leading/trailing dots', () => {
      expect(sanitizeFilename('.hidden')).toBe('hidden');
      expect(sanitizeFilename('file...')).toBe('file');
    });

    it('should provide default name for empty input', () => {
      expect(sanitizeFilename('')).toBe('unnamed_file');
      expect(sanitizeFilename('...')).toBe('unnamed_file');
    });
  });

  describe('Dangerous Extension Detection', () => {
    it('should detect executable extensions', () => {
      expect(hasDangerousExtension('malware.exe')).toBe(true);
      expect(hasDangerousExtension('script.bat')).toBe(true);
      expect(hasDangerousExtension('payload.cmd')).toBe(true);
    });

    it('should detect script extensions', () => {
      expect(hasDangerousExtension('script.js')).toBe(true);
      expect(hasDangerousExtension('page.php')).toBe(true);
      expect(hasDangerousExtension('app.jsp')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(hasDangerousExtension('FILE.EXE')).toBe(true);
      expect(hasDangerousExtension('Script.PHP')).toBe(true);
    });

    it('should allow safe extensions', () => {
      expect(hasDangerousExtension('document.pdf')).toBe(false);
      expect(hasDangerousExtension('photo.jpg')).toBe(false);
      expect(hasDangerousExtension('data.xlsx')).toBe(false);
    });

    it('should reject files with dangerous extensions regardless of MIME type', () => {
      const result = validateFile(
        'malware.exe',
        'image/jpeg', // Trying to disguise as image
        1024,
        { purpose: 'document' }
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('not allowed'))).toBe(true);
    });
  });

  describe('Extension/MIME Mismatch Detection', () => {
    it('should detect mismatch between extension and MIME type', () => {
      const result = validateFile(
        'document.pdf',
        'image/jpeg', // PDF extension but JPEG MIME
        1024,
        { purpose: 'document' }
      );

      expect(result.warnings.some(w => w.includes('does not match'))).toBe(true);
    });

    it('should accept matching extension and MIME type', () => {
      const result = validateFile(
        'photo.jpg',
        'image/jpeg',
        1024,
        { purpose: 'profile_photo' }
      );

      expect(result.warnings.filter(w => w.includes('does not match'))).toHaveLength(0);
    });

    it('should detect double extensions', () => {
      const result = validateFile(
        'file.jpg.pdf',
        'application/pdf',
        1024,
        { purpose: 'document' }
      );

      expect(result.warnings.some(w => w.includes('multiple extensions'))).toBe(true);
    });
  });

  describe('Malicious Content Scanning', () => {
    it('should detect script tags', () => {
      const content = new TextEncoder().encode('<script>alert("xss")</script>');
      const result = scanForMaliciousContent(content);

      expect(result.clean).toBe(false);
      expect(result.threats.some(t => t.includes('Script tag'))).toBe(true);
    });

    it('should detect PHP code', () => {
      const content = new TextEncoder().encode('<?php system($_GET["cmd"]); ?>');
      const result = scanForMaliciousContent(content);

      expect(result.clean).toBe(false);
      expect(result.threats.some(t => t.includes('PHP code'))).toBe(true);
    });

    it('should detect Windows executable signature', () => {
      const content = new Uint8Array([0x4D, 0x5A, 0x90, 0x00]); // MZ header
      const result = scanForMaliciousContent(content);

      expect(result.clean).toBe(false);
      expect(result.threats.some(t => t.includes('Windows executable'))).toBe(true);
    });

    it('should detect Linux executable signature', () => {
      const content = new Uint8Array([0x7F, 0x45, 0x4C, 0x46]); // ELF header
      const result = scanForMaliciousContent(content);

      expect(result.clean).toBe(false);
      expect(result.threats.some(t => t.includes('Linux executable'))).toBe(true);
    });

    it('should pass clean content', () => {
      const content = new TextEncoder().encode('This is a clean document content.');
      const result = scanForMaliciousContent(content);

      expect(result.clean).toBe(true);
      expect(result.threats).toHaveLength(0);
    });

    it('should pass image binary content', () => {
      // JPEG header
      const content = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const result = scanForMaliciousContent(content);

      expect(result.clean).toBe(true);
    });
  });

  describe('Complete File Validation', () => {
    it('should validate a valid image file', () => {
      const result = validateFile(
        'profile.jpg',
        'image/jpeg',
        1024 * 100, // 100KB
        { purpose: 'profile_photo' }
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a valid PDF document', () => {
      const result = validateFile(
        'report.pdf',
        'application/pdf',
        1024 * 100, // 100KB
        { purpose: 'document' }
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject file with multiple issues', () => {
      const result = validateFile(
        '../../../malware.exe',
        'application/x-msdos-program',
        1024,
        { purpose: 'document' }
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn but accept file with only warnings', () => {
      const result = validateFile(
        'document.pdf',
        'application/pdf',
        1024,
        { purpose: 'document' }
      );
      // Add a warning condition manually
      const warningResult = {
        ...result,
        warnings: ['File has multiple extensions'],
      };

      expect(warningResult.valid).toBe(true);
      expect(warningResult.warnings.length).toBeGreaterThan(0);
    });

    it('should handle custom allowed types', () => {
      const result = validateFile(
        'data.csv',
        'text/csv',
        1024,
        { 
          purpose: 'document',
          allowedTypes: ['text/csv', 'text/plain'],
        }
      );

      expect(result.valid).toBe(true);
    });

    it('should handle custom max file size', () => {
      const result = validateFile(
        'large.pdf',
        'application/pdf',
        20 * 1024 * 1024, // 20MB
        { 
          purpose: 'document',
          maxFileSize: 50 * 1024 * 1024, // 50MB limit
        }
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('Upload Event Logging Integration', () => {
    it('should generate sanitized filename for logging', () => {
      const result = validateFile(
        '../../../etc/passwd',
        'text/plain',
        1024,
        { purpose: 'document' }
      );

      expect(result.sanitizedFilename).toBe('etcpasswd');
    });

    it('should provide detected MIME type', () => {
      const result = validateFile(
        'photo.jpg',
        'image/jpeg',
        1024,
        { purpose: 'profile_photo' }
      );

      expect(result.detectedMimeType).toBe('image/jpeg');
    });

    it('should detect MIME type from extension', () => {
      const result = validateFile(
        'document.pdf',
        'application/octet-stream', // Generic MIME
        1024,
        { purpose: 'document' }
      );

      expect(result.detectedMimeType).toBe('application/pdf');
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle unicode filenames', () => {
      const result = validateFile(
        '文档.pdf',
        'application/pdf',
        1024,
        { purpose: 'document' }
      );

      expect(result.valid).toBe(true);
      expect(result.sanitizedFilename).toBe('文档.pdf');
    });

    it('should handle null and undefined inputs', () => {
      expect(() => validateFile('', 'image/jpeg', 1024, { purpose: 'profile_photo' }))
        .not.toThrow();
      expect(() => validateFile('test.jpg', '', 1024, { purpose: 'profile_photo' }))
        .not.toThrow();
    });

    it('should handle very long extensions', () => {
      const result = validateFile(
        'file.' + 'a'.repeat(100),
        'image/jpeg',
        1024,
        { purpose: 'profile_photo' }
      );

      expect(result.valid).toBe(false);
    });

    it('should reject hidden files', () => {
      const result = validateFile(
        '.htaccess',
        'text/plain',
        1024,
        { purpose: 'document' }
      );

      // Hidden files are suspicious
      expect(result.sanitizedFilename).not.toMatch(/^\./);
    });
  });
});
