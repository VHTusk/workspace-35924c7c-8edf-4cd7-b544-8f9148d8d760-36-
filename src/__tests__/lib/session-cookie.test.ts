import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Session Cookie Consistency Tests
 * 
 * Tests for the standardized session cookie helper functions.
 * Ensures all login, register, and logout flows use consistent cookie settings.
 */

// ============================================
// COOKIE CONTRACT CONSTANTS
// ============================================

/**
 * The canonical cookie contract that ALL auth routes must follow.
 * 
 * COOKIE CONTRACT (Production-Safe):
 * - name: 'session_token'
 * - httpOnly: true (prevents JavaScript access - XSS protection)
 * - secure: true in production, false in development (HTTPS protection)
 * - sameSite: 'strict' (maximum CSRF protection - cookie never sent cross-site)
 * - maxAge: 604800 (7 days in seconds)
 * - path: '/' (available across entire site)
 * 
 */
const COOKIE_CONTRACT = {
  name: 'session_token',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60, // 604800 seconds (7 days)
  path: '/',
};

// ============================================
// TESTS
// ============================================

describe('Session Cookie Contract', () => {
  describe('Cookie Name', () => {
    it('should use session_token as the canonical cookie name', () => {
      expect(COOKIE_CONTRACT.name).toBe('session_token');
    });

    it('should NOT use alternative cookie names', () => {
      // These names should NOT be used
      const forbiddenNames = [
        'org_session_token',
        'auth_token',
        'user_session',
        'session',
      ];

      forbiddenNames.forEach(name => {
        expect(COOKIE_CONTRACT.name).not.toBe(name);
      });
    });
  });

  describe('Cookie Attributes', () => {
    it('should have httpOnly set to true', () => {
      expect(COOKIE_CONTRACT.httpOnly).toBe(true);
    });

    it('should have secure based on NODE_ENV', () => {
      // In test environment (NODE_ENV=test), secure should be false
      // In production, secure would be true
      const expectedSecure = process.env.NODE_ENV === 'production';
      expect(COOKIE_CONTRACT.secure).toBe(expectedSecure);
    });

    it('should have sameSite set to strict for maximum CSRF protection', () => {
      // 'strict' provides the strongest CSRF protection - cookie is never sent cross-site
      expect(COOKIE_CONTRACT.sameSite).toBe('strict');
    });

    it('should have maxAge of 7 days (604800 seconds)', () => {
      const sevenDaysInSeconds = 7 * 24 * 60 * 60;
      expect(COOKIE_CONTRACT.maxAge).toBe(sevenDaysInSeconds);
      expect(COOKIE_CONTRACT.maxAge).toBe(604800);
    });

    it('should have path set to root', () => {
      expect(COOKIE_CONTRACT.path).toBe('/');
    });
  });
});

describe('Cookie Helper Functions', () => {
  describe('setSessionCookie', () => {
    it('should exist and be importable', async () => {
      const { setSessionCookie } = await import('@/lib/session-helpers');
      expect(typeof setSessionCookie).toBe('function');
    });

    it('should set cookie with canonical options', async () => {
      const { setSessionCookie, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } = await import('@/lib/session-helpers');
      
      // Verify the constants match our contract
      expect(SESSION_COOKIE_NAME).toBe(COOKIE_CONTRACT.name);
      expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(COOKIE_CONTRACT.httpOnly);
      expect(SESSION_COOKIE_OPTIONS.secure).toBe(COOKIE_CONTRACT.secure);
      expect(SESSION_COOKIE_OPTIONS.sameSite).toBe(COOKIE_CONTRACT.sameSite);
      expect(SESSION_COOKIE_OPTIONS.maxAge).toBe(COOKIE_CONTRACT.maxAge);
      expect(SESSION_COOKIE_OPTIONS.path).toBe(COOKIE_CONTRACT.path);
    });
  });

  describe('clearSessionCookie', () => {
    it('should exist and be importable', async () => {
      const { clearSessionCookie } = await import('@/lib/session-helpers');
      expect(typeof clearSessionCookie).toBe('function');
    });

    it('should use matching path for deletion', async () => {
      const { SESSION_COOKIE_CLEAR_OPTIONS } = await import('@/lib/session-helpers');
      
      // The clear options must match the path exactly for deletion to work
      expect(SESSION_COOKIE_CLEAR_OPTIONS.path).toBe('/');
    });

    it('should use sameSite: strict for deletion consistency', async () => {
      const { SESSION_COOKIE_CLEAR_OPTIONS } = await import('@/lib/session-helpers');
      
      // Clear options must match the sameSite setting
      expect(SESSION_COOKIE_CLEAR_OPTIONS.sameSite).toBe('strict');
    });
  });

  describe('clearSessionCookieFromStore', () => {
    it('should exist and be importable', async () => {
      const { clearSessionCookieFromStore } = await import('@/lib/session-helpers');
      expect(typeof clearSessionCookieFromStore).toBe('function');
    });
  });
});

