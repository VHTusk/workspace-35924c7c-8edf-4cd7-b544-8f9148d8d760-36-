/**
 * ELO Rating System Tests
 *
 * Tests for:
 * - Winner gains ELO
 * - Loser loses ELO
 * - Expected result produces minimal change
 * - Upset produces larger change
 * - ELO floor (minimum 100)
 * - K-factor variation by matches played
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================
// Constants
// ============================================

const ELO_CONFIG = {
  INITIAL_RATING: 1500,
  MIN_RATING: 100,
  K_FACTORS: {
    NEW_PLAYER: 32,        // < 30 matches
    INTERMEDIATE: 24,      // 30-99 matches
    EXPERIENCED: 16,       // >= 100 matches
  },
  MATCH_THRESHOLDS: {
    NEW: 30,
    EXPERIENCED: 100,
  },
} as const;

const TIER_THRESHOLDS = {
  UNRANKED: { minMatches: 0, maxMatches: 29 },
  BRONZE: { minElo: 0, maxElo: 1299 },
  SILVER: { minElo: 1300, maxElo: 1499 },
  GOLD: { minElo: 1500, maxElo: 1699 },
  PLATINUM: { minElo: 1700, maxElo: 1899 },
  DIAMOND: { minElo: 1900, maxElo: Infinity },
} as const;

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate the K-factor based on match count
 */
function getKFactor(matchCountA: number, matchCountB: number): number {
  // Use the higher K-factor (more volatile) for new players
  if (matchCountA < ELO_CONFIG.MATCH_THRESHOLDS.NEW || 
      matchCountB < ELO_CONFIG.MATCH_THRESHOLDS.NEW) {
    return ELO_CONFIG.K_FACTORS.NEW_PLAYER;
  }
  if (matchCountA >= ELO_CONFIG.MATCH_THRESHOLDS.EXPERIENCED || 
      matchCountB >= ELO_CONFIG.MATCH_THRESHOLDS.EXPERIENCED) {
    return ELO_CONFIG.K_FACTORS.EXPERIENCED;
  }
  return ELO_CONFIG.K_FACTORS.INTERMEDIATE;
}

/**
 * Calculate expected score for player A against player B
 */
function calculateExpectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Calculate ELO change for a match
 */
function calculateEloChange(
  eloA: number,
  eloB: number,
  actualScoreA: number,
  matchCountA: number,
  matchCountB: number
): { eloChangeA: number; eloChangeB: number; newEloA: number; newEloB: number } {
  const K = getKFactor(matchCountA, matchCountB);
  const expectedA = calculateExpectedScore(eloA, eloB);
  const expectedB = calculateExpectedScore(eloB, eloA);

  const eloChangeA = Math.round(K * (actualScoreA - expectedA));
  const eloChangeB = Math.round(K * ((1 - actualScoreA) - expectedB));

  // Apply ELO floor
  const newEloA = Math.max(ELO_CONFIG.MIN_RATING, eloA + eloChangeA);
  const newEloB = Math.max(ELO_CONFIG.MIN_RATING, eloB + eloChangeB);

  return { eloChangeA, eloChangeB, newEloA, newEloB };
}

/**
 * Get tier based on ELO and match count
 */
function getEloTier(elo: number, matchCount: number): string {
  if (matchCount < ELO_CONFIG.MATCH_THRESHOLDS.NEW) {
    return 'UNRANKED';
  }
  if (elo >= TIER_THRESHOLDS.DIAMOND.minElo) return 'DIAMOND';
  if (elo >= TIER_THRESHOLDS.PLATINUM.minElo) return 'PLATINUM';
  if (elo >= TIER_THRESHOLDS.GOLD.minElo) return 'GOLD';
  if (elo >= TIER_THRESHOLDS.SILVER.minElo) return 'SILVER';
  return 'BRONZE';
}

// ============================================
// Tests
// ============================================

