/**
 * Elo Rating System Tests
 * Tests for the dual-metric rating system (Hidden ELO + Visible Points)
 * 
 * Run with: bunx vitest run src/lib/__tests__/elo.test.ts
 */

import { describe, it, expect } from 'vitest';

// ============================================
// ELO CALCULATION FUNCTIONS
// ============================================

interface EloConfig {
  kFactorNew: number;      // K for players < 30 matches
  kFactorRegular: number;  // K for players 30-99 matches
  kFactorVeteran: number;  // K for players 100+ matches
  startingElo: number;
  eloFloor: number;
}

const DEFAULT_ELO_CONFIG: EloConfig = {
  kFactorNew: 32,
  kFactorRegular: 24,
  kFactorVeteran: 16,
  startingElo: 1500,
  eloFloor: 100,
};

/**
 * Get K-factor based on number of matches played
 */
function getKFactor(matchesPlayed: number, config = DEFAULT_ELO_CONFIG): number {
  if (matchesPlayed < 30) return config.kFactorNew;
  if (matchesPlayed < 100) return config.kFactorRegular;
  return config.kFactorVeteran;
}

/**
 * Calculate expected score for player A against player B
 */
function calculateExpectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Calculate new Elo rating
 */
function calculateNewElo(
  currentElo: number,
  opponentElo: number,
  actualScore: number, // 1 for win, 0 for loss, 0.5 for draw
  matchesPlayed: number,
  config = DEFAULT_ELO_CONFIG
): number {
  const k = getKFactor(matchesPlayed, config);
  const expectedScore = calculateExpectedScore(currentElo, opponentElo);
  
  let newElo = currentElo + k * (actualScore - expectedScore);
  
  // Apply floor
  newElo = Math.max(config.eloFloor, newElo);
  
  return Math.round(newElo * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate Elo change for both players in a match
 */
function calculateMatchEloChanges(
  playerAElo: number,
  playerBElo: number,
  playerAMatches: number,
  playerBMatches: number,
  outcome: string,
  config = DEFAULT_ELO_CONFIG
): { eloChangeA: number; eloChangeB: number; newEloA: number; newEloB: number } {
  let kModifier = 1;

  switch (outcome) {
    case 'WALKOVER':
    case 'FORFEIT':
      kModifier = 0.5;
      break;
    case 'NO_SHOW':
    case 'BYE':
      return {
        eloChangeA: 0,
        eloChangeB: 0,
        newEloA: playerAElo,
        newEloB: playerBElo,
      };
  }

  const kA = getKFactor(playerAMatches, config) * kModifier;
  const kB = getKFactor(playerBMatches, config) * kModifier;
  
  const expectedA = calculateExpectedScore(playerAElo, playerBElo);
  const expectedB = calculateExpectedScore(playerBElo, playerAElo);

  // Assuming A wins
  const eloChangeA = kA * (1 - expectedA);
  const eloChangeB = kB * (0 - expectedB);

  return {
    eloChangeA: Math.round(eloChangeA * 100) / 100,
    eloChangeB: Math.round(eloChangeB * 100) / 100,
    newEloA: Math.max(config.eloFloor, Math.round((playerAElo + eloChangeA) * 100) / 100),
    newEloB: Math.max(config.eloFloor, Math.round((playerBElo + eloChangeB) * 100) / 100),
  };
}

/**
 * Get Elo tier based on rating
 */
function getEloTier(elo: number, matchesPlayed: number): string {
  if (matchesPlayed < 30) return 'UNRANKED';
  if (elo < 1000) return 'UNRANKED';
  if (elo < 1300) return 'BRONZE';
  if (elo < 1500) return 'SILVER';
  if (elo < 1700) return 'GOLD';
  if (elo < 1900) return 'PLATINUM';
  return 'DIAMOND';
}

// ============================================
// VISIBLE POINTS CALCULATION
// ============================================

const POINTS_CONFIG = {
  participation: { CITY: 1, DISTRICT: 1, STATE: 2, NATIONAL: 3 },
  win: { CITY: 2, DISTRICT: 3, STATE: 4, NATIONAL: 6 },
  placement: {
    first: { CITY: 10, DISTRICT: 15, STATE: 20, NATIONAL: 30 },
    second: { CITY: 6, DISTRICT: 9, STATE: 12, NATIONAL: 18 },
    third: { CITY: 3, DISTRICT: 5, STATE: 6, NATIONAL: 9 },
  },
};

function calculateMatchPoints(scope: string, isWinner: boolean): number {
  const participation = POINTS_CONFIG.participation[scope as keyof typeof POINTS_CONFIG.participation] || 1;
  const winBonus = isWinner ? (POINTS_CONFIG.win[scope as keyof typeof POINTS_CONFIG.win] || 2) : 0;
  return participation + winBonus;
}

function calculatePlacementBonus(rank: number, scope: string): number {
  if (rank === 1) return POINTS_CONFIG.placement.first[scope as keyof typeof POINTS_CONFIG.placement.first] || 0;
  if (rank === 2) return POINTS_CONFIG.placement.second[scope as keyof typeof POINTS_CONFIG.placement.second] || 0;
  if (rank === 3) return POINTS_CONFIG.placement.third[scope as keyof typeof POINTS_CONFIG.placement.third] || 0;
  return 0;
}

// ============================================
// TESTS
// ============================================

describe('Elo Rating System', () => {
  
  describe('K-Factor', () => {
    
    it('should use K=32 for new players (< 30 matches)', () => {
      expect(getKFactor(0)).toBe(32);
      expect(getKFactor(15)).toBe(32);
      expect(getKFactor(29)).toBe(32);
    });

    it('should use K=24 for regular players (30-99 matches)', () => {
      expect(getKFactor(30)).toBe(24);
      expect(getKFactor(50)).toBe(24);
      expect(getKFactor(99)).toBe(24);
    });

    it('should use K=16 for veteran players (100+ matches)', () => {
      expect(getKFactor(100)).toBe(16);
      expect(getKFactor(200)).toBe(16);
      expect(getKFactor(500)).toBe(16);
    });

  });

  describe('Expected Score', () => {
    
    it('should return 0.5 for equal ratings', () => {
      const expected = calculateExpectedScore(1500, 1500);
      expect(expected).toBeCloseTo(0.5, 4);
    });

    it('should return higher value for higher rated player', () => {
      const expectedHigher = calculateExpectedScore(1600, 1400);
      const expectedLower = calculateExpectedScore(1400, 1600);
      
      expect(expectedHigher).toBeGreaterThan(0.5);
      expect(expectedLower).toBeLessThan(0.5);
      expect(expectedHigher + expectedLower).toBeCloseTo(1, 4);
    });

    it('should handle extreme rating differences', () => {
      // 400 point difference = ~91% expected score
      const expected = calculateExpectedScore(1900, 1500);
      expect(expected).toBeCloseTo(0.91, 1);
    });

  });

  describe('Elo Calculation', () => {
    
    it('should increase Elo for winner', () => {
      const newElo = calculateNewElo(1500, 1500, 1, 0);
      expect(newElo).toBeGreaterThan(1500);
    });

    it('should decrease Elo for loser', () => {
      const newElo = calculateNewElo(1500, 1500, 0, 0);
      expect(newElo).toBeLessThan(1500);
    });

    it('should have symmetric changes for equal rated players', () => {
      const winnerElo = calculateNewElo(1500, 1500, 1, 0);
      const loserElo = calculateNewElo(1500, 1500, 0, 0);
      
      const winnerGain = winnerElo - 1500;
      const loserLoss = 1500 - loserElo;
      
      expect(winnerGain).toBe(loserLoss);
    });

    it('should give smaller gains to higher rated winner', () => {
      const highRatedWin = calculateNewElo(1800, 1500, 1, 0) - 1800;
      const lowRatedWin = calculateNewElo(1500, 1800, 1, 0) - 1500;
      
      // Lower rated player gains more from beating higher rated
      expect(lowRatedWin).toBeGreaterThan(highRatedWin);
    });

    it('should apply Elo floor', () => {
      // Player with very low Elo losing
      const newElo = calculateNewElo(150, 2000, 0, 0);
      expect(newElo).toBeGreaterThanOrEqual(100); // Floor
    });

    it('should use smaller K-factor for veterans', () => {
      const newPlayerChange = Math.abs(calculateNewElo(1500, 1500, 1, 0) - 1500);
      const veteranChange = Math.abs(calculateNewElo(1500, 1500, 1, 100) - 1500);
      
      expect(newPlayerChange).toBeGreaterThan(veteranChange);
    });

  });

  describe('Match Outcomes', () => {
    
    it('should apply full K-factor for PLAYED matches', () => {
      const result = calculateMatchEloChanges(1500, 1500, 10, 10, 'PLAYED');
      expect(Math.abs(result.eloChangeA)).toBe(16); // Full K/2 for equal players
    });

    it('should apply half K-factor for WALKOVER', () => {
      const result = calculateMatchEloChanges(1500, 1500, 10, 10, 'WALKOVER');
      expect(Math.abs(result.eloChangeA)).toBe(8); // Half K/2
    });

    it('should apply half K-factor for FORFEIT', () => {
      const result = calculateMatchEloChanges(1500, 1500, 10, 10, 'FORFEIT');
      expect(Math.abs(result.eloChangeA)).toBe(8); // Half K/2
    });

    it('should not change Elo for NO_SHOW', () => {
      const result = calculateMatchEloChanges(1500, 1500, 10, 10, 'NO_SHOW');
      expect(result.eloChangeA).toBe(0);
      expect(result.eloChangeB).toBe(0);
    });

    it('should not change Elo for BYE', () => {
      const result = calculateMatchEloChanges(1500, 1500, 10, 10, 'BYE');
      expect(result.eloChangeA).toBe(0);
      expect(result.eloChangeB).toBe(0);
    });

  });

  describe('Elo Tiers', () => {
    
    it('should return UNRANKED for players with < 30 matches', () => {
      expect(getEloTier(1700, 5)).toBe('UNRANKED');
      expect(getEloTier(2000, 29)).toBe('UNRANKED');
    });

    it('should return correct tier based on Elo', () => {
      expect(getEloTier(1100, 50)).toBe('BRONZE');
      expect(getEloTier(1400, 50)).toBe('SILVER');
      expect(getEloTier(1600, 50)).toBe('GOLD');
      expect(getEloTier(1800, 50)).toBe('PLATINUM');
      expect(getEloTier(2000, 50)).toBe('DIAMOND');
    });

    it('should return UNRANKED for Elo below 1000', () => {
      expect(getEloTier(500, 50)).toBe('UNRANKED');
      expect(getEloTier(999, 50)).toBe('UNRANKED');
    });

  });

});

describe('Visible Points System', () => {
  
  describe('Match Points', () => {
    
    it('should award participation + win points to winner', () => {
      const winnerPoints = calculateMatchPoints('CITY', true);
      const loserPoints = calculateMatchPoints('CITY', false);
      
      // City: 1 participation + 2 win = 3 for winner
      expect(winnerPoints).toBe(3);
      // City: 1 participation = 1 for loser
      expect(loserPoints).toBe(1);
    });

    it('should scale points by tournament scope', () => {
      const cityWinner = calculateMatchPoints('CITY', true);
      const stateWinner = calculateMatchPoints('STATE', true);
      const nationalWinner = calculateMatchPoints('NATIONAL', true);
      
      expect(nationalWinner).toBeGreaterThan(stateWinner);
      expect(stateWinner).toBeGreaterThan(cityWinner);
    });

    it('should give correct points for national tournament', () => {
      // National: 3 participation + 6 win = 9
      expect(calculateMatchPoints('NATIONAL', true)).toBe(9);
      // National: 3 participation = 3
      expect(calculateMatchPoints('NATIONAL', false)).toBe(3);
    });

  });

  describe('Placement Bonus', () => {
    
    it('should award first place bonus', () => {
      expect(calculatePlacementBonus(1, 'CITY')).toBe(10);
      expect(calculatePlacementBonus(1, 'STATE')).toBe(20);
      expect(calculatePlacementBonus(1, 'NATIONAL')).toBe(30);
    });

    it('should award second place bonus', () => {
      expect(calculatePlacementBonus(2, 'CITY')).toBe(6);
      expect(calculatePlacementBonus(2, 'NATIONAL')).toBe(18);
    });

    it('should award third place bonus', () => {
      expect(calculatePlacementBonus(3, 'CITY')).toBe(3);
      expect(calculatePlacementBonus(3, 'NATIONAL')).toBe(9);
    });

    it('should not award bonus for 4th place and below', () => {
      expect(calculatePlacementBonus(4, 'NATIONAL')).toBe(0);
      expect(calculatePlacementBonus(10, 'STATE')).toBe(0);
    });

  });

  describe('Total Tournament Points', () => {
    
    it('should calculate total for city tournament winner', () => {
      // Winner of city tournament:
      // - 4 matches won: 4 * 3 = 12 points
      // - 1st place bonus: 10 points
      // Total: 22 points
      const matchPoints = 4 * calculateMatchPoints('CITY', true);
      const placementBonus = calculatePlacementBonus(1, 'CITY');
      
      expect(matchPoints + placementBonus).toBe(22);
    });

    it('should calculate total for national tournament second place', () => {
      // Second place in national tournament:
      // - 5 matches (3 wins, 2 losses): 3*9 + 2*3 = 33 points
      // - 2nd place bonus: 18 points
      // Total: 51 points
      const winPoints = 3 * calculateMatchPoints('NATIONAL', true);
      const lossPoints = 2 * calculateMatchPoints('NATIONAL', false);
      const placementBonus = calculatePlacementBonus(2, 'NATIONAL');
      
      expect(winPoints + lossPoints + placementBonus).toBe(51);
    });

  });

});

describe('Integration Tests', () => {
  
  it('should correctly update ratings after a match', () => {
    // Two new players, equal rating
    const playerA = { elo: 1500, matches: 0 };
    const playerB = { elo: 1500, matches: 0 };
    
    // Player A wins
    const newEloA = calculateNewElo(playerA.elo, playerB.elo, 1, playerA.matches);
    const newEloB = calculateNewElo(playerB.elo, playerA.elo, 0, playerB.matches);
    
    // Both should have Elo changes
    expect(newEloA).toBe(1516); // +16
    expect(newEloB).toBe(1484); // -16
    
    // Total Elo should be conserved
    expect(newEloA + newEloB).toBe(3000);
  });

  it('should correctly handle upset victory', () => {
    // Low rated player beats high rated player
    const underdog = { elo: 1400, matches: 20 };
    const favorite = { elo: 1800, matches: 50 };
    
    const newEloUnderdog = calculateNewElo(underdog.elo, favorite.elo, 1, underdog.matches);
    const newEloFavorite = calculateNewElo(favorite.elo, underdog.elo, 0, favorite.matches);
    
    const underdogGain = newEloUnderdog - underdog.elo;
    const favoriteLoss = favorite.elo - newEloFavorite;
    
    // Underdog gains more than favorite loses (due to different K-factors)
    expect(underdogGain).toBeGreaterThan(0);
    expect(favoriteLoss).toBeGreaterThan(0);
    
    // Underdog should gain more than 16 (upset bonus)
    expect(underdogGain).toBeGreaterThan(16);
  });

});
