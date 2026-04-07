/**
 * Elo Tier System for VALORHIVE
 * 
 * Based on v3.6.1 Addendum Section B: Elo Tier Transparency
 * 
 * Tiers provide meaningful feedback to players without exposing exact Elo ratings
 * or enabling seeding manipulation.
 * 
 * IMPORTANT: Tiers are derived from HIDDEN ELO, not visible points!
 */

// Elo-based tiers (from spec v3.6.1 Section B.1)
export const ELO_TIERS = [
  { 
    name: 'Unranked', 
    minMatches: 0, 
    maxMatches: 29,
    minElo: 0, 
    maxElo: Infinity,
    color: '#9CA3AF',       // Gray
    bgColor: 'bg-gray-100', 
    textColor: 'text-gray-600',
    description: 'Play 30 matches to get ranked'
  },
  { 
    name: 'Bronze', 
    minMatches: 30,
    minElo: 1000, 
    maxElo: 1299,
    color: '#CD7F32',       // Bronze
    bgColor: 'bg-amber-100', 
    textColor: 'text-amber-700',
    description: '1000-1299 Elo'
  },
  { 
    name: 'Silver', 
    minMatches: 30,
    minElo: 1300, 
    maxElo: 1499,
    color: '#C0C0C0',       // Silver
    bgColor: 'bg-slate-100', 
    textColor: 'text-slate-600',
    description: '1300-1499 Elo'
  },
  { 
    name: 'Gold', 
    minMatches: 30,
    minElo: 1500, 
    maxElo: 1699,
    color: '#FFD700',       // Gold
    bgColor: 'bg-yellow-100', 
    textColor: 'text-yellow-700',
    description: '1500-1699 Elo'
  },
  { 
    name: 'Platinum', 
    minMatches: 30,
    minElo: 1700, 
    maxElo: 1899,
    color: '#008080',       // Teal
    bgColor: 'bg-teal-100', 
    textColor: 'text-teal-700',
    description: '1700-1899 Elo'
  },
  { 
    name: 'Diamond', 
    minMatches: 30,
    minElo: 1900, 
    maxElo: Infinity,
    color: '#4169E1',       // Royal Blue
    bgColor: 'bg-blue-100', 
    textColor: 'text-blue-700',
    description: '1900+ Elo'
  },
] as const;

// Visible Points-based tiers (for display purposes, separate from Elo)
export const POINTS_TIERS = [
  { name: 'Bronze', min: 0, max: 999, color: '#CD7F32', bgColor: 'bg-amber-100', textColor: 'text-amber-700' },
  { name: 'Silver', min: 1000, max: 1999, color: '#C0C0C0', bgColor: 'bg-gray-100', textColor: 'text-gray-600' },
  { name: 'Gold', min: 2000, max: 2999, color: '#FFD700', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
  { name: 'Platinum', min: 3000, max: 4999, color: '#008080', bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
  { name: 'Diamond', min: 5000, max: 9999, color: '#4169E1', bgColor: 'bg-cyan-100', textColor: 'text-cyan-700' },
  { name: 'Champion', min: 10000, max: Infinity, color: '#FF6B35', bgColor: 'bg-orange-100', textColor: 'text-orange-600' },
] as const;

export type EloTier = typeof ELO_TIERS[number];
export type PointsTier = typeof POINTS_TIERS[number];

/**
 * Get Elo tier based on hidden Elo and match count
 * 
 * From spec: "Players with < 30 matches are UNRANKED regardless of Elo"
 * This prevents new players from getting inflated tiers from few matches.
 */
export function getEloTier(elo: number, matchCount: number): EloTier {
  // Unranked if under 30 matches
  if (matchCount < 30) {
    return ELO_TIERS[0]; // Unranked
  }

  // Find tier based on Elo (start from index 1 to skip Unranked)
  for (let i = 1; i < ELO_TIERS.length; i++) {
    const tier = ELO_TIERS[i];
    if (elo >= tier.minElo && elo <= tier.maxElo) {
      return tier;
    }
  }

  // Default to Bronze
  return ELO_TIERS[1];
}

/**
 * Get tier from visible points (for leaderboards)
 * This is separate from Elo tier
 */
export function getTierFromPoints(points: number): PointsTier {
  for (const tier of POINTS_TIERS) {
    if (points >= tier.min && points <= tier.max) {
      return tier;
    }
  }
  return POINTS_TIERS[0]; // Default to Bronze
}

/**
 * Calculate progress to next Elo tier
 */
export function getEloTierProgress(elo: number, matchCount: number): { 
  currentTier: EloTier;
  nextTier: EloTier | null;
  pointsToNext: number;
  progress: number;
  isRanked: boolean;
} {
  const currentTier = getEloTier(elo, matchCount);
  const isRanked = matchCount >= 30;
  
  // Find next tier
  const currentIdx = ELO_TIERS.indexOf(currentTier);
  const nextTier = currentIdx < ELO_TIERS.length - 1 ? ELO_TIERS[currentIdx + 1] : null;

  if (!nextTier || !isRanked) {
    return {
      currentTier,
      nextTier: null,
      pointsToNext: 0,
      progress: isRanked ? 100 : 0,
      isRanked,
    };
  }

  const rangeStart = currentTier.minElo;
  const rangeEnd = nextTier.minElo - 1;
  const range = rangeEnd - rangeStart;
  const progressInTier = elo - rangeStart;
  const progress = Math.min(100, Math.round((progressInTier / range) * 100));
  const pointsToNext = nextTier.minElo - elo;

  return {
    currentTier,
    nextTier,
    pointsToNext,
    progress,
    isRanked,
  };
}

/**
 * Calculate progress to next points tier
 */
export function getPointsToNextTier(points: number): { 
  current: number; 
  needed: number; 
  progress: number;
  currentTier: PointsTier;
  nextTier: PointsTier | null;
} {
  const currentTier = getTierFromPoints(points);
  const tierIndex = POINTS_TIERS.indexOf(currentTier);
  
  if (tierIndex === POINTS_TIERS.length - 1) {
    // Already at max tier
    return { 
      current: points, 
      needed: 0, 
      progress: 100,
      currentTier,
      nextTier: null,
    };
  }
  
  const nextTier = POINTS_TIERS[tierIndex + 1];
  const pointsInTier = points - currentTier.min;
  const pointsNeeded = nextTier.min - currentTier.min;
  const progress = Math.min(100, Math.round((pointsInTier / pointsNeeded) * 100));
  
  return {
    current: points,
    needed: nextTier.min - points,
    progress,
    currentTier,
    nextTier,
  };
}

/**
 * Generate unique referral code
 */
export function generateReferralCode(name: string): string {
  const prefix = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, 'X');
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

/**
 * Get tier distribution for organization roster
 * OrgAdmins can see distribution but NOT individual Elo values
 */
export function getTierDistribution(players: Array<{ hiddenElo: number; matchesPlayed: number }>): Record<string, number> {
  const distribution: Record<string, number> = {
    Unranked: 0,
    Bronze: 0,
    Silver: 0,
    Gold: 0,
    Platinum: 0,
    Diamond: 0,
  };

  for (const player of players) {
    const tier = getEloTier(player.hiddenElo, player.matchesPlayed);
    distribution[tier.name]++;
  }

  return distribution;
}
