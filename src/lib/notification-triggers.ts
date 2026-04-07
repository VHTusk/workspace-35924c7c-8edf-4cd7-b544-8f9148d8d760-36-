/**
 * Notification Triggers for VALORHIVE
 * 
 * This module wires up notification delivery for match and tournament events.
 * It connects the existing notification infrastructure to actual events.
 */

import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { createNotification } from './notifications/index';
import { checkRankMilestones, checkTierMilestone, checkStreakMilestone } from './notifications/index';
import { getEloTier } from './auth';
import { generateShareCardUrl, generateShareText, type ShareCardData } from './share-card';
import { sendPushNotification, sendBulkPushNotifications } from './push-notifications';

// ============================================
// Match Result Notifications
// ============================================

export interface MatchResultData {
  matchId: string;
  tournamentId?: string;
  tournamentName?: string;
  sport: SportType;
  
  playerA: {
    id: string;
    firstName: string;
    lastName: string;
    isWinner: boolean;
    score?: number;
    pointsEarned: number;
    eloChange: number;
  };
  
  playerB: {
    id: string;
    firstName: string;
    lastName: string;
    isWinner: boolean;
    score?: number;
    pointsEarned: number;
    eloChange: number;
  };
}

/**
 * Trigger notifications after a match result is recorded
 */
