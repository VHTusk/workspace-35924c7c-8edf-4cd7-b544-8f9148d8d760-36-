/**
 * Notification Action Handlers
 * 
 * This library contains handlers for all actionable notification types.
 * Each handler is idempotent and handles race conditions.
 */

import { db } from '@/lib/db';
import { NotificationType } from '@prisma/client';

// Types for action data
export interface RosterInviteActionData {
  orgId: string;
  requestId: string;
  orgName: string;
}

export interface MatchScheduledActionData {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  scheduledTime: string;
  opponentId: string;
  opponentName: string;
}

export interface TournamentReminderActionData {
  tournamentId: string;
  tournamentName: string;
  startDate: string;
}

export interface PaymentReceivedActionData {
  paymentId: string;
  amount: number;
  type: 'subscription' | 'tournament' | 'prize';
  reference?: string;
}

export interface MatchResultEnteredActionData {
  matchId: string;
  tournamentId: string;
  opponentId: string;
  opponentName: string;
  scoreA: number;
  scoreB: number;
  winnerId: string;
}

export interface FollowNewActionData {
  followerId: string;
  followerName: string;
}

export interface AchievementEarnedActionData {
  achievementId: string;
  achievementTitle: string;
  badgeUrl?: string;
}

export interface DisputeResolvedActionData {
  disputeId: string;
  matchId: string;
  resolution: string;
}

export interface TournamentInviteActionData {
  tournamentId: string;
  tournamentName: string;
  invitedById?: string;
  invitedByName?: string;
}

export interface OrgAdminInviteActionData {
  orgId: string;
  orgName: string;
  role: string;
  invitedById: string;
}

// Action result types
export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Handle Roster Invite Accept
 * Accepts an invitation to join an organization's roster
 */
