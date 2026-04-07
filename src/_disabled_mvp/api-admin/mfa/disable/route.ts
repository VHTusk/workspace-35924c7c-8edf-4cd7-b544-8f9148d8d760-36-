import { NextRequest, NextResponse } from 'next/server';
import { disableMfa, regenerateRecoveryCodes } from '@/lib/mfa';
import { validateAdminSession } from '@/lib/auth-utils';

/**
 * POST /api/admin/mfa/disable
 * Disable MFA for the current admin
 * Supports: 
 * - action='disable': Disable MFA (requires TOTP code)
 * - action='regenerate': Regenerate recovery codes (requires TOTP code)
 */
export async function POST(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateAdminSession();
    if (!session.authenticated || !session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_001' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code, action, password } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required', code: 'VAL_001' },
        { status: 400 }
      );
    }

    // For disable action, optionally require password confirmation
    if (action === 'disable' && password) {
      // Verify password if provided (extra security)
      const { verifyPassword } = await import('@/lib/auth');
      const { db } = await import('@/lib/db');
      
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { password: true },
      });

      if (!user?.password || !(await verifyPassword(password, user.password))) {
        return NextResponse.json(
          { error: 'Invalid password', code: 'AUTH_002' },
          { status: 401 }
        );
      }
    }

    if (action === 'regenerate') {
      // Regenerate recovery codes
      const result = await regenerateRecoveryCodes(session.userId, code);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error, code: 'AUTH_003' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          recoveryCodes: result.recoveryCodes,
        },
        message: 'Recovery codes regenerated successfully',
      });
    } else {
      // Disable MFA
      const result = await disableMfa(session.userId, code);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error, code: 'AUTH_003' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'MFA disabled successfully',
      });
    }
  } catch (error) {
    console.error('MFA disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable MFA', code: 'SRV_001' },
      { status: 500 }
    );
  }
}
