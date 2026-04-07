/**
 * API Version 1 Info Endpoint
 * Returns information about the v1 API
 */

import { NextResponse } from 'next/server';
import { API_VERSIONS, getVersionInfo, addVersionHeaders } from '@/lib/api-versioning';

export async function GET() {
  const versionInfo = getVersionInfo();
  
  const response = NextResponse.json({
    success: true,
    data: {
      version: versionInfo.current,
      supportedVersions: versionInfo.supported,
      deprecatedVersions: versionInfo.deprecated,
      endpoints: {
        players: {
          list: 'GET /api/v1/players',
          get: 'GET /api/v1/players/:id',
          card: 'GET /api/v1/players/:id/card',
        },
        tournaments: {
          list: 'GET /api/v1/tournaments',
          get: 'GET /api/v1/tournaments/:id',
          bracket: 'GET /api/v1/tournaments/:id/bracket',
          register: 'POST /api/v1/tournaments/:id/register',
        },
        matches: {
          list: 'GET /api/v1/matches',
          score: 'POST /api/v1/matches/:id/score',
        },
        leaderboard: {
          get: 'GET /api/v1/leaderboard',
        },
        auth: {
          login: 'POST /api/v1/auth/login',
          register: 'POST /api/v1/auth/register',
          logout: 'POST /api/v1/auth/logout',
          check: 'GET /api/v1/auth/check',
        },
        user: {
          me: 'GET /api/v1/user/me',
          profile: 'GET /api/v1/user/profile',
        },
        health: {
          status: 'GET /api/v1/health',
          ready: 'GET /api/v1/health/ready',
        },
      },
      documentation: '/api/v1/docs',
      changelog: [
        {
          version: 'v1',
          date: '2025-01-01',
          changes: [
            'Initial API version',
            'Standardized response format',
            'Rate limiting headers',
            'Idempotency key support',
          ],
        },
      ],
    },
    meta: {
      version: API_VERSIONS.CURRENT,
      timestamp: new Date().toISOString(),
    },
  });

  addVersionHeaders(response);
  return response;
}
