/**
 * VALORHIVE Advanced Analytics Library
 * 
 * Provides comprehensive analytics functions for players and organizations:
 * - Win rate trends over time
 * - Performance by tournament scope
 * - Head-to-head history analysis
 * - Form indicators
 * - Strength of schedule
 * - Player development tracking
 * - Tournament ROI for organizations
 */

import { db } from '@/lib/db';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface WinRateTrendData {
  period: string;
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
  points: number;
  movingAverage: number;
}

export interface WinRateTrendResult {
  periodType: 'daily' | 'weekly' | 'monthly';
  data: WinRateTrendData[];
  summary: {
    totalPeriods: number;
    totalWins: number;
    totalLosses: number;
    overallWinRate: number;
  };
}

export interface PerformanceByScope {
  scope: string;
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
  tournamentsPlayed: number;
  avgOpponentElo: number;
  pointsEarned: number;
  bonusPoints: number;
}

export interface HeadToHeadMatch {
  id: string;
  tournamentId: string | null;
  tournamentName: string | null;
  tournamentScope: string | null;
  playerScore: number | null;
  opponentScore: number | null;
  won: boolean;
  playedAt: Date;
  eloChange: number | null;
}

export interface HeadToHeadHistoryResult {
  player: {
    id: string;
    name: string;
    elo: number;
    points: number;
  };
  opponent: {
    id: string;
    name: string;
    elo: number;
    points: number;
  };
  record: {
    wins: number;
    losses: number;
    totalMatches: number;
  };
  recentMatches: HeadToHeadMatch[];
  winStreak: number;
  currentStreak: number;
  currentStreakType: 'WIN' | 'LOSS' | 'NONE';
  averageScoreDifference: number;
}

export interface FormIndicatorResult {
  currentForm: number; // -10 to +10 scale
  formLevel: 'ICY' | 'COLD' | 'NEUTRAL' | 'WARM' | 'HOT';
  trendDirection: 'RISING' | 'FALLING' | 'STABLE';
  trendMagnitude: number;
  recentResults: ('W' | 'L')[];
  recentWinRate: number;
  currentStreak: number;
  streakType: 'WIN' | 'LOSS' | 'NONE';
  last7DaysForm: number;
  last30DaysForm: number;
  last90DaysForm: number;
}

export interface StrengthOfScheduleResult {
  averageOpponentElo: number;
  highestOpponentElo: number;
  lowestOpponentElo: number;
  top10PercentMatches: number;
  top25PercentMatches: number;
  bottom25PercentMatches: number;
  strengthRating: 'VERY_WEAK' | 'WEAK' | 'AVERAGE' | 'STRONG' | 'VERY_STRONG';
  opponentTierDistribution: { tier: string; count: number }[];
}

export interface PlayerDevelopmentData {
  month: string;
  elo: number;
  eloChange: number;
  matchesPlayed: number;
  winRate: number;
  pointsEarned: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
}

export interface OrgPlayerDevelopmentResult {
  totalMembers: number;
  activeMembers: number;
  avgEloGrowth: number;
  totalPointsGrowth: number;
  developmentScore: number;
  playersImproved: number;
  playersDeclined: number;
  monthlyData: PlayerDevelopmentData[];
  topDevelopers: {
    id: string;
    name: string;
    eloGrowth: number;
    pointsGrowth: number;
  }[];
}

export interface TournamentROI {
  tournamentId: string;
  tournamentName: string;
  scope: string;
  entryFee: number;
  prizeWon: number;
  placement: number;
  playersParticipated: number;
  matchesPlayed: number;
  matchesWon: number;
  pointsEarned: number;
  roi: number; // Return on Investment percentage
}

export interface OrgTournamentROIResult {
  totalTournaments: number;
  totalInvestment: number;
  totalPrizeMoney: number;
  totalPointsEarned: number;
  avgROI: number;
  profitableTournaments: number;
  lossTournaments: number;
  roiDistribution: { range: string; count: number }[];
  tournaments: TournamentROI[];
}

// ============================================
// PLAYER ANALYTICS FUNCTIONS
// ============================================

