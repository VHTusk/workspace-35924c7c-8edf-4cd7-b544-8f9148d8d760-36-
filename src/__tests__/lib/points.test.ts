import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Points Calculation Tests
 * 
 * Tests for:
 * - Points by tournament scope (City/District/State/National)
 * - Win vs participation points
 * - Placement bonus points
 */

// Points configuration based on tournament scope
const POINTS_CONFIG = {
  // Scope multipliers
  SCOPE_MULTIPLIERS: {
    CITY: 1,
    DISTRICT: 1.5,
    STATE: 2,
    NATIONAL: 3,
  },
  
  // Base points
  WIN_POINTS: 4,
  PARTICIPATION_POINTS: 2,
  
  // Placement bonus (position -> bonus multiplier)
  PLACEMENT_BONUS: {
    1: 50,  // 1st place: 50% bonus
    2: 30,  // 2nd place: 30% bonus
    3: 15,  // 3rd place: 15% bonus
    4: 10,  // 4th place: 10% bonus
  },
} as const;

type TournamentScope = keyof typeof POINTS_CONFIG.SCOPE_MULTIPLIERS;

/**
 * Calculate points for a match result
 */
function calculateMatchPoints(
  scope: TournamentScope,
  won: boolean
): number {
  const multiplier = POINTS_CONFIG.SCOPE_MULTIPLIERS[scope];
  const basePoints = won ? POINTS_CONFIG.WIN_POINTS : POINTS_CONFIG.PARTICIPATION_POINTS;
  return Math.round(basePoints * multiplier);
}

/**
 * Calculate placement bonus points
 */
function calculatePlacementBonus(
  scope: TournamentScope,
  placement: number
): number {
  const multiplier = POINTS_CONFIG.SCOPE_MULTIPLIERS[scope];
  const bonusPercent = POINTS_CONFIG.PLACEMENT_BONUS[placement as keyof typeof POINTS_CONFIG.PLACEMENT_BONUS];
  
  if (!bonusPercent) return 0;
  
  // Base tournament points (assuming average 3 wins)
  const baseTournamentPoints = calculateMatchPoints(scope, true) * 3;
  
  return Math.round(baseTournamentPoints * (bonusPercent / 100));
}

/**
 * Calculate total tournament points
 */
function calculateTournamentPoints(
  scope: TournamentScope,
  wins: number,
  losses: number,
  placement?: number
): { matchPoints: number; placementBonus: number; total: number } {
  const matchPoints = (wins * calculateMatchPoints(scope, true)) + 
                      (losses * calculateMatchPoints(scope, false));
  
  const placementBonus = placement ? calculatePlacementBonus(scope, placement) : 0;
  
  return {
    matchPoints,
    placementBonus,
    total: matchPoints + placementBonus,
  };
}

