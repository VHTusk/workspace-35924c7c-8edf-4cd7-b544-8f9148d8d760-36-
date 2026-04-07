/**
 * VALORHIVE Team Library
 * Helper functions for team management (Doubles and Team tournaments)
 */

import { db } from '@/lib/db';
import { SportType, TournamentFormat, TeamStatus, TeamInvitationStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

// ============================================
// Types
// ============================================

export interface CreateTeamInput {
  name: string;
  captainId: string;
  sport: SportType;
  format?: TournamentFormat;
  partnerId?: string;
  message?: string;
}

export interface InviteMemberInput {
  teamId: string;
  inviterId: string;
  inviteeId: string;
  message?: string;
}

export interface TeamWithMembers {
  id: string;
  name: string;
  sport: SportType;
  format: TournamentFormat;
  status: TeamStatus;
  teamElo: number;
  wins: number;
  losses: number;
  points: number;
  matchesPlayed: number;
  captainId: string;
  createdAt: Date;
  updatedAt: Date;
  members: {
    id: string;
    userId: string;
    role: string;
    joinedAt: Date;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      hiddenElo: number;
      visiblePoints: number;
      city: string | null;
      state: string | null;
    };
  }[];
  isMember?: boolean;
  userRole?: string | null;
}

// ============================================
// Team CRUD Operations
// ============================================

/**
 * Create a new team
 * - Creates the team with captain as first member
 * - Optionally sends invitation to partner
 * - Team starts as PENDING until partner accepts (for doubles)
 */
export async function createTeam(input: CreateTeamInput) {
  const { name, captainId, sport, format = 'DOUBLES', partnerId, message } = input;

  // Validate sport
  if (!['CORNHOLE', 'DARTS'].includes(sport)) {
    throw new Error('Invalid sport. Must be CORNHOLE or DARTS');
  }

  // Check if captain exists and matches sport
  const captain = await db.user.findUnique({
    where: { id: captainId },
    select: { id: true, sport: true, isActive: true },
  });

  if (!captain || !captain.isActive) {
    throw new Error('Captain not found or inactive');
  }

  if (captain.sport !== sport) {
    throw new Error('Captain sport mismatch');
  }

  // Check if captain already has a team for this sport
  const existingTeam = await db.teamMember.findFirst({
    where: {
      userId: captainId,
      team: {
        sport,
        status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] },
      },
    },
  });

  if (existingTeam) {
    throw new Error('You already have a team for this sport. One team per sport allowed.');
  }

  // Check if team name already exists for this sport
  const existingTeamName = await db.team.findUnique({
    where: {
      name_sport: { name, sport },
    },
  });

  if (existingTeamName) {
    throw new Error('Team name already exists for this sport');
  }

  // Get max team size based on format
  const maxMembers = format === 'DOUBLES' ? 2 : format === 'TEAM' ? 4 : 1;

  // Create team with captain
  const team = await db.team.create({
    data: {
      name,
      sport,
      format,
      captainId,
      status: format === 'INDIVIDUAL' ? TeamStatus.ACTIVE : TeamStatus.PENDING,
      members: {
        create: [
          {
            userId: captainId,
            role: 'CAPTAIN',
          },
        ],
      },
    },
    include: {
      members: {
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

  // If partner is specified, send invitation
  if (partnerId && format !== 'INDIVIDUAL') {
    await inviteMember({
      teamId: team.id,
      inviterId: captainId,
      inviteeId: partnerId,
      message,
    });
  }

  return team;
}

/**
 * Get team by ID
 */
export async function getTeamById(teamId: string, userId?: string): Promise<TeamWithMembers | null> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              hiddenElo: true,
              visiblePoints: true,
              city: true,
              state: true,
            },
          },
        },
        orderBy: [
          { role: 'desc' }, // CAPTAIN first
          { joinedAt: 'asc' },
        ],
      },
    },
  });

  if (!team) return null;

  const membership = userId ? team.members.find(m => m.userId === userId) : null;

  return {
    ...team,
    isMember: !!membership,
    userRole: membership?.role || null,
  };
}

