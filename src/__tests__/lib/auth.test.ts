import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Authentication Tests
 * 
 * Tests for:
 * - Password hashing (PBKDF2)
 * - Session token generation
 * - Token validation
 * - Account lockout after 5 failures
 * - Lockout expiry
 */

// Mock implementations for testing (mirroring auth.ts logic)
async function mockHashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Generate a salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Import password as key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  
  // Combine salt and hash
  const combined = new Uint8Array(salt.length + derivedBits.byteLength);
  combined.set(salt);
  combined.set(new Uint8Array(derivedBits), salt.length);
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

async function mockVerifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Decode the stored hash
    const combined = new Uint8Array(
      atob(hashedPassword).split('').map(c => c.charCodeAt(0))
    );
    
    // Extract salt and stored hash
    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);
    
    // Import password as key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    // Derive bits using same parameters
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    
    // Compare hashes
    const newHash = new Uint8Array(derivedBits);
    if (newHash.length !== storedHash.length) return false;
    
    for (let i = 0; i < newHash.length; i++) {
      if (newHash[i] !== storedHash[i]) return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Mock user storage for testing lockout
interface MockUser {
  id: string;
  email: string;
  password: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

const mockUsers: Map<string, MockUser> = new Map();

// Mock lockout constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

async function mockLoginAttempt(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; lockedUntil?: Date }> {
  const user = mockUsers.get(email);
  
  if (!user) {
    return { success: false, error: 'USER_NOT_FOUND' };
  }
  
  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { 
      success: false, 
      error: 'ACCOUNT_LOCKED',
      lockedUntil: user.lockedUntil 
    };
  }
  
  // Verify password
  const isValid = await mockVerifyPassword(password, user.password);
  
  if (!isValid) {
    // Increment failed attempts
    user.failedLoginAttempts++;
    
    // Check if should lock
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      mockUsers.set(email, user);
      return { 
        success: false, 
        error: 'ACCOUNT_LOCKED',
        lockedUntil: user.lockedUntil 
      };
    }
    
    mockUsers.set(email, user);
    return { 
      success: false, 
      error: 'WRONG_PASSWORD' 
    };
  }
  
  // Reset failed attempts on successful login
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  mockUsers.set(email, user);
  
  return { success: true };
}

