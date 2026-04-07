/**
 * Recognition Layer - Title Awarding Service for VALORHIVE
 * 
 * Automatically awards titles to players based on leaderboard positions,
 * tournament wins, and other achievements.
 * 
 * @version v3.44.0
 */

import { db } from '@/lib/db';
import { SportType, TitleType, TitleScope } from '@prisma/client';

// Title configuration with display properties
export const TITLE_CONFIG: Record<TitleType, {
  name: string;
  shortName: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  priority: number; // Higher = more prestigious
}> = {
  // Champions (Top 1)
  CITY_CHAMPION: {
    name: 'City Champion',
    shortName: 'City Champ',
    description: '#1 ranked player in the city',
    icon: '👑',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    priority: 10,
  },
  DISTRICT_CHAMPION: {
    name: 'District Champion',
    shortName: 'District Champ',
    description: '#1 ranked player in the district',
    icon: '👑',
    color: 'text-amber-600',
    bgColor: 'bg-amber-600/10',
    borderColor: 'border-amber-600/30',
    priority: 20,
  },
  STATE_CHAMPION: {
    name: 'State Champion',
    shortName: 'State Champ',
    description: '#1 ranked player in the state',
    icon: '👑',
    color: 'text-amber-700',
    bgColor: 'bg-amber-700/10',
    borderColor: 'border-amber-700/30',
    priority: 30,
  },
  NATIONAL_CHAMPION: {
    name: 'National Champion',
    shortName: 'National Champ',
    description: '#1 ranked player nationally',
    icon: '🏆',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
    priority: 40,
  },
  
  // Top 3
  TOP_3_CITY: {
    name: 'Top 3 - City',
    shortName: 'Top 3 City',
    description: 'Top 3 ranked player in the city',
    icon: '🥉',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/30',
    priority: 5,
  },
  TOP_3_DISTRICT: {
    name: 'Top 3 - District',
    shortName: 'Top 3 District',
    description: 'Top 3 ranked player in the district',
    icon: '🥉',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    priority: 15,
  },
  TOP_3_STATE: {
    name: 'Top 3 - State',
    shortName: 'Top 3 State',
    description: 'Top 3 ranked player in the state',
    icon: '🥉',
    color: 'text-orange-600',
    bgColor: 'bg-orange-600/10',
    borderColor: 'border-orange-600/30',
    priority: 25,
  },
  TOP_3_NATIONAL: {
    name: 'Top 3 - National',
    shortName: 'Top 3 National',
    description: 'Top 3 ranked player nationally',
    icon: '🥉',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/30',
    priority: 35,
  },
  
  // Top 10
  TOP_10_CITY: {
    name: 'Top 10 - City',
    shortName: 'Top 10 City',
    description: 'Top 10 ranked player in the city',
    icon: '⭐',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30',
    priority: 2,
  },
  TOP_10_DISTRICT: {
    name: 'Top 10 - District',
    shortName: 'Top 10 District',
    description: 'Top 10 ranked player in the district',
    icon: '⭐',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    priority: 12,
  },
  TOP_10_STATE: {
    name: 'Top 10 - State',
    shortName: 'Top 10 State',
    description: 'Top 10 ranked player in the state',
    icon: '⭐',
    color: 'text-blue-600',
    bgColor: 'bg-blue-600/10',
    borderColor: 'border-blue-600/30',
    priority: 22,
  },
  TOP_10_NATIONAL: {
    name: 'Top 10 - National',
    shortName: 'Top 10 National',
    description: 'Top 10 ranked player nationally',
    icon: '⭐',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30',
    priority: 32,
  },
  
  // Tournament/Series
  TOURNAMENT_WINNER: {
    name: 'Tournament Winner',
    shortName: 'Tournament Winner',
    description: 'Won a tournament',
    icon: '🏆',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    borderColor: 'border-emerald-400/30',
    priority: 8,
  },
  SERIES_CHAMPION: {
    name: 'Series Champion',
    shortName: 'Series Champ',
    description: 'Won a tournament series',
    icon: '🏅',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/30',
    priority: 18,
  },
  
  // Force hierarchy
  FORCE_CHAMPION: {
    name: 'Force Champion',
    shortName: 'Force Champ',
    description: '#1 ranked player in the force',
    icon: '🎖️',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/30',
    priority: 38,
  },
  SECTOR_CHAMPION: {
    name: 'Sector Champion',
    shortName: 'Sector Champ',
    description: '#1 ranked player in the sector',
    icon: '🎖️',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    priority: 28,
  },
  ZONE_CHAMPION: {
    name: 'Zone Champion',
    shortName: 'Zone Champ',
    description: '#1 ranked player in the zone',
    icon: '🎖️',
    color: 'text-red-600',
    bgColor: 'bg-red-600/10',
    borderColor: 'border-red-600/30',
    priority: 18,
  },
  UNIT_CHAMPION: {
    name: 'Unit Champion',
    shortName: 'Unit Champ',
    description: '#1 ranked player in the unit',
    icon: '🎖️',
    color: 'text-red-700',
    bgColor: 'bg-red-700/10',
    borderColor: 'border-red-700/30',
    priority: 8,
  },
};

