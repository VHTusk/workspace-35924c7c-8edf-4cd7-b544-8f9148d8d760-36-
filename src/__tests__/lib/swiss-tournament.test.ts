import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Swiss Tournament Format Tests
 * 
 * Swiss tournament format:
 * - Players are paired with opponents who have similar win/loss records
 * - No elimination; all players play all rounds
 * - Players cannot face the same opponent twice
 * - Winner is determined by wins, then tiebreakers (Buchholz, Sonneborn-Berger)
 */

// Types
interface SwissPlayer {
  id: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  opponents: string[]; // IDs of previous opponents
  buchholz: number; // Sum of opponents' scores
  sonnebornBerger: number; // Weighted score based on opponents' performance
}

interface SwissPairing {
  playerA: string;
  playerB: string;
  round: number;
}

interface SwissRoundResult {
  pairings: SwissPairing[];
  byes: string[]; // Players who got a bye (odd number of players)
}

// Swiss tournament logic
function calculateScore(player: SwissPlayer): number {
  return player.wins + (player.draws * 0.5);
}

function calculateBuchholz(player: SwissPlayer, allPlayers: SwissPlayer[]): number {
  return player.opponents.reduce((sum, oppId) => {
    const opponent = allPlayers.find(p => p.id === oppId);
    return sum + (opponent ? calculateScore(opponent) : 0);
  }, 0);
}

function calculateSonnebornBerger(player: SwissPlayer, allPlayers: SwissPlayer[]): number {
  return player.opponents.reduce((sum, oppId) => {
    const opponent = allPlayers.find(p => p.id === oppId);
    if (!opponent) return sum;
    
    const opponentScore = calculateScore(opponent);
    // Add score for wins, half for draws
    // This is a simplified calculation
    return sum + opponentScore;
  }, 0);
}

function canPair(playerA: SwissPlayer, playerB: SwissPlayer): boolean {
  // Players cannot have faced each other before
  return !playerA.opponents.includes(playerB.id) && !playerB.opponents.includes(playerA.id);
}

function generateSwissPairings(
  players: SwissPlayer[],
  round: number
): SwissRoundResult {
  // Sort players by score, then rating
  const sortedPlayers = [...players].sort((a, b) => {
    const scoreDiff = calculateScore(b) - calculateScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return b.rating - a.rating;
  });
  
  const pairings: SwissPairing[] = [];
  const byes: string[] = [];
  const paired = new Set<string>();
  
  // Handle odd number of players
  if (sortedPlayers.length % 2 !== 0) {
    // Give bye to lowest-score player who hasn't had a bye
    const byeCandidate = sortedPlayers[sortedPlayers.length - 1];
    byes.push(byeCandidate.id);
    paired.add(byeCandidate.id);
  }
  
  // Pair players from top to bottom
  for (const player of sortedPlayers) {
    if (paired.has(player.id)) continue;
    
    // Find best opponent with same/similar score who hasn't been paired
    let bestOpponent: SwissPlayer | null = null;
    let bestScoreDiff = Infinity;
    
    for (const opponent of sortedPlayers) {
      if (paired.has(opponent.id)) continue;
      if (opponent.id === player.id) continue;
      if (!canPair(player, opponent)) continue;
      
      const scoreDiff = Math.abs(calculateScore(player) - calculateScore(opponent));
      
      // Prefer opponents with same score, then closest score
      if (scoreDiff < bestScoreDiff) {
        bestScoreDiff = scoreDiff;
        bestOpponent = opponent;
      }
    }
    
    if (bestOpponent) {
      pairings.push({
        playerA: player.id,
        playerB: bestOpponent.id,
        round,
      });
      paired.add(player.id);
      paired.add(bestOpponent.id);
    }
  }
  
  return { pairings, byes };
}

function determineSwissWinner(players: SwissPlayer[]): SwissPlayer[] {
  // Sort by score, then Buchholz, then Sonneborn-Berger
  return [...players].sort((a, b) => {
    const scoreDiff = calculateScore(b) - calculateScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    
    const buchholzDiff = b.buchholz - a.buchholz;
    if (buchholzDiff !== 0) return buchholzDiff;
    
    return b.sonnebornBerger - a.sonnebornBerger;
  });
}

