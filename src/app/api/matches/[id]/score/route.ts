import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { BracketMatchStatus, MatchOutcome, TournamentStatus, SportType, TournamentScope, Prisma } from '@prisma/client';
import { getOrgSession } from '@/lib/auth/org-session';
import { triggerMatchResultNotifications, triggerNextMatchAlert } from '@/lib/notification-triggers';
import { completeTournament } from '@/lib/completion-chain';
import { log, matchLog } from '@/lib/logger';
import { 
  hashRequestBody, 
  checkIdempotencyKey, 
  storeIdempotencyKey,
  generateIdempotencyKey,
  type IdempotencyCheckResult 
} from '@/lib/idempotency';

// Org-side match scoring route - ATOMIC TRANSACTION with IDEMPOTENCY PROTECTION
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrgSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Clone request to read body for idempotency check
    const clonedRequest = request.clone();
    const body = await clonedRequest.json();
    const { scoreA, scoreB, winnerId, outcome } = body;
    
    // Generate idempotency key for match scoring
    // Format: match:{matchId}:{orgId}:{scoreA}:{scoreB}:{winnerId}
    const idempotencyKey = generateIdempotencyKey(
      session.orgId,
      'MATCH_RESULT',
      { matchId: id, scoreA, scoreB, winnerId: winnerId || 'auto' }
    );
    
    // Hash request body for verification
    const requestBodyHash = hashRequestBody(body);
    
    // Check for duplicate request
    const idempotencyCheck: IdempotencyCheckResult = await checkIdempotencyKey(
      idempotencyKey,
      requestBodyHash
    );
    
    if (idempotencyCheck.isDuplicate && idempotencyCheck.previousResponse) {
      // Return cached response for duplicate request
      log.info('Idempotent request detected - returning cached response', { 
        matchId: id,
        idempotencyKey 
      });
      return NextResponse.json(idempotencyCheck.previousResponse.body, {
        status: idempotencyCheck.previousResponse.status,
        headers: {
          'X-Idempotent-Replayed': 'true',
        },
      });
    }

    // Get match with tournament info
    const match = await db.match.findUnique({
      where: { id },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            orgId: true,
            sport: true,
            status: true,
            scope: true,
          }
        },
        playerA: { 
          select: { 
            id: true, 
            firstName: true, 
            lastName: true,
            hiddenElo: true,
            visiblePoints: true,
            rating: true,
          } 
        },
        playerB: { 
          select: { 
            id: true, 
            firstName: true, 
            lastName: true,
            hiddenElo: true,
            visiblePoints: true,
            rating: true,
          } 
        },
        bracketMatch: true,
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (!match.tournament) {
      return NextResponse.json({ error: 'Match is not linked to a tournament' }, { status: 400 });
    }

    // CRITICAL: Check if tournament is in progress
    if (match.tournament.status !== TournamentStatus.IN_PROGRESS) {
      return NextResponse.json({ 
        error: 'Cannot score match - tournament is not in progress',
        tournamentStatus: match.tournament.status 
      }, { status: 400 });
    }

    // Verify ownership
    if (match.tournament.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if match already has a result
    if (match.winnerId !== null) {
      return NextResponse.json({ error: 'Match already has a result' }, { status: 400 });
    }

    // Validate match can be scored
    if (!match.playerAId || !match.playerBId || !match.playerA || !match.playerB) {
      return NextResponse.json({ error: 'Match has no players assigned' }, { status: 400 });
    }

    const playerAId = match.playerAId;
    const playerBId = match.playerBId;
    const playerA = match.playerA;
    const playerB = match.playerB;

    // Validate scores
    if (scoreA === undefined || scoreB === undefined) {
      return NextResponse.json({ error: 'Scores are required' }, { status: 400 });
    }

    // Determine winner
    let determinedWinnerId = winnerId;
    let determinedOutcome = (outcome as MatchOutcome) || MatchOutcome.PLAYED;

    if (!determinedWinnerId && determinedOutcome === MatchOutcome.PLAYED) {
      if (scoreA > scoreB) {
        determinedWinnerId = playerAId;
      } else if (scoreB > scoreA) {
        determinedWinnerId = playerBId;
      }
    }

    // Validate winner
    if (determinedWinnerId && determinedWinnerId !== playerAId && determinedWinnerId !== playerBId) {
      return NextResponse.json({ error: 'Invalid winner ID' }, { status: 400 });
    }

    // Calculate ELO changes
    const eloA = playerA.hiddenElo;
    const eloB = playerB.hiddenElo;
    const matchesA = playerA.rating?.matchesPlayed || 0;
    const matchesB = playerB.rating?.matchesPlayed || 0;

    let K = 32;
    if (matchesA >= 100 || matchesB >= 100) K = 16;
    else if (matchesA >= 30 || matchesB >= 30) K = 24;

    const actualA = determinedWinnerId === playerAId ? 1 : 0;
    const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
    const eloChangeA = Math.round(K * (actualA - expectedA) * 10) / 10;
    const eloChangeB = -eloChangeA;

    // Calculate points based on tournament scope
    const tournamentScope = match.tournament?.scope || TournamentScope.CITY;
    let pointsA = 1;
    let pointsB = 1;

    const rules = await db.sportRules.findUnique({
      where: { sport: match.sport as SportType },
    });

    if (rules) {
      const scopeKey = tournamentScope.toLowerCase();
      const participationPoints = (rules as Record<string, unknown>)[`${scopeKey}Participation`] as number || 1;
      const winPoints = (rules as Record<string, unknown>)[`${scopeKey}Win`] as number || 2;

      pointsA = determinedWinnerId === playerAId ? winPoints : participationPoints;
      pointsB = determinedWinnerId === playerBId ? winPoints : participationPoints;
    }

    // ATOMIC TRANSACTION - All scoring operations in one transaction
    const result = await db.$transaction(async (tx) => {
      // Step 1: Update match result
      const updatedMatch = await tx.match.update({
        where: { id },
        data: {
          scoreA,
          scoreB,
          winnerId: determinedWinnerId,
          outcome: determinedOutcome,
          eloChangeA,
          eloChangeB,
          pointsA,
          pointsB,
          tournamentScope,
        },
      });

      // Step 2: Update player A
      await tx.user.update({
        where: { id: playerAId },
        data: {
          hiddenElo: playerA.hiddenElo + eloChangeA,
          visiblePoints: playerA.visiblePoints + pointsA,
        },
      });

      await tx.playerRating.update({
        where: { userId: playerAId },
        data: {
          matchesPlayed: { increment: 1 },
          wins: determinedWinnerId === playerAId ? { increment: 1 } : undefined,
          losses: determinedWinnerId !== playerAId && determinedWinnerId ? { increment: 1 } : undefined,
          highestElo: playerA.hiddenElo + eloChangeA > (playerA.rating?.highestElo || 1500)
            ? playerA.hiddenElo + eloChangeA
            : undefined,
        },
      });

      // Step 3: Update player B
      await tx.user.update({
        where: { id: playerBId },
        data: {
          hiddenElo: playerB.hiddenElo + eloChangeB,
          visiblePoints: playerB.visiblePoints + pointsB,
        },
      });

      await tx.playerRating.update({
        where: { userId: playerBId },
        data: {
          matchesPlayed: { increment: 1 },
          wins: determinedWinnerId === playerBId ? { increment: 1 } : undefined,
          losses: determinedWinnerId !== playerBId && determinedWinnerId ? { increment: 1 } : undefined,
          highestElo: playerB.hiddenElo + eloChangeB > (playerB.rating?.highestElo || 1500)
            ? playerB.hiddenElo + eloChangeB
            : undefined,
        },
      });

      // Step 4: Update bracket match and advance winner if exists
      let tournamentCompleted = false;
      if (match.bracketMatch && determinedWinnerId) {
        await tx.bracketMatch.update({
          where: { id: match.bracketMatch.id },
          data: {
            winnerId: determinedWinnerId,
            status: BracketMatchStatus.COMPLETED,
          },
        });

        // Advance winner to next round
        const nextRound = match.bracketMatch.roundNumber + 1;
        const nextMatchNumber = Math.ceil(match.bracketMatch.matchNumber / 2);

        const nextBracketMatch = await tx.bracketMatch.findFirst({
          where: {
            bracketId: match.bracketMatch.bracketId,
            roundNumber: nextRound,
            matchNumber: nextMatchNumber,
          },
        });

        if (nextBracketMatch) {
          const isPlayerA = match.bracketMatch.matchNumber % 2 === 1;
          
          await tx.bracketMatch.update({
            where: { id: nextBracketMatch.id },
            data: isPlayerA ? { playerAId: determinedWinnerId } : { playerBId: determinedWinnerId },
          });

          // Update the actual match record
          if (nextBracketMatch.matchId) {
            await tx.match.update({
              where: { id: nextBracketMatch.matchId },
              data: isPlayerA ? { playerAId: determinedWinnerId } : { playerBId: determinedWinnerId },
            });
          }
        }

        // Step 5: Check tournament completion
        const allBracketMatches = await tx.bracketMatch.findMany({
          where: { bracketId: match.bracketMatch.bracketId },
        });

        const totalMatches = allBracketMatches.length;
        const completedMatches = allBracketMatches.filter(
          m => m.status === BracketMatchStatus.COMPLETED || m.status === BracketMatchStatus.BYE
        ).length;

        if (totalMatches === completedMatches) {
          const finalMatch = allBracketMatches.find(
            m => m.roundNumber === Math.max(...allBracketMatches.map(m => m.roundNumber))
          );
          
          if (finalMatch?.winnerId) {
            // Create tournament result for the winner
            // Note: Status update is handled by completeTournament after this transaction
            await tx.tournamentResult.create({
              data: {
                tournamentId: match.tournament!.id,
                userId: finalMatch.winnerId,
                sport: match.tournament!.sport as SportType,
                rank: 1,
                bonusPoints: 100,
              },
            });
            
            tournamentCompleted = true;
          }
        }
      }

      return { updatedMatch, tournamentCompleted };
    });

    // Step 6: Handle tournament completion via completion chain
    if (result.tournamentCompleted && match.tournament?.id) {
      try {
        // Call completion chain which handles:
        // - Winner confirmation
        // - Audit logging
        // - Status update to COMPLETED
        const completionResult = await completeTournament(match.tournament.id, {
          confirmedById: session.orgId,
          confirmedByRole: 'ORGANIZATION',
        });

        if (completionResult.success) {
          // Completion succeeded; post-completion recognition is disabled in MVP.
        } else {
          log.error('Tournament completion failed', { 
            tournamentId: match.tournament!.id,
            error: completionResult.error 
          });
        }
      } catch (error) {
        log.error('Error in completion chain', { 
          tournamentId: match.tournament?.id,
          error: error instanceof Error ? error.message : String(error)
        });
        // Don't fail the request - the match was scored successfully
      }
    }

    // Trigger notifications for match result (non-blocking)
    triggerMatchResultNotifications({
      matchId: id,
      tournamentId: match.tournament?.id,
      tournamentName: match.tournament?.name,
      sport: match.sport as SportType,
      playerA: {
        id: match.playerAId!,
        firstName: match.playerA!.firstName,
        lastName: match.playerA!.lastName,
        isWinner: determinedWinnerId === match.playerAId,
        score: scoreA,
        pointsEarned: pointsA,
        eloChange: eloChangeA,
      },
      playerB: {
        id: match.playerBId!,
        firstName: match.playerB!.firstName,
        lastName: match.playerB!.lastName,
        isWinner: determinedWinnerId === match.playerBId,
        score: scoreB,
        pointsEarned: pointsB,
        eloChange: eloChangeB,
      },
    }).catch(error => {
      log.error('Failed to trigger match result notifications', { 
        matchId: id,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    // Prepare response
    const responsePayload = {
      success: true,
      match: {
        id: result.updatedMatch.id,
        scoreA: result.updatedMatch.scoreA,
        scoreB: result.updatedMatch.scoreB,
        winnerId: result.updatedMatch.winnerId,
        eloChangeA,
        eloChangeB,
        pointsA,
        pointsB,
      },
      tournamentCompleted: result.tournamentCompleted,
    };

    // Store idempotency key with the successful response
    await storeIdempotencyKey(
      idempotencyKey,
      'MATCH_RESULT',
      result.updatedMatch.id,
      requestBodyHash,
      responsePayload
    );

    return NextResponse.json(responsePayload);
  } catch (error) {
    log.errorWithStack('Error scoring match', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to score match' }, { status: 500 });
  }
}
