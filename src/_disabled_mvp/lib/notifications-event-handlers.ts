/**
 * Notification Event Handlers for VALORHIVE
 * 
 * These handlers wire notification services to actual platform events.
 * They are called from API routes when events occur.
 */

import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { 
  sendTournamentRegistrationEmail, 
  sendMatchResultEmail, 
  sendTournamentReminderEmail,
  sendTournamentRecapEmail,
  sendMilestoneEmail 
} from '@/lib/email/service';
import { sendPushNotification } from '@/lib/push-notifications';
import { createNotification, createMilestone, checkStreakMilestone } from '@/lib/notifications';

/**
 * Handle tournament registration event
 * Sends: In-app notification, Email, Push notification
 */
export async function onTournamentRegistration(params: {
  userId: string;
  userEmail: string;
  playerName: string;
  tournament: {
    id: string;
    name: string;
    startDate: Date;
    location: string;
    city?: string;
    entryFee: number;
  };
  sport: SportType;
}) {
  const { userId, userEmail, playerName, tournament, sport } = params;

  try {
    // 1. Create in-app notification
    await createNotification({
      userId,
      sport,
      type: 'TOURNAMENT_REMINDER',
      title: 'Registration Confirmed!',
      message: `You're registered for ${tournament.name} on ${new Date(tournament.startDate).toLocaleDateString('en-IN')}`,
      link: `/${sport.toLowerCase()}/tournaments/${tournament.id}`,
    });

    // 2. Send confirmation email
    if (userEmail) {
      await sendTournamentRegistrationEmail({
        to: userEmail,
        sport,
        playerName,
        tournamentName: tournament.name,
        tournamentDate: tournament.startDate.toISOString(),
        tournamentLocation: tournament.location,
        entryFee: tournament.entryFee,
        tournamentId: tournament.id,
      });
    }

    // 3. Send push notification
    await sendPushNotification(userId, {
      title: 'Registration Confirmed! 🎯',
      body: `You're registered for ${tournament.name}`,
      data: {
        type: 'tournament_registration',
        tournamentId: tournament.id,
      },
    });

    console.log(`[Notifications] Tournament registration notification sent to user ${userId}`);
  } catch (error) {
    console.error('[Notifications] Failed to send tournament registration notification:', error);
  }
}

/**
 * Handle match result event
 * Sends: In-app notification, Email, Push notification to both players
 */
export async function onMatchResult(params: {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  winner: {
    id: string;
    email?: string;
    name: string;
    score: number;
    pointsEarned: number;
    eloChange: number;
  };
  loser: {
    id: string;
    email?: string;
    name: string;
    score: number;
    pointsEarned: number;
    eloChange: number;
  };
  sport: SportType;
}) {
  const { matchId, tournamentId, tournamentName, winner, loser, sport } = params;

  try {
    // Notify winner
    await createNotification({
      userId: winner.id,
      sport,
      type: 'MATCH_RESULT',
      title: 'Victory! 🏆',
      message: `You defeated ${loser.name} ${winner.score}-${loser.score} in ${tournamentName}`,
      link: `/${sport.toLowerCase()}/tournaments/${tournamentId}`,
    });

    if (winner.email) {
      await sendMatchResultEmail({
        to: winner.email,
        sport,
        playerName: winner.name,
        opponentName: loser.name,
        tournamentName,
        playerScore: winner.score,
        opponentScore: loser.score,
        won: true,
        pointsEarned: winner.pointsEarned,
        eloChange: winner.eloChange,
        matchId,
      });
    }

    await sendPushNotification(winner.id, {
      title: 'Victory! 🏆',
      body: `You won ${winner.score}-${loser.score} vs ${loser.name}`,
      data: { type: 'match_result', matchId, tournamentId },
    });

    // Notify loser
    await createNotification({
      userId: loser.id,
      sport,
      type: 'MATCH_RESULT',
      title: 'Match Result',
      message: `${loser.name} lost to ${winner.name} ${loser.score}-${winner.score} in ${tournamentName}`,
      link: `/${sport.toLowerCase()}/tournaments/${tournamentId}`,
    });

    if (loser.email) {
      await sendMatchResultEmail({
        to: loser.email,
        sport,
        playerName: loser.name,
        opponentName: winner.name,
        tournamentName,
        playerScore: loser.score,
        opponentScore: winner.score,
        won: false,
        pointsEarned: loser.pointsEarned,
        eloChange: loser.eloChange,
        matchId,
      });
    }

    await sendPushNotification(loser.id, {
      title: 'Match Complete',
      body: `You lost ${loser.score}-${winner.score} to ${winner.name}`,
      data: { type: 'match_result', matchId, tournamentId },
    });

    console.log(`[Notifications] Match result notifications sent for match ${matchId}`);
  } catch (error) {
    console.error('[Notifications] Failed to send match result notifications:', error);
  }
}

/**
 * Handle tournament reminder (sent before tournament starts)
 * Sends: Push notification
 */
