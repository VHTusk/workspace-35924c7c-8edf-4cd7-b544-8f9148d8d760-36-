import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, requirePlayer } from '@/lib/auth/rbac';
import { 
  createRazorpayRefund, 
  calculateRefundAmount, 
  formatAmount 
} from '@/lib/payments/razorpay';
import { createNotification } from '@/lib/notifications';
import { RegistrationStatus, TournamentStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST - Process a refund
 * 
 * Use cases:
 * 1. Player withdraws from tournament
 * 2. Admin refunds player due to tournament cancellation
 * 3. Admin refunds player due to dispute resolution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      type, 
      tournamentId, 
      userId, 
      reason,
      refundPolicy = 'partial', // 'full', 'partial', 'none'
    } = body;

    // Validate required fields
    if (!type || !['withdrawal', 'cancellation', 'dispute', 'admin'].includes(type)) {
      return NextResponse.json({ error: 'Invalid refund type' }, { status: 400 });
    }

    // Admin-only refund types
    if (['cancellation', 'dispute', 'admin'].includes(type)) {
      const roleCheck = await requireRole(['ADMIN', 'TOURNAMENT_DIRECTOR', 'SUB_ADMIN']);
      if ('error' in roleCheck) return roleCheck.error;
    }

    // Player withdrawal requires authentication
    if (type === 'withdrawal') {
      const authCheck = await requirePlayer();
      if ('error' in authCheck) return authCheck.error;
      
      // Players can only refund themselves
      if (userId && body.userId !== authCheck.user.id) {
        const roleCheck = await requireRole(['ADMIN', 'TOURNAMENT_DIRECTOR']);
        if ('error' in roleCheck) return roleCheck.error;
      }
    }

    // Validate tournament exists
    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID required' }, { status: 400 });
    }

    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        registrations: {
          where: userId ? { userId } : { status: RegistrationStatus.CONFIRMED },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Cannot refund if tournament is completed
    if (tournament.status === TournamentStatus.COMPLETED) {
      return NextResponse.json({ 
        error: 'Cannot process refund for completed tournament' 
      }, { status: 400 });
    }

    const registrations = tournament.registrations;
    
    if (registrations.length === 0) {
      return NextResponse.json({ error: 'No registrations found' }, { status: 400 });
    }

    // Process refunds
    const results = [];

    for (const registration of registrations) {
      // Skip if no payment
      if (!registration.paymentId) {
        results.push({
          userId: registration.userId,
          status: 'skipped',
          reason: 'No payment associated',
        });
        continue;
      }

      // Check if already refunded
      if (registration.refundId) {
        results.push({
          userId: registration.userId,
          status: 'skipped',
          reason: 'Already refunded',
          refundId: registration.refundId,
        });
        continue;
      }

      // Get payment ledger
      const paymentLedger = await db.paymentLedger.findFirst({
        where: { 
          razorpayPaymentId: registration.paymentId,
          status: 'PAID',
        },
      });

      if (!paymentLedger) {
        results.push({
          userId: registration.userId,
          status: 'skipped',
          reason: 'Payment ledger not found',
        });
        continue;
      }

      // Calculate refund amount
      const refundCalc = calculateRefundAmount(
        registration.amount,
        tournament.startDate,
        new Date(),
        refundPolicy as 'full' | 'partial' | 'none'
      );

      if (refundCalc.amount === 0) {
        results.push({
          userId: registration.userId,
          status: 'skipped',
          reason: refundCalc.reason,
        });
        continue;
      }

      try {
        // Process refund with Razorpay
        const razorpayRefund = await createRazorpayRefund({
          paymentId: registration.paymentId,
          amount: refundCalc.amount,
          notes: {
            reason,
            tournamentId,
            userId: registration.userId,
            type,
          },
          receipt: `REFUND_${Date.now()}_${uuidv4().slice(0, 8)}`,
        });

        // Update database
        await db.$transaction(async (tx) => {
          // Update registration
          await tx.tournamentRegistration.update({
            where: { id: registration.id },
            data: {
              status: RegistrationStatus.CANCELLED,
              refundId: razorpayRefund.id,
              refundAmount: refundCalc.amount,
              cancelledAt: new Date(),
              withdrawalReason: reason,
            },
          });

          // Update payment ledger
          await tx.paymentLedger.update({
            where: { id: paymentLedger.id },
            data: {
              status: 'REFUNDED',
              refundId: razorpayRefund.id,
              refundAmount: refundCalc.amount,
              refundedAt: new Date(),
            },
          });
        });

        // Create notification
        await createNotification({
          userId: registration.userId,
          sport: tournament.sport,
          type: 'REFUND_PROCESSED',
          title: 'Refund Processed',
          message: `Your refund of ${formatAmount(refundCalc.amount)} for ${tournament.name} has been processed. ${refundCalc.reason}`,
          sendEmail: true,
          emailData: {
            tournamentName: tournament.name,
            refundAmount: formatAmount(refundCalc.amount),
            refundPercentage: refundCalc.percentage,
            reason,
            refundId: razorpayRefund.id,
          },
        });

        results.push({
          userId: registration.userId,
          status: 'success',
          refundId: razorpayRefund.id,
          amount: refundCalc.amount,
          percentage: refundCalc.percentage,
          reason: refundCalc.reason,
        });

      } catch (refundError) {
        console.error('Refund processing failed:', refundError);
        results.push({
          userId: registration.userId,
          status: 'failed',
          error: refundError instanceof Error ? refundError.message : 'Refund processing failed',
        });
      }
    }

    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    const skipped = results.filter(r => r.status === 'skipped');

    return NextResponse.json({
      success: successful.length > 0,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        skipped: skipped.length,
        totalRefunded: successful.reduce((sum, r) => sum + (r.amount || 0), 0),
      },
      results,
    });

  } catch (error) {
    console.error('Refund API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get refund status for a registration
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tournamentId = url.searchParams.get('tournamentId');
    const userId = url.searchParams.get('userId');

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID required' }, { status: 400 });
    }

    // Require authentication
    const authCheck = await requirePlayer();
    if ('error' in authCheck) return authCheck.error;

    // Admins can view any refund, players only their own
    const isAdmin = ['ADMIN', 'TOURNAMENT_DIRECTOR', 'SUB_ADMIN'].includes(authCheck.user.role);
    const targetUserId = isAdmin && userId ? userId : authCheck.user.id;

    const registration = await db.tournamentRegistration.findFirst({
      where: {
        tournamentId,
        userId: targetUserId,
      },
      include: {
        tournament: {
          select: { name: true, startDate: true },
        },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // Calculate potential refund
    const refundCalc = calculateRefundAmount(
      registration.amount,
      registration.tournament.startDate
    );

    return NextResponse.json({
      registration: {
        id: registration.id,
        status: registration.status,
        amount: registration.amount,
        amountFormatted: formatAmount(registration.amount),
        paymentId: registration.paymentId,
        refundId: registration.refundId,
        refundAmount: registration.refundAmount,
        refundAmountFormatted: registration.refundAmount 
          ? formatAmount(registration.refundAmount) 
          : null,
        refundedAt: registration.cancelledAt,
      },
      tournament: {
        name: registration.tournament.name,
        startDate: registration.tournament.startDate,
      },
      potentialRefund: registration.refundId ? null : {
        amount: refundCalc.amount,
        percentage: refundCalc.percentage,
        reason: refundCalc.reason,
        amountFormatted: formatAmount(refundCalc.amount),
      },
      canWithdraw: !registration.refundId && 
        registration.status === RegistrationStatus.CONFIRMED &&
        refundCalc.amount > 0,
    });

  } catch (error) {
    console.error('Refund status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
