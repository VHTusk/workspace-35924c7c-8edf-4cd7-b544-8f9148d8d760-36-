import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedOrg } from '@/lib/auth';
import { RosterRequestStatus, TournamentStatus } from '@prisma/client';

const MAX_ROSTER_SIZE = 25;

// GET - Comprehensive player management data
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedOrg(request);

    if (!authResult) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { org: sessionOrg, session } = authResult;

    const orgId = sessionOrg.id;
    const sport = sessionOrg.sport;

    // Get current roster with player details and performance
    const rosterEntries = await db.orgRosterPlayer.findMany({
      where: { orgId, isActive: true },
      include: {
        user: {
          include: {
            rating: true,
            tournamentRegs: {
              where: {
                tournament: {
                  sport,
                  status: { in: [TournamentStatus.COMPLETED, TournamentStatus.IN_PROGRESS] },
                },
              },
              include: {
                tournament: {
                  select: { id: true, name: true, status: true },
                },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // Get player match performance while in this org
    const playerIds = rosterEntries.map((r) => r.userId);
    const joinedDates = new Map(rosterEntries.map((r) => [r.userId, r.joinedAt]));

    // Get matches where roster players participated
    const matchesAsPlayerA = await db.match.findMany({
      where: {
        sport,
        playerAId: { in: playerIds },
      },
      include: {
        playerA: { select: { id: true, firstName: true, lastName: true } },
        playerB: { select: { id: true, firstName: true, lastName: true } },
        tournament: { select: { id: true, name: true, scope: true } },
      },
    });

    const matchesAsPlayerB = await db.match.findMany({
      where: {
        sport,
        playerBId: { in: playerIds },
      },
      include: {
        playerA: { select: { id: true, firstName: true, lastName: true } },
        playerB: { select: { id: true, firstName: true, lastName: true } },
        tournament: { select: { id: true, name: true, scope: true } },
      },
    });

    // Calculate performance per player
    const playerPerformance = new Map<string, {
      tournamentsPlayed: Set<string>;
      matchesPlayed: number;
      wins: number;
      losses: number;
      pointsEarned: number;
      recentMatches: Array<{
        id: string;
        tournamentName: string;
        opponent: string;
        score: string;
        result: 'win' | 'loss' | 'draw';
        playedAt: Date;
      }>;
    }>();

    // Initialize performance for all players
    playerIds.forEach((id) => {
      playerPerformance.set(id, {
        tournamentsPlayed: new Set(),
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsEarned: 0,
        recentMatches: [],
      });
    });

    // Process matches as Player A
    matchesAsPlayerA.forEach((match) => {
      const playerId = match.playerAId;
      const joinedAt = joinedDates.get(playerId);
      
      // Only count matches played while in org
      if (joinedAt && match.playedAt >= joinedAt) {
        const perf = playerPerformance.get(playerId);
        if (perf) {
          perf.matchesPlayed++;
          if (match.tournament) {
            perf.tournamentsPlayed.add(match.tournament.id);
          }
          
          const isWin = match.winnerId === playerId;
          const isLoss = match.winnerId && match.winnerId !== playerId;
          
          if (isWin) perf.wins++;
          else if (isLoss) perf.losses++;
          
          if (match.pointsA) perf.pointsEarned += match.pointsA;
          
          if (perf.recentMatches.length < 5) {
            perf.recentMatches.push({
              id: match.id,
              tournamentName: match.tournament?.name || 'Friendly',
              opponent: match.playerB ? `${match.playerB.firstName} ${match.playerB.lastName}` : 'Bye',
              score: `${match.scoreA ?? '-'} - ${match.scoreB ?? '-'}`,
              result: isWin ? 'win' : isLoss ? 'loss' : 'draw',
              playedAt: match.playedAt,
            });
          }
        }
      }
    });

    // Process matches as Player B
    matchesAsPlayerB.forEach((match) => {
      const playerId = match.playerBId!;
      const joinedAt = joinedDates.get(playerId);
      
      if (joinedAt && match.playedAt >= joinedAt) {
        const perf = playerPerformance.get(playerId);
        if (perf) {
          perf.matchesPlayed++;
          if (match.tournament) {
            perf.tournamentsPlayed.add(match.tournament.id);
          }
          
          const isWin = match.winnerId === playerId;
          const isLoss = match.winnerId && match.winnerId !== playerId;
          
          if (isWin) perf.wins++;
          else if (isLoss) perf.losses++;
          
          if (match.pointsB) perf.pointsEarned += match.pointsB;
          
          if (perf.recentMatches.length < 5) {
            perf.recentMatches.push({
              id: match.id,
              tournamentName: match.tournament?.name || 'Friendly',
              opponent: `${match.playerA.firstName} ${match.playerA.lastName}`,
              score: `${match.scoreB ?? '-'} - ${match.scoreA ?? '-'}`,
              result: isWin ? 'win' : isLoss ? 'loss' : 'draw',
              playedAt: match.playedAt,
            });
          }
        }
      }
    });

    // Format roster with performance
    const roster = rosterEntries.map((entry) => {
      const perf = playerPerformance.get(entry.userId);
      return {
        id: entry.id,
        playerId: entry.userId,
        uniqueId: entry.user.uniqueId,
        firstName: entry.user.firstName,
        lastName: entry.user.lastName,
        email: entry.user.email,
        phone: entry.user.phone,
        city: entry.user.city,
        state: entry.user.state,
        elo: entry.user.hiddenElo,
        tier: entry.user.rating
          ? getEloTier(entry.user.hiddenElo, entry.user.rating.matchesPlayed)
          : 'UNRANKED',
        // Overall stats
        overallMatchesPlayed: entry.user.rating?.matchesPlayed || 0,
        overallWins: entry.user.rating?.wins || 0,
        overallLosses: entry.user.rating?.losses || 0,
        // Performance in this org
        orgMatchesPlayed: perf?.matchesPlayed || 0,
        orgWins: perf?.wins || 0,
        orgLosses: perf?.losses || 0,
        orgTournamentsPlayed: perf?.tournamentsPlayed.size || 0,
        orgPointsEarned: perf?.pointsEarned || 0,
        orgWinRate: perf && perf.matchesPlayed > 0 
          ? Math.round((perf.wins / perf.matchesPlayed) * 100) 
          : 0,
        recentMatches: perf?.recentMatches.sort((a, b) => 
          new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
        ).slice(0, 5) || [],
        joinedAt: entry.joinedAt,
        isCaptain: false, // Will implement later
        tags: [], // Will implement later
      };
    });

    // Get pending invitations
    const pendingRequests = await db.orgRosterRequest.findMany({
      where: {
        orgId,
        status: RosterRequestStatus.PENDING,
        expiresAt: { gte: new Date() },
      },
      include: {
        player: {
          include: { rating: true },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    // Get transfer history (players who left)
    const transferHistory = await db.orgRosterPlayer.findMany({
      where: {
        orgId,
        isActive: false,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hiddenElo: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: 20,
    });

    // Get transfer cooldowns for this org's former players
    const formerPlayerIds = transferHistory.map((t) => t.userId);
    const cooldowns = await db.transferCooldown.findMany({
      where: {
        userId: { in: formerPlayerIds },
        fromOrgId: orgId,
        cooldownEnds: { gte: new Date() },
      },
    });

    // Calculate stats
    const totalOrgMatches = roster.reduce((sum, p) => sum + p.orgMatchesPlayed, 0);
    const totalOrgWins = roster.reduce((sum, p) => sum + p.orgWins, 0);
    const avgElo = roster.length > 0 
      ? Math.round(roster.reduce((sum, p) => sum + p.elo, 0) / roster.length)
      : 0;

    // Tier distribution
    const tierDistribution: Record<string, number> = {};
    roster.forEach((p) => {
      tierDistribution[p.tier] = (tierDistribution[p.tier] || 0) + 1;
    });

    return NextResponse.json({
      roster,
      pendingInvitations: pendingRequests.map((r) => ({
        id: r.id,
        playerId: r.playerId,
        firstName: r.player.firstName,
        lastName: r.player.lastName,
        elo: r.player.hiddenElo,
        tier: r.player.rating
          ? getEloTier(r.player.hiddenElo, r.player.rating.matchesPlayed)
          : 'UNRANKED',
        matchesPlayed: r.player.rating?.matchesPlayed || 0,
        requestedAt: r.requestedAt,
        expiresAt: r.expiresAt,
        daysLeft: Math.ceil((r.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      })),
      transferHistory: transferHistory.map((t) => {
        const cooldown = cooldowns.find((c) => c.userId === t.userId);
        return {
          playerId: t.userId,
          firstName: t.user.firstName,
          lastName: t.user.lastName,
          elo: t.user.hiddenElo,
          joinedAt: t.joinedAt,
          leftAt: null, // We don't track this currently
          cooldownEnds: cooldown?.cooldownEnds,
        };
      }),
      stats: {
        currentCount: roster.length,
        maxCount: MAX_ROSTER_SIZE,
        availableSlots: MAX_ROSTER_SIZE - roster.length,
        pendingCount: pendingRequests.length,
        avgElo,
        totalMatches: totalOrgMatches,
        totalWins: totalOrgWins,
        totalLosses: totalOrgMatches - totalOrgWins,
        overallWinRate: totalOrgMatches > 0 
          ? Math.round((totalOrgWins / totalOrgMatches) * 100) 
          : 0,
        tierDistribution,
      },
    });
  } catch (error) {
    console.error('Error fetching player management data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getEloTier(elo: number, matchCount: number): string {
  if (matchCount < 30) return 'UNRANKED';
  if (elo >= 1900) return 'DIAMOND';
  if (elo >= 1700) return 'PLATINUM';
  if (elo >= 1500) return 'GOLD';
  if (elo >= 1300) return 'SILVER';
  return 'BRONZE';
}