/**
 * Get win rate trend over time for a player
 */
export async function getPlayerWinRateTrend(
  userId: string,
  months: number = 12
): Promise<WinRateTrendResult> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  // Get all verified matches for this player
  const matches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
      playedAt: { gte: startDate },
    },
    include: {
      tournament: {
        select: { scope: true },
      },
    },
    orderBy: { playedAt: 'asc' },
  });

  // Group matches by month
  const periodData: Record<string, { wins: number; losses: number; points: number }> = {};

  for (const match of matches) {
    if (!match.playedAt) continue;
    
    const date = new Date(match.playedAt);
    const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!periodData[periodKey]) {
      periodData[periodKey] = { wins: 0, losses: 0, points: 0 };
    }

    const won = match.winnerId === userId;
    if (won) {
      periodData[periodKey].wins++;
      const scope = match.tournament?.scope;
      periodData[periodKey].points += getWinPoints(scope);
    } else {
      periodData[periodKey].losses++;
      const scope = match.tournament?.scope;
      periodData[periodKey].points += getParticipationPoints(scope);
    }
  }

  // Convert to array and calculate win rates
  const trends = Object.entries(periodData)
    .map(([period, data]) => ({
      period,
      wins: data.wins,
      losses: data.losses,
      matches: data.wins + data.losses,
      winRate: data.wins + data.losses > 0 
        ? Math.round((data.wins / (data.wins + data.losses)) * 1000) / 10 
        : 0,
      points: data.points,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  // Calculate moving average (last 3 periods)
  const movingAverages = trends.map((trend, index) => {
    const start = Math.max(0, index - 2);
    const window = trends.slice(start, index + 1);
    const avgWinRate = window.reduce((sum, t) => sum + t.winRate, 0) / window.length;
    return {
      ...trend,
      movingAverage: Math.round(avgWinRate * 10) / 10,
    };
  });

  return {
    periodType: 'monthly',
    data: movingAverages,
    summary: {
      totalPeriods: trends.length,
      totalWins: trends.reduce((sum, t) => sum + t.wins, 0),
      totalLosses: trends.reduce((sum, t) => sum + t.losses, 0),
      overallWinRate: trends.length > 0 
        ? Math.round((trends.reduce((sum, t) => sum + t.wins, 0) / 
            (trends.reduce((sum, t) => sum + t.wins, 0) + trends.reduce((sum, t) => sum + t.losses, 0))) * 1000) / 10
        : 0,
    },
  };
}

/**
 * Get performance by tournament scope
 */
export async function getPlayerPerformanceByScope(
  userId: string
): Promise<PerformanceByScope[]> {
  const matches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
    },
    include: {
      tournament: {
        select: { scope: true, id: true },
      },
      playerA: { select: { hiddenElo: true } },
      playerB: { select: { hiddenElo: true } },
    },
  });

  // Get tournament results for bonus points
  const tournamentResults = await db.tournamentResult.findMany({
    where: { userId },
    include: { tournament: { select: { scope: true } } },
  });

  const scopeData: Record<string, {
    wins: number;
    losses: number;
    tournaments: Set<string>;
    opponentElos: number[];
    pointsEarned: number;
    bonusPoints: number;
  }> = {};

  // Initialize all scopes
  ['CITY', 'DISTRICT', 'STATE', 'NATIONAL'].forEach(scope => {
    scopeData[scope] = {
      wins: 0,
      losses: 0,
      tournaments: new Set(),
      opponentElos: [],
      pointsEarned: 0,
      bonusPoints: 0,
    };
  });

  for (const match of matches) {
    const won = match.winnerId === userId;
    const scope = match.tournament?.scope || 'CITY';
    const isPlayerA = match.playerAId === userId;
    const opponentElo = isPlayerA 
      ? (match.playerB?.hiddenElo || 1500)
      : (match.playerA?.hiddenElo || 1500);

    scopeData[scope].wins += won ? 1 : 0;
    scopeData[scope].losses += won ? 0 : 1;
    scopeData[scope].opponentElos.push(opponentElo);
    scopeData[scope].pointsEarned += won ? getWinPoints(scope as any) : getParticipationPoints(scope as any);
    if (match.tournamentId) {
      scopeData[scope].tournaments.add(match.tournamentId);
    }
  }

  // Add bonus points from tournament results
  for (const result of tournamentResults) {
    const scope = result.tournament?.scope || 'CITY';
    scopeData[scope].bonusPoints += result.bonusPoints;
  }

  return Object.entries(scopeData)
    .filter(([, data]) => data.wins + data.losses > 0)
    .map(([scope, data]) => ({
      scope,
      wins: data.wins,
      losses: data.losses,
      matches: data.wins + data.losses,
      winRate: data.wins + data.losses > 0 
        ? Math.round((data.wins / (data.wins + data.losses)) * 1000) / 10 
        : 0,
      tournamentsPlayed: data.tournaments.size,
      avgOpponentElo: data.opponentElos.length > 0 
        ? Math.round(data.opponentElos.reduce((a, b) => a + b, 0) / data.opponentElos.length)
        : 0,
      pointsEarned: data.pointsEarned,
      bonusPoints: data.bonusPoints,
    }));
}