/**
 * Get all teams for a user in a specific sport
 */
export async function getUserTeams(userId: string, sport: SportType) {
  return db.team.findMany({
    where: {
      sport,
      status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] },
      members: {
        some: { userId },
      },
    },
    include: {
      members: {
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
      _count: {
        select: { tournamentTeams: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get all public teams for a sport (for browsing)
 */
export async function getPublicTeams(
  sport: SportType,
  options?: {
    format?: TournamentFormat;
    status?: TeamStatus;
    limit?: number;
    offset?: number;
  }
) {
  const { format, status = TeamStatus.ACTIVE, limit = 20, offset = 0 } = options || {};

  return db.team.findMany({
    where: {
      sport,
      status,
      ...(format && { format }),
    },
    include: {
      members: {
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
      _count: {
        select: { tournamentTeams: true },
      },
    },
    orderBy: [
      { teamElo: 'desc' },
      { wins: 'desc' },
    ],
    take: limit,
    skip: offset,
  });
}

/**
 * Update team details (name only for now)
 */
export async function updateTeam(teamId: string, userId: string, data: { name?: string }) {
  // Check if user is the captain
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      members: { where: { userId } },
    },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  const member = team.members[0];
  if (!member || member.role !== 'CAPTAIN') {
    throw new Error('Only team captain can update the team');
  }

  // If changing name, check for duplicates
  if (data.name && data.name !== team.name) {
    const existingTeam = await db.team.findUnique({
      where: {
        name_sport: { name: data.name, sport: team.sport },
      },
    });

    if (existingTeam) {
      throw new Error('Team name already exists');
    }
  }

  return db.team.update({
    where: { id: teamId },
    data: {
      ...(data.name && { name: data.name }),
    },
    include: {
      members: {
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
}

/**
 * Dissolve/delete a team (captain only)
 * - Soft deletes by marking as INACTIVE
 * - Cancels all pending invitations
 */
export async function dissolveTeam(teamId: string, userId: string) {
  // Check if user is the captain
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      members: { where: { userId } },
      tournamentTeams: {
        where: { status: { in: ['PENDING', 'CONFIRMED'] } },
      },
    },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  const member = team.members[0];
  if (!member || member.role !== 'CAPTAIN') {
    throw new Error('Only team captain can dissolve the team');
  }

  // Check if team has active tournament registrations
  if (team.tournamentTeams.length > 0) {
    throw new Error('Cannot dissolve team with active tournament registrations');
  }

  // Cancel any pending invitations
  await db.teamInvitation.updateMany({
    where: {
      teamId,
      status: TeamInvitationStatus.PENDING,
    },
    data: { status: TeamInvitationStatus.CANCELLED },
  });

  // Mark team as inactive (soft delete)
  return db.team.update({
    where: { id: teamId },
    data: { status: TeamStatus.INACTIVE },
  });
}

// ============================================
// Team Member Management
// ============================================

/**
 * Invite a member to join a team
 */
export async function inviteMember(input: InviteMemberInput) {
  const { teamId, inviterId, inviteeId, message } = input;

  // Verify the inviter is the captain
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      members: true,
      invitations: {
        where: { status: TeamInvitationStatus.PENDING },
      },
    },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  if (team.captainId !== inviterId) {
    throw new Error('Only team captain can send invitations');
  }

  // Check team size
  const maxMembers = team.format === 'DOUBLES' ? 2 : team.format === 'TEAM' ? 4 : 1;
  if (team.members.length >= maxMembers) {
    throw new Error(`Team already has maximum ${maxMembers} members`);
  }

  // Check if there's already a pending invitation for this user
  const existingInvitation = team.invitations.find(inv => inv.inviteeId === inviteeId);
  if (existingInvitation) {
    throw new Error('An invitation is already pending for this player');
  }

  // Verify invitee exists and matches sport
  const invitee = await db.user.findUnique({
    where: { id: inviteeId },
    select: { id: true, sport: true, isActive: true },
  });

  if (!invitee || !invitee.isActive) {
    throw new Error('Player not found or inactive');
  }

  if (invitee.sport !== team.sport) {
    throw new Error('Player is from a different sport');
  }

  // Check if invitee is already in a team for this sport
  const inviteeTeam = await db.teamMember.findFirst({
    where: {
      userId: inviteeId,
      team: {
        sport: team.sport,
        status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] },
      },
    },
  });

  if (inviteeTeam) {
    throw new Error('Player is already in a team for this sport');
  }

  // Create invitation with 48-hour expiry
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  const invitation = await db.teamInvitation.create({
    data: {
      teamId,
      inviterId,
      inviteeId,
      message,
      expiresAt,
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          sport: true,
        },
      },
      invitee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Create notification for invitee
  await db.notification.create({
    data: {
      userId: inviteeId,
      sport: team.sport,
      type: 'TEAM_INVITATION',
      title: 'Team Invitation',
      message: `You've been invited to join team "${team.name}"`,
      link: `/${team.sport.toLowerCase()}/teams`,
    },
  });

  return invitation;
}

/**
 * Accept a team invitation
 */
export async function acceptInvitation(invitationId: string, userId: string) {
  // Get the invitation
  const invitation = await db.teamInvitation.findUnique({
    where: { id: invitationId },
    include: {
      team: {
        include: { members: true },
      },
    },
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Verify the invitation is for this user
  if (invitation.inviteeId !== userId) {
    throw new Error('This invitation is not for you');
  }

  // Check if invitation is still valid
  if (invitation.status !== TeamInvitationStatus.PENDING) {
    throw new Error('Invitation is no longer valid');
  }

  if (invitation.expiresAt < new Date()) {
    await db.teamInvitation.update({
      where: { id: invitationId },
      data: { status: TeamInvitationStatus.EXPIRED },
    });
    throw new Error('Invitation has expired');
  }

  // Check if user already has a team for this sport
  const existingTeam = await db.teamMember.findFirst({
    where: {
      userId,
      team: {
        sport: invitation.team.sport,
        status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] },
      },
    },
  });

  if (existingTeam) {
    throw new Error('You are already in a team for this sport');
  }

  // Check team capacity
  const maxMembers = invitation.team.format === 'DOUBLES' ? 2 : invitation.team.format === 'TEAM' ? 4 : 1;
  if (invitation.team.members.length >= maxMembers) {
    throw new Error('Team is already full');
  }

  // Accept invitation in transaction
  const [updatedInvitation, newMember] = await db.$transaction([
    // Update invitation status
    db.teamInvitation.update({
      where: { id: invitationId },
      data: {
        status: TeamInvitationStatus.ACCEPTED,
        respondedAt: new Date(),
      },
    }),
    // Add user to team
    db.teamMember.create({
      data: {
        teamId: invitation.teamId,
        userId,
        role: 'MEMBER',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hiddenElo: true,
          },
        },
      },
    }),
  ]);

  // Update team status to ACTIVE if it was PENDING
  if (invitation.team.status === TeamStatus.PENDING) {
    // Check if team is now full (has required members)
    const currentMemberCount = invitation.team.members.length + 1; // +1 for new member
    const requiredMembers = invitation.team.format === 'DOUBLES' ? 2 : invitation.team.format === 'TEAM' ? 3 : 1;

    if (currentMemberCount >= requiredMembers) {
      await db.team.update({
        where: { id: invitation.teamId },
        data: { status: TeamStatus.ACTIVE },
      });
    }
  }

  // Cancel any other pending invitations for this team
  await db.teamInvitation.updateMany({
    where: {
      teamId: invitation.teamId,
      status: TeamInvitationStatus.PENDING,
      id: { not: invitationId },
    },
    data: { status: TeamInvitationStatus.CANCELLED },
  });

  // Update team ELO based on average of members
  await updateTeamElo(invitation.teamId);

  return { invitation: updatedInvitation, member: newMember };
}

/**
 * Decline a team invitation
 */
export async function declineInvitation(invitationId: string, userId: string) {
  const invitation = await db.teamInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.inviteeId !== userId) {
    throw new Error('This invitation is not for you');
  }

  if (invitation.status !== TeamInvitationStatus.PENDING) {
    throw new Error('Invitation is no longer pending');
  }

  return db.teamInvitation.update({
    where: { id: invitationId },
    data: {
      status: TeamInvitationStatus.DECLINED,
      respondedAt: new Date(),
    },
  });
}

/**
 * Cancel a team invitation (captain only)
 */
export async function cancelInvitation(invitationId: string, userId: string) {
  const invitation = await db.teamInvitation.findUnique({
    where: { id: invitationId },
    include: { team: true },
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.team.captainId !== userId) {
    throw new Error('Only team captain can cancel invitations');
  }

  if (invitation.status !== TeamInvitationStatus.PENDING) {
    throw new Error('Invitation is no longer pending');
  }

  return db.teamInvitation.update({
    where: { id: invitationId },
    data: { status: TeamInvitationStatus.CANCELLED },
  });
}

/**
 * Remove a member from a team
 */
export async function removeMember(teamId: string, memberId: string, requesterId: string) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      members: true,
      tournamentTeams: {
        where: { status: { in: ['PENDING', 'CONFIRMED'] } },
      },
    },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  const requesterMember = team.members.find(m => m.userId === requesterId);
  if (!requesterMember) {
    throw new Error('You are not a member of this team');
  }

  const memberToRemove = team.members.find(m => m.userId === memberId);
  if (!memberToRemove) {
    throw new Error('Member not found in team');
  }

  // Only captain can remove others, or members can remove themselves
  if (requesterMember.role !== 'CAPTAIN' && memberId !== requesterId) {
    throw new Error('Only team captain can remove other members');
  }

  // Cannot remove captain
  if (memberToRemove.role === 'CAPTAIN') {
    throw new Error('Cannot remove the team captain. Transfer captaincy first.');
  }

  // Check if team has active tournament registrations
  if (team.tournamentTeams.length > 0) {
    throw new Error('Cannot modify team members while registered for tournaments');
  }

  // Remove member
  await db.teamMember.delete({
    where: { id: memberToRemove.id },
  });

  // Update team ELO
  await updateTeamElo(teamId);

  // If team now has only 1 member, set status back to PENDING
  const remainingMembers = team.members.length - 1;
  if (remainingMembers < 2 && team.format !== 'INDIVIDUAL') {
    await db.team.update({
      where: { id: teamId },
      data: { status: TeamStatus.PENDING },
    });
  }

  return { success: true };
}

/**
 * Transfer captaincy to another member
 */
export async function transferCaptaincy(teamId: string, newCaptainId: string, currentCaptainId: string) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  // Verify current user is captain
  if (team.captainId !== currentCaptainId) {
    throw new Error('Only current captain can transfer captaincy');
  }

  // Find new captain member
  const newCaptain = team.members.find(m => m.userId === newCaptainId);
  if (!newCaptain) {
    throw new Error('New captain must be a current team member');
  }

  const currentCaptain = team.members.find(m => m.userId === currentCaptainId);
  if (!currentCaptain) {
    throw new Error('Current captain not found in team');
  }

  // Update roles in transaction
  await db.$transaction([
    // Demote current captain
    db.teamMember.update({
      where: { id: currentCaptain.id },
      data: { role: 'MEMBER' },
    }),
    // Promote new captain
    db.teamMember.update({
      where: { id: newCaptain.id },
      data: { role: 'CAPTAIN' },
    }),
    // Update team's captainId
    db.team.update({
      where: { id: teamId },
      data: { captainId: newCaptainId },
    }),
  ]);

  return { success: true };
}

// ============================================
// Team ELO Management
// ============================================

/**
 * Update team ELO as average of all members' ELO
 */
export async function updateTeamElo(teamId: string) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: {
            select: { hiddenElo: true },
          },
        },
      },
    },
  });

  if (!team || team.members.length === 0) {
    return null;
  }

  // Calculate average ELO
  const totalElo = team.members.reduce((sum, member) => sum + member.user.hiddenElo, 0);
  const avgElo = totalElo / team.members.length;

  // Update team ELO
  return db.team.update({
    where: { id: teamId },
    data: { teamElo: avgElo },
  });
}