// Map scope to title types
const SCOPE_TITLE_MAP: Record<TitleScope, {
  champion: TitleType;
  top3: TitleType;
  top10: TitleType;
}> = {
  CITY: {
    champion: TitleType.CITY_CHAMPION,
    top3: TitleType.TOP_3_CITY,
    top10: TitleType.TOP_10_CITY,
  },
  DISTRICT: {
    champion: TitleType.DISTRICT_CHAMPION,
    top3: TitleType.TOP_3_DISTRICT,
    top10: TitleType.TOP_10_DISTRICT,
  },
  STATE: {
    champion: TitleType.STATE_CHAMPION,
    top3: TitleType.TOP_3_STATE,
    top10: TitleType.TOP_10_STATE,
  },
  NATIONAL: {
    champion: TitleType.NATIONAL_CHAMPION,
    top3: TitleType.TOP_3_NATIONAL,
    top10: TitleType.TOP_10_NATIONAL,
  },
  FORCE: {
    champion: TitleType.FORCE_CHAMPION,
    top3: TitleType.FORCE_CHAMPION, // Force only has champion
    top10: TitleType.FORCE_CHAMPION,
  },
  SECTOR: {
    champion: TitleType.SECTOR_CHAMPION,
    top3: TitleType.SECTOR_CHAMPION,
    top10: TitleType.SECTOR_CHAMPION,
  },
  ZONE: {
    champion: TitleType.ZONE_CHAMPION,
    top3: TitleType.ZONE_CHAMPION,
    top10: TitleType.ZONE_CHAMPION,
  },
  UNIT: {
    champion: TitleType.UNIT_CHAMPION,
    top3: TitleType.UNIT_CHAMPION,
    top10: TitleType.UNIT_CHAMPION,
  },
  TOURNAMENT: {
    champion: TitleType.TOURNAMENT_WINNER,
    top3: TitleType.TOURNAMENT_WINNER,
    top10: TitleType.TOURNAMENT_WINNER,
  },
  SERIES: {
    champion: TitleType.SERIES_CHAMPION,
    top3: TitleType.SERIES_CHAMPION,
    top10: TitleType.SERIES_CHAMPION,
  },
};

/**
 * Award a title to a player
 */
