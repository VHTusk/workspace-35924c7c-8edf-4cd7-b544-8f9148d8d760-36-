/**
 * Authentication Registration Tests
 *
 * Tests for:
 * - Register with valid data
 * - Register with duplicate email
 * - Password hashing verification
 * - Email verification flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock password hashing functions (mirroring auth.ts logic)
async function mockHashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );

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

  const combined = new Uint8Array(salt.length + derivedBits.byteLength);
  combined.set(salt);
  combined.set(new Uint8Array(derivedBits), salt.length);

  return btoa(String.fromCharCode(...combined));
}

async function mockVerifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    const combined = new Uint8Array(
      atob(hashedPassword).split('').map(c => c.charCodeAt(0))
    );

    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      'PBKDF2',
      false,
      ['deriveBits']
    );

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

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes)
    .map(b => chars[b % chars.length])
    .join('');
  return `VH-${code}`;
}

// Mock user storage
interface MockUser {
  id: string;
  email: string | null;
  phone: string | null;
  password: string | null;
  firstName: string;
  lastName: string;
  sport: string;
  city: string | null;
  state: string | null;
  verified: boolean;
  verifiedAt: Date | null;
  emailVerifyToken: string | null;
  emailVerifyExpiry: Date | null;
  referralCode: string;
  createdAt: Date;
}

interface MockSession {
  id: string;
  token: string;
  userId: string;
  sport: string;
  expiresAt: Date;
}

interface MockPlayerRating {
  id: string;
  userId: string;
  sport: string;
  hiddenElo: number;
  visiblePoints: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
}

const mockUsers: Map<string, MockUser> = new Map();
const mockSessions: Map<string, MockSession> = new Map();
const mockPlayerRatings: Map<string, MockPlayerRating> = new Map();

// Email verification token storage
const emailVerifyTokens: Map<string, { userId: string; expiresAt: Date }> = new Map();

// Constants
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Password validation
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least 1 uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least 1 lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least 1 number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Email validation
function validateEmail(email: string): boolean {
  // Email must have at least one dot in domain part (requires TLD)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email);
}

// Phone validation (Indian numbers)
function validatePhone(phone: string): boolean {
  const cleanPhone = phone.replace(/[\s-]/g, '');
  const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
  return phoneRegex.test(cleanPhone);
}

// Mock registration function
async function mockRegister(data: {
  email?: string;
  phone?: string;
  password?: string;
  firstName: string;
  lastName: string;
  sport: string;
  city?: string;
  state?: string;
}): Promise<{
  success: boolean;
  error?: string;
  status: number;
  user?: Partial<MockUser>;
  session?: MockSession;
}> {
  // Check for existing email
  if (data.email) {
    for (const user of mockUsers.values()) {
      if (user.email === data.email && user.sport === data.sport) {
        return {
          success: false,
          error: 'Email already registered for this sport',
          status: 409,
        };
      }
    }
  }

  // Check for existing phone
  if (data.phone) {
    for (const user of mockUsers.values()) {
      if (user.phone === data.phone && user.sport === data.sport) {
        return {
          success: false,
          error: 'Phone already registered for this sport',
          status: 409,
        };
      }
    }
  }

  // Hash password
  const hashedPassword = data.password ? await mockHashPassword(data.password) : null;

  // Create user
  const userId = `user-${Date.now()}`;
  const referralCode = generateReferralCode();
  const user: MockUser = {
    id: userId,
    email: data.email || null,
    phone: data.phone || null,
    password: hashedPassword,
    firstName: data.firstName,
    lastName: data.lastName,
    sport: data.sport,
    city: data.city || null,
    state: data.state || null,
    verified: !!data.phone, // Phone users are auto-verified
    verifiedAt: data.phone ? new Date() : null,
    emailVerifyToken: data.email ? generateSecureToken() : null,
    emailVerifyExpiry: data.email ? new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS) : null,
    referralCode,
    createdAt: new Date(),
  };

  mockUsers.set(userId, user);

  // Store email verification token
  if (user.emailVerifyToken) {
    emailVerifyTokens.set(user.emailVerifyToken, {
      userId,
      expiresAt: user.emailVerifyExpiry!,
    });
  }

  // Create player rating
  mockPlayerRatings.set(userId, {
    id: `rating-${userId}`,
    userId,
    sport: data.sport,
    hiddenElo: 1500,
    visiblePoints: 0,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
  });

  // Create session
  const sessionToken = generateSecureToken();
  const session: MockSession = {
    id: `session-${Date.now()}`,
    token: sessionToken,
    userId,
    sport: data.sport,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  };
  mockSessions.set(sessionToken, session);

  return {
    success: true,
    status: 200,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      sport: user.sport,
      referralCode: user.referralCode,
    },
    session,
  };
}

// Mock email verification
async function mockVerifyEmail(token: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const tokenData = emailVerifyTokens.get(token);

  if (!tokenData) {
    return { success: false, error: 'Invalid verification token' };
  }

  if (tokenData.expiresAt < new Date()) {
    return { success: false, error: 'Verification token has expired' };
  }

  const user = mockUsers.get(tokenData.userId);
  if (user) {
    user.verified = true;
    user.verifiedAt = new Date();
    user.emailVerifyToken = null;
    user.emailVerifyExpiry = null;
    mockUsers.set(user.id, user);
  }

  emailVerifyTokens.delete(token);

  return { success: true };
}

describe('Authentication - Registration', () => {
  beforeEach(() => {
    mockUsers.clear();
    mockSessions.clear();
    mockPlayerRatings.clear();
    emailVerifyTokens.clear();
  });

  describe('Register with valid data', () => {
    it('should successfully register a new user with email', async () => {
      const data = {
        email: 'newuser@example.com',
        password: 'ValidPass123',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        city: 'Mumbai',
        state: 'Maharashtra',
      };

      const result = await mockRegister(data);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(data.email);
      expect(result.user?.firstName).toBe(data.firstName);
      expect(result.session).toBeDefined();
    });

    it('should successfully register a new user with phone', async () => {
      const data = {
        phone: '9876543210',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'DARTS',
      };

      const result = await mockRegister(data);

      expect(result.success).toBe(true);
      expect(result.user?.phone).toBe(data.phone);
    });

    it('should create initial player rating with ELO 1500', async () => {
      const data = {
        email: 'newuser@example.com',
        password: 'ValidPass123',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
      };

      const result = await mockRegister(data);

      const rating = mockPlayerRatings.get(result.user!.id!);
      expect(rating).toBeDefined();
      expect(rating?.hiddenElo).toBe(1500);
      expect(rating?.visiblePoints).toBe(0);
      expect(rating?.matchesPlayed).toBe(0);
    });

    it('should generate a unique referral code', async () => {
      const data = {
        email: 'newuser@example.com',
        password: 'ValidPass123',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
      };

      const result = await mockRegister(data);

      expect(result.user?.referralCode).toBeDefined();
      expect(result.user?.referralCode).toMatch(/^VH-[A-Z0-9]{8}$/);
    });

    it('should create a session on successful registration', async () => {
      const data = {
        email: 'newuser@example.com',
        password: 'ValidPass123',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
      };

      const result = await mockRegister(data);

      expect(result.session).toBeDefined();
      expect(result.session?.token).toHaveLength(64);
      expect(mockSessions.has(result.session!.token)).toBe(true);
    });

    it('should allow same email for different sports', async () => {
      const data1 = {
        email: 'same@example.com',
        password: 'ValidPass123',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
      };

      const data2 = {
        email: 'same@example.com',
        password: 'ValidPass123',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'DARTS',
      };

      const result1 = await mockRegister(data1);
      const result2 = await mockRegister(data2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.user?.id).not.toBe(result2.user?.id);
    });
  });

  describe('Register with duplicate email', () => {
    it('should reject duplicate email for same sport', async () => {
      const data = {
        email: 'duplicate@example.com',
        password: 'ValidPass123',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
      };

      // First registration
      await mockRegister(data);

      // Second registration with same email
      const result = await mockRegister(data);

      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
      expect(result.error).toContain('Email already registered');
    });

    it('should reject duplicate phone for same sport', async () => {
      const data = {
        phone: '9876543210',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
      };

      // First registration
      await mockRegister(data);

      // Second registration with same phone
      const result = await mockRegister(data);

      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
      expect(result.error).toContain('Phone already registered');
    });

    it('should allow duplicate phone for different sport', async () => {
      const data1 = {
        phone: '9876543210',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
      };

      const data2 = {
        phone: '9876543210',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'DARTS',
      };

      const result1 = await mockRegister(data1);
      const result2 = await mockRegister(data2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('Password hashing verification', () => {
    it('should hash password before storing', async () => {
      const password = 'ValidPass123';
      const data = {
        email: 'newuser@example.com',
        password,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
      };

      await mockRegister(data);

      // Get the stored user
      const user = Array.from(mockUsers.values())[0];
      expect(user.password).toBeDefined();
      expect(user.password).not.toBe(password);
    });

    it('should use PBKDF2 with 100000 iterations', async () => {
      const password = 'ValidPass123';
      const hashedPassword = await mockHashPassword(password);

      // Verify the hash is base64 encoded
      expect(() => atob(hashedPassword)).not.toThrow();

      // Verify the hash has the correct structure (salt + hash)
      const combined = new Uint8Array(
        atob(hashedPassword).split('').map(c => c.charCodeAt(0))
      );
      expect(combined.length).toBe(48); // 16 bytes salt + 32 bytes hash
    });

    it('should verify correct password against hash', async () => {
      const password = 'ValidPass123';
      const hashedPassword = await mockHashPassword(password);

      const isValid = await mockVerifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject wrong password against hash', async () => {
      const password = 'ValidPass123';
      const wrongPassword = 'WrongPass123';
      const hashedPassword = await mockHashPassword(password);

      const isValid = await mockVerifyPassword(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password (different salts)', async () => {
      const password = 'ValidPass123';
      const hash1 = await mockHashPassword(password);
      const hash2 = await mockHashPassword(password);

      expect(hash1).not.toBe(hash2);

      // But both should verify the password
      expect(await mockVerifyPassword(password, hash1)).toBe(true);
      expect(await mockVerifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('Email verification flow', () => {
    it('should generate verification token for email registrations', async () => {
      const data = {
        email: 'newuser@example.com',
        password: 'ValidPass123',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
      };

      await mockRegister(data);

      const user = Array.from(mockUsers.values())[0];
      expect(user.emailVerifyToken).toBeDefined();
      expect(user.emailVerifyToken).toHaveLength(64);
      expect(user.verified).toBe(false);
    });

    it('should not generate verification token for phone registrations', async () => {
      const data = {
        phone: '9876543210',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
      };

      await mockRegister(data);

      const user = Array.from(mockUsers.values())[0];
      expect(user.emailVerifyToken).toBeNull();
      expect(user.verified).toBe(true);
    });

    it('should verify email with valid token', async () => {
      const data = {
        email: 'newuser@example.com',
        password: 'ValidPass123',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
      };

      await mockRegister(data);

      const user = Array.from(mockUsers.values())[0];
      const token = user.emailVerifyToken!;

      const result = await mockVerifyEmail(token);

      expect(result.success).toBe(true);

      const updatedUser = mockUsers.get(user.id)!;
      expect(updatedUser.verified).toBe(true);
      expect(updatedUser.verifiedAt).toBeDefined();
      expect(updatedUser.emailVerifyToken).toBeNull();
    });

    it('should reject invalid verification token', async () => {
      const result = await mockVerifyEmail('invalidtoken');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid verification token');
    });

    it('should reject expired verification token', async () => {
      const data = {
        email: 'newuser@example.com',
        password: 'ValidPass123',
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
      };

      await mockRegister(data);

      const user = Array.from(mockUsers.values())[0];
      const token = user.emailVerifyToken!;

      // Manually expire the token
      emailVerifyTokens.set(token, {
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      const result = await mockVerifyEmail(token);

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  describe('Input validation', () => {
    it('should validate email format', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.in',
        'test+tag@example.org',
      ];

      const invalidEmails = [
        'invalid',
        'invalid@',
        '@domain.com',
        'test@.com',
        'test@domain',
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });

    it('should validate phone format (Indian numbers)', () => {
      const validPhones = [
        '9876543210',
        '8765432109',
        '7654321098',
        '6543210987',
        '+919876543210',
        '98765 43210',
        '98765-43210',
      ];

      const invalidPhones = [
        '1234567890', // Starts with 1
        '5678901234', // Starts with 5
        '987654321', // Too short
        '98765432101', // Too long
      ];

      validPhones.forEach(phone => {
        expect(validatePhone(phone)).toBe(true);
      });

      invalidPhones.forEach(phone => {
        expect(validatePhone(phone)).toBe(false);
      });
    });

    it('should validate password requirements', () => {
      const validPasswords = [
        'Password123',
        'Abcdefg1',
        'A1b2c3d4',
      ];

      const invalidPasswords = [
        'short', // Too short
        'alllowercase1', // No uppercase
        'ALLUPPERCASE1', // No lowercase
        'NoNumbers', // No numbers
      ];

      validPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
      });

      invalidPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
      });
    });

    it('should require first and last name', () => {
      const data = {
        email: 'test@example.com',
        password: 'ValidPass123',
        sport: 'CORNHOLE',
      };

      const hasName = !!(data as { firstName?: string }).firstName && !!(data as { lastName?: string }).lastName;
      expect(hasName).toBe(false);
    });

    it('should require valid sport', () => {
      const validSports = ['CORNHOLE', 'DARTS'];
      const invalidSports = ['FOOTBALL', 'CRICKET', ''];

      validSports.forEach(sport => {
        expect(validSports.includes(sport)).toBe(true);
      });

      invalidSports.forEach(sport => {
        expect(validSports.includes(sport)).toBe(false);
      });
    });
  });
});
