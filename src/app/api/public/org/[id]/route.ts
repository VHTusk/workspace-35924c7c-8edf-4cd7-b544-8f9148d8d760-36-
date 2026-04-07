import { NextRequest, NextResponse } from 'next/server';
import { SportType } from '@prisma/client';
import { db } from '@/lib/db';
import { getCDNUrl } from '@/lib/cdn-url';

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

    const organization = await db.organization.findUnique({
      where: { id },
      select: {
        id: true,
        sport: true,
        name: true,
        type: true,
        city: true,
        state: true,
        district: true,
        logoUrl: true,
        planTier: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            hostedIntraOrgs: true,
          },
        },
      },
    });

    if (!organization || organization.sport !== sport) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const members = await db.organizationMembership.findMany({
      where: {
        orgId: id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        acceptedAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            visiblePoints: true,
            hiddenElo: true,
            rating: {
              select: {
                sport: true,
                wins: true,
                losses: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let totalPoints = 0;
    let totalElo = 0;
    let totalWins = 0;
    let totalLosses = 0;

    const rosterMembers = members.map((member) => {
      const rating = member.user.rating?.sport === sport ? member.user.rating : null;
      const points = member.user.visiblePoints;
      const elo = Math.round(member.user.hiddenElo);
      const wins = rating?.wins ?? 0;
      const losses = rating?.losses ?? 0;

      totalPoints += points;
      totalElo += elo;
      totalWins += wins;
      totalLosses += losses;

      return {
        id: member.id,
        userId: member.user.id,
        name: [member.user.firstName, member.user.lastName].filter(Boolean).join(' '),
        city: member.user.city,
        points,
        elo,
        wins,
        losses,
        joinedAt: (member.acceptedAt ?? member.createdAt).toISOString(),
      };
    });

    const allOrgs = await db.organization.findMany({
      where: { sport },
      select: {
        id: true,
        members: {
          where: { status: 'ACTIVE' },
          select: {
            user: {
              select: {
                visiblePoints: true,
              },
            },
          },
        },
      },
    });

    const orgRankings = allOrgs
      .map((org) => ({
        id: org.id,
        totalPoints: org.members.reduce((sum, member) => sum + member.user.visiblePoints, 0),
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const rankIndex = orgRankings.findIndex((org) => org.id === id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;
    const totalOrganizations = orgRankings.length;

    const followersCount = await db.userFollowsOrg.count({
      where: { orgId: id, sport },
    });

    const tournaments = await db.tournament.findMany({
      where: {
        orgId: id,
        sport,
      },
      orderBy: { startDate: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        startDate: true,
        status: true,
        _count: {
          select: {
            registrations: true,
            orgRegistrations: true,
            teamRegistrations: true,
          },
        },
      },
    });

    const memberCount = rosterMembers.length;
    const winRate = totalWins + totalLosses > 0
      ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
      : 0;

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        type: organization.type,
        city: organization.city,
        state: organization.state,
        district: organization.district,
        logoUrl: getCDNUrl(organization.logoUrl),
        planTier: organization.planTier,
        memberSince: organization.createdAt.toISOString(),
      },
      ranking: {
        rank,
        totalOrganizations,
        totalPoints,
        avgPoints: memberCount > 0 ? Math.round(totalPoints / memberCount) : 0,
        avgElo: memberCount > 0 ? Math.round(totalElo / memberCount) : 1000,
        percentile: totalOrganizations > 0 && rank
          ? Math.round((1 - rank / totalOrganizations) * 100)
          : 0,
      },
      stats: {
        totalMembers: memberCount,
        totalWins,
        totalLosses,
        winRate,
        tournamentsHosted: organization._count.hostedIntraOrgs,
      },
      social: {
        followers: followersCount,
      },
      roster: rosterMembers.sort((a, b) => b.points - a.points),
      tournaments: tournaments.map((tournament) => ({
        id: tournament.id,
        name: tournament.name,
        date: tournament.startDate?.toISOString() ?? null,
        status: tournament.status,
        participants:
          tournament._count.registrations +
          tournament._count.orgRegistrations +
          tournament._count.teamRegistrations,
      })),
    });
  } catch (error) {
    console.error('Error fetching public org profile:', error);
    return NextResponse.json({ error: 'Failed to fetch organization profile' }, { status: 500 });
  }
}
