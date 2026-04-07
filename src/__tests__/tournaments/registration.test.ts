/**
 * Tournament Registration Tests
 *
 * Tests for:
 * - Register for open tournament
 * - Register for closed tournament (should fail)
 * - Register when tournament is full (waitlist)
 * - Register with insufficient profile completeness
 * - Double registration prevention
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================
// Mock Types
// ============================================

interface MockTournament {
  id: string;
  name: string;
  sport: string;
  type: string;
  scope: string;
  status: string;
  maxPlayers: number;
  entryFee: number;
  startDate: Date;
  endDate: Date;
  regDeadline: Date;
  isPublic: boolean;
  ageMin?: number;
  ageMax?: number;
  gender?: string;
  minElo?: number;
  maxPlayersPerOrg?: number;
}

interface MockRegistration {
  id: string;
  tournamentId: string;
  userId: string;
  status: string;
  registeredAt: Date;
}

interface MockWaitlistEntry {
  id: string;
  tournamentId: string;
  userId: string;
  position: number;
  status: string;
  createdAt: Date;
}

interface MockUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  sport: string;
  city: string | null;
  state: string | null;
  hiddenElo: number;
  visiblePoints: number;
  dateOfBirth: Date | null;
  gender: string | null;
}

// ============================================
// Mock Storage
// ============================================

const mockTournaments: Map<string, MockTournament> = new Map();
const mockRegistrations: Map<string, MockRegistration> = new Map();
const mockWaitlist: Map<string, MockWaitlistEntry> = new Map();
const mockUsers: Map<string, MockUser> = new Map();

// Counter for unique IDs to avoid Date.now() collisions
let registrationIdCounter = 0;
let waitlistIdCounter = 0;

// ============================================
// Constants
// ============================================

const TOURNAMENT_STATUS = {
  DRAFT: 'DRAFT',
  REGISTRATION_OPEN: 'REGISTRATION_OPEN',
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  BRACKET_GENERATED: 'BRACKET_GENERATED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

const REGISTRATION_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  WAITLISTED: 'WAITLISTED',
} as const;

const WAITLIST_STATUS = {
  WAITING: 'WAITING',
  PROMOTED: 'PROMOTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

// ============================================
// Helper Functions
// ============================================

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

function calculateProfileCompleteness(user: MockUser): { percentage: number; missingFields: string[] } {
  const requiredFields: { field: string; value: unknown }[] = [
    { field: 'firstName', value: user.firstName },
    { field: 'lastName', value: user.lastName },
    { field: 'city', value: user.city },
    { field: 'state', value: user.state },
    { field: 'dateOfBirth', value: user.dateOfBirth },
    { field: 'gender', value: user.gender },
  ];

  const missingFields = requiredFields
    .filter(f => !f.value)
    .map(f => f.field);

  const percentage = Math.round(((requiredFields.length - missingFields.length) / requiredFields.length) * 100);

  return { percentage, missingFields };
}

function getRegistrationsCount(tournamentId: string): number {
  return Array.from(mockRegistrations.values())
    .filter(r => r.tournamentId === tournamentId && r.status === REGISTRATION_STATUS.CONFIRMED)
    .length;
}

function getWaitlistCount(tournamentId: string): number {
  return Array.from(mockWaitlist.values())
    .filter(w => w.tournamentId === tournamentId && w.status === WAITLIST_STATUS.WAITING)
    .length;
}

function isUserRegistered(tournamentId: string, userId: string): boolean {
  return Array.from(mockRegistrations.values())
    .some(r => r.tournamentId === tournamentId && r.userId === userId && r.status !== REGISTRATION_STATUS.CANCELLED);
}

function isUserWaitlisted(tournamentId: string, userId: string): boolean {
  return Array.from(mockWaitlist.values())
    .some(w => w.tournamentId === tournamentId && w.userId === userId && w.status === WAITLIST_STATUS.WAITING);
}

// ============================================
// Main Registration Function
// ============================================

async function mockRegisterForTournament(
  tournamentId: string,
  userId: string
): Promise<{
  success: boolean;
  error?: string;
  code?: string;
  status: number;
  registration?: MockRegistration;
  waitlist?: MockWaitlistEntry;
  position?: number;
}> {
  const tournament = mockTournaments.get(tournamentId);
  const user = mockUsers.get(userId);

  if (!tournament) {
    return {
      success: false,
      error: 'Tournament not found',
      code: 'TOURNAMENT_NOT_FOUND',
      status: 404,
    };
  }

  if (!user) {
    return {
      success: false,
      error: 'User not found',
      code: 'USER_NOT_FOUND',
      status: 404,
    };
  }

  // Check tournament status
  if (tournament.status !== TOURNAMENT_STATUS.REGISTRATION_OPEN) {
    return {
      success: false,
      error: 'Tournament registration is not open',
      code: 'REGISTRATION_CLOSED',
      status: 400,
    };
  }

  // Check registration deadline
  if (new Date() > tournament.regDeadline) {
    return {
      success: false,
      error: 'Registration deadline has passed',
      code: 'DEADLINE_PASSED',
      status: 400,
    };
  }

  // Check if already registered
  if (isUserRegistered(tournamentId, userId)) {
    return {
      success: false,
      error: 'You are already registered for this tournament',
      code: 'ALREADY_REGISTERED',
      status: 409,
    };
  }

  // Check if already on waitlist
  if (isUserWaitlisted(tournamentId, userId)) {
    return {
      success: false,
      error: 'You are already on the waitlist for this tournament',
      code: 'ALREADY_WAITLISTED',
      status: 409,
    };
  }

  // Check profile completeness
  const profile = calculateProfileCompleteness(user);
  if (profile.percentage < 80) {
    return {
      success: false,
      error: `Profile incomplete. Missing fields: ${profile.missingFields.join(', ')}`,
      code: 'PROFILE_INCOMPLETE',
      status: 400,
    };
  }

  // Check eligibility (age, gender, ELO)
  if (user.dateOfBirth && tournament.ageMin && tournament.ageMax) {
    const age = calculateAge(user.dateOfBirth);
    if (age < tournament.ageMin || age > tournament.ageMax) {
      return {
        success: false,
        error: `Age must be between ${tournament.ageMin} and ${tournament.ageMax}`,
        code: 'AGE_INELIGIBLE',
        status: 400,
      };
    }
  }

  if (tournament.gender && user.gender && tournament.gender !== 'MIXED' && user.gender !== tournament.gender) {
    return {
      success: false,
      error: `This tournament is for ${tournament.gender} players only`,
      code: 'GENDER_INELIGIBLE',
      status: 400,
    };
  }

  if (tournament.minElo && user.hiddenElo < tournament.minElo) {
    return {
      success: false,
      error: `ELO rating must be at least ${tournament.minElo}`,
      code: 'ELO_INELIGIBLE',
      status: 400,
    };
  }

  // Check capacity
  const currentCount = getRegistrationsCount(tournamentId);

  if (currentCount >= tournament.maxPlayers) {
    // Add to waitlist
    const waitlistPosition = getWaitlistCount(tournamentId) + 1;
    const waitlistEntry: MockWaitlistEntry = {
      id: `waitlist-${++waitlistIdCounter}`,
      tournamentId,
      userId,
      position: waitlistPosition,
      status: WAITLIST_STATUS.WAITING,
      createdAt: new Date(),
    };
    mockWaitlist.set(waitlistEntry.id, waitlistEntry);

    return {
      success: true,
      status: 202,
      waitlist: waitlistEntry,
      position: waitlistPosition,
    };
  }

  // Create registration
  const registration: MockRegistration = {
    id: `reg-${++registrationIdCounter}`,
    tournamentId,
    userId,
    status: REGISTRATION_STATUS.CONFIRMED,
    registeredAt: new Date(),
  };
  mockRegistrations.set(registration.id, registration);

  return {
    success: true,
    status: 200,
    registration,
  };
}

// ============================================
// Test Fixtures
// ============================================

function createTestTournament(overrides: Partial<MockTournament> = {}): MockTournament {
  return {
    id: `tournament-${Date.now()}`,
    name: 'Test Tournament',
    sport: 'CORNHOLE',
    type: 'INDIVIDUAL',
    scope: 'STATE',
    status: TOURNAMENT_STATUS.REGISTRATION_OPEN,
    maxPlayers: 32,
    entryFee: 50000,
    startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    endDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
    regDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    isPublic: true,
    ...overrides,
  };
}

function createTestUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: `user-${Date.now()}`,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    sport: 'CORNHOLE',
    city: 'Mumbai',
    state: 'Maharashtra',
    hiddenElo: 1500,
    visiblePoints: 100,
    dateOfBirth: new Date('1990-01-01'),
    gender: 'MALE',
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('Tournament Registration', () => {
  beforeEach(() => {
    mockTournaments.clear();
    mockRegistrations.clear();
    mockWaitlist.clear();
    mockUsers.clear();
    registrationIdCounter = 0;
    waitlistIdCounter = 0;
  });

  describe('Register for open tournament', () => {
    it('should successfully register for an open tournament', async () => {
      const tournament = createTestTournament();
      const user = createTestUser();

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.registration).toBeDefined();
      expect(result.registration?.status).toBe(REGISTRATION_STATUS.CONFIRMED);
    });

    it('should increment registration count', async () => {
      const tournament = createTestTournament();
      const user = createTestUser();

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      await mockRegisterForTournament(tournament.id, user.id);

      const count = getRegistrationsCount(tournament.id);
      expect(count).toBe(1);
    });

    it('should allow multiple users to register', async () => {
      const tournament = createTestTournament();
      mockTournaments.set(tournament.id, tournament);

      const user1 = createTestUser({ id: 'user-1', email: 'user1@example.com' });
      const user2 = createTestUser({ id: 'user-2', email: 'user2@example.com' });

      mockUsers.set(user1.id, user1);
      mockUsers.set(user2.id, user2);

      const result1 = await mockRegisterForTournament(tournament.id, user1.id);
      const result2 = await mockRegisterForTournament(tournament.id, user2.id);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(getRegistrationsCount(tournament.id)).toBe(2);
    });
  });

  describe('Register for closed tournament (should fail)', () => {
    it('should reject registration for draft tournament', async () => {
      const tournament = createTestTournament({ status: TOURNAMENT_STATUS.DRAFT });
      const user = createTestUser();

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.success).toBe(false);
      expect(result.code).toBe('REGISTRATION_CLOSED');
      expect(result.status).toBe(400);
    });

    it('should reject registration for tournament with closed registration', async () => {
      const tournament = createTestTournament({ status: TOURNAMENT_STATUS.REGISTRATION_CLOSED });
      const user = createTestUser();

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.success).toBe(false);
      expect(result.code).toBe('REGISTRATION_CLOSED');
    });

    it('should reject registration for in-progress tournament', async () => {
      const tournament = createTestTournament({ status: TOURNAMENT_STATUS.IN_PROGRESS });
      const user = createTestUser();

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.success).toBe(false);
      expect(result.code).toBe('REGISTRATION_CLOSED');
    });

    it('should reject registration after deadline', async () => {
      const tournament = createTestTournament({
        regDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      });
      const user = createTestUser();

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.success).toBe(false);
      expect(result.code).toBe('DEADLINE_PASSED');
    });
  });

  describe('Register when tournament is full (waitlist)', () => {
    it('should add to waitlist when tournament is full', async () => {
      const tournament = createTestTournament({ maxPlayers: 2 });
      mockTournaments.set(tournament.id, tournament);

      // Register 2 users to fill the tournament
      const user1 = createTestUser({ id: 'user-1', email: 'user1@example.com' });
      const user2 = createTestUser({ id: 'user-2', email: 'user2@example.com' });
      const user3 = createTestUser({ id: 'user-3', email: 'user3@example.com' });

      mockUsers.set(user1.id, user1);
      mockUsers.set(user2.id, user2);
      mockUsers.set(user3.id, user3);

      await mockRegisterForTournament(tournament.id, user1.id);
      await mockRegisterForTournament(tournament.id, user2.id);

      // Third user should be waitlisted
      const result = await mockRegisterForTournament(tournament.id, user3.id);

      expect(result.success).toBe(true);
      expect(result.status).toBe(202); // Accepted but waitlisted
      expect(result.waitlist).toBeDefined();
      expect(result.position).toBe(1);
    });

    it('should maintain waitlist order', async () => {
      const tournament = createTestTournament({ maxPlayers: 1 });
      mockTournaments.set(tournament.id, tournament);

      const user1 = createTestUser({ id: 'user-1', email: 'user1@example.com' });
      const user2 = createTestUser({ id: 'user-2', email: 'user2@example.com' });
      const user3 = createTestUser({ id: 'user-3', email: 'user3@example.com' });

      mockUsers.set(user1.id, user1);
      mockUsers.set(user2.id, user2);
      mockUsers.set(user3.id, user3);

      await mockRegisterForTournament(tournament.id, user1.id);
      const result2 = await mockRegisterForTournament(tournament.id, user2.id);
      const result3 = await mockRegisterForTournament(tournament.id, user3.id);

      expect(result2.position).toBe(1);
      expect(result3.position).toBe(2);
    });

    it('should check waitlist count correctly', async () => {
      const tournament = createTestTournament({ maxPlayers: 1 });
      mockTournaments.set(tournament.id, tournament);

      const user1 = createTestUser({ id: 'user-1', email: 'user1@example.com' });
      const user2 = createTestUser({ id: 'user-2', email: 'user2@example.com' });

      mockUsers.set(user1.id, user1);
      mockUsers.set(user2.id, user2);

      await mockRegisterForTournament(tournament.id, user1.id);
      await mockRegisterForTournament(tournament.id, user2.id);

      expect(getWaitlistCount(tournament.id)).toBe(1);
    });
  });

  describe('Register with insufficient profile completeness', () => {
    it('should reject registration with incomplete profile', async () => {
      const tournament = createTestTournament();
      const user = createTestUser({
        city: null,
        state: null,
        dateOfBirth: null,
        gender: null,
      });

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.success).toBe(false);
      expect(result.code).toBe('PROFILE_INCOMPLETE');
      expect(result.error).toContain('Missing fields');
    });

    it('should accept registration with 80% profile completeness', async () => {
      const tournament = createTestTournament();
      // 5 of 6 fields filled = ~83%
      const user = createTestUser({
        gender: null,
      });

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      const profile = calculateProfileCompleteness(user);
      expect(profile.percentage).toBeGreaterThanOrEqual(80);

      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.success).toBe(true);
    });

    it('should list missing fields in error message', async () => {
      const tournament = createTestTournament();
      const user = createTestUser({
        city: null,
        state: null,
      });

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.error).toContain('city');
      expect(result.error).toContain('state');
    });

    it('should calculate profile completeness correctly', () => {
      const completeUser = createTestUser();
      const incompleteUser = createTestUser({
        city: null,
        state: null,
        dateOfBirth: null,
        gender: null,
      });

      const completeProfile = calculateProfileCompleteness(completeUser);
      const incompleteProfile = calculateProfileCompleteness(incompleteUser);

      expect(completeProfile.percentage).toBe(100);
      expect(incompleteProfile.percentage).toBe(33);
      expect(incompleteProfile.missingFields).toHaveLength(4);
    });
  });

  describe('Double registration prevention', () => {
    it('should prevent duplicate registration', async () => {
      const tournament = createTestTournament();
      const user = createTestUser();

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      // First registration
      await mockRegisterForTournament(tournament.id, user.id);

      // Attempt second registration
      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.success).toBe(false);
      expect(result.code).toBe('ALREADY_REGISTERED');
      expect(result.status).toBe(409);
    });

    it('should not increase count on duplicate attempt', async () => {
      const tournament = createTestTournament();
      const user = createTestUser();

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      await mockRegisterForTournament(tournament.id, user.id);
      await mockRegisterForTournament(tournament.id, user.id);

      expect(getRegistrationsCount(tournament.id)).toBe(1);
    });

    it('should prevent waitlist if already registered', async () => {
      const tournament = createTestTournament({ maxPlayers: 1 });
      const user = createTestUser();

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      // Register for the tournament
      await mockRegisterForTournament(tournament.id, user.id);

      // Fill up the tournament
      const user2 = createTestUser({ id: 'user-2', email: 'user2@example.com' });
      mockUsers.set(user2.id, user2);
      await mockRegisterForTournament(tournament.id, user2.id);

      // Try to register again (should fail, not waitlist)
      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.code).toBe('ALREADY_REGISTERED');
    });

    it('should prevent duplicate waitlist entries', async () => {
      const tournament = createTestTournament({ maxPlayers: 1 });
      mockTournaments.set(tournament.id, tournament);

      const user1 = createTestUser({ id: 'user-1', email: 'user1@example.com' });
      const user2 = createTestUser({ id: 'user-2', email: 'user2@example.com' });

      mockUsers.set(user1.id, user1);
      mockUsers.set(user2.id, user2);

      await mockRegisterForTournament(tournament.id, user1.id);
      await mockRegisterForTournament(tournament.id, user2.id);

      // Try to waitlist again
      const result = await mockRegisterForTournament(tournament.id, user2.id);

      expect(result.code).toBe('ALREADY_WAITLISTED');
    });
  });

  describe('Eligibility checks', () => {
    it('should reject registration if age is below minimum', async () => {
      const tournament = createTestTournament({ ageMin: 18, ageMax: 60 });
      const user = createTestUser({
        dateOfBirth: new Date(Date.now() - 15 * 365 * 24 * 60 * 60 * 1000), // 15 years old
      });

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.success).toBe(false);
      expect(result.code).toBe('AGE_INELIGIBLE');
    });

    it('should reject registration if age is above maximum', async () => {
      const tournament = createTestTournament({ ageMin: 18, ageMax: 40 });
      const user = createTestUser({
        dateOfBirth: new Date(Date.now() - 50 * 365 * 24 * 60 * 60 * 1000), // 50 years old
      });

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.success).toBe(false);
      expect(result.code).toBe('AGE_INELIGIBLE');
    });

    it('should reject registration for gender-restricted tournament', async () => {
      const tournament = createTestTournament({ gender: 'FEMALE' });
      const user = createTestUser({ gender: 'MALE' });

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.success).toBe(false);
      expect(result.code).toBe('GENDER_INELIGIBLE');
    });

    it('should allow any gender for MIXED tournament', async () => {
      const tournament = createTestTournament({ gender: 'MIXED' });
      const maleUser = createTestUser({ id: 'male', gender: 'MALE' });
      const femaleUser = createTestUser({ id: 'female', gender: 'FEMALE' });

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(maleUser.id, maleUser);
      mockUsers.set(femaleUser.id, femaleUser);

      const result1 = await mockRegisterForTournament(tournament.id, maleUser.id);
      const result2 = await mockRegisterForTournament(tournament.id, femaleUser.id);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should reject registration if ELO is below minimum', async () => {
      const tournament = createTestTournament({ minElo: 1500 });
      const user = createTestUser({ hiddenElo: 1200 });

      mockTournaments.set(tournament.id, tournament);
      mockUsers.set(user.id, user);

      const result = await mockRegisterForTournament(tournament.id, user.id);

      expect(result.success).toBe(false);
      expect(result.code).toBe('ELO_INELIGIBLE');
    });
  });
});
