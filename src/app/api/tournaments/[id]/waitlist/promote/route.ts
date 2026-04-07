import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { WaitlistStatus, SportType, Role, AuditAction } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';

// Admin: Promote next person from waitlist
// This is called when a slot opens (registration cancelled or tournament capacity increased)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id: tournamentId } = await params;

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: { select: { registrations: true } },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if there's space
    if (tournament._count.registrations >= tournament.maxPlayers) {
      return NextResponse.json(
        { error: 'Tournament is full. Cannot promote from waitlist.' },
        { status: 400 }
      );
    }

    // Get next person on waitlist (FIFO)
    const nextInLine = await db.tournamentWaitlist.findFirst({
      where: {
        tournamentId,
        status: WaitlistStatus.WAITING,
      },
      orderBy: { position: 'asc' },
    });

    if (!nextInLine) {
      return NextResponse.json(
        { error: 'No one on waitlist' },
        { status: 400 }
      );
    }

    const nextUser = await db.user.findUnique({
      where: { id: nextInLine.userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!nextUser) {
      return NextResponse.json({ error: 'Waitlist user not found' }, { status: 404 });
    }

    // Promote the user - give them 24 hours to confirm
    const promoted = await db.tournamentWaitlist.update({
      where: { id: nextInLine.id },
      data: {
        status: WaitlistStatus.PROMOTED,
        promotedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Create notification for promoted user
    await db.notification.create({
      data: {
        userId: nextInLine.userId,
        sport: tournament.sport as SportType,
        type: 'WAITLIST_PROMOTED',
        title: 'Waitlist Promotion!',
        message: `You've been promoted from the waitlist for ${tournament.name}. You have 24 hours to complete registration.`,
        link: `/${tournament.sport.toLowerCase()}/tournaments/${tournament.id}`,
      },
    });

    // Recalculate positions for remaining waitlist - FIXED: Batch update instead of N+1
    const remainingEntries = await db.tournamentWaitlist.findMany({
      where: {
        tournamentId,
        status: WaitlistStatus.WAITING,
        position: { gt: nextInLine.position },
      },
    });

    if (remainingEntries.length > 0) {
      // Batch update all remaining entries
      await db.tournamentWaitlist.updateMany({
        where: {
          id: { in: remainingEntries.map(e => e.id) },
        },
        data: {
          position: { decrement: 1 },
        },
      });
    }

    // Log audit
    await db.auditLog.create({
      data: {
        sport: tournament.sport as SportType,
        action: AuditAction.ADMIN_OVERRIDE,
        actorId: user.id,
        actorRole: user.role as Role,
        targetType: 'Waitlist',
        targetId: nextInLine.id,
        tournamentId,
        metadata: JSON.stringify({
          action: 'WAITLIST_PROMOTED',
          userId: nextInLine.userId,
          userName: `${nextUser.firstName} ${nextUser.lastName}`,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      promoted: {
        id: nextInLine.id,
        userId: nextInLine.userId,
        name: `${nextUser.firstName} ${nextUser.lastName}`,
        email: nextUser.email,
        expiresAt: promoted.expiresAt,
      },
      message: `${nextUser.firstName} ${nextUser.lastName} has been promoted. They have 24 hours to complete registration.`,
    });
  } catch (error) {
    console.error('Waitlist promotion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
