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
        hostOrg: {
          select: { 
            id: true, 
            name: true, 
            logoUrl: true,
            city: true,
            state: true,
          },
        },
        sponsors: {
          where: { tournamentId: id },
          select: { name: true, logoUrl: true, tier: true },
        },
        _count: {
          select: { 
            registrations: true,
            matches: true,
          },
        },
        bracket: {
          select: {
            id: true,
            format: true,
            totalRounds: true,
            matches: {
              select: {
                id: true,
                roundNumber: true,
                matchNumber: true,
                status: true,
                playerAId: true,
                playerBId: true,
                winnerId: true,
                scheduledAt: true,
                courtAssignment: true,
              },
              orderBy: [{ roundNumber: 'asc' }, { matchNumber: 'asc' }],
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Get player names for bracket matches
    const playerIds = new Set<string>();
    if (tournament.bracket) {
      for (const match of tournament.bracket.matches) {
        if (match.playerAId) playerIds.add(match.playerAId);
        if (match.playerBId) playerIds.add(match.playerBId);
        if (match.winnerId) playerIds.add(match.winnerId);
      }
    }

    const players = await db.user.findMany({
      where: { id: { in: Array.from(playerIds) } },
      select: { id: true, firstName: true, lastName: true },
    });

    const playerMap = new Map(players.map(p => [p.id, p]));

    // Transform bracket matches with player names
    const bracketMatches = tournament.bracket?.matches.map(m => ({
      id: m.id,
      roundNumber: m.roundNumber,
      matchNumber: m.matchNumber,
      status: m.status,
      playerA: m.playerAId ? playerMap.get(m.playerAId) : null,
      playerB: m.playerBId ? playerMap.get(m.playerBId) : null,
      winner: m.winnerId ? playerMap.get(m.winnerId) : null,
      scheduledAt: m.scheduledAt,
      courtAssignment: m.courtAssignment,
    })) || [];

    // Get top 4 results if tournament is completed
    let topResults = null;
    if (tournament.status === 'COMPLETED') {
      const results = await db.tournamentResult.findMany({
        where: { tournamentId: id },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { rank: 'asc' },
        take: 4,
      });
      topResults = results.map(r => ({
        rank: r.rank,
        points: r.bonusPoints,
        player: r.user,
      }));
    }

    // Build public response
    const publicTournament = {
      id: tournament.id,
      name: tournament.name,
      sport: tournament.sport,
      type: tournament.type,
      scope: tournament.scope,
      location: tournament.location,
      city: tournament.city,
      state: tournament.state,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      regDeadline: tournament.regDeadline,
      prizePool: tournament.prizePool,
      entryFee: tournament.entryFee,
      maxPlayers: tournament.maxPlayers,
      currentRegistrations: tournament._count.registrations,
      totalMatches: tournament._count.matches,
      status: tournament.status,
      bracketFormat: tournament.bracketFormat,
      gender: tournament.gender,
      ageMin: tournament.ageMin,
      ageMax: tournament.ageMax,
      hostOrg: tournament.hostOrg,
      sponsors: tournament.sponsors,
      earlyBirdFee: tournament.earlyBirdFee,
      earlyBirdDeadline: tournament.earlyBirdDeadline,
      groupDiscountMin: tournament.groupDiscountMin,
      groupDiscountPercent: tournament.groupDiscountPercent,
      bracket: tournament.bracket ? {
        id: tournament.bracket.id,
        format: tournament.bracket.format,
        totalRounds: tournament.bracket.totalRounds,
        matches: bracketMatches,
      } : null,
      topResults,
      isRegistrationOpen: tournament.status === 'REGISTRATION_OPEN' && 
        tournament.regDeadline > new Date() &&
        tournament._count.registrations < tournament.maxPlayers,
    };

    return NextResponse.json({ tournament: publicTournament });
  } catch (error) {
    console.error('Error fetching public tournament:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournament' },
      { status: 500 }
    );
  }
}