describe('ELO Rating System', () => {
  describe('Winner gains ELO', () => {
    it('should increase winner ELO on victory', () => {
      const result = calculateEloChange(1500, 1500, 1, 10, 10);

      expect(result.eloChangeA).toBeGreaterThan(0);
      expect(result.newEloA).toBeGreaterThan(1500);
    });

    it('should decrease loser ELO on loss', () => {
      const result = calculateEloChange(1500, 1500, 1, 10, 10);

      expect(result.eloChangeB).toBeLessThan(0);
      expect(result.newEloB).toBeLessThan(1500);
    });

    it('should have equal and opposite ELO changes for equal-rated players', () => {
      const result = calculateEloChange(1500, 1500, 1, 10, 10);

      expect(result.eloChangeA).toBe(-result.eloChangeB);
    });

    it('should give 16 points for win between equal new players', () => {
      // K=32, expected=0.5, actual=1, change = 32 * (1 - 0.5) = 16
      const result = calculateEloChange(1500, 1500, 1, 10, 10);

      expect(result.eloChangeA).toBe(16);
      expect(result.eloChangeB).toBe(-16);
    });

    it('should correctly update new ELO ratings', () => {
      const result = calculateEloChange(1500, 1500, 1, 10, 10);

      expect(result.newEloA).toBe(1516);
      expect(result.newEloB).toBe(1484);
    });
  });

  describe('Loser loses ELO', () => {
    it('should decrease ELO for loss against equal player', () => {
      const result = calculateEloChange(1500, 1500, 0, 10, 10);

      expect(result.eloChangeA).toBeLessThan(0);
      expect(result.newEloA).toBeLessThan(1500);
    });

    it('should give -16 points for loss between equal new players', () => {
      // K=32, expected=0.5, actual=0, change = 32 * (0 - 0.5) = -16
      const result = calculateEloChange(1500, 1500, 0, 10, 10);

      expect(result.eloChangeA).toBe(-16);
      expect(result.eloChangeB).toBe(16);
    });

    it('should handle multiple consecutive losses', () => {
      let eloA = 1500;
      const eloB = 1500;

      for (let i = 0; i < 5; i++) {
        const result = calculateEloChange(eloA, eloB, 0, 10 + i, 10);
        eloA = result.newEloA;
      }

      expect(eloA).toBeLessThan(1500);
    });
  });

  describe('Expected result produces minimal change', () => {
    it('should give minimal points when favorite wins', () => {
      // 1800 vs 1500 - 1800 is heavily favored
      const result = calculateEloChange(1800, 1500, 1, 30, 30);

      // Expected score for 1800 vs 1500: ~0.85
      // Change = 24 * (1 - 0.85) = ~3.6
      expect(result.eloChangeA).toBeLessThan(10);
      expect(result.eloChangeA).toBeGreaterThan(0);
    });

    it('should deduct minimal points when favorite wins', () => {
      // 1800 vs 1500 - 1500 is expected to lose
      const result = calculateEloChange(1800, 1500, 1, 30, 30);

      expect(result.eloChangeB).toBeLessThan(0);
      expect(result.eloChangeB).toBeGreaterThan(-10);
    });

    it('should give correct expected score for rating difference', () => {
      // 400 point difference should give ~0.91 expected score
      const expected = calculateExpectedScore(1900, 1500);
      expect(expected).toBeCloseTo(0.91, 1);

      // 200 point difference should give ~0.76 expected score
      const expected2 = calculateExpectedScore(1700, 1500);
      expect(expected2).toBeCloseTo(0.76, 1);
    });

    it('should give 0.5 expected score for equal ratings', () => {
      const expected = calculateExpectedScore(1500, 1500);
      expect(expected).toBe(0.5);
    });
  });

  describe('Upset produces larger change', () => {
    it('should give more points for upset win', () => {
      // 1200 beats 1800 - major upset
      const result = calculateEloChange(1200, 1800, 1, 30, 30);

      // Expected score for 1200 vs 1800: ~0.03
      // Change = 24 * (1 - 0.03) = ~23
      expect(result.eloChangeA).toBeGreaterThan(15);
    });

    it('should deduct more points when favorite loses', () => {
      // 1800 loses to 1200 - major upset
      const result = calculateEloChange(1200, 1800, 1, 30, 30);

      expect(result.eloChangeB).toBeLessThan(-15);
    });

    it('should give near-maximum points for extreme upset', () => {
      // 800 beats 2200 - extreme upset
      const result = calculateEloChange(800, 2200, 1, 30, 30);

      // Expected score is nearly 0
      // Change should be nearly K (24)
      expect(result.eloChangeA).toBeGreaterThan(20);
      expect(result.eloChangeA).toBeLessThanOrEqual(24);
    });

    it('should correctly handle large rating differences', () => {
      const result = calculateEloChange(2200, 800, 1, 30, 30);

      // 2200 is heavily favored, win should give minimal points
      expect(result.eloChangeA).toBeLessThanOrEqual(1);
    });
  });

  describe('ELO floor (minimum 100)', () => {
    it('should enforce minimum ELO of 100', () => {
      // Player with ELO 150 loses big
      const result = calculateEloChange(150, 2000, 0, 30, 30);

      // Even after a big loss, ELO should not go below 100
      expect(result.newEloA).toBeGreaterThanOrEqual(100);
    });

    it('should not reduce ELO below floor on multiple losses', () => {
      let eloA = 200;
      const eloB = 2000;

      for (let i = 0; i < 20; i++) {
        const result = calculateEloChange(eloA, eloB, 0, 30 + i, 30);
        eloA = result.newEloA;
      }

      expect(eloA).toBeGreaterThanOrEqual(100);
    });

    it('should allow ELO at exactly the floor', () => {
      const result = calculateEloChange(100, 2000, 0, 30, 30);

      expect(result.newEloA).toBe(100);
    });

    it('should calculate change correctly even when floor is applied', () => {
      // Use a scenario where the loss would actually push ELO below floor
      // Player with ELO 105 loses to equal-rated opponent
      // Expected = 0.5, actual = 0, change = -12 (K=24)
      // newEloA = max(100, 105 - 12) = 100 (floor applied)
      const result = calculateEloChange(105, 105, 0, 30, 30);

      expect(result.eloChangeA).toBe(-12);
      expect(result.newEloA).toBe(100); // Floor prevents going to 93
    });
  });

  describe('K-factor variation by matches played', () => {
    it('should use K=32 for new players (< 30 matches)', () => {
      const result = calculateEloChange(1500, 1500, 1, 10, 10);

      // K=32, change = 32 * 0.5 = 16
      expect(result.eloChangeA).toBe(16);
    });

    it('should use K=24 for intermediate players (30-99 matches)', () => {
      const result = calculateEloChange(1500, 1500, 1, 50, 50);

      // K=24, change = 24 * 0.5 = 12
      expect(result.eloChangeA).toBe(12);
    });

    it('should use K=16 for experienced players (>= 100 matches)', () => {
      const result = calculateEloChange(1500, 1500, 1, 100, 100);

      // K=16, change = 16 * 0.5 = 8
      expect(result.eloChangeA).toBe(8);
    });

    it('should use higher K if either player is new', () => {
      // One new player, one experienced
      const result = calculateEloChange(1500, 1500, 1, 10, 100);

      // Should use K=32 (new player's K)
      expect(result.eloChangeA).toBe(16);
    });

    it('should decrease volatility as players gain experience', () => {
      const newPlayerResult = calculateEloChange(1500, 1500, 1, 10, 10);
      const intermediateResult = calculateEloChange(1500, 1500, 1, 50, 50);
      const experiencedResult = calculateEloChange(1500, 1500, 1, 100, 100);

      // New players have highest volatility
      expect(Math.abs(newPlayerResult.eloChangeA)).toBeGreaterThan(
        Math.abs(intermediateResult.eloChangeA)
      );
      expect(Math.abs(intermediateResult.eloChangeA)).toBeGreaterThan(
        Math.abs(experiencedResult.eloChangeA)
      );
    });

    it('should use K=24 when one player has exactly 30 matches', () => {
      const result = calculateEloChange(1500, 1500, 1, 30, 30);

      // 30 matches is intermediate threshold
      expect(result.eloChangeA).toBe(12);
    });

    it('should use K=16 when one player has exactly 100 matches', () => {
      const result = calculateEloChange(1500, 1500, 1, 100, 50);

      // 100 matches is experienced threshold
      expect(result.eloChangeA).toBe(8);
    });
  });

  describe('Tier Assignment', () => {
    it('should return UNRANKED for players with < 30 matches', () => {
      expect(getEloTier(1900, 25)).toBe('UNRANKED');
      expect(getEloTier(2500, 10)).toBe('UNRANKED');
    });

    it('should return BRONZE for ELO < 1300 with enough matches', () => {
      expect(getEloTier(1000, 30)).toBe('BRONZE');
      expect(getEloTier(1299, 50)).toBe('BRONZE');
    });

    it('should return SILVER for ELO 1300-1499 with enough matches', () => {
      expect(getEloTier(1300, 30)).toBe('SILVER');
      expect(getEloTier(1400, 50)).toBe('SILVER');
      expect(getEloTier(1499, 100)).toBe('SILVER');
    });

    it('should return GOLD for ELO 1500-1699 with enough matches', () => {
      expect(getEloTier(1500, 30)).toBe('GOLD');
      expect(getEloTier(1600, 50)).toBe('GOLD');
      expect(getEloTier(1699, 100)).toBe('GOLD');
    });

    it('should return PLATINUM for ELO 1700-1899 with enough matches', () => {
      expect(getEloTier(1700, 30)).toBe('PLATINUM');
      expect(getEloTier(1800, 50)).toBe('PLATINUM');
      expect(getEloTier(1899, 100)).toBe('PLATINUM');
    });

    it('should return DIAMOND for ELO >= 1900 with enough matches', () => {
      expect(getEloTier(1900, 30)).toBe('DIAMOND');
      expect(getEloTier(2000, 50)).toBe('DIAMOND');
      expect(getEloTier(2500, 100)).toBe('DIAMOND');
    });
  });

  describe('Draw handling', () => {
    it('should give 0 change for draw between equal players', () => {
      const result = calculateEloChange(1500, 1500, 0.5, 10, 10);

      expect(result.eloChangeA).toBe(0);
      expect(result.eloChangeB).toBe(0);
    });

    it('should give small change for draw with rating difference', () => {
      // Higher rated player draws lower rated - small loss for higher
      const result = calculateEloChange(1800, 1500, 0.5, 30, 30);

      // Expected for 1800 is ~0.85, actual is 0.5
      // Change = 24 * (0.5 - 0.85) = -8.4 ≈ -8
      expect(result.eloChangeA).toBeLessThan(0);
      expect(result.eloChangeB).toBeGreaterThan(0);
    });

    it('should handle draw correctly for unequal players', () => {
      const result = calculateEloChange(1600, 1400, 0.5, 30, 30);

      // Expected for 1600 vs 1400: ~0.76
      // Change = 24 * (0.5 - 0.76) = -6.24 ≈ -6
      expect(result.eloChangeA).toBe(-6);
      expect(result.eloChangeB).toBe(6);
    });
  });

  describe('Edge cases', () => {
    it('should handle same rating correctly', () => {
      const result = calculateEloChange(1500, 1500, 1, 30, 30);

      expect(result.eloChangeA).toBe(12);
      expect(result.eloChangeB).toBe(-12);
    });

    it('should handle extreme rating difference', () => {
      const result = calculateEloChange(100, 3000, 1, 30, 30);

      // Even extreme underdog winning should cap at K
      expect(result.eloChangeA).toBeLessThanOrEqual(24);
    });

    it('should handle very high ELO correctly', () => {
      const result = calculateEloChange(3000, 3000, 1, 100, 100);

      // Even at very high ELO, same rating should give equal change
      expect(result.eloChangeA).toBe(8); // K=16 * 0.5
    });

    it('should maintain ELO sum (zero-sum system)', () => {
      const result = calculateEloChange(1500, 1500, 1, 30, 30);

      // In a zero-sum system, gains + losses should sum to 0
      expect(result.eloChangeA + result.eloChangeB).toBe(0);
    });
  });
});
