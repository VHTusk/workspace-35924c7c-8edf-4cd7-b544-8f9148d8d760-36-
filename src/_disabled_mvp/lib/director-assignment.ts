/**
 * VALORHIVE Director Assignment Service (v3.50.0)
 * 
 * Automatically assigns Tournament Directors based on:
 * - Geography (distance from venue)
 * - Sport expertise
 * - Availability status
 * - Current workload
 * - Trust level
 * 
 * Allows manual override by authorized admins.
 */

import { db } from './db';
import { AdminRole, SportType, AdminAvailabilityStatus, DirectorAssignmentType } from '@prisma/client';
import { getActiveAdminsForScope, getRoleLevel } from './admin-permissions';

// ============================================
// TYPES
// ============================================

export interface DirectorCandidate {
  adminId: string;
  userId: string;
  role: AdminRole;
  score: number;
  scoreBreakdown: {
    distance: number;
    trust: number;
    load: number;
    experience: number;
  };
  distanceKm?: number;
  currentLoad: number;
  trustLevel: number;
}

export interface AssignmentResult {
  success: boolean;
  assignmentId?: string;
  selectedAdmin?: DirectorCandidate;
  candidatesConsidered: number;
  assignmentType: DirectorAssignmentType;
  message: string;
  overrideAllowed: boolean;
}

export interface AssignmentOptions {
  allowFallback?: boolean;
  requireAvailability?: boolean;
  minTrustLevel?: number;
  maxDistanceKm?: number;
  manualOverrideBy?: string;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_WEIGHTS = {
  distance: 0.3,
  trust: 0.3,
  load: 0.2,
  experience: 0.2,
};

const MAX_DISTANCE_KM = 100;
const MAX_LOAD_PERCENT = 80;

// ============================================
// MAIN ASSIGNMENT FUNCTION
// ============================================

/**
 * Auto-assign a director to a tournament
 * Called when tournament is created or needs director assignment
 */
export async function assignTournamentDirector(
  tournamentId: string,
  options: AssignmentOptions = {}
): Promise<AssignmentResult> {
  try {
    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        staff: {
          where: { role: 'DIRECTOR' },
        },
      },
    });

    if (!tournament) {
      return {
        success: false,
        candidatesConsidered: 0,
        assignmentType: DirectorAssignmentType.AUTO,
        message: 'Tournament not found',
        overrideAllowed: false,
      };
    }

    // Check if already has director
    if (tournament.staff.length > 0) {
      return {
        success: false,
        candidatesConsidered: 0,
        assignmentType: DirectorAssignmentType.MANUAL,
        message: 'Tournament already has assigned director(s)',
        overrideAllowed: true,
      };
    }

    // Get assignment rules for this region
    const rules = await getAssignmentRules(tournament.sport, tournament.state, tournament.district);

    // Find eligible candidates
    const candidates = await findEligibleDirectors(
      tournament.sport,
      tournament.state,
      tournament.district,
      tournament.city,
      {
        minTrustLevel: options.minTrustLevel ?? rules?.minTrustLevel ?? 0,
        requireAvailability: options.requireAvailability ?? rules?.requireAvailability ?? true,
        maxDistanceKm: options.maxDistanceKm ?? rules?.maxDistanceKm ?? MAX_DISTANCE_KM,
      }
    );

    if (candidates.length === 0) {
      // Try fallback if enabled
      if (options.allowFallback ?? rules?.fallbackToStateAdmin) {
        return await fallbackAssignment(tournamentId, tournament, 'STATE');
      }
      
      return {
        success: false,
        candidatesConsidered: 0,
        assignmentType: DirectorAssignmentType.AUTO,
        message: 'No eligible directors found for assignment',
        overrideAllowed: true,
      };
    }

    // Score and rank candidates
    const scoredCandidates = scoreCandidates(candidates, rules);
    const selected = scoredCandidates[0];

    // Create assignment
    const staffAssignment = await db.tournamentStaff.create({
      data: {
        tournamentId,
        userId: selected.userId,
        role: 'DIRECTOR',
        assignedAt: new Date(),
      },
    });

    // Log the assignment
    await db.autoDirectorAssignmentLog.create({
      data: {
        tournamentId,
        assignmentType: DirectorAssignmentType.AUTO,
        candidatesConsidered: candidates.length,
        candidateScores: JSON.stringify(
          scoredCandidates.slice(0, 5).map((c) => ({
            adminId: c.adminId,
            score: c.score,
            breakdown: c.scoreBreakdown,
          }))
        ),
        selectedAdminId: selected.adminId,
        selectedScore: selected.score,
        selectionReason: generateSelectionReason(selected),
      },
    });

    // Update admin metrics
    await updateAdminLoad(selected.adminId);

    // Notify the assigned director
    await db.notification.create({
      data: {
        userId: selected.userId,
        sport: tournament.sport,
        type: 'DIRECTOR_ASSIGNED',
        title: 'Director Assignment',
        message: `You have been assigned as Director for ${tournament.name}`,
        link: `/director/tournaments/${tournamentId}`,
      },
    });

    return {
      success: true,
      assignmentId: staffAssignment.id,
      selectedAdmin: selected,
      candidatesConsidered: candidates.length,
      assignmentType: DirectorAssignmentType.AUTO,
      message: `Director assigned successfully: Trust level ${selected.trustLevel}, Load ${selected.currentLoad}%`,
      overrideAllowed: rules?.allowManualOverride ?? true,
    };
  } catch (error) {
    console.error('Error assigning director:', error);
    return {
      success: false,
      candidatesConsidered: 0,
      assignmentType: DirectorAssignmentType.AUTO,
      message: 'Failed to assign director',
      overrideAllowed: true,
    };
  }
}

