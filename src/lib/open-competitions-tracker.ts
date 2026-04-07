/**
 * Open Competitions Tracker Service (v3.56.0)
 * 
 * Tracks individual students/employees participating in external tournaments
 * outside of official school/college/corporate representation.
 * 
 * Layer 3 of Organization Architecture:
 * - Layer 1: Internal campus sports
 * - Layer 2: Official representation (school teams, rep squads)
 * - Layer 3: Open competitions (individual external participation)
 */

import { db } from './db';
import { SportType } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface OpenCompetitionEntry {
  id: string;
  userId: string;
  userName: string;
  tournamentId: string;
  tournamentName: string;
  tournamentScope: string;
  tournamentStartDate: Date;
  placement?: number | null;
  pointsEarned: number;
  registeredAt: Date;
  orgId?: string | null;
  orgName?: string | null;
}

export interface OpenCompetitionsStats {
  totalParticipants: number;
  activeCompetitions: number;
  topPerformers: TopPerformer[];
  byScope: {
    scope: string;
    count: number;
  }[];
  recentEntries: OpenCompetitionEntry[];
}

export interface TopPerformer {
  userId: string;
  userName: string;
  totalTournaments: number;
  totalPoints: number;
  topPlacements: {
    first: number;
    second: number;
    third: number;
  };
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Get open competitions data for an organization
 * (Students/employees participating individually in external tournaments)
 */
export async function getOrgOpenCompetitions(
  orgId: string,
  sport: SportType,
  options?: {
    limit?: number;
    includeStudents?: boolean;
  }
): Promise<OpenCompetitionsStats> {
  const { limit = 10 } = options || {};
  
  // Get all users affiliated with this org
  const affiliatedUsers = await db.user.findMany({
    where: {
      affiliatedOrgId: orgId,
      sport,
      isActive: true,
    },
    select: { id: true, firstName: true, lastName: true },
  });
  
  const userIds = affiliatedUsers.map(u => u.id);
  
  // Get tournament registrations for these users (excluding intra-org tournaments)
  const registrations = await db.tournamentRegistration.findMany({
    where: {
      userId: { in: userIds },
      status: 'CONFIRMED',
      tournament: {
        sport,
        orgId: { not: orgId }, // Exclude internal tournaments
        isPublic: true,
      },
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          scope: true,
          startDate: true,
          status: true,
        },
      },
      user: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { registeredAt: 'desc' },
    take: limit * 3,
  });
  
  // Get tournament results for placement data
  const tournamentIds = [...new Set(registrations.map(r => r.tournamentId))];
  const results = await db.tournamentResult.findMany({
    where: {
      tournamentId: { in: tournamentIds },
      userId: { in: userIds },
    },
  });
  
  // Compile entries
  const entries: OpenCompetitionEntry[] = registrations.map(reg => {
    const result = results.find(r => 
      r.tournamentId === reg.tournamentId && r.userId === reg.userId
    );
    
    return {
      id: reg.id,
      userId: reg.userId,
      userName: `${reg.user.firstName} ${reg.user.lastName}`,
      tournamentId: reg.tournamentId,
      tournamentName: reg.tournament.name,
      tournamentScope: reg.tournament.scope || 'CITY',
      tournamentStartDate: reg.tournament.startDate,
      placement: result?.rank,
      pointsEarned: result?.bonusPoints || 0,
      registeredAt: reg.registeredAt,
    };
  });
  
  // Calculate stats
  const uniqueParticipants = [...new Set(entries.map(e => e.userId))];
  const uniqueCompetitions = [...new Set(entries.map(e => e.tournamentId))];
  
  // Scope distribution
  const scopeCount: Record<string, number> = {};
  entries.forEach(e => {
    scopeCount[e.tournamentScope] = (scopeCount[e.tournamentScope] || 0) + 1;
  });
  const byScope = Object.entries(scopeCount).map(([scope, count]) => ({ scope, count }));
  
  // Top performers
  const performerStats: Record<string, TopPerformer> = {};
  entries.forEach(entry => {
    if (!performerStats[entry.userId]) {
      performerStats[entry.userId] = {
        userId: entry.userId,
        userName: entry.userName,
        totalTournaments: 0,
        totalPoints: 0,
        topPlacements: { first: 0, second: 0, third: 0 },
      };
    }
    
    performerStats[entry.userId].totalTournaments++;
    performerStats[entry.userId].totalPoints += entry.pointsEarned;
    
    if (entry.placement === 1) performerStats[entry.userId].topPlacements.first++;
    if (entry.placement === 2) performerStats[entry.userId].topPlacements.second++;
    if (entry.placement === 3) performerStats[entry.userId].topPlacements.third++;
  });
  
