import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, TournamentStatus, AuditAction, SportType, TournamentScope } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { canCompleteTournament, validateTransition, isTerminalStatus } from '@/lib/tournament-state-machine';
import { checkTDAssignment } from '@/lib/td-scoping';
import { checkAdminPermission, type PermissionKey } from '@/lib/admin-permissions';
import { log, tournamentLog } from '@/lib/logger';

// Admin completes a tournament - triggers cascade of finalization steps
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

    // Only ADMIN and SUB_ADMIN can complete tournaments (not TD)
    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized. Only admins can complete tournaments.' }, { status: 403 });
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
                  match: {
                    include: {
                      playerA: { select: { id: true, firstName: true, lastName: true } },
                      playerB: { select: { id: true, firstName: true, lastName: true } },
                    },
                  },
                },
              },
            },
          },
          registrations: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  visiblePoints: true,
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
      if (isTerminalStatus(tournament.status)) {
        throw new Error(`ALREADY_TERMINAL:${tournament.status}`);
      }

      if (!canCompleteTournament(tournament.status)) {
        throw new Error(`INVALID_STATUS:${tournament.status}`);
      }

      // ============================================
      // State Transition with Validation
      // ============================================
      const transitionResult = validateTransition(tournament.status, TournamentStatus.COMPLETED);
      if (!transitionResult.valid) {
        throw new Error(`INVALID_TRANSITION:${transitionResult.error}`);
      }

      // Get sport rules for bonus points
      const rules = await tx.sportRules.findUnique({
        where: { sport: tournament.sport as SportType },
      });

      if (!rules) {
        throw new Error('SPORT_RULES_NOT_FOUND');
      }

      // Determine final standings from bracket
      const scopeKey = (tournament.scope || TournamentScope.CITY).toLowerCase();
      const bonusPoints: Record<number, number> = {
        1: (rules as Record<string, unknown>)[`${scopeKey}First`] as number || 10,
        2: (rules as Record<string, unknown>)[`${scopeKey}Second`] as number || 6,
        3: (rules as Record<string, unknown>)[`${scopeKey}Third`] as number || 3,
      };

      // Calculate standings from bracket matches
      const standings = calculateStandings(tournament.bracket);

      // Create TournamentResult records and award bonus points
      const results = [];

      for (const standing of standings.slice(0, 3)) {
        if (!standing.playerId) continue;

        // Create tournament result
        const tournamentResult = await tx.tournamentResult.create({
          data: {
            tournamentId: tournament.id,
            userId: standing.playerId,
            sport: tournament.sport as SportType,
            rank: standing.rank,
            bonusPoints: bonusPoints[standing.rank] || 0,
          },
        });

        // Award bonus points to player
        await tx.user.update({
          where: { id: standing.playerId },
          data: {
            visiblePoints: { increment: bonusPoints[standing.rank] || 0 },
          },
        });

        results.push({
          rank: standing.rank,
          playerId: standing.playerId,
          playerName: standing.playerName,
          bonusPoints: bonusPoints[standing.rank] || 0,
        });
      }

      // Update tournament status
      const updatedTournament = await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          status: TournamentStatus.COMPLETED,
        },
      });

      // Log audit with detailed metadata
      await tx.auditLog.create({
        data: {
          sport: tournament.sport as SportType,
          action: AuditAction.TOURNAMENT_COMPLETED,
          actorId: user.id,
          actorRole: user.role as Role,
          targetType: 'Tournament',
          targetId: tournament.id,
          tournamentId: tournament.id,
          metadata: JSON.stringify({
            name: tournament.name,
            previousStatus: tournament.status,
            results,
            totalRegistrations: tournament.registrations.length,
            completedByRole: user.role,
            completedAt: new Date().toISOString(),
          }),
        },
      });

      return {
        tournament: updatedTournament,
        results,
      };
    });

    return NextResponse.json({
      success: true,
      tournament: {
        id: result.tournament.id,
        name: result.tournament.name,
        status: result.tournament.status,
      },
      results: result.results,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMsg === 'TOURNAMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    
    if (errorMsg === 'SPORT_MISMATCH') {
      return NextResponse.json({ error: 'Tournament is for a different sport' }, { status: 400 });
    }
    
    if (errorMsg.startsWith('PERMISSION_DENIED:')) {
      const reason = errorMsg.split(':')[1];
      return NextResponse.json({ 
        error: reason || 'Permission denied',
        escalationRequired: true
      }, { status: 403 });
    }
    
    if (errorMsg.startsWith('ALREADY_TERMINAL:')) {
      const status = errorMsg.split(':')[1];
      return NextResponse.json(
        { error: `Tournament is already ${status.toLowerCase().replace('_', ' ')}` },
        { status: 400 }
      );
    }
    
    if (errorMsg.startsWith('INVALID_STATUS:')) {
      const status = errorMsg.split(':')[1];
      return NextResponse.json(
        { error: `Tournament must be in progress to complete. Current status: ${status}` },
        { status: 400 }
      );
    }
    
    if (errorMsg === 'SPORT_RULES_NOT_FOUND') {
      return NextResponse.json({ error: 'Sport rules not found' }, { status: 500 });
    }
    
    if (errorMsg.startsWith('INVALID_TRANSITION:')) {
      return NextResponse.json({ error: errorMsg.split(':')[1] }, { status: 400 });
    }

    log.errorWithStack('Complete tournament error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Calculate standings from bracket
function calculateStandings(bracket: typeof null | {
  matches: Array<{
    roundNumber: number;
    matchNumber: number;
    status: string;
    winnerId: string | null;
    match: {
      playerA: { id: string; firstName: string; lastName: string } | null;
      playerB: { id: string; firstName: string; lastName: string } | null;
    } | null;
    playerAId: string | null;
    playerBId: string | null;
  }>;
} | null) {
  if (!bracket || !bracket.matches) {
    return [];
  }

  const matches = bracket.matches;
  const totalRounds = Math.max(...matches.map((m) => m.roundNumber));
  const finalMatch = matches.find((m) => m.roundNumber === totalRounds);

  const standings: Array<{ rank: number; playerId: string | null; playerName: string }> = [];

  // 1st place - winner of final
  if (finalMatch?.winnerId) {
    const winner = finalMatch.match?.playerA?.id === finalMatch.winnerId
      ? finalMatch.match.playerA
      : finalMatch.match?.playerB;
    
    if (winner) {
      standings.push({
        rank: 1,
        playerId: winner.id,
        playerName: `${winner.firstName} ${winner.lastName}`,
      });
    }
  }

  // 2nd place - loser of final
  if (finalMatch?.winnerId && finalMatch.match) {
    const loser = finalMatch.match.playerA?.id === finalMatch.winnerId
      ? finalMatch.match.playerB
      : finalMatch.match.playerA;
    
    if (loser) {
      standings.push({
        rank: 2,
        playerId: loser.id,
        playerName: `${loser.firstName} ${loser.lastName}`,
      });
    }
  }

  // 3rd place - losers of semi-finals (simplified - could be a 3rd place match)
  const semiFinalMatches = matches.filter((m) => m.roundNumber === totalRounds - 1);
  for (const sf of semiFinalMatches) {
    if (sf.match && sf.winnerId) {
      const loser = sf.match.playerA?.id === sf.winnerId
        ? sf.match.playerB
        : sf.match.playerA;
      
      if (loser && !standings.some((s) => s.playerId === loser.id)) {
        standings.push({
          rank: 3,
          playerId: loser.id,
          playerName: `${loser.firstName} ${loser.lastName}`,
        });
      }
    }
  }

  return standings;
}