/**
 * Manual override of auto-assigned director
 */
export async function overrideDirectorAssignment(
  tournamentId: string,
  newDirectorId: string,
  overrideById: string,
  reason: string
): Promise<AssignmentResult> {
  try {
    // Get tournament and existing assignment
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        staff: {
          where: { role: 'DIRECTOR' },
        },
      },
    });

    if (!tournament) {
      return {
        success: false,
        candidatesConsidered: 0,
        assignmentType: DirectorAssignmentType.MANUAL,
        message: 'Tournament not found',
        overrideAllowed: false,
      };
    }

    // Verify new director eligibility
    const newDirector = await db.adminAssignment.findFirst({
      where: {
        userId: newDirectorId,
        adminRole: AdminRole.TOURNAMENT_DIRECTOR,
        isActive: true,
      },
    });

    if (!newDirector) {
      return {
        success: false,
        candidatesConsidered: 0,
        assignmentType: DirectorAssignmentType.MANUAL,
        message: 'New director is not eligible',
        overrideAllowed: false,
      };
    }

    // Remove existing assignment
    if (tournament.staff.length > 0) {
      await db.tournamentStaff.deleteMany({
        where: {
          tournamentId,
          role: 'DIRECTOR',
        },
      });
    }

    // Create new assignment
    await db.tournamentStaff.create({
      data: {
        tournamentId,
        userId: newDirectorId,
        role: 'DIRECTOR',
        assignedAt: new Date(),
      },
    });

    // Update assignment log
    const existingLog = await db.autoDirectorAssignmentLog.findFirst({
      where: { tournamentId },
    });

    if (existingLog) {
      await db.autoDirectorAssignmentLog.update({
        where: { id: existingLog.id },
        data: {
          assignmentType: DirectorAssignmentType.AUTO_WITH_OVERRIDE,
          overriddenBy: overrideById,
          overriddenAt: new Date(),
          overrideReason: reason,
          finalAdminId: newDirectorId,
        },
      });
    }

    // Notify new director
    await db.notification.create({
      data: {
        userId: newDirectorId,
        sport: tournament.sport,
        type: 'TOURNAMENT_REGISTERED',
        title: 'Director Assignment Override',
        message: `You have been assigned as Director for ${tournament.name}`,
        link: `/director/tournaments/${tournamentId}`,
      },
    });

    return {
      success: true,
      candidatesConsidered: 1,
      assignmentType: DirectorAssignmentType.AUTO_WITH_OVERRIDE,
      message: 'Director assignment overridden successfully',
      overrideAllowed: false,
    };
  } catch (error) {
    console.error('Error overriding director:', error);
    return {
      success: false,
      candidatesConsidered: 0,
      assignmentType: DirectorAssignmentType.MANUAL,
      message: 'Failed to override director assignment',
      overrideAllowed: true,
    };
  }
}

// ============================================
// CANDIDATE FINDING
// ============================================

