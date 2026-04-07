import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedOrg } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { org } = auth;

    // Get subscription info
    const subscription = await db.orgSubscription.findUnique({
      where: { orgId: org.id },
    });

    // Get roster with player stats
    const roster = await db.orgRosterPlayer.findMany({
      where: { orgId: org.id, isActive: true },
      include: {
        user: {
          select: {
            visiblePoints: true,
            rating: {
              select: { wins: true, losses: true }
            }
          }
        }
      }
    });

    // Calculate org stats
    const totalMembers = roster.length;
    const totalPoints = roster.reduce((sum, r) => sum + r.user.visiblePoints, 0);
    const totalWins = roster.reduce((sum, r) => sum + (r.user.rating?.wins || 0), 0);
    const totalLosses = roster.reduce((sum, r) => sum + (r.user.rating?.losses || 0), 0);
    const totalMatches = totalWins + totalLosses;
    const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

    // Get tournaments hosted
    const tournamentsHosted = await db.tournament.count({
      where: { orgId: org.id }
    });

    // Calculate org ranking
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

    const orgRankings = allOrgs
      .map(o => ({
        id: o.id,
        totalPoints: o.roster.reduce((sum, r) => sum + r.user.visiblePoints, 0)
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const orgRank = orgRankings.findIndex(o => o.id === org.id) + 1;
    const totalOrgs = orgRankings.length;

    return NextResponse.json({
      id: org.id,
      name: org.name,
      email: org.email,
      phone: org.phone,
      type: org.type,
      city: org.city,
      state: org.state,
      planTier: org.planTier,
      // Organization-specific stats
      totalPoints,
      totalMembers,
      tournamentsHosted,
      winRate,
      rank: orgRank || null,
      totalOrganizations: totalOrgs,
      isSubscribed: subscription?.status === 'ACTIVE',
      subscription: subscription ? {
        status: subscription.status,
        endDate: subscription.endDate.toISOString(),
      } : null,
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
