import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType, MatchVerificationStatus, TournamentStatus } from '@prisma/client';

interface MatchWithDetails {
  id: string;
  playedAt: Date;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  outcome: string | null;
  playerA: {
    id: string;
    firstName: string;
    lastName: string;
  };
  playerB: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  tournament: {
    id: string;
    name: string;
    status: string;
    type: string;
    scope: string | null;
  } | null;
  pointsA: number | null;
  pointsB: number | null;
  eloChangeA: number | null;
  eloChangeB: number | null;
  verificationStatus: string;
}

interface TournamentWithMatches {
  id: string;
  name: string;
  status: string;
  type: string;
  scope: string | null;
  startDate: Date;
  endDate: Date;
  location: string;
  matches: MatchWithDetails[];
}

export async function GET(request: NextRequest) {
  try {
    // Get org ID from session
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token: sessionToken },
      include: { org: true },
    });

    if (!session || !session.orgId || session.accountType !== 'ORG') {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgId = session.orgId;
    const sport = session.sport as SportType;

    // Get filter params
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');
    const status = searchParams.get('status');

    // Get all player IDs in the org's roster
    const rosterPlayers = await db.orgRosterPlayer.findMany({
      where: { orgId, isActive: true },
      select: { userId: true },
    });
    const rosterPlayerIds = rosterPlayers.map((r) => r.userId);

    // Get tournaments the org registered for
    const orgRegistrations = await db.orgTournamentRegistration.findMany({
      where: { orgId },
      select: { tournamentId: true },
    });
    const registeredTournamentIds = orgRegistrations.map((r) => r.tournamentId);

    // Get INTRA_ORG tournaments hosted by this org
    const hostedTournaments = await db.tournament.findMany({
      where: { orgId, type: 'INTRA_ORG' },
      select: { id: true },
    });
    const hostedTournamentIds = hostedTournaments.map((t) => t.id);

    // Combine all relevant tournament IDs
    const relevantTournamentIds = [...new Set([...registeredTournamentIds, ...hostedTournamentIds])];

    // Build match query
    const matchWhere: Record<string, unknown> = {
      sport,
    };

    // If specific tournament requested
    if (tournamentId) {
      matchWhere.tournamentId = tournamentId;
    } else {
      // Get matches where:
      // 1. Players from org roster participated, OR
      // 2. Tournament is registered/hosted by org
      matchWhere.OR = [
        { playerAId: { in: rosterPlayerIds } },
        { playerBId: { in: rosterPlayerIds } },
        { tournamentId: { in: relevantTournamentIds } },
      ];
    }

    // Fetch matches
    const matches = await db.match.findMany({
      where: matchWhere,
      include: {
        playerA: {
          select: { id: true, firstName: true, lastName: true },
        },
        playerB: {
          select: { id: true, firstName: true, lastName: true },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            status: true,
            type: true,
            scope: true,
            startDate: true,
            endDate: true,
            location: true,
          },
        },
      },
      orderBy: { playedAt: 'desc' },
      take: 500,
    });

    // Group matches by tournament
    const tournamentMap = new Map<string, TournamentWithMatches>();

    // First, add all relevant tournaments (even those without matches yet)
    const allTournaments = await db.tournament.findMany({
      where: {
        id: { in: relevantTournamentIds },
      },
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
        scope: true,
        startDate: true,
        endDate: true,
        location: true,
      },
    });

    allTournaments.forEach((t) => {
      tournamentMap.set(t.id, {
        ...t,
        matches: [],
      });
    });

    // Add matches to their tournaments
    matches.forEach((match) => {
      if (match.tournament) {
        const tournament = tournamentMap.get(match.tournament.id);
        if (tournament) {
          tournament.matches.push({
            id: match.id,
            playedAt: match.playedAt,
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            winnerId: match.winnerId,
            outcome: match.outcome,
            playerA: match.playerA,
            playerB: match.playerB,
            tournament: match.tournament,
            pointsA: match.pointsA,
            pointsB: match.pointsB,
            eloChangeA: match.eloChangeA,
            eloChangeB: match.eloChangeB,
            verificationStatus: match.verificationStatus,
          });
        } else {
          // Create new tournament entry if not exists
          tournamentMap.set(match.tournament.id, {
            id: match.tournament.id,
            name: match.tournament.name,
            status: match.tournament.status,
            type: match.tournament.type,
            scope: match.tournament.scope,
            startDate: match.tournament.startDate,
            endDate: match.tournament.endDate,
            location: match.tournament.location,
            matches: [{
              id: match.id,
              playedAt: match.playedAt,
              scoreA: match.scoreA,
              scoreB: match.scoreB,
              winnerId: match.winnerId,
              outcome: match.outcome,
              playerA: match.playerA,
              playerB: match.playerB,
              tournament: match.tournament,
              pointsA: match.pointsA,
              pointsB: match.pointsB,
              eloChangeA: match.eloChangeA,
              eloChangeB: match.eloChangeB,
              verificationStatus: match.verificationStatus,
            }],
          });
        }
      }
    });

    // Convert to array and sort by most recent activity
    let tournaments = Array.from(tournamentMap.values())
      .filter((t) => t.matches.length > 0) // Only show tournaments with matches
      .sort((a, b) => {
        const aLatest = a.matches.length > 0 ? a.matches[0].playedAt : a.startDate;
        const bLatest = b.matches.length > 0 ? b.matches[0].playedAt : b.startDate;
        return new Date(bLatest).getTime() - new Date(aLatest).getTime();
      });

    // Filter by tournament status if provided
    if (status && status !== 'all') {
      tournaments = tournaments.filter((t) => t.status === status);
    }

    // Calculate stats
    const totalMatches = matches.length;
    const completedMatches = matches.filter((m) => m.verificationStatus === 'VERIFIED').length;
    const pendingMatches = matches.filter((m) => m.verificationStatus === 'PENDING').length;
    const disputedMatches = matches.filter((m) => m.verificationStatus === 'DISPUTED').length;

    // Count wins by org players
    let orgWins = 0;
    let orgLosses = 0;
    matches.forEach((match) => {
      const isPlayerAInRoster = rosterPlayerIds.includes(match.playerAId);
      const isPlayerBInRoster = match.playerBId && rosterPlayerIds.includes(match.playerBId);

      if (match.winnerId) {
        if (isPlayerAInRoster && match.winnerId === match.playerAId) orgWins++;
        else if (isPlayerAInRoster && match.winnerId !== match.playerAId) orgLosses++;
        if (isPlayerBInRoster && match.winnerId === match.playerBId) orgWins++;
        else if (isPlayerBInRoster && match.winnerId !== match.playerBId) orgLosses++;
      }
    });

    return NextResponse.json({
      tournaments,
      stats: {
        totalMatches,
        completedMatches,
        pendingMatches,
        disputedMatches,
        orgWins,
        orgLosses,
        winRate: orgWins + orgLosses > 0 
          ? Math.round((orgWins / (orgWins + orgLosses)) * 100) 
          : 0,
      },
      rosterPlayerIds,
    });
  } catch (error) {
    console.error('Error fetching org match history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