async function findEligibleDirectors(
  sport: SportType,
  stateCode?: string | null,
  districtName?: string | null,
  city?: string | null,
  options: {
    minTrustLevel: number;
    requireAvailability: boolean;
    maxDistanceKm: number;
  } = { minTrustLevel: 0, requireAvailability: true, maxDistanceKm: MAX_DISTANCE_KM }
): Promise<DirectorCandidate[]> {
  // Build query for directors
  const whereClause: Record<string, unknown> = {
    adminRole: AdminRole.TOURNAMENT_DIRECTOR,
    isActive: true,
    sport,
  };

  // Add geographic filters
  if (districtName) {
    whereClause.districtName = districtName;
  } else if (stateCode) {
    whereClause.stateCode = stateCode;
  }

  // Get active directors
  const assignments = await db.adminAssignment.findMany({
    where: whereClause,
    include: {
      user: true,
    },
  });

  const candidates: DirectorCandidate[] = [];

  for (const assignment of assignments) {
    // Check trust level
    if (assignment.trustLevel < options.minTrustLevel) continue;

    // Check availability
    if (options.requireAvailability) {
      const availability = await db.adminAvailability.findFirst({
        where: {
          adminId: assignment.id,
          currentStatus: { in: [AdminAvailabilityStatus.AVAILABLE, AdminAvailabilityStatus.EMERGENCY_ONLY] },
        },
      });

      if (!availability) continue;
    }

    // Get current load
    const loadMetric = await db.regionLoadMetric.findFirst({
      where: { adminId: assignment.id },
      orderBy: { createdAt: 'desc' },
    });

    const currentLoad = loadMetric?.currentLoadPercent ?? 0;

    // Skip if over max load
    if (currentLoad >= MAX_LOAD_PERCENT) continue;

    // Calculate distance (simplified - would use actual geo calculation)
    const distanceKm = calculateDistance(
      city,
      assignment.user.city,
      assignment.user.district
    );

    // Skip if over max distance
    if (distanceKm > options.maxDistanceKm) continue;

    candidates.push({
      adminId: assignment.id,
      userId: assignment.userId,
      role: assignment.adminRole,
      score: 0, // Will be calculated
      scoreBreakdown: {
        distance: 0,
        trust: 0,
        load: 0,
        experience: 0,
      },
      distanceKm,
      currentLoad,
      trustLevel: assignment.trustLevel,
    });
  }

  return candidates;
}

async function getAssignmentRules(
  sport: SportType,
  stateCode?: string | null,
  districtName?: string | null
): Promise<{
  minTrustLevel: number;
  requireAvailability: boolean;
  maxDistanceKm: number;
  distanceWeight: number;
  trustWeight: number;
  loadWeight: number;
  experienceWeight: number;
  allowManualOverride: boolean;
  fallbackToStateAdmin: boolean;
} | null> {
  // Try most specific rule first
  const rules = await db.directorAssignmentRule.findFirst({
    where: {
      sport,
      OR: [
        { stateCode, districtName },
        { stateCode, districtName: null },
        { stateCode: null, districtName: null },
      ],
      isActive: true,
    },
    orderBy: [
      { districtName: 'desc' },
      { stateCode: 'desc' },
    ],
  });

  return rules ? {
    minTrustLevel: rules.minTrustLevel,
    requireAvailability: rules.requireAvailability,
    maxDistanceKm: rules.maxDistanceKm ?? MAX_DISTANCE_KM,
    distanceWeight: rules.distanceWeight,
    trustWeight: rules.trustWeight,
    loadWeight: rules.loadWeight,
    experienceWeight: rules.experienceWeight,
    allowManualOverride: rules.allowManualOverride,
    fallbackToStateAdmin: rules.fallbackToStateAdmin,
  } : null;
}

// ============================================
// SCORING
// ============================================

