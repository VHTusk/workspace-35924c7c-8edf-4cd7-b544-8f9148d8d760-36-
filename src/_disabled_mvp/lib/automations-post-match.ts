/**
 * Post-Match Automation for VALORHIVE
 * 
 * Handles automated actions after a match ends:
 * - Generate shareable result card
 * - Send notifications to both players
 * - Alert next opponent if applicable
 */

import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { onMatchResult, onNextMatchScheduled, onWinStreak } from '@/lib/notifications/event-handlers';
import { onMatchWin } from '@/lib/badges/auto-award';

interface MatchResultData {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  winnerId: string;
  loserId: string;
  winnerScore: number;
  loserScore: number;
  sport: SportType;
  winnerPointsEarned: number;
  loserPointsEarned: number;
  winnerEloChange: number;
  loserEloChange: number;
}

/**
 * Run all post-match automations
 */
export async function runPostMatchAutomation(data: MatchResultData): Promise<void> {
  const { matchId, tournamentId, tournamentName, winnerId, loserId, winnerScore, loserScore, sport, winnerPointsEarned, loserPointsEarned, winnerEloChange, loserEloChange } = data;

  // Run in parallel for performance
  await Promise.all([
    // 1. Send match result notifications
    sendMatchNotifications(data),
    // 2. Check and award badges for winner
    processWinnerBadges(winnerId, sport),
    // 3. Notify next opponent if match advances winner
    notifyNextOpponent(matchId, tournamentId, winnerId, sport, tournamentName),
    // 4. Update win streak
    updateWinStreak(winnerId, sport),
  ]);
}

/**
 * Send match result notifications to both players
 */
async function sendMatchNotifications(data: MatchResultData): Promise<void> {
  const { matchId, tournamentId, tournamentName, winnerId, loserId, winnerScore, loserScore, sport, winnerPointsEarned, loserPointsEarned, winnerEloChange, loserEloChange } = data;

  const [winner, loser] = await Promise.all([
    db.user.findUnique({ where: { id: winnerId }, select: { id: true, email: true, firstName: true, lastName: true } }),
    db.user.findUnique({ where: { id: loserId }, select: { id: true, email: true, firstName: true, lastName: true } }),
  ]);

  if (!winner || !loser) return;

  await onMatchResult({
    matchId,
    tournamentId,
    tournamentName,
    winner: {
      id: winner.id,
      email: winner.email || undefined,
      name: `${winner.firstName} ${winner.lastName}`,
      score: winnerScore,
      pointsEarned: winnerPointsEarned,
      eloChange: winnerEloChange,
    },
    loser: {
      id: loser.id,
      email: loser.email || undefined,
      name: `${loser.firstName} ${loser.lastName}`,
      score: loserScore,
      pointsEarned: loserPointsEarned,
      eloChange: loserEloChange,
    },
    sport,
  });
}

/**
 * Check and award badges for the winner
 */
async function processWinnerBadges(winnerId: string, sport: SportType): Promise<void> {
  const [totalMatches, winsCount] = await Promise.all([
    db.match.count({
      where: {
        OR: [{ playerAId: winnerId }, { playerBId: winnerId }],
        verificationStatus: 'VERIFIED',
      },
    }),
    db.match.count({
      where: {
        winnerId,
        verificationStatus: 'VERIFIED',
      },
    }),
  ]);

  const currentStreak = await getCurrentWinStreak(winnerId);
  const isFirstWin = winsCount === 1;

  await onMatchWin(winnerId, sport, totalMatches, currentStreak, isFirstWin);
}

/**
 * Get current win streak for a player
 */
async function getCurrentWinStreak(userId: string): Promise<number> {
  const matches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
    },
    orderBy: { playedAt: 'desc' },
    take: 20,
    select: { winnerId: true },
  });

  let streak = 0;
  for (const match of matches) {
    if (match.winnerId === userId) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Update win streak and notify on milestones
 */
async function updateWinStreak(winnerId: string, sport: SportType): Promise<void> {
  const currentStreak = await getCurrentWinStreak(winnerId);
  
  const user = await db.user.findUnique({
    where: { id: winnerId },
    select: { email: true, firstName: true },
  });

  if (user) {
    await onWinStreak({
      userId: winnerId,
      userEmail: user.email || '',
      playerName: user.firstName,
      currentStreak,
      sport,
    });
  }
}

/**
 * Notify next opponent when winner advances in bracket
 */
async function notifyNextOpponent(
  completedMatchId: string,
  tournamentId: string,
  winnerId: string,
  sport: SportType,
  tournamentName: string
): Promise<void> {
  const bracketMatch = await db.bracketMatch.findFirst({
    where: { matchId: completedMatchId },
    include: { bracket: true },
  });

  if (!bracketMatch) return;

  const nextRoundMatch = await db.bracketMatch.findFirst({
    where: {
      bracketId: bracketMatch.bracketId,
      roundNumber: bracketMatch.roundNumber + 1,
      matchNumber: Math.ceil(bracketMatch.matchNumber / 2),
    },
    include: {
      match: {
        include: {
          playerA: { select: { id: true, firstName: true, lastName: true } },
          playerB: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!nextRoundMatch?.match) return;

  const match = nextRoundMatch.match;
  let opponent = null;
  
  if (match.playerAId && match.playerAId !== winnerId) {
    opponent = match.playerA;
  } else if (match.playerBId && match.playerBId !== winnerId) {
    opponent = match.playerB;
  }

  if (!opponent) return;

  const winner = await db.user.findUnique({
    where: { id: winnerId },
    select: { firstName: true, lastName: true },
  });

  await onNextMatchScheduled({
    playerId: opponent.id,
    playerName: `${opponent.firstName} ${opponent.lastName}`,
    match: {
      id: match.id,
      roundNumber: nextRoundMatch.roundNumber,
      matchNumber: nextRoundMatch.matchNumber,
    },
    opponent: winner ? { name: `${winner.firstName} ${winner.lastName}`, tier: 'RANKED' } : undefined,
    tournament: { id: tournamentId, name: tournamentName },
    sport,
  });
}

/**
 * Get social share URLs for match result
 */
export function getMatchShareUrls(params: {
  winnerName: string;
  loserName: string;
  score: string;
  tournamentName: string;
  tournamentId: string;
  sport: SportType;
}): { whatsapp: string; twitter: string; facebook: string; telegram: string } {
  const text = `🏆 ${params.winnerName} defeated ${params.loserName} ${params.score} in ${params.tournamentName}! #VALORHIVE #${params.sport}`;
  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com'}/${params.sport.toLowerCase()}/tournaments/${params.tournamentId}`;

  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  };
}