/**
 * Get detailed head-to-head history between two players
 */
export async function getPlayerHeadToHeadHistory(
  userId: string,
  opponentId: string
): Promise<HeadToHeadHistoryResult | null> {
  // Get player info
  const [player, opponent] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, hiddenElo: true, visiblePoints: true },
    }),
    db.user.findUnique({
      where: { id: opponentId },
      select: { id: true, firstName: true, lastName: true, hiddenElo: true, visiblePoints: true },
    }),
  ]);

  if (!player || !opponent) return null;

  // Get all matches between these players
  const matches = await db.match.findMany({
    where: {
      OR: [
        { playerAId: userId, playerBId: opponentId },
        { playerAId: opponentId, playerBId: userId },
      ],
      verificationStatus: 'VERIFIED',
    },
    include: {
      tournament: { select: { id: true, name: true, scope: true } },
    },
    orderBy: { playedAt: 'desc' },
  });

  let wins = 0;
  let losses = 0;
  let currentStreak = 0;
  let currentStreakType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
  let totalScoreDiff = 0;

  const formattedMatches: HeadToHeadMatch[] = matches.map(m => {
    const isPlayerA = m.playerAId === userId;
    const won = m.winnerId === userId;
    const playerScore = isPlayerA ? m.scoreA : m.scoreB;
    const opponentScore = isPlayerA ? m.scoreB : m.scoreA;
    const eloChange = isPlayerA ? m.eloChangeA : m.eloChangeB;

    if (won) wins++;
    else losses++;

    // Calculate score difference
    if (playerScore !== null && opponentScore !== null) {
      totalScoreDiff += won ? (playerScore - opponentScore) : -(opponentScore - playerScore);
    }

    return {
      id: m.id,
      tournamentId: m.tournamentId,
      tournamentName: m.tournament?.name || null,
      tournamentScope: m.tournament?.scope || null,
      playerScore,
      opponentScore,
      won,
      playedAt: m.playedAt,
      eloChange,
    };
  });

  // Calculate current streak
  for (const match of formattedMatches) {
    if (currentStreak === 0) {
      currentStreak = 1;
      currentStreakType = match.won ? 'WIN' : 'LOSS';
    } else if (
      (currentStreakType === 'WIN' && match.won) ||
      (currentStreakType === 'LOSS' && !match.won)
    ) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate longest win streak
  let longestWinStreak = 0;
  let tempStreak = 0;
  for (const match of formattedMatches) {
    if (match.won) {
      tempStreak++;
      longestWinStreak = Math.max(longestWinStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  return {
    player: {
      id: player.id,
      name: `${player.firstName} ${player.lastName}`,
      elo: Math.round(player.hiddenElo),
      points: player.visiblePoints,
    },
    opponent: {
      id: opponent.id,
      name: `${opponent.firstName} ${opponent.lastName}`,
      elo: Math.round(opponent.hiddenElo),
      points: opponent.visiblePoints,
    },
    record: {
      wins,
      losses,
      totalMatches: matches.length,
    },
    recentMatches: formattedMatches,
    winStreak: longestWinStreak,
    currentStreak,
    currentStreakType,
    averageScoreDifference: matches.length > 0 
      ? Math.round((totalScoreDiff / matches.length) * 10) / 10 
      : 0,
  };
}

/**
 * Get player's recent form indicator
 */
export async function getPlayerFormIndicator(
  userId: string,
  lastNMatches: number = 10
): Promise<FormIndicatorResult> {
  const recentMatches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
    },
    include: {
      playerA: { select: { hiddenElo: true } },
      playerB: { select: { hiddenElo: true } },
    },
    orderBy: { playedAt: 'desc' },
    take: 20,
  });

  if (recentMatches.length === 0) {
    return {
      currentForm: 0,
      formLevel: 'NEUTRAL',
      trendDirection: 'STABLE',
      trendMagnitude: 0,
      recentResults: [],
      recentWinRate: 0,
      currentStreak: 0,
      streakType: 'NONE',
      last7DaysForm: 0,
      last30DaysForm: 0,
      last90DaysForm: 0,
    };
  }

  // Calculate recent results
  const recentResults = recentMatches.slice(0, lastNMatches).map(m => 
    m.winnerId === userId ? 'W' as const : 'L' as const
  );
  const recentWins = recentResults.filter(r => r === 'W').length;
  const recentWinRate = recentResults.length > 0 
    ? (recentWins / recentResults.length) * 100 
    : 0;

  // Calculate current streak
  let currentStreak = 0;
  let streakType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
  for (const result of recentResults) {
    if (currentStreak === 0) {
      currentStreak = 1;
      streakType = result === 'W' ? 'WIN' : 'LOSS';
    } else if ((streakType === 'WIN' && result === 'W') || (streakType === 'LOSS' && result === 'L')) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate form score (-10 to +10)
  let formScore = 0;
  const weights = [3, 2.5, 2, 1.5, 1, 0.8, 0.6, 0.4, 0.3, 0.2];
  
  for (let i = 0; i < Math.min(recentMatches.length, lastNMatches); i++) {
    const match = recentMatches[i];
    const won = match.winnerId === userId;
    const isPlayerA = match.playerAId === userId;
    const opponentElo = isPlayerA ? match.playerB?.hiddenElo : match.playerA?.hiddenElo;
    const playerElo = isPlayerA ? match.playerA?.hiddenElo : match.playerB?.hiddenElo;
    
    let matchValue = won ? 1 : -1;
    
    // Bonus for beating higher-rated opponents
    if (won && opponentElo && playerElo && opponentElo > playerElo) {
      matchValue *= 1.5;
    }
    // Penalty for losing to lower-rated opponents
    if (!won && opponentElo && playerElo && opponentElo < playerElo) {
      matchValue *= 1.5;
    }
    
    formScore += matchValue * weights[i];
  }

  // Normalize to -10 to +10 scale
  const maxPossible = weights.reduce((sum, w) => sum + w * 1.5, 0);
  formScore = Math.round((formScore / maxPossible) * 10 * 10) / 10;

  // Determine form level
  let formLevel: 'ICY' | 'COLD' | 'NEUTRAL' | 'WARM' | 'HOT' = 'NEUTRAL';
  if (formScore >= 6) formLevel = 'HOT';
  else if (formScore >= 3) formLevel = 'WARM';
  else if (formScore <= -6) formLevel = 'ICY';
  else if (formScore <= -3) formLevel = 'COLD';

  // Determine trend
  const last5 = recentResults.slice(0, 5);
  const prev5 = recentResults.slice(5, 10);
  const last5WinRate = last5.length > 0 ? last5.filter(r => r === 'W').length / last5.length : 0.5;
  const prev5WinRate = prev5.length > 0 ? prev5.filter(r => r === 'W').length / prev5.length : last5WinRate;
  
  let trendDirection: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';
  if (last5WinRate > prev5WinRate + 0.15) trendDirection = 'RISING';
  else if (last5WinRate < prev5WinRate - 0.15) trendDirection = 'FALLING';

  // Calculate period-based form
  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const periodMatches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
      playedAt: { gte: last90Days },
    },
    orderBy: { playedAt: 'desc' },
  });

  const calcPeriodWinRate = (startDate: Date) => {
    const matches = periodMatches.filter(m => m.playedAt && new Date(m.playedAt) >= startDate);
    const wins = matches.filter(m => m.winnerId === userId).length;
    return matches.length > 0 ? Math.round((wins / matches.length) * 1000) / 10 : 0;
  };

  return {
    currentForm: formScore,
    formLevel,
    trendDirection,
    trendMagnitude: Math.abs(last5WinRate - prev5WinRate) * 100,
    recentResults,
    recentWinRate,
    currentStreak,
    streakType: streakType,
    last7DaysForm: calcPeriodWinRate(last7Days),
    last30DaysForm: calcPeriodWinRate(last30Days),
    last90DaysForm: calcPeriodWinRate(last90Days),
  };
}

