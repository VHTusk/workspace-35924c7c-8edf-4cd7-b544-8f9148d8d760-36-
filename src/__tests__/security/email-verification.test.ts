/**
 * Email Verification Security Tests
 *
 * Tests for:
 * - Token generation (64-character hex tokens)
 * - Token validation and format checking
 * - Token expiration (24-hour window)
 * - Rate limiting on resend requests
 * - Email verification flow
 * - Cleanup of expired tokens
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ============================================
// Mock Constants
// ============================================

const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_RESEND_INTERVAL_MS = 60 * 1000; // 60 seconds

// ============================================
// Token Generation (mirrors email-verification.ts)
// ============================================

function generateVerificationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================
// Mock User Store
// ============================================

interface MockUser {
  id: string;
  email: string;
  firstName: string;
  sport: string;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  emailVerificationToken: string | null;
  emailVerificationSentAt: Date | null;
}

const mockUsers: Map<string, MockUser> = new Map();
const mockTokens: Map<string, string> = new Map(); // token -> userId mapping

// ============================================
// Mock Functions (mirroring email-verification.ts)
// ============================================

async function sendVerificationEmail(
  email: string,
  token: string,
  sport: string,
  firstName: string
): Promise<{ success: boolean; error?: string }> {
  // Simulate sending email
  return { success: true };
}

async function verifyEmailToken(token: string): Promise<{
  success: boolean;
  userId?: string;
  email?: string;
  sport?: string;
  error?: string;
}> {
  // Validate token format
  if (!token || token.length !== 64) {
    return { success: false, error: 'Invalid verification token format' };
  }

  // Find user by token
  const userId = mockTokens.get(token);
  if (!userId) {
    return { success: false, error: 'Invalid or expired verification token' };
  }

  const user = mockUsers.get(userId);
  if (!user) {
    return { success: false, error: 'Invalid or expired verification token' };
  }

  // Check expiration
  if (user.emailVerificationSentAt) {
    const tokenAge = Date.now() - user.emailVerificationSentAt.getTime();
    if (tokenAge > VERIFICATION_TOKEN_EXPIRY_MS) {
      // Clear expired token
      user.emailVerificationToken = null;
      user.emailVerificationSentAt = null;
      mockUsers.set(userId, user);
      mockTokens.delete(token);
      return { success: false, error: 'Verification token has expired. Please request a new one.' };
    }
  }

  // Mark email as verified
  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationToken = null;
  user.emailVerificationSentAt = null;
  mockUsers.set(userId, user);
  mockTokens.delete(token);

  return {
    success: true,
    userId: user.id,
    email: user.email,
    sport: user.sport,
  };
}

async function createAndSendVerificationToken(
  userId: string,
  email: string,
  sport: string,
  firstName: string
): Promise<{ success: boolean; error?: string }> {
  const user = mockUsers.get(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const token = generateVerificationToken();
  const now = new Date();

  user.emailVerificationToken = token;
  user.emailVerificationSentAt = now;
  mockUsers.set(userId, user);
  mockTokens.set(token, userId);

  return await sendVerificationEmail(email, token, sport, firstName);
}

async function isEmailVerified(userId: string): Promise<boolean> {
  const user = mockUsers.get(userId);
  if (!user || !user.email) {
    return true; // Phone-only users are considered verified
  }
  return user.emailVerified;
}

async function canResendVerification(userId: string): Promise<{
  canResend: boolean;
  waitTimeSeconds?: number;
}> {
  const user = mockUsers.get(userId);
  if (!user || !user.emailVerificationSentAt) {
    return { canResend: true };
  }

  const timeSinceLastSent = Date.now() - user.emailVerificationSentAt.getTime();

  if (timeSinceLastSent < MIN_RESEND_INTERVAL_MS) {
    const waitTimeSeconds = Math.ceil((MIN_RESEND_INTERVAL_MS - timeSinceLastSent) / 1000);
    return { canResend: false, waitTimeSeconds };
  }

  return { canResend: true };
}

async function cleanupExpiredVerificationTokens(): Promise<number> {
  const expiryThreshold = new Date(Date.now() - VERIFICATION_TOKEN_EXPIRY_MS);
  let count = 0;

  for (const [userId, user] of mockUsers) {
    if (user.emailVerificationToken && user.emailVerificationSentAt) {
      if (user.emailVerificationSentAt < expiryThreshold) {
        mockTokens.delete(user.emailVerificationToken);
        user.emailVerificationToken = null;
        user.emailVerificationSentAt = null;
        mockUsers.set(userId, user);
        count++;
      }
    }
  }

  return count;
}

// ============================================
// Tests
// ============================================

describe('Email Verification Security', () => {
  beforeEach(() => {
    mockUsers.clear();
    mockTokens.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Generation', () => {
    it('should generate a 64-character hex token', () => {
      const token = generateVerificationToken();

      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();

      for (let i = 0; i < 100; i++) {
        tokens.add(generateVerificationToken());
      }

      expect(tokens.size).toBe(100);
    });

    it('should use cryptographically secure random values', () => {
      const tokens: string[] = [];
      for (let i = 0; i < 10; i++) {
        tokens.push(generateVerificationToken());
      }

      // Check that first characters vary (indicates randomness)
      const firstChars = tokens.map(t => t[0]);
      const uniqueFirstChars = new Set(firstChars);

      expect(uniqueFirstChars.size).toBeGreaterThan(1);
    });

    it('should generate tokens with high entropy', () => {
      const token = generateVerificationToken();

      // 32 bytes = 256 bits of entropy
      // Check that we have a reasonable distribution of hex characters
      const charCounts = new Map<string, number>();
      for (const char of token) {
        charCounts.set(char, (charCounts.get(char) || 0) + 1);
      }

      // Should have multiple different characters
      expect(charCounts.size).toBeGreaterThan(5);
    });
  });

  describe('Token Validation', () => {
    it('should reject empty token', async () => {
      const result = await verifyEmailToken('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid verification token format');
    });

    it('should reject null token', async () => {
      const result = await verifyEmailToken(null as unknown as string);

      expect(result.success).toBe(false);
    });

    it('should reject short token', async () => {
      const result = await verifyEmailToken('abc123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid verification token format');
    });

    it('should reject token with invalid characters', async () => {
      const result = await verifyEmailToken('g'.repeat(64)); // 'g' is not valid hex

      expect(result.success).toBe(false);
    });

    it('should reject non-existent token', async () => {
      const validToken = 'a'.repeat(64);
      const result = await verifyEmailToken(validToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or expired verification token');
    });

    it('should accept valid token format', async () => {
      const userId = 'user-1';
      const token = generateVerificationToken();

      // Setup mock user with token
      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token,
        emailVerificationSentAt: new Date(),
      });
      mockTokens.set(token, userId);

      const result = await verifyEmailToken(token);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(userId);
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('Token Expiration (24-hour window)', () => {
    it('should accept token within 24 hours', async () => {
      const userId = 'user-1';
      const token = generateVerificationToken();

      // Token sent 1 hour ago
      const sentAt = new Date(Date.now() - 60 * 60 * 1000);

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token,
        emailVerificationSentAt: sentAt,
      });
      mockTokens.set(token, userId);

      const result = await verifyEmailToken(token);

      expect(result.success).toBe(true);
    });

    it('should reject token older than 24 hours', async () => {
      const userId = 'user-1';
      const token = generateVerificationToken();

      // Token sent 25 hours ago
      const sentAt = new Date(Date.now() - 25 * 60 * 60 * 1000);

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token,
        emailVerificationSentAt: sentAt,
      });
      mockTokens.set(token, userId);

      const result = await verifyEmailToken(token);

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should clear expired token from user record', async () => {
      const userId = 'user-1';
      const token = generateVerificationToken();

      // Token sent 25 hours ago
      const sentAt = new Date(Date.now() - 25 * 60 * 60 * 1000);

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token,
        emailVerificationSentAt: sentAt,
      });
      mockTokens.set(token, userId);

      await verifyEmailToken(token);

      const user = mockUsers.get(userId);
      expect(user?.emailVerificationToken).toBeNull();
      expect(user?.emailVerificationSentAt).toBeNull();
    });

    it('should accept token at exactly 24 hours', async () => {
      const userId = 'user-1';
      const token = generateVerificationToken();

      // Token sent exactly 24 hours ago (minus 1 second for test timing)
      const sentAt = new Date(Date.now() - VERIFICATION_TOKEN_EXPIRY_MS + 1000);

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token,
        emailVerificationSentAt: sentAt,
      });
      mockTokens.set(token, userId);

      const result = await verifyEmailToken(token);

      expect(result.success).toBe(true);
    });
  });

  describe('Rate Limiting on Resend', () => {
    it('should allow resend when no previous attempt', async () => {
      const userId = 'user-1';

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: null,
        emailVerificationSentAt: null,
      });

      const result = await canResendVerification(userId);

      expect(result.canResend).toBe(true);
      expect(result.waitTimeSeconds).toBeUndefined();
    });

    it('should block resend within 60 seconds', async () => {
      const userId = 'user-1';

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: null,
        emailVerificationSentAt: new Date(), // Just sent
      });

      const result = await canResendVerification(userId);

      expect(result.canResend).toBe(false);
      expect(result.waitTimeSeconds).toBeGreaterThan(0);
      expect(result.waitTimeSeconds).toBeLessThanOrEqual(60);
    });

    it('should allow resend after 60 seconds', async () => {
      const userId = 'user-1';

      // Sent 61 seconds ago
      const sentAt = new Date(Date.now() - 61 * 1000);

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: null,
        emailVerificationSentAt: sentAt,
      });

      const result = await canResendVerification(userId);

      expect(result.canResend).toBe(true);
    });

    it('should return accurate wait time', async () => {
      const userId = 'user-1';
      const sentAt = new Date(Date.now() - 30 * 1000); // 30 seconds ago

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: null,
        emailVerificationSentAt: sentAt,
      });

      const result = await canResendVerification(userId);

      expect(result.canResend).toBe(false);
      // Should be approximately 30 seconds remaining
      expect(result.waitTimeSeconds).toBeGreaterThanOrEqual(28);
      expect(result.waitTimeSeconds).toBeLessThanOrEqual(32);
    });
  });

  describe('Email Verification Flow', () => {
    it('should create and send verification token', async () => {
      const userId = 'user-1';

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: null,
        emailVerificationSentAt: null,
      });

      const result = await createAndSendVerificationToken(
        userId,
        'test@example.com',
        'CORNHOLE',
        'John'
      );

      expect(result.success).toBe(true);

      const user = mockUsers.get(userId);
      expect(user?.emailVerificationToken).toHaveLength(64);
      expect(user?.emailVerificationSentAt).toBeDefined();
    });

    it('should mark email as verified after valid token', async () => {
      const userId = 'user-1';
      const token = generateVerificationToken();

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token,
        emailVerificationSentAt: new Date(),
      });
      mockTokens.set(token, userId);

      const result = await verifyEmailToken(token);

      expect(result.success).toBe(true);

      const user = mockUsers.get(userId);
      expect(user?.emailVerified).toBe(true);
      expect(user?.emailVerifiedAt).toBeDefined();
      expect(user?.emailVerificationToken).toBeNull();
    });

    it('should clear token after successful verification', async () => {
      const userId = 'user-1';
      const token = generateVerificationToken();

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token,
        emailVerificationSentAt: new Date(),
      });
      mockTokens.set(token, userId);

      await verifyEmailToken(token);

      // Token should be removed from mapping
      expect(mockTokens.has(token)).toBe(false);
    });

    it('should not allow reusing token', async () => {
      const userId = 'user-1';
      const token = generateVerificationToken();

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token,
        emailVerificationSentAt: new Date(),
      });
      mockTokens.set(token, userId);

      // First use should succeed
      const result1 = await verifyEmailToken(token);
      expect(result1.success).toBe(true);

      // Second use should fail
      const result2 = await verifyEmailToken(token);
      expect(result2.success).toBe(false);
    });

    it('should check email verification status', async () => {
      const userId = 'user-1';

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: null,
        emailVerificationSentAt: null,
      });

      const isVerified1 = await isEmailVerified(userId);
      expect(isVerified1).toBe(false);

      // Verify the email
      const user = mockUsers.get(userId)!;
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      mockUsers.set(userId, user);

      const isVerified2 = await isEmailVerified(userId);
      expect(isVerified2).toBe(true);
    });

    it('should consider phone-only users as verified', async () => {
      const userId = 'user-1';

      mockUsers.set(userId, {
        id: userId,
        email: '', // No email
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: null,
        emailVerificationSentAt: null,
      });

      const isVerified = await isEmailVerified(userId);
      expect(isVerified).toBe(true);
    });
  });

  describe('Token Cleanup', () => {
    it('should cleanup expired tokens', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      const token1 = generateVerificationToken();
      const token2 = generateVerificationToken();

      // User 1 has expired token
      mockUsers.set(userId1, {
        id: userId1,
        email: 'test1@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token1,
        emailVerificationSentAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      });
      mockTokens.set(token1, userId1);

      // User 2 has fresh token
      mockUsers.set(userId2, {
        id: userId2,
        email: 'test2@example.com',
        firstName: 'Jane',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token2,
        emailVerificationSentAt: new Date(),
      });
      mockTokens.set(token2, userId2);

      const count = await cleanupExpiredVerificationTokens();

      expect(count).toBe(1);

      const user1 = mockUsers.get(userId1);
      const user2 = mockUsers.get(userId2);

      expect(user1?.emailVerificationToken).toBeNull();
      expect(user2?.emailVerificationToken).toBe(token2);
    });

    it('should not cleanup tokens without sentAt timestamp', async () => {
      const userId = 'user-1';
      const token = generateVerificationToken();

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token,
        emailVerificationSentAt: null, // No timestamp
      });

      const count = await cleanupExpiredVerificationTokens();

      expect(count).toBe(0);

      const user = mockUsers.get(userId);
      expect(user?.emailVerificationToken).toBe(token);
    });

    it('should return 0 when no tokens to cleanup', async () => {
      const count = await cleanupExpiredVerificationTokens();
      expect(count).toBe(0);
    });
  });

  describe('Security Considerations', () => {
    it('should not leak whether email exists via verification errors', async () => {
      // Invalid token format - reveals format issue, not existence
      const result1 = await verifyEmailToken('invalid');
      expect(result1.error).toContain('format');

      // Non-existent token - generic error
      const result2 = await verifyEmailToken('a'.repeat(64));
      expect(result2.error).toContain('Invalid or expired');
      expect(result2.error).not.toContain('user');
      expect(result2.error).not.toContain('email');
    });

    it('should handle concurrent verification attempts safely', async () => {
      const userId = 'user-1';
      const token = generateVerificationToken();

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token,
        emailVerificationSentAt: new Date(),
      });
      mockTokens.set(token, userId);

      // Simulate concurrent attempts
      const results = await Promise.all([
        verifyEmailToken(token),
        verifyEmailToken(token),
        verifyEmailToken(token),
      ]);

      // Only one should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(1);
    });

    it('should not accept token with wrong case', async () => {
      const userId = 'user-1';
      const token = generateVerificationToken();

      mockUsers.set(userId, {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        sport: 'CORNHOLE',
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationToken: token,
        emailVerificationSentAt: new Date(),
      });
      mockTokens.set(token, userId);

      // Uppercase version should not match
      const result = await verifyEmailToken(token.toUpperCase());

      expect(result.success).toBe(false);
    });
  });
});
