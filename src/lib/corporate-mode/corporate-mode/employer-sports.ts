// Employer Sports Library (v3.54.0)
// Layer 1: Internal sports ecosystem for employees

import { db } from '@/lib/db';
import { Employee, EmployeeInvitation, EmployeeTournamentParticipation, SportType, TournamentType } from '@prisma/client';

// ============================================
// EMPLOYEE MANAGEMENT
// ============================================

export interface CreateEmployeeData {
  orgId: string;
  email: string;
  firstName: string;
  lastName: string;
  sport: SportType;
  phone?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
  userId?: string;
}

export async function createEmployee(data: CreateEmployeeData): Promise<Employee> {
  return db.employee.create({
    data: {
      orgId: data.orgId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      sport: data.sport,
      phone: data.phone,
      department: data.department,
      designation: data.designation,
      employeeId: data.employeeId,
      userId: data.userId,
      isVerified: false,
      isActive: true,
    },
  });
}

export async function getOrgEmployees(orgId: string, sport: SportType): Promise<Employee[]> {
  return db.employee.findMany({
    where: {
      orgId,
      sport,
      isActive: true,
    },
    orderBy: {
      joinedAt: 'desc',
    },
  });
}

export async function verifyEmployee(employeeId: string, verifiedBy: string): Promise<Employee> {
  return db.employee.update({
    where: { id: employeeId },
    data: {
      isVerified: true,
      verifiedAt: new Date(),
      verifiedBy,
    },
  });
}

// ============================================
// EMPLOYEE INVITATIONS
// ============================================

export interface CreateInvitationData {
  orgId: string;
  tournamentId: string;
  employeeId: string;
  sport: SportType;
  invitedBy: string;
  expiresAt: Date;
}

export async function createEmployeeInvitation(data: CreateInvitationData): Promise<EmployeeInvitation> {
  return db.employeeInvitation.create({
    data: {
      orgId: data.orgId,
      tournamentId: data.tournamentId,
      employeeId: data.employeeId,
      sport: data.sport,
      invitedBy: data.invitedBy,
      expiresAt: data.expiresAt,
      status: 'PENDING',
    },
  });
}

export async function getTournamentInvitations(tournamentId: string): Promise<EmployeeInvitation[]> {
  return db.employeeInvitation.findMany({
    where: { tournamentId },
    include: {
      employee: true,
    },
    orderBy: {
      invitedAt: 'desc',
    },
  });
}

export async function sendBulkInvitations(
  tournamentId: string,
  orgId: string,
  sport: SportType,
  employeeIds: string[],
  invitedBy: string
): Promise<{ sent: number; failed: string[] }> {
  const results = { sent: 0, failed: [] as string[] };
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  for (const employeeId of employeeIds) {
    try {
      await createEmployeeInvitation({
        orgId,
        tournamentId,
        employeeId,
        sport,
        invitedBy,
        expiresAt,
      });
      
      // Mark email as sent (in production, would send actual email)
      await db.employeeInvitation.updateMany({
        where: { tournamentId, employeeId },
        data: {
          emailSent: true,
          emailSentAt: new Date(),
        },
      });
      
      results.sent++;
    } catch {
      results.failed.push(employeeId);
    }
  }

  return results;
}

// ============================================
// INTRA_ORG TOURNAMENT MANAGEMENT
// ============================================

export async function getEmployerTournaments(orgId: string, sport: SportType) {
  return db.tournament.findMany({
    where: {
      orgId,
      sport,
      type: 'INTRA_ORG',
    },
    include: {
      employeeInvitations: {
        select: {
          id: true,
          status: true,
        },
      },
      employeeParticipations: {
        select: {
          id: true,
        },
      },
      _count: {
        select: {
          employeeInvitations: true,
          employeeParticipations: true,
        },
      },
    },
    orderBy: {
      startDate: 'desc',
    },
  });
}

export async function getEmployerSportsStats(orgId: string, sport: SportType) {
  const [totalEmployees, activeTournaments, totalInvitations, totalParticipations] = await Promise.all([
    db.employee.count({
      where: { orgId, sport, isActive: true },
    }),
    db.tournament.count({
      where: { orgId, sport, type: 'INTRA_ORG', status: { in: ['REGISTRATION_OPEN', 'IN_PROGRESS'] } },
    }),
    db.employeeInvitation.count({
      where: { orgId, sport, status: 'PENDING' },
    }),
    db.employeeTournamentParticipation.count({
      where: { tournament: { orgId, sport } },
    }),
  ]);

  return {
    totalEmployees,
    activeTournaments,
    totalInvitations,
    totalParticipations,
  };
}

// ============================================
// PARTICIPATION ELIGIBILITY
// ============================================

export async function checkEmployeeEligibility(
  employeeId: string,
  tournamentId: string
): Promise<{ eligible: boolean; reason?: string }> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: { organization: true },
  });

  if (!employee) {
    return { eligible: false, reason: 'Employee not found' };
  }

  if (!employee.isActive) {
    return { eligible: false, reason: 'Employee is not active' };
  }

  if (!employee.isVerified) {
    return { eligible: false, reason: 'Employee is not verified' };
  }

  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    return { eligible: false, reason: 'Tournament not found' };
  }

  if (tournament.type !== 'INTRA_ORG') {
    return { eligible: false, reason: 'Tournament is not an internal tournament' };
  }

  if (tournament.orgId !== employee.orgId) {
    return { eligible: false, reason: 'Tournament belongs to different organization' };
  }

  // Check if already registered
  const existing = await db.employeeTournamentParticipation.findUnique({
    where: { employeeId_tournamentId: { employeeId, tournamentId } },
  });

  if (existing) {
    return { eligible: false, reason: 'Already registered for this tournament' };
  }

  return { eligible: true };
}
