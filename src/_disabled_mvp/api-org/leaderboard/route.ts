import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTierFromPoints } from '@/lib/tier';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Get all roster players with their ratings
    const rosterPlayers = await db.orgRosterPlayer.findMany({
      where: { orgId, isActive: true },
      include: {
        user: {
          include: {
            rating: true,
            tournamentResults: {
              where: { tournament: { orgId } },
              select: { id: true, rank: true, bonusPoints: true }
            }
          }
        }
      },
      orderBy: { joinedAt: 'asc' }
    });

    // Sort by visible points (descending)
    const leaderboard = rosterPlayers
      .map((rp, index) => {
        const user = rp.user;
        const tier = getTierFromPoints(user.visiblePoints);
        const wins = user.rating?.wins ?? 0;
        const losses = user.rating?.losses ?? 0;
        const intraOrgTournaments = user.tournamentResults.length;
        const intraOrgPodiums = user.tournamentResults.filter(r => r.rank <= 3).length;

        return {
          rank: index + 1,
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          visiblePoints: user.visiblePoints,
          hiddenElo: user.hideElo ? null : Math.round(user.hiddenElo),
          tier: tier.name,
          tierColor: tier.color,
          stats: {
            matches: wins + losses,
            wins,
            losses,
            winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
            currentStreak: user.rating?.currentStreak ?? 0,
            bestStreak: user.rating?.bestStreak ?? 0
          },
          intraOrg: {
            tournaments: intraOrgTournaments,
            podiums: intraOrgPodiums
          },
          joinedAt: rp.joinedAt
        };
      })
      .sort((a, b) => b.visiblePoints - a.visiblePoints)
      .map((player, index) => ({ ...player, rank: index + 1 }));

    // Calculate org stats
    const orgStats = {
      totalMembers: leaderboard.length,
      totalPoints: leaderboard.reduce((sum, p) => sum + p.visiblePoints, 0),
      avgPoints: leaderboard.length > 0 
        ? Math.round(leaderboard.reduce((sum, p) => sum + p.visiblePoints, 0) / leaderboard.length)
        : 0,
      topPlayer: leaderboard[0] || null,
      totalWins: leaderboard.reduce((sum, p) => sum + p.stats.wins, 0),
      totalMatches: leaderboard.reduce((sum, p) => sum + p.stats.matches, 0)
    };

    return NextResponse.json({
      leaderboard,
      stats: orgStats
    });
  } catch (error) {
    console.error('Error fetching org leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
