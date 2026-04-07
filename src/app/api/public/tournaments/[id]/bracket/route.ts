import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cacheGet, cacheSet } from '@/lib/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try cache first
    const cacheKey = `public:bracket:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-API-Version': '1.0' },
      });
    }

    // Get tournament with bracket
    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        sport: true,
        status: true,
        bracket: {
          include: {
            matches: {
              include: {
                match: {
                  include: {
                    playerA: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        hiddenElo: true,
                        photoUrl: true,
                      },
                    },
                    playerB: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        hiddenElo: true,
                        photoUrl: true,
                      },
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
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Don't show brackets for draft tournaments
    if (tournament.status === 'DRAFT') {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    if (!tournament.bracket) {
      return NextResponse.json({
        success: true,
        data: {
          hasBracket: false,
          bracket: null,
          tournament: {
            id: tournament.id,
            name: tournament.name,
            status: tournament.status,
          },
        },
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

    // Build player map
    const playerMap: Record<string, { name: string; elo: number; avatar?: string | null }> = {};
    for (const bm of tournament.bracket.matches) {
      if (bm.playerAId && bm.match?.playerA) {
        playerMap[bm.playerAId] = {
          name: `${bm.match.playerA.firstName} ${bm.match.playerA.lastName}`,
          elo: Math.round(bm.match.playerA.hiddenElo),
          avatar: bm.match.playerA.photoUrl,
        };
      }
      if (bm.playerBId && bm.match?.playerB) {
        playerMap[bm.playerBId] = {
          name: `${bm.match.playerB.firstName} ${bm.match.playerB.lastName}`,
          elo: Math.round(bm.match.playerB.hiddenElo),
          avatar: bm.match.playerB.photoUrl,
        };
      }
    }

    // Format response
    const response = {
      success: true,
      data: {
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
              playerA: bm.playerAId
                ? {
                    id: bm.playerAId,
                    name: playerMap[bm.playerAId]?.name || 'TBD',
                    elo: playerMap[bm.playerAId]?.elo || 0,
                    avatar: playerMap[bm.playerAId]?.avatar,
                    score: bm.match?.scoreA ?? null,
                  }
                : null,
              playerB: bm.playerBId
                ? {
                    id: bm.playerBId,
                    name: playerMap[bm.playerBId]?.name || 'TBD',
                    elo: playerMap[bm.playerBId]?.elo || 0,
                    avatar: playerMap[bm.playerBId]?.avatar,
                    score: bm.match?.scoreB ?? null,
                  }
                : null,
              winnerId: bm.winnerId,
              bracketSide: bm.bracketSide,
            })),
          })),
        },
        tournament: {
          id: tournament.id,
          name: tournament.name,
          sport: tournament.sport,
          status: tournament.status,
        },
        lastUpdated: new Date().toISOString(),
      },
    };

    // Cache for 30 seconds for live tournaments, 2 minutes otherwise
    const ttl = tournament.status === 'IN_PROGRESS' ? 30 : 120;
    await cacheSet(cacheKey, response, ttl);

    return NextResponse.json(response, {
      headers: {
        'X-API-Version': '1.0',
        'Cache-Control': tournament.status === 'IN_PROGRESS' 
          ? 'public, max-age=30, stale-while-revalidate=60'
          : 'public, max-age=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error fetching public bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bracket' },
      { status: 500 }
    );
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