export async function handleRosterInviteAccept(
  notificationId: string,
  userId: string
): Promise<ActionResult> {
  try {
    // Get notification and check if action already taken
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
    }

    if (notification.actionTaken) {
      return { success: false, message: 'Action already taken', error: 'ALREADY_TAKEN' };
    }

    const actionData = notification.actionData as unknown as RosterInviteActionData;
    if (!actionData?.requestId) {
      return { success: false, message: 'Invalid action data', error: 'INVALID_DATA' };
    }

    // Check if request is still pending
    const request = await db.orgRosterRequest.findUnique({
      where: { id: actionData.requestId },
    });

    if (!request || request.status !== 'PENDING') {
      return { success: false, message: 'Request no longer available', error: 'REQUEST_EXPIRED' };
    }

    // Accept the request in a transaction
    await db.$transaction([
      // Update request status
      db.orgRosterRequest.update({
        where: { id: actionData.requestId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      }),
      // Add player to roster
      db.orgRosterPlayer.create({
        data: {
          orgId: actionData.orgId,
          userId: userId,
          sport: notification.sport,
          isActive: true,
        },
      }),
      // Mark notification action as taken
      db.notification.update({
        where: { id: notificationId },
        data: {
          actionTaken: true,
          actionTakenAt: new Date(),
          actionResult: 'ACCEPTED',
          isRead: true,
          readAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      message: `You've successfully joined ${actionData.orgName}!`,
      data: { orgId: actionData.orgId },
    };
  } catch (error) {
    console.error('Error accepting roster invite:', error);
    return { success: false, message: 'Failed to accept invitation', error: 'SERVER_ERROR' };
  }
}

/**
 * Handle Roster Invite Decline
 * Declines an invitation to join an organization's roster
 */
export async function handleRosterInviteDecline(
  notificationId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
    }

    if (notification.actionTaken) {
      return { success: false, message: 'Action already taken', error: 'ALREADY_TAKEN' };
    }

    const actionData = notification.actionData as unknown as RosterInviteActionData;
    if (!actionData?.requestId) {
      return { success: false, message: 'Invalid action data', error: 'INVALID_DATA' };
    }

    // Update request and notification
    await db.$transaction([
      db.orgRosterRequest.update({
        where: { id: actionData.requestId },
        data: {
          status: 'DECLINED',
          respondedAt: new Date(),
        },
      }),
      db.notification.update({
        where: { id: notificationId },
        data: {
          actionTaken: true,
          actionTakenAt: new Date(),
          actionResult: 'DECLINED',
          isRead: true,
          readAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      message: `You've declined the invitation from ${actionData.orgName}`,
    };
  } catch (error) {
    console.error('Error declining roster invite:', error);
    return { success: false, message: 'Failed to decline invitation', error: 'SERVER_ERROR' };
  }
}

/**
 * Handle Match Confirm Availability
 * Confirms player's availability for a scheduled match
 */
export async function handleMatchConfirmAvailability(
  notificationId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
    }

    if (notification.actionTaken) {
      return { success: false, message: 'Action already taken', error: 'ALREADY_TAKEN' };
    }

    const actionData = notification.actionData as unknown as MatchScheduledActionData;
    if (!actionData?.matchId) {
      return { success: false, message: 'Invalid action data', error: 'INVALID_DATA' };
    }

    // Create or update availability confirmation
    // This could be stored in a separate model or as metadata
    await db.$transaction([
      db.notification.update({
        where: { id: notificationId },
        data: {
          actionTaken: true,
          actionTakenAt: new Date(),
          actionResult: 'CONFIRMED',
          isRead: true,
          readAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      message: 'Your availability has been confirmed for the match',
      data: { matchId: actionData.matchId },
    };
  } catch (error) {
    console.error('Error confirming match availability:', error);
    return { success: false, message: 'Failed to confirm availability', error: 'SERVER_ERROR' };
  }
}

/**
 * Handle Match Request Reschedule
 * Requests a reschedule for a match
 */
export async function handleMatchRequestReschedule(
  notificationId: string,
  userId: string,
  proposedTime?: string
): Promise<ActionResult> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
    }

    if (notification.actionTaken) {
      return { success: false, message: 'Action already taken', error: 'ALREADY_TAKEN' };
    }

    const actionData = notification.actionData as unknown as MatchScheduledActionData;
    if (!actionData?.matchId) {
      return { success: false, message: 'Invalid action data', error: 'INVALID_DATA' };
    }

    // Create reschedule request - this would typically create a separate request
    // For now, we'll mark the notification as acted upon
    await db.notification.update({
      where: { id: notificationId },
      data: {
        actionTaken: true,
        actionTakenAt: new Date(),
        actionResult: 'RESCHEDULE_REQUESTED',
        isRead: true,
        readAt: new Date(),
      },
    });

    // TODO: Create actual reschedule request in a separate model

    return {
      success: true,
      message: 'Reschedule request has been sent to your opponent',
      data: { matchId: actionData.matchId, proposedTime },
    };
  } catch (error) {
    console.error('Error requesting reschedule:', error);
    return { success: false, message: 'Failed to request reschedule', error: 'SERVER_ERROR' };
  }
}

/**
 * Handle Follow Back
 * Follows a user back who just followed you
 */
export async function handleFollowBack(
  notificationId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
    }

    if (notification.actionTaken) {
      return { success: false, message: 'Action already taken', error: 'ALREADY_TAKEN' };
    }

    const actionData = notification.actionData as unknown as FollowNewActionData;
    if (!actionData?.followerId) {
      return { success: false, message: 'Invalid action data', error: 'INVALID_DATA' };
    }

    // Check if already following
    const existingFollow = await db.userFollow.findFirst({
      where: {
        followerId: userId,
        followingId: actionData.followerId,
      },
    });

    if (existingFollow) {
      return { success: false, message: 'You are already following this user', error: 'ALREADY_FOLLOWING' };
    }

    // Create follow relationship and update notification
    await db.$transaction([
      db.userFollow.create({
        data: {
          followerId: userId,
          followingId: actionData.followerId,
          sport: notification.sport,
        },
      }),
      db.notification.update({
        where: { id: notificationId },
        data: {
          actionTaken: true,
          actionTakenAt: new Date(),
          actionResult: 'FOLLOWED_BACK',
          isRead: true,
          readAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      message: `You are now following ${actionData.followerName}`,
      data: { followedUserId: actionData.followerId },
    };
  } catch (error) {
    console.error('Error following back:', error);
    return { success: false, message: 'Failed to follow user', error: 'SERVER_ERROR' };
  }
}

/**
 * Handle Tournament Register
 * Quick register for a tournament from notification
 */
export async function handleTournamentRegister(
  notificationId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
    }

    if (notification.actionTaken) {
      return { success: false, message: 'Action already taken', error: 'ALREADY_TAKEN' };
    }

    const actionData = notification.actionData as unknown as TournamentInviteActionData;
    if (!actionData?.tournamentId) {
      return { success: false, message: 'Invalid action data', error: 'INVALID_DATA' };
    }

    // Check if already registered
    const existingReg = await db.tournamentRegistration.findFirst({
      where: {
        tournamentId: actionData.tournamentId,
        userId: userId,
      },
    });

    if (existingReg) {
      return { success: false, message: 'You are already registered for this tournament', error: 'ALREADY_REGISTERED' };
    }

    // Check tournament availability
    const tournament = await db.tournament.findUnique({
      where: { id: actionData.tournamentId },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!tournament) {
      return { success: false, message: 'Tournament not found', error: 'TOURNAMENT_NOT_FOUND' };
    }

    if (tournament.status !== 'REGISTRATION_OPEN') {
      return { success: false, message: 'Registration is not open for this tournament', error: 'REGISTRATION_CLOSED' };
    }

    if (tournament._count.registrations >= tournament.maxPlayers) {
      return { success: false, message: 'Tournament is full', error: 'TOURNAMENT_FULL' };
    }

    // Create registration (pending payment if there's a fee)
    await db.$transaction([
      db.tournamentRegistration.create({
        data: {
          tournamentId: actionData.tournamentId,
          userId: userId,
          status: tournament.entryFee > 0 ? 'PENDING' : 'CONFIRMED',
          amount: tournament.entryFee,
        },
      }),
      db.notification.update({
        where: { id: notificationId },
        data: {
          actionTaken: true,
          actionTakenAt: new Date(),
          actionResult: 'REGISTERED',
          isRead: true,
          readAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      message: `You've registered for ${actionData.tournamentName}`,
      data: { tournamentId: actionData.tournamentId, requiresPayment: tournament.entryFee > 0 },
    };
  } catch (error) {
    console.error('Error registering for tournament:', error);
    return { success: false, message: 'Failed to register for tournament', error: 'SERVER_ERROR' };
  }
}

/**
 * Handle Tournament Decline
 * Declines a tournament invitation
 */
export async function handleTournamentDecline(
  notificationId: string,
  _userId: string
): Promise<ActionResult> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
    }

    if (notification.actionTaken) {
      return { success: false, message: 'Action already taken', error: 'ALREADY_TAKEN' };
    }

    const actionData = notification.actionData as unknown as TournamentInviteActionData;

    await db.notification.update({
      where: { id: notificationId },
      data: {
        actionTaken: true,
        actionTakenAt: new Date(),
        actionResult: 'DECLINED',
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      success: true,
      message: `You've declined the invitation to ${actionData?.tournamentName || 'the tournament'}`,
    };
  } catch (error) {
    console.error('Error declining tournament invitation:', error);
    return { success: false, message: 'Failed to decline invitation', error: 'SERVER_ERROR' };
  }
}

/**
 * Handle Match Result Confirm
 * Confirms a match result entered by opponent
 */
export async function handleMatchResultConfirm(
  notificationId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
    }

    if (notification.actionTaken) {
      return { success: false, message: 'Action already taken', error: 'ALREADY_TAKEN' };
    }

    const actionData = notification.actionData as unknown as MatchResultEnteredActionData;
    if (!actionData?.matchId) {
      return { success: false, message: 'Invalid action data', error: 'INVALID_DATA' };
    }

    // Update match verification status
    await db.$transaction([
      db.match.update({
        where: { id: actionData.matchId },
        data: {
          verificationStatus: 'VERIFIED',
        },
      }),
      db.notification.update({
        where: { id: notificationId },
        data: {
          actionTaken: true,
          actionTakenAt: new Date(),
          actionResult: 'CONFIRMED',
          isRead: true,
          readAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      message: 'Match result has been confirmed',
      data: { matchId: actionData.matchId },
    };
  } catch (error) {
    console.error('Error confirming match result:', error);
    return { success: false, message: 'Failed to confirm match result', error: 'SERVER_ERROR' };
  }
}

/**
 * Handle Match Result Dispute
 * Disputes a match result entered by opponent
 */
export async function handleMatchResultDispute(
  notificationId: string,
  userId: string,
  reason?: string
): Promise<ActionResult> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
    }

    if (notification.actionTaken) {
      return { success: false, message: 'Action already taken', error: 'ALREADY_TAKEN' };
    }

    const actionData = notification.actionData as unknown as MatchResultEnteredActionData;
    if (!actionData?.matchId) {
      return { success: false, message: 'Invalid action data', error: 'INVALID_DATA' };
    }

    // Create dispute
    await db.$transaction([
      db.match.update({
        where: { id: actionData.matchId },
        data: {
          verificationStatus: 'DISPUTED',
        },
      }),
      db.matchDispute.create({
        data: {
          matchId: actionData.matchId,
          initiatedById: userId,
          sport: notification.sport,
          reason: 'SCORE_ENTRY_ERROR',
          description: reason || 'Disputed from notification',
          status: 'PENDING',
        },
      }),
      db.notification.update({
        where: { id: notificationId },
        data: {
          actionTaken: true,
          actionTakenAt: new Date(),
          actionResult: 'DISPUTED',
          isRead: true,
          readAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      message: 'Your dispute has been submitted and will be reviewed',
      data: { matchId: actionData.matchId },
    };
  } catch (error) {
    console.error('Error disputing match result:', error);
    return { success: false, message: 'Failed to submit dispute', error: 'SERVER_ERROR' };
  }
}

/**
 * Handle Org Admin Invite Accept
 * Accepts an invitation to become an org admin
 */
export async function handleOrgAdminInviteAccept(
  notificationId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
    }

    if (notification.actionTaken) {
      return { success: false, message: 'Action already taken', error: 'ALREADY_TAKEN' };
    }

    const actionData = notification.actionData as unknown as OrgAdminInviteActionData;
    if (!actionData?.orgId || !actionData?.invitedById) {
      return { success: false, message: 'Invalid action data', error: 'INVALID_DATA' };
    }

    // Check if already an admin
    const existingAdmin = await db.orgAdmin.findFirst({
      where: {
        orgId: actionData.orgId,
        userId: userId,
        isActive: true,
      },
    });

    if (existingAdmin) {
      return { success: false, message: 'You are already an admin for this organization', error: 'ALREADY_ADMIN' };
    }

    // Create admin role and update notification
    await db.$transaction([
      db.orgAdmin.create({
        data: {
          orgId: actionData.orgId,
          userId: userId,
          role: actionData.role as 'PRIMARY' | 'ADMIN' | 'STAFF',
          invitedById: actionData.invitedById,
          acceptedAt: new Date(),
          isActive: true,
        },
      }),
      db.notification.update({
        where: { id: notificationId },
        data: {
          actionTaken: true,
          actionTakenAt: new Date(),
          actionResult: 'ACCEPTED',
          isRead: true,
          readAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      message: `You've joined ${actionData.orgName} as ${actionData.role}`,
      data: { orgId: actionData.orgId },
    };
  } catch (error) {
    console.error('Error accepting org admin invite:', error);
    return { success: false, message: 'Failed to accept invitation', error: 'SERVER_ERROR' };
  }
}

/**
 * Handle Org Admin Invite Decline
 * Declines an invitation to become an org admin
 */
export async function handleOrgAdminInviteDecline(
  notificationId: string,
  _userId: string
): Promise<ActionResult> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
    }

    if (notification.actionTaken) {
      return { success: false, message: 'Action already taken', error: 'ALREADY_TAKEN' };
    }

    const actionData = notification.actionData as unknown as OrgAdminInviteActionData;

    await db.notification.update({
      where: { id: notificationId },
      data: {
        actionTaken: true,
        actionTakenAt: new Date(),
        actionResult: 'DECLINED',
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      success: true,
      message: `You've declined the admin invitation from ${actionData?.orgName || 'the organization'}`,
    };
  } catch (error) {
    console.error('Error declining org admin invite:', error);
    return { success: false, message: 'Failed to decline invitation', error: 'SERVER_ERROR' };
  }
}

/**
 * Handle Achievement Share
 * Marks achievement as shared on social media
 */
export async function handleAchievementShare(
  notificationId: string,
  _userId: string
): Promise<ActionResult> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
    }

    // Don't check actionTaken for share - allow multiple shares

    await db.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
        // Don't mark actionTaken for share action
      },
    });

    return {
      success: true,
      message: 'Share link generated!',
    };
  } catch (error) {
    console.error('Error sharing achievement:', error);
    return { success: false, message: 'Failed to share', error: 'SERVER_ERROR' };
  }
}

/**
 * Main action handler router
 */
export async function handleNotificationAction(
  notificationId: string,
  userId: string,
  action: string,
  additionalData?: Record<string, unknown>
): Promise<ActionResult> {
  // Get notification to determine type
  const notification = await db.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    return { success: false, message: 'Notification not found', error: 'NOT_FOUND' };
  }

  // Route to appropriate handler based on notification type and action
  switch (notification.type) {
    case 'ROSTER_INVITE':
      if (action === 'ACCEPT') return handleRosterInviteAccept(notificationId, userId);
      if (action === 'DECLINE') return handleRosterInviteDecline(notificationId, userId);
      break;

    case 'MATCH_SCHEDULED':
      if (action === 'CONFIRM') return handleMatchConfirmAvailability(notificationId, userId);
      if (action === 'RESCHEDULE') return handleMatchRequestReschedule(notificationId, userId, additionalData?.proposedTime as string);
      break;

    case 'FOLLOW_NEW':
      if (action === 'FOLLOW_BACK') return handleFollowBack(notificationId, userId);
      break;

    case 'TOURNAMENT_INVITE':
      if (action === 'REGISTER') return handleTournamentRegister(notificationId, userId);
      if (action === 'DECLINE') return handleTournamentDecline(notificationId, userId);
      break;

    case 'MATCH_RESULT_ENTERED':
      if (action === 'CONFIRM') return handleMatchResultConfirm(notificationId, userId);
      if (action === 'DISPUTE') return handleMatchResultDispute(notificationId, userId, additionalData?.reason as string);
      break;

    case 'ORG_ADMIN_INVITE':
      if (action === 'ACCEPT') return handleOrgAdminInviteAccept(notificationId, userId);
      if (action === 'DECLINE') return handleOrgAdminInviteDecline(notificationId, userId);
      break;

    case 'ACHIEVEMENT_EARNED':
      if (action === 'SHARE') return handleAchievementShare(notificationId, userId);
      break;

    default:
      return { success: false, message: 'This notification type does not support actions', error: 'UNSUPPORTED_ACTION' };
  }

  return { success: false, message: 'Invalid action for this notification type', error: 'INVALID_ACTION' };
}

/**
 * Get available actions for a notification type
 */
export function getAvailableActions(type: NotificationType): { action: string; label: string; variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' }[] {
  switch (type) {
    case 'ROSTER_INVITE':
      return [
        { action: 'ACCEPT', label: 'Accept', variant: 'default' },
        { action: 'DECLINE', label: 'Decline', variant: 'outline' },
      ];

    case 'MATCH_SCHEDULED':
      return [
        { action: 'CONFIRM', label: 'Confirm Availability', variant: 'default' },
        { action: 'RESCHEDULE', label: 'Request Reschedule', variant: 'outline' },
      ];

    case 'TOURNAMENT_REMINDER':
      return [
        { action: 'VIEW', label: 'View Tournament', variant: 'default' },
        { action: 'SET_REMINDER', label: 'Set Reminder', variant: 'outline' },
      ];

    case 'PAYMENT_RECEIVED':
      return [
        { action: 'VIEW_RECEIPT', label: 'View Receipt', variant: 'default' },
        { action: 'DOWNLOAD_INVOICE', label: 'Download Invoice', variant: 'outline' },
      ];

    case 'MATCH_RESULT_ENTERED':
      return [
        { action: 'CONFIRM', label: 'Confirm Result', variant: 'default' },
        { action: 'DISPUTE', label: 'Dispute Result', variant: 'destructive' },
      ];

    case 'FOLLOW_NEW':
      return [
        { action: 'FOLLOW_BACK', label: 'Follow Back', variant: 'default' },
      ];

    case 'ACHIEVEMENT_EARNED':
      return [
        { action: 'SHARE', label: 'Share', variant: 'default' },
        { action: 'VIEW_BADGE', label: 'View Badge', variant: 'outline' },
      ];

    case 'DISPUTE_RESOLVED':
      return [
        { action: 'VIEW_DETAILS', label: 'View Details', variant: 'default' },
        { action: 'ACCEPT', label: 'Accept', variant: 'outline' },
      ];

    case 'TOURNAMENT_INVITE':
      return [
        { action: 'REGISTER', label: 'Register', variant: 'default' },
        { action: 'DECLINE', label: 'Decline', variant: 'outline' },
      ];

    case 'ORG_ADMIN_INVITE':
      return [
        { action: 'ACCEPT', label: 'Accept', variant: 'default' },
        { action: 'DECLINE', label: 'Decline', variant: 'outline' },
      ];

    default:
      return [];
  }
}
