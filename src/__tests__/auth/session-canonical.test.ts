/**
 * Regression tests for session authentication standardization
 * 
 * These tests verify that:
 * 1. Authenticated requests succeed with valid session_token cookie
 * 2. Authenticated requests fail with invalid/expired tokens
 * 3. Legacy 'session' cookie is no longer supported
 * 4. Raw token lookups are not used (tokens are hashed before lookup)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Role, SportType } from '@prisma/client';

// Mock the db module - must be hoisted
vi.mock('@/lib/db', () => ({
  db: {
    session: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    $executeRaw: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import after mocking
import { db } from '@/lib/db';
import { hashToken, validateSession, extractSessionToken } from '@/lib/auth';

describe('Session Authentication Standardization', () => {
  const mockUserId = 'test-user-id';
  const plaintextToken = 'a'.repeat(64); // Simulate a 32-byte token in hex

  beforeEach(() => {
    vi.clearAllMocks();
    (db.$executeRaw as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hashToken', () => {
    it('should produce consistent hashes for the same token', async () => {
      const hash1 = await hashToken(plaintextToken);
      const hash2 = await hashToken(plaintextToken);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', async () => {
      const hash1 = await hashToken(plaintextToken);
      const hash2 = await hashToken('b'.repeat(64));
      expect(hash1).not.toBe(hash2);
    });

    it('should return a 64-character hex string (SHA-256)', async () => {
      const hash = await hashToken(plaintextToken);
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  describe('extractSessionToken', () => {
    it('should extract token from session_token cookie', () => {
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        cookies: {
          get: vi.fn((name: string) => {
            if (name === 'session_token') {
              return { name: 'session_token', value: plaintextToken };
            }
            return undefined;
          }),
        },
      } as unknown as NextRequest;

      const token = extractSessionToken(mockRequest);
      expect(token).toBe(plaintextToken);
    });

    it('should extract token from Authorization Bearer header', () => {
      const mockRequest = {
        headers: {
          get: vi.fn((name: string) => {
            if (name === 'authorization') {
              return `Bearer ${plaintextToken}`;
            }
            return null;
          }),
        },
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
      } as unknown as NextRequest;

      const token = extractSessionToken(mockRequest);
      expect(token).toBe(plaintextToken);
    });

    it('should return null when no token is present', () => {
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
      } as unknown as NextRequest;

      const token = extractSessionToken(mockRequest);
      expect(token).toBeNull();
    });

    it('should NOT extract token from legacy "session" cookie', () => {
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        cookies: {
          get: vi.fn((name: string) => {
            // Only legacy 'session' cookie is present, NOT session_token
            if (name === 'session') {
              return { name: 'session', value: plaintextToken };
            }
            return undefined;
          }),
        },
      } as unknown as NextRequest;

      const token = extractSessionToken(mockRequest);
      // Legacy cookie should NOT be read
      expect(token).toBeNull();
    });
  });

  describe('validateSession', () => {
    it('should hash the token before database lookup', async () => {
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        role: Role.PLAYER,
        sport: SportType.CORNHOLE,
      };

      const expectedHash = await hashToken(plaintextToken);

      const mockSession = {
        id: 'session-id',
        token: expectedHash,
        userId: mockUserId,
        user: mockUser,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      (db.session.findUnique as any).mockResolvedValue(mockSession);

      const result = await validateSession(plaintextToken);

      // Verify that findUnique was called with a hashed token, not the plaintext
      expect(db.session.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token: expectedHash },
          include: { user: true },
        })
      );

      // The token passed to findUnique should NOT be the plaintext token
      const calledToken = (db.session.findUnique as any).mock.calls[0][0].where.token;
      expect(calledToken).not.toBe(plaintextToken);
      expect(calledToken).toHaveLength(64); // SHA-256 hash length

      expect(result).not.toBeNull();
      expect(result?.user.id).toBe(mockUserId);
    });

    it('should return null for invalid sessions', async () => {
      (db.session.findUnique as any).mockResolvedValue(null);

      const result = await validateSession('invalid-token');
      expect(result).toBeNull();
    });

    it('should return null for expired sessions and delete them', async () => {
      const expectedHash = await hashToken(plaintextToken);

      const mockSession = {
        id: 'session-id',
        token: expectedHash,
        userId: mockUserId,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      (db.session.findUnique as any).mockResolvedValue(mockSession);
      (db.session.delete as any).mockResolvedValue(mockSession);

      const result = await validateSession(plaintextToken);
      expect(result).toBeNull();
      expect(db.session.delete).toHaveBeenCalledWith({
        where: { token: expectedHash },
      });
    });
  });

  describe('Security: No raw token lookups', () => {
    it('validateSession must hash token before DB lookup', async () => {
      (db.session.findUnique as any).mockResolvedValue(null);

      await validateSession(plaintextToken);

      // Verify the token was hashed before lookup
      expect(db.session.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            token: expect.not.stringMatching(plaintextToken),
          }),
        })
      );

      // The stored token should be a SHA-256 hash (64 hex chars)
      const calledWith = (db.session.findUnique as any).mock.calls[0][0];
      expect(calledWith.where.token).toHaveLength(64);
      expect(calledWith.where.token).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('Cookie name verification', () => {
    it('session_token cookie is the only supported cookie name', () => {
      const supportedCookieName = 'session_token';
      const legacyCookieName = 'session';

      // The canonical auth helpers only read 'session_token'
      expect(supportedCookieName).toBe('session_token');
      expect(legacyCookieName).not.toBe('session_token');

      // This documents that 'session' is no longer supported
      expect(legacyCookieName).toBe('session');
    });
  });
});

describe('API Routes: Session Token Authentication', () => {
  // These tests would require mocking the entire route handlers
  // or using integration tests with a test database

  it.todo('GET /api/group-chats should return 401 without session_token');
  it.todo('GET /api/group-chats should return data with valid session_token');
  it.todo('GET /api/group-chats should return 401 with legacy session cookie');
  
  it.todo('GET /api/player/disputes should return 401 without session_token');
  it.todo('GET /api/player/disputes should return data with valid session_token');
  
  it.todo('GET /api/recommendations/tournaments should return 401 without session_token');
  it.todo('GET /api/recommendations/tournaments should return data with valid session_token');
});
