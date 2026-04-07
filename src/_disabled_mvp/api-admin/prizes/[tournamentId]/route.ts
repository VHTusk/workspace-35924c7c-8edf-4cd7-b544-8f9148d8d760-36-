import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuditAction } from '@prisma/client';

// Default prize distribution percentages for top positions
const DEFAULT_DISTRIBUTION = [
  { position: 1, percentage: 50, label: '1st Place' },
  { position: 2, percentage: 30, label: '2nd Place' },
  { position: 3, percentage: 20, label: '3rd Place' },
];

// GET - Prize details and standings for a tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params;

    // Get tournament with results and payouts
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        results: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                city: true,
                state: true,
              },
            },
          },
          orderBy: { rank: 'asc' },
        },
        prizePayouts: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            markedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        registrations: {
          where: { status: 'CONFIRMED' },
          select: { id: true },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Calculate prize amounts based on results
    const distribution = DEFAULT_DISTRIBUTION;
    const prizeCalculation = tournament.results.map((result, index) => {
      const position = index + 1;
      const dist = distribution.find((d) => d.position === position);
      const percentage = dist?.percentage || 0;
      const amount = Math.floor((tournament.prizePool * percentage) / 100);
      
      // Check if already paid
      const payout = tournament.prizePayouts.find((p) => p.userId === result.userId);
      
      return {
        position,
        userId: result.userId,
        user: result.user,
        rank: result.rank,
        bonusPoints: result.bonusPoints,
        percentage,
        amount,
        isPaid: !!payout,
        payout: payout
          ? {
              id: payout.id,
              amount: payout.amount,
              method: payout.method,
              reference: payout.reference,
              paidAt: payout.paidAt,
              markedBy: payout.markedBy,
            }
          : null,
      };
    });

    // Calculate totals
    const totalPaidOut = tournament.prizePayouts.reduce((sum, p) => sum + p.amount, 0);
    const pendingPayout = tournament.prizePool - totalPaidOut;
    const paidCount = tournament.prizePayouts.length;
    const pendingCount = prizeCalculation.filter((p) => p.amount > 0 && !p.isPaid).length;

    // Non-monetary prizes tracking
    const nonMonetaryPrizes = [
      { position: 1, type: 'TROPHY', description: 'Winner Trophy', awarded: tournament.results.length >= 1 },
      { position: 2, type: 'TROPHY', description: 'Runner-up Trophy', awarded: tournament.results.length >= 2 },
      { position: 3, type: 'MEDAL', description: 'Third Place Medal', awarded: tournament.results.length >= 3 },
    ];

    return NextResponse.json({
      success: true,
      data: {
        tournament: {
          id: tournament.id,
          name: tournament.name,
          sport: tournament.sport,
          type: tournament.type,
          status: tournament.status,
          prizePool: tournament.prizePool,
          startDate: tournament.startDate,
          endDate: tournament.endDate,
          location: tournament.location,
          registrationsCount: tournament.registrations.length,
        },
        distribution,
        prizeCalculation,
        nonMonetaryPrizes,
        stats: {
          totalPaidOut,
          pendingPayout,
          paidCount,
          pendingCount,
          totalWinners: prizeCalculation.filter((p) => p.amount > 0).length,
        },
      },
    });
  } catch (error) {
    console.error('[API] Error fetching prize details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch prize details' },
      { status: 500 }
    );
  }
}

// PUT - Update prize configuration and mark payouts
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params;
    const body = await request.json();
    const {
      distributions,
      markPayout,
      payoutId,
      payoutUserId,
      amount,
      method,
      reference,
      adminId,
    } = body;

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Validate distributions if provided
    if (distributions && distributions.length > 0) {
      const totalPercentage = distributions.reduce(
        (sum: number, d: { percentage: number }) => sum + d.percentage,
        0
      );
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return NextResponse.json(
          { success: false, error: 'Distribution percentages must total 100%' },
          { status: 400 }
        );
      }
    }

    // Mark payout as completed
    if (markPayout && payoutUserId && amount && method && adminId) {
      // Check if payout already exists
      const existingPayout = await db.prizePayoutRecord.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId: payoutUserId,
          },
        },
      });

      if (existingPayout) {
        return NextResponse.json(
          { success: false, error: 'Payout already recorded for this user' },
          { status: 400 }
        );
      }

      // Create payout record
      const payout = await db.prizePayoutRecord.create({
        data: {
          tournamentId,
          userId: payoutUserId,
          sport: tournament.sport,
          amount,
          method,
          reference: reference || null,
          paidAt: new Date(),
          markedById: adminId,
        },
      });

      // Create audit log
      await db.auditLog.create({
        data: {
          sport: tournament.sport,
          action: AuditAction.PRIZE_PAYOUT_RECORDED,
          actorId: adminId,
          actorRole: 'ADMIN',
          targetType: 'PRIZE_PAYOUT',
          targetId: payout.id,
          tournamentId,
          metadata: JSON.stringify({
            amount,
            method,
            reference,
            userId: payoutUserId,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          payout,
          message: 'Payout recorded successfully',
        },
      });
    }

    // Update payout reference
    if (payoutId && reference !== undefined) {
      const payout = await db.prizePayoutRecord.update({
        where: { id: payoutId },
        data: { reference },
      });

      return NextResponse.json({
        success: true,
        data: {
          payout,
          message: 'Payout reference updated',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Prize configuration updated',
        distributions: distributions || DEFAULT_DISTRIBUTION,
      },
    });
  } catch (error) {
    console.error('[API] Error updating prize configuration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update prize configuration' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a payout record (for corrections)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const payoutId = searchParams.get('payoutId');
    const adminId = searchParams.get('adminId');

    if (!payoutId || !adminId) {
      return NextResponse.json(
        { success: false, error: 'Payout ID and Admin ID are required' },
        { status: 400 }
      );
    }

    // Get payout record
    const payout = await db.prizePayoutRecord.findUnique({
      where: { id: payoutId },
      include: { tournament: true },
    });

    if (!payout || payout.tournamentId !== tournamentId) {
      return NextResponse.json(
        { success: false, error: 'Payout record not found' },
        { status: 404 }
      );
    }

    // Delete payout record
    await db.prizePayoutRecord.delete({
      where: { id: payoutId },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        sport: payout.sport,
        action: AuditAction.ADMIN_OVERRIDE,
        actorId: adminId,
        actorRole: 'ADMIN',
        targetType: 'PRIZE_PAYOUT',
        targetId: payoutId,
        tournamentId,
        metadata: JSON.stringify({
          action: 'DELETED',
          amount: payout.amount,
          userId: payout.userId,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Payout record deleted',
      },
    });
  } catch (error) {
    console.error('[API] Error deleting payout record:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete payout record' },
      { status: 500 }
    );
  }
}
