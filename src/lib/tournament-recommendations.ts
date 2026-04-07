/**
 * Tournament Recommendations Library
 * 
 * Provides availability-based tournament recommendations for players.
 * Matches player availability slots with tournament dates/times and
 * calculates relevance scores based on multiple factors.
 */

import { db } from '@/lib/db';
import { TournamentStatus, SportType, TournamentType } from '@prisma/client';

// Types
export interface TournamentRecommendation {
  id: string;
  name: string;
  type: TournamentType;
  scope: string | null;
  status: TournamentStatus;
  location: string;
  city: string | null;
  state: string | null;
  startDate: Date;
  endDate: Date;
  regDeadline: Date;
  entryFee: number;
  prizePool: number;
  maxPlayers: number;
  currentRegistrations: number;
  availableSpots: number;
  matchScore: number;
  matchReasons: string[];
  daysUntilStart: number;
  registeredPlayers: {
    id: string;
    name: string;
    elo: number;
    tier: string;
  }[];
}

export interface RecommendationFilters {
  limit?: number;
  offset?: number;
  includeRegistered?: boolean;
  minMatchScore?: number;
}

export interface PlayerAvailabilityInfo {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  specificDate: Date | null;
  isRecurring: boolean;
}

/**
 * Calculate match score for a tournament based on player availability
 * 
 * Scoring factors:
 * - Date match: 40 points (tournament falls on available day)
 * - Time match: 20 points (tournament time within availability window)
 * - Location match: 15 points (same city/state)
 * - Skill match: 15 points (similar ELO players registered)
 * - Urgency: 10 points (registration deadline approaching)
 */
