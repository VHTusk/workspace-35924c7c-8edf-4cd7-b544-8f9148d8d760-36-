/**
 * @valorhive/auth - Token Management
 * 
 * Token hashing and extraction functions for VALORHIVE authentication.
 * Handles HTTP request tokens and WebSocket handshake tokens.
 */

import { NextRequest } from 'next/server';
import { Socket } from 'socket.io';

// ============================================
// Token Hashing (SHA-256)
// ============================================

/**
 * Hash a token using SHA-256 for secure storage/lookup
 * 
 * Sessions are stored with SHA-256 hashed tokens. This function
 * must be used before any database lookup by token.
 * 
 * @param token - The plaintext session token
 * @returns SHA-256 hex-encoded hash
 */
export async function hashSessionToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Alias for consistency with auth.ts naming
export const hashToken = hashSessionToken;

// ============================================
// Token Extraction - HTTP
// ============================================

/**
 * Extract session token from HTTP request
 * Supports both cookie (web) and Bearer header (mobile)
 * 
 * @param request - NextRequest object
 * @returns Session token if found, null otherwise
 */
export function extractTokenFromRequest(request: NextRequest): string | null {
  // 1. Check for Bearer token (mobile apps)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }

  // 2. Check for custom header set by middleware
  const customToken = request.headers.get('x-session-token');
  if (customToken) {
    return customToken;
  }

  // 3. Check for admin session cookie (takes priority for admin routes)
  const adminToken = request.cookies.get('admin_session')?.value;
  if (adminToken) {
    return adminToken;
  }

  // 4. Fall back to regular session cookie
  const sessionToken = request.cookies.get('session_token')?.value;
  if (sessionToken) {
    return sessionToken;
  }

  // 5. Check for org session cookie
  const orgToken = request.cookies.get('org_session')?.value;
  if (orgToken) {
    return orgToken;
  }

  return null;
}

// ============================================
// Token Extraction - WebSocket
// ============================================

/**
 * Extract session token from WebSocket handshake
 * 
 * @param socket - Socket.IO socket object
 * @returns Session token if found, null otherwise
 */
export function extractTokenFromSocketHandshake(socket: Socket): string | null {
  // 1. Check auth object (preferred for Socket.IO)
  const authSessionToken = socket.handshake.auth.sessionToken ||
    socket.handshake.auth.token;
  if (authSessionToken && typeof authSessionToken === 'string') {
    return authSessionToken;
  }

  // 2. Check custom header
  const headerToken = socket.handshake.headers['x-session-token'];
  if (headerToken && typeof headerToken === 'string') {
    return headerToken;
  }

  // 3. Check Authorization header
  const authHeader = socket.handshake.headers['authorization'];
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }

  // 4. Parse cookie header
  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith('session_token=')) {
        return trimmed.split('=')[1];
      }
      if (trimmed.startsWith('admin_session=')) {
        return trimmed.split('=')[1];
      }
      if (trimmed.startsWith('org_session=')) {
        return trimmed.split('=')[1];
      }
    }
  }

  return null;
}
