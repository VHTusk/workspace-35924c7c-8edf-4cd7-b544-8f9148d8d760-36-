import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, TournamentStatus, AuditAction, SportType } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { canStartTournament, validateTransition } from '@/lib/tournament-state-machine';
import { checkTDAssignment } from '@/lib/td-scoping';
import { checkAdminPermission, type PermissionKey } from '@/lib/admin-permissions';
import { log, tournamentLog } from '@/lib/logger';

// Start tournament (move from BRACKET_GENERATED to IN_PROGRESS)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = auth;

    // Verify user has appropriate role
    const adminRoles = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id: tournamentId } = await params;

    // ============================================
    // ATOMIC TRANSACTION with all validations
    // ============================================
    const result = await db.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          bracket: {
            include: {
              matches: {
                include: {
                  match: true,
                },
              },
            },
          },
        },
      });

      if (!tournament) {
        throw new Error('TOURNAMENT_NOT_FOUND');
      }

      // ============================================
      // Cross-Sport Isolation Check
      // ============================================
      if (tournament.sport !== user.sport) {
        throw new Error('SPORT_MISMATCH');
      }

      // ============================================
      // TD Authorization Check
      // ============================================
      const tdCheck = await checkTDAssignment(user.id, tournamentId);
      if (!tdCheck.authorized) {
        throw new Error(`TD_UNAUTHORIZED:${tdCheck.error}`);
      }

      // ============================================
      // Permission Check (using new admin permission system)
      // ============================================
      const permissionResult = await checkAdminPermission(
        user.id,
        'canStartTournament' as PermissionKey,
        {
          sport: tournament.sport as SportType,
          tournamentId: tournament.id,
          stateCode: tournament.state || undefined,
          districtName: tournament.district || undefined,
        }
      );

      if (!permissionResult.granted) {
        // Fall back to role-based check if permission system doesn't grant access
        if (user.role !== Role.ADMIN && user.role !== Role.SUB_ADMIN) {
          throw new Error(`PERMISSION_DENIED:${permissionResult.reason || 'Insufficient permissions'}`);
        }
      }

      // ============================================
      // State Machine Validation
      // ============================================
      if (!canStartTournament(tournament.status)) {
        throw new Error(`INVALID_STATUS:${tournament.status}`);
      }

      if (!tournament.bracket) {
        throw new Error('NO_BRACKET');
      }

      // ============================================
      // State Transition with Validation
      // ============================================
      const transitionResult = validateTransition(tournament.status, TournamentStatus.IN_PROGRESS);
      if (!transitionResult.valid) {
        throw new Error(`INVALID_TRANSITION:${transitionResult.error}`);
      }

      // Update tournament status to IN_PROGRESS
      const updated = await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          status: TournamentStatus.IN_PROGRESS,
        },
      });

      // Update all first-round matches to LIVE status where both players are assigned
      const firstRoundMatches = tournament.bracket.matches.filter(
        m => m.roundNumber === 1 && m.playerAId && m.playerBId
      );

      // FIXED: Batch update instead of N+1 loop
      if (firstRoundMatches.length > 0) {
        const firstRoundMatchIds = firstRoundMatches
          .filter(m => m.matchId)
          .map(m => m.id);

        await tx.bracketMatch.updateMany({
          where: { id: { in: firstRoundMatchIds } },
          data: { status: 'LIVE' },
        });
      }

      // Log audit
      await tx.auditLog.create({
        data: {
          sport: tournament.sport as SportType,
          action: AuditAction.ADMIN_OVERRIDE,
          actorId: user.id,
          actorRole: user.role as Role,
          targetType: 'Tournament',
          targetId: tournament.id,
          tournamentId: tournament.id,
          metadata: JSON.stringify({ 
            action: 'STARTED', 
            name: tournament.name,
            firstRoundMatches: firstRoundMatches.length,
            previousStatus: tournament.status,
            newStatus: TournamentStatus.IN_PROGRESS,
            startedByRole: user.role,
          }),
        },
      });

      return {
        tournament: updated,
        firstRoundMatchesCount: firstRoundMatches.length,
      };
    });

    return NextResponse.json({
      success: true,
      tournament: {
        id: result.tournament.id,
        name: result.tournament.name,
        status: result.tournament.status,
        firstRoundMatches: result.firstRoundMatchesCount,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMsg === 'TOURNAMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    
    if (errorMsg === 'SPORT_MISMATCH') {
      return NextResponse.json({ error: 'Tournament is for a different sport' }, { status: 400 });
    }
    
    if (errorMsg.startsWith('TD_UNAUTHORIZED:')) {
      const reason = errorMsg.split(':')[1];
      return NextResponse.json({ error: reason || 'Not authorized for this tournament' }, { status: 403 });
    }
    
    if (errorMsg.startsWith('PERMISSION_DENIED:')) {
      const reason = errorMsg.split(':')[1];
      return NextResponse.json({ 
        error: reason || 'Permission denied',
        escalationRequired: true
      }, { status: 403 });
    }
    
    if (errorMsg.startsWith('INVALID_STATUS:')) {
      const status = errorMsg.split(':')[1];
      return NextResponse.json(
        { error: `Tournament must have bracket generated before starting. Current status: ${status}` },
        { status: 400 }
      );
    }
    
    if (errorMsg === 'NO_BRACKET') {
      return NextResponse.json(
        { error: 'No bracket found. Generate bracket first.' },
        { status: 400 }
      );
    }
    
    if (errorMsg.startsWith('INVALID_TRANSITION:')) {
      return NextResponse.json(
        { error: errorMsg.split(':')[1] },
        { status: 400 }
      );
    }

    log.errorWithStack('Start tournament error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
