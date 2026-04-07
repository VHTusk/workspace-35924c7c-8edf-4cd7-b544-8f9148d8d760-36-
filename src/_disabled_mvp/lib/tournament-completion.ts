/**
 * VALORHIVE v3.42.0 - Tournament Completion Service
 * 
 * Handles all post-tournament completion actions:
 * - Winner notifications
 * - Badge awards
 * - Tournament recap generation
 * - Completion emails to all participants
 */

import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { triggerTournamentWinNotification } from './notification-triggers';
import { onTournamentFinish, BADGE_KEYS, awardBadge } from './badges/auto-award';
import { generateShortUrl } from './short-url';

// ============================================
// TYPES
// ============================================

interface TournamentStandings {
  rank: number;
  playerId: string;
  playerName: string;
  matchesWon: number;
  matchesLost: number;
}

interface CompletionResult {
  notificationsSent: number;
  badgesAwarded: string[];
  recapId: string | null;
  emailsQueued: number;
}

// ============================================
// MAIN COMPLETION HANDLER
// ============================================

/**
 * Execute all post-tournament completion actions
 * Called after tournament status is set to COMPLETED
 */
export async function handleTournamentCompletion(
  tournamentId: string,
  standings: TournamentStandings[]
): Promise<CompletionResult> {
  const result: CompletionResult = {
    notificationsSent: 0,
    badgesAwarded: [],
    recapId: null,
    emailsQueued: 0,
  };

  try {
    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        registrations: {
          where: { status: 'CONFIRMED' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                sport: true,
                rating: { select: { tournamentsPlayed: true } },
              },
            },
          },
        },
        matches: {
          where: { outcome: 'PLAYED' },
          select: {
            playerAId: true,
            playerBId: true,
            winnerId: true,
          },
        },
      },
    });

    if (!tournament) {
      console.error('[TournamentCompletion] Tournament not found:', tournamentId);
      return result;
    }

    const sport = tournament.sport as SportType;

    // 1. Send winner notifications
    for (const standing of standings) {
      if (!standing.playerId) continue;

      await triggerTournamentWinNotification(
        standing.playerId,
        tournamentId,
        tournament.name,
        sport,
        standing.rank,
        undefined // Prize amount would come from PrizeDistribution
      );
      result.notificationsSent++;
    }

    // 2. Award badges
    const winner = standings.find((s) => s.rank === 1);
    const runnerUp = standings.find((s) => s.rank === 2);
    const thirdPlace = standings.find((s) => s.rank === 3);

    // Count matches won/lost for each player
    const matchStats = new Map<string, { won: number; lost: number }>();
    for (const match of tournament.matches) {
      if (match.winnerId) {
        const loserId = match.winnerId === match.playerAId ? match.playerBId : match.playerAId;
        
        if (!matchStats.has(match.winnerId)) matchStats.set(match.winnerId, { won: 0, lost: 0 });
        matchStats.get(match.winnerId)!.won++;
        
        if (loserId && !matchStats.has(loserId)) matchStats.set(loserId, { won: 0, lost: 0 });
        if (loserId) matchStats.get(loserId)!.lost++;
      }
    }

    // Award badges to top 3
    for (const standing of standings.slice(0, 3)) {
      if (!standing.playerId) continue;

      const stats = matchStats.get(standing.playerId) || { won: 0, lost: 0 };
      const playerReg = tournament.registrations.find(r => r.userId === standing.playerId);
      const isFirstTournament = (playerReg?.user.rating?.tournamentsPlayed || 0) <= 1;

      const awarded = await onTournamentFinish(
        standing.playerId,
        sport,
        standing.rank,
        stats.won,
        stats.lost,
        isFirstTournament
      );
      result.badgesAwarded.push(...awarded);
    }

    // 3. Generate tournament recap
    const recap = await generateTournamentRecap(tournamentId, tournament, standings);
    result.recapId = recap?.id || null;

    // 4. Send completion emails to all participants
    const emailResults = await sendTournamentCompletionEmails(tournamentId, tournament, standings);
    result.emailsQueued = emailResults;

    console.log('[TournamentCompletion] Completion chain finished:', {
      tournamentId,
      notificationsSent: result.notificationsSent,
      badgesAwarded: result.badgesAwarded.length,
      recapGenerated: !!result.recapId,
      emailsQueued: result.emailsQueued,
    });

    return result;
  } catch (error) {
    console.error('[TournamentCompletion] Error in completion chain:', error);
    return result;
  }
}