/**
 * Get player's strength of schedule
 */
export async function getPlayerStrengthOfSchedule(
  userId: string
): Promise<StrengthOfScheduleResult> {
  const matches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
    },
    include: {
      playerA: { select: { hiddenElo: true } },
      playerB: { select: { hiddenElo: true } },
    },
  });

  if (matches.length === 0) {
    return {
      averageOpponentElo: 0,
      highestOpponentElo: 0,
      lowestOpponentElo: 0,
      top10PercentMatches: 0,
      top25PercentMatches: 0,
      bottom25PercentMatches: 0,
      strengthRating: 'AVERAGE',
      opponentTierDistribution: [],
    };
  }

  // Get user's ELO for reference
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { hiddenElo: true },
  });
  const userElo = user?.hiddenElo || 1500;

  // Calculate percentile thresholds
  const allElos = await db.user.findMany({
    where: { isActive: true },
    select: { hiddenElo: true },
  });
  
  const sortedElos = allElos.map(u => u.hiddenElo).sort((a, b) => a - b);
  const top10Threshold = sortedElos[Math.floor(sortedElos.length * 0.9)] || 1900;
  const top25Threshold = sortedElos[Math.floor(sortedElos.length * 0.75)] || 1700;
  const bottom25Threshold = sortedElos[Math.floor(sortedElos.length * 0.25)] || 1300;

  const opponentElos: number[] = [];
  const tierDistribution: Record<string, number> = {
    'Diamond': 0,
    'Platinum': 0,
    'Gold': 0,
    'Silver': 0,
    'Bronze': 0,
  };

  let top10Count = 0;
  let top25Count = 0;
  let bottom25Count = 0;

  for (const match of matches) {
    const isPlayerA = match.playerAId === userId;
    const opponentElo = isPlayerA 
      ? (match.playerB?.hiddenElo || 1500)
      : (match.playerA?.hiddenElo || 1500);
    
    opponentElos.push(opponentElo);

    // Count percentile matches
    if (opponentElo >= top10Threshold) top10Count++;
    if (opponentElo >= top25Threshold) top25Count++;
    if (opponentElo <= bottom25Threshold) bottom25Count++;

    // Tier distribution
    const tier = getTierFromElo(opponentElo);
    tierDistribution[tier]++;
  }

  const avgOpponentElo = opponentElos.length > 0 
    ? opponentElos.reduce((a, b) => a + b, 0) / opponentElos.length 
    : 0;

  // Calculate strength rating
  const strengthDiff = avgOpponentElo - userElo;
  let strengthRating: 'VERY_WEAK' | 'WEAK' | 'AVERAGE' | 'STRONG' | 'VERY_STRONG' = 'AVERAGE';
  
  if (strengthDiff >= 200) strengthRating = 'VERY_STRONG';
  else if (strengthDiff >= 100) strengthRating = 'STRONG';
  else if (strengthDiff <= -200) strengthRating = 'VERY_WEAK';
  else if (strengthDiff <= -100) strengthRating = 'WEAK';

  return {
    averageOpponentElo: Math.round(avgOpponentElo),
    highestOpponentElo: Math.round(Math.max(...opponentElos)),
    lowestOpponentElo: Math.round(Math.min(...opponentElos)),
    top10PercentMatches: top10Count,
    top25PercentMatches: top25Count,
    bottom25PercentMatches: bottom25Count,
    strengthRating,
    opponentTierDistribution: Object.entries(tierDistribution)
      .filter(([, count]) => count > 0)
      .map(([tier, count]) => ({ tier, count })),
  };
}

