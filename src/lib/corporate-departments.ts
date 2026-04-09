import { SportType } from "@prisma/client";
import { db } from "@/lib/db";

export type CorporateDepartmentEmployee = Awaited<
  ReturnType<typeof getDepartmentEmployees>
>[number];

const SUPPORTED_SPORTS: SportType[] = ["CORNHOLE", "DARTS"];

export function parseCorporateSport(value: string | null): SportType | null {
  if (!value) {
    return null;
  }

  const normalized = value.toUpperCase();
  return SUPPORTED_SPORTS.includes(normalized as SportType)
    ? (normalized as SportType)
    : null;
}

export function departmentIdFromName(name: string): string {
  return encodeURIComponent(name.trim());
}

export function departmentNameFromId(departmentId: string): string {
  return decodeURIComponent(departmentId).trim();
}

export async function getDepartmentEmployees(
  orgId: string,
  sport: SportType,
  departmentName: string,
) {
  return db.employee.findMany({
    where: {
      orgId,
      sport,
      isActive: true,
      department: {
        equals: departmentName,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      email: true,
      designation: true,
      isVerified: true,
      userId: true,
      joinedAt: true,
      phone: true,
      department: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          visiblePoints: true,
          hiddenElo: true,
        },
      },
      sportPlayers: {
        where: {
          orgId,
          sport,
        },
        select: {
          matchesPlayed: true,
          wins: true,
          losses: true,
          points: true,
        },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

export async function listCorporateDepartments(orgId: string, sport: SportType) {
  const employees = await db.employee.findMany({
    where: {
      orgId,
      sport,
      isActive: true,
      department: {
        not: null,
      },
    },
    select: {
      id: true,
      department: true,
      isVerified: true,
      userId: true,
      joinedAt: true,
      sportPlayers: {
        where: {
          orgId,
          sport,
        },
        select: {
          matchesPlayed: true,
          wins: true,
          losses: true,
          points: true,
        },
      },
    },
  });

  const grouped = new Map<
    string,
    {
      name: string;
      createdAt: Date;
      totalEmployees: number;
      activePlayers: number;
      tournamentParticipations: number;
      totalPoints: number;
      totalWins: number;
      totalLosses: number;
    }
  >();

  for (const employee of employees) {
    const name = employee.department?.trim();
    if (!name) {
      continue;
    }

    const metrics = employee.sportPlayers[0] ?? {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      points: 0,
    };

    const existing = grouped.get(name) ?? {
      name,
      createdAt: employee.joinedAt,
      totalEmployees: 0,
      activePlayers: 0,
      tournamentParticipations: 0,
      totalPoints: 0,
      totalWins: 0,
      totalLosses: 0,
    };

    existing.createdAt =
      employee.joinedAt < existing.createdAt ? employee.joinedAt : existing.createdAt;
    existing.totalEmployees += 1;
    existing.activePlayers += employee.isVerified && employee.userId ? 1 : 0;
    existing.tournamentParticipations += metrics.matchesPlayed;
    existing.totalPoints += metrics.points;
    existing.totalWins += metrics.wins;
    existing.totalLosses += metrics.losses;

    grouped.set(name, existing);
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((department) => ({
      id: departmentIdFromName(department.name),
      name: department.name,
      code: null as string | null,
      description: null as string | null,
      managerId: null as string | null,
      totalEmployees: department.totalEmployees,
      activePlayers: department.activePlayers,
      tournamentParticipations: department.tournamentParticipations,
      totalPoints: department.totalPoints,
      autoLeagueEnabled: false,
      leaguePointSystem: null as string | null,
      createdAt: department.createdAt.toISOString(),
      stats: {
        totalWins: department.totalWins,
        totalLosses: department.totalLosses,
        winRate:
          department.totalWins + department.totalLosses > 0
            ? Math.round(
                (department.totalWins /
                  (department.totalWins + department.totalLosses)) *
                  100,
              )
            : 0,
      },
    }));
}

export function formatDepartmentEmployees(employees: CorporateDepartmentEmployee[]) {
  return employees.map((employee) => {
    const metrics = employee.sportPlayers[0] ?? {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      points: 0,
    };

    return {
      id: employee.id,
      employeeId: employee.employeeId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      designation: employee.designation,
      isVerified: employee.isVerified,
      hasAccount: !!employee.userId,
      tournamentsPlayed: metrics.matchesPlayed,
      totalPoints: metrics.points,
      wins: metrics.wins,
      losses: metrics.losses,
      joinedAt: employee.joinedAt.toISOString(),
      user: employee.user,
      fullName: `${employee.firstName} ${employee.lastName}`,
    };
  });
}