export async function awardTitle(params: {
  userId: string;
  sport: SportType;
  titleType: TitleType;
  scope: TitleScope;
  city?: string;
  district?: string;
  state?: string;
  tournamentId?: string;
  seriesId?: string;
  rank?: number;
  points?: number;
  expiresAt?: Date;
}): Promise<{ success: boolean; titleId?: string; error?: string }> {
  try {
    // Check if player already has this title
    const existing = await db.playerTitle.findFirst({
      where: {
        userId: params.userId,
        sport: params.sport,
        titleType: params.titleType,
        scope: params.scope,
        city: params.city || null,
        district: params.district || null,
        state: params.state || null,
      },
    });

    if (existing) {
      // Update existing title if it's still active
      if (existing.isActive) {
        return { success: true, titleId: existing.id };
      }
      
      // Reactivate expired title
      await db.playerTitle.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          points: params.points,
          rank: params.rank,
          awardedAt: new Date(),
          expiresAt: params.expiresAt,
        },
      });
      return { success: true, titleId: existing.id };
    }

    // Create new title
    const title = await db.playerTitle.create({
      data: {
        userId: params.userId,
        sport: params.sport,
        titleType: params.titleType,
        scope: params.scope,
        city: params.city,
        district: params.district,
        state: params.state,
        tournamentId: params.tournamentId,
        seriesId: params.seriesId,
        rank: params.rank,
        points: params.points,
        expiresAt: params.expiresAt,
        isActive: true,
      },
    });

    // Create notification
    const titleConfig = TITLE_CONFIG[params.titleType];
    await db.notification.create({
      data: {
        userId: params.userId,
        sport: params.sport,
        type: 'POINTS_EARNED', // Using existing type, could add TITLE_EARNED
        title: `${titleConfig.icon} Title Earned: ${titleConfig.name}`,
        message: titleConfig.description,
        link: `/${params.sport.toLowerCase()}/profile`,
      },
    });

    console.log(`[Titles] Awarded "${titleConfig.name}" to user ${params.userId}`);
    return { success: true, titleId: title.id };
  } catch (error) {
    console.error('[Titles] Failed to award title:', error);
    return { success: false, error: 'Failed to award title' };
  }
}

/**
 * Award titles based on leaderboard position
 * Called when leaderboard rankings are updated
 */
export async function awardLeaderboardTitles(params: {
  sport: SportType;
  scope: TitleScope;
  city?: string;
  district?: string;
  state?: string;
  leaderboard: Array<{
    userId: string;
    rank: number;
    points: number;
  }>;
}): Promise<{ awarded: number }> {
  let awarded = 0;
  const titleTypes = SCOPE_TITLE_MAP[params.scope];

  for (const player of params.leaderboard) {
    // Award champion title for #1
    if (player.rank === 1 && titleTypes.champion) {
      const result = await awardTitle({
        userId: player.userId,
        sport: params.sport,
        titleType: titleTypes.champion,
        scope: params.scope,
        city: params.city,
        district: params.district,
        state: params.state,
        rank: player.rank,
        points: player.points,
      });
      if (result.success) awarded++;
    }
    
    // Award top 3 title for positions 2-3
    if (player.rank > 1 && player.rank <= 3 && titleTypes.top3) {
      const result = await awardTitle({
        userId: player.userId,
        sport: params.sport,
        titleType: titleTypes.top3,
        scope: params.scope,
        city: params.city,
        district: params.district,
        state: params.state,
        rank: player.rank,
        points: player.points,
      });
      if (result.success) awarded++;
    }
    
    // Award top 10 title for positions 4-10
    if (player.rank > 3 && player.rank <= 10 && titleTypes.top10) {
      const result = await awardTitle({
        userId: player.userId,
        sport: params.sport,
        titleType: titleTypes.top10,
        scope: params.scope,
        city: params.city,
        district: params.district,
        state: params.state,
        rank: player.rank,
        points: player.points,
      });
      if (result.success) awarded++;
    }
  }

  console.log(`[Titles] Awarded ${awarded} titles for ${params.scope} leaderboard`);
  return { awarded };
}

/**
 * Award tournament winner title
 */
export async function awardTournamentWinnerTitle(params: {
  userId: string;
  sport: SportType;
  tournamentId: string;
  tournamentName: string;
}): Promise<{ success: boolean }> {
  const result = await awardTitle({
    userId: params.userId,
    sport: params.sport,
    titleType: TitleType.TOURNAMENT_WINNER,
    scope: TitleScope.TOURNAMENT,
    tournamentId: params.tournamentId,
    rank: 1,
  });

  return { success: result.success };
}

/**
 * Award series champion title
 */
export async function awardSeriesChampionTitle(params: {
  userId: string;
  sport: SportType;
  seriesId: string;
  seriesName: string;
}): Promise<{ success: boolean }> {
  const result = await awardTitle({
    userId: params.userId,
    sport: params.sport,
    titleType: TitleType.SERIES_CHAMPION,
    scope: TitleScope.SERIES,
    seriesId: params.seriesId,
    rank: 1,
  });

  return { success: result.success };
}