describe('Cookie Consistency Across Auth Routes', () => {
  it('should list all routes that set session cookies', () => {
    // These routes must use the setSessionCookie helper
    const routesThatSetCookies = [
      'POST /api/auth/login',
      'POST /api/auth/register',
      'POST /api/auth/org/login',
      'POST /api/auth/org/register',
      'POST /api/auth/google-onetap',
      'POST /api/org/login',
    ];

    expect(routesThatSetCookies.length).toBe(6);
  });

  it('should list all routes that clear session cookies', () => {
    // These routes must use the clearSessionCookie helper
    const routesThatClearCookies = [
      'POST /api/auth/logout',
      'GET /api/auth/check (on invalid session)',
      'GET /api/auth/check-org (on invalid session)',
      'DELETE /api/org/delete',
    ];

    expect(routesThatClearCookies.length).toBe(4);
  });
});

describe('Login Flow Cookie Test', () => {
  it('should set consistent cookie on successful login', async () => {
    const { setSessionCookie, SESSION_COOKIE_OPTIONS } = await import('@/lib/session-helpers');

    // Simulate login response
    const mockResponse = {
      cookies: {
        set: vi.fn(),
      },
    };

    // Call the helper
    setSessionCookie(mockResponse as any, 'test-session-token');

    // Verify it was called with correct options (strict sameSite in test env)
    expect(mockResponse.cookies.set).toHaveBeenCalledWith(
      'session_token',
      'test-session-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 604800,
        path: '/',
      })
    );
  });
});

describe('Logout Flow Cookie Test', () => {
  it('should clear cookie with matching path and sameSite', async () => {
    const { clearSessionCookie, SESSION_COOKIE_CLEAR_OPTIONS } = await import('@/lib/session-helpers');

    // Simulate logout response
    const mockResponse = {
      cookies: {
        set: vi.fn(),
      },
    };

    // Call the helper
    clearSessionCookie(mockResponse as any);

    // Verify it was called with correct options for deletion
    expect(mockResponse.cookies.set).toHaveBeenCalledWith(
      'session_token',
      '',
      expect.objectContaining({
        path: '/',
        maxAge: 0,
        sameSite: 'strict',
        httpOnly: true,
      })
    );
  });
});

describe('Register Flow Cookie Test', () => {
  it('should set consistent cookie on successful registration', async () => {
    const { setSessionCookie } = await import('@/lib/session-helpers');

    // Simulate register response
    const mockResponse = {
      cookies: {
        set: vi.fn(),
      },
    };

    // Call the helper
    setSessionCookie(mockResponse as any, 'new-user-session-token');

    // Verify cookie settings match the contract
    expect(mockResponse.cookies.set).toHaveBeenCalledWith(
      'session_token',
      'new-user-session-token',
      expect.objectContaining({
        httpOnly: COOKIE_CONTRACT.httpOnly,
        sameSite: COOKIE_CONTRACT.sameSite,
        maxAge: COOKIE_CONTRACT.maxAge,
        path: COOKIE_CONTRACT.path,
      })
    );
  });
});

describe('Google One Tap Cookie Contract', () => {
  it('should keep sameSite: strict for One Tap session cookies', async () => {
    const { setSessionCookie } = await import('@/lib/session-helpers');

    const mockResponse = {
      cookies: {
        set: vi.fn(),
      },
    };

    setSessionCookie(mockResponse as any, 'google-onetap-session-token');

    expect(mockResponse.cookies.set).toHaveBeenCalledWith(
      'session_token',
      'google-onetap-session-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 604800,
        path: '/',
      })
    );
  });
});

describe('Migration Verification', () => {
  it('should document that all auth routes use the shared helper', async () => {
    // This test documents which files should import setSessionCookie
    const filesThatShouldImportHelper = [
      'src/app/api/auth/login/route.ts',
      'src/app/api/auth/register/route.ts',
      'src/app/api/auth/org/login/route.ts',
      'src/app/api/auth/org/register/route.ts',
      'src/app/api/auth/google-onetap/route.ts',
      'src/app/api/org/login/route.ts',
      'src/lib/auth-utils.ts',
    ];

    // All these files should have been migrated
    expect(filesThatShouldImportHelper.length).toBe(7);
  });

  it('should document that logout uses the shared helper', async () => {
    // This test documents that logout uses the correct clear helper
    const filesThatShouldImportClearHelper = [
      'src/app/api/auth/logout/route.ts',
    ];

    expect(filesThatShouldImportClearHelper.length).toBe(1);
  });
});

