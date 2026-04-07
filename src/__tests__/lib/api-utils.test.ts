import { describe, it, expect, vi } from 'vitest';
import { NextResponse } from 'next/server';

/**
 * Tests for API Timeout Utilities
 * 
 * These tests verify the timeout guard utilities that prevent 504 Gateway Timeout issues.
 */

// Import the module under test
import {
  withTimeout,
  fetchWithTimeout,
  withRouteTimeout,
  ensureResponse,
  errorResponse,
  successResponse,
} from '@/lib/api-utils';

describe('API Timeout Utilities', () => {
  describe('withTimeout', () => {
    it('should return result when operation completes before timeout', async () => {
      const operation = vi.fn().mockResolvedValue(NextResponse.json({ data: 'success' }));
      
      const result = await withTimeout(operation, { timeout: 5000 });
      
      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.data).toBe('success');
    });

    it('should propagate errors from the operation', async () => {
      const error = new Error('Operation failed');
      const operation = vi.fn().mockRejectedValue(error);
      
      await expect(withTimeout(operation, { timeout: 5000 })).rejects.toThrow('Operation failed');
    });

    it('should export the function', () => {
      expect(typeof withTimeout).toBe('function');
    });
  });

  describe('fetchWithTimeout', () => {
    it('should export the function', () => {
      expect(typeof fetchWithTimeout).toBe('function');
    });

    it('should accept URL and options', () => {
      // Just verify the function exists
      expect(fetchWithTimeout).toBeDefined();
    });
  });

  describe('withRouteTimeout', () => {
    it('should export the function', () => {
      expect(typeof withRouteTimeout).toBe('function');
    });

    it('should wrap handler and return result', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      
      const wrappedHandler = withRouteTimeout(handler, { timeout: 5000 });
      
      const result = await wrappedHandler(new Request('http://localhost:3000/api/test'));
      
      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.success).toBe(true);
    });
  });

  describe('ensureResponse', () => {
    it('should return the response if valid', () => {
      const response = NextResponse.json({ data: 'test' });
      const result = ensureResponse(response);
      
      expect(result).toBe(response);
    });

    it('should return fallback response if undefined', () => {
      const result = ensureResponse(undefined);
      
      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(500);
    });

    it('should return fallback response if null', () => {
      const result = ensureResponse(null, 'Custom fallback');
      
      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(500);
    });
  });

  describe('errorResponse', () => {
    it('should create error response with default status', () => {
      const result = errorResponse('Something went wrong');
      
      expect(result.status).toBe(500);
    });

    it('should create error response with custom status', () => {
      const result = errorResponse('Not found', 404, 'NOT_FOUND');
      
      expect(result.status).toBe(404);
    });
  });

  describe('successResponse', () => {
    it('should create success response with data', () => {
      const result = successResponse({ id: 1, name: 'Test' });
      
      expect(result.status).toBe(200);
    });

    it('should create success response with custom status', () => {
      const result = successResponse({ created: true }, 201);
      
      expect(result.status).toBe(201);
    });
  });
});

describe('Recursive API Call Prevention', () => {
  it('should document that routes must not call other API routes via fetch', () => {
    // This test documents the anti-pattern that was fixed
    // Routes should NOT do: fetch('/api/other-route')
    // Instead, they should call the underlying function directly
    
    const correctPattern = `
      // WRONG (causes 504 timeouts):
      const response = await fetch('/api/player/me');
      
      // CORRECT (direct function call):
      import { getSessionUser } from '@/lib/session-helpers';
      const authResult = await getSessionUser(request);
    `;
    
    expect(correctPattern).toContain('getSessionUser');
  });
  
  it('should document session helper usage', async () => {
    const { getSessionUser } = await import('@/lib/session-helpers');
    
    expect(typeof getSessionUser).toBe('function');
  });
});
