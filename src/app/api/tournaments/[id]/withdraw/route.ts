import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuditAction, RegistrationStatus, TournamentStatus, WaitlistStatus } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';

// POST - Withdraw from tournament
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check tournament status
    if (tournament.status === TournamentStatus.COMPLETED || tournament.status === TournamentStatus.CANCELLED) {
      return NextResponse.json({ 
        error: 'Cannot withdraw from completed or cancelled tournament' 
      }, { status: 400 });
    }

    // Get registration
    const registration = await db.tournamentRegistration.findFirst({
      where: {
        tournamentId,
        userId: user.id,
        status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.PENDING] },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Not registered for this tournament' }, { status: 404 });
    }

    // Calculate refund amount based on time
    const now = new Date();
    const startDate = new Date(tournament.startDate);
    const hoursUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    let refundPercent = 0;
    if (hoursUntilStart > 48) {
      refundPercent = 100;
    } else if (hoursUntilStart > 24) {
      refundPercent = 50;
    }

    const refundAmount = Math.floor((registration.amount || tournament.entryFee) * refundPercent / 100);

    // Check if bracket already generated
    const bracket = await db.bracket.findUnique({
      where: { tournamentId },
    });

    if (bracket) {
      // If bracket exists, check if player has matches
      const hasMatches = await db.match.findFirst({
        where: {
          tournamentId,
          OR: [
            { playerAId: user.id },
            { playerBId: user.id },
          ],
        },
      });

      if (hasMatches) {
        return NextResponse.json({ 
          error: 'Cannot withdraw after bracket generation. Contact tournament director.' 
        }, { status: 400 });
      }
    }

    // Update registration status
    await db.tournamentRegistration.update({
      where: { id: registration.id },
      data: {
        status: RegistrationStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    // Log audit
    await db.auditLog.create({
      data: {
        sport: tournament.sport,
        action: AuditAction.TOURNAMENT_CANCEL,
        actorId: user.id,
        actorRole: user.role,
        targetType: 'TournamentRegistration',
        targetId: registration.id,
        tournamentId,
        metadata: JSON.stringify({
          action: 'WITHDRAWAL',
          reason: reason || null,
          refundPercent,
          refundAmount,
        }),
      },
    });

    // Promote from waitlist if applicable
    const waitlistEntry = await db.tournamentWaitlist.findFirst({
      where: {
        tournamentId,
        status: WaitlistStatus.WAITING,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (waitlistEntry) {
      // Promote to PROMOTED status with 24-hour expiry
      await db.tournamentWaitlist.update({
        where: { id: waitlistEntry.id },
        data: {
          status: WaitlistStatus.PROMOTED,
          promotedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // Create notification for promoted player
      await db.notification.create({
        data: {
          userId: waitlistEntry.userId,
          sport: tournament.sport,
          type: 'WAITLIST_PROMOTED',
          title: 'Spot Available!',
          message: `A spot has opened up in ${tournament.name}. You have 24 hours to confirm.`,
          link: `/${tournament.sport.toLowerCase()}/tournaments/${tournamentId}/waitlist`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      refund: {
        percent: refundPercent,
        amount: refundAmount,
      },
      message: refundAmount > 0 
        ? `Successfully withdrawn. Refund of ₹${refundAmount} will be processed.`
        : 'Successfully withdrawn. No refund available.',
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
