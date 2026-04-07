/**
 * VALORHIVE Court Scheduling Overlap Prevention
 * 
 * Prevents double-booking of courts by checking for overlapping time slots.
 * Uses database constraints and application-level validation.
 */

import { db } from './db';

export interface CourtSlot {
  tournamentId: string;
  courtName: string;
  startTime: Date;
  endTime: Date;
  matchId?: string;
}

export interface OverlapResult {
  hasOverlap: boolean;
  conflicts: Array<{
    matchId: string;
    courtName: string;
    startTime: Date;
    endTime: Date;
    playerA?: string;
    playerB?: string;
  }>;
}

export interface ScheduleValidationResult {
  valid: boolean;
  error?: string;
  conflicts?: OverlapResult['conflicts'];
}

/**
 * Check if two time ranges overlap
 */
function timesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  // Overlap if one range starts before the other ends
  return start1 < end2 && start2 < end1;
}

/**
 * Check for court scheduling conflicts
 * 
 * @param slot - The proposed court slot
 * @param excludeMatchId - Optional match ID to exclude (for updates)
 */
export async function checkCourtOverlap(
  slot: CourtSlot,
  excludeMatchId?: string
): Promise<OverlapResult> {
  // Find all schedule slots for this tournament and court
  const existingSlots = await db.scheduleSlot.findMany({
    where: {
      tournamentId: slot.tournamentId,
      courtName: slot.courtName,
      // Only check slots that have matches assigned
      matchId: { not: null },
    },
    include: {
      tournament: {
        include: {
          matches: {
            where: excludeMatchId ? { id: { not: excludeMatchId } } : undefined,
            include: {
              playerA: { select: { id: true, firstName: true, lastName: true } },
              playerB: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  const conflicts: OverlapResult['conflicts'] = [];

  for (const existingSlot of existingSlots) {
    // Skip if this is the same match being updated
    if (excludeMatchId && existingSlot.matchId === excludeMatchId) {
      continue;
    }

    // Check for time overlap
    if (timesOverlap(slot.startTime, slot.endTime, existingSlot.startTime, existingSlot.endTime)) {
      // Find the match for this slot
      const match = existingSlot.tournament?.matches.find(m => m.id === existingSlot.matchId);
      
      conflicts.push({
        matchId: existingSlot.matchId!,
        courtName: existingSlot.courtName,
        startTime: existingSlot.startTime,
        endTime: existingSlot.endTime,
        playerA: match?.playerA ? `${match.playerA.firstName} ${match.playerA.lastName}` : undefined,
        playerB: match?.playerB ? `${match.playerB.firstName} ${match.playerB.lastName}` : undefined,
      });
    }
  }

  return {
    hasOverlap: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Validate and create a schedule slot
 * Throws error if overlap detected
 */
export async function createScheduleSlot(
  slot: CourtSlot
): Promise<ScheduleValidationResult> {
  // Check for overlaps
  const overlapResult = await checkCourtOverlap(slot);

  if (overlapResult.hasOverlap) {
    return {
      valid: false,
      error: `Court ${slot.courtName} is already booked during the requested time`,
      conflicts: overlapResult.conflicts,
    };
  }

  // Create the schedule slot
  const scheduleSlot = await db.scheduleSlot.create({
    data: {
      tournamentId: slot.tournamentId,
      courtName: slot.courtName,
      startTime: slot.startTime,
      endTime: slot.endTime,
      matchId: slot.matchId,
    },
  });

  return {
    valid: true,
  };
}

/**
 * Validate and update a match's court assignment
 */
export async function updateMatchCourtSchedule(
  matchId: string,
  courtName: string,
  startTime: Date,
  endTime: Date
): Promise<ScheduleValidationResult> {
  // Get the match to find its tournament
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { tournamentId: true },
  });

  if (!match?.tournamentId) {
    return {
      valid: false,
      error: 'Match not found or not part of a tournament',
    };
  }

  // Check for overlaps (excluding current match)
  const overlapResult = await checkCourtOverlap(
    {
      tournamentId: match.tournamentId,
      courtName,
      startTime,
      endTime,
      matchId,
    },
    matchId  // Exclude this match from conflict check
  );

  if (overlapResult.hasOverlap) {
    return {
      valid: false,
      error: `Court ${courtName} is already booked during the requested time`,
      conflicts: overlapResult.conflicts,
    };
  }

  // Check if bracket match exists for this match
  const bracketMatch = await db.bracketMatch.findUnique({
    where: { matchId },
  });

  if (bracketMatch) {
    // Update bracket match with court assignment and time
    await db.bracketMatch.update({
      where: { id: bracketMatch.id },
      data: {
        courtAssignment: courtName,
        scheduledAt: startTime,
      },
    });
  }

  // Update or create schedule slot
  const existingSlot = await db.scheduleSlot.findFirst({
    where: { matchId },
  });

  if (existingSlot) {
    await db.scheduleSlot.update({
      where: { id: existingSlot.id },
      data: {
        courtName,
        startTime,
        endTime,
      },
    });
  } else {
    await db.scheduleSlot.create({
      data: {
        tournamentId: match.tournamentId,
        courtName,
        startTime,
        endTime,
        matchId,
      },
    });
  }

  return { valid: true };
}

/**
 * Get all court assignments for a tournament
 */
export async function getTournamentCourtSchedule(tournamentId: string) {
  const slots = await db.scheduleSlot.findMany({
    where: {
      tournamentId,
      matchId: { not: null },
    },
    include: {
      tournament: {
        include: {
          matches: {
            include: {
              playerA: { select: { id: true, firstName: true, lastName: true } },
              playerB: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
    orderBy: [{ courtName: 'asc' }, { startTime: 'asc' }],
  });

  // Group by court
  const courtSchedule: Record<string, typeof slots> = {};
  
  for (const slot of slots) {
    if (!courtSchedule[slot.courtName]) {
      courtSchedule[slot.courtName] = [];
    }
    courtSchedule[slot.courtName].push(slot);
  }

  return courtSchedule;
}

/**
 * Get available time slots for a court on a specific date
 */
export async function getAvailableSlots(
  tournamentId: string,
  courtName: string,
  date: Date,
  slotDurationMinutes: number = 30
): Promise<Array<{ startTime: Date; endTime: Date }>> {
  // Get all booked slots for this court on this date
  const startOfDay = new Date(date);
  startOfDay.setHours(8, 0, 0, 0);  // Assume courts open at 8 AM

  const endOfDay = new Date(date);
  endOfDay.setHours(22, 0, 0, 0);  // Assume courts close at 10 PM

  const bookedSlots = await db.scheduleSlot.findMany({
    where: {
      tournamentId,
      courtName,
      startTime: { gte: startOfDay },
      endTime: { lte: endOfDay },
      matchId: { not: null },
    },
    orderBy: { startTime: 'asc' },
  });

  // Generate available slots
  const availableSlots: Array<{ startTime: Date; endTime: Date }> = [];
  let currentTime = new Date(startOfDay);

  while (currentTime < endOfDay) {
    const slotEnd = new Date(currentTime.getTime() + slotDurationMinutes * 60 * 1000);

    // Check if this slot overlaps with any booked slot
    const isBooked = bookedSlots.some(slot => 
      timesOverlap(currentTime, slotEnd, slot.startTime, slot.endTime)
    );

    if (!isBooked && slotEnd <= endOfDay) {
      availableSlots.push({
        startTime: new Date(currentTime),
        endTime: slotEnd,
      });
    }

    currentTime = new Date(currentTime.getTime() + slotDurationMinutes * 60 * 1000);
  }

  return availableSlots;
}

/**
 * Validate a batch of match schedules for a tournament
 */
export async function validateTournamentSchedule(
  tournamentId: string
): Promise<{
  valid: boolean;
  errors: Array<{ matchId: string; error: string }>;
  warnings: Array<{ matchId: string; warning: string }>;
}> {
  const errors: Array<{ matchId: string; error: string }> = [];
  const warnings: Array<{ matchId: string; warning: string }> = [];

  // Get all bracket matches with court assignments
  const bracketMatches = await db.bracketMatch.findMany({
    where: {
      bracket: { tournamentId },
      courtAssignment: { not: null },
    },
    include: {
      match: true,
    },
  });

  // Check for overlaps
  for (const bm of bracketMatches) {
    if (!bm.scheduledAt || !bm.courtAssignment || !bm.match) continue;

    // Assume 30-minute matches
    const endTime = new Date(bm.scheduledAt.getTime() + 30 * 60 * 1000);

    const overlapResult = await checkCourtOverlap(
      {
        tournamentId,
        courtName: bm.courtAssignment,
        startTime: bm.scheduledAt,
        endTime,
        matchId: bm.matchId!,
      },
      bm.matchId!
    );

    if (overlapResult.hasOverlap) {
      errors.push({
        matchId: bm.matchId!,
        error: `Court ${bm.courtAssignment} overlap at ${bm.scheduledAt.toISOString()}`,
      });
    }

    // Check for back-to-back matches for same player
    if (bm.match?.playerAId || bm.match?.playerBId) {
      const playerMatches = bracketMatches.filter(
        other =>
          other.id !== bm.id &&
          other.scheduledAt &&
          Math.abs(other.scheduledAt.getTime() - bm.scheduledAt!.getTime()) < 30 * 60 * 1000 &&
          (other.playerAId === bm.playerAId ||
            other.playerAId === bm.playerBId ||
            other.playerBId === bm.playerAId ||
            other.playerBId === bm.playerBId)
      );

      if (playerMatches.length > 0) {
        warnings.push({
          matchId: bm.matchId!,
          warning: 'Player has another match scheduled within 30 minutes',
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