/**
 * Update team stats after a match
 */
export async function updateTeamStats(
  teamId: string,
  isWin: boolean,
  eloChange: number
) {
  return db.team.update({
    where: { id: teamId },
    data: {
      wins: { increment: isWin ? 1 : 0 },
      losses: { increment: isWin ? 0 : 1 },
      matchesPlayed: { increment: 1 },
      teamElo: { increment: eloChange },
    },
  });
}

// ============================================
// Invitation Token Generation
// ============================================

/**
 * Generate a unique invitation token
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Get invitation by token (for email link acceptance)
 */
export async function getInvitationByToken(token: string) {
  // This would be used for email-link based invitations
  // For now, we're using ID-based invitations
  return null;
}

// ============================================
// Team Validation Helpers
// ============================================

/**
 * Check if a user can create a team for a sport
 */
export async function canCreateTeam(userId: string, sport: SportType): Promise<{ canCreate: boolean; reason?: string }> {
  const existingTeam = await db.teamMember.findFirst({
    where: {
      userId,
      team: {
        sport,
        status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] },
      },
    },
  });

  if (existingTeam) {
    return { canCreate: false, reason: 'You already have a team for this sport' };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { sport: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return { canCreate: false, reason: 'User not found or inactive' };
  }

  if (user.sport !== sport) {
    return { canCreate: false, reason: 'Sport mismatch with your account' };
  }

  return { canCreate: true };
}

