import { NextRequest, NextResponse } from 'next/server';
import { SportType } from '@prisma/client';
import { db } from '@/lib/db';
import { getCDNUrl } from '@/lib/cdn-url';
import { getEloTier } from '@/lib/auth';

const SUPPORTED_SPORTS = new Set<SportType>(['CORNHOLE', 'DARTS']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport')?.toUpperCase() as SportType | undefined;

    if (!sport || !SUPPORTED_SPORTS.has(sport)) {
      return NextResponse.json({ error: 'Valid sport parameter required' }, { status: 400 });
    }

    const player = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        sport: true,
        firstName: true,
        lastName: true,
        city: true,
        state: true,
        district: true,
        photoUrl: true,
        createdAt: true,
        visiblePoints: true,
        hiddenElo: true,
        isActive: true,
        isAnonymized: true,
        orgMemberships: {
          where: {
            status: 'ACTIVE',
            organization: { sport },
          },
          select: {
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        rating: {
          select: {
            sport: true,
            wins: true,
            losses: true,
            currentStreak: true,
            matchesPlayed: true,
          },
        },
      },
    });

    if (!player || !player.isActive || player.isAnonymized || player.sport !== sport) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const followersCountPromise = db.userFollow.count({
      where: { followingId: id, sport },
    });
    const followingCountPromise = db.userFollow.count({
      where: { followerId: id, sport },
    });
    const rankingsPromise = db.user.findMany({
      where: {
        sport,
        isActive: true,
        isAnonymized: false,
        showOnLeaderboard: true,
      },
      orderBy: { visiblePoints: 'desc' },
      select: { id: true },
    });
    const recentMatchesPromise = db.match.findMany({
      where: {
        sport,
        verificationStatus: 'VERIFIED',
        OR: [{ playerAId: id }, { playerBId: id }],
      },
      include: {
        tournament: {
          select: { name: true },
        },
        playerA: {
          select: { id: true, firstName: true, lastName: true },
        },
        playerB: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    const milestonesPromise = db.milestone.findMany({
      where: { userId: id, sport },
      orderBy: { earnedAt: 'desc' },
      take: 5,
    });
    const tournamentRegistrationsPromise = db.tournamentRegistration.findMany({
      where: {
        userId: id,
        tournament: { sport },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            startDate: true,
            status: true,
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
      take: 10,
    });

    const [
      followersCount,
      followingCount,
      rankings,
      recentMatches,
      milestones,
      tournamentRegistrations,
    ] = await Promise.all([
      followersCountPromise,
      followingCountPromise,
      rankingsPromise,
      recentMatchesPromise,
      milestonesPromise,
      tournamentRegistrationsPromise,
    ]);

    const rating = player.rating?.sport === sport ? player.rating : null;
    const rankIndex = rankings.findIndex((rankedPlayer) => rankedPlayer.id === id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;

    return NextResponse.json({
      player: {
        id: player.id,
        name: [player.firstName, player.lastName].filter(Boolean).join(' '),
        city: player.city,
        state: player.state,
        district: player.district,
        avatar: getCDNUrl(player.photoUrl),
        memberSince: player.createdAt.toISOString(),
        organizations: player.orgMemberships.map((membership) => membership.organization),
      },
      stats: {
        points: player.visiblePoints,
        elo: Math.round(player.hiddenElo),
        wins: rating?.wins ?? 0,
        losses: rating?.losses ?? 0,
        winStreak: rating?.currentStreak ?? 0,
        tier: getEloTier(player.hiddenElo, rating?.matchesPlayed ?? 0),
        rank,
      },
      social: {
        followers: followersCount,
        following: followingCount,
      },
      recentMatches: recentMatches.map((match) => {
        const isPlayerA = match.playerAId === id;
        const opponent = isPlayerA ? match.playerB : match.playerA;
        const opponentName = [opponent?.firstName, opponent?.lastName].filter(Boolean).join(' ') || 'Unknown Player';

        return {
          id: match.id,
          tournament: match.tournament?.name ?? 'Independent Match',
          opponent: {
            id: opponent?.id ?? '',
            name: opponentName,
          },
          won: match.winnerId === id,
          score: isPlayerA
            ? `${match.scoreA ?? 0} - ${match.scoreB ?? 0}`
            : `${match.scoreB ?? 0} - ${match.scoreA ?? 0}`,
          date: match.updatedAt.toISOString(),
        };
      }),
      milestones: milestones.map((milestone) => ({
        id: milestone.id,
        type: milestone.type,
        title: milestone.title,
        description: milestone.description,
        date: milestone.earnedAt.toISOString(),
      })),
      tournaments: tournamentRegistrations.map((registration) => ({
        id: registration.tournament.id,
        name: registration.tournament.name,
        date: registration.tournament.startDate?.toISOString() ?? null,
        status: registration.tournament.status,
      })),
    });
  } catch (error) {
    console.error('Error fetching public player profile:', error);
    return NextResponse.json({ error: 'Failed to fetch player profile' }, { status: 500 });
  }
}
