/**
 * VALORHIVE Tournament Invitation Deep Links
 * Generate shareable deep links that pre-fill tournament registration
 * Track referrals for future referral rewards program
 */

import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { SportType } from '@prisma/client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com';

/**
 * Tournament Invite Types
 */
export type TournamentInviteType = 'DIRECT' | 'TEAM' | 'ORG' | 'PROMOTIONAL';

/**
 * Generate a tournament invitation link
 */
export async function generateTournamentInviteLink(params: {
  tournamentId: string;
  inviterId: string;
  type?: TournamentInviteType;
  teamId?: string;
  orgId?: string;
  customMessage?: string;
  expiresInDays?: number;
}): Promise<{
  inviteCode: string;
  inviteUrl: string;
  deepLinkUrl: string;
  shortUrl: string;
}> {
  const {
    tournamentId,
    inviterId,
    type = 'DIRECT',
    teamId,
    orgId,
    customMessage,
    expiresInDays = 7,
  } = params;

  // Generate unique invite code
  const inviteCode = `ti_${nanoid(8)}`;

  // Calculate expiration
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  // Get tournament details
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, sport: true },
  });

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  // Store invite record
  await db.tournamentInvite.create({
    data: {
      id: inviteCode,
      tournamentId,
      inviterId,
      type,
      teamId,
      orgId,
      customMessage,
      expiresAt,
      status: 'ACTIVE',
      clickCount: 0,
      registrationCount: 0,
    },
  });

  // Generate URLs
  const inviteUrl = `${APP_URL}/invite/${inviteCode}`;
  const deepLinkUrl = `vhive://tournament/${tournamentId}/invite?code=${inviteCode}`;
  const shortUrl = `${APP_URL}/i/${inviteCode}`;

  return {
    inviteCode,
    inviteUrl,
    deepLinkUrl,
    shortUrl,
  };
}

/**
 * Get tournament invite details
 */
