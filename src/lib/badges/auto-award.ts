/**
 * MVP badge service
 *
 * The previous auto-award implementation depended on a badge schema that no
 * longer matches the active Prisma models. For MVP deployment we keep the
 * public API surface stable, but disable automatic badge writes.
 */

import { SportType } from '@prisma/client';

export const BADGE_KEYS = {
  FIRST_WIN: 'first_win',
  VETERAN_10: 'veteran_10',
  VETERAN_25: 'veteran_25',
  VETERAN_50: 'veteran_50',
  VETERAN_100: 'veteran_100',
  STREAK_3: 'streak_3',
  STREAK_5: 'streak_5',
  STREAK_10: 'streak_10',
  TOURNAMENT_CHAMPION: 'tournament_champion',
  TOURNAMENT_RUNNER_UP: 'tournament_runner_up',
  TOURNAMENT_BRONZE: 'tournament_bronze',
  PERFECT_TOURNAMENT: 'perfect_tournament',
  SOCIAL_10: 'social_10',
  SOCIAL_50: 'social_50',
  SOCIAL_100: 'social_100',
  EARLY_BIRD: 'early_bird',
  FIRST_TOURNAMENT: 'first_tournament',
  VERIFIED_PLAYER: 'verified_player',
} as const;

export const DEFAULT_BADGES: Array<Record<string, string>> = [];

export async function awardBadge(_userId: string, _badgeKey: string, _sport: SportType): Promise<boolean> {
  return false;
}

export async function onMatchWin(
  _userId: string,
  _sport: SportType,
  _matchCount: number,
  _currentStreak: number,
  _isFirstWin: boolean
): Promise<string[]> {
  return [];
}

export async function onTournamentFinish(
  _userId: string,
  _sport: SportType,
  _placement: number,
  _matchesWon: number,
  _matchesLost: number,
  _isFirstTournament: boolean
): Promise<string[]> {
  return [];
}

export async function onFollowerCountChange(
  _userId: string,
  _sport: SportType,
  _followerCount: number
): Promise<string[]> {
  return [];
}

export async function awardVerifiedBadge(_userId: string, _sport: SportType): Promise<boolean> {
  return false;
}

export async function seedBadgeDefinitions(): Promise<void> {
  return;
}

export async function getUserBadges(_userId: string): Promise<never[]> {
  return [];
}
