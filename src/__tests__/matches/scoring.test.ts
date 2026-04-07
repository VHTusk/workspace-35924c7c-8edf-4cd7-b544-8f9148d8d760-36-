/**
 * Match Scoring Tests
 *
 * Tests for:
 * - Record valid score
 * - Dispute submission
 * - Score correction by admin
 * - Points calculation by tournament scope
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================
// Types
// ============================================

interface MockMatch {
  id: string;
  tournamentId: string;
  playerAId: string;
  playerBId: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  status: string;
  outcome: string | null;
  submittedById: string | null;
  verificationStatus: string;
  disputedAt: Date | null;
  disputedById: string | null;
  disputeReason: string | null;
  resolvedAt: Date | null;
  resolvedById: string | null;
  resolutionNotes: string | null;
  pointsA: number | null;
  pointsB: number | null;
  tournamentScope: string;
}

interface MockUser {
  id: string;
  firstName: string;
  lastName: string;
  hiddenElo: number;
  visiblePoints: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
}

interface MockTournament {
  id: string;
  name: string;
  scope: string;
  status: string;
}

interface MockAuditLog {
  id: string;
  action: string;
  actorId: string;
  targetType: string;
  targetId: string;
  metadata: string | null;
  createdAt: Date;
}

// ============================================
// Constants
// ============================================

const MATCH_STATUS = {
  PENDING: 'PENDING',
  LIVE: 'LIVE',
  COMPLETED: 'COMPLETED',
  DISPUTED: 'DISPUTED',
} as const;

const VERIFICATION_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  DISPUTED: 'DISPUTED',
} as const;

const MATCH_OUTCOME = {
  PLAYED: 'PLAYED',
  WALKOVER: 'WALKOVER',
  NO_SHOW: 'NO_SHOW',
  FORFEIT: 'FORFEIT',
  BYE: 'BYE',
} as const;

const POINTS_CONFIG = {
  CITY: { win: 4, participation: 2 },
  DISTRICT: { win: 6, participation: 3 },
  STATE: { win: 8, participation: 4 },
  NATIONAL: { win: 12, participation: 6 },
} as const;

// ============================================
// Mock Storage
// ============================================

const mockMatches: Map<string, MockMatch> = new Map();
const mockUsers: Map<string, MockUser> = new Map();
const mockTournaments: Map<string, MockTournament> = new Map();
const mockAuditLogs: MockAuditLog[] = [];

// ============================================
// Helper Functions
// ============================================

function getPointsForScope(scope: string, won: boolean): number {
  const config = POINTS_CONFIG[scope as keyof typeof POINTS_CONFIG] || POINTS_CONFIG.CITY;
  return won ? config.win : config.participation;
}

function determineWinner(scoreA: number, scoreB: number): string | null {
  if (scoreA > scoreB) return 'A';
  if (scoreB > scoreA) return 'B';
  return null; // Draw
}

function createAuditLog(
  action: string,
  actorId: string,
  targetType: string,
  targetId: string,
  metadata?: string
): MockAuditLog {
  const log: MockAuditLog = {
    id: `audit-${Date.now()}`,
    action,
    actorId,
    targetType,
    targetId,
    metadata: metadata || null,
    createdAt: new Date(),
  };
  mockAuditLogs.push(log);
  return log;
}

// ============================================
// Main Functions
// ============================================

async function recordScore(
  matchId: string,
  submittedById: string,
  scoreA: number,
  scoreB: number
): Promise<{
  success: boolean;
  error?: string;
  status: number;
  match?: MockMatch;
}> {
  const match = mockMatches.get(matchId);
  const submitter = mockUsers.get(submittedById);

  if (!match) {
    return { success: false, error: 'Match not found', status: 404 };
  }

  if (!submitter) {
    return { success: false, error: 'Submitter not found', status: 404 };
  }

  // Check if user is a player in the match
  if (match.playerAId !== submittedById && match.playerBId !== submittedById) {
    return { success: false, error: 'Only match participants can submit scores', status: 403 };
  }

  // Validate scores
  if (scoreA < 0 || scoreB < 0) {
    return { success: false, error: 'Scores cannot be negative', status: 400 };
  }

  // Update match
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.submittedById = submittedById;
  match.verificationStatus = VERIFICATION_STATUS.PENDING;

  const winner = determineWinner(scoreA, scoreB);
  if (winner === 'A') {
    match.winnerId = match.playerAId;
  } else if (winner === 'B') {
    match.winnerId = match.playerBId;
  }

  mockMatches.set(matchId, match);

  createAuditLog('MATCH_RESULT_ENTERED', submittedById, 'MATCH', matchId, 
    JSON.stringify({ scoreA, scoreB, winnerId: match.winnerId }));

  return { success: true, status: 200, match };
}

async function submitDispute(
  matchId: string,
  disputedById: string,
  reason: string
): Promise<{
  success: boolean;
  error?: string;
  status: number;
  match?: MockMatch;
}> {
  const match = mockMatches.get(matchId);
  const disputer = mockUsers.get(disputedById);

  if (!match) {
    return { success: false, error: 'Match not found', status: 404 };
  }

  if (!disputer) {
    return { success: false, error: 'User not found', status: 404 };
  }

  // Check if user is a player in the match
  if (match.playerAId !== disputedById && match.playerBId !== disputedById) {
    return { success: false, error: 'Only match participants can dispute', status: 403 };
  }

  // Check if match has a score to dispute
  if (match.scoreA === null || match.scoreB === null) {
    return { success: false, error: 'No score to dispute', status: 400 };
  }

  // Check if already disputed
  if (match.verificationStatus === VERIFICATION_STATUS.DISPUTED) {
    return { success: false, error: 'Match already disputed', status: 400 };
  }

  // Update match to disputed status
  match.verificationStatus = VERIFICATION_STATUS.DISPUTED;
  match.disputedAt = new Date();
  match.disputedById = disputedById;
  match.disputeReason = reason;

  mockMatches.set(matchId, match);

  createAuditLog('MATCH_DISPUTED', disputedById, 'MATCH', matchId,
    JSON.stringify({ reason }));

  return { success: true, status: 200, match };
}

async function correctScore(
  matchId: string,
  adminId: string,
  newScoreA: number,
  newScoreB: number,
  notes: string
): Promise<{
  success: boolean;
  error?: string;
  status: number;
  match?: MockMatch;
}> {
  const match = mockMatches.get(matchId);
  const admin = mockUsers.get(adminId);

  if (!match) {
    return { success: false, error: 'Match not found', status: 404 };
  }

  if (!admin) {
    return { success: false, error: 'Admin not found', status: 404 };
  }

  // Validate new scores
  if (newScoreA < 0 || newScoreB < 0) {
    return { success: false, error: 'Scores cannot be negative', status: 400 };
  }

  // Store old values for audit
  const oldScoreA = match.scoreA;
  const oldScoreB = match.scoreB;
  const oldWinnerId = match.winnerId;

  // Update match
  match.scoreA = newScoreA;
  match.scoreB = newScoreB;
  match.verificationStatus = VERIFICATION_STATUS.VERIFIED;
  match.resolvedAt = new Date();
  match.resolvedById = adminId;
  match.resolutionNotes = notes;

  // Update winner
  const winner = determineWinner(newScoreA, newScoreB);
  if (winner === 'A') {
    match.winnerId = match.playerAId;
  } else if (winner === 'B') {
    match.winnerId = match.playerBId;
  } else {
    match.winnerId = null;
  }

  // Recalculate points
  match.pointsA = getPointsForScope(match.tournamentScope, match.winnerId === match.playerAId);
  match.pointsB = getPointsForScope(match.tournamentScope, match.winnerId === match.playerBId);

  mockMatches.set(matchId, match);

  createAuditLog('MATCH_RESULT_EDITED', adminId, 'MATCH', matchId,
    JSON.stringify({ 
      oldScoreA, oldScoreB, oldWinnerId,
      newScoreA, newScoreB, newWinnerId: match.winnerId,
      notes 
    }));

  return { success: true, status: 200, match };
}

function calculateMatchPoints(
  scope: string,
  winnerId: string | null,
  playerAId: string,
  playerBId: string
): { pointsA: number; pointsB: number } {
  const pointsA = getPointsForScope(scope, winnerId === playerAId);
  const pointsB = getPointsForScope(scope, winnerId === playerBId);

  return { pointsA, pointsB };
}

// ============================================
// Test Fixtures
// ============================================

function createTestMatch(overrides: Partial<MockMatch> = {}): MockMatch {
  return {
    id: `match-${Date.now()}`,
    tournamentId: 'tournament-1',
    playerAId: 'player-a',
    playerBId: 'player-b',
    scoreA: null,
    scoreB: null,
    winnerId: null,
    status: MATCH_STATUS.PENDING,
    outcome: null,
    submittedById: null,
    verificationStatus: VERIFICATION_STATUS.PENDING,
    disputedAt: null,
    disputedById: null,
    disputeReason: null,
    resolvedAt: null,
    resolvedById: null,
    resolutionNotes: null,
    pointsA: null,
    pointsB: null,
    tournamentScope: 'STATE',
    ...overrides,
  };
}

function createTestUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: `user-${Date.now()}`,
    firstName: 'John',
    lastName: 'Doe',
    hiddenElo: 1500,
    visiblePoints: 100,
    matchesPlayed: 10,
    wins: 5,
    losses: 5,
    ...overrides,
  };
}

function createTestTournament(overrides: Partial<MockTournament> = {}): MockTournament {
  return {
    id: `tournament-${Date.now()}`,
    name: 'Test Tournament',
    scope: 'STATE',
    status: 'IN_PROGRESS',
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('Match Scoring', () => {
  beforeEach(() => {
    mockMatches.clear();
    mockUsers.clear();
    mockTournaments.clear();
    mockAuditLogs.length = 0;
  });

  describe('Record valid score', () => {
    it('should record score for a match', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const playerB = createTestUser({ id: 'player-b' });
      const match = createTestMatch();

      mockUsers.set(playerA.id, playerA);
      mockUsers.set(playerB.id, playerB);
      mockMatches.set(match.id, match);

      const result = await recordScore(match.id, 'player-a', 21, 15);

      expect(result.success).toBe(true);
      expect(result.match?.scoreA).toBe(21);
      expect(result.match?.scoreB).toBe(15);
    });

    it('should correctly determine winner based on score', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const playerB = createTestUser({ id: 'player-b' });
      const match = createTestMatch();

      mockUsers.set(playerA.id, playerA);
      mockUsers.set(playerB.id, playerB);
      mockMatches.set(match.id, match);

      const result = await recordScore(match.id, 'player-a', 21, 15);

      expect(result.match?.winnerId).toBe('player-a');
    });

    it('should set verification status to pending', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const playerB = createTestUser({ id: 'player-b' });
      const match = createTestMatch();

      mockUsers.set(playerA.id, playerA);
      mockUsers.set(playerB.id, playerB);
      mockMatches.set(match.id, match);

      const result = await recordScore(match.id, 'player-a', 21, 15);

      expect(result.match?.verificationStatus).toBe(VERIFICATION_STATUS.PENDING);
    });

    it('should record who submitted the score', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const playerB = createTestUser({ id: 'player-b' });
      const match = createTestMatch();

      mockUsers.set(playerA.id, playerA);
      mockUsers.set(playerB.id, playerB);
      mockMatches.set(match.id, match);

      const result = await recordScore(match.id, 'player-a', 21, 15);

      expect(result.match?.submittedById).toBe('player-a');
    });

    it('should reject negative scores', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const match = createTestMatch();

      mockUsers.set(playerA.id, playerA);
      mockMatches.set(match.id, match);

      const result = await recordScore(match.id, 'player-a', -5, 15);

      expect(result.success).toBe(false);
      expect(result.error).toContain('negative');
    });

    it('should reject score submission from non-participants', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const nonParticipant = createTestUser({ id: 'non-participant' });
      const match = createTestMatch();

      mockUsers.set(playerA.id, playerA);
      mockUsers.set(nonParticipant.id, nonParticipant);
      mockMatches.set(match.id, match);

      const result = await recordScore(match.id, 'non-participant', 21, 15);

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });

    it('should create audit log for score submission', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const match = createTestMatch();

      mockUsers.set(playerA.id, playerA);
      mockMatches.set(match.id, match);

      await recordScore(match.id, 'player-a', 21, 15);

      expect(mockAuditLogs.length).toBe(1);
      expect(mockAuditLogs[0].action).toBe('MATCH_RESULT_ENTERED');
    });
  });

  describe('Dispute submission', () => {
    it('should allow player to dispute a score', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const playerB = createTestUser({ id: 'player-b' });
      const match = createTestMatch({
        scoreA: 21,
        scoreB: 15,
        winnerId: 'player-a',
      });

      mockUsers.set(playerA.id, playerA);
      mockUsers.set(playerB.id, playerB);
      mockMatches.set(match.id, match);

      const result = await submitDispute(match.id, 'player-b', 'Incorrect score reported');

      expect(result.success).toBe(true);
      expect(result.match?.verificationStatus).toBe(VERIFICATION_STATUS.DISPUTED);
    });

    it('should record dispute reason', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const playerB = createTestUser({ id: 'player-b' });
      const match = createTestMatch({
        scoreA: 21,
        scoreB: 15,
      });

      mockUsers.set(playerA.id, playerA);
      mockUsers.set(playerB.id, playerB);
      mockMatches.set(match.id, match);

      const result = await submitDispute(match.id, 'player-b', 'Opponent reported wrong score');

      expect(result.match?.disputeReason).toBe('Opponent reported wrong score');
    });

    it('should record who disputed', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const playerB = createTestUser({ id: 'player-b' });
      const match = createTestMatch({
        scoreA: 21,
        scoreB: 15,
      });

      mockUsers.set(playerA.id, playerA);
      mockUsers.set(playerB.id, playerB);
      mockMatches.set(match.id, match);

      await submitDispute(match.id, 'player-b', 'Test dispute');

      const updatedMatch = mockMatches.get(match.id);
      expect(updatedMatch?.disputedById).toBe('player-b');
      expect(updatedMatch?.disputedAt).toBeDefined();
    });

    it('should reject dispute from non-participants', async () => {
      const nonParticipant = createTestUser({ id: 'non-participant' });
      const match = createTestMatch({
        scoreA: 21,
        scoreB: 15,
      });

      mockUsers.set(nonParticipant.id, nonParticipant);
      mockMatches.set(match.id, match);

      const result = await submitDispute(match.id, 'non-participant', 'Test dispute');

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });

    it('should reject dispute for match without score', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const match = createTestMatch(); // No score set

      mockUsers.set(playerA.id, playerA);
      mockMatches.set(match.id, match);

      const result = await submitDispute(match.id, 'player-a', 'Test dispute');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No score');
    });

    it('should reject duplicate dispute', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const playerB = createTestUser({ id: 'player-b' });
      const match = createTestMatch({
        scoreA: 21,
        scoreB: 15,
        verificationStatus: VERIFICATION_STATUS.DISPUTED,
      });

      mockUsers.set(playerA.id, playerA);
      mockUsers.set(playerB.id, playerB);
      mockMatches.set(match.id, match);

      const result = await submitDispute(match.id, 'player-b', 'Test dispute');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already disputed');
    });

    it('should create audit log for dispute', async () => {
      const playerA = createTestUser({ id: 'player-a' });
      const playerB = createTestUser({ id: 'player-b' });
      const match = createTestMatch({
        scoreA: 21,
        scoreB: 15,
      });

      mockUsers.set(playerA.id, playerA);
      mockUsers.set(playerB.id, playerB);
      mockMatches.set(match.id, match);

      await submitDispute(match.id, 'player-b', 'Test dispute');

      expect(mockAuditLogs.some(log => log.action === 'MATCH_DISPUTED')).toBe(true);
    });
  });

  describe('Score correction by admin', () => {
    it('should allow admin to correct score', async () => {
      const admin = createTestUser({ id: 'admin' });
      const match = createTestMatch({
        scoreA: 21,
        scoreB: 15,
        verificationStatus: VERIFICATION_STATUS.DISPUTED,
      });

      mockUsers.set(admin.id, admin);
      mockMatches.set(match.id, match);

      const result = await correctScore(match.id, 'admin', 15, 21, 'Correction after dispute review');

      expect(result.success).toBe(true);
      expect(result.match?.scoreA).toBe(15);
      expect(result.match?.scoreB).toBe(21);
    });

    it('should update winner after correction', async () => {
      const admin = createTestUser({ id: 'admin' });
      const match = createTestMatch({
        scoreA: 21,
        scoreB: 15,
        winnerId: 'player-a',
      });

      mockUsers.set(admin.id, admin);
      mockMatches.set(match.id, match);

      const result = await correctScore(match.id, 'admin', 15, 21, 'Correcting score');

      expect(result.match?.winnerId).toBe('player-b');
    });

    it('should set verification status to verified', async () => {
      const admin = createTestUser({ id: 'admin' });
      const match = createTestMatch({
        scoreA: 21,
        scoreB: 15,
        verificationStatus: VERIFICATION_STATUS.DISPUTED,
      });

      mockUsers.set(admin.id, admin);
      mockMatches.set(match.id, match);

      const result = await correctScore(match.id, 'admin', 21, 15, 'Verified after review');

      expect(result.match?.verificationStatus).toBe(VERIFICATION_STATUS.VERIFIED);
    });

    it('should record resolution details', async () => {
      const admin = createTestUser({ id: 'admin' });
      const match = createTestMatch({
        scoreA: 21,
        scoreB: 15,
      });

      mockUsers.set(admin.id, admin);
      mockMatches.set(match.id, match);

      const result = await correctScore(match.id, 'admin', 21, 15, 'Resolution notes here');

      expect(result.match?.resolvedById).toBe('admin');
      expect(result.match?.resolvedAt).toBeDefined();
      expect(result.match?.resolutionNotes).toBe('Resolution notes here');
    });

    it('should create audit log for correction', async () => {
      const admin = createTestUser({ id: 'admin' });
      const match = createTestMatch({
        scoreA: 21,
        scoreB: 15,
      });

      mockUsers.set(admin.id, admin);
      mockMatches.set(match.id, match);

      await correctScore(match.id, 'admin', 15, 21, 'Correction');

      expect(mockAuditLogs.some(log => log.action === 'MATCH_RESULT_EDITED')).toBe(true);
    });

    it('should reject negative scores in correction', async () => {
      const admin = createTestUser({ id: 'admin' });
      const match = createTestMatch();

      mockUsers.set(admin.id, admin);
      mockMatches.set(match.id, match);

      const result = await correctScore(match.id, 'admin', -5, 21, 'Test');

      expect(result.success).toBe(false);
    });
  });

  describe('Points calculation by tournament scope', () => {
    it('should calculate CITY scope points correctly', () => {
      const result = calculateMatchPoints('CITY', 'player-a', 'player-a', 'player-b');

      expect(result.pointsA).toBe(4); // Win
      expect(result.pointsB).toBe(2); // Participation
    });

    it('should calculate DISTRICT scope points correctly', () => {
      const result = calculateMatchPoints('DISTRICT', 'player-a', 'player-a', 'player-b');

      expect(result.pointsA).toBe(6); // Win
      expect(result.pointsB).toBe(3); // Participation
    });

    it('should calculate STATE scope points correctly', () => {
      const result = calculateMatchPoints('STATE', 'player-a', 'player-a', 'player-b');

      expect(result.pointsA).toBe(8); // Win
      expect(result.pointsB).toBe(4); // Participation
    });

    it('should calculate NATIONAL scope points correctly', () => {
      const result = calculateMatchPoints('NATIONAL', 'player-a', 'player-a', 'player-b');

      expect(result.pointsA).toBe(12); // Win
      expect(result.pointsB).toBe(6); // Participation
    });

    it('should scale points proportionally by scope', () => {
      const cityWin = getPointsForScope('CITY', true);
      const districtWin = getPointsForScope('DISTRICT', true);
      const stateWin = getPointsForScope('STATE', true);
      const nationalWin = getPointsForScope('NATIONAL', true);

      // District should be 1.5x City
      expect(districtWin / cityWin).toBe(1.5);

      // State should be 2x City
      expect(stateWin / cityWin).toBe(2);

      // National should be 3x City
      expect(nationalWin / cityWin).toBe(3);
    });

    it('should give double points for win vs participation', () => {
      for (const scope of ['CITY', 'DISTRICT', 'STATE', 'NATIONAL'] as const) {
        const winPoints = getPointsForScope(scope, true);
        const participationPoints = getPointsForScope(scope, false);

        expect(winPoints).toBe(participationPoints * 2);
      }
    });

    it('should assign points to correct player based on winner', () => {
      const playerAWins = calculateMatchPoints('STATE', 'player-a', 'player-a', 'player-b');
      const playerBWins = calculateMatchPoints('STATE', 'player-b', 'player-a', 'player-b');

      expect(playerAWins.pointsA).toBe(8);
      expect(playerAWins.pointsB).toBe(4);

      expect(playerBWins.pointsA).toBe(4);
      expect(playerBWins.pointsB).toBe(8);
    });

    it('should update match points when score is corrected', async () => {
      const admin = createTestUser({ id: 'admin' });
      const match = createTestMatch({
        scoreA: 21,
        scoreB: 15,
        winnerId: 'player-a',
        tournamentScope: 'STATE',
      });

      mockUsers.set(admin.id, admin);
      mockMatches.set(match.id, match);

      const result = await correctScore(match.id, 'admin', 15, 21, 'Winner changed');

      // Player B is now the winner
      expect(result.match?.pointsA).toBe(4); // Participation
      expect(result.match?.pointsB).toBe(8); // Win
    });
  });
});
