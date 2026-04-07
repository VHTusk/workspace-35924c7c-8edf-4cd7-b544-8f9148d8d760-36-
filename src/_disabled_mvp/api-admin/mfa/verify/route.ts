import { NextRequest, NextResponse } from 'next/server';
import { enableMfa, verifyMfaLogin } from '@/lib/mfa';
import { validateAdminSession } from '@/lib/auth-utils';

/**
 * POST /api/admin/mfa/verify
 * Verify MFA code - can be used for:
 * 1. Enabling MFA (isLogin = false)
 * 2. Login verification (isLogin = true)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, isLogin, userId } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required', code: 'VAL_001' },
        { status: 400 }
      );
    }

    if (isLogin) {
      // For login verification, userId is passed from login flow
      if (!userId) {
        return NextResponse.json(
          { error: 'User ID is required for login verification', code: 'VAL_002' },
          { status: 400 }
        );
      }

      // Verify MFA during login
      const result = await verifyMfaLogin(userId, code);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error, code: 'AUTH_003' },
          { status: 401 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'MFA verified successfully',
        usedRecoveryCode: result.usedRecoveryCode,
      });
    } else {
      // Validate admin session for enabling MFA
      const session = await validateAdminSession();
      if (!session.authenticated || !session.userId) {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'AUTH_001' },
          { status: 401 }
        );
      }

      // Enable MFA after setup
      const result = await enableMfa(session.userId, code);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error, code: 'AUTH_003' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'MFA enabled successfully',
      });
    }
  } catch (error) {
    console.error('MFA verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify MFA', code: 'SRV_001' },
      { status: 500 }
    );
  }
}
