import { NextRequest, NextResponse } from 'next/server';
import { requestDataDeletion, cancelDeletionRequest, getDeletionStatus } from '@/lib/gdpr-compliance';
import { validatePlayerSession } from '@/lib/auth-utils';

/**
 * POST /api/player/gdpr/delete
 * Request account deletion (Right to Erasure - GDPR Art. 17)
 */
export async function POST(request: NextRequest) {
  try {
    // Validate player session
    const session = await validatePlayerSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_001' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, reason } = body;

    if (action === 'cancel') {
      // Cancel pending deletion request
      const result = await cancelDeletionRequest(session.userId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error, code: 'VAL_001' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Deletion request cancelled successfully',
      });
    }

    // Request new deletion
    const result = await requestDataDeletion(session.userId, session.sport, reason);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: 'VAL_001' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        deletionDate: result.deletionDate,
        gracePeriodEnds: result.gracePeriodEnds,
        message: `Your account deletion has been scheduled. You have ${GDPR_CONFIG.deletionGracePeriodDays} days to cancel this request.`,
      },
    });
  } catch (error) {
    console.error('GDPR deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to process deletion request', code: 'SRV_001' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/player/gdpr/delete
 * Get deletion status
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

    const status = await getDeletionStatus(session.userId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('GDPR status error:', error);
    return NextResponse.json(
      { error: 'Failed to get deletion status', code: 'SRV_001' },
      { status: 500 }
    );
  }
}

// GDPR config reference
const GDPR_CONFIG = {
  deletionGracePeriodDays: 30,
};