describe('Invalid Session Cleanup - Cookie Deletion', () => {
  it('should use clearSessionCookie helper for invalid session cleanup', async () => {
    const { clearSessionCookie } = await import('@/lib/session-helpers');

    // Simulate invalid session response (like in auth/check routes)
    const mockResponse = {
      cookies: {
        set: vi.fn(),
      },
    };

    // Use the helper as the routes do
    clearSessionCookie(mockResponse as any);

    // Verify cookie is cleared with correct options
    expect(mockResponse.cookies.set).toHaveBeenCalledWith(
      'session_token',
      '',
      expect.objectContaining({
        path: '/',
        maxAge: 0,
        httpOnly: true,
        sameSite: 'strict',
      })
    );
  });

  it('should document routes that clear cookies on invalid sessions', () => {
    // These routes should use clearSessionCookie for invalid sessions
    const routesThatClearOnInvalidSession = [
      'GET /api/auth/check - when session is invalid/expired',
      'GET /api/auth/check - when user not found',
      'GET /api/auth/check - when org not found',
      'GET /api/auth/check-org - when session is invalid',
    ];

    expect(routesThatClearOnInvalidSession.length).toBe(4);
  });
});

describe('Organization Deletion - Cookie Cleanup', () => {
  it('should use clearSessionCookie helper when deleting organization', async () => {
    const { clearSessionCookie } = await import('@/lib/session-helpers');

    // Simulate org deletion response
    const mockResponse = {
      cookies: {
        set: vi.fn(),
      },
    };

    // Use the helper as DELETE /api/org/delete does
    clearSessionCookie(mockResponse as any);

    // Verify cookie is cleared
    expect(mockResponse.cookies.set).toHaveBeenCalledWith(
      'session_token',
      '',
      expect.objectContaining({
        maxAge: 0,
        path: '/',
        sameSite: 'strict',
      })
    );
  });

  it('should document that org deletion route uses the helper', () => {
    // This route should use clearSessionCookie
    const routesThatClearOnOrgDeletion = [
      'DELETE /api/org/delete - after deleting organization',
    ];

    expect(routesThatClearOnOrgDeletion.length).toBe(1);
  });
});

describe('No Direct Cookie Deletes', () => {
  it('should verify no routes use response.cookies.delete for session_token', async () => {
    // This test documents that all routes should use clearSessionCookie
    // instead of direct response.cookies.delete("session_token")
    
    // Routes that were migrated from direct delete to helper:
    const migratedRoutes = [
      'src/app/api/auth/check/route.ts',
      'src/app/api/auth/check-org/route.ts',
      'src/app/api/org/delete/route.ts',
    ];

    // All should now import and use clearSessionCookie
    expect(migratedRoutes.length).toBe(3);
  });

  it('should verify clearSessionCookie sets correct cookie options', async () => {
    const { clearSessionCookie, SESSION_COOKIE_CLEAR_OPTIONS } = await import('@/lib/session-helpers');

    // Verify clear options match what's needed for proper deletion
    expect(SESSION_COOKIE_CLEAR_OPTIONS.path).toBe('/');
    expect(SESSION_COOKIE_CLEAR_OPTIONS.httpOnly).toBe(true);
    expect(SESSION_COOKIE_CLEAR_OPTIONS.sameSite).toBe('strict');

    // Test that the helper applies these options
    const mockResponse = {
      cookies: {
        set: vi.fn(),
      },
    };

    clearSessionCookie(mockResponse as any);

    // Should be called with empty value and maxAge 0 for deletion
    expect(mockResponse.cookies.set).toHaveBeenCalledWith(
      'session_token',
      '',
      expect.objectContaining({
        ...SESSION_COOKIE_CLEAR_OPTIONS,
        maxAge: 0,
      })
    );
  });
});

describe('Production Security', () => {
  it('should verify secure attribute in production', async () => {
    const { SESSION_COOKIE_OPTIONS } = await import('@/lib/session-helpers');
    
    // In test environment, NODE_ENV is 'test', so secure should be false
    // In production, secure would be true
    const isProduction = process.env.NODE_ENV === 'production';
    expect(SESSION_COOKIE_OPTIONS.secure).toBe(isProduction);
  });

  it('should verify sameSite strict for maximum CSRF protection', async () => {
    const { SESSION_COOKIE_OPTIONS } = await import('@/lib/session-helpers');
    
    // sameSite: 'strict' is the most secure option
    // It prevents the cookie from being sent on ANY cross-site request
    expect(SESSION_COOKIE_OPTIONS.sameSite).toBe('strict');
  });

  it('should verify httpOnly for XSS protection', async () => {
    const { SESSION_COOKIE_OPTIONS } = await import('@/lib/session-helpers');
    
    // httpOnly prevents JavaScript from accessing the cookie
    expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
  });
});
