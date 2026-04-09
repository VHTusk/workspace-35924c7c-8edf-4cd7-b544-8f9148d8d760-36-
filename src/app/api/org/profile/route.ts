import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedOrg } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { org } = auth;

    // Get roster with player details
    const roster = await db.orgRosterPlayer.findMany({
      where: { orgId: org.id, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            visiblePoints: true,
            hiddenElo: true,
            city: true,
            rating: {
              select: {
                wins: true,
                losses: true,
                matchesPlayed: true,
                currentStreak: true,
                bestStreak: true,
              }
            }
          }
        }
      },
      orderBy: { joinedAt: 'asc' }
    });

    // Calculate org stats
    const totalMembers = roster.length;
    const totalPoints = roster.reduce((sum, r) => sum + r.user.visiblePoints, 0);
    const avgPoints = totalMembers > 0 ? Math.round(totalPoints / totalMembers) : 0;
    const avgElo = totalMembers > 0 
      ? Math.round(roster.reduce((sum, r) => sum + r.user.hiddenElo, 0) / totalMembers) 
      : 0;
    const totalWins = roster.reduce((sum, r) => sum + (r.user.rating?.wins || 0), 0);
    const totalLosses = roster.reduce((sum, r) => sum + (r.user.rating?.losses || 0), 0);
    const totalMatches = totalWins + totalLosses;
    const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

    // Calculate organization ranking
    // Get all organizations with their total points
    const allOrgs = await db.organization.findMany({
      where: { sport: org.sport },
      include: {
        roster: {
          where: { isActive: true },
          include: {
            user: { select: { visiblePoints: true } }
          }
        }
      }
    });

    // Calculate rankings
    const orgRankings = allOrgs
      .map(o => ({
        id: o.id,
        name: o.name,
        totalPoints: o.roster.reduce((sum, r) => sum + r.user.visiblePoints, 0),
        memberCount: o.roster.length
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const orgRank = orgRankings.findIndex(o => o.id === org.id) + 1;
    const totalOrgs = orgRankings.length;

    // Get tournaments hosted (only INTER_ORG and INTRA_ORG)
    const tournamentsHosted = await db.tournament.count({
      where: {
        orgId: org.id,
        type: { in: ['INTER_ORG', 'INTRA_ORG'] }
      }
    });

    const completedTournaments = await db.tournament.count({
      where: {
        orgId: org.id,
        type: { in: ['INTER_ORG', 'INTRA_ORG'] },
        status: 'COMPLETED'
      }
    });

    // Get subscription info
    const subscription = await db.orgSubscription.findUnique({
      where: { orgId: org.id },
    });

    return NextResponse.json({
      id: org.id,
      name: org.name,
      email: org.email,
      phone: org.phone,
      type: org.type,
      city: org.city,
      district: org.district,
      state: org.state,
      pinCode: org.pinCode,
      logoUrl: org.logoUrl,
      planTier: org.planTier,
      createdAt: org.createdAt,
      // Ranking
      ranking: {
        rank: orgRank || null,
        totalOrganizations: totalOrgs,
        percentile: totalOrgs > 0 && orgRank ? Math.round(((totalOrgs - orgRank) / totalOrgs) * 100) : 0,
        totalPoints,
        avgPoints,
        avgElo,
      },
      // Stats
      stats: {
        totalMembers,
        totalWins,
        totalLosses,
        winRate,
        tournamentsHosted,
        completedTournaments,
      },
      // Roster
      roster: roster.map(r => ({
        id: r.id,
        userId: r.user.id,
        name: `${r.user.firstName} ${r.user.lastName}`,
        points: r.user.visiblePoints,
        elo: Math.round(r.user.hiddenElo),
        wins: r.user.rating?.wins || 0,
        losses: r.user.rating?.losses || 0,
        city: r.user.city,
        joinedAt: r.joinedAt,
      })),
      // Subscription
      subscription: subscription ? {
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      } : null,
    });
  } catch (error) {
    console.error("Error fetching org profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { org } = auth;

    const body = await request.json();
    const { name, type, city, district, state, pinCode, phone } = body;

    const updatedOrg = await db.organization.update({
      where: { id: org.id },
      data: {
        name,
        type,
        city,
        district,
        state,
        pinCode,
        phone,
      },
    });

    return NextResponse.json({
      success: true,
      org: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        type: updatedOrg.type,
        city: updatedOrg.city,
        district: updatedOrg.district,
        state: updatedOrg.state,
        pinCode: updatedOrg.pinCode,
        phone: updatedOrg.phone,
      },
    });
  } catch (error) {
    console.error("Error updating org profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
