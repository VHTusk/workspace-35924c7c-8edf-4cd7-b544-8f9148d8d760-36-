import { NextRequest, NextResponse } from 'next/server';
import { setupMfa } from '@/lib/mfa';
import { validateAdminSession } from '@/lib/auth-utils';

/**
 * GET /api/admin/mfa/setup
 * Get MFA setup info (secret + QR code URL)
 */
export async function GET(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateAdminSession();
    if (!session.authenticated || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_001' },
        { status: 401 }
      );
    }

    // Setup MFA and get QR code
    const email = session.user.email || 'admin@valorhive.com';
    const result = await setupMfa(session.userId!, email);

    return NextResponse.json({
      success: true,
      data: {
        secret: result.secret,
        otpAuthUrl: result.otpAuthUrl,
        recoveryCodes: result.recoveryCodes,
      },
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup MFA', code: 'SRV_001' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/mfa/setup
 * Enable MFA after verifying the first code
 */
export async function POST(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateAdminSession();
    if (!session.authenticated || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_001' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code, email } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required', code: 'VAL_001' },
        { status: 400 }
      );
    }

    // If secret not yet generated, generate it first
    const emailToUse = email || session.user.email || 'admin@valorhive.com';
    const setupResult = await setupMfa(session.userId!, emailToUse);

    // Enable MFA with the provided code
    const { enableMfa } = await import('@/lib/mfa');
    const result = await enableMfa(session.userId!, code);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: 'AUTH_003' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'MFA enabled successfully',
      data: {
        recoveryCodes: setupResult.recoveryCodes,
      },
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup MFA', code: 'SRV_001' },
      { status: 500 }
    );
  }
}