/**
 * Check if a user can join a team for a sport
 */
export async function canJoinTeam(userId: string, sport: SportType): Promise<{ canJoin: boolean; reason?: string }> {
  const existingTeam = await db.teamMember.findFirst({
    where: {
      userId,
      team: {
        sport,
        status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] },
      },
    },
  });

  if (existingTeam) {
    return { canJoin: false, reason: 'You are already in a team for this sport' };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { sport: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return { canJoin: false, reason: 'User not found or inactive' };
  }

  if (user.sport !== sport) {
    return { canJoin: false, reason: 'Sport mismatch with your account' };
  }

  return { canJoin: true };
}

/**
 * Get pending invitations for a user
 */
export async function getUserPendingInvitations(userId: string, sport?: SportType) {
  return db.teamInvitation.findMany({
    where: {
      inviteeId: userId,
      status: TeamInvitationStatus.PENDING,
      expiresAt: { gte: new Date() },
      ...(sport && { team: { sport } }),
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          sport: true,
          teamElo: true,
          captain: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              hiddenElo: true,
            },
          },
        },
      },
      inviter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          hiddenElo: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Search for players to invite to a team
 */
export async function searchPlayersForTeam(
  query: string,
  sport: SportType,
  excludeIds: string[] = [],
  limit: number = 10
) {
  const where = {
    sport,
    isActive: true,
    id: { notIn: excludeIds },
    OR: [
      { firstName: { contains: query, mode: 'insensitive' as const } },
      { lastName: { contains: query, mode: 'insensitive' as const } },
      { email: { contains: query, mode: 'insensitive' as const } },
    ],
  };

  const players = await db.user.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      hiddenElo: true,
      visiblePoints: true,
      city: true,
      state: true,
      _count: {
        select: {
          matchesAsA: true,
          matchesAsB: true,
        },
      },
    },
    take: limit,
  });

  // Check which players are already in teams
  const playerIds = players.map(p => p.id);
  const teamMembers = await db.teamMember.findMany({
    where: {
      userId: { in: playerIds },
      team: {
        sport,
        status: { in: [TeamStatus.PENDING, TeamStatus.ACTIVE] },
      },
    },
    select: { userId: true },
  });

  const playersInTeams = new Set(teamMembers.map(tm => tm.userId));

  return players.map(player => {
    const matchesPlayed = player._count.matchesAsA + player._count.matchesAsB;
    return {
      ...player,
      matchesPlayed,
      isInTeam: playersInTeams.has(player.id),
      canInvite: !playersInTeams.has(player.id),
    };
  });
}