export async function getTournamentInviteDetails(inviteCode: string): Promise<{
  success: boolean;
  invite?: {
    id: string;
    tournamentId: string;
    tournamentName: string;
    tournamentSport: SportType;
    inviterName: string;
    type: TournamentInviteType;
    teamId?: string;
    teamName?: string;
    orgId?: string;
    orgName?: string;
    customMessage?: string;
    expiresAt: Date;
    isExpired: boolean;
  };
  error?: string;
}> {
  try {
    const invite = await db.tournamentInvite.findUnique({
      where: { id: inviteCode },
      include: {
        tournament: {
          select: { id: true, name: true, sport: true, status: true },
        },
        inviter: {
          select: { firstName: true, lastName: true },
        },
        team: {
          select: { id: true, name: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!invite) {
      return { success: false, error: 'Invite not found' };
    }

    if (invite.status === 'EXPIRED' || invite.expiresAt < new Date()) {
      return { success: false, error: 'Invite has expired' };
    }

    if (invite.status === 'DEACTIVATED') {
      return { success: false, error: 'Invite has been deactivated' };
    }

    // Track click
    await db.tournamentInvite.update({
      where: { id: inviteCode },
      data: { clickCount: { increment: 1 } },
    });

    return {
      success: true,
      invite: {
        id: invite.id,
        tournamentId: invite.tournamentId,
        tournamentName: invite.tournament.name,
        tournamentSport: invite.tournament.sport,
        inviterName: `${invite.inviter.firstName} ${invite.inviter.lastName}`,
        type: invite.type as TournamentInviteType,
        teamId: invite.teamId || undefined,
        teamName: invite.team?.name,
        orgId: invite.orgId || undefined,
        orgName: invite.organization?.name,
        customMessage: invite.customMessage || undefined,
        expiresAt: invite.expiresAt,
        isExpired: false,
      },
    };
  } catch (error) {
    console.error('Error getting invite details:', error);
    return { success: false, error: 'Failed to get invite details' };
  }
}

/**
 * Process registration from invite
 */
export async function processInviteRegistration(params: {
  inviteCode: string;
  userId: string;
}): Promise<{
  success: boolean;
  referralRecorded?: boolean;
  bonusPoints?: number;
  error?: string;
}> {
  const { inviteCode, userId } = params;

  try {
    const invite = await db.tournamentInvite.findUnique({
      where: { id: inviteCode },
    });

    if (!invite) {
      return { success: false, error: 'Invite not found' };
    }

    if (invite.status !== 'ACTIVE' || invite.expiresAt < new Date()) {
      return { success: false, error: 'Invite is no longer valid' };
    }

    // Don't count self-referrals
    if (invite.inviterId === userId) {
      return { success: true, referralRecorded: false };
    }

    // Check if this user was already referred for this tournament
    const existingReferral = await db.tournamentReferral.findFirst({
      where: {
        tournamentId: invite.tournamentId,
        refereeId: userId,
      },
    });

    if (existingReferral) {
      return { success: true, referralRecorded: false };
    }

    // Record the referral
    const referral = await db.tournamentReferral.create({
      data: {
        tournamentId: invite.tournamentId,
        inviterId: invite.inviterId,
        refereeId: userId,
        inviteCode,
        status: 'REGISTERED',
        bonusPoints: 10, // Default bonus points
      },
    });

    // Update invite registration count
    await db.tournamentInvite.update({
      where: { id: inviteCode },
      data: { registrationCount: { increment: 1 } },
    });

    // Award bonus points to both parties
    await Promise.all([
      // Referrer gets points
      db.user.update({
        where: { id: invite.inviterId },
        data: { visiblePoints: { increment: 10 } },
      }),
      // Referee gets points
      db.user.update({
        where: { id: userId },
        data: { visiblePoints: { increment: 5 } },
      }),
    ]);

    return {
      success: true,
      referralRecorded: true,
      bonusPoints: 5,
    };
  } catch (error) {
    console.error('Error processing invite registration:', error);
    return { success: false, error: 'Failed to process referral' };
  }
}

/**
 * Get invite statistics for a tournament
 */
export async function getTournamentInviteStats(tournamentId: string): Promise<{
  totalInvites: number;
  totalClicks: number;
  totalRegistrations: number;
  topInviters: Array<{
    inviterId: string;
    inviterName: string;
    inviteCount: number;
    registrationCount: number;
  }>;
}> {
  const invites = await db.tournamentInvite.findMany({
    where: { tournamentId },
    include: {
      inviter: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  const totalInvites = invites.length;
  const totalClicks = invites.reduce((sum, i) => sum + i.clickCount, 0);
  const totalRegistrations = invites.reduce((sum, i) => sum + i.registrationCount, 0);

  // Group by inviter
  const inviterStats = new Map<string, {
    inviterId: string;
    inviterName: string;
    inviteCount: number;
    registrationCount: number;
  }>();

  for (const invite of invites) {
    const inviterId = invite.inviterId;
    const existing = inviterStats.get(inviterId) || {
      inviterId,
      inviterName: `${invite.inviter.firstName} ${invite.inviter.lastName}`,
      inviteCount: 0,
      registrationCount: 0,
    };
    existing.inviteCount++;
    existing.registrationCount += invite.registrationCount;
    inviterStats.set(inviterId, existing);
  }

  const topInviters = Array.from(inviterStats.values())
    .sort((a, b) => b.registrationCount - a.registrationCount)
    .slice(0, 10);

  return {
    totalInvites,
    totalClicks,
    totalRegistrations,
    topInviters,
  };
}

/**
 * Deactivate an invite
 */
export async function deactivateInvite(inviteCode: string, userId: string): Promise<boolean> {
  try {
    const invite = await db.tournamentInvite.findUnique({
      where: { id: inviteCode },
      select: { inviterId: true },
    });

    if (!invite || invite.inviterId !== userId) {
      return false;
    }

    await db.tournamentInvite.update({
      where: { id: inviteCode },
      data: { status: 'DEACTIVATED' },
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Generate social share URLs for tournament invite
 */
export function generateInviteShareUrls(inviteUrl: string, tournamentName: string): {
  whatsapp: string;
  twitter: string;
  facebook: string;
  telegram: string;
  email: string;
} {
  const encodedUrl = encodeURIComponent(inviteUrl);
  const text = encodeURIComponent(`Join me at ${tournamentName} on VALORHIVE!`);

  return {
    whatsapp: `https://wa.me/?text=${text}%0A%0A${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${text}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${text}`,
    email: `mailto:?subject=${encodeURIComponent(`Join ${tournamentName}`)}&body=${text}%0A%0A${encodedUrl}`,
  };
}
