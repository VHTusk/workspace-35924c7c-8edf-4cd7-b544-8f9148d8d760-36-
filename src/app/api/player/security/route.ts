import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedEntity } from '@/lib/auth';
import { getMfaStatus } from '@/lib/mfa';

// GET - Get security information for logged-in user
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedEntity(request);
    
    if (!auth || auth.type !== 'user') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = auth.user;

    // Get active sessions
    const sessions = await db.session.findMany({
      where: {
        userId: user.id,
        expiresAt: { gt: new Date() }
      },
      orderBy: { lastActivityAt: 'desc' },
      select: {
        id: true,
        deviceFingerprint: true,
        lastActivityAt: true,
        createdAt: true,
        token: true
      }
    });

    // Get current session token from cookie
    const sessionToken = request.cookies.get('session_token')?.value;

    // Check if Google is linked
    const googleLinked = !!user.googleId;

    // Check if phone is verified
    const phoneVerified = !!user.phone && !!user.verifiedAt;

    // Check if email is verified
    const emailVerified = !!user.emailVerified;

    // Get MFA/2FA status
    const mfaStatus = await getMfaStatus(user.id);

    // Format sessions for display
    const formattedSessions = sessions.map(session => ({
      id: session.id,
      deviceName: parseDeviceName(session.deviceFingerprint),
      deviceFingerprint: session.deviceFingerprint,
      ipAddress: 'Hidden for security',
      createdAt: session.createdAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      isCurrent: session.token === sessionToken
    }));

    return NextResponse.json({
      hasPassword: !!user.password,
      googleLinked,
      phoneVerified,
      emailVerified,
      twoFactorEnabled: mfaStatus.enabled,
      twoFactorSetup: mfaStatus.setup,
      recoveryCodesRemaining: mfaStatus.recoveryCodesRemaining,
      sessions: formattedSessions
    });
  } catch (error) {
    console.error('Error fetching security data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to parse device name from fingerprint
function parseDeviceName(fingerprint: string | null): string {
  if (!fingerprint) return 'Unknown Device';
  
  // If it's a JSON string, try to parse it
  try {
    const parsed = JSON.parse(fingerprint);
    if (parsed.deviceName) return parsed.deviceName;
    if (parsed.userAgent) {
      // Parse user agent for basic device info
      const ua = parsed.userAgent;
      if (ua.includes('Mobile')) return 'Mobile Device';
      if (ua.includes('Windows')) return 'Windows PC';
      if (ua.includes('Mac')) return 'Mac';
      if (ua.includes('Linux')) return 'Linux';
      if (ua.includes('Android')) return 'Android Device';
      if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS Device';
    }
  } catch {
    // Not JSON, just return as is
  }
  
  return 'Device';
}