function scoreCandidates(
  candidates: DirectorCandidate[],
  rules: Awaited<ReturnType<typeof getAssignmentRules>>
): DirectorCandidate[] {
  const weights = rules ? {
    distance: rules.distanceWeight,
    trust: rules.trustWeight,
    load: rules.loadWeight,
    experience: rules.experienceWeight,
  } : DEFAULT_WEIGHTS;

  return candidates
    .map((c) => {
      // Distance score (0-1, lower distance = higher score)
      const distanceScore = c.distanceKm ? Math.max(0, 1 - (c.distanceKm / MAX_DISTANCE_KM)) : 0.5;

      // Trust score (0-1, normalized from 0-2)
      const trustScore = c.trustLevel / 2;

      // Load score (0-1, lower load = higher score)
      const loadScore = Math.max(0, 1 - (c.currentLoad / 100));

      // Experience score (placeholder - would use actual experience data)
      const experienceScore = 0.5;

      // Calculate weighted score
      const score =
        distanceScore * weights.distance +
        trustScore * weights.trust +
        loadScore * weights.load +
        experienceScore * weights.experience;

      return {
        ...c,
        score,
        scoreBreakdown: {
          distance: distanceScore,
          trust: trustScore,
          load: loadScore,
          experience: experienceScore,
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ============================================
// FALLBACK ASSIGNMENT
// ============================================

async function fallbackAssignment(
  tournamentId: string,
  tournament: { sport: SportType; state?: string | null; district?: string | null },
  fallbackLevel: 'STATE' | 'SPORT'
): Promise<AssignmentResult> {
  const roleMap: Record<string, AdminRole> = {
    STATE: AdminRole.STATE_ADMIN,
    SPORT: AdminRole.SPORT_ADMIN,
  };

  const targetRole = roleMap[fallbackLevel];

  // Find admin at fallback level
  const whereClause: Record<string, unknown> = {
    adminRole: targetRole,
    sport: tournament.sport,
    isActive: true,
  };

  if (fallbackLevel === 'STATE' && tournament.state) {
    whereClause.stateCode = tournament.state;
  }

  const admin = await db.adminAssignment.findFirst({
    where: whereClause,
  });

  if (!admin) {
    // Try next fallback (STATE -> SPORT)
    if (fallbackLevel === 'STATE') {
      return fallbackAssignment(tournamentId, tournament, 'SPORT');
    }

    return {
      success: false,
      candidatesConsidered: 0,
      assignmentType: DirectorAssignmentType.ESCALATION,
      message: 'No eligible admin found at any level',
      overrideAllowed: true,
    };
  }

  // Create assignment
  await db.tournamentStaff.create({
    data: {
      tournamentId,
      userId: admin.userId,
      role: 'DIRECTOR',
      assignedAt: new Date(),
    },
  });

  // Log fallback assignment
  await db.autoDirectorAssignmentLog.create({
    data: {
      tournamentId,
      assignmentType: DirectorAssignmentType.ESCALATION,
      candidatesConsidered: 1,
      selectedAdminId: admin.id,
      selectedScore: 0,
      selectionReason: `Fallback assignment to ${targetRole}`,
    },
  });

  return {
    success: true,
    candidatesConsidered: 1,
    assignmentType: DirectorAssignmentType.ESCALATION,
    message: `Assigned to ${targetRole} due to no eligible director`,
    overrideAllowed: true,
  };
}

// ============================================
// HELPERS
// ============================================

function calculateDistance(
  _city1?: string | null,
  _city2?: string | null,
  _district?: string | null
): number {
  // Simplified distance calculation
  // In production, would use actual geocoding and distance calculation
  return 10; // Default 10km
}

function generateSelectionReason(candidate: DirectorCandidate): string {
  const reasons: string[] = [];

  if (candidate.scoreBreakdown.trust > 0.8) {
    reasons.push('high trust level');
  }
  if (candidate.scoreBreakdown.load > 0.8) {
    reasons.push('low current load');
  }
  if (candidate.scoreBreakdown.distance > 0.8) {
    reasons.push('close to venue');
  }

  return reasons.length > 0
    ? `Selected for: ${reasons.join(', ')}`
    : 'Best overall match';
}

async function updateAdminLoad(adminId: string): Promise<void> {
  // Get current load
  const activeTournaments = await db.tournamentStaff.count({
    where: {
      userId: (await db.adminAssignment.findUnique({ where: { id: adminId } }))?.userId,
      tournament: {
        status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
      },
    },
  });

  const existingMetric = await db.regionLoadMetric.findFirst({
    where: { adminId },
    orderBy: { createdAt: 'desc' },
  });

  const maxCapacity = 10;
  const loadPercent = (activeTournaments / maxCapacity) * 100;

  await db.regionLoadMetric.create({
    data: {
      adminId,
      userId: existingMetric?.userId ?? '',
      activeTournaments,
      maxCapacity,
      currentLoadPercent: loadPercent,
    },
  });
}

/**
 * Get assignment preview for tournament creation
 * Shows who would be assigned without actually assigning
 */
export async function previewDirectorAssignment(
  sport: SportType,
  stateCode?: string,
  districtName?: string,
  city?: string
): Promise<{
  topCandidate?: DirectorCandidate;
  allCandidates: DirectorCandidate[];
  fallbackAvailable: boolean;
}> {
  const candidates = await findEligibleDirectors(sport, stateCode, districtName, city);
  const rules = await getAssignmentRules(sport, stateCode, districtName);
  const scoredCandidates = scoreCandidates(candidates, rules);

  return {
    topCandidate: scoredCandidates[0],
    allCandidates: scoredCandidates.slice(0, 5),
    fallbackAvailable: rules?.fallbackToStateAdmin ?? true,
  };
}
