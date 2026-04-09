import { NextRequest, NextResponse } from 'next/server';
import { SportType } from '@prisma/client';
import { db } from '@/lib/db';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getCDNUrl } from '@/lib/cdn-url';
import { getEloTier } from '@/lib/auth';
import { buildLeaderboardEligibleUserWhere } from '@/lib/user-sport';

const SUPPORTED_SPORTS = new Set<SportType>(['CORNHOLE', 'DARTS']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sportParam = searchParams.get('sport')?.toUpperCase();
    const sport = sportParam && SUPPORTED_SPORTS.has(sportParam as SportType)
      ? (sportParam as SportType)
      : null;

    const cacheKey = `public:player:${id}:${sport ?? 'all'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-API-Version': '1.0' },
      });
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
        hiddenElo: true,
        visiblePoints: true,
        hideElo: true,
        showOnLeaderboard: true,
        isAnonymized: true,
        isActive: true,
        rating: {
          select: {
            sport: true,
            matchesPlayed: true,
            wins: true,
            losses: true,
            currentStreak: true,
            bestStreak: true,
            highestElo: true,
            tournamentsPlayed: true,
            tournamentsWon: true,
          },
        },
        orgMemberships: sport
          ? {
              where: { status: 'ACTIVE', organization: { sport } },
              select: {
                organization: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    sport: true,
                    logoUrl: true,
                  },
                },
              },
            }
          : {
              where: { status: 'ACTIVE' },
              select: {
                organization: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    sport: true,
                    logoUrl: true,
                  },
                },
              },
            },
      },
    });

    if (!player || player.isAnonymized || !player.isActive) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 },
      );
    }

    if (sport && player.sport !== sport) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 },
      );
    }

    const effectiveSport = sport ?? player.sport;
    const rating = player.rating?.sport === effectiveSport ? player.rating : null;

    let rank = null;
    if (player.showOnLeaderboard) {
      const allPlayers = await db.user.findMany({
        where: buildLeaderboardEligibleUserWhere(effectiveSport, { requirePublic: true }),
        orderBy: { visiblePoints: 'desc' },
        select: { id: true },
      });
      const rankIndex = allPlayers.findIndex((listedPlayer) => listedPlayer.id === id);
      rank = rankIndex >= 0 ? rankIndex + 1 : null;
    }

    const [tournamentEntries, achievements, followersCount, milestones] = await Promise.all([
      db.tournamentRegistration.findMany({
        where: { userId: id, tournament: { sport: effectiveSport } },
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              sport: true,
              startDate: true,
              status: true,
              scope: true,
            },
          },
        },
        orderBy: { registeredAt: 'desc' },
        take: 10,
      }),
      db.playerAchievement.findMany({
        where: { userId: id, sport: effectiveSport },
        include: {
          badge: {
            select: {
              code: true,
              name: true,
              iconUrl: true,
              tier: true,
            },
          },
        },
        orderBy: { earnedAt: 'desc' },
        take: 10,
      }),
      db.userFollow.count({
        where: { followingId: id, sport: effectiveSport },
      }),
      db.milestone.findMany({
        where: { userId: id, sport: effectiveSport },
        orderBy: { earnedAt: 'desc' },
        take: 5,
      }),
    ]);

    const response = {
      success: true,
      data: {
        player: {
          id: player.id,
          name: [player.firstName, player.lastName].filter(Boolean).join(' '),
          city: player.city,
          state: player.state,
          district: player.district,
          avatar: getCDNUrl(player.photoUrl),
          memberSince: player.createdAt.toISOString(),
          sport: player.sport,
          organizations: player.orgMemberships.map((membership) => ({
            id: membership.organization.id,
            name: membership.organization.name,
            type: membership.organization.type,
            sport: membership.organization.sport,
            logoUrl: getCDNUrl(membership.organization.logoUrl),
          })),
        },
        stats: {
          points: player.visiblePoints,
          elo: player.hideElo ? null : Math.round(player.hiddenElo),
          wins: rating?.wins ?? 0,
          losses: rating?.losses ?? 0,
          winStreak: rating?.currentStreak ?? 0,
          bestStreak: rating?.bestStreak ?? 0,
          tier: getEloTier(player.hiddenElo, rating?.matchesPlayed ?? 0),
          matchesPlayed: rating?.matchesPlayed ?? 0,
          tournamentsPlayed: rating?.tournamentsPlayed ?? 0,
          tournamentsWon: rating?.tournamentsWon ?? 0,
          highestElo: rating?.highestElo ? Math.round(rating.highestElo) : null,
          rank,
        },
        social: {
          followers: followersCount,
        },
        tournaments: tournamentEntries.map((entry) => ({
          id: entry.tournament.id,
          name: entry.tournament.name,
          sport: entry.tournament.sport,
          date: entry.tournament.startDate.toISOString(),
          status: entry.tournament.status,
          scope: entry.tournament.scope,
        })),
        achievements: achievements.map((achievement) => ({
          id: achievement.id,
          title: achievement.title,
          description: achievement.description,
          earnedAt: achievement.earnedAt.toISOString(),
          badge: achievement.badge
            ? {
                code: achievement.badge.code,
                name: achievement.badge.name,
                iconUrl: getCDNUrl(achievement.badge.iconUrl),
                tier: achievement.badge.tier,
              }
            : null,
        })),
        milestones: milestones.map((milestone) => ({
          id: milestone.id,
          type: milestone.type,
          title: milestone.title,
          description: milestone.description,
          earnedAt: milestone.earnedAt.toISOString(),
        })),
      },
    };

    await cacheSet(cacheKey, response, 300);

    return NextResponse.json(response, {
      headers: { 'X-API-Version': '1.0' },
    });
  } catch (error) {
    console.error('Error fetching public player profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch player profile' },
      { status: 500 },
    );
  }
}
