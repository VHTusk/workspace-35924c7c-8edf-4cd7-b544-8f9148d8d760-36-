import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, convertSpectatorToFull } from '@/lib/auth';
import { AccountTier } from '@prisma/client';

/**
 * Upgrade spectator to full player account
 * Called when spectator wants to register for a tournament
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { user: sessionUser } = authResult;

    // Check if user is a FAN (spectator) account
    if (sessionUser.accountTier !== AccountTier.FAN) {
      return NextResponse.json(
        { error: 'Account is already a full player account' },
        { status: 400 }
      );
    }

    // Convert spectator to full account
    const result = await convertSpectatorToFull(sessionUser.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to upgrade account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Account upgraded successfully! You can now register for tournaments.',
      user: {
        id: sessionUser.id,
        accountTier: AccountTier.PLAYER,
      },
    });
  } catch (error) {
    console.error('Upgrade error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
