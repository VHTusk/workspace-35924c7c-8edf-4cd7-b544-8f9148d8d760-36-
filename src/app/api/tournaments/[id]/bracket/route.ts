import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        bracket: {
          include: {
            matches: {
              include: {
                match: {
                  include: {
                    playerA: {
                      select: { id: true, firstName: true, lastName: true, hiddenElo: true },
                    },
                    playerB: {
                      select: { id: true, firstName: true, lastName: true, hiddenElo: true },
                    },
                  },
                },
              },
              orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (!tournament.bracket) {
      return NextResponse.json({
        hasBracket: false,
        bracket: null,
      });
    }

    // Organize matches by round
    const rounds: Record<number, typeof tournament.bracket.matches> = {};
    for (const bm of tournament.bracket.matches) {
      if (!rounds[bm.roundNumber]) {
        rounds[bm.roundNumber] = [];
      }
      rounds[bm.roundNumber].push(bm);
    }

    // Get player names for all participants
    const playerMap: Record<string, { name: string; elo: number }> = {};
    for (const bm of tournament.bracket.matches) {
      if (bm.playerAId && bm.match?.playerA) {
        playerMap[bm.playerAId] = {
          name: `${bm.match.playerA.firstName} ${bm.match.playerA.lastName}`,
          elo: Math.round(bm.match.playerA.hiddenElo),
        };
      }
      if (bm.playerBId && bm.match?.playerB) {
        playerMap[bm.playerBId] = {
          name: `${bm.match.playerB.firstName} ${bm.match.playerB.lastName}`,
          elo: Math.round(bm.match.playerB.hiddenElo),
        };
      }
    }

    return NextResponse.json({
      hasBracket: true,
      bracket: {
        id: tournament.bracket.id,
        format: tournament.bracket.format,
        totalRounds: tournament.bracket.totalRounds,
        seedingMethod: tournament.bracket.seedingMethod,
        generatedAt: tournament.bracket.generatedAt,
        rounds: Object.entries(rounds).map(([roundNum, matches]) => ({
          roundNumber: parseInt(roundNum),
          roundName: getRoundName(parseInt(roundNum), tournament.bracket!.totalRounds),
          matches: matches.map((bm) => ({
            id: bm.id,
            matchId: bm.matchId,
            matchNumber: bm.matchNumber,
            status: bm.status,
            scheduledAt: bm.scheduledAt,
            courtAssignment: bm.courtAssignment,
            playerA: bm.playerAId ? {
              id: bm.playerAId,
              ...playerMap[bm.playerAId],
              score: bm.match?.scoreA,
            } : null,
            playerB: bm.playerBId ? {
              id: bm.playerBId,
              ...playerMap[bm.playerBId],
              score: bm.match?.scoreB,
            } : null,
            winnerId: bm.winnerId,
            bracketSide: bm.bracketSide,
          })),
        })),
      },
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
      },
    });
  } catch (error) {
    console.error('Error fetching bracket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getRoundName(roundNumber: number, totalRounds: number): string {
  const roundsFromEnd = totalRounds - roundNumber + 1;
  
  switch (roundsFromEnd) {
    case 1:
      return 'Final';
    case 2:
      return 'Semi-Final';
    case 3:
      return 'Quarter-Final';
    default:
      return `Round ${roundNumber}`;
  }
}
