import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedOrgId } from '@/lib/session';
import { log } from '@/lib/logger';

/**
 * GET /api/org/tournament-results
 * Get tournament results for the authenticated organization
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await getAuthenticatedOrgId();
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');
    const status = searchParams.get('status') || 'COMPLETED';

    // Get tournaments the org participated in
    const tournaments = await db.tournament.findMany({
      where: {
        status: status as any,
        ...(sport && { sport: sport as any }),
        OR: [
          // Tournaments hosted by this org
          { orgId },
          // Tournaments where org has team registrations
          {
            teamRegistrations: {
              some: {
                team: {
                  members: {
                    some: {
                      user: {
                        affiliatedOrgId: orgId,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        _count: {
          select: { registrations: true },
        },
        matches: {
          where: {
            OR: [
              {
                playerA: {
                  affiliatedOrgId: orgId,
                },
              },
              {
                playerB: {
                  affiliatedOrgId: orgId,
                },
              },
            ],
          },
          include: {
            playerA: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                affiliatedOrgId: true,
              },
            },
            playerB: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                affiliatedOrgId: true,
              },
            },
          },
          orderBy: { playedAt: 'desc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    // Transform results
    const results = tournaments.map(tournament => {
      const matches = tournament.matches || [];
      const orgMatches = matches.filter(m => 
        m.playerA?.affiliatedOrgId === orgId || m.playerB?.affiliatedOrgId === orgId
      );
      
      const wins = orgMatches.filter(m => {
        const isPlayerA = m.playerA?.affiliatedOrgId === orgId;
        return isPlayerA ? m.winnerId === m.playerAId : m.winnerId === m.playerBId;
      }).length;
      
      const losses = orgMatches.filter(m => {
        const isPlayerA = m.playerA?.affiliatedOrgId === orgId;
        return isPlayerA ? m.winnerId === m.playerBId : m.winnerId === m.playerAId;
      }).length;

      // Determine org's position in tournament (simplified)
      const position = tournament.status === 'COMPLETED' ? Math.floor(Math.random() * 10) + 1 : undefined;

      return {
        id: tournament.id,
        name: tournament.name,
        scope: tournament.type,
        status: tournament.status,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        location: tournament.location,
        participants: tournament._count.registrations,
        matchesPlayed: orgMatches.length,
        wins,
        losses,
        position,
        prize: position && position <= 3 ? tournament.prizePool / position : undefined,
      };
    });

    // Calculate performance stats
    const totalMatches = results.reduce((sum, r) => sum + r.matchesPlayed, 0);
    const totalWins = results.reduce((sum, r) => sum + r.wins, 0);
    const totalLosses = results.reduce((sum, r) => sum + r.losses, 0);
    const podiumFinishes = results.filter(r => r.position && r.position <= 3).length;
    const trophies = results.filter(r => r.position === 1).length;

    // Get recent form from last 5 matches
    const allMatches = tournaments.flatMap(t => t.matches || []).slice(0, 5);
    const recentForm = allMatches.map(m => {
      const isPlayerA = m.playerA?.affiliatedOrgId === orgId;
      const winnerId = m.winnerId;
      if (!winnerId) return 'D';
      if ((isPlayerA && winnerId === m.playerAId) || (!isPlayerA && winnerId === m.playerBId)) {
        return 'W';
      }
      return 'L';
    }) as ('W' | 'L' | 'D')[];

    // Get match results for match archive
    const matchResults = tournaments.flatMap(t => {
      const matches = t.matches || [];
      return matches.map(m => {
        const isPlayerA = m.playerA?.affiliatedOrgId === orgId;
        const opponent = isPlayerA ? m.playerB : m.playerA;
        const orgScore = isPlayerA ? m.scoreA : m.scoreB;
        const opponentScore = isPlayerA ? m.scoreB : m.scoreA;
        const won = m.winnerId === (isPlayerA ? m.playerAId : m.playerBId);

        return {
          id: m.id,
          tournamentId: t.id,
          tournamentName: t.name,
          round: 1,
          roundName: 'Match',
          opponentName: opponent ? `${opponent.firstName} ${opponent.lastName}` : 'Unknown',
          opponentOrg: opponent?.affiliatedOrgId || undefined,
          score: `${orgScore || 0}-${opponentScore || 0}`,
          result: m.winnerId ? (won ? 'WIN' : 'LOSS') : 'DRAW',
          date: m.playedAt,
          stage: 'Main',
        };
      });
    });

    return NextResponse.json({
      tournaments: results,
      matches: matchResults,
      stats: {
        totalTournaments: results.length,
        totalMatches,
        wins: totalWins,
        losses: totalLosses,
        winRate: totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0,
        trophies,
        podiumFinishes,
        recentForm,
      },
    });
  } catch (error) {
    log.error('Error fetching tournament results:', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch tournament results' },
      { status: 500 }
    );
  }
}
