import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TournamentStatus, BracketMatchStatus, BracketFormat, SportType } from '@prisma/client';
import { getOrgSession } from '@/lib/auth/org-session';
import { generateSeedings, SeedingOptions } from '@/lib/seeding';
import { log, tournamentLog } from '@/lib/logger';
import { 
  initializeSwissTournament, 
  generateSwissRound, 
  calculateSwissRounds,
  generateSwissPairings 
} from '@/lib/swiss-pairing';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const session = await getOrgSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        registrations: {
          where: { status: 'CONFIRMED' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                hiddenElo: true,
                affiliatedOrgId: true,
              }
            }
          }
        },
        bracket: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Verify ownership
    if (tournament.orgId && tournament.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if bracket already exists
    if (tournament.bracket) {
      return NextResponse.json({ error: 'Bracket already generated' }, { status: 400 });
    }

    // Get confirmed players
    const players = tournament.registrations.map(r => ({
      id: r.userId,
      name: `${r.user.firstName} ${r.user.lastName}`,
      elo: r.user.hiddenElo || 1500,
      orgId: r.user.affiliatedOrgId,
    }));

    if (players.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 players to generate bracket' }, { status: 400 });
    }

    const bracketFormat = tournament.bracketFormat || BracketFormat.SINGLE_ELIMINATION;
    
    // Handle Swiss format separately
    if (bracketFormat === BracketFormat.SWISS) {
      return await generateSwissBracket(tournament, players, session.orgId);
    }

    // Handle elimination brackets (Single, Double)
    return await generateEliminationBracket(tournament, players, body, session.orgId);

  } catch (error) {
    log.errorWithStack('Error generating bracket', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to generate bracket', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Generate Swiss tournament bracket
 */
async function generateSwissBracket(
  tournament: any,
  players: any[],
  orgId: string
): Promise<NextResponse> {
  const totalRounds = calculateSwissRounds(players.length);

  // Create bracket with SWISS format
  const bracket = await db.bracket.create({
    data: {
      tournamentId: tournament.id,
      format: BracketFormat.SWISS,
      totalRounds,
      seedingMethod: 'SWISS',
      generatedById: orgId || 'system',
    },
  });

  // Generate first round pairings
  const pairingsResult = await generateSwissPairings(tournament.id, 1);

  if (!pairingsResult.success) {
    // Clean up and return error
    await db.bracket.delete({ where: { id: bracket.id } });
    return NextResponse.json(
      { error: 'Failed to generate Swiss pairings', warnings: pairingsResult.warnings },
      { status: 500 }
    );
  }

  // Create matches from pairings
  let matchNumber = 1;
  const matchIds: string[] = [];

  for (const pairing of pairingsResult.pairings) {
    if (pairing.isBye) {
      // Create bye match
      const match = await db.match.create({
        data: {
          sport: tournament.sport,
          tournamentId: tournament.id,
          playerAId: pairing.playerAId,
          playerBId: null,
          outcome: 'BYE',
          winnerId: pairing.playerAId,
        },
      });

      await db.bracketMatch.create({
        data: {
          bracketId: bracket.id,
          matchId: match.id,
          roundNumber: 1,
          matchNumber: matchNumber++,
          playerAId: pairing.playerAId,
          playerBId: null,
          status: BracketMatchStatus.BYE,
          winnerId: pairing.playerAId,
        },
      });

      matchIds.push(match.id);
    } else {
      // Create regular match
      const match = await db.match.create({
        data: {
          sport: tournament.sport,
          tournamentId: tournament.id,
          playerAId: pairing.playerAId,
          playerBId: pairing.playerBId,
        },
      });

      await db.bracketMatch.create({
        data: {
          bracketId: bracket.id,
          matchId: match.id,
          roundNumber: 1,
          matchNumber: matchNumber++,
          playerAId: pairing.playerAId,
          playerBId: pairing.playerBId,
          status: BracketMatchStatus.PENDING,
        },
      });

      matchIds.push(match.id);
    }
  }

  // Update tournament status
  await db.tournament.update({
    where: { id: tournament.id },
    data: { status: TournamentStatus.BRACKET_GENERATED },
  });

  return NextResponse.json({
    success: true,
    bracket: {
      id: bracket.id,
      format: 'SWISS',
      totalRounds,
      playerCount: players.length,
      currentRound: 1,
      matchesCreated: matchIds.length,
      warnings: pairingsResult.warnings,
      description: `Swiss tournament with ${players.length} players over ${totalRounds} rounds. Players face opponents with similar scores each round.`,
    },
  });
}

/**
 * Generate elimination bracket (Single or Double)
 */
async function generateEliminationBracket(
  tournament: any,
  players: any[],
  body: any,
  orgId: string
): Promise<NextResponse> {
  const bracketFormat = tournament.bracketFormat || BracketFormat.SINGLE_ELIMINATION;
  
  // Get seeding options from request body
  const seedingOptions: SeedingOptions = {
    method: body.seedingMethod || 'ELO',
    antiCollision: body.antiCollision !== false,
    topSeedProtection: body.topSeedProtection !== false,
    topN: body.topN || 8,
  };

  // Generate seedings
  const assignments = await generateSeedings(tournament.id, seedingOptions);

  // Calculate bracket size (next power of 2)
  const playerCount = assignments.length;
  let bracketSize = 2;
  while (bracketSize < playerCount) {
    bracketSize *= 2;
  }
  
  const totalRounds = Math.log2(bracketSize);
  const byes = bracketSize - playerCount;

  // Create bracket
  const bracket = await db.bracket.create({
    data: {
      tournamentId: tournament.id,
      format: bracketFormat,
      totalRounds,
      seedingMethod: seedingOptions.method,
      generatedById: orgId || 'system',
    },
  });

  // Generate first round matches
  const matches = [];
  let matchNumber = 1;

  // Seed players with byes for top seeds
  const seededBracket: Array<{ id: string | null; name: string; elo: number; isBye: boolean }> = [];
  
  // Create seeded positions
  for (let i = 0; i < bracketSize; i++) {
    seededBracket.push({ id: null, name: 'BYE', elo: 0, isBye: true });
  }

  // Place players in seeded positions using the snake pattern
  const snakeOrder = generateSnakeOrder(bracketSize);
  for (let i = 0; i < assignments.length; i++) {
    const position = snakeOrder.indexOf(i + 1);
    if (position >= 0 && position < bracketSize) {
      const assignment = assignments[i];
      seededBracket[position] = {
        id: assignment.userId,
        name: assignment.playerName || `Player ${i + 1}`,
        elo: assignment.elo,
        isBye: false,
      };
    }
  }

  // Create first round matches
  for (let i = 0; i < bracketSize; i += 2) {
    const playerA = seededBracket[i];
    const playerB = seededBracket[i + 1];

    // Create the match record
    const match = await db.match.create({
      data: {
        sport: tournament.sport,
        tournamentId: tournament.id,
        playerAId: playerA.isBye ? null : playerA.id,
        playerBId: playerB.isBye ? null : playerB.id,
        outcome: playerA.isBye || playerB.isBye ? 'BYE' : undefined,
        winnerId: playerA.isBye ? playerB.id : playerB.isBye ? playerA.id : null,
      },
    });

    // Create bracket match
    const bracketMatch = await db.bracketMatch.create({
      data: {
        bracketId: bracket.id,
        matchId: match.id,
        roundNumber: 1,
        matchNumber: matchNumber++,
        playerAId: playerA.isBye ? null : playerA.id,
        playerBId: playerB.isBye ? null : playerB.id,
        status: playerA.isBye || playerB.isBye ? BracketMatchStatus.BYE : BracketMatchStatus.PENDING,
        winnerId: playerA.isBye ? playerB.id : playerB.isBye ? playerA.id : null,
      },
    });

    matches.push(bracketMatch);
  }

  // Create empty matches for subsequent rounds
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let m = 1; m <= matchesInRound; m++) {
      const match = await db.match.create({
        data: {
          sport: tournament.sport,
          tournamentId: tournament.id,
        },
      });

      await db.bracketMatch.create({
        data: {
          bracketId: bracket.id,
          matchId: match.id,
          roundNumber: round,
          matchNumber: m,
          status: BracketMatchStatus.PENDING,
        },
      });
    }
  }

  // Handle double elimination - create loser's bracket
  if (bracketFormat === BracketFormat.DOUBLE_ELIMINATION) {
    await createLosersBracket(bracket.id, tournament.id, tournament.sport, playerCount);
  }

  // Update tournament status
  await db.tournament.update({
    where: { id: tournament.id },
    data: { status: TournamentStatus.BRACKET_GENERATED },
  });

  return NextResponse.json({
    success: true,
    bracket: {
      id: bracket.id,
      format: bracketFormat,
      totalRounds,
      playerCount,
      bracketSize,
      byes,
      matchesCreated: matches.length,
      seedingMethod: seedingOptions.method,
      antiCollision: seedingOptions.antiCollision,
      topSeedProtection: seedingOptions.topSeedProtection,
    },
  });
}

