/**
 * Tournament Watcher Notification Triggers
 * 
 * Sends notifications to spectators who subscribed to tournament updates
 * via email or phone (no account required).
 */

import { db } from './db';
import { getTournamentWatchers } from './tournament-watcher';

interface MatchResultData {
  tournamentId: string;
  tournamentName: string;
  matchId: string;
  playerA: string;
  playerB: string;
  scoreA: number;
  scoreB: number;
  winner: string;
  round: number;
  sport: string;
}

interface TournamentUpdateData {
  tournamentId: string;
  tournamentName: string;
  updateType: 'status_change' | 'schedule_change' | 'venue_change' | 'announcement';
  message: string;
  sport: string;
}

interface WinnerAnnouncementData {
  tournamentId: string;
  tournamentName: string;
  winner: {
    name: string;
    prize?: number;
  };
  runnerUp?: {
    name: string;
    prize?: number;
  };
  sport: string;
}

/**
 * Notify watchers about match results
 */
export async function notifyWatchersMatchResult(data: MatchResultData): Promise<void> {
  try {
    const watchers = await getTournamentWatchers(data.tournamentId, 'matchResults');
    
    if (watchers.length === 0) return;

    const subject = `Match Result: ${data.playerA} vs ${data.playerB}`;
    const message = `
🏆 ${data.tournamentName}
Match Result - Round ${data.round}

${data.playerA} ${data.scoreA} - ${data.scoreB} ${data.playerB}
Winner: ${data.winner}

Follow the tournament on VALORHIVE for more updates.
    `.trim();

    // Queue notifications
    await queueWatcherNotifications(watchers, {
      subject,
      message,
      type: 'match_result',
      tournamentId: data.tournamentId,
      sport: data.sport,
    });
  } catch (error) {
    console.error('Failed to notify watchers about match result:', error);
  }
}

/**
 * Notify watchers about tournament updates
 */
export async function notifyWatchersTournamentUpdate(data: TournamentUpdateData): Promise<void> {
  try {
    const watchers = await getTournamentWatchers(data.tournamentId, 'updates');
    
    if (watchers.length === 0) return;

    const subject = `Update: ${data.tournamentName}`;
    const message = `
📢 ${data.tournamentName}

${data.message}

Stay tuned for more updates on VALORHIVE.
    `.trim();

    await queueWatcherNotifications(watchers, {
      subject,
      message,
      type: 'tournament_update',
      tournamentId: data.tournamentId,
      sport: data.sport,
    });
  } catch (error) {
    console.error('Failed to notify watchers about tournament update:', error);
  }
}

/**
 * Notify watchers about winner announcement
 */
export async function notifyWatchersWinner(data: WinnerAnnouncementData): Promise<void> {
  try {
    const watchers = await getTournamentWatchers(data.tournamentId, 'winner');
    
    if (watchers.length === 0) return;

    const subject = `🏆 Winner: ${data.tournamentName}`;
    let message = `
🏆 ${data.tournamentName} - Results

🥇 Winner: ${data.winner.name}
${data.winner.prize ? `Prize: ₹${data.winner.prize.toLocaleString('en-IN')}` : ''}

${data.runnerUp ? `
🥈 Runner-up: ${data.runnerUp.name}
${data.runnerUp.prize ? `Prize: ₹${data.runnerUp.prize.toLocaleString('en-IN')}` : ''}` : ''}

Congratulations to all participants!
    `.trim();

    await queueWatcherNotifications(watchers, {
      subject,
      message,
      type: 'winner_announcement',
      tournamentId: data.tournamentId,
      sport: data.sport,
    });
  } catch (error) {
    console.error('Failed to notify watchers about winner:', error);
  }
}

/**
 * Notify watchers about schedule changes
 */
export async function notifyWatchersScheduleChange(
  tournamentId: string,
  tournamentName: string,
  message: string,
  sport: string
): Promise<void> {
  try {
    const watchers = await getTournamentWatchers(tournamentId, 'schedule');
    
    if (watchers.length === 0) return;

    const subject = `Schedule Update: ${tournamentName}`;
    
    await queueWatcherNotifications(watchers, {
      subject,
      message: `
⏰ ${tournamentName}

${message}

Check the updated schedule on VALORHIVE.
      `.trim(),
      type: 'schedule_change',
      tournamentId,
      sport,
    });
  } catch (error) {
    console.error('Failed to notify watchers about schedule change:', error);
  }
}

/**
 * Queue notifications for watchers
 * In production, this would integrate with email/SMS service
 */
async function queueWatcherNotifications(
  watchers: Array<{ id: string; email: string | null; phone: string | null }>,
  data: {
    subject: string;
    message: string;
    type: string;
    tournamentId: string;
    sport: string;
  }
): Promise<void> {
  // Create notification records for tracking
  const notifications = watchers.map(watcher => ({
    watcherId: watcher.id,
    type: data.type,
    subject: data.subject,
    message: data.message,
    tournamentId: data.tournamentId,
    sport: data.sport,
    status: 'QUEUED' as const,
  }));

  // Log for development
  console.log(`[Watcher Notifications] Queuing ${notifications.length} notifications for ${data.type}`);
  
  // In production, integrate with:
  // - Email service (SendGrid, Mailgun, etc.)
  // - SMS/WhatsApp service (Twilio, Gupshup, etc.)
  
  // For now, just log the notifications
  for (const watcher of watchers) {
    if (watcher.email) {
      console.log(`[Email] To: ${watcher.email}, Subject: ${data.subject}`);
    }
    if (watcher.phone) {
      console.log(`[WhatsApp] To: ${watcher.phone}, Message: ${data.message.substring(0, 100)}...`);
    }
  }
}

/**
 * Get unsubscribe link for watcher
 */
export function getUnsubscribeLink(watcherId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com';
  return `${baseUrl}/unsubscribe/${watcherId}`;
}