  const topPerformers = Object.values(performerStats)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 10);
  
  // Active competitions (ongoing or upcoming)
  const now = new Date();
  const activeCompetitions = entries.filter(e => 
    new Date(e.tournamentStartDate) >= now
  ).length;
  
  return {
    totalParticipants: uniqueParticipants.length,
    activeCompetitions,
    topPerformers,
    byScope,
    recentEntries: entries.slice(0, limit),
  };
}

/**
 * Get open competition participation for a specific student/employee
 */
export async function getUserOpenCompetitions(
  userId: string,
  sport: SportType,
  options?: {
    limit?: number;
    includeUpcoming?: boolean;
  }
): Promise<{
  tournaments: OpenCompetitionEntry[];
  stats: {
    totalTournaments: number;
    totalPoints: number;
    wins: number;
    podiums: number;
  };
}> {
  const { limit = 20, includeUpcoming = true } = options || {};
  
  // Get user's org
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { affiliatedOrgId: true },
  });
  
  // Get registrations for external tournaments
  const registrations = await db.tournamentRegistration.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      tournament: {
        sport,
        orgId: user?.affiliatedOrgId ? { not: user.affiliatedOrgId } : undefined,
        isPublic: true,
        ...(includeUpcoming ? {} : { status: 'COMPLETED' }),
      },
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          scope: true,
          startDate: true,
          status: true,
          city: true,
          state: true,
        },
      },
    },
    orderBy: { registeredAt: 'desc' },
    take: limit,
  });
  
  // Get results
  const tournamentIds = registrations.map(r => r.tournamentId);
  const results = await db.tournamentResult.findMany({
    where: {
      userId,
      tournamentId: { in: tournamentIds },
    },
  });
  
  const entries: OpenCompetitionEntry[] = registrations.map(reg => {
    const result = results.find(r => r.tournamentId === reg.tournamentId);
    return {
      id: reg.id,
      userId,
      userName: '',
      tournamentId: reg.tournamentId,
      tournamentName: reg.tournament.name,
      tournamentScope: reg.tournament.scope || 'CITY',
      tournamentStartDate: reg.tournament.startDate,
      placement: result?.rank,
      pointsEarned: result?.bonusPoints || 0,
      registeredAt: reg.registeredAt,
    };
  });
  
  // Calculate stats
  const stats = {
    totalTournaments: entries.length,
    totalPoints: entries.reduce((sum, e) => sum + e.pointsEarned, 0),
    wins: entries.filter(e => e.placement === 1).length,
    podiums: entries.filter(e => e.placement && e.placement <= 3).length,
  };
  
  return { tournaments: entries, stats };
}

/**
 * Track a new open competition entry (called on tournament registration)
 */
export async function trackOpenCompetitionEntry(params: {
  userId: string;
  tournamentId: string;
  orgId?: string;
}): Promise<void> {
  // This is automatically tracked through TournamentRegistration
  // This function exists for explicit logging/tracking if needed
  
  const { userId, tournamentId, orgId } = params;
  
  // Verify this is an external tournament for the user
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { affiliatedOrgId: true, sport: true },
  });
  
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { orgId: true, isPublic: true },
  });
  
  // If tournament is from different org (or no org), it's an open competition
  if (tournament && tournament.orgId !== user?.affiliatedOrgId) {
    // Could add analytics/tracking here
    console.log(`[OpenCompetitions] User ${userId} registered for external tournament ${tournamentId}`);
  }
}

/**
 * Get open competitions summary for dashboard card
 */
export async function getOpenCompetitionsDashboardCard(
  orgId: string,
  sport: SportType,
  orgType: 'SCHOOL' | 'COLLEGE' | 'CORPORATE'
): Promise<{
  participantCount: number;
  activeTournaments: number;
  topPerformer: TopPerformer | null;
  recentParticipation: OpenCompetitionEntry | null;
}> {
  const stats = await getOrgOpenCompetitions(orgId, sport, { limit: 5 });
  
  return {
    participantCount: stats.totalParticipants,
    activeTournaments: stats.activeCompetitions,
    topPerformer: stats.topPerformers[0] || null,
    recentParticipation: stats.recentEntries[0] || null,
  };
}