export async function triggerMatchResultNotifications(data: MatchResultData): Promise<void> {
  try {
    const { playerA, playerB, tournamentName, sport } = data;
    const winner = playerA.isWinner ? playerA : playerB;
    const loser = playerA.isWinner ? playerB : playerA;
    
    // Notify Player A
    await createNotification({
      userId: playerA.id,
      sport,
      type: 'MATCH_RESULT',
      title: 'Match Result Recorded',
      message: playerA.isWinner
        ? `🎉 You defeated ${playerB.firstName} ${playerB.lastName}! +${playerA.pointsEarned} points`
        : `You lost to ${playerB.firstName} ${playerB.lastName}. +${playerA.pointsEarned} participation points`,
      link: tournamentName ? undefined : `/matches/${data.matchId}`,
    }, {
      sendEmail: true,
      sendPush: true,
      sendWhatsApp: false,
      emailData: {
        opponentName: `${playerB.firstName} ${playerB.lastName}`,
        result: playerA.isWinner ? 'won' : 'lost',
        score: `${playerA.score} - ${playerB.score}`,
        pointsEarned: playerA.pointsEarned,
        eloChange: playerA.eloChange > 0 ? `+${playerA.eloChange}` : playerA.eloChange,
        tournamentName: tournamentName || 'Friendly Match',
      },
    });
    
    // Send immediate push notification for match result (high priority)
    await sendPushNotification(
      playerA.id,
      playerA.isWinner ? '🎉 Victory!' : 'Match Result',
      playerA.isWinner
        ? `You defeated ${playerB.firstName} ${playerB.lastName}! +${playerA.pointsEarned} points`
        : `You lost to ${playerB.firstName} ${playerB.lastName}. +${playerA.pointsEarned} pts`,
      {
        type: 'MATCH_RESULT',
        matchId: data.matchId,
        tournamentId: data.tournamentId || '',
        result: playerA.isWinner ? 'won' : 'lost',
      },
      { priority: 'high' }
    ).catch(err => console.error('[Push] Match result push failed for playerA:', err));
    
    // Notify Player B
    await createNotification({
      userId: playerB.id,
      sport,
      type: 'MATCH_RESULT',
      title: 'Match Result Recorded',
      message: playerB.isWinner
        ? `🎉 You defeated ${playerA.firstName} ${playerA.lastName}! +${playerB.pointsEarned} points`
        : `You lost to ${playerA.firstName} ${playerA.lastName}. +${playerB.pointsEarned} participation points`,
      link: tournamentName ? undefined : `/matches/${data.matchId}`,
    }, {
      sendEmail: true,
      sendPush: true,
      sendWhatsApp: false,
      emailData: {
        opponentName: `${playerA.firstName} ${playerA.lastName}`,
        result: playerB.isWinner ? 'won' : 'lost',
        score: `${playerB.score} - ${playerA.score}`,
        pointsEarned: playerB.pointsEarned,
        eloChange: playerB.eloChange > 0 ? `+${playerB.eloChange}` : playerB.eloChange,
        tournamentName: tournamentName || 'Friendly Match',
      },
    });
    
    // Send immediate push notification for match result (high priority)
    await sendPushNotification(
      playerB.id,
      playerB.isWinner ? '🎉 Victory!' : 'Match Result',
      playerB.isWinner
        ? `You defeated ${playerA.firstName} ${playerA.lastName}! +${playerB.pointsEarned} points`
        : `You lost to ${playerA.firstName} ${playerA.lastName}. +${playerB.pointsEarned} pts`,
      {
        type: 'MATCH_RESULT',
        matchId: data.matchId,
        tournamentId: data.tournamentId || '',
        result: playerB.isWinner ? 'won' : 'lost',
      },
      { priority: 'high' }
    ).catch(err => console.error('[Push] Match result push failed for playerB:', err));
    
    // Check for streak milestone (only for winner)
    if (winner.isWinner) {
      const winnerRating = await db.playerRating.findUnique({
        where: { userId: winner.id },
        select: { currentStreak: true },
      });
      
      if (winnerRating && winnerRating.currentStreak > 0) {
        // Check if streak hits a milestone (3, 5, 10, 15, 20, 25)
        const streakMilestones = [3, 5, 10, 15, 20, 25];
        if (streakMilestones.includes(winnerRating.currentStreak)) {
          await checkStreakMilestone(winner.id, sport, winnerRating.currentStreak);
        }
      }
    }
    
    // Check for tier milestone changes
    await checkAndNotifyTierChange(playerA.id, sport, playerA.eloChange);
    await checkAndNotifyTierChange(playerB.id, sport, playerB.eloChange);
    
    // Generate share card for winner
    if (winner.isWinner && data.tournamentId) {
      try {
        const shareCardData: ShareCardData = {
          sport,
          winnerName: `${winner.firstName} ${winner.lastName}`,
          loserName: winner.id === playerA.id 
            ? `${playerB.firstName} ${playerB.lastName}` 
            : `${playerA.firstName} ${playerA.lastName}`,
          winnerScore: winner.id === playerA.id ? (playerA.score || 0) : (playerB.score || 0),
          loserScore: winner.id === playerA.id ? (playerB.score || 0) : (playerA.score || 0),
          tournamentName: data.tournamentName,
          pointsEarned: winner.pointsEarned,
          eloChange: winner.eloChange,
          matchDate: new Date(),
        };
        
        // Store share card URL in notification metadata for frontend access
        const shareUrl = generateShareCardUrl(shareCardData);
        const shareText = generateShareText(shareCardData);
        
        // Create a share notification for the winner
        await db.notification.create({
          data: {
            userId: winner.id,
            sport,
            type: 'MATCH_RESULT',
            title: '🎉 Share Your Victory!',
            message: `You won! Share your match result with friends.`,
            link: data.tournamentId 
              ? `/${sport.toLowerCase()}/tournaments/${data.tournamentId}`
              : undefined,
          },
        });
        
        console.log(`[NotificationTriggers] Share card generated for winner ${winner.id}: ${shareUrl}`);
      } catch (error) {
        console.error('[NotificationTriggers] Error generating share card:', error);
      }
    }
    
    // Check for next opponent and alert
    if (data.tournamentId && winner.isWinner) {
      await checkAndAlertNextOpponent(winner.id, data.tournamentId, sport, data.tournamentName);
    }
    
    console.log(`[NotificationTriggers] Match result notifications sent for match ${data.matchId}`);
  } catch (error) {
    console.error('[NotificationTriggers] Error sending match result notifications:', error);
    // Don't throw - match result is recorded, just notifications failed
  }
}

/**
 * Check and notify about tier changes
 */
