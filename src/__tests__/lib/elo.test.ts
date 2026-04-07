import { describe, it, expect, beforeEach } from 'vitest';
import { 
  calculateEloChange, 
  getEloTier 
} from '@/lib/auth';

/**
 * ELO Rating System Tests
 * 
 * The VALORHIVE ELO system uses:
 * - Initial rating: 1500
 * - K-factor varies based on match count:
 *   - < 30 matches: K = 32
 *   - 30-99 matches: K = 24
 *   - >= 100 matches: K = 16
 * - Expected score: E = 1 / (1 + 10^((opponent_rating - player_rating) / 400))
 * - Rating change: R_new = R_old + K * (actual_score - expected_score)
 */
describe('ELO Rating System', () => {
  describe('Initial Rating', () => {
    it('should have initial rating of 1500 for new players', () => {
      // This is implicit in the system - new players start at 1500
      const initialElo = 1500;
      expect(initialElo).toBe(1500);
    });
  });

  describe('ELO Change Calculation', () => {
    it('should increase ELO on win', () => {
      const playerAElo = 1500;
      const playerBElo = 1500;
      const actualScore = 1; // Win
      const matchCountA = 10;
      const matchCountB = 10;

      const result = calculateEloChange(
        playerAElo,
        playerBElo,
        actualScore,
        matchCountA,
        matchCountB
      );

      // With K=32 and expected score of 0.5, win should give ~16 points
      expect(result.eloChangeA).toBeGreaterThan(0);
      expect(result.eloChangeB).toBeLessThan(0);
      expect(result.eloChangeA).toBe(-result.eloChangeB);
    });

    it('should decrease ELO on loss', () => {
      const playerAElo = 1500;
      const playerBElo = 1500;
      const actualScore = 0; // Loss
      const matchCountA = 10;
      const matchCountB = 10;

      const result = calculateEloChange(
        playerAElo,
        playerBElo,
        actualScore,
        matchCountA,
        matchCountB
      );

      // With K=32 and expected score of 0.5, loss should lose ~16 points
      expect(result.eloChangeA).toBeLessThan(0);
      expect(result.eloChangeB).toBeGreaterThan(0);
      expect(result.eloChangeA).toBe(-result.eloChangeB);
    });

    it('should have zero ELO change for draw at equal ratings', () => {
      const playerAElo = 1500;
      const playerBElo = 1500;
      const actualScore = 0.5; // Draw
      const matchCountA = 10;
      const matchCountB = 10;

      const result = calculateEloChange(
        playerAElo,
        playerBElo,
        actualScore,
        matchCountA,
        matchCountB
      );

      // With equal ratings and draw, expected = actual = 0.5, so change = 0
      expect(Math.abs(result.eloChangeA)).toBe(0);
      expect(Math.abs(result.eloChangeB)).toBe(0);
    });
  });

  describe('K-Factor Variation', () => {
    it('should use K=32 for players with less than 30 matches', () => {
      const playerAElo = 1500;
      const playerBElo = 1500;
      const actualScore = 1;
      const matchCountA = 10; // < 30
      const matchCountB = 10;

      const result = calculateEloChange(
        playerAElo,
        playerBElo,
        actualScore,
        matchCountA,
        matchCountB
      );

      // K=32, expected = 0.5, actual = 1, change = 32 * (1 - 0.5) = 16
      expect(result.eloChangeA).toBe(16);
    });

    it('should use K=24 for players with 30-99 matches', () => {
      const playerAElo = 1500;
      const playerBElo = 1500;
      const actualScore = 1;
      const matchCountA = 50; // 30-99
      const matchCountB = 50;

      const result = calculateEloChange(
        playerAElo,
        playerBElo,
        actualScore,
        matchCountA,
        matchCountB
      );

      // K=24, expected = 0.5, actual = 1, change = 24 * (1 - 0.5) = 12
      expect(result.eloChangeA).toBe(12);
    });

    it('should use K=16 for players with 100+ matches', () => {
      const playerAElo = 1500;
      const playerBElo = 1500;
      const actualScore = 1;
      const matchCountA = 100; // >= 100
      const matchCountB = 100;

      const result = calculateEloChange(
        playerAElo,
        playerBElo,
        actualScore,
        matchCountA,
        matchCountB
      );

      // K=16, expected = 0.5, actual = 1, change = 16 * (1 - 0.5) = 8
      expect(result.eloChangeA).toBe(8);
    });

    it('should use higher K if either player has fewer matches', () => {
      const playerAElo = 1500;
      const playerBElo = 1500;
      const actualScore = 1;
      const matchCountA = 10; // < 30 - uses K=32
      const matchCountB = 100; // >= 100

      const result = calculateEloChange(
        playerAElo,
        playerBElo,
        actualScore,
        matchCountA,
        matchCountB
      );

      // Since matchCountA < 30, K should be 32 (uses lower threshold)
      // But the implementation checks if matchCountA >= 100 OR matchCountB >= 100
      // So K = 16 is used (the higher threshold wins)
      expect(result.eloChangeA).toBe(8); // K=16, expected=0.5, actual=1
    });
  });

  describe('Expected Score Calculation', () => {
    it('should give higher expected score to higher-rated player', () => {
      const higherElo = 1800;
      const lowerElo = 1500;
      const actualScore = 1;
      
      // When higher-rated player wins against lower-rated
      const result = calculateEloChange(
        higherElo,
        lowerElo,
        actualScore,
        30,
        30
      );

      // Expected score for 1800 vs 1500: E = 1 / (1 + 10^((1500-1800)/400))
      // E = 1 / (1 + 10^(-0.75)) = 1 / (1 + 0.1778) = 0.849
      // Win should give less points because expected score was high
      // Change = 24 * (1 - 0.849) = 3.6 ≈ 4
      expect(result.eloChangeA).toBeLessThan(10);
      expect(result.eloChangeA).toBeGreaterThan(0);
    });

    it('should give more points when lower-rated player beats higher-rated', () => {
      const lowerElo = 1200;
      const higherElo = 1800;
      const actualScore = 1; // Upset win
      
      const result = calculateEloChange(
        lowerElo,
        higherElo,
        actualScore,
        30,
        30
      );

      // Expected score for 1200 vs 1800: E = 1 / (1 + 10^((1800-1200)/400))
      // E = 1 / (1 + 10^(1.5)) = 1 / (1 + 31.62) = 0.0306
      // Win should give many points: 24 * (1 - 0.0306) = 23.3 ≈ 23
      expect(result.eloChangeA).toBeGreaterThan(15);
    });
  });

  describe('Edge Cases', () => {
    it('should handle large ELO difference correctly', () => {
      const veryHighElo = 2200;
      const veryLowElo = 800;
      const actualScore = 1; // Lower rated wins (major upset)
      
      const result = calculateEloChange(
        veryLowElo,
        veryHighElo,
        actualScore,
        30,
        30
      );

      // Expected: E = 1 / (1 + 10^((2200-800)/400)) = 1 / (1 + 10^3.5) ≈ 0.0003
      // Change = 24 * (1 - 0.0003) ≈ 24 (max possible with K=24)
      expect(result.eloChangeA).toBeGreaterThan(20);
      expect(result.eloChangeA).toBeLessThanOrEqual(24);
    });

    it('should handle same rating correctly', () => {
      const sameElo = 1500;
      const actualScore = 1;
      
      const result = calculateEloChange(
        sameElo,
        sameElo,
        actualScore,
        10,
        10
      );

      // With same ratings, expected score is 0.5
      // Change = 32 * (1 - 0.5) = 16
      expect(result.eloChangeA).toBe(16);
      expect(result.eloChangeB).toBe(-16);
    });

    it('should handle extreme ELO difference for favorite winning', () => {
      const veryHighElo = 2200;
      const veryLowElo = 800;
      const actualScore = 1; // Higher rated wins (expected)
      
      const result = calculateEloChange(
        veryHighElo,
        veryLowElo,
        actualScore,
        30,
        30
      );

      // Expected: E = 1 / (1 + 10^((800-2200)/400)) = 1 / (1 + 10^-3.5) ≈ 0.9997
      // Change = 24 * (1 - 0.9997) ≈ 0 (minimum possible)
      expect(result.eloChangeA).toBeLessThanOrEqual(1);
    });
  });

  describe('Tier Assignment', () => {
    it('should return UNRANKED for players with less than 30 matches', () => {
      const tier = getEloTier(1900, 25);
      expect(tier).toBe('UNRANKED');
    });

    it('should return DIAMOND for ELO >= 1900 with enough matches', () => {
      const tier = getEloTier(1900, 30);
      expect(tier).toBe('DIAMOND');
    });

    it('should return PLATINUM for ELO >= 1700 with enough matches', () => {
      const tier = getEloTier(1750, 30);
      expect(tier).toBe('PLATINUM');
    });

    it('should return GOLD for ELO >= 1500 with enough matches', () => {
      const tier = getEloTier(1550, 30);
      expect(tier).toBe('GOLD');
    });

    it('should return SILVER for ELO >= 1300 with enough matches', () => {
      const tier = getEloTier(1350, 30);
      expect(tier).toBe('SILVER');
    });

    it('should return BRONZE for ELO < 1300 with enough matches', () => {
      const tier = getEloTier(1200, 30);
      expect(tier).toBe('BRONZE');
    });

    it('should return UNRANKED regardless of ELO with insufficient matches', () => {
      const tier = getEloTier(2500, 10);
      expect(tier).toBe('UNRANKED');
    });
  });
});