describe('Points Calculation', () => {
  describe('Points by Tournament Scope', () => {
    it('should award correct points for CITY scope', () => {
      const winPoints = calculateMatchPoints('CITY', true);
      const participationPoints = calculateMatchPoints('CITY', false);
      
      expect(winPoints).toBe(4);   // 4 * 1
      expect(participationPoints).toBe(2); // 2 * 1
    });

    it('should award correct points for DISTRICT scope', () => {
      const winPoints = calculateMatchPoints('DISTRICT', true);
      const participationPoints = calculateMatchPoints('DISTRICT', false);
      
      expect(winPoints).toBe(6);   // 4 * 1.5 = 6
      expect(participationPoints).toBe(3); // 2 * 1.5 = 3
    });

    it('should award correct points for STATE scope', () => {
      const winPoints = calculateMatchPoints('STATE', true);
      const participationPoints = calculateMatchPoints('STATE', false);
      
      expect(winPoints).toBe(8);   // 4 * 2 = 8
      expect(participationPoints).toBe(4); // 2 * 2 = 4
    });

    it('should award correct points for NATIONAL scope', () => {
      const winPoints = calculateMatchPoints('NATIONAL', true);
      const participationPoints = calculateMatchPoints('NATIONAL', false);
      
      expect(winPoints).toBe(12);   // 4 * 3 = 12
      expect(participationPoints).toBe(6); // 2 * 3 = 6
    });

    it('should scale points proportionally by scope', () => {
      const cityWin = calculateMatchPoints('CITY', true);
      const districtWin = calculateMatchPoints('DISTRICT', true);
      const stateWin = calculateMatchPoints('STATE', true);
      const nationalWin = calculateMatchPoints('NATIONAL', true);
      
      // District should be 1.5x City
      expect(districtWin / cityWin).toBe(1.5);
      
      // State should be 2x City
      expect(stateWin / cityWin).toBe(2);
      
      // National should be 3x City
      expect(nationalWin / cityWin).toBe(3);
    });
  });

  describe('Win vs Participation Points', () => {
    it('should give double points for win vs participation', () => {
      const cityWin = calculateMatchPoints('CITY', true);
      const cityLoss = calculateMatchPoints('CITY', false);
      
      expect(cityWin).toBe(cityLoss * 2);
    });

    it('should give win points even for close loss', () => {
      // In this system, only win/loss matters, not score differential
      const participationPoints = calculateMatchPoints('STATE', false);
      
      // Even close losses get participation points
      expect(participationPoints).toBe(4);
    });

    it('should calculate points for tournament with mixed results', () => {
      const result = calculateTournamentPoints('STATE', 3, 2);
      
      // 3 wins * 8 = 24, 2 losses * 4 = 8
      expect(result.matchPoints).toBe(32);
      expect(result.placementBonus).toBe(0);
      expect(result.total).toBe(32);
    });
  });

  describe('Placement Bonus Points', () => {
    it('should award 50% bonus for 1st place', () => {
      const bonus = calculatePlacementBonus('CITY', 1);
      
      // Base tournament points (3 wins * 4) = 12
      // 50% bonus = 6
      expect(bonus).toBe(6);
    });

    it('should award 30% bonus for 2nd place', () => {
      const bonus = calculatePlacementBonus('CITY', 2);
      
      // Base tournament points (3 wins * 4) = 12
      // 30% bonus = 3.6 ≈ 4
      expect(bonus).toBe(4);
    });

    it('should award 15% bonus for 3rd place', () => {
      const bonus = calculatePlacementBonus('CITY', 3);
      
      // Base tournament points = 12
      // 15% bonus = 1.8 ≈ 2
      expect(bonus).toBe(2);
    });

    it('should award 10% bonus for 4th place', () => {
      const bonus = calculatePlacementBonus('CITY', 4);
      
      // Base tournament points = 12
      // 10% bonus = 1.2 ≈ 1
      expect(bonus).toBe(1);
    });

    it('should not award bonus for 5th place and below', () => {
      const bonus = calculatePlacementBonus('CITY', 5);
      expect(bonus).toBe(0);
      
      const bonus10 = calculatePlacementBonus('CITY', 10);
      expect(bonus10).toBe(0);
    });

    it('should scale placement bonus by scope', () => {
      const cityBonus = calculatePlacementBonus('CITY', 1);
      const stateBonus = calculatePlacementBonus('STATE', 1);
      const nationalBonus = calculatePlacementBonus('NATIONAL', 1);
      
      // State bonus should be 2x city bonus
      expect(stateBonus).toBe(cityBonus * 2);
      
      // National bonus should be 3x city bonus
      expect(nationalBonus).toBe(cityBonus * 3);
    });

    it('should calculate total tournament points with placement', () => {
      // Winner of a CITY tournament with 4 wins, 0 losses
      const result = calculateTournamentPoints('CITY', 4, 0, 1);
      
      // Match points: 4 wins * 4 = 16
      // Placement bonus (1st): 50% of 12 = 6
      expect(result.matchPoints).toBe(16);
      expect(result.placementBonus).toBe(6);
      expect(result.total).toBe(22);
    });
  });

  describe('Full Tournament Scenarios', () => {
    it('should calculate points for CITY tournament winner', () => {
      // 8-player single elimination, winner plays 3 matches
      const result = calculateTournamentPoints('CITY', 3, 0, 1);
      
      // 3 wins * 4 = 12
      // 1st place bonus: 6
      expect(result.total).toBe(18);
    });

    it('should calculate points for STATE tournament runner-up', () => {
      // Runner-up: 2 wins, 1 loss, 2nd place
      const result = calculateTournamentPoints('STATE', 2, 1, 2);
      
      // Match points: 2 wins * 8 + 1 loss * 4 = 20
      // 2nd place bonus: 30% of 24 = 7.2 ≈ 7
      expect(result.matchPoints).toBe(20);
      expect(result.placementBonus).toBe(7);
      expect(result.total).toBe(27);
    });

    it('should calculate points for NATIONAL tournament participant', () => {
      // First round exit: 0 wins, 1 loss
      const result = calculateTournamentPoints('NATIONAL', 0, 1);
      
      // Only participation points: 6
      expect(result.total).toBe(6);
    });

    it('should calculate points for DISTRICT semi-finalist', () => {
      // 2 wins, 1 loss (in semis), 3rd or 4th place
      const result = calculateTournamentPoints('DISTRICT', 2, 1, 3);
      
      // Match points: 2 * 6 + 1 * 3 = 15
      // 3rd place bonus: 15% of 18 = 2.7 ≈ 3
      expect(result.matchPoints).toBe(15);
      expect(result.placementBonus).toBe(3);
      expect(result.total).toBe(18);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero wins gracefully', () => {
      const result = calculateTournamentPoints('CITY', 0, 3);
      
      // Only participation points
      expect(result.matchPoints).toBe(6); // 3 * 2
      expect(result.placementBonus).toBe(0);
    });

    it('should handle all wins gracefully', () => {
      const result = calculateTournamentPoints('NATIONAL', 5, 0, 1);
      
      // All wins + 1st place bonus
      expect(result.matchPoints).toBe(60); // 5 * 12
      expect(result.placementBonus).toBeGreaterThan(0);
    });

    it('should not give negative points', () => {
      const lossPoints = calculateMatchPoints('CITY', false);
      expect(lossPoints).toBeGreaterThanOrEqual(0);
    });

    it('should round points correctly', () => {
      // District uses 1.5 multiplier
      const winPoints = calculateMatchPoints('DISTRICT', true);
      
      // 4 * 1.5 = 6 (exact)
      expect(winPoints).toBe(6);
      
      const lossPoints = calculateMatchPoints('DISTRICT', false);
      // 2 * 1.5 = 3 (exact)
      expect(lossPoints).toBe(3);
    });
  });

  describe('Points Leaderboard Impact', () => {
    it('should show cumulative points across tournaments', () => {
      // Player participates in 3 tournaments
      const t1 = calculateTournamentPoints('CITY', 3, 0, 1); // Winner
      const t2 = calculateTournamentPoints('DISTRICT', 2, 1, 3); // Semi-finalist
      const t3 = calculateTournamentPoints('STATE', 1, 1); // Quarter-final exit
      
      const totalPoints = t1.total + t2.total + t3.total;
      
      // 18 (CITY win) + 18 (DISTRICT semi) + 12 (STATE quarter)
      expect(totalPoints).toBe(48);
    });

    it('should reward higher scope tournaments appropriately', () => {
      // Winning a NATIONAL tournament should be worth more than winning multiple CITY tournaments
      const nationalWin = calculateTournamentPoints('NATIONAL', 4, 0, 1);
      
      const cityWin1 = calculateTournamentPoints('CITY', 3, 0, 1);
      const cityWin2 = calculateTournamentPoints('CITY', 3, 0, 1);
      
      // National win should be comparable to ~2 city wins
      expect(nationalWin.total).toBeGreaterThan(cityWin1.total);
      // 4 wins national: 48 + 18 bonus = 66
      // 1 city win: 12 + 6 bonus = 18
      // 2 city wins: 36
      expect(nationalWin.total).toBeGreaterThan(cityWin1.total + cityWin2.total);
    });
  });
});