async function checkAndNotifyTierChange(userId: string, sport: SportType, eloChange: number): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { hiddenElo: true, rating: { select: { matchesPlayed: true } } },
    });
    
    if (!user) return;
    
    const matchCount = user.rating?.matchesPlayed || 0;
    const newTier = getEloTier(user.hiddenElo, matchCount);
    
    // We can't easily get the previous tier, so we'll just check milestones
    // This would require storing previous tier in the user record
    if (matchCount >= 30) {
      await checkTierMilestone(userId, sport, newTier, null);
    }
  } catch (error) {
    console.error('[NotificationTriggers] Error checking tier change:', error);
  }
}

// ============================================
// Tournament Registration Notifications
// ============================================

export async function triggerTournamentRegistrationNotification(
  userId: string,
  tournamentId: string,
  tournamentName: string,
  sport: SportType
): Promise<void> {
  try {
    await createNotification({
      userId,
      sport,
      type: 'TOURNAMENT_REGISTERED',
      title: 'Tournament Registration Confirmed',
      message: `You're registered for ${tournamentName}! Good luck!`,
      link: `/${sport.toLowerCase()}/tournaments/${tournamentId}`,
    }, {
      sendEmail: true,
      sendPush: true,
      sendWhatsApp: false,
      emailData: {
        tournamentName,
        tournamentId,
      },
    });
    
    // Send push notification for tournament registration
    await sendPushNotification(
      userId,
      '🏆 Tournament Registration Confirmed',
      `You're registered for ${tournamentName}! Good luck!`,
      {
        type: 'TOURNAMENT_REGISTERED',
        tournamentId,
        tournamentName,
        sport,
      }
    ).catch(err => console.error('[Push] Tournament registration push failed:', err));
    
    console.log(`[NotificationTriggers] Tournament registration notification sent to user ${userId}`);
  } catch (error) {
    console.error('[NotificationTriggers] Error sending tournament registration notification:', error);
  }
}

// ============================================
// Tournament Win Notifications
// ============================================

export async function triggerTournamentWinNotification(
  winnerId: string,
  tournamentId: string,
  tournamentName: string,
  sport: SportType,
  rank: number,
  prizeAmount?: number
): Promise<void> {
  try {
    const prizeMessage = prizeAmount 
      ? ` 🏆 You've won ₹${prizeAmount.toLocaleString('en-IN')}!`
      : '';
    
    await createNotification({
      userId: winnerId,
      sport,
      type: 'TOURNAMENT_WIN',
      title: rank === 1 ? '🏆 Tournament Champion!' : `🎉 #${rank} Place Finish!`,
      message: `Congratulations on finishing #${rank} in ${tournamentName}!${prizeMessage}`,
      link: `/${sport.toLowerCase()}/tournaments/${tournamentId}`,
    }, {
      sendEmail: true,
      sendPush: true,
      sendWhatsApp: true,
      emailData: {
        tournamentName,
        rank,
        prizeAmount,
      },
    });
    
    // Send immediate push notification for tournament win (high priority)
    await sendPushNotification(
      winnerId,
      rank === 1 ? '🏆 Tournament Champion!' : `🎉 #${rank} Place Finish!`,
      `Congratulations on finishing #${rank} in ${tournamentName}!${prizeMessage}`,
      {
        type: 'TOURNAMENT_WIN',
        tournamentId,
        tournamentName,
        rank: rank.toString(),
        prizeAmount: prizeAmount?.toString() || '',
        sport,
      },
      { priority: 'high' }
    ).catch(err => console.error('[Push] Tournament win push failed:', err));
    
    console.log(`[NotificationTriggers] Tournament win notification sent to user ${winnerId}`);
  } catch (error) {
    console.error('[NotificationTriggers] Error sending tournament win notification:', error);
  }
}

// ============================================
// Waitlist Promotion Notification
// ============================================

