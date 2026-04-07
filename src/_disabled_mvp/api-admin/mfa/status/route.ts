import { NextRequest, NextResponse } from 'next/server';
import { getMfaStatus, checkMfaRequirement } from '@/lib/mfa';
import { validateAdminSession } from '@/lib/auth-utils';

/**
 * GET /api/admin/mfa/status
 * Get MFA status for the current admin
 */
export async function GET(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateAdminSession();
    if (!session.authenticated || !session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_001' },
        { status: 401 }
      );
    }

    const status = await getMfaStatus(session.userId);
    const requirement = await checkMfaRequirement(session.userId);

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        required: requirement.required,
      },
    });
  } catch (error) {
    console.error('MFA status error:', error);
    return NextResponse.json(
      { error: 'Failed to get MFA status', code: 'SRV_001' },
      { status: 500 }
    );
  }
}
