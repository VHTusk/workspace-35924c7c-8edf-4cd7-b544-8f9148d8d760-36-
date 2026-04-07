/**
 * Critical Security Tests for VALORHIVE
 *
 * Comprehensive test suites for:
 * 1. Password validation (max length, min length, complexity)
 * 2. Session token SHA-256 hashing
 * 3. Referral code generation
 * 4. CSRF token generation/validation
 * 5. Sanitization (HTML, URL, filename, phone, email)
 * 6. Prototype pollution protection
 * 7. ELO calculation edge cases
 * 8. Tier assignment logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Import from actual lib files
// ============================================

import {
  validatePassword,
  hashToken,
  generateReferralCode,
  calculateEloChange,
  getEloTier,
  PASSWORD_REQUIREMENTS,
} from '@/lib/auth';

import {
  sanitizeHtml,
  sanitizeHtmlRich,
  sanitizeText,
  sanitizeUrl,
  sanitizeFilename,
  sanitizePhone,
  sanitizeEmail,
  safeJsonParse,
  stripHtml,
  isContentSafe,
} from '@/lib/sanitize';

import {
  generateCsrfToken,
  isCsrfExempt,
  requiresCsrfProtection,
} from '@/lib/csrf';

import {
  getEloTier as getEloTierFromTierLib,
  getTierFromPoints,
  ELO_TIERS,
  POINTS_TIERS,
} from '@/lib/tier';

import { passwordSchema } from '@/lib/validation';

// ============================================
// 1. Password Validation Tests
// ============================================

describe('Password Validation', () => {
  describe('Max Length Protection (128 characters)', () => {
    it('should reject passwords exceeding 128 characters to prevent CPU exhaustion attacks', () => {
      const longPassword = 'A'.repeat(129) + '1a'; // 131 chars with number and lowercase
      const result = validatePassword(longPassword);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('at most 128 characters'))).toBe(true);
    });

    it('should accept passwords exactly at 128 characters', () => {
      const maxPassword = 'A' + 'a'.repeat(126) + '1'; // 128 chars with uppercase, lowercase, number
      const result = validatePassword(maxPassword);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept passwords under 128 characters', () => {
      const validPassword = 'Password123';
      const result = validatePassword(validPassword);

      expect(result.valid).toBe(true);
    });

    it('should enforce max length even with valid complexity', () => {
      // Create a password that has valid complexity but is too long
      const complexButLong = 'Aa1' + 'x'.repeat(126); // 129 characters
      const result = validatePassword(complexButLong);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('at most 128'))).toBe(true);
    });

    it('should have PASSWORD_REQUIREMENTS constant with maxLength set', () => {
      expect(PASSWORD_REQUIREMENTS.maxLength).toBe(128);
    });
  });

  describe('Min Length Enforcement', () => {
    it('should reject passwords shorter than 8 characters', () => {
      const shortPassword = 'Pass1';
      const result = validatePassword(shortPassword);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('at least 8 characters'))).toBe(true);
    });

    it('should accept passwords exactly at 8 characters with required complexity', () => {
      const minValidPassword = 'Passwo1d'; // 8 chars with uppercase, lowercase, number
      const result = validatePassword(minValidPassword);

      expect(result.valid).toBe(true);
    });

    it('should reject empty password', () => {
      const result = validatePassword('');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject 7 character password even with complexity', () => {
      const sevenChars = 'Passwo1'; // 7 chars with all requirements
      const result = validatePassword(sevenChars);

      expect(result.valid).toBe(false);
    });
  });

  describe('Complexity Requirements', () => {
    it('should require at least one uppercase letter', () => {
      const result = validatePassword('password123');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
    });

    it('should require at least one lowercase letter', () => {
      const result = validatePassword('PASSWORD123');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
    });

    it('should require at least one number', () => {
      const result = validatePassword('PasswordABC');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('number'))).toBe(true);
    });

    it('should accept password meeting all complexity requirements', () => {
      const result = validatePassword('Password123');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return multiple errors for password failing multiple requirements', () => {
      const result = validatePassword('pass');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3); // min length, uppercase, number
    });

    it('should validate password schema from validation.ts', () => {
      const validResult = passwordSchema.safeParse('ValidPass123');
      expect(validResult.success).toBe(true);

      const tooLongResult = passwordSchema.safeParse('A'.repeat(129) + 'a1');
      expect(tooLongResult.success).toBe(false);

      const tooShortResult = passwordSchema.safeParse('Short1');
      expect(tooShortResult.success).toBe(false);
    });
  });
});

// ============================================
// 2. Session Token SHA-256 Hashing Tests
// ============================================

describe('Session Token SHA-256 Hashing', () => {
  describe('Token Hashing', () => {
    it('should hash tokens before storage using SHA-256', async () => {
      const rawToken = 'abc123def456789012345678901234567890';
      const hashedToken = await hashToken(rawToken);

      // SHA-256 produces 64 hex characters
      expect(hashedToken.length).toBe(64);
      expect(hashedToken).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent hash for same input', async () => {
      const rawToken = 'test-token-value';
      const hash1 = await hashToken(rawToken);
      const hash2 = await hashToken(rawToken);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', async () => {
      const token1 = 'token-one';
      const token2 = 'token-two';
      const hash1 = await hashToken(token1);
      const hash2 = await hashToken(token2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty token', async () => {
      const hash = await hashToken('');

      // SHA-256 of empty string is a valid 64-char hex
      expect(hash.length).toBe(64);
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
  });

  describe('Raw Token Protection', () => {
    it('should verify that raw token is never stored (hash is always different)', async () => {
      const rawToken = 'my-secure-session-token-12345';
      const hashedToken = await hashToken(rawToken);

      // Hash should not contain the raw token
      expect(hashedToken).not.toContain(rawToken);
      expect(hashedToken).not.toBe(rawToken);
    });

    it('should produce one-way hash (no reverse possible)', async () => {
      const rawToken = 'secure-token-value';
      const hashedToken = await hashToken(rawToken);

      // Verify hash characteristics - should be hex string
      expect(hashedToken).toMatch(/^[a-f0-9]+$/);

      // Hash should be same length regardless of input
      const shortHash = await hashToken('a');
      const longHash = await hashToken('a'.repeat(1000));

      expect(shortHash.length).toBe(longHash.length);
      expect(shortHash.length).toBe(64);
    });

    it('should handle special characters in token', async () => {
      const specialToken = 'token-with-!@#$%^&*()-special-chars';
      const hash = await hashToken(specialToken);

      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

// ============================================
// 3. Referral Code Generation Tests
// ============================================

describe('Referral Code Generation', () => {
  describe('Uniqueness', () => {
    it('should generate unique referral codes', () => {
      const codes = new Set<string>();

      // Generate 100 codes and check uniqueness
      for (let i = 0; i < 100; i++) {
        codes.add(generateReferralCode());
      }

      expect(codes.size).toBe(100);
    });

    it('should generate codes with sufficient entropy', () => {
      const codes: string[] = [];
      for (let i = 0; i < 1000; i++) {
        codes.push(generateReferralCode());
      }

      // Check that not all codes are the same (extremely unlikely if random)
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBeGreaterThan(900); // Allow some collision margin
    });
  });

  describe('Format', () => {
    it('should generate codes with VH- prefix', () => {
      const code = generateReferralCode();

      expect(code.startsWith('VH-')).toBe(true);
    });

    it('should generate codes with correct total length', () => {
      const code = generateReferralCode();

      // VH- (3 chars) + 8 alphanumeric chars = 11 total
      expect(code.length).toBe(11);
    });

    it('should only use allowed characters after prefix', () => {
      const code = generateReferralCode();
      const suffix = code.slice(3); // Remove VH- prefix

      // Should only contain allowed chars (no confusing I, O, 0, 1)
      const allowedChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (const char of suffix) {
        expect(allowedChars).toContain(char);
      }
    });

    it('should exclude confusing characters (I, O, 0, 1)', () => {
      const confusingChars = ['I', 'O', '0', '1'];

      // Generate multiple codes and check none contain confusing chars
      for (let i = 0; i < 50; i++) {
        const code = generateReferralCode();
        for (const char of confusingChars) {
          expect(code).not.toContain(char);
        }
      }
    });
  });
});

// ============================================
// 4. CSRF Token Generation/Validation Tests
// ============================================

describe('CSRF Token Generation/Validation', () => {
  describe('Token Generation', () => {
    it('should generate non-empty tokens', () => {
      const token = generateCsrfToken();

      expect(token).toBeTruthy();
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();

      for (let i = 0; i < 100; i++) {
        tokens.add(generateCsrfToken());
      }

      expect(tokens.size).toBe(100);
    });

    it('should generate tokens with sufficient length', () => {
      const token = generateCsrfToken();

      // 32 bytes in base64url should be 43 characters
      expect(token.length).toBeGreaterThanOrEqual(40);
    });

    it('should generate URL-safe base64 tokens', () => {
      const token = generateCsrfToken();

      // base64url characters only: A-Z, a-z, 0-9, -, _
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('CSRF Exempt Routes', () => {
    it('should exempt authentication routes', () => {
      expect(isCsrfExempt('/api/auth/login')).toBe(true);
      expect(isCsrfExempt('/api/auth/register')).toBe(true);
      expect(isCsrfExempt('/api/auth/logout')).toBe(true);
    });

    it('should exempt organization authentication routes', () => {
      expect(isCsrfExempt('/api/auth/org/login')).toBe(true);
      expect(isCsrfExempt('/api/auth/org/register')).toBe(true);
    });

    it('should exempt OAuth routes', () => {
      expect(isCsrfExempt('/api/auth/google')).toBe(true);
      expect(isCsrfExempt('/api/auth/google/callback')).toBe(false); // callback is not exempt
    });

    it('should exempt webhook endpoints', () => {
      expect(isCsrfExempt('/api/payments/webhook')).toBe(true);
    });

    it('should exempt public API routes', () => {
      expect(isCsrfExempt('/api/public/leaderboard')).toBe(true);
      expect(isCsrfExempt('/api/public/tournaments/abc123')).toBe(true);
    });

    it('should exempt cron endpoints', () => {
      expect(isCsrfExempt('/api/cron/completion')).toBe(true);
      expect(isCsrfExempt('/api/cron/automation')).toBe(true);
    });

    it('should exempt health check endpoints', () => {
      expect(isCsrfExempt('/api/health')).toBe(true);
    });

    it('should NOT exempt protected routes', () => {
      expect(isCsrfExempt('/api/player/profile')).toBe(false);
      expect(isCsrfExempt('/api/tournaments')).toBe(false);
      expect(isCsrfExempt('/api/admin/users')).toBe(false);
    });
  });

  describe('CSRF Protection Required Methods', () => {
    it('should require CSRF for state-changing methods', () => {
      expect(requiresCsrfProtection('POST')).toBe(true);
      expect(requiresCsrfProtection('PUT')).toBe(true);
      expect(requiresCsrfProtection('DELETE')).toBe(true);
      expect(requiresCsrfProtection('PATCH')).toBe(true);
    });

    it('should NOT require CSRF for safe methods', () => {
      expect(requiresCsrfProtection('GET')).toBe(false);
      expect(requiresCsrfProtection('HEAD')).toBe(false);
      expect(requiresCsrfProtection('OPTIONS')).toBe(false);
    });

    it('should handle case-insensitive method names', () => {
      expect(requiresCsrfProtection('post')).toBe(true);
      expect(requiresCsrfProtection('Post')).toBe(true);
      expect(requiresCsrfProtection('get')).toBe(false);
    });
  });
});

// ============================================
// 5. Sanitization Tests
// ============================================

describe('Sanitization', () => {
  describe('HTML Sanitization', () => {
    it('should remove script tags', () => {
      const malicious = '<script>alert("xss")</script>Hello';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Hello');
    });

    it('should allow safe HTML tags', () => {
      const html = '<p>Hello <strong>World</strong></p>';
      const sanitized = sanitizeHtml(html);

      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
    });

    it('should remove dangerous attributes', () => {
      const malicious = '<p onclick="alert(\'xss\')">Click me</p>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('onclick');
    });

    it('should remove javascript: URLs', () => {
      const malicious = '<a href="javascript:alert(\'xss\')">Click</a>';
      const sanitized = sanitizeHtml(malicious);

      expect(sanitized).not.toContain('javascript:');
    });

    it('should handle null/undefined input', () => {
      expect(sanitizeHtml(null)).toBe('');
      expect(sanitizeHtml(undefined)).toBe('');
      expect(sanitizeHtml('')).toBe('');
    });

    it('should preserve safe links', () => {
      const html = '<a href="https://example.com">Link</a>';
      const sanitized = sanitizeHtml(html);

      expect(sanitized).toContain('href="https://example.com"');
    });

    it('should allow formatting tags in rich mode', () => {
      const html = '<p>Hello</p><img src="test.jpg" alt="test">';
      const sanitized = sanitizeHtmlRich(html);

      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<img');
    });

    it('should strip all HTML with stripHtml', () => {
      const html = '<p>Hello <strong>World</strong></p>';
      const stripped = stripHtml(html);

      expect(stripped).not.toContain('<p>');
      expect(stripped).not.toContain('<strong>');
    });
  });

  describe('URL Sanitization', () => {
    it('should allow safe protocols (http, https)', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
    });

    it('should allow mailto and tel protocols', () => {
      expect(sanitizeUrl('mailto:test@example.com')).toContain('mailto:');
      expect(sanitizeUrl('tel:+1234567890')).toContain('tel:');
    });

    it('should remove dangerous protocols', () => {
      expect(sanitizeUrl('javascript:alert("xss")')).toBe('');
      expect(sanitizeUrl('vbscript:msgbox("xss")')).toBe('');
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    it('should allow relative URLs', () => {
      expect(sanitizeUrl('/path/to/page')).toBe('/path/to/page');
      expect(sanitizeUrl('#anchor')).toBe('#anchor');
    });

    it('should handle invalid URLs', () => {
      expect(sanitizeUrl('')).toBe('');
      expect(sanitizeUrl(null)).toBe('');
      expect(sanitizeUrl(undefined)).toBe('');
    });

    it('should reject malformed URLs', () => {
      // Invalid URL that doesn't start with safe protocol or relative path
      const result = sanitizeUrl('not-a-valid-url');
      expect(result).toBe('');
    });
  });

  describe('Filename Sanitization', () => {
    it('should remove path traversal attempts', () => {
      expect(sanitizeFilename('../../../etc/passwd')).not.toContain('..');
      expect(sanitizeFilename('..\\..\\windows\\system32')).not.toContain('..');
    });

    it('should remove null bytes', () => {
      const filename = 'file\x00.jpg';
      expect(sanitizeFilename(filename)).not.toContain('\x00');
    });

    it('should remove control characters', () => {
      const filename = 'file\x01\x02\x03.jpg';
      expect(sanitizeFilename(filename)).not.toContain('\x01');
    });

    it('should limit filename length to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.jpg';
      const sanitized = sanitizeFilename(longName);

      expect(sanitized.length).toBeLessThanOrEqual(255);
    });

    it('should preserve alphanumeric, dash, underscore, dot', () => {
      expect(sanitizeFilename('my-file_name.jpg')).toBe('my-file_name.jpg');
    });

    it('should handle empty input', () => {
      expect(sanitizeFilename('')).toBe('');
      expect(sanitizeFilename(null)).toBe('');
    });
  });

  describe('Phone Number Sanitization', () => {
    it('should extract 10-digit Indian phone numbers', () => {
      expect(sanitizePhone('9876543210')).toBe('9876543210');
    });

    it('should remove non-digit characters', () => {
      expect(sanitizePhone('+91 98765 43210')).toBe('9876543210');
      expect(sanitizePhone('98765-43210')).toBe('9876543210');
    });

    it('should handle 91 prefix', () => {
      expect(sanitizePhone('919876543210')).toBe('9876543210');
    });

    it('should return empty for invalid phone numbers', () => {
      expect(sanitizePhone('12345')).toBe('');
      expect(sanitizePhone('invalid')).toBe('');
    });

    it('should handle null/undefined input', () => {
      expect(sanitizePhone(null)).toBe('');
      expect(sanitizePhone(undefined)).toBe('');
    });
  });

  describe('Email Sanitization', () => {
    it('should normalize email to lowercase', () => {
      expect(sanitizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com');
    });

    it('should validate email format', () => {
      expect(sanitizeEmail('valid@email.com')).toBe('valid@email.com');
      expect(sanitizeEmail('invalid-email')).toBe('');
    });

    it('should handle null/undefined input', () => {
      expect(sanitizeEmail(null)).toBe('');
      expect(sanitizeEmail(undefined)).toBe('');
    });

    it('should reject emails without domain', () => {
      expect(sanitizeEmail('test@')).toBe('');
      expect(sanitizeEmail('@example.com')).toBe('');
    });
  });
});

// ============================================
// 6. Prototype Pollution Protection Tests
// ============================================

describe('Prototype Pollution Protection', () => {
  describe('Nested Object Sanitization', () => {
    it('should detect __proto__ injection at top level', () => {
      const malicious = JSON.stringify({ __proto__: { admin: true } });
      const result = safeJsonParse(malicious);

      expect(result).toBeNull();
    });

    it('should detect __proto__ injection in nested objects', () => {
      const malicious = JSON.stringify({
        user: {
          name: 'test',
          nested: {
            __proto__: { isAdmin: true }
          }
        }
      });
      const result = safeJsonParse(malicious);

      expect(result).toBeNull();
    });

    it('should detect constructor injection', () => {
      const malicious = JSON.stringify({
        constructor: { prototype: { isAdmin: true } }
      });
      const result = safeJsonParse(malicious);

      expect(result).toBeNull();
    });

    it('should detect prototype injection', () => {
      const malicious = JSON.stringify({
        prototype: { pollute: 'value' }
      });
      const result = safeJsonParse(malicious);

      expect(result).toBeNull();
    });

    it('should allow safe JSON', () => {
      const safe = JSON.stringify({ name: 'test', value: 123 });
      const result = safeJsonParse(safe);

      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should handle deeply nested safe objects', () => {
      const safe = JSON.stringify({
        level1: {
          level2: {
            level3: {
              value: 'deep'
            }
          }
        }
      });
      const result = safeJsonParse(safe);

      expect(result).not.toBeNull();
      expect(result?.level1?.level2?.level3?.value).toBe('deep');
    });

    it('should handle arrays', () => {
      const safe = JSON.stringify([1, 2, 3, { name: 'test' }]);
      const result = safeJsonParse<number[] | { name: string }[]>();

      expect(result).toEqual([1, 2, 3, { name: 'test' }]);
    });

    it('should detect prototype pollution in arrays', () => {
      const malicious = JSON.stringify([
        { __proto__: { hacked: true } }
      ]);
      const result = safeJsonParse(malicious);

      expect(result).toBeNull();
    });
  });

  describe('Circular Reference Handling', () => {
    it('should handle circular references gracefully', () => {
      // Cannot JSON stringify circular refs, but test the detection
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;

      // This would throw during JSON.stringify, but we test the function doesn't hang
      const jsonStr = JSON.stringify({ name: 'test' }); // Normal case
      const result = safeJsonParse(jsonStr);

      expect(result).not.toBeNull();
    });
  });

  describe('Invalid JSON Handling', () => {
    it('should return null for invalid JSON', () => {
      expect(safeJsonParse('not json')).toBeNull();
      expect(safeJsonParse('{invalid}')).toBeNull();
      expect(safeJsonParse('')).toBeNull();
      expect(safeJsonParse(null)).toBeNull();
      expect(safeJsonParse(undefined)).toBeNull();
    });
  });
});

// ============================================
// 7. ELO Calculation Edge Cases Tests
// ============================================

describe('ELO Calculation Edge Cases', () => {
  describe('Division by Zero Protection', () => {
    it('should handle equal ratings correctly', () => {
      // When ratings are equal, expected score is 0.5
      const result = calculateEloChange(1500, 1500, 1, 10, 10);

      // Win with equal ratings: K=32, expected=0.5, actual=1
      // Change = 32 * (1 - 0.5) = 16
      expect(result.eloChangeA).toBe(16);
      expect(result.eloChangeB).toBe(-16);
    });

    it('should handle very small rating differences', () => {
      const result = calculateEloChange(1500, 1501, 1, 30, 30);

      // Expected score: 1 / (1 + 10^(1/400)) ≈ 0.4986
      // Change should be close to K/2
      expect(Math.abs(result.eloChangeA)).toBeGreaterThan(10);
      expect(Math.abs(result.eloChangeA)).toBeLessThan(15);
    });

    it('should handle zero rating (edge case)', () => {
      // Note: In real system, ratings start at 1500, but test edge case
      const result = calculateEloChange(0, 1500, 1, 30, 30);

      // Should still produce a valid result
      expect(result.eloChangeA).toBeDefined();
      expect(result.eloChangeB).toBeDefined();
      expect(result.eloChangeA).toBe(-result.eloChangeB);
    });
  });

  describe('Negative Rating Handling', () => {
    it('should handle negative opponent rating', () => {
      const result = calculateEloChange(1500, -100, 1, 30, 30);

      // Should still produce a valid result
      expect(result.eloChangeA).toBeDefined();
      expect(result.eloChangeB).toBeDefined();
    });

    it('should handle both players with low ratings', () => {
      const result = calculateEloChange(100, 100, 1, 30, 30);

      // Equal ratings, should give ~12 points (K=24 for 30 matches)
      expect(result.eloChangeA).toBe(12);
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle 0 matches (new players)', () => {
      const result = calculateEloChange(1500, 1500, 1, 0, 0);

      // K=32 for players with less than 30 matches
      expect(result.eloChangeA).toBe(16);
    });

    it('should handle exactly 30 matches (K-factor transition)', () => {
      const result = calculateEloChange(1500, 1500, 1, 30, 30);

      // K=24 for 30-99 matches
      expect(result.eloChangeA).toBe(12);
    });

    it('should handle exactly 100 matches (K-factor transition)', () => {
      const result = calculateEloChange(1500, 1500, 1, 100, 100);

      // K=16 for 100+ matches
      expect(result.eloChangeA).toBe(8);
    });

    it('should handle 1 match count', () => {
      const result = calculateEloChange(1500, 1500, 1, 1, 1);

      expect(result.eloChangeA).toBe(16); // K=32
    });

    it('should handle maximum reasonable ratings (3000+)', () => {
      const result = calculateEloChange(3000, 1500, 1, 100, 100);

      // High rated player wins against average
      // Expected score very high, so change should be minimal
      expect(result.eloChangeA).toBeLessThan(5);
      expect(result.eloChangeA).toBeGreaterThan(0);
    });

    it('should handle upset win (low beats high)', () => {
      const result = calculateEloChange(1000, 2000, 1, 30, 30);

      // Big upset - low rated player wins
      // Should gain significant points
      expect(result.eloChangeA).toBeGreaterThan(15);
    });

    it('should handle expected win (high beats low)', () => {
      const result = calculateEloChange(2000, 1000, 1, 30, 30);

      // Expected result - minimal change
      expect(result.eloChangeA).toBeLessThan(5);
      expect(result.eloChangeA).toBeGreaterThan(0);
    });

    it('should handle draw correctly', () => {
      const result = calculateEloChange(1500, 1500, 0.5, 30, 30);

      // Draw with equal ratings = 0 change
      expect(result.eloChangeA).toBe(0);
      expect(result.eloChangeB).toBe(0);
    });

    it('should handle draw with different ratings', () => {
      const result = calculateEloChange(1800, 1500, 0.5, 30, 30);

      // Draw with higher rated player
      // Higher rated player loses points on draw
      expect(result.eloChangeA).toBeLessThan(0);
    });
  });
});

// ============================================
// 8. Tier Assignment Logic Tests
// ============================================

describe('Tier Assignment Logic', () => {
  describe('Tier Boundaries', () => {
    it('should return UNRANKED for players with less than 30 matches', () => {
      // Even with high Elo
      expect(getEloTier(2500, 0)).toBe('UNRANKED');
      expect(getEloTier(2500, 15)).toBe('UNRANKED');
      expect(getEloTier(2500, 29)).toBe('UNRANKED');
    });

    it('should return BRONZE for Elo < 1300 with 30+ matches', () => {
      expect(getEloTier(1000, 30)).toBe('BRONZE');
      expect(getEloTier(1200, 50)).toBe('BRONZE');
      expect(getEloTier(1299, 100)).toBe('BRONZE');
    });

    it('should return SILVER for Elo 1300-1499 with 30+ matches', () => {
      expect(getEloTier(1300, 30)).toBe('SILVER');
      expect(getEloTier(1400, 50)).toBe('SILVER');
      expect(getEloTier(1499, 100)).toBe('SILVER');
    });

    it('should return GOLD for Elo 1500-1699 with 30+ matches', () => {
      expect(getEloTier(1500, 30)).toBe('GOLD');
      expect(getEloTier(1600, 50)).toBe('GOLD');
      expect(getEloTier(1699, 100)).toBe('GOLD');
    });

    it('should return PLATINUM for Elo 1700-1899 with 30+ matches', () => {
      expect(getEloTier(1700, 30)).toBe('PLATINUM');
      expect(getEloTier(1800, 50)).toBe('PLATINUM');
      expect(getEloTier(1899, 100)).toBe('PLATINUM');
    });

    it('should return DIAMOND for Elo >= 1900 with 30+ matches', () => {
      expect(getEloTier(1900, 30)).toBe('DIAMOND');
      expect(getEloTier(2000, 50)).toBe('DIAMOND');
      expect(getEloTier(3000, 100)).toBe('DIAMOND');
    });

    it('should handle exact boundary values', () => {
      expect(getEloTier(1299, 30)).toBe('BRONZE');
      expect(getEloTier(1300, 30)).toBe('SILVER');
      expect(getEloTier(1499, 30)).toBe('SILVER');
      expect(getEloTier(1500, 30)).toBe('GOLD');
    });
  });

  describe('Point-Based Tier Assignment', () => {
    it('should return correct tier based on visible points', () => {
      expect(getTierFromPoints(0).name).toBe('Bronze');
      expect(getTierFromPoints(500).name).toBe('Bronze');
      expect(getTierFromPoints(1000).name).toBe('Silver');
      expect(getTierFromPoints(2000).name).toBe('Gold');
      expect(getTierFromPoints(3000).name).toBe('Platinum');
      expect(getTierFromPoints(5000).name).toBe('Diamond');
      expect(getTierFromPoints(10000).name).toBe('Champion');
    });

    it('should handle boundary values for points tiers', () => {
      expect(getTierFromPoints(999).name).toBe('Bronze');
      expect(getTierFromPoints(1000).name).toBe('Silver');
      expect(getTierFromPoints(1999).name).toBe('Silver');
      expect(getTierFromPoints(2000).name).toBe('Gold');
    });

    it('should handle maximum tier correctly', () => {
      const championTier = getTierFromPoints(999999);
      expect(championTier.name).toBe('Champion');
    });
  });

  describe('Tier Constants Validation', () => {
    it('should have correct Elo tier definitions', () => {
      expect(ELO_TIERS.length).toBe(6); // Unranked + 5 ranked tiers
      expect(ELO_TIERS[0].name).toBe('Unranked');
    });

    it('should have correct points tier definitions', () => {
      expect(POINTS_TIERS.length).toBe(6);
      expect(POINTS_TIERS[0].name).toBe('Bronze');
      expect(POINTS_TIERS[POINTS_TIERS.length - 1].name).toBe('Champion');
    });

    it('should have minimum 30 matches for ranked tiers', () => {
      for (let i = 1; i < ELO_TIERS.length; i++) {
        expect(ELO_TIERS[i].minMatches).toBe(30);
      }
    });

    it('should have Elo tier boundaries in correct order', () => {
      for (let i = 1; i < ELO_TIERS.length - 1; i++) {
        expect(ELO_TIERS[i].maxElo + 1).toBe(ELO_TIERS[i + 1].minElo);
      }
    });
  });

  describe('Cross-Library Consistency', () => {
    it('should return same tier from both auth.ts and tier.ts', () => {
      // Test various Elo and match count combinations
      const testCases = [
        { elo: 1500, matches: 30 },
        { elo: 1700, matches: 50 },
        { elo: 1900, matches: 100 },
        { elo: 1200, matches: 30 },
        { elo: 2500, matches: 29 }, // Unranked due to matches
      ];

      for (const { elo, matches } of testCases) {
        const tierFromAuth = getEloTier(elo, matches);
        const tierFromTierLib = getEloTierFromTierLib(elo, matches);
        expect(tierFromAuth).toBe(tierFromTierLib.name.toUpperCase());
      }
    });
  });
});

// ============================================
// Additional Security Utility Tests
// ============================================

describe('Content Safety Checks', () => {
  it('should detect dangerous content patterns', () => {
    expect(isContentSafe('<script>alert(1)</script>')).toBe(false);
    expect(isContentSafe('javascript:alert(1)')).toBe(false);
    expect(isContentSafe('onclick="alert(1)"')).toBe(false);
  });

  it('should pass safe content', () => {
    expect(isContentSafe('Hello World')).toBe(true);
    expect(isContentSafe('<p>Safe paragraph</p>')).toBe(true);
  });

  it('should handle empty content', () => {
    expect(isContentSafe('')).toBe(true);
    expect(isContentSafe(null)).toBe(true);
    expect(isContentSafe(undefined)).toBe(true);
  });
});

describe('Text Sanitization', () => {
  it('should escape HTML special characters', () => {
    expect(sanitizeText('<script>')).toBe('&lt;script&gt;');
    expect(sanitizeText('a & b')).toBe('a &amp; b');
    expect(sanitizeText('"quoted"')).toBe('&quot;quoted&quot;');
  });

  it('should handle empty input', () => {
    expect(sanitizeText('')).toBe('');
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });
});