export async function triggerWaitlistPromotionNotification(
  userId: string,
  tournamentId: string,
  tournamentName: string,
  sport: SportType
): Promise<void> {
  try {
    await createNotification({
      userId,
      sport,
      type: 'WAITLIST_PROMOTED',
      title: '🎉 You\'re In!',
      message: `Good news! You've been promoted from the waitlist for ${tournamentName}. Complete your registration now!`,
      link: `/${sport.toLowerCase()}/tournaments/${tournamentId}`,
    }, {
      sendEmail: true,
      sendPush: true,
      sendWhatsApp: true,
      emailData: {
        tournamentName,
        tournamentId,
      },
    });
    
    // Send immediate push notification for waitlist promotion (high priority)
    await sendPushNotification(
      userId,
      '🎉 You\'re In!',
      `Good news! You've been promoted from the waitlist for ${tournamentName}. Complete your registration now!`,
      {
        type: 'WAITLIST_PROMOTED',
        tournamentId,
        tournamentName,
        sport,
      },
      { priority: 'high' }
    ).catch(err => console.error('[Push] Waitlist promotion push failed:', err));
    
    console.log(`[NotificationTriggers] Waitlist promotion notification sent to user ${userId}`);
  } catch (error) {
    console.error('[NotificationTriggers] Error sending waitlist promotion notification:', error);
  }
}

// ============================================
// Tournament Cancellation Notification
// ============================================

export async function triggerTournamentCancellationNotification(
  tournamentId: string,
  tournamentName: string,
  sport: SportType,
  reason?: string
): Promise<void> {
  try {
    // Get all registered players
    const registrations = await db.tournamentRegistration.findMany({
      where: { tournamentId, status: 'CONFIRMED' },
      select: { userId: true },
    });
    
    const userIds = registrations.map(reg => reg.userId);
    
    for (const reg of registrations) {
      await createNotification({
        userId: reg.userId,
        sport,
        type: 'TOURNAMENT_CANCELLED',
        title: 'Tournament Cancelled',
        message: `${tournamentName} has been cancelled. ${reason || 'A refund will be processed if applicable.'}`,
        link: `/${sport.toLowerCase()}/tournaments/${tournamentId}`,
      }, {
        sendEmail: true,
        sendPush: true,
        sendWhatsApp: false,
        emailData: {
          tournamentName,
          reason,
        },
      });
    }
    
    // Send bulk push notifications for tournament cancellation (high priority)
    await sendBulkPushNotifications(
      userIds,
      '⚠️ Tournament Cancelled',
      `${tournamentName} has been cancelled. ${reason || 'A refund will be processed if applicable.'}`,
      {
        type: 'TOURNAMENT_CANCELLED',
        tournamentId,
        tournamentName,
        reason: reason || '',
        sport,
      }
    ).catch(err => console.error('[Push] Tournament cancellation bulk push failed:', err));
    
    console.log(`[NotificationTriggers] Tournament cancellation notifications sent to ${registrations.length} users`);
  } catch (error) {
    console.error('[NotificationTriggers] Error sending tournament cancellation notifications:', error);
  }
}

// ============================================
// Next Match Alert
// ============================================

/**
 * Check for next opponent and alert the winner
 */
async function checkAndAlertNextOpponent(
  userId: string,
  tournamentId: string,
  sport: SportType,
  tournamentName?: string
): Promise<void> {
  try {
    // Find the bracket for this tournament
    const bracket = await db.bracket.findUnique({
      where: { tournamentId },
      include: {
        matches: {
          where: {
            status: 'PENDING',
            OR: [
              { playerAId: userId },
              { playerBId: userId },
            ],
          },
          include: {
            match: true,
          },
        },
      },
    });

    if (!bracket || bracket.matches.length === 0) {
      console.log(`[NotificationTriggers] No next match found for user ${userId}`);
      return;
    }

    // Get the next match
    const nextMatch = bracket.matches[0];
    const opponentId = nextMatch.playerAId === userId 
      ? nextMatch.playerBId 
      : nextMatch.playerAId;

    if (!opponentId) {
      console.log(`[NotificationTriggers] Next opponent not yet determined for user ${userId}`);
      return;
    }

    // Get opponent name
    const opponent = await db.user.findUnique({
      where: { id: opponentId },
      select: { firstName: true, lastName: true },
    });

    if (!opponent) return;

    // Send next match alert
    await createNotification({
      userId,
      sport,
      type: 'MATCH_RESULT',
      title: '⚔️ Next Opponent Ready!',
      message: `Your next match is against ${opponent.firstName} ${opponent.lastName}${tournamentName ? ` in ${tournamentName}` : ''}. Get ready!`,
      link: `/${sport.toLowerCase()}/tournaments/${tournamentId}`,
    }, {
      sendEmail: false,
      sendPush: true,
      sendWhatsApp: false,
    });

    // Send push notification for next opponent alert
    await sendPushNotification(
      userId,
      '⚔️ Next Opponent Ready!',
      `Your next match is against ${opponent.firstName} ${opponent.lastName}${tournamentName ? ` in ${tournamentName}` : ''}. Get ready!`,
      {
        type: 'NEXT_MATCH',
        tournamentId,
        opponentId,
        opponentName: `${opponent.firstName} ${opponent.lastName}`,
        sport,
      }
    ).catch(err => console.error('[Push] Next opponent push failed:', err));

    console.log(`[NotificationTriggers] Next opponent alert sent to user ${userId} for opponent ${opponentId}`);
  } catch (error) {
    console.error('[NotificationTriggers] Error checking next opponent:', error);
  }
}

