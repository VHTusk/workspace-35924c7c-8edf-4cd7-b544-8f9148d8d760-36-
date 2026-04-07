'use client';

/**
 * VALORHIVE Sanitized HTML Component
 * 
 * Safely renders user-generated HTML content using DOMPurify.
 * Prevents XSS attacks while allowing formatted text.
 * 
 * @module components/ui/sanitized-html
 */

import React from 'react';
import { sanitizeHtml, sanitizeHtmlRich, isContentSafe } from '@/lib/sanitize';

// ============================================
// Types
// ============================================

interface SanitizedHtmlProps {
  /** The HTML content to render */
  html: string | null | undefined;
  
  /** Use rich mode (allows more tags like images, videos) */
  rich?: boolean;
  
  /** CSS class name for the container */
  className?: string;
  
  /** Maximum length before truncation */
  maxLength?: number;
  
  /** Show warning for potentially unsafe content */
  showWarning?: boolean;
  
  /** Custom fallback when content is empty */
  fallback?: React.ReactNode;
}

interface TruncatedHtmlProps extends SanitizedHtmlProps {
  /** Initial maximum characters to show */
  initialLength?: number;
  
  /** Expand button text */
  expandText?: string;
  
  /** Collapse button text */
  collapseText?: string;
}

// ============================================
// Components
// ============================================

/**
 * Renders sanitized HTML content
 * 
 * @example
 * ```tsx
 * <SanitizedHtml html={userBio} className="prose" />
 * <SanitizedHtml html={description} rich maxLength={500} />
 * ```
 */
export function SanitizedHtml({
  html,
  rich = false,
  className = '',
  maxLength,
  showWarning = false,
  fallback = null,
}: SanitizedHtmlProps): React.ReactElement {
  // Handle empty content
  if (!html || html.trim() === '') {
    return <>{fallback}</>;
  }
  
  // Check for potentially dangerous content
  if (showWarning && !isContentSafe(html)) {
    console.warn('[SanitizedHtml] Content contains potentially unsafe patterns');
  }
  
  // Sanitize the HTML
  let sanitized = rich ? sanitizeHtmlRich(html) : sanitizeHtml(html);
  
  // Truncate if needed
  if (maxLength && sanitized.length > maxLength) {
    // Strip HTML for truncation, then re-sanitize
    const stripped = sanitized.replace(/<[^>]*>/g, '');
    if (stripped.length > maxLength) {
      sanitized = sanitizeHtml(stripped.slice(0, maxLength - 3) + '...');
    }
  }
  
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

/**
 * Renders sanitized HTML with expand/collapse functionality
 * 
 * @example
 * ```tsx
 * <TruncatedHtml 
 *   html={longDescription} 
 *   initialLength={200}
 *   expandText="Show more"
 *   collapseText="Show less"
 * />
 * ```
 */
export function TruncatedHtml({
  html,
  rich = false,
  className = '',
  initialLength = 300,
  expandText = 'Show more',
  collapseText = 'Show less',
}: TruncatedHtmlProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  // Handle empty content
  if (!html || html.trim() === '') {
    return <div className={className} />;
  }
  
  // Sanitize the HTML
  const sanitized = rich ? sanitizeHtmlRich(html) : sanitizeHtml(html);
  
  // Check if truncation is needed
  const needsTruncation = sanitized.length > initialLength * 1.5;
  
  if (!needsTruncation) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }
  
  // Get truncated version
  const truncated = isExpanded
    ? sanitized
    : sanitizeHtml(
        sanitized
          .replace(/<[^>]*>/g, '')
          .slice(0, initialLength) + '...'
      );
  
  return (
    <div className={className}>
      <div dangerouslySetInnerHTML={{ __html: truncated }} />
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-2 text-sm text-primary hover:underline focus:outline-none"
      >
        {isExpanded ? collapseText : expandText}
      </button>
    </div>
  );
}

/**
 * Renders user-generated text with line breaks preserved
 * Escapes HTML and converts newlines to <br />
 * 
 * @example
 * ```tsx
 * <SanitizedText text={userComment} />
 * ```
 */
export function SanitizedText({
  text,
  className = '',
  maxLength,
}: {
  text: string | null | undefined;
  className?: string;
  maxLength?: number;
}): React.ReactElement {
  if (!text || text.trim() === '') {
    return <div className={className} />;
  }
  
  let processed = text;
  
  // Truncate if needed
  if (maxLength && processed.length > maxLength) {
    processed = processed.slice(0, maxLength - 3) + '...';
  }
  
  // Escape HTML and convert newlines
  const escaped = processed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\n/g, '<br />');
  
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: escaped }}
    />
  );
}

/**
 * Safe link component that validates URLs
 * 
 * @example
 * ```tsx
 * <SafeLink href={userProvidedUrl}>Click here</SafeLink>
 * ```
 */
export function SafeLink({
  href,
  children,
  className = '',
  ...props
}: {
  href: string | null | undefined;
  children: React.ReactNode;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>): React.ReactElement | null {
  // Validate and sanitize URL
  let sanitizedUrl = '';
  
  if (href) {
    try {
      // Only allow http, https, mailto, tel
      const parsed = new URL(href);
      const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
      
      if (safeProtocols.includes(parsed.protocol)) {
        sanitizedUrl = parsed.toString();
      }
    } catch {
      // Allow relative URLs
      if (href.startsWith('/') || href.startsWith('#')) {
        sanitizedUrl = href;
      }
    }
  }
  
  if (!sanitizedUrl) {
    return <span className={className}>{children}</span>;
  }
  
  return (
    <a
      href={sanitizedUrl}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  );
}

export default SanitizedHtml;
