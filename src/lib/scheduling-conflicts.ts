/**
 * Scheduling Conflict Detection for VALORHIVE
 * 
 * Prevents players from registering for tournaments with overlapping times.
 */

import { db } from '@/lib/db';
import { RegistrationStatus, TournamentStatus } from '@prisma/client';

export interface SchedulingConflict {
  tournamentId: string;
  tournamentName: string;
  startDate: Date;
  endDate: Date;
  overlapType: 'FULL' | 'PARTIAL';
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: SchedulingConflict[];
}

/**
 * Check if a player has scheduling conflicts for a new tournament
 * 
 * @param userId - The player's ID
 * @param newTournamentId - The tournament they want to register for
 * @param bufferHours - Hours of buffer before/after tournament (default: 1)
 */
export async function checkSchedulingConflicts(
  userId: string,
  newTournamentId: string,
  bufferHours: number = 1
): Promise<ConflictCheckResult> {
  try {
    // Get the new tournament details
    const newTournament = await db.tournament.findUnique({
      where: { id: newTournamentId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    if (!newTournament) {
      return { hasConflicts: false, conflicts: [] };
    }

    // Get all tournaments the player is registered for
    const playerRegistrations = await db.tournamentRegistration.findMany({
      where: {
        userId,
        status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.PENDING] },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
    });

    // Also check team tournament registrations
    const teamRegistrations = await db.tournamentTeam.findMany({
      where: {
        team: {
          members: {
            some: { userId },
          },
        },
        status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.PENDING] },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
    });

    const conflicts: SchedulingConflict[] = [];
    const bufferMs = bufferHours * 60 * 60 * 1000;

    // Calculate new tournament time range with buffer
    const newStart = new Date(newTournament.startDate.getTime() - bufferMs);
    const newEnd = new Date(newTournament.endDate.getTime() + bufferMs);

    // Check individual tournament registrations
    for (const reg of playerRegistrations) {
      const existing = reg.tournament;
      
      // Skip cancelled or completed tournaments
      if (existing.status === TournamentStatus.CANCELLED || 
          existing.status === TournamentStatus.COMPLETED) {
        continue;
      }
      
      // Skip the same tournament
      if (existing.id === newTournamentId) {
        continue;
      }

      // Check for overlap
      const existingStart = new Date(existing.startDate.getTime() - bufferMs);
      const existingEnd = new Date(existing.endDate.getTime() + bufferMs);

      if (doTimeRangesOverlap(newStart, newEnd, existingStart, existingEnd)) {
        conflicts.push({
          tournamentId: existing.id,
          tournamentName: existing.name,
          startDate: existing.startDate,
          endDate: existing.endDate,
          overlapType: getOverlapType(newStart, newEnd, existingStart, existingEnd),
        });
      }
    }

    // Check team tournament registrations
    for (const teamReg of teamRegistrations) {
      const existing = teamReg.tournament;
      
      // Skip cancelled or completed tournaments
      if (existing.status === TournamentStatus.CANCELLED || 
          existing.status === TournamentStatus.COMPLETED) {
        continue;
      }
      
      // Skip the same tournament
      if (existing.id === newTournamentId) {
        continue;
      }

      // Check for overlap
      const existingStart = new Date(existing.startDate.getTime() - bufferMs);
      const existingEnd = new Date(existing.endDate.getTime() + bufferMs);

      if (doTimeRangesOverlap(newStart, newEnd, existingStart, existingEnd)) {
        // Avoid duplicate conflicts
        if (!conflicts.find(c => c.tournamentId === existing.id)) {
          conflicts.push({
            tournamentId: existing.id,
            tournamentName: existing.name,
            startDate: existing.startDate,
            endDate: existing.endDate,
            overlapType: getOverlapType(newStart, newEnd, existingStart, existingEnd),
          });
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  } catch (error) {
    console.error('[SchedulingConflicts] Error checking conflicts:', error);
    // On error, allow registration to proceed
    return { hasConflicts: false, conflicts: [] };
  }
}

/**
 * Check if two time ranges overlap
 */
function doTimeRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Determine the type of overlap
 */
function getOverlapType(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): 'FULL' | 'PARTIAL' {
  // Full overlap: one tournament completely contains the other
  if ((start1 <= start2 && end1 >= end2) || (start2 <= start1 && end2 >= end1)) {
    return 'FULL';
  }
  return 'PARTIAL';
}

/**
 * Format conflict message for display
 */
export function formatConflictMessage(conflicts: SchedulingConflict[]): string {
  if (conflicts.length === 0) {
    return '';
  }

  if (conflicts.length === 1) {
    const c = conflicts[0];
    return `You have a scheduling conflict with "${c.tournamentName}" on ${formatDate(c.startDate)}.`;
  }

  const names = conflicts.map(c => c.tournamentName).join(', ');
  return `You have scheduling conflicts with ${conflicts.length} tournaments: ${names}. Please check your schedule.`;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get all upcoming tournaments for a player (for dashboard display)
 */
export async function getUpcomingTournamentsForPlayer(
  userId: string
): Promise<Array<{
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  location: string;
  status: TournamentStatus;
}>> {
  const now = new Date();
  
  // Get individual registrations
  const individualRegs = await db.tournamentRegistration.findMany({
    where: {
      userId,
      status: RegistrationStatus.CONFIRMED,
      tournament: {
        endDate: { gte: now },
        status: { notIn: [TournamentStatus.CANCELLED, TournamentStatus.COMPLETED] },
      },
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          location: true,
          status: true,
        },
      },
    },
    orderBy: {
      tournament: {
        startDate: 'asc',
      },
    },
  });

  // Get team registrations
  const teamRegs = await db.tournamentTeam.findMany({
    where: {
      team: {
        members: {
          some: { userId },
        },
      },
      status: RegistrationStatus.CONFIRMED,
      tournament: {
        endDate: { gte: now },
        status: { notIn: [TournamentStatus.CANCELLED, TournamentStatus.COMPLETED] },
      },
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          location: true,
          status: true,
        },
      },
    },
    orderBy: {
      tournament: {
        startDate: 'asc',
      },
    },
  });

  // Combine and deduplicate
  const tournaments = new Map<string, any>();
  
  for (const reg of individualRegs) {
    tournaments.set(reg.tournament.id, reg.tournament);
  }
  
  for (const reg of teamRegs) {
    tournaments.set(reg.tournament.id, reg.tournament);
  }

  return Array.from(tournaments.values()).sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );
}