export async function getTournamentRecommendations(
  userId: string,
  sport: SportType,
  filters: RecommendationFilters = {}
): Promise<{
  recommendations: TournamentRecommendation[];
  total: number;
  hasAvailability: boolean;
}> {
  const {
    limit = 10,
    offset = 0,
    includeRegistered = false,
    minMatchScore = 50,
  } = filters;

  // Get player's availability
  const availability = await db.playerAvailability.findMany({
    where: { userId, sport },
  });

  // Get player info for matching
  const player = await db.user.findUnique({
    where: { id: userId },
    select: {
      city: true,
      state: true,
      hiddenElo: true,
      visiblePoints: true,
    },
  });

  if (!player) {
    return { recommendations: [], total: 0, hasAvailability: false };
  }

  // Get tournaments the player is already registered for
  let excludeTournamentIds: string[] = [];
  if (!includeRegistered) {
    const registrations = await db.tournamentRegistration.findMany({
      where: { userId },
      select: { tournamentId: true },
    });
    excludeTournamentIds = registrations.map((r) => r.tournamentId);
  }

  // Get open tournaments with registration open
  const now = new Date();
  const tournaments = await db.tournament.findMany({
    where: {
      sport,
      status: TournamentStatus.REGISTRATION_OPEN,
      regDeadline: { gte: now },
      id: { notIn: excludeTournamentIds },
    },
    include: {
      registrations: {
        where: { status: 'CONFIRMED' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              hiddenElo: true,
              visiblePoints: true,
            },
          },
        },
      },
    },
  });

  // Calculate match scores for each tournament
  const scoredTournaments: TournamentRecommendation[] = tournaments
    .map((tournament) => {
      const score = calculateMatchScore(
        tournament,
        availability,
        player,
        now
      );

      const daysUntilStart = Math.ceil(
        (new Date(tournament.startDate).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const registeredPlayers = tournament.registrations.map((r) => ({
        id: r.user.id,
        name: `${r.user.firstName} ${r.user.lastName}`,
        elo: r.user.hiddenElo,
        tier: getTierFromPoints(r.user.visiblePoints),
      }));

      return {
        id: tournament.id,
        name: tournament.name,
        type: tournament.type,
        scope: tournament.scope,
        status: tournament.status,
        location: tournament.location,
        city: tournament.city,
        state: tournament.state,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        regDeadline: tournament.regDeadline,
        entryFee: tournament.entryFee,
        prizePool: tournament.prizePool,
        maxPlayers: tournament.maxPlayers,
        currentRegistrations: tournament.registrations.length,
        availableSpots: tournament.maxPlayers - tournament.registrations.length,
        matchScore: score.total,
        matchReasons: score.reasons,
        daysUntilStart,
        registeredPlayers,
      };
    })
    .filter((t) => t.matchScore >= minMatchScore)
    .sort((a, b) => b.matchScore - a.matchScore);

  const total = scoredTournaments.length;
  const paginatedResults = scoredTournaments.slice(offset, offset + limit);

  return {
    recommendations: paginatedResults,
    total,
    hasAvailability: availability.length > 0,
  };
}

/**
 * Calculate match score for a tournament
 */
function calculateMatchScore(
  tournament: {
    startDate: Date;
    endDate: Date;
    regDeadline: Date;
    city: string | null;
    state: string | null;
    registrations: { user: { hiddenElo: number } }[];
  },
  availability: PlayerAvailabilityInfo[],
  player: { city: string | null; state: string | null; hiddenElo: number },
  now: Date
): { total: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Check date/availability match
  const tournamentStart = new Date(tournament.startDate);
  const tournamentEnd = new Date(tournament.endDate);
  const tournamentDayOfWeek = tournamentStart.getDay();

  let dateMatch = false;
  let timeMatch = false;

  // Check if tournament falls on available days
  for (const slot of availability) {
    if (slot.specificDate) {
      // Check specific date match
      const slotDate = new Date(slot.specificDate);
      if (
        slotDate.toDateString() === tournamentStart.toDateString() ||
        slotDate.toDateString() === tournamentEnd.toDateString()
      ) {
        dateMatch = true;
        // Check time match for specific date
        if (checkTimeMatch(slot.startTime, slot.endTime)) {
          timeMatch = true;
        }
      }
    } else if (slot.isRecurring && slot.dayOfWeek === tournamentDayOfWeek) {
      // Recurring availability matches tournament day
      dateMatch = true;
      if (checkTimeMatch(slot.startTime, slot.endTime)) {
        timeMatch = true;
      }
    }
  }

  if (dateMatch) {
    score += 40;
    reasons.push('Matches your available day');
  }
  if (timeMatch) {
    score += 20;
    reasons.push('Fits your available time slot');
  }

  // Location match
  if (tournament.city && player.city && tournament.city === player.city) {
    score += 15;
    reasons.push('In your city');
  } else if (
    tournament.state &&
    player.state &&
    tournament.state === player.state
  ) {
    score += 10;
    reasons.push('In your state');
  }

  // Skill level match - check if similar ELO players are registered
  if (tournament.registrations.length > 0) {
    const avgElo =
      tournament.registrations.reduce((sum, r) => sum + r.user.hiddenElo, 0) /
      tournament.registrations.length;
    const eloDiff = Math.abs(player.hiddenElo - avgElo);

    if (eloDiff < 100) {
      score += 15;
      reasons.push('Similar skill level players registered');
    } else if (eloDiff < 200) {
      score += 10;
      reasons.push('Players near your skill level registered');
    }
  }

  // Urgency bonus - registration deadline approaching
  const hoursUntilDeadline =
    (new Date(tournament.regDeadline).getTime() - now.getTime()) /
    (1000 * 60 * 60);
  if (hoursUntilDeadline < 24) {
    score += 10;
    reasons.push('Registration closes soon!');
  } else if (hoursUntilDeadline < 72) {
    score += 5;
    reasons.push('Registration closes in a few days');
  }

  return { total: score, reasons };
}

/**
 * Check if current time falls within availability window
 */
function checkTimeMatch(startTime: string, endTime: string): boolean {
  // Tournament time is typically during the day (9 AM - 6 PM)
  // Check if availability window covers typical tournament hours
  const start = parseInt(startTime.split(':')[0]);
  const end = parseInt(endTime.split(':')[0]);

  // Tournaments usually run 9 AM to 6 PM
  return start <= 10 && end >= 17;
}

/**
 * Get tier from visible points
 */
function getTierFromPoints(points: number): string {
  if (points >= 5000) return 'Diamond';
  if (points >= 3000) return 'Platinum';
  if (points >= 2000) return 'Gold';
  if (points >= 1000) return 'Silver';
  return 'Bronze';
}

/**
 * Get recommendations summary for dashboard widget
 */
export async function getRecommendationsSummary(
  userId: string,
  sport: SportType
): Promise<{
  totalMatches: number;
  thisWeek: number;
  topRecommendation: TournamentRecommendation | null;
  hasAvailability: boolean;
}> {
  const { recommendations, total, hasAvailability } =
    await getTournamentRecommendations(userId, sport, { limit: 5 });

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const thisWeek = recommendations.filter(
    (r) => new Date(r.startDate) <= weekFromNow
  ).length;

  return {
    totalMatches: total,
    thisWeek,
    topRecommendation: recommendations[0] || null,
    hasAvailability,
  };
}

/**
 * Get tournaments matching a specific date (for calendar view)
 */
export async function getTournamentsForDate(
  userId: string,
  sport: SportType,
  date: Date
): Promise<TournamentRecommendation[]> {
  const { recommendations } = await getTournamentRecommendations(userId, sport, {
    limit: 20,
    minMatchScore: 30,
  });

  // Filter to tournaments on or around the specified date
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  return recommendations.filter((t) => {
    const start = new Date(t.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(t.endDate);
    end.setHours(0, 0, 0, 0);

    return targetDate >= start && targetDate <= end;
  });
}

/**
 * Invalidate recommendation cache (call when availability changes)
 */
export async function invalidateRecommendationCache(
  userId: string,
  sport: SportType
): Promise<void> {
  // For now, recommendations are calculated on-demand
  // In production, you might want to cache these and invalidate here
  console.log(`Invalidating recommendation cache for user ${userId} in ${sport}`);
}

/**
 * Check if player should receive recommendation notification
 */
export async function shouldSendRecommendationNotification(
  userId: string,
  sport: SportType
): Promise<{ shouldSend: boolean; newRecommendations: number }> {
  // Check if there are new tournaments matching availability since last notification
  const { recommendations, hasAvailability } = await getTournamentRecommendations(
    userId,
    sport,
    { limit: 10 }
  );

  if (!hasAvailability || recommendations.length === 0) {
    return { shouldSend: false, newRecommendations: 0 };
  }

  // Check notification preferences
  const preferences = await db.notificationPreference.findUnique({
    where: { userId },
  });

  if (preferences && !preferences.tournamentNotifs) {
    return { shouldSend: false, newRecommendations: 0 };
  }

  // In a real implementation, you'd check against last notification timestamp
  // For now, we'll suggest sending if there are high-score recommendations
  const highScoreCount = recommendations.filter((r) => r.matchScore >= 70).length;

  return {
    shouldSend: highScoreCount > 0,
    newRecommendations: highScoreCount,
  };
}
