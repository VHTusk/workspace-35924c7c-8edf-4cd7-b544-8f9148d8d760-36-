import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/auth";
import { SportType } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Validate session (properly hashes token before lookup)
    const session = await validateSession(sessionToken);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get sport from query parameter, fallback to user's sport
    const { searchParams } = new URL(request.url);
    const sportParam = searchParams.get("sport");
    const sport = (sportParam?.toUpperCase() as SportType) || session.user.sport;

    // Get all achievements earned by the player
    const earnedAchievements = await db.playerAchievement.findMany({
      where: {
        userId,
        sport,
      },
      include: {
        badge: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            iconUrl: true,
            tier: true,
            category: true,
          },
        },
      },
      orderBy: { earnedAt: "desc" },
    });

    // Get all available badge definitions for this sport
    const allBadges = await db.badgeDefinition.findMany({
      where: {
        sport,
        isActive: true,
      },
    });

    // Create a set of earned badge IDs
    const earnedBadgeIds = new Set(
      earnedAchievements
        .filter((a) => a.badgeId)
        .map((a) => a.badgeId)
    );

    // Combine earned achievements with unearned badges
    const achievements = [
      // Earned achievements
      ...earnedAchievements.map((achievement) => ({
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        type: achievement.type,
        earned: true,
        earnedAt: achievement.earnedAt.toISOString(),
        badge: achievement.badge
          ? {
              id: achievement.badge.id,
              code: achievement.badge.code,
              tier: achievement.badge.tier,
              category: achievement.badge.category,
              iconUrl: achievement.badge.iconUrl,
            }
          : null,
      })),
      // Unearned badges (potential achievements)
      ...allBadges
        .filter((badge) => !earnedBadgeIds.has(badge.id))
        .map((badge) => ({
          id: `badge-${badge.id}`,
          title: badge.name,
          description: badge.description,
          type: badge.code,
          earned: false,
          earnedAt: null,
          badge: {
            id: badge.id,
            code: badge.code,
            tier: badge.tier,
            category: badge.category,
            iconUrl: badge.iconUrl,
          },
        })),
    ];

    // Calculate stats
    const totalPossible = allBadges.length;
    const totalEarned = earnedAchievements.length;

    return NextResponse.json({
      achievements,
      stats: {
        total: totalPossible,
        earned: totalEarned,
        percentage: totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching achievements:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 }
    );
  }
}
