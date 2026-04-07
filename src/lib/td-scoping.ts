/**
 * VALORHIVE Tournament Director (TD) Scoping
 * 
 * TDs are hard-scoped to tournaments they are assigned to via TournamentStaff.
 * This module provides helpers to enforce TD access control.
 */

import { db } from './db';
import { Role } from '@prisma/client';

export interface TDAuthorizationResult {
  authorized: boolean;
  error?: string;
  tournamentId?: string;
  role?: string;
}

/**
 * Check if a user is a TD assigned to a specific tournament
 * 
 * @param userId - The user ID to check
 * @param tournamentId - The tournament ID to check access for
 * @returns Authorization result with details
 */
export async function checkTDAssignment(
  userId: string,
  tournamentId: string
): Promise<TDAuthorizationResult> {
  // Check if user has TD role
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, sport: true },
  });

  if (!user) {
    return {
      authorized: false,
      error: 'User not found',
    };
  }

  // ADMIN and SUB_ADMIN have full access to all tournaments
  if (user.role === Role.ADMIN || user.role === Role.SUB_ADMIN) {
    return {
      authorized: true,
      tournamentId,
      role: user.role,
    };
  }

  // TD must be assigned to the tournament via TournamentStaff
  if (user.role === Role.TOURNAMENT_DIRECTOR) {
    const staffAssignment = await db.tournamentStaff.findFirst({
      where: {
        tournamentId,
        userId,
      },
    });

    if (!staffAssignment) {
      return {
        authorized: false,
        error: 'You are not assigned to this tournament',
        tournamentId,
        role: user.role,
      };
    }

    return {
      authorized: true,
      tournamentId,
      role: user.role,
    };
  }

  return {
    authorized: false,
    error: 'Invalid role for tournament access',
    role: user.role,
  };
}

/**
 * Check if a user can perform admin-level actions on a tournament
 * ADMIN and SUB_ADMIN can always perform, TD only if assigned
 * 
 * @param userId - The user ID to check
 * @param tournamentId - The tournament ID to check access for
 * @param requiredRole - Minimum role required (optional, defaults to TD)
 */
export async function canAccessTournament(
  userId: string,
  tournamentId: string,
  requiredRole: Role = Role.TOURNAMENT_DIRECTOR
): Promise<boolean> {
  const result = await checkTDAssignment(userId, tournamentId);
  return result.authorized;
}

/**
 * Get all tournaments a TD is assigned to
 * 
 * @param userId - The TD's user ID
 * @returns Array of tournament IDs the TD can access
 */
export async function getTDAssignedTournaments(userId: string): Promise<string[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    return [];
  }

  // ADMIN and SUB_ADMIN have access to all tournaments
  if (user.role === Role.ADMIN || user.role === Role.SUB_ADMIN) {
    const tournaments = await db.tournament.findMany({
      select: { id: true },
    });
    return tournaments.map(t => t.id);
  }

  // TD only has access to assigned tournaments
  if (user.role === Role.TOURNAMENT_DIRECTOR) {
    const assignments = await db.tournamentStaff.findMany({
      where: { userId },
      select: { tournamentId: true },
    });
    return assignments.map(a => a.tournamentId);
  }

  return [];
}

/**
 * Verify TD access and throw error if not authorized
 * Use this in API routes for quick authorization check
 * 
 * @param userId - The user ID to check
 * @param tournamentId - The tournament ID to check access for
 * @throws Error if not authorized
 */
export async function requireTDAuthorization(
  userId: string,
  tournamentId: string
): Promise<void> {
  const result = await checkTDAssignment(userId, tournamentId);

  if (!result.authorized) {
    throw new Error(result.error || 'Not authorized for this tournament');
  }
}

/**
 * Check if a match belongs to a tournament the TD can access
 * 
 * @param userId - The user ID to check
 * @param matchId - The match ID to check
 */
export async function canAccessMatch(
  userId: string,
  matchId: string
): Promise<{ authorized: boolean; tournamentId?: string; error?: string }> {
  // Get the match with its tournament
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      tournamentId: true,
    },
  });

  if (!match) {
    return {
      authorized: false,
      error: 'Match not found',
    };
  }

  if (!match.tournamentId) {
    // Non-tournament match - only ADMIN/SUB_ADMIN can access
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === Role.ADMIN || user?.role === Role.SUB_ADMIN) {
      return { authorized: true };
    }

    return {
      authorized: false,
      error: 'TDs can only access tournament matches',
    };
  }

  // Check tournament access
  const result = await checkTDAssignment(userId, match.tournamentId);

  return {
    authorized: result.authorized,
    tournamentId: match.tournamentId,
    error: result.error,
  };
}

/**
 * Check if a TD can modify a match (not completed)
 * 
 * @param userId - The user ID to check
 * @param matchId - The match ID to check
 */
export async function canModifyMatch(
  userId: string,
  matchId: string
): Promise<{ authorized: boolean; error?: string }> {
  // First check access
  const accessResult = await canAccessMatch(userId, matchId);

  if (!accessResult.authorized) {
    return accessResult;
  }

  // Check if match is in a completed tournament
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: {
        select: { status: true },
      },
    },
  });

  if (!match) {
    return {
      authorized: false,
      error: 'Match not found',
    };
  }

  // Check tournament status
  if (match.tournament?.status === 'COMPLETED') {
    return {
      authorized: false,
      error: 'Cannot modify matches in a completed tournament',
    };
  }

  // Check if match already has a result (outcome)
  if (match.outcome) {
    // Get user role to check if they can edit results
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    // Only ADMIN/SUB_ADMIN can edit existing results
    if (user?.role !== Role.ADMIN && user?.role !== Role.SUB_ADMIN) {
      return {
        authorized: false,
        error: 'TDs cannot modify matches with existing results. Contact an admin.',
      };
    }
  }

  return { authorized: true };
}

/**
 * Get all matches a TD can manage
 * 
 * @param userId - The TD's user ID
 * @returns Array of match IDs
 */
export async function getTDManagedMatches(userId: string): Promise<string[]> {
  const tournamentIds = await getTDAssignedTournaments(userId);

  if (tournamentIds.length === 0) {
    return [];
  }

  const matches = await db.match.findMany({
    where: {
      tournamentId: { in: tournamentIds },
    },
    select: { id: true },
  });

  return matches.map(m => m.id);
}
