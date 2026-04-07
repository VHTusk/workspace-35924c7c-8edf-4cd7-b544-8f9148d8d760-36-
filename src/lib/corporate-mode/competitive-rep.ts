// Competitive Representation Library (v3.54.0)
// Layer 2: Organisation participates in external competitions

import { db } from '@/lib/db';
import { RepSquad, RepPlayer, SportType, TournamentType, RepPlayerType, SquadStatus, RepPlayerStatus } from '@prisma/client';

// ============================================
// SQUAD MANAGEMENT
// ============================================

export interface CreateSquadData {
  orgId: string;
  sport: SportType;
  name: string;
  description?: string;
  managerId?: string;
  coachId?: string;
}

export async function createSquad(data: CreateSquadData): Promise<RepSquad> {
  return db.repSquad.create({
    data: {
      orgId: data.orgId,
      sport: data.sport,
      name: data.name,
      description: data.description,
      managerId: data.managerId,
      coachId: data.coachId,
      status: 'ACTIVE',
    },
  });
}

export async function getOrgSquads(orgId: string, sport?: SportType): Promise<RepSquad[]> {
  const where: { orgId: string; status?: SquadStatus; sport?: SportType } = {
    orgId,
    status: 'ACTIVE',
  };
  
  if (sport) {
    where.sport = sport;
  }

  return db.repSquad.findMany({
    where,
    include: {
      _count: {
        select: {
          players: { where: { status: 'ACTIVE' } },
          tournamentRegistrations: true,
        },
      },
    },
    orderBy: {
      formedAt: 'desc',
    },
  });
}

export async function getSquadById(squadId: string): Promise<RepSquad | null> {
  return db.repSquad.findUnique({
    where: { id: squadId },
    include: {
      organization: true,
      players: {
        where: { status: 'ACTIVE' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              hiddenElo: true,
              visiblePoints: true,
            },
          },
        },
      },
      tournamentRegistrations: {
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              status: true,
              startDate: true,
            },
          },
        },
      },
    },
  });
}

export async function updateSquadStats(squadId: string): Promise<void> {
  const stats = await db.repPlayer.aggregate({
    where: { squadId, status: 'ACTIVE' },
    _sum: {
      matchesPlayed: true,
      wins: true,
      losses: true,
    },
  });

  await db.repSquad.update({
    where: { id: squadId },
    data: {
      matchesPlayed: stats._sum.matchesPlayed || 0,
      wins: stats._sum.wins || 0,
      losses: stats._sum.losses || 0,
    },
  });
}

// ============================================
// PLAYER MANAGEMENT
// ============================================

export interface AddPlayerData {
  squadId: string;
  userId: string;
  playerType: RepPlayerType;
  role?: string;
  contractId?: string;
  contractStartDate?: Date;
  contractEndDate?: Date;
}

export async function addPlayerToSquad(data: AddPlayerData): Promise<RepPlayer> {
  return db.repPlayer.create({
    data: {
      squadId: data.squadId,
      userId: data.userId,
      playerType: data.playerType,
      role: data.role || 'PLAYER',
      contractId: data.contractId,
      contractStartDate: data.contractStartDate,
      contractEndDate: data.contractEndDate,
      status: 'ACTIVE',
    },
  });
}

export async function removePlayerFromSquad(squadId: string, userId: string): Promise<RepPlayer> {
  return db.repPlayer.update({
    where: {
      squadId_userId: { squadId, userId },
    },
    data: {
      status: 'INACTIVE',
      leftAt: new Date(),
    },
  });
}

export async function getSquadPlayers(squadId: string): Promise<RepPlayer[]> {
  return db.repPlayer.findMany({
    where: {
      squadId,
      status: 'ACTIVE',
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          hiddenElo: true,
          visiblePoints: true,
          phone: true,
        },
      },
    },
    orderBy: [
      { role: 'desc' }, // CAPTAIN first
      { joinedAt: 'asc' },
    ],
  });
}