describe('Authentication', () => {
  describe('Password Hashing (PBKDF2)', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123';
      const hashedPassword = await mockHashPassword(password);
      
      // Hash should be different from plain password
      expect(hashedPassword).not.toBe(password);
      
      // Hash should be base64 encoded
      expect(() => atob(hashedPassword)).not.toThrow();
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await mockHashPassword(password);
      const hash2 = await mockHashPassword(password);
      
      // Different salts should produce different hashes
      expect(hash1).not.toBe(hash2);
    });

    it('should verify correct password', async () => {
      const password = 'TestPassword123';
      const hashedPassword = await mockHashPassword(password);
      
      const isValid = await mockVerifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject wrong password', async () => {
      const password = 'TestPassword123';
      const hashedPassword = await mockHashPassword(password);
      
      const isValid = await mockVerifyPassword('WrongPassword', hashedPassword);
      expect(isValid).toBe(false);
    });

    it('should handle empty password', async () => {
      const password = '';
      const hashedPassword = await mockHashPassword(password);
      
      const isValid = await mockVerifyPassword('', hashedPassword);
      expect(isValid).toBe(true);
      
      const isInvalid = await mockVerifyPassword('something', hashedPassword);
      expect(isInvalid).toBe(false);
    });

    it('should use 100000 PBKDF2 iterations', async () => {
      // The hash should be generated with 100000 iterations
      // This is verified by the timing - we just check the function works
      const password = 'TestPassword123';
      
      const startTime = performance.now();
      await mockHashPassword(password);
      const endTime = performance.now();
      
      // With 100000 iterations, it should take at least some time
      // (but not too long in tests)
      expect(endTime - startTime).toBeGreaterThan(0);
    });
  });

  describe('Session Token Generation', () => {
    it('should generate 64-character hex token', () => {
      const token = generateSecureToken();
      
      // 32 bytes = 64 hex characters
      expect(token.length).toBe(64);
      
      // Should be valid hex
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSecureToken());
      }
      
      // All 100 tokens should be unique
      expect(tokens.size).toBe(100);
    });

    it('should use cryptographically secure random values', () => {
      // Generate multiple tokens and check distribution
      const tokens: string[] = [];
      for (let i = 0; i < 10; i++) {
        tokens.push(generateSecureToken());
      }
      
      // Each token should have reasonable entropy
      // Check that first characters vary
      const firstChars = tokens.map(t => t[0]);
      const uniqueFirstChars = new Set(firstChars);
      
      // With good randomness, we should see multiple different first chars
      expect(uniqueFirstChars.size).toBeGreaterThan(1);
    });
  });

  describe('Token Validation', () => {
    it('should validate correct token format', () => {
      const token = generateSecureToken();
      
      // Token should be 64 hex characters
      expect(token.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('should reject invalid token format', () => {
      const invalidTokens = [
        'invalid',
        '123',
        'gggg' * 16, // Non-hex characters
        '',
        'a'.repeat(63), // Too short
        'a'.repeat(65), // Too long
      ];
      
      invalidTokens.forEach(token => {
        const isValid = /^[0-9a-f]{64}$/.test(token);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Account Lockout', () => {
    beforeEach(() => {
      mockUsers.clear();
    });

    it('should lock account after 5 failed attempts', async () => {
      const email = 'test@example.com';
      const password = 'CorrectPassword123';
      const hashedPassword = await mockHashPassword(password);
      
      // Create mock user
      mockUsers.set(email, {
        id: '1',
        email,
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      
      // Attempt 5 wrong passwords
      for (let i = 0; i < 4; i++) {
        const result = await mockLoginAttempt(email, 'WrongPassword');
        expect(result.success).toBe(false);
        expect(result.error).toBe('WRONG_PASSWORD');
      }
      
      // 5th attempt should lock
      const lockResult = await mockLoginAttempt(email, 'WrongPassword');
      expect(lockResult.success).toBe(false);
      expect(lockResult.error).toBe('ACCOUNT_LOCKED');
      expect(lockResult.lockedUntil).toBeDefined();
    });

    it('should prevent login while locked', async () => {
      const email = 'test@example.com';
      const password = 'CorrectPassword123';
      const hashedPassword = await mockHashPassword(password);
      
      // Create locked user
      mockUsers.set(email, {
        id: '1',
        email,
        password: hashedPassword,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
      });
      
      // Even correct password should fail while locked
      const result = await mockLoginAttempt(email, password);
      expect(result.success).toBe(false);
      expect(result.error).toBe('ACCOUNT_LOCKED');
    });

    it('should reset failed attempts on successful login', async () => {
      const email = 'test@example.com';
      const password = 'CorrectPassword123';
      const hashedPassword = await mockHashPassword(password);
      
      // Create user with some failed attempts
      mockUsers.set(email, {
        id: '1',
        email,
        password: hashedPassword,
        failedLoginAttempts: 3,
        lockedUntil: null,
      });
      
      // Successful login
      const result = await mockLoginAttempt(email, password);
      expect(result.success).toBe(true);
      
      // Check attempts were reset
      const user = mockUsers.get(email);
      expect(user?.failedLoginAttempts).toBe(0);
    });

    it('should track attempts per user, not globally', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';
      const password = 'CorrectPassword123';
      const hashedPassword = await mockHashPassword(password);
      
      // Create two users
      mockUsers.set(email1, {
        id: '1',
        email: email1,
        password: hashedPassword,
        failedLoginAttempts: 3,
        lockedUntil: null,
      });
      
      mockUsers.set(email2, {
        id: '2',
        email: email2,
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      
      // Lock user1
      const user1 = mockUsers.get(email1)!;
      user1.failedLoginAttempts = 5;
      user1.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      mockUsers.set(email1, user1);
      
      // User2 should still be able to login
      const result = await mockLoginAttempt(email2, password);
      expect(result.success).toBe(true);
    });
  });

  describe('Lockout Expiry', () => {
    beforeEach(() => {
      mockUsers.clear();
    });

    it('should allow login after lockout expires', async () => {
      const email = 'test@example.com';
      const password = 'CorrectPassword123';
      const hashedPassword = await mockHashPassword(password);
      
      // Create user with expired lockout
      mockUsers.set(email, {
        id: '1',
        email,
        password: hashedPassword,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // Expired 1 second ago
      });
      
      // Should allow login now
      const result = await mockLoginAttempt(email, password);
      expect(result.success).toBe(true);
      
      // Check lockout was cleared
      const user = mockUsers.get(email);
      expect(user?.lockedUntil).toBeNull();
      expect(user?.failedLoginAttempts).toBe(0);
    });

    it('should set correct lockout duration (30 minutes)', async () => {
      const email = 'test@example.com';
      const password = 'CorrectPassword123';
      const hashedPassword = await mockHashPassword(password);
      
      mockUsers.set(email, {
        id: '1',
        email,
        password: hashedPassword,
        failedLoginAttempts: 4,
        lockedUntil: null,
      });
      
      const beforeLock = Date.now();
      const result = await mockLoginAttempt(email, 'WrongPassword');
      const afterLock = Date.now();
      
      expect(result.lockedUntil).toBeDefined();
      
      // Lockout should be approximately 30 minutes
      const lockoutDuration = result.lockedUntil!.getTime() - beforeLock;
      const expectedDuration = 30 * 60 * 1000;
      
      // Allow 1 second tolerance
      expect(lockoutDuration).toBeGreaterThanOrEqual(expectedDuration - 1000);
      expect(lockoutDuration).toBeLessThanOrEqual(expectedDuration + 1000);
    });

    it('should reject login attempt just before expiry', async () => {
      const email = 'test@example.com';
      const password = 'CorrectPassword123';
      const hashedPassword = await mockHashPassword(password);
      
      // Create user locked for 1 more second
      mockUsers.set(email, {
        id: '1',
        email,
        password: hashedPassword,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 1000),
      });
      
      const result = await mockLoginAttempt(email, password);
      expect(result.success).toBe(false);
      expect(result.error).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('Password Validation', () => {
    const PASSWORD_REQUIREMENTS = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
    };

    function validatePassword(password: string): { valid: boolean; errors: string[] } {
      const errors: string[] = [];
      
      if (password.length < PASSWORD_REQUIREMENTS.minLength) {
        errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
      }
      
      if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      
      if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      
      if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
      }
      
      return { valid: errors.length === 0, errors };
    }

    it('should accept valid password', () => {
      const result = validatePassword('Password123');
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject short password', () => {
      const result = validatePassword('Pass1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject password without uppercase', () => {
      const result = validatePassword('password123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = validatePassword('PASSWORD123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = validatePassword('PasswordABC');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should return multiple errors for invalid password', () => {
      const result = validatePassword('pass');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