describe('Swiss Tournament Format', () => {
  let players: SwissPlayer[];

  beforeEach(() => {
    players = [
      { id: 'p1', name: 'Alice', rating: 1800, wins: 0, losses: 0, draws: 0, opponents: [], buchholz: 0, sonnebornBerger: 0 },
      { id: 'p2', name: 'Bob', rating: 1750, wins: 0, losses: 0, draws: 0, opponents: [], buchholz: 0, sonnebornBerger: 0 },
      { id: 'p3', name: 'Charlie', rating: 1700, wins: 0, losses: 0, draws: 0, opponents: [], buchholz: 0, sonnebornBerger: 0 },
      { id: 'p4', name: 'Diana', rating: 1650, wins: 0, losses: 0, draws: 0, opponents: [], buchholz: 0, sonnebornBerger: 0 },
      { id: 'p5', name: 'Eve', rating: 1600, wins: 0, losses: 0, draws: 0, opponents: [], buchholz: 0, sonnebornBerger: 0 },
      { id: 'p6', name: 'Frank', rating: 1550, wins: 0, losses: 0, draws: 0, opponents: [], buchholz: 0, sonnebornBerger: 0 },
      { id: 'p7', name: 'Grace', rating: 1500, wins: 0, losses: 0, draws: 0, opponents: [], buchholz: 0, sonnebornBerger: 0 },
      { id: 'p8', name: 'Henry', rating: 1450, wins: 0, losses: 0, draws: 0, opponents: [], buchholz: 0, sonnebornBerger: 0 },
    ];
  });

  describe('Score Calculation', () => {
    it('should calculate correct score for wins and draws', () => {
      const player: SwissPlayer = {
        id: 'p1', name: 'Test', rating: 1500,
        wins: 3, losses: 1, draws: 2, opponents: [],
        buchholz: 0, sonnebornBerger: 0,
      };
      
      // Score = wins + 0.5 * draws
      expect(calculateScore(player)).toBe(4); // 3 + 1
    });

    it('should handle all wins', () => {
      const player: SwissPlayer = {
        id: 'p1', name: 'Test', rating: 1500,
        wins: 5, losses: 0, draws: 0, opponents: [],
        buchholz: 0, sonnebornBerger: 0,
      };
      
      expect(calculateScore(player)).toBe(5);
    });

    it('should handle all losses', () => {
      const player: SwissPlayer = {
        id: 'p1', name: 'Test', rating: 1500,
        wins: 0, losses: 5, draws: 0, opponents: [],
        buchholz: 0, sonnebornBerger: 0,
      };
      
      expect(calculateScore(player)).toBe(0);
    });
  });

  describe('First Round Pairings', () => {
    it('should pair top half vs bottom half', () => {
      const result = generateSwissPairings(players, 1);
      
      expect(result.pairings.length).toBe(4);
      expect(result.byes.length).toBe(0);
      
      // Top rated (Alice) should play bottom rated (Henry)
      const alicePairing = result.pairings.find(p => p.playerA === 'p1' || p.playerB === 'p1');
      expect(alicePairing).toBeDefined();
      expect(['p1', 'p8']).toContain(alicePairing!.playerA);
      expect(['p1', 'p8']).toContain(alicePairing!.playerB);
    });

    it('should create correct number of pairings', () => {
      const result = generateSwissPairings(players, 1);
      
      // 8 players = 4 pairings, 0 byes
      expect(result.pairings.length).toBe(4);
      expect(result.byes.length).toBe(0);
    });

    it('should handle odd number of players with bye', () => {
      // Remove one player for odd count
      const oddPlayers = players.slice(0, 7);
      const result = generateSwissPairings(oddPlayers, 1);
      
      // 7 players = 3 pairings + 1 bye
      expect(result.pairings.length).toBe(3);
      expect(result.byes.length).toBe(1);
      
      // Bye should go to lowest rated player
      expect(result.byes[0]).toBe('p7'); // Grace has lowest rating
    });
  });

  describe('Subsequent Round Pairings', () => {
    it('should pair players with same scores', () => {
      // Simulate round 1 results
      // Alice beats Henry, Bob beats Grace, Charlie beats Frank, Diana beats Eve
      players[0].wins = 1; players[0].opponents = ['p8']; // Alice
      players[1].wins = 1; players[1].opponents = ['p7']; // Bob
      players[2].wins = 1; players[2].opponents = ['p6']; // Charlie
      players[3].wins = 1; players[3].opponents = ['p5']; // Diana
      players[4].losses = 1; players[4].opponents = ['p4']; // Eve
      players[5].losses = 1; players[5].opponents = ['p3']; // Frank
      players[6].losses = 1; players[6].opponents = ['p2']; // Grace
      players[7].losses = 1; players[7].opponents = ['p1']; // Henry
      
      const result = generateSwissPairings(players, 2);
      
      // Winners should be paired together
      const winnersPairing = result.pairings.find(p => 
        (p.playerA === 'p1' && p.playerB === 'p2') ||
        (p.playerA === 'p2' && p.playerB === 'p1') ||
        (p.playerA === 'p1' && ['p2', 'p3', 'p4'].includes(p.playerB)) ||
        (p.playerA === 'p2' && ['p1', 'p3', 'p4'].includes(p.playerB))
      );
      
      expect(winnersPairing).toBeDefined();
    });

    it('should prevent rematches', () => {
      // Set up previous matchups
      players[0].opponents = ['p8'];
      players[7].opponents = ['p1'];
      
      const canPairResult = canPair(players[0], players[7]);
      
      expect(canPairResult).toBe(false);
    });

    it('should allow new matchups', () => {
      // Alice hasn't played Bob
      const canPairResult = canPair(players[0], players[1]);
      
      expect(canPairResult).toBe(true);
    });
  });

  describe('Tiebreakers', () => {
    it('should calculate Buchholz score', () => {
      // Setup opponents with different scores
      const testPlayer: SwissPlayer = {
        id: 'p1', name: 'Test', rating: 1500,
        wins: 2, losses: 0, draws: 0, opponents: ['p2', 'p3'],
        buchholz: 0, sonnebornBerger: 0,
      };
      
      const allPlayers: SwissPlayer[] = [
        testPlayer,
        { id: 'p2', name: 'Opp1', rating: 1500, wins: 2, losses: 0, draws: 0, opponents: [], buchholz: 0, sonnebornBerger: 0 },
        { id: 'p3', name: 'Opp2', rating: 1500, wins: 1, losses: 1, draw: 0, draws: 0, opponents: [], buchholz: 0, sonnebornBerger: 0 },
      ];
      
      const buchholz = calculateBuchholz(testPlayer, allPlayers);
      
      // Buchholz = sum of opponents' scores = 2 + 1 = 3
      expect(buchholz).toBe(3);
    });

    it('should rank players by Buchholz on tie', () => {
      const tiedPlayers: SwissPlayer[] = [
        { id: 'p1', name: 'Alice', rating: 1800, wins: 3, losses: 0, draws: 0, opponents: ['p2', 'p3', 'p4'], buchholz: 6, sonnebornBerger: 0 },
        { id: 'p2', name: 'Bob', rating: 1750, wins: 3, losses: 0, draws: 0, opponents: ['p1', 'p3', 'p5'], buchholz: 5, sonnebornBerger: 0 },
        { id: 'p3', name: 'Charlie', rating: 1700, wins: 3, losses: 0, draws: 0, opponents: ['p1', 'p2', 'p6'], buchholz: 7, sonnebornBerger: 0 },
      ];
      
      const ranked = determineSwissWinner(tiedPlayers);
      
      // Charlie should win due to highest Buchholz
      expect(ranked[0].id).toBe('p3');
      expect(ranked[1].id).toBe('p1');
      expect(ranked[2].id).toBe('p2');
    });
  });

  describe('Complete Tournament Simulation', () => {
    it('should simulate 4-round Swiss tournament', () => {
      // Round 1
      const r1 = generateSwissPairings(players, 1);
      expect(r1.pairings.length).toBe(4);
      
      // Simulate round 1 results
      r1.pairings.forEach(pairing => {
        const playerA = players.find(p => p.id === pairing.playerA)!;
        const playerB = players.find(p => p.id === pairing.playerB)!;
        
        // Higher rated wins
        if (playerA.rating > playerB.rating) {
          playerA.wins++;
          playerB.losses++;
        } else {
          playerB.wins++;
          playerA.losses++;
        }
        
        playerA.opponents.push(playerB.id);
        playerB.opponents.push(playerA.id);
      });
      
      // Verify all players have 1 match
      players.forEach(p => {
        expect(p.wins + p.losses).toBe(1);
      });
      
      // Round 2
      const r2 = generateSwissPairings(players, 2);
      expect(r2.pairings.length).toBe(4);
      
      // Verify no rematches
      r2.pairings.forEach(pairing => {
        const playerA = players.find(p => p.id === pairing.playerA)!;
        const playerB = players.find(p => p.id === pairing.playerB)!;
        
        expect(playerA.opponents).not.toContain(pairing.playerB);
        expect(playerB.opponents).not.toContain(pairing.playerA);
      });
    });

    it('should handle draw results correctly', () => {
      const player: SwissPlayer = {
        id: 'p1', name: 'Test', rating: 1500,
        wins: 2, losses: 1, draws: 2, opponents: [],
        buchholz: 0, sonnebornBerger: 0,
      };
      
      // Score = 2 wins + 1 draw = 2.5
      expect(calculateScore(player)).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle 2-player Swiss', () => {
      const twoPlayers = players.slice(0, 2);
      const result = generateSwissPairings(twoPlayers, 1);
      
      expect(result.pairings.length).toBe(1);
      expect(result.byes.length).toBe(0);
    });

    it('should handle 3-player Swiss with bye', () => {
      const threePlayers = players.slice(0, 3);
      const result = generateSwissPairings(threePlayers, 1);
      
      expect(result.pairings.length).toBe(1);
      expect(result.byes.length).toBe(1);
    });

    it('should handle all players with same score', () => {
      // Everyone is 0-0 (round 1 scenario)
      const result = generateSwissPairings(players, 1);
      
      // Should still pair all players
      const pairedPlayers = new Set<string>();
      result.pairings.forEach(p => {
        pairedPlayers.add(p.playerA);
        pairedPlayers.add(p.playerB);
      });
      
      expect(pairedPlayers.size).toBe(8);
    });
  });

  describe('Performance', () => {
    it('should handle 32 players efficiently', () => {
      const largeField: SwissPlayer[] = Array.from({ length: 32 }, (_, i) => ({
        id: `p${i + 1}`,
        name: `Player ${i + 1}`,
        rating: 1800 - i * 20,
        wins: 0,
        losses: 0,
        draws: 0,
        opponents: [],
        buchholz: 0,
        sonnebornBerger: 0,
      }));
      
      const startTime = performance.now();
      const result = generateSwissPairings(largeField, 1);
      const duration = performance.now() - startTime;
      
      expect(result.pairings.length).toBe(16);
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
    });
  });
});