export async function onTournamentReminder(params: {
  userId: string;
  tournament: {
    id: string;
    name: string;
    startDate: Date;
    location: string;
  };
  timeUntil: string;
  sport: SportType;
  checkInCode?: string;
}) {
  const { userId, tournament, timeUntil, sport, checkInCode } = params;

  try {
    await createNotification({
      userId,
      sport,
      type: 'TOURNAMENT_REMINDER',
      title: `Reminder: ${tournament.name} starts in ${timeUntil}`,
      message: `Get ready! Tournament at ${tournament.location}`,
      link: `/${sport.toLowerCase()}/tournaments/${tournament.id}`,
    });

    await sendPushNotification(userId, {
      title: `Tournament starting in ${timeUntil}! ⏰`,
      body: `${tournament.name} at ${tournament.location}`,
      data: {
        type: 'tournament_reminder',
        tournamentId: tournament.id,
        checkInCode,
      },
    });

    console.log(`[Notifications] Tournament reminder sent to user ${userId}`);
  } catch (error) {
    console.error('[Notifications] Failed to send tournament reminder:', error);
  }
}

/**
 * Handle next match scheduled notification
 * Notifies a player about their upcoming match
 */
export async function onNextMatchScheduled(params: {
  playerId: string;
  playerEmail?: string;
  playerName: string;
  match: {
    id: string;
    roundNumber: number;
    matchNumber: number;
    scheduledTime?: Date;
    court?: string;
  };
  opponent?: {
    name: string;
    tier: string;
  };
  tournament: {
    id: string;
    name: string;
  };
  sport: SportType;
}) {
  const { playerId, playerName, match, opponent, tournament, sport } = params;

  try {
    const opponentText = opponent ? ` vs ${opponent.name} (${opponent.tier})` : '';
    const courtText = match.court ? ` on ${match.court}` : '';
    const timeText = match.scheduledTime 
      ? ` at ${new Date(match.scheduledTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
      : '';

    await createNotification({
      userId: playerId,
      sport,
      type: 'MATCH_RESULT',
      title: 'Next Match Scheduled! 🎯',
      message: `Round ${match.roundNumber}${opponentText}${courtText}${timeText}`,
      link: `/${sport.toLowerCase()}/tournaments/${tournament.id}`,
    });

    await sendPushNotification(playerId, {
      title: 'Next Match Ready! 🎯',
      body: `Round ${match.roundNumber}${opponentText} in ${tournament.name}`,
      data: {
        type: 'next_match',
        matchId: match.id,
        tournamentId: tournament.id,
      },
    });

    console.log(`[Notifications] Next match notification sent to player ${playerId}`);
  } catch (error) {
    console.error('[Notifications] Failed to send next match notification:', error);
  }
}

/**
 * Handle tournament completion event
 * Sends: Tournament recap email with placement and stats
 */
export async function onTournamentComplete(params: {
  userId: string;
  userEmail: string;
  playerName: string;
  tournament: {
    id: string;
    name: string;
  };
  placement: number;
  totalParticipants: number;
  matchesWon: number;
  matchesLost: number;
  pointsEarned: number;
  eloChange: number;
  sport: SportType;
}) {
  const { userId, userEmail, playerName, tournament, placement, totalParticipants, matchesWon, matchesLost, pointsEarned, eloChange, sport } = params;

  try {
    // Create notification
    const placementText = placement === 1 ? '🥇 1st Place!' : placement === 2 ? '🥈 2nd Place!' : placement === 3 ? '🥉 3rd Place!' : `#${placement}`;
    
    await createNotification({
      userId,
      sport,
      type: 'TOURNAMENT_WIN',
      title: `Tournament Complete: ${placementText}`,
      message: `You placed #${placement} out of ${totalParticipants} in ${tournament.name}`,
      link: `/${sport.toLowerCase()}/tournaments/${tournament.id}`,
    });

    // Send recap email
    if (userEmail) {
      await sendTournamentRecapEmail({
        to: userEmail,
        sport,
        playerName,
        tournamentName: tournament.name,
        placement,
        totalParticipants,
        matchesWon,
        matchesLost,
        pointsEarned,
        eloChange,
        tournamentId: tournament.id,
      });
    }

    // Send push notification
    await sendPushNotification(userId, {
      title: `Tournament Complete: ${placementText}`,
      body: `You placed #${placement} with ${matchesWon} wins in ${tournament.name}`,
      data: {
        type: 'tournament_complete',
        tournamentId: tournament.id,
        placement,
      },
    });

    console.log(`[Notifications] Tournament completion notification sent to user ${userId}`);
  } catch (error) {
    console.error('[Notifications] Failed to send tournament completion notification:', error);
  }
}

/**
 * Handle win streak achievement
 * Awards badges and sends notifications for streak milestones
 */
export async function onWinStreak(params: {
  userId: string;
  userEmail: string;
  playerName: string;
  currentStreak: number;
  sport: SportType;
}) {
  const { userId, userEmail, playerName, currentStreak, sport } = params;

  try {
    // Check for streak milestone
    await checkStreakMilestone(userId, sport, currentStreak);

    // Notify on significant streaks
    if ([3, 5, 10, 15, 20].includes(currentStreak)) {
      await sendPushNotification(userId, {
        title: `🔥 ${currentStreak} Win Streak!`,
        body: `You're on fire! Keep it going!`,
        data: { type: 'streak', streak: currentStreak },
      });
    }

    console.log(`[Notifications] Win streak (${currentStreak}) processed for user ${userId}`);
  } catch (error) {
    console.error('[Notifications] Failed to process win streak:', error);
  }
}
