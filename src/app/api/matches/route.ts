import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession, calculateEloChange, getEloTier } from '@/lib/auth';
import { MatchOutcome, TournamentStatus, Role, AuditAction, SportType } from '@prisma/client';
import { canScoreMatches, canModifyTournament, validateTransition } from '@/lib/tournament-state-machine';
import { checkTDAssignment, canModifyMatch } from '@/lib/td-scoping';
import { log, matchLog } from '@/lib/logger';

// GET matches for a tournament or user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const sport = searchParams.get('sport');

    const where: Record<string, unknown> = {};

    if (tournamentId) {
      where.tournamentId = tournamentId;
    }

    if (userId) {
      where.OR = [
        { playerAId: userId },
        { playerBId: userId },
      ];
    }

    if (status) {
      where.outcome = status as MatchOutcome;
    }

    // Cross-sport isolation: filter by sport if provided
    if (sport) {
      where.sport = sport as SportType;
    }

    const matches = await db.match.findMany({
      where,
      include: {
        playerA: { select: { id: true, firstName: true, lastName: true, hiddenElo: true } },
        playerB: { select: { id: true, firstName: true, lastName: true, hiddenElo: true } },
        tournament: { select: { id: true, name: true, scope: true, sport: true } },
        bracketMatch: true,
      },
      orderBy: { playedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ matches });
  } catch (error) {
    log.errorWithStack('Error fetching matches', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Submit match result with concurrency safety
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const adminToken = request.cookies.get('admin_session')?.value;
    
    const sessionToken = adminToken || token;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { matchId, scoreA, scoreB, outcome, outcomeReason, rowVersion } = body;

    if (!matchId) {
      return NextResponse.json({ error: 'Match ID is required' }, { status: 400 });
    }

    // Validate outcome
    const validOutcomes = ['PLAYED', 'WALKOVER', 'NO_SHOW', 'FORFEIT', 'BYE'];
    if (!outcome || !validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}` },
        { status: 400 }
      );
    }

    // ============================================
    // ATOMIC TRANSACTION with Row Version Check
    // ============================================
    const result = await db.$transaction(async (tx) => {
      // Get the match with row lock and row version
      const match = await tx.$queryRaw<Array<{
        id: string;
        rowVersion: number;
        sport: SportType;
        playerAId: string | null;
        playerBId: string | null;
        winnerId: string | null;
        outcome: MatchOutcome | null;
        tournamentId: string | null;
        hiddenEloA: number | null;
        hiddenEloB: number | null;
        tournamentStatus: TournamentStatus | null;
        tournamentScope: string | null;
        tournamentName: string | null;
        playerARatingMatches: number | null;
        playerBRatingMatches: number | null;
      }>>`
        SELECT 
          m.id, m.rowVersion, m.sport, m.playerAId, m.playerBId, m.winnerId, m.outcome,
          m.tournamentId, 
          uA.hiddenElo as hiddenEloA, 
          uB.hiddenEloB as hiddenEloB,
          t.status as tournamentStatus,
          t.scope as tournamentScope,
          t.name as tournamentName,
          prA.matchesPlayed as playerARatingMatches,
          prB.matchesPlayed as playerBRatingMatches
        FROM Match m
        LEFT JOIN User uA ON m.playerAId = uA.id
        LEFT JOIN User uB ON m.playerBId = uB.id
        LEFT JOIN Tournament t ON m.tournamentId = t.id
        LEFT JOIN PlayerRating prA ON uA.id = prA.userId
        LEFT JOIN PlayerRating prB ON uB.id = prB.userId
        WHERE m.id = ${matchId}
      `;

      if (!match || match.length === 0) {
        throw new Error('MATCH_NOT_FOUND');
      }

      const matchData = match[0];

      // ============================================
      // Concurrency Safety: Row Version Check
      // ============================================
      if (rowVersion !== undefined && matchData.rowVersion !== rowVersion) {
        throw new Error('CONCURRENT_MODIFICATION');
      }

      // ============================================
      // Tournament State Machine Validation
      // ============================================
      if (matchData.tournamentStatus) {
        if (!canScoreMatches(matchData.tournamentStatus as TournamentStatus)) {
          throw new Error(`TOURNAMENT_NOT_SCORABLE:${matchData.tournamentStatus}`);
        }
      }

      // ============================================
      // TD Authorization Check
      // ============================================
      if (matchData.tournamentId) {
        const tdCheck = await checkTDAssignment(session.user!.id, matchData.tournamentId);
        if (!tdCheck.authorized) {
          throw new Error(`TD_UNAUTHORIZED:${tdCheck.error}`);
        }

        // Check if match can be modified (not in completed tournament)
        const modifyCheck = await canModifyMatch(session.user!.id, matchId);
        if (!modifyCheck.authorized) {
          throw new Error(`MATCH_NOT_MODIFIABLE:${modifyCheck.error}`);
        }
      }

      // ============================================
      // Check for duplicate result (idempotency)
      // ============================================
      if (matchData.outcome && matchData.winnerId) {
        // Match already has result - this is an edit, require ADMIN/SUB_ADMIN
        const userRole = session.user!.role;
        if (userRole !== Role.ADMIN && userRole !== Role.SUB_ADMIN) {
          throw new Error('MATCH_ALREADY_SCORED');
        }
      }

      // Determine winner
      let winnerId: string | null = null;
      if (outcome === 'PLAYED' && scoreA !== null && scoreB !== null) {
        winnerId = scoreA > scoreB ? matchData.playerAId : matchData.playerBId;
      } else if (outcome === 'WALKOVER' || outcome === 'NO_SHOW' || outcome === 'FORFEIT') {
        // For non-played outcomes, winner must be specified in body
        winnerId = body.winnerId || matchData.playerAId;
      } else if (outcome === 'BYE') {
        winnerId = matchData.playerAId;
      }

      // Calculate Elo changes
      let eloChangeA = 0;
      let eloChangeB = 0;
      let pointsA = 0;
      let pointsB = 0;

      if (matchData.playerBId && matchData.tournamentId) {
        if (outcome === 'PLAYED' && matchData.hiddenEloA && matchData.hiddenEloB) {
          const actualA = winnerId === matchData.playerAId ? 1 : 0;
          const eloResult = calculateEloChange(
            matchData.hiddenEloA,
            matchData.hiddenEloB,
            actualA,
            matchData.playerARatingMatches || 0,
            matchData.playerBRatingMatches || 0
          );
          eloChangeA = eloResult.eloChangeA;
          eloChangeB = eloResult.eloChangeB;
        }

        // Calculate points based on tournament scope
        const scope = matchData.tournamentScope || 'CITY';
        const sportRules = await tx.sportRules.findUnique({
          where: { sport: matchData.sport },
        });

        if (sportRules) {
          const scopeKey = scope.toLowerCase();
          const participationKey = `${scopeKey}Participation` as keyof typeof sportRules;
          const winKey = `${scopeKey}Win` as keyof typeof sportRules;

          const participationPoints = (sportRules[participationKey] as number) || 1;
          const winPoints = (sportRules[winKey] as number) || 2;

          pointsA = participationPoints;
          pointsB = participationPoints;

          if (winnerId === matchData.playerAId) {
            pointsA += winPoints;
          } else if (winnerId === matchData.playerBId) {
            pointsB += winPoints;
          }
        }
      }

      // ============================================
      // Update match with row version increment
      // ============================================
      const updateResult = await tx.$executeRaw`
        UPDATE Match 
        SET 
          scoreA = ${scoreA},
          scoreB = ${scoreB},
          winnerId = ${winnerId},
          outcome = ${outcome as MatchOutcome},
          outcomeReason = ${outcomeReason || null},
          pointsA = ${pointsA},
          pointsB = ${pointsB},
          tournamentScope = ${matchData.tournamentScope as TournamentStatus},
          eloChangeA = ${eloChangeA},
          eloChangeB = ${eloChangeB},
          updatedById = ${session.user!.id},
          updatedAt = CURRENT_TIMESTAMP,
          rowVersion = rowVersion + 1
        WHERE id = ${matchId} AND rowVersion = ${matchData.rowVersion}
      `;

      if (updateResult === 0) {
        throw new Error('CONCURRENT_MODIFICATION');
      }

      // Update player Elo and points
      if (matchData.playerBId) {
        await tx.user.update({
          where: { id: matchData.playerAId! },
          data: {
            hiddenElo: { increment: eloChangeA },
            visiblePoints: { increment: pointsA },
          },
        });

        await tx.user.update({
          where: { id: matchData.playerBId },
          data: {
            hiddenElo: { increment: eloChangeB },
            visiblePoints: { increment: pointsB },
          },
        });

        // Update player ratings
        const isWinnerA = winnerId === matchData.playerAId;
        
        await tx.playerRating.upsert({
          where: { userId: matchData.playerAId! },
          update: {
            matchesPlayed: { increment: 1 },
            wins: isWinnerA ? { increment: 1 } : undefined,
            losses: !isWinnerA ? { increment: 1 } : undefined,
          },
          create: { 
            userId: matchData.playerAId!, 
            sport: matchData.sport,
            matchesPlayed: 1,
            wins: isWinnerA ? 1 : 0,
            losses: isWinnerA ? 0 : 1,
          },
        });

        await tx.playerRating.upsert({
          where: { userId: matchData.playerBId },
          update: {
            matchesPlayed: { increment: 1 },
            wins: !isWinnerA ? { increment: 1 } : undefined,
            losses: isWinnerA ? { increment: 1 } : undefined,
          },
          create: { 
            userId: matchData.playerBId, 
            sport: matchData.sport,
            matchesPlayed: 1,
            wins: !isWinnerA ? 1 : 0,
            losses: isWinnerA ? 0 : 1,
          },
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          sport: matchData.sport,
          action: matchData.outcome ? AuditAction.MATCH_RESULT_EDITED : AuditAction.MATCH_RESULT_ENTERED,
          actorId: session.user!.id,
          actorRole: session.user!.role as Role,
          targetType: 'Match',
          targetId: matchId,
          tournamentId: matchData.tournamentId,
          metadata: JSON.stringify({ 
            scoreA, 
            scoreB, 
            winnerId, 
            outcome,
            previousOutcome: matchData.outcome,
            pointsA,
            pointsB,
            eloChangeA,
            eloChangeB,
            rowVersion: matchData.rowVersion + 1,
          }),
        },
      });

      return {
        matchId,
        winnerId,
        pointsA,
        pointsB,
        eloChangeA,
        eloChangeB,
        newRowVersion: matchData.rowVersion + 1,
        tournamentId: matchData.tournamentId,
        tournamentName: matchData.tournamentName,
        sport: matchData.sport,
        playerAId: matchData.playerAId,
        playerBId: matchData.playerBId,
      };
    }, {
      // Set transaction isolation level for concurrent access
      // SQLite doesn't support different isolation levels, but we use row version pattern
    });

    return NextResponse.json({
      success: true,
      match: {
        id: result.matchId,
        winnerId: result.winnerId,
        rowVersion: result.newRowVersion,
      },
      points: { playerA: result.pointsA, playerB: result.pointsB },
      eloChanges: { playerA: result.eloChangeA, playerB: result.eloChangeB },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle specific errors
    if (errorMsg === 'MATCH_NOT_FOUND') {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
    
    if (errorMsg === 'CONCURRENT_MODIFICATION') {
      return NextResponse.json(
        { error: 'Match was modified by another user. Please refresh and try again.', code: 'CONCURRENT_MODIFICATION' },
        { status: 409 }
      );
    }
    
    if (errorMsg.startsWith('TOURNAMENT_NOT_SCORABLE:')) {
      const status = errorMsg.split(':')[1];
      return NextResponse.json(
        { error: `Cannot score matches in a tournament with status: ${status}` },
        { status: 400 }
      );
    }
    
    if (errorMsg.startsWith('TD_UNAUTHORIZED:')) {
      const reason = errorMsg.split(':')[1];
      return NextResponse.json(
        { error: reason || 'Not authorized for this tournament' },
        { status: 403 }
      );
    }
    
    if (errorMsg.startsWith('MATCH_NOT_MODIFIABLE:')) {
      const reason = errorMsg.split(':')[1];
      return NextResponse.json(
        { error: reason || 'Match cannot be modified' },
        { status: 403 }
      );
    }
    
    if (errorMsg === 'MATCH_ALREADY_SCORED') {
      return NextResponse.json(
        { error: 'Match already has a result. Only admins can edit results.', code: 'MATCH_ALREADY_SCORED' },
        { status: 400 }
      );
    }

    log.errorWithStack('Error submitting match result', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
