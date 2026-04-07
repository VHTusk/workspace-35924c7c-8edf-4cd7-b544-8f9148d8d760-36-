import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

// GET /api/org/analytics - Get organization analytics
export async function GET(request: NextRequest) {
  try {
    // Get org from session
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);

    if (!session || !session.org) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const orgId = session.orgId!;
    const sport = session.org.sport;

    // Get roster with detailed stats
    const rosterPlayers = await db.orgRosterPlayer.findMany({
      where: { orgId, isActive: true },
      include: {
        user: {
          include: {
            rating: true,
          },
        },
      },
    });

    // Calculate analytics
    const totalMembers = rosterPlayers.length;
    const totalPoints = rosterPlayers.reduce((sum, rp) => sum + rp.user.visiblePoints, 0);
    const avgElo = totalMembers > 0
      ? Math.round(rosterPlayers.reduce((sum, rp) => sum + rp.user.hiddenElo, 0) / totalMembers)
      : 0;

    const totalWins = rosterPlayers.reduce((sum, rp) => sum + (rp.user.rating?.wins || 0), 0);
    const totalLosses = rosterPlayers.reduce((sum, rp) => sum + (rp.user.rating?.losses || 0), 0);
    const matchesPlayed = totalWins + totalLosses;
    const matchesWon = totalWins;
    const winRate = matchesPlayed > 0 ? Math.round((totalWins / matchesPlayed) * 100) : 0;

    // Calculate active members (played match in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const activeMemberIds = await db.match.findMany({
      where: {
        OR: [
          { playerA: { orgRosterEntries: { some: { orgId } } } },
          { playerB: { orgRosterEntries: { some: { orgId } } } }
        ],
        updatedAt: { gte: thirtyDaysAgo },
        verificationStatus: 'VERIFIED',
      },
      select: { playerAId: true, playerBId: true },
    });

    const activeIds = new Set<string>();
    activeMemberIds.forEach(m => {
      if (m.playerAId) activeIds.add(m.playerAId);
      if (m.playerBId) activeIds.add(m.playerBId);
    });
    const activeMembers = activeIds.size;

    // Get tournaments hosted
    const tournamentsHosted = await db.tournament.count({
      where: { organizationId: orgId },
    });

    // Get tournaments won by roster members
    const tournamentsWon = await db.tournamentResult.count({
      where: {
        user: { orgRosterEntries: { some: { orgId } } },
        position: 1,
      },
    });

    // Calculate org rank
    const allOrgs = await db.organization.count({
      where: { sport, isActive: true },
    });

    const orgsWithHigherPoints = await db.$queryRaw<Array<{ orgId: string; totalPoints: bigint }>>`
      SELECT orgId, SUM(visiblePoints) as totalPoints
      FROM OrgRosterPlayer
      JOIN User ON OrgRosterPlayer.userId = User.id
      WHERE OrgRosterPlayer.isActive = 1 AND OrgRosterPlayer.orgId != ${orgId}
      GROUP BY OrgRosterPlayer.orgId
      HAVING SUM(visiblePoints) > ${totalPoints}
    `;

    const rank = (orgsWithHigherPoints?.length || 0) + 1;

    // Top players with more details
    const topPlayers = [...rosterPlayers]
      .sort((a, b) => b.user.visiblePoints - a.user.visiblePoints)
      .slice(0, 10)
      .map(rp => {
        const elo = rp.user.hiddenElo;
        let tier = 'Bronze';
        if (elo >= 1900) tier = 'Diamond';
        else if (elo >= 1700) tier = 'Platinum';
        else if (elo >= 1500) tier = 'Gold';
        else if (elo >= 1300) tier = 'Silver';
        
        const wins = rp.user.rating?.wins || 0;
        const losses = rp.user.rating?.losses || 0;
        const matches = wins + losses;
        
        return {
          id: rp.user.id,
          name: `${rp.user.firstName} ${rp.user.lastName}`,
          points: rp.user.visiblePoints,
          elo: Math.round(elo),
          tier,
          matches,
          wins,
          winRate: matches > 0 ? Math.round((wins / matches) * 100) : 0,
        };
      });

    // All players with detailed stats
    const allPlayers = rosterPlayers.map(rp => {
      const elo = rp.user.hiddenElo;
      let tier = 'Bronze';
      if (elo >= 1900) tier = 'Diamond';
      else if (elo >= 1700) tier = 'Platinum';
      else if (elo >= 1500) tier = 'Gold';
      else if (elo >= 1300) tier = 'Silver';
      
      const wins = rp.user.rating?.wins || 0;
      const losses = rp.user.rating?.losses || 0;
      const matches = wins + losses;
      
      return {
        id: rp.user.id,
        name: `${rp.user.firstName} ${rp.user.lastName}`,
        city: rp.user.city,
        state: rp.user.state,
        points: rp.user.visiblePoints,
        elo: Math.round(elo),
        tier,
        matches,
        wins,
        losses,
        winRate: matches > 0 ? Math.round((wins / matches) * 100 * 10) / 10 : 0,
        verificationStatus: rp.user.verificationStatus || 'NONE',
      };
    }).sort((a, b) => b.points - a.points);

    // Tier distribution
    const tierDistribution = [
      { tier: 'Diamond', count: 0 },
      { tier: 'Platinum', count: 0 },
      { tier: 'Gold', count: 0 },
      { tier: 'Silver', count: 0 },
      { tier: 'Bronze', count: 0 },
    ];

    rosterPlayers.forEach(rp => {
      const elo = rp.user.hiddenElo;
      if (elo >= 1900) tierDistribution[0].count++;
      else if (elo >= 1700) tierDistribution[1].count++;
      else if (elo >= 1500) tierDistribution[2].count++;
      else if (elo >= 1300) tierDistribution[3].count++;
      else tierDistribution[4].count++;
    });

    // Recent performance (last 6 months)
    // FIXED: Batch query instead of N+1 - fetch all matches in date range, then aggregate in memory
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Single query to get all matches in the last 6 months
    const allRecentMatches = await db.match.findMany({
      where: {
        OR: [
          { playerA: { orgRosterEntries: { some: { orgId } } } },
          { playerB: { orgRosterEntries: { some: { orgId } } } }
        ],
        updatedAt: { gte: sixMonthsAgo },
        verificationStatus: 'VERIFIED',
      },
      select: {
        updatedAt: true,
        winnerId: true,
        playerAId: true,
        playerBId: true,
      },
    });

    // Get roster member IDs for win calculation
    const rosterMemberIds = new Set(rosterPlayers.map(rp => rp.user.id));

    // Aggregate matches by month in memory
    const monthData: Record<string, { matches: number; wins: number }> = {};
    const recentPerformance = [];

    // Initialize all 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toLocaleString('en-US', { month: 'short' });
      monthData[month] = { matches: 0, wins: 0 };
    }

    // Aggregate matches into months
    for (const match of allRecentMatches) {
      const month = match.updatedAt.toLocaleString('en-US', { month: 'short' });
      if (monthData[month] !== undefined) {
        monthData[month].matches++;
        // Check if winner is a roster member
        if (match.winnerId && rosterMemberIds.has(match.winnerId)) {
          monthData[month].wins++;
        }
      }
    }

    // Build response array
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toLocaleString('en-US', { month: 'short' });
      recentPerformance.push({
        month,
        matches: monthData[month].matches,
        wins: monthData[month].wins,
      });
    }

    // Recent matches by org players
    const recentMatches = await db.match.findMany({
      where: {
        OR: [
          { playerA: { orgRosterEntries: { some: { orgId } } } },
          { playerB: { orgRosterEntries: { some: { orgId } } } }
        ],
        verificationStatus: 'VERIFIED',
      },
      include: {
        playerA: { select: { id: true, firstName: true, lastName: true, orgRosterEntries: { where: { orgId } } } },
        playerB: { select: { id: true, firstName: true, lastName: true } },
        tournament: { select: { id: true, name: true } },
      },
      orderBy: { playedAt: 'desc' },
      take: 20,
    });

    const formattedRecentMatches = recentMatches.map(match => {
      const isOrgPlayerA = match.playerA.orgRosterEntries && match.playerA.orgRosterEntries.length > 0;
      const orgPlayer = isOrgPlayerA ? match.playerA : match.playerB;
      const opponent = isOrgPlayerA ? match.playerB : match.playerA;
      const won = match.winnerId === orgPlayer.id;
      
      return {
        id: match.id,
        player: `${orgPlayer.firstName} ${orgPlayer.lastName}`,
        opponent: opponent ? `${opponent.firstName} ${opponent.lastName}` : 'Unknown',
        tournament: match.tournament?.name || 'Friendly Match',
        result: won ? 'WIN' as const : 'LOSS' as const,
        score: `${isOrgPlayerA ? match.scoreA : match.scoreB || 0}-${isOrgPlayerA ? match.scoreB : match.scoreA || 0}`,
        date: match.playedAt.toISOString(),
      };
    });

    return NextResponse.json({
      totalPoints,
      avgElo,
      totalMembers,
      activeMembers,
      tournamentsHosted,
      tournamentsWon,
      matchesPlayed,
      matchesWon,
      winRate,
      rank,
      totalOrganizations: allOrgs,
      topPlayers,
      allPlayers,
      recentPerformance,
      tierDistribution: tierDistribution.filter(t => t.count > 0),
      recentMatches: formattedRecentMatches,
    });

  } catch (error) {
    console.error('Error fetching org analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
