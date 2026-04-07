import { NextRequest, NextResponse } from 'next/server';
import { recordConsent, getConsentHistory, withdrawConsent } from '@/lib/gdpr-compliance';
import { validatePlayerSession } from '@/lib/auth-utils';

/**
 * POST /api/player/gdpr/consent
 * Record or withdraw consent (GDPR Art. 7)
 */
export async function POST(request: NextRequest) {
  try {
    // Validate player session (optional for initial registration)
    let userId: string | null = null;
    try {
      const session = await validatePlayerSession(request);
      userId = session?.userId || null;
    } catch {
      // Allow consent recording during registration
    }

    const body = await request.json();
    const { consentType, granted, action, metadata } = body;

    // Validate consent type
    const validConsentTypes = ['TOS', 'PRIVACY_POLICY', 'MARKETING', 'DATA_PROCESSING', 'COOKIES'];
    if (!consentType || !validConsentTypes.includes(consentType)) {
      return NextResponse.json(
        { error: 'Invalid consent type', code: 'VAL_001' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_001' },
        { status: 401 }
      );
    }

    if (action === 'withdraw') {
      // Withdraw consent (only for marketing and cookies)
      if (consentType !== 'MARKETING' && consentType !== 'COOKIES') {
        return NextResponse.json(
          { error: 'Can only withdraw MARKETING or COOKIES consent', code: 'VAL_001' },
          { status: 400 }
        );
      }

      const result = await withdrawConsent(userId, consentType as 'MARKETING' | 'COOKIES');

      if (!result.success) {
        return NextResponse.json(
          { error: result.error, code: 'SRV_001' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `${consentType} consent withdrawn successfully`,
      });
    }

    // Record new consent
    const result = await recordConsent(userId, consentType as any, granted, metadata);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: 'SRV_001' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${consentType} consent ${granted ? 'granted' : 'denied'} successfully`,
    });
  } catch (error) {
    console.error('GDPR consent error:', error);
    return NextResponse.json(
      { error: 'Failed to record consent', code: 'SRV_001' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/player/gdpr/consent
 * Get consent history
 */
export async function GET(request: NextRequest) {
  try {
    // Validate player session
    const session = await validatePlayerSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_001' },
        { status: 401 }
      );
    }

    const history = await getConsentHistory(session.userId);

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('GDPR consent history error:', error);
    return NextResponse.json(
      { error: 'Failed to get consent history', code: 'SRV_001' },
      { status: 500 }
    );
  }
}
