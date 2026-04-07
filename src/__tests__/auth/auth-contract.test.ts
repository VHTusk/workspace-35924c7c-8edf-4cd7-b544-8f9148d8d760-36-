import { describe, expect, it } from 'vitest';
import { AUTH_CODES } from '@/lib/auth-contract';
import { parseAuthResponse } from '@/lib/auth-client';
import {
  detectIdentifierType,
  normalizeEmail,
  normalizePhone,
} from '@/lib/auth-validation';

describe('Auth contract helpers', () => {
  it('parses structured auth errors with field errors', async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        code: AUTH_CODES.EMAIL_ALREADY_REGISTERED,
        message: 'This email is already registered. Please log in.',
        field: 'email',
      }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const { error } = await parseAuthResponse(response, 'Fallback');

    expect(error).not.toBeNull();
    expect(error?.code).toBe(AUTH_CODES.EMAIL_ALREADY_REGISTERED);
    expect(error?.message).toBe('This email is already registered. Please log in.');
    expect(error?.fieldErrors.email).toBe('This email is already registered. Please log in.');
  });

  it('normalizes email and phone identifiers consistently', () => {
    expect(normalizeEmail('  PLAYER@Example.COM ')).toBe('player@example.com');
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
  });

  it('detects identifier type after normalization', () => {
    expect(detectIdentifierType('  Player@Example.com ')).toBe('email');
    expect(detectIdentifierType('+91 98765 43210')).toBe('phone');
    expect(detectIdentifierType('not-an-identifier')).toBeNull();
  });
});
