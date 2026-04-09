import { NextRequest, NextResponse } from "next/server";
import { SportType } from "@prisma/client";
import { db } from "@/lib/db";
import { listCorporateDepartments, parseCorporateSport } from "@/lib/corporate-departments";

type OrgSummary = { id: string; name: string; type: string };

function getEmployeeMetrics(employee: {
  sportPlayers: Array<{
    matchesPlayed: number;
    wins: number;
    losses: number;
    points: number;
  }>;
}) {
  return employee.sportPlayers[0] ?? {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    points: 0,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const sport = parseCorporateSport(searchParams.get("sport")) ?? "CORNHOLE";
    const reportType = searchParams.get("type") || "participation";
    const format = searchParams.get("format") || "json";

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, type: true },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    let reportData: Record<string, unknown>;

    switch (reportType) {
      case "participation":
        reportData = await generateParticipationReport(orgId, sport, org);
        break;
      case "department":
        reportData = await generateDepartmentReport(orgId, sport, org);
        break;
      case "tournament":
        reportData = await generateTournamentReport(orgId, sport, org);
        break;
      case "employee":
        reportData = await generateEmployeeReport(orgId, sport, org);
        break;
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    if (format === "csv") {
      return new NextResponse((reportData.csv as string) || "", {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${reportType}_report_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(reportData);
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

async function fetchEmployees(orgId: string, sport: SportType) {
  return db.employee.findMany({
    where: { orgId, sport, isActive: true },
    include: {
      sportPlayers: {
        where: { orgId, sport },
        select: {
          matchesPlayed: true,
          wins: true,
          losses: true,
          points: true,
        },
      },
      tournamentParticipations: true,
      user: {
        select: { id: true, verified: true },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

async function generateParticipationReport(
  orgId: string,
  sport: SportType,
  org: OrgSummary
) {
  const employees = await fetchEmployees(orgId, sport);
  const departments = await listCorporateDepartments(orgId, sport);

  const csvRows = [
    "Employee ID,Email,First Name,Last Name,Department,Tournaments Played,Total Points,Wins,Losses,Win Rate",
  ];

  employees.forEach((employee) => {
    const metrics = getEmployeeMetrics(employee);
    const winRate =
      metrics.wins + metrics.losses > 0
        ? ((metrics.wins / (metrics.wins + metrics.losses)) * 100).toFixed(1)
        : "0";

    csvRows.push([
      employee.employeeId || "",
      employee.email,
      employee.firstName,
      employee.lastName,
      employee.department || "",
      metrics.matchesPlayed,
      metrics.points,
      metrics.wins,
      metrics.losses,
      winRate,
    ].join(","));
  });

  return {
    type: "participation",
    organization: org.name,
    sport,
    generatedAt: new Date().toISOString(),
    summary: {
      totalEmployees: employees.length,
      activePlayers: employees.filter((employee) => getEmployeeMetrics(employee).matchesPlayed > 0).length,
      totalPoints: employees.reduce((sum, employee) => sum + getEmployeeMetrics(employee).points, 0),
      totalMatches: employees.reduce(
        (sum, employee) => sum + getEmployeeMetrics(employee).wins + getEmployeeMetrics(employee).losses,
        0,
      ),
    },
    departments: departments.map((department) => ({
      name: department.name,
      employees: department.totalEmployees,
    })),
    employees: employees.map((employee) => {
      const metrics = getEmployeeMetrics(employee);
      return {
        employeeId: employee.employeeId,
        email: employee.email,
        name: `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        tournamentsPlayed: metrics.matchesPlayed,
        totalPoints: metrics.points,
        wins: metrics.wins,
        losses: metrics.losses,
      };
    }),
    csv: csvRows.join("\n"),
  };
}

async function generateDepartmentReport(
  orgId: string,
  sport: SportType,
  org: OrgSummary
) {
  const departments = await listCorporateDepartments(orgId, sport);

  const csvRows = [
    "Department,Code,Total Employees,Active Players,Participation Rate,Total Points,Wins,Losses,Win Rate",
  ];

  const deptStats = departments.map((department) => {
    const participationRate =
      department.totalEmployees > 0
        ? ((department.activePlayers / department.totalEmployees) * 100).toFixed(1)
        : "0";

    csvRows.push([
      department.name,
      department.code || "",
      department.totalEmployees,
      department.activePlayers,
      participationRate,
      department.totalPoints,
      department.stats.totalWins,
      department.stats.totalLosses,
      department.stats.winRate,
    ].join(","));

    return {
      id: department.id,
      name: department.name,
      code: department.code,
      totalEmployees: department.totalEmployees,
      activePlayers: department.activePlayers,
      participationRate: parseFloat(participationRate),
      totalPoints: department.totalPoints,
      wins: department.stats.totalWins,
      losses: department.stats.totalLosses,
      winRate: department.stats.winRate,
    };
  });

  return {
    type: "department",
    organization: org.name,
    sport,
    generatedAt: new Date().toISOString(),
    departments: deptStats,
    csv: csvRows.join("\n"),
  };
}

async function generateTournamentReport(
  orgId: string,
  sport: SportType,
  org: OrgSummary
) {
  const participations = await db.employeeTournamentParticipation.findMany({
    where: {
      sport,
      employee: { orgId, sport },
    },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          department: true,
        },
      },
      tournament: {
        select: { id: true, name: true, startDate: true, status: true, prizePool: true },
      },
    },
  });

  const tournamentMap = new Map<string, {
    id: string;
    name: string;
    startDate: Date;
    status: string;
    prizePool: number;
    participants: Array<{
      name: string;
      email: string;
      department: string;
      pointsEarned: number;
      rank: number | null;
    }>;
  }>();

  participations.forEach((participation) => {
    if (!tournamentMap.has(participation.tournamentId)) {
      tournamentMap.set(participation.tournamentId, {
        id: participation.tournament.id,
        name: participation.tournament.name,
        startDate: participation.tournament.startDate,
        status: participation.tournament.status,
        prizePool: participation.tournament.prizePool,
        participants: [],
      });
    }

    tournamentMap.get(participation.tournamentId)!.participants.push({
      name: `${participation.employee.firstName} ${participation.employee.lastName}`,
      email: participation.employee.email,
      department: participation.employee.department || "",
      pointsEarned: participation.pointsEarned,
      rank: participation.rank,
    });
  });

  const tournaments = Array.from(tournamentMap.values()).sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime(),
  );

  const csvRows = [
    "Tournament,Date,Status,Prize Pool,Total Participants,Avg Points",
  ];

  tournaments.forEach((tournament) => {
    const avgPoints =
      tournament.participants.length > 0
        ? (
            tournament.participants.reduce((sum, participant) => sum + participant.pointsEarned, 0) /
            tournament.participants.length
          ).toFixed(1)
        : "0";

    csvRows.push([
      tournament.name,
      new Date(tournament.startDate).toLocaleDateString(),
      tournament.status,
      tournament.prizePool,
      tournament.participants.length,
      avgPoints,
    ].join(","));
  });

  return {
    type: "tournament",
    organization: org.name,
    sport,
    generatedAt: new Date().toISOString(),
    tournaments: tournaments.slice(0, 20).map((tournament) => ({
      id: tournament.id,
      name: tournament.name,
      startDate: tournament.startDate,
      status: tournament.status,
      prizePool: tournament.prizePool,
      participantCount: tournament.participants.length,
    })),
    csv: csvRows.join("\n"),
  };
}

async function generateEmployeeReport(
  orgId: string,
  sport: SportType,
  org: OrgSummary
) {
  const employees = await fetchEmployees(orgId, sport);

  const csvRows = [
    "Employee ID,Email,First Name,Last Name,Phone,Department,Designation,Verified,Has Player Account,Tournaments,Points,Wins,Losses",
  ];

  employees.forEach((employee) => {
    const metrics = getEmployeeMetrics(employee);
    csvRows.push([
      employee.employeeId || "",
      employee.email,
      employee.firstName,
      employee.lastName,
      employee.phone || "",
      employee.department || "",
      employee.designation || "",
      employee.isVerified ? "Yes" : "No",
      employee.user ? "Yes" : "No",
      metrics.matchesPlayed,
      metrics.points,
      metrics.wins,
      metrics.losses,
    ].join(","));
  });

  return {
    type: "employee",
    organization: org.name,
    sport,
    generatedAt: new Date().toISOString(),
    summary: {
      total: employees.length,
      verified: employees.filter((employee) => employee.isVerified).length,
      withPlayerAccount: employees.filter((employee) => employee.user).length,
      active: employees.filter((employee) => getEmployeeMetrics(employee).matchesPlayed > 0).length,
    },
    employees: employees.map((employee) => {
      const metrics = getEmployeeMetrics(employee);
      return {
        employeeId: employee.employeeId,
        email: employee.email,
        name: `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        designation: employee.designation,
        isVerified: employee.isVerified,
        hasPlayerAccount: !!employee.user,
        tournamentsPlayed: metrics.matchesPlayed,
        totalPoints: metrics.points,
      };
    }),
    csv: csvRows.join("\n"),
  };
}
