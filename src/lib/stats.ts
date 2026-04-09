import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { buildLeaderboardEligibleUserWhere } from '@/lib/user-sport';

/**
 * Update player stats after a match
 * Uses the actual models in the schema: User (hiddenElo, visiblePoints) and PlayerRating
 */
export async function updatePlayerStats(
  userId: string,
  sport: SportType,
  won: boolean,
  score: number
) {
  try {
    // Get current user and rating
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { rating: true },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Calculate ELO change
    const eloChange = won ? Math.max(10, Math.round(score / 2)) : -Math.min(10, Math.round(score / 3));
    const newElo = Math.max(100, user.hiddenElo + eloChange);

    // Calculate points earned
    const pointsEarned = won ? 4 : 2;

    // Calculate new streak
    let newStreak = won ? (user.rating?.currentStreak || 0) + 1 : 0;

    // Update user and rating in a transaction
    await db.$transaction([
      // Update user's ELO and visible points
      db.user.update({
        where: { id: userId },
        data: {
          hiddenElo: newElo,
          visiblePoints: user.visiblePoints + pointsEarned,
        },
      }),
      // Update or create player rating
      db.playerRating.upsert({
        where: { userId },
        create: {
          userId,
          sport,
          matchesPlayed: 1,
          wins: won ? 1 : 0,
          losses: won ? 0 : 1,
          highestElo: newElo,
          currentStreak: newStreak,
          bestStreak: newStreak,
        },
        update: {
          matchesPlayed: { increment: 1 },
          wins: won ? { increment: 1 } : undefined,
          losses: won ? undefined : { increment: 1 },
          highestElo: newElo > (user.rating?.highestElo || 1500) ? newElo : undefined,
          currentStreak: newStreak,
          bestStreak: newStreak > (user.rating?.bestStreak || 0) ? newStreak : undefined,
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error updating player stats:', error);
    return { success: false, error };
  }
}

/**
 * Get player's current rank based on visible points
 */
export async function getPlayerRank(userId: string, sport: SportType): Promise<number | null> {
  const allUsers = await db.user.findMany({
    where: buildLeaderboardEligibleUserWhere(sport, { requirePublic: true }),
    orderBy: { visiblePoints: 'desc' },
    select: { id: true },
  });

  const rank = allUsers.findIndex(u => u.id === userId) + 1;
  return rank > 0 ? rank : null;
}

/**
 * Calculate tier based on ELO rating
 */
export function calculateTier(elo: number, matchesPlayed: number = 0): string {
  // Require at least 10 matches to be ranked
  if (matchesPlayed < 10) return 'Unranked';
  
  if (elo >= 2000) return 'Diamond';
  if (elo >= 1800) return 'Platinum';
  if (elo >= 1600) return 'Gold';
  if (elo >= 1400) return 'Silver';
  return 'Bronze';
}