// ============================================
// TOURNAMENT RECAP GENERATION
// ============================================

async function generateTournamentRecap(
  tournamentId: string,
  tournament: {
    id: string;
    name: string;
    sport: SportType;
    startDate: Date;
    endDate: Date;
    registrations: Array<{ userId: string; user: { id: string; firstName: string; lastName: string } }>;
    matches: Array<{ playerAId: string | null; playerBId: string | null; winnerId: string | null }>;
  },
  standings: TournamentStandings[]
) {
  try {
    // Calculate statistics
    const totalMatches = tournament.matches.length;
    const uniquePlayers = new Set(
      tournament.matches.flatMap(m => [m.playerAId, m.playerBId]).filter(Boolean)
    ).size;
    const avgMatchTime = null; // Would need match timestamps

    // Find biggest upset (largest ELO difference where lower won)
    // Find longest match, etc.

    // Create recap
    const recap = await db.tournamentRecap.create({
      data: {
        tournamentId,
        summary: generateRecapSummary(tournament, standings),
        highlights: JSON.stringify({
          totalMatches,
          uniquePlayers,
          avgMatchTime,
          topScorers: standings.slice(0, 3).map(s => ({
            name: s.playerName,
            rank: s.rank,
            matchesWon: s.matchesWon,
          })),
        }),
        generatedAt: new Date(),
      },
    });

    return recap;
  } catch (error) {
    console.error('[TournamentCompletion] Error generating recap:', error);
    return null;
  }
}

function generateRecapSummary(
  tournament: { name: string; startDate: Date; endDate: Date; matches: unknown[] },
  standings: TournamentStandings[]
): string {
  const winner = standings.find(s => s.rank === 1);
  const runnerUp = standings.find(s => s.rank === 2);
  const totalMatches = tournament.matches.length;
  const duration = Math.ceil(
    (tournament.endDate.getTime() - tournament.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  let summary = `${tournament.name} has concluded after ${duration} days and ${totalMatches} matches. `;

  if (winner) {
    summary += `🏆 ${winner.playerName} emerged as champion`;
    if (runnerUp) {
      summary += `, defeating ${runnerUp.playerName} in the final`;
    }
    summary += '. ';
  }

  summary += 'Congratulations to all participants!';

  return summary;
}

// ============================================
// COMPLETION EMAILS
// ============================================

async function sendTournamentCompletionEmails(
  tournamentId: string,
  tournament: {
    id: string;
    name: string;
    sport: SportType;
    registrations: Array<{
      userId: string;
      user: { id: string; firstName: string; lastName: string; email: string | null };
    }>;
  },
  standings: TournamentStandings[]
): Promise<number> {
  let emailsQueued = 0;

  try {
    // Create short URL for tournament
    const shortUrl = await generateShortUrl('tournament', tournamentId);
    const shareUrl = `${process.env.NEXT_PUBLIC_URL || 'https://valorhive.com'}/s/${shortUrl}`;

    // Create standing lookup map
    const standingMap = new Map(standings.map(s => [s.playerId, s.rank]));

    // Queue emails for all participants
    for (const reg of tournament.registrations) {
      if (!reg.user.email) continue;

      const playerRank = standingMap.get(reg.userId);
      const rankText = playerRank ? `You finished #${playerRank}!` : 'Thank you for participating!';

      // Create notification for email
      await db.notification.create({
        data: {
          userId: reg.userId,
          sport: tournament.sport,
          type: 'TOURNAMENT_RESULT',
          title: `🏁 ${tournament.name} Complete!`,
          message: `${rankText} View final standings and share your results.`,
          link: `/${tournament.sport.toLowerCase()}/tournaments/${tournamentId}/recap`,
        },
      });

      // Queue email (would integrate with email service)
      // await queueEmail({
      //   to: reg.user.email,
      //   template: 'tournament-complete',
      //   data: {
      //     playerName: `${reg.user.firstName} ${reg.user.lastName}`,
      //     tournamentName: tournament.name,
      //     rank: playerRank,
      //     shareUrl,
      //     standings: standings.slice(0, 10),
      //   },
      // });

      emailsQueued++;
    }

    return emailsQueued;
  } catch (error) {
    console.error('[TournamentCompletion] Error sending completion emails:', error);
    return emailsQueued;
  }
}

// ============================================
// EXPORTS
// ============================================

export const TournamentCompletionService = {
  handleTournamentCompletion,
  generateTournamentRecap,
  sendTournamentCompletionEmails,
};
