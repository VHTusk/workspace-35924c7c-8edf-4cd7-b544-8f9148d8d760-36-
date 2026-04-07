/**
 * VALORHIVE Proxy
 *
 * This proxy adds security headers and CSRF protection to all responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requiresCsrfProtection,
  isCsrfExempt,
  validateCsrfToken,
} from '@/lib/csrf';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (requiresCsrfProtection(request.method) && !isCsrfExempt(pathname)) {
    if (!validateCsrfToken(request)) {
      return NextResponse.json(
        {
          error: 'CSRF token validation failed',
          code: 'CSRF_INVALID',
        },
        { status: 403 }
      );
    }
  }

  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next|static|favicon.ico|public/|images/|fonts/|icon-|sw.js|manifest.json|robots.txt).*)',
  ],
};
