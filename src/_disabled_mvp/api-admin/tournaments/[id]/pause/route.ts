import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, TournamentStatus, AuditAction, SportType } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { canPauseTournament, validateTransition } from '@/lib/tournament-state-machine';
import { checkTDAssignment } from '@/lib/td-scoping';
import { checkAdminPermission } from '@/lib/admin-permissions';

// Pause tournament (move from IN_PROGRESS to PAUSED)
// Used for weather delays, venue issues, or other temporary suspensions
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
    
    // Parse request body for pause reason
    let reason = 'Paused by admin';
    try {
      const body = await request.json();
      if (body.reason) {
        reason = body.reason;
      }
    } catch {
      // No body provided, use default reason
    }

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
        'canPauseTournament',
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
      if (!canPauseTournament(tournament.status)) {
        throw new Error(`INVALID_STATUS:${tournament.status}`);
      }

      // ============================================
      // State Transition with Validation
      // ============================================
      const transitionResult = validateTransition(tournament.status, TournamentStatus.PAUSED);
      if (!transitionResult.valid) {
        throw new Error(`INVALID_TRANSITION:${transitionResult.error}`);
      }

      // Update tournament status to PAUSED
      const updated = await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          status: TournamentStatus.PAUSED,
        },
      });

      // Count active matches (LIVE status) that will be paused
      const activeMatchesCount = tournament.bracket?.matches.filter(
        m => m.status === 'LIVE'
      ).length || 0;

      // Log audit with pause reason
      await tx.auditLog.create({
        data: {
          sport: tournament.sport as SportType,
          action: AuditAction.ADMIN_OVERRIDE,
          actorId: user.id,
          actorRole: user.role as Role,
          targetType: 'Tournament',
          targetId: tournament.id,
          tournamentId: tournament.id,
          reason: reason,
          metadata: JSON.stringify({ 
            action: 'PAUSED', 
            name: tournament.name,
            activeMatchesPaused: activeMatchesCount,
            previousStatus: tournament.status,
            newStatus: TournamentStatus.PAUSED,
            pausedByRole: user.role,
            pauseReason: reason,
          }),
        },
      });

      return {
        tournament: updated,
        activeMatchesCount,
      };
    });

    return NextResponse.json({
      success: true,
      tournament: {
        id: result.tournament.id,
        name: result.tournament.name,
        status: result.tournament.status,
        activeMatchesPaused: result.activeMatchesCount,
      },
      message: `Tournament paused successfully. ${result.activeMatchesCount} active matches suspended.`,
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
      return NextResponse.json({ error: reason || 'Permission denied' }, { status: 403 });
    }
    
    if (errorMsg.startsWith('INVALID_STATUS:')) {
      const status = errorMsg.split(':')[1];
      return NextResponse.json(
        { error: `Tournament must be in progress to pause. Current status: ${status}` },
        { status: 400 }
      );
    }
    
    if (errorMsg.startsWith('INVALID_TRANSITION:')) {
      return NextResponse.json(
        { error: errorMsg.split(':')[1] },
        { status: 400 }
      );
    }
    
    console.error('Pause tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
