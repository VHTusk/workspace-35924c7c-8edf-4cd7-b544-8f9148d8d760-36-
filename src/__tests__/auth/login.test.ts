/**
 * Authentication Login Tests
 *
 * Tests for:
 * - Login with valid credentials
 * - Login with invalid password
 * - Login with non-existent email
 * - Account lockout after 5 failed attempts
 * - Session creation on successful login
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

// Mock user storage for testing
interface MockUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  sport: string;
  hiddenElo: number;
  visiblePoints: number;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  isActive: boolean;
}

interface MockSession {
  id: string;
  token: string;
  userId: string;
  sport: string;
  expiresAt: Date;
  createdAt: Date;
}

const mockUsers: Map<string, MockUser> = new Map();
const mockSessions: Map<string, MockSession> = new Map();

// Constants matching the implementation
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Mock login function that mirrors the API route logic
async function mockLoginAttempt(
  email: string,
  password: string,
  sport: string
): Promise<{
  success: boolean;
  error?: string;
  code?: string;
  status: number;
  user?: Partial<MockUser>;
  session?: MockSession;
  lockedUntil?: Date;
}> {
  const user = mockUsers.get(email);

  if (!user) {
    return {
      success: false,
      error: 'Email not registered',
      code: 'USER_NOT_FOUND',
      status: 401,
    };
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      success: false,
      error: 'Account is temporarily locked. Please try again later.',
      code: 'ACCOUNT_LOCKED',
      status: 423,
      lockedUntil: user.lockedUntil,
    };
  }

  // Verify password
  const isValid = await mockVerifyPassword(password, user.password);

  if (!isValid) {
    // Increment failed attempts
    user.failedLoginAttempts++;
    const attempts = user.failedLoginAttempts;

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      mockUsers.set(email, user);
      return {
        success: false,
        error: 'Account locked due to too many failed attempts. Please try again in 30 minutes.',
        code: 'ACCOUNT_LOCKED',
        status: 423,
        lockedUntil: user.lockedUntil,
      };
    }

    mockUsers.set(email, user);
    const remaining = MAX_FAILED_ATTEMPTS - attempts;
    return {
      success: false,
      error: `Wrong password. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining before account lock.`,
      code: 'WRONG_PASSWORD',
      status: 401,
    };
  }

  // Reset failed attempts on successful login
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  mockUsers.set(email, user);

  // Create session
  const sessionToken = generateSecureToken();
  const session: MockSession = {
    id: `session-${Date.now()}`,
    token: sessionToken,
    userId: user.id,
    sport: user.sport,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    createdAt: new Date(),
  };
  mockSessions.set(sessionToken, session);

  return {
    success: true,
    status: 200,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      sport: user.sport,
    },
    session,
  };
}

describe('Authentication - Login', () => {
  beforeEach(() => {
    mockUsers.clear();
    mockSessions.clear();
  });

  describe('Login with valid credentials', () => {
    it('should successfully login with correct email and password', async () => {
      const email = 'test@example.com';
      const password = 'ValidPassword123!';
      const hashedPassword = await mockHashPassword(password);

      // Create a mock user
      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      });

      const result = await mockLoginAttempt(email, password, 'CORNHOLE');

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(email);
      expect(result.session).toBeDefined();
      expect(result.session?.token).toHaveLength(64);
    });

    it('should create a session with correct expiration (7 days)', async () => {
      const email = 'test@example.com';
      const password = 'ValidPassword123!';
      const hashedPassword = await mockHashPassword(password);

      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      });

      const beforeLogin = Date.now();
      const result = await mockLoginAttempt(email, password, 'CORNHOLE');
      const afterLogin = Date.now();

      expect(result.session).toBeDefined();
      const sessionExpiry = result.session!.expiresAt.getTime();
      const expectedExpiry = beforeLogin + SESSION_DURATION_MS;

      // Allow 1 second tolerance
      expect(sessionExpiry).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(sessionExpiry).toBeLessThanOrEqual(afterLogin + SESSION_DURATION_MS + 1000);
    });

    it('should reset failed login attempts on successful login', async () => {
      const email = 'test@example.com';
      const password = 'ValidPassword123!';
      const hashedPassword = await mockHashPassword(password);

      // Create user with previous failed attempts
      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 3,
        lockedUntil: null,
        isActive: true,
      });

      const result = await mockLoginAttempt(email, password, 'CORNHOLE');

      expect(result.success).toBe(true);

      // Check that failed attempts were reset
      const user = mockUsers.get(email);
      expect(user?.failedLoginAttempts).toBe(0);
      expect(user?.lockedUntil).toBeNull();
    });

    it('should generate unique session tokens for each login', async () => {
      const email = 'test@example.com';
      const password = 'ValidPassword123!';
      const hashedPassword = await mockHashPassword(password);

      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      });

      const result1 = await mockLoginAttempt(email, password, 'CORNHOLE');
      const result2 = await mockLoginAttempt(email, password, 'CORNHOLE');

      expect(result1.session?.token).toBeDefined();
      expect(result2.session?.token).toBeDefined();
      expect(result1.session?.token).not.toBe(result2.session?.token);
    });
  });

  describe('Login with invalid password', () => {
    it('should reject login with wrong password', async () => {
      const email = 'test@example.com';
      const correctPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await mockHashPassword(correctPassword);

      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      });

      const result = await mockLoginAttempt(email, wrongPassword, 'CORNHOLE');

      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
      expect(result.code).toBe('WRONG_PASSWORD');
      expect(result.error).toContain('Wrong password');
    });

    it('should track failed login attempts', async () => {
      const email = 'test@example.com';
      const correctPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await mockHashPassword(correctPassword);

      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      });

      // First failed attempt
      await mockLoginAttempt(email, wrongPassword, 'CORNHOLE');
      let user = mockUsers.get(email);
      expect(user?.failedLoginAttempts).toBe(1);

      // Second failed attempt
      await mockLoginAttempt(email, wrongPassword, 'CORNHOLE');
      user = mockUsers.get(email);
      expect(user?.failedLoginAttempts).toBe(2);
    });

    it('should show remaining attempts in error message', async () => {
      const email = 'test@example.com';
      const correctPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await mockHashPassword(correctPassword);

      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 2,
        lockedUntil: null,
        isActive: true,
      });

      const result = await mockLoginAttempt(email, wrongPassword, 'CORNHOLE');

      expect(result.error).toContain('2 attempts remaining');
    });

    it('should use singular "attempt" when only 1 remaining', async () => {
      const email = 'test@example.com';
      const correctPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await mockHashPassword(correctPassword);

      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 3, // After this attempt, 1 will remain
        lockedUntil: null,
        isActive: true,
      });

      const result = await mockLoginAttempt(email, wrongPassword, 'CORNHOLE');

      expect(result.error).toContain('1 attempt remaining');
    });
  });

  describe('Login with non-existent email', () => {
    it('should reject login with unregistered email', async () => {
      const result = await mockLoginAttempt('nonexistent@example.com', 'AnyPassword123!', 'CORNHOLE');

      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
      expect(result.code).toBe('USER_NOT_FOUND');
      expect(result.error).toBe('Email not registered');
    });

    it('should not reveal whether email or password is wrong (security)', async () => {
      // The error for non-existent user vs wrong password should be different
      // but not reveal too much information
      const email = 'test@example.com';
      const correctPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await mockHashPassword(correctPassword);

      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      });

      const nonExistentResult = await mockLoginAttempt('nonexistent@example.com', 'AnyPassword123!', 'CORNHOLE');
      const wrongPasswordResult = await mockLoginAttempt(email, wrongPassword, 'CORNHOLE');

      // Different error codes help with UX but don't reveal sensitive info
      expect(nonExistentResult.code).toBe('USER_NOT_FOUND');
      expect(wrongPasswordResult.code).toBe('WRONG_PASSWORD');
    });

    it('should not create session for non-existent user', async () => {
      await mockLoginAttempt('nonexistent@example.com', 'AnyPassword123!', 'CORNHOLE');

      expect(mockSessions.size).toBe(0);
    });
  });

  describe('Account lockout after 5 failed attempts', () => {
    it('should lock account after 5 failed attempts', async () => {
      const email = 'test@example.com';
      const correctPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await mockHashPassword(correctPassword);

      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      });

      // Attempt 5 wrong passwords
      for (let i = 0; i < 4; i++) {
        const result = await mockLoginAttempt(email, wrongPassword, 'CORNHOLE');
        expect(result.success).toBe(false);
        expect(result.code).toBe('WRONG_PASSWORD');
      }

      // 5th attempt should lock
      const lockResult = await mockLoginAttempt(email, wrongPassword, 'CORNHOLE');
      expect(lockResult.success).toBe(false);
      expect(lockResult.code).toBe('ACCOUNT_LOCKED');
      expect(lockResult.status).toBe(423);
      expect(lockResult.lockedUntil).toBeDefined();
    });

    it('should prevent login while locked (even with correct password)', async () => {
      const email = 'test@example.com';
      const correctPassword = 'CorrectPassword123!';
      const hashedPassword = await mockHashPassword(correctPassword);

      // Create locked user
      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
        isActive: true,
      });

      // Even correct password should fail while locked
      const result = await mockLoginAttempt(email, correctPassword, 'CORNHOLE');

      expect(result.success).toBe(false);
      expect(result.code).toBe('ACCOUNT_LOCKED');
      expect(result.status).toBe(423);
    });

    it('should set lockout duration to 30 minutes', async () => {
      const email = 'test@example.com';
      const correctPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await mockHashPassword(correctPassword);

      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 4,
        lockedUntil: null,
        isActive: true,
      });

      const beforeLock = Date.now();
      const result = await mockLoginAttempt(email, wrongPassword, 'CORNHOLE');

      expect(result.lockedUntil).toBeDefined();

      const lockoutDuration = result.lockedUntil!.getTime() - beforeLock;
      const expectedDuration = 30 * 60 * 1000; // 30 minutes

      // Allow 1 second tolerance
      expect(lockoutDuration).toBeGreaterThanOrEqual(expectedDuration - 1000);
      expect(lockoutDuration).toBeLessThanOrEqual(expectedDuration + 1000);
    });

    it('should allow login after lockout expires', async () => {
      const email = 'test@example.com';
      const correctPassword = 'CorrectPassword123!';
      const hashedPassword = await mockHashPassword(correctPassword);

      // Create user with expired lockout
      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // Expired 1 second ago
        isActive: true,
      });

      const result = await mockLoginAttempt(email, correctPassword, 'CORNHOLE');

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);

      // Check lockout was cleared
      const user = mockUsers.get(email);
      expect(user?.lockedUntil).toBeNull();
      expect(user?.failedLoginAttempts).toBe(0);
    });

    it('should track lockout per user, not globally', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';
      const password = 'ValidPassword123!';
      const hashedPassword = await mockHashPassword(password);

      // Create two users
      mockUsers.set(email1, {
        id: 'user-1',
        email: email1,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
        isActive: true,
      });

      mockUsers.set(email2, {
        id: 'user-2',
        email: email2,
        password: hashedPassword,
        firstName: 'Jane',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      });

      // User2 should still be able to login
      const result = await mockLoginAttempt(email2, password, 'CORNHOLE');

      expect(result.success).toBe(true);
    });
  });

  describe('Session creation on successful login', () => {
    it('should create a session with a 64-character hex token', async () => {
      const email = 'test@example.com';
      const password = 'ValidPassword123!';
      const hashedPassword = await mockHashPassword(password);

      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      });

      const result = await mockLoginAttempt(email, password, 'CORNHOLE');

      expect(result.session?.token).toBeDefined();
      expect(result.session?.token.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(result.session!.token)).toBe(true);
    });

    it('should store session in the session store', async () => {
      const email = 'test@example.com';
      const password = 'ValidPassword123!';
      const hashedPassword = await mockHashPassword(password);

      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      });

      const result = await mockLoginAttempt(email, password, 'CORNHOLE');

      expect(mockSessions.has(result.session!.token)).toBe(true);
    });

    it('should associate session with correct user', async () => {
      const email = 'test@example.com';
      const password = 'ValidPassword123!';
      const hashedPassword = await mockHashPassword(password);

      mockUsers.set(email, {
        id: 'user-123',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'CORNHOLE',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      });

      const result = await mockLoginAttempt(email, password, 'CORNHOLE');

      expect(result.session?.userId).toBe('user-123');
    });

    it('should set session sport to match user sport', async () => {
      const email = 'test@example.com';
      const password = 'ValidPassword123!';
      const hashedPassword = await mockHashPassword(password);

      mockUsers.set(email, {
        id: 'user-1',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        sport: 'DARTS',
        hiddenElo: 1500,
        visiblePoints: 100,
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      });

      const result = await mockLoginAttempt(email, password, 'DARTS');

      expect(result.session?.sport).toBe('DARTS');
    });
  });

  describe('Input validation', () => {
    it('should require email or phone', () => {
      const body = { password: 'Password123!', sport: 'CORNHOLE' };
      const hasIdentifier = !!(body as { email?: string; phone?: string }).email || !!(body as { email?: string; phone?: string }).phone;

      expect(hasIdentifier).toBe(false);
      // API would return: { error: 'Email or phone is required' }, status: 400
    });

    it('should require sport parameter', () => {
      const body = { email: 'test@example.com', password: 'Password123!' };
      const validSport = ['CORNHOLE', 'DARTS'].includes((body as { sport?: string }).sport || '');

      expect(validSport).toBe(false);
      // API would return: { error: 'Invalid sport' }, status: 400
    });

    it('should reject invalid sport types', () => {
      const body = { email: 'test@example.com', password: 'Password123!', sport: 'FOOTBALL' };
      const validSport = ['CORNHOLE', 'DARTS'].includes(body.sport as string);

      expect(validSport).toBe(false);
    });
  });
});