/**
 * Get all active titles for a player
 */
export async function getPlayerTitles(userId: string, sport: SportType) {
  return db.playerTitle.findMany({
    where: {
      userId,
      sport,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: [
      { isPrimary: 'desc' },
      { displayOrder: 'asc' },
      { awardedAt: 'desc' },
    ],
  });
}

/**
 * Get the primary title for a player (most prestigious)
 */
export async function getPrimaryTitle(userId: string, sport: SportType) {
  const titles = await getPlayerTitles(userId, sport);
  
  if (titles.length === 0) return null;
  
  // Check for explicitly marked primary title
  const primary = titles.find(t => t.isPrimary);
  if (primary) return primary;
  
  // Return the most prestigious title based on priority
  const sortedByPriority = titles.sort((a, b) => {
    const priorityA = TITLE_CONFIG[a.titleType]?.priority || 0;
    const priorityB = TITLE_CONFIG[b.titleType]?.priority || 0;
    return priorityB - priorityA;
  });
  
  return sortedByPriority[0];
}

/**
 * Set a title as primary for a player
 */
export async function setPrimaryTitle(userId: string, titleId: string, sport: SportType) {
  // First, unset all primary titles for this user/sport
  await db.playerTitle.updateMany({
    where: {
      userId,
      sport,
      isPrimary: true,
    },
    data: {
      isPrimary: false,
    },
  });

  // Set the selected title as primary
  await db.playerTitle.update({
    where: { id: titleId },
    data: { isPrimary: true },
  });
}

/**
 * Get title holders for a specific scope (e.g., City Champions list)
 */
export async function getTitleHolders(params: {
  sport: SportType;
  titleType?: TitleType;
  scope: TitleScope;
  city?: string;
  district?: string;
  state?: string;
  limit?: number;
}) {
  const where: Record<string, unknown> = {
    sport: params.sport,
    scope: params.scope,
    isActive: true,
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ],
  };

  if (params.titleType) {
    where.titleType = params.titleType;
  }
  if (params.city) {
    where.city = params.city;
  }
  if (params.district) {
    where.district = params.district;
  }
  if (params.state) {
    where.state = params.state;
  }

  return db.playerTitle.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          city: true,
          state: true,
          visiblePoints: true,
          globalElo: true,
        },
      },
    },
    orderBy: {
      awardedAt: 'desc',
    },
    take: params.limit || 10,
  });
}

/**
 * Recalculate titles for all players in a scope
 * This is a heavy operation and should be run as a background job
 */
export async function recalculateScopeTitles(params: {
  sport: SportType;
  scope: TitleScope;
  city?: string;
  district?: string;
  state?: string;
}): Promise<{ processed: number; awarded: number }> {
  // Get all players for this scope, ordered by points
  const where: Record<string, unknown> = {
    sport: params.sport,
    isActive: true,
    showOnLeaderboard: true,
  };

  if (params.city) where.city = params.city;
  if (params.district) where.district = params.district;
  if (params.state) where.state = params.state;

  const players = await db.user.findMany({
    where,
    select: {
      id: true,
      visiblePoints: true,
    },
    orderBy: {
      visiblePoints: 'desc',
    },
    take: 100, // Only top 100
  });

  const leaderboard = players.map((p, index) => ({
    userId: p.id,
    rank: index + 1,
    points: p.visiblePoints,
  }));

  const result = await awardLeaderboardTitles({
    sport: params.sport,
    scope: params.scope,
    city: params.city,
    district: params.district,
    state: params.state,
    leaderboard,
  });

  return { processed: players.length, awarded: result.awarded };
}

/**
 * Get formatted title display string
 */
export function formatTitle(title: { titleType: TitleType; city?: string | null; district?: string | null; state?: string | null }): string {
  const config = TITLE_CONFIG[title.titleType];
  if (!config) return 'Unknown Title';
  
  // Add location for geographic titles
  const location = title.city || title.district || title.state;
  if (location && [TitleType.CITY_CHAMPION, TitleType.DISTRICT_CHAMPION, TitleType.STATE_CHAMPION].includes(title.titleType)) {
    return `${config.name} - ${location}`;
  }
  
  return config.name;
}