export async function triggerNextMatchAlert(
  userId: string,
  matchId: string,
  opponentName: string,
  tournamentName: string,
  sport: SportType
): Promise<void> {
  try {
    await createNotification({
      userId,
      sport,
      type: 'MATCH_RESULT', // Reusing existing type
      title: '⚔️ Next Match Ready',
      message: `Your next match is against ${opponentName} in ${tournamentName}. Get ready!`,
      link: `/${sport.toLowerCase()}/matches/${matchId}`,
    }, {
      sendEmail: false,
      sendPush: true,
      sendWhatsApp: false,
    });
    
    // Send push notification for next match alert
    await sendPushNotification(
      userId,
      '⚔️ Next Match Ready',
      `Your next match is against ${opponentName} in ${tournamentName}. Get ready!`,
      {
        type: 'NEXT_MATCH',
        matchId,
        opponentName,
        tournamentName,
        sport,
      }
    ).catch(err => console.error('[Push] Next match push failed:', err));
    
    console.log(`[NotificationTriggers] Next match alert sent to user ${userId}`);
  } catch (error) {
    console.error('[NotificationTriggers] Error sending next match alert:', error);
  }
}

// ============================================
// Rank Change Notification
// ============================================

export async function triggerRankChangeNotification(
  userId: string,
  sport: SportType,
  newRank: number,
  previousRank: number | null,
  direction: 'up' | 'down'
): Promise<void> {
  try {
    // Only notify for significant rank changes
    if (direction === 'up' && previousRank && (previousRank - newRank) < 5) {
      return; // Skip small rank improvements
    }
    
    await createNotification({
      userId,
      sport,
      type: 'RANK_CHANGE',
      title: direction === 'up' ? '📈 Rank Up!' : '📉 Rank Changed',
      message: direction === 'up'
        ? `You've moved up to #${newRank} on the leaderboard!`
        : `You're now #${newRank} on the leaderboard.`,
      link: `/${sport.toLowerCase()}/leaderboard`,
    }, {
      sendEmail: direction === 'up' && newRank <= 50,
      sendPush: true,
      sendWhatsApp: false,
    });
    
    // Send push notification for rank changes (only for improvements)
    if (direction === 'up') {
      await sendPushNotification(
        userId,
        '📈 Rank Up!',
        `You've moved up to #${newRank} on the leaderboard!`,
        {
          type: 'RANK_CHANGE',
          newRank: newRank.toString(),
          previousRank: previousRank?.toString() || '',
          direction,
          sport,
        }
      ).catch(err => console.error('[Push] Rank change push failed:', err));
    }
    
    // Check for rank milestones
    await checkRankMilestones(userId, sport, newRank, previousRank);
    
    console.log(`[NotificationTriggers] Rank change notification sent to user ${userId}`);
  } catch (error) {
    console.error('[NotificationTriggers] Error sending rank change notification:', error);
  }
}
