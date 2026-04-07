/**
 * Tournament Autopilot Settings API (v3.45.0)
 * 
 * GET: Get autopilot settings for a tournament
 * PATCH: Update autopilot settings for a tournament
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, TournamentStatus } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { getOrgSession } from '@/lib/auth/org-session';

const AUTOPILOT_ADMIN_ROLES: Role[] = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];

// Get autopilot settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        status: true,
        autopilotEnabled: true,
        autoCloseRegistration: true,
        autoGenerateBracket: true,
        autoStartTournament: true,
        autoAdvanceWinner: true,
        autoPromoteWaitlist: true,
        registrationClosedAt: true,
        bracketGeneratedAt: true,
        tournamentStartedAt: true,
        regDeadline: true,
        startDate: true,
        _count: {
          select: {
            registrations: { where: { status: 'CONFIRMED' } },
            waitlist: { where: { status: 'WAITING' } },
            autopilotLogs: true,
          },
        },
        autopilotLogs: {
          orderBy: { executedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    return NextResponse.json({
      autopilot: {
        enabled: tournament.autopilotEnabled,
        autoCloseRegistration: tournament.autoCloseRegistration,
        autoGenerateBracket: tournament.autoGenerateBracket,
        autoStartTournament: tournament.autoStartTournament,
        autoAdvanceWinner: tournament.autoAdvanceWinner,
        autoPromoteWaitlist: tournament.autoPromoteWaitlist,
      },
      status: {
        current: tournament.status,
        registrationClosedAt: tournament.registrationClosedAt,
        bracketGeneratedAt: tournament.bracketGeneratedAt,
        tournamentStartedAt: tournament.tournamentStartedAt,
        registrationCount: tournament._count.registrations,
        waitlistCount: tournament._count.waitlist,
      },
      timeline: {
        regDeadline: tournament.regDeadline,
        startDate: tournament.startDate,
      },
      recentLogs: tournament.autopilotLogs.map((log) => ({
        id: log.id,
        action: log.action,
        status: log.status,
        details: log.details ? JSON.parse(log.details) : null,
        errorMessage: log.errorMessage,
        executedAt: log.executedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching autopilot settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update autopilot settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const body = await request.json();

    // Check authorization - admin or org owner
    const adminAuth = await getAuthenticatedAdmin(request);
    const orgSession = await getOrgSession();

    let isAuthorized = false;
    let actorId = '';

    if (adminAuth) {
      const { user } = adminAuth;
      if (AUTOPILOT_ADMIN_ROLES.includes(user.role)) {
        isAuthorized = true;
        actorId = user.id;
      }
    }

    if (orgSession) {
      const tournament = await db.tournament.findUnique({
        where: { id: tournamentId },
        select: { orgId: true },
      });
      if (tournament?.orgId === orgSession.orgId) {
        isAuthorized = true;
        actorId = orgSession.orgId;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current tournament
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Cannot modify autopilot for completed/cancelled tournaments
    if (tournament.status === TournamentStatus.COMPLETED || tournament.status === TournamentStatus.CANCELLED) {
      return NextResponse.json(
        { error: 'Cannot modify autopilot settings for completed or cancelled tournaments' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (typeof body.autopilotEnabled === 'boolean') {
      updateData.autopilotEnabled = body.autopilotEnabled;
    }
    if (typeof body.autoCloseRegistration === 'boolean') {
      updateData.autoCloseRegistration = body.autoCloseRegistration;
    }
    if (typeof body.autoGenerateBracket === 'boolean') {
      updateData.autoGenerateBracket = body.autoGenerateBracket;
    }
    if (typeof body.autoStartTournament === 'boolean') {
      updateData.autoStartTournament = body.autoStartTournament;
    }
    if (typeof body.autoAdvanceWinner === 'boolean') {
      updateData.autoAdvanceWinner = body.autoAdvanceWinner;
    }
    if (typeof body.autoPromoteWaitlist === 'boolean') {
      updateData.autoPromoteWaitlist = body.autoPromoteWaitlist;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update tournament
    const updated = await db.tournament.update({
      where: { id: tournamentId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      autopilot: {
        enabled: updated.autopilotEnabled,
        autoCloseRegistration: updated.autoCloseRegistration,
        autoGenerateBracket: updated.autoGenerateBracket,
        autoStartTournament: updated.autoStartTournament,
        autoAdvanceWinner: updated.autoAdvanceWinner,
        autoPromoteWaitlist: updated.autoPromoteWaitlist,
      },
    });
  } catch (error) {
    console.error('Error updating autopilot settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