// ============================================
// ORGANIZATION ANALYTICS FUNCTIONS
// ============================================

/**
 * Get organization's player development tracking
 * Uses RatingSnapshot for accurate ELO change calculation
 */
export async function getOrgPlayerDevelopment(
  orgId: string
): Promise<OrgPlayerDevelopmentResult> {
  // Get roster with current stats
  const rosterPlayers = await db.orgRosterPlayer.findMany({
    where: { orgId, isActive: true },
    include: {
      user: {
        include: { rating: true },
      },
    },
  });

  // Get monthly development data for the last 6 months
  const monthlyData: PlayerDevelopmentData[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthName = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    // Get matches for all roster players in this month
    const rosterUserIds = rosterPlayers.map(rp => rp.userId);
    
    const monthMatches = await db.match.findMany({
      where: {
        OR: [
          { playerAId: { in: rosterUserIds } },
          { playerBId: { in: rosterUserIds } },
        ],
        playedAt: { gte: startOfMonth, lte: endOfMonth },
        verificationStatus: 'VERIFIED',
      },
      include: {
        tournament: { select: { scope: true } },
      },
    });

    const monthTournaments = await db.tournamentRegistration.count({
      where: {
        userId: { in: rosterUserIds },
        registeredAt: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    const monthWins = monthMatches.filter(m => 
      rosterUserIds.includes(m.winnerId || '')
    ).length;

    // Get actual ELO changes from RatingSnapshot for this month
    const ratingSnapshots = await db.ratingSnapshot.findMany({
      where: {
        playerId: { in: rosterUserIds },
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { rating: true, playerId: true },
    });

    // Calculate actual ELO change from snapshots
    let totalEloChange = 0;
    const playerEloChanges = new Map<string, number>();
    
    for (const snapshot of ratingSnapshots) {
      const prevChange = playerEloChanges.get(snapshot.playerId) || 0;
      playerEloChanges.set(snapshot.playerId, prevChange + (snapshot.rating - 1500));
    }
    
    for (const [_, change] of playerEloChanges) {
      totalEloChange += change;
    }
    
    const avgEloChange = ratingSnapshots.length > 0 
      ? Math.round((totalEloChange / ratingSnapshots.length) * 10) / 10
      : 0;

    // Count tournament wins from tournament results
    const monthTournamentsWon = await db.tournamentResult.count({
      where: {
        userId: { in: rosterUserIds },
        rank: 1,
        tournament: {
          endDate: { gte: startOfMonth, lte: endOfMonth },
        },
      },
    });

    monthlyData.push({
      month: monthName,
      elo: 1500 + (5 - i) * avgEloChange, // Cumulative ELO approximation
      eloChange: avgEloChange,
      matchesPlayed: monthMatches.length,
      winRate: monthMatches.length > 0 
        ? Math.round((monthWins / monthMatches.length) * 1000) / 10 
        : 0,
      pointsEarned: monthMatches.reduce((sum, m) => {
        if (rosterUserIds.includes(m.winnerId || '')) {
          return sum + getWinPoints(m.tournament?.scope as any);
        }
        return sum + getParticipationPoints(m.tournament?.scope as any);
      }, 0),
      tournamentsPlayed: monthTournaments,
      tournamentsWon: monthTournamentsWon,
    });
  }

  // Calculate improvement metrics
  const playersImproved = rosterPlayers.filter(rp => {
    const rating = rp.user.rating;
    if (!rating) return false;
    return rating.wins > rating.losses;
  }).length;

  const playersDeclined = rosterPlayers.filter(rp => {
    const rating = rp.user.rating;
    if (!rating) return false;
    return rating.losses > rating.wins;
  }).length;

  // Top developers (players with most improvement based on actual ELO snapshots)
  const topDevelopers = await Promise.all(
    rosterPlayers.map(async (rp) => {
      const rating = rp.user.rating;
      const wins = rating?.wins || 0;
      const losses = rating?.losses || 0;
      
      // Get actual ELO growth from snapshots
      const snapshots = await db.ratingSnapshot.findMany({
        where: { playerId: rp.user.id },
        orderBy: { createdAt: 'asc' },
        select: { rating: true },
      });
      
      let eloGrowth = 0;
      if (snapshots.length >= 2) {
        eloGrowth = snapshots[snapshots.length - 1].rating - snapshots[0].rating;
      } else {
        // Fallback to net wins estimation if no snapshots
        eloGrowth = (wins - losses) * 10;
      }
      
      return {
        id: rp.user.id,
        name: `${rp.user.firstName} ${rp.user.lastName}`,
        eloGrowth,
        pointsGrowth: rp.user.visiblePoints,
      };
    })
  );

  topDevelopers.sort((a, b) => b.eloGrowth - a.eloGrowth);
  const top5Developers = topDevelopers.slice(0, 5);

  const totalMembers = rosterPlayers.length;
  const activeMembers = rosterPlayers.filter(rp => {
    const rating = rp.user.rating;
    return rating && rating.matchesPlayed > 0;
  }).length;

  return {
    totalMembers,
    activeMembers,
    avgEloGrowth: Math.round(monthlyData.reduce((sum, m) => sum + m.eloChange, 0) * 10) / 10,
    totalPointsGrowth: monthlyData.reduce((sum, m) => sum + m.pointsEarned, 0),
    developmentScore: Math.round((playersImproved / Math.max(totalMembers, 1)) * 100),
    playersImproved,
    playersDeclined,
    monthlyData,
    topDevelopers: top5Developers,
  };
}

/**
 * Get organization's tournament ROI
 */
export async function getOrgTournamentROI(
  orgId: string
): Promise<OrgTournamentROIResult> {
  // Get all tournament registrations for org's players
  const rosterPlayers = await db.orgRosterPlayer.findMany({
    where: { orgId, isActive: true },
    select: { userId: true },
  });
  const rosterUserIds = rosterPlayers.map(rp => rp.userId);

  // Get tournament registrations
  const registrations = await db.tournamentRegistration.findMany({
    where: { userId: { in: rosterUserIds } },
    include: {
      tournament: {
        select: { id: true, name: true, scope: true, entryFee: true, prizePool: true },
      },
    },
  });

  // Get tournament results for prize money
  const results = await db.tournamentResult.findMany({
    where: { userId: { in: rosterUserIds } },
    include: {
      tournament: {
        select: { id: true, name: true, scope: true, entryFee: true, prizePool: true },
      },
    },
  });

  // Get matches for performance calculation
  const matches = await db.match.findMany({
    where: {
      OR: [
        { playerAId: { in: rosterUserIds } },
        { playerBId: { in: rosterUserIds } },
      ],
      verificationStatus: 'VERIFIED',
    },
    include: {
      tournament: { select: { id: true, scope: true } },
    },
  });

  // Group by tournament
  const tournamentMap = new Map<string, TournamentROI>();

  for (const reg of registrations) {
    const tournamentId = reg.tournament.id;
    if (!tournamentMap.has(tournamentId)) {
      tournamentMap.set(tournamentId, {
        tournamentId,
        tournamentName: reg.tournament.name,
        scope: reg.tournament.scope || 'CITY',
        entryFee: reg.tournament.entryFee || 0,
        prizeWon: 0,
        placement: 0,
        playersParticipated: 0,
        matchesPlayed: 0,
        matchesWon: 0,
        pointsEarned: 0,
        roi: 0,
      });
    }
    const entry = tournamentMap.get(tournamentId)!;
    entry.playersParticipated++;
    entry.entryFee += reg.amount;
  }

  // Add results data
  for (const result of results) {
    const tournamentId = result.tournament.id;
    if (tournamentMap.has(tournamentId)) {
      const entry = tournamentMap.get(tournamentId)!;
      entry.placement = Math.min(entry.placement || result.rank, result.rank);
      // Prize money would be calculated based on placement and prize pool
      if (result.rank === 1) {
        entry.prizeWon = Math.round((result.tournament.prizePool || 0) * 0.4);
      } else if (result.rank === 2) {
        entry.prizeWon = Math.round((result.tournament.prizePool || 0) * 0.25);
      } else if (result.rank === 3) {
        entry.prizeWon = Math.round((result.tournament.prizePool || 0) * 0.15);
      }
    }
  }

  // Add match data
  for (const match of matches) {
    const tournamentId = match.tournamentId;
    if (tournamentId && tournamentMap.has(tournamentId)) {
      const entry = tournamentMap.get(tournamentId)!;
      entry.matchesPlayed++;
      if (rosterUserIds.includes(match.winnerId || '')) {
        entry.matchesWon++;
      }
      entry.pointsEarned += rosterUserIds.includes(match.winnerId || '')
        ? getWinPoints(match.tournament?.scope as any)
        : getParticipationPoints(match.tournament?.scope as any);
    }
  }

  // Calculate ROI for each tournament
  const tournaments = Array.from(tournamentMap.values()).map(t => {
    const investment = t.entryFee;
    const returns = t.prizeWon + t.pointsEarned * 10; // Monetize points value
    t.roi = investment > 0 ? Math.round(((returns - investment) / investment) * 100) : 0;
    return t;
  });

  // Calculate overall stats
  const totalInvestment = tournaments.reduce((sum, t) => sum + t.entryFee, 0);
  const totalPrizeMoney = tournaments.reduce((sum, t) => sum + t.prizeWon, 0);
  const totalPointsEarned = tournaments.reduce((sum, t) => sum + t.pointsEarned, 0);
  const avgROI = tournaments.length > 0 
    ? Math.round(tournaments.reduce((sum, t) => sum + t.roi, 0) / tournaments.length) 
    : 0;

  // ROI distribution
  const roiRanges = [
    { range: '< -50%', count: 0 },
    { range: '-50% to 0%', count: 0 },
    { range: '0% to 25%', count: 0 },
    { range: '25% to 50%', count: 0 },
    { range: '> 50%', count: 0 },
  ];

  tournaments.forEach(t => {
    if (t.roi < -50) roiRanges[0].count++;
    else if (t.roi < 0) roiRanges[1].count++;
    else if (t.roi < 25) roiRanges[2].count++;
    else if (t.roi < 50) roiRanges[3].count++;
    else roiRanges[4].count++;
  });

  return {
    totalTournaments: tournaments.length,
    totalInvestment,
    totalPrizeMoney,
    totalPointsEarned,
    avgROI,
    profitableTournaments: tournaments.filter(t => t.roi > 0).length,
    lossTournaments: tournaments.filter(t => t.roi < 0).length,
    roiDistribution: roiRanges.filter(r => r.count > 0),
    tournaments: tournaments.sort((a, b) => b.roi - a.roi),
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getWinPoints(scope: string | null | undefined): number {
  switch (scope) {
    case 'NATIONAL': return 9;
    case 'STATE': return 6;
    case 'DISTRICT': return 4;
    case 'CITY':
    default: return 3;
  }
}

function getParticipationPoints(scope: string | null | undefined): number {
  switch (scope) {
    case 'NATIONAL': return 3;
    case 'STATE': return 2;
    case 'DISTRICT': return 1;
    case 'CITY':
    default: return 1;
  }
}

function getTierFromElo(elo: number): string {
  if (elo >= 1900) return 'Diamond';
  if (elo >= 1700) return 'Platinum';
  if (elo >= 1500) return 'Gold';
  if (elo >= 1300) return 'Silver';
  return 'Bronze';
}