/**
 * Create loser's bracket for double elimination
 */
async function createLosersBracket(
  bracketId: string,
  tournamentId: string,
  sport: SportType,
  playerCount: number
): Promise<void> {
  // Calculate loser's bracket structure
  // Loser's bracket has roughly the same number of rounds as winner's
  const totalRounds = Math.ceil(Math.log2(playerCount));
  const losersRounds = totalRounds + (totalRounds > 2 ? 1 : 0);

  // Create loser's bracket matches
  let matchNumber = 1;
  for (let round = 1; round <= losersRounds; round++) {
    // Number of matches decreases as we progress
    const matchesInRound = Math.max(1, Math.floor(playerCount / Math.pow(2, round + 1)));
    
    for (let m = 1; m <= matchesInRound; m++) {
      const match = await db.match.create({
        data: {
          sport,
          tournamentId,
        },
      });

      await db.bracketMatch.create({
        data: {
          bracketId,
          matchId: match.id,
          roundNumber: round,
          matchNumber: matchNumber++,
          bracketSide: 'LOSERS',
          status: BracketMatchStatus.PENDING,
        },
      });
    }
  }

  // Create grand finals match placeholder
  const grandFinalsMatch = await db.match.create({
    data: {
      sport,
      tournamentId,
    },
  });

  await db.bracketMatch.create({
    data: {
      bracketId,
      matchId: grandFinalsMatch.id,
      roundNumber: totalRounds + losersRounds,
      matchNumber: 1,
      bracketSide: 'WINNERS',
      status: BracketMatchStatus.PENDING,
    },
  });
}

/**
 * Generate snake order for bracket seeding
 * Ensures proper bracket balance (seed 1 and 2 on opposite sides)
 */
function generateSnakeOrder(size: number): number[] {
  if (size === 2) return [1, 2];
  if (size === 4) return [1, 4, 2, 3];
  
  const halfSize = size / 2;
  const topHalf = generateSnakeOrder(halfSize);
  const bottomHalf = generateSnakeOrder(halfSize);
  
  const result: number[] = [];
  for (let i = 0; i < halfSize; i++) {
    result.push(topHalf[i]);
    result.push(bottomHalf[i] + halfSize);
  }
  
  return result;
}