export async function getPlayerCountByType(squadId: string): Promise<{ employeeRep: number; contractPlayer: number }> {
  const [employeeRep, contractPlayer] = await Promise.all([
    db.repPlayer.count({
      where: { squadId, status: 'ACTIVE', playerType: 'EMPLOYEE_REP' },
    }),
    db.repPlayer.count({
      where: { squadId, status: 'ACTIVE', playerType: 'CONTRACT_PLAYER' },
    }),
  ]);

  return { employeeRep, contractPlayer };
}

// ============================================
// TOURNAMENT REGISTRATION
// ============================================

export interface RegisterSquadForTournamentData {
  squadId: string;
  tournamentId: string;
  registeredBy: string;
}

export async function registerSquadForTournament(data: RegisterSquadForTournamentData): Promise<void> {
  // Check if tournament is INTER_ORG
  const tournament = await db.tournament.findUnique({
    where: { id: data.tournamentId },
  });

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  if (tournament.type !== 'INTER_ORG') {
    throw new Error('Squads can only register for INTER_ORG tournaments');
  }

  // Check if already registered
  const existing = await db.repSquadTournamentRegistration.findUnique({
    where: {
      squadId_tournamentId: {
        squadId: data.squadId,
        tournamentId: data.tournamentId,
      },
    },
  });

  if (existing) {
    throw new Error('Squad already registered for this tournament');
  }

  // Create registration
  await db.repSquadTournamentRegistration.create({
    data: {
      squadId: data.squadId,
      tournamentId: data.tournamentId,
      registeredBy: data.registeredBy,
      status: 'PENDING',
    },
  });

  // Update squad tournament count
  await db.repSquad.update({
    where: { id: data.squadId },
    data: {
      tournamentsParticipated: { increment: 1 },
    },
  });
}

// ============================================
// ELIGIBILITY CHECKS
// ============================================

export async function checkSquadEligibility(
  squadId: string,
  tournamentId: string
): Promise<{ eligible: boolean; reason?: string }> {
  const squad = await db.repSquad.findUnique({
    where: { id: squadId },
    include: {
      players: { where: { status: 'ACTIVE' } },
    },
  });

  if (!squad) {
    return { eligible: false, reason: 'Squad not found' };
  }

  if (squad.status !== 'ACTIVE') {
    return { eligible: false, reason: 'Squad is not active' };
  }

  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    return { eligible: false, reason: 'Tournament not found' };
  }

  if (tournament.type !== 'INTER_ORG') {
    return { eligible: false, reason: 'Tournament is not an inter-org tournament' };
  }

  if (tournament.sport !== squad.sport) {
    return { eligible: false, reason: 'Tournament sport does not match squad sport' };
  }

  // Check minimum players
  if (squad.players.length < 1) {
    return { eligible: false, reason: 'Squad needs at least 1 active player' };
  }

  // Check max players per org if applicable
  if (tournament.maxPlayersPerOrg && squad.players.length > tournament.maxPlayersPerOrg) {
    return { eligible: false, reason: `Squad exceeds maximum ${tournament.maxPlayersPerOrg} players per organization` };
  }

  return { eligible: true };
}

// ============================================
// STATISTICS
// ============================================

export async function getCompetitiveRepStats(orgId: string, sport?: SportType) {
  const where: { orgId: string; status: SquadStatus; sport?: SportType } = {
    orgId,
    status: 'ACTIVE',
  };
  
  if (sport) {
    where.sport = sport;
  }

  const [totalSquads, totalPlayers, contractPlayers, tournamentsParticipated] = await Promise.all([
    db.repSquad.count({ where }),
    db.repPlayer.count({
      where: {
        squad: { orgId, status: 'ACTIVE' },
        status: 'ACTIVE',
        ...(sport && { squad: { sport } }),
      },
    }),
    db.repPlayer.count({
      where: {
        squad: { orgId, status: 'ACTIVE' },
        status: 'ACTIVE',
        playerType: 'CONTRACT_PLAYER',
        ...(sport && { squad: { sport } }),
      },
    }),
    db.repSquadTournamentRegistration.count({
      where: {
        squad: { orgId, status: 'ACTIVE' },
        ...(sport && { squad: { sport } }),
      },
    }),
  ]);

  return {
    totalSquads,
    totalPlayers,
    contractPlayers,
    tournamentsParticipated,
  };
}
