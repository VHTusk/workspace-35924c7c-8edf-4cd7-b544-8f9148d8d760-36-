import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const sport = searchParams.get("sport") || "CORNHOLE";
    const reportType = searchParams.get("type") || "participation";
    const format = searchParams.get("format") || "json";

    // Get organization
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, type: true },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    let reportData: Record<string, unknown> = {};

    switch (reportType) {
      case "participation":
        reportData = await generateParticipationReport(orgId, sport as Prisma.SportType, org);
        break;
      case "department":
        reportData = await generateDepartmentReport(orgId, sport as Prisma.SportType, org);
        break;
      case "tournament":
        reportData = await generateTournamentReport(orgId, sport as Prisma.SportType, org);
        break;
      case "employee":
        reportData = await generateEmployeeReport(orgId, sport as Prisma.SportType, org);
        break;
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    if (format === "csv") {
      return new NextResponse(reportData.csv as string, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${reportType}_report_${new Date().toISOString().split('T')[0]}.csv"`,
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

async function generateParticipationReport(
  orgId: string,
  sport: Prisma.SportType,
  org: { id: string; name: string; type: string }
) {
  const employees = await db.employee.findMany({
    where: { orgId, sport, isActive: true },
    include: {
      departmentRef: { select: { name: true } },
      tournamentParticipations: true,
    },
  });

  const departments = await db.corporateDepartment.findMany({
    where: { orgId, sport, isActive: true },
    include: {
      _count: { select: { employees: { where: { isActive: true } } } },
    },
  });

  // Build CSV
  const csvRows = [
    "Employee ID,Email,First Name,Last Name,Department,Tournaments Played,Total Points,Wins,Losses,Win Rate",
  ];

  employees.forEach((emp) => {
    const winRate = emp.wins + emp.losses > 0 
      ? ((emp.wins / (emp.wins + emp.losses)) * 100).toFixed(1) 
      : "0";
    csvRows.push([
      emp.employeeId || "",
      emp.email,
      emp.firstName,
      emp.lastName,
      emp.departmentRef?.name || emp.department || "",
      emp.tournamentsPlayed,
      emp.totalPoints,
      emp.wins,
      emp.losses,
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
      activePlayers: employees.filter((e) => e.tournamentsPlayed > 0).length,
      totalPoints: employees.reduce((sum, e) => sum + e.totalPoints, 0),
      totalMatches: employees.reduce((sum, e) => sum + e.wins + e.losses, 0),
    },
    departments: departments.map((d) => ({
      name: d.name,
      employees: d._count.employees,
    })),
    employees: employees.map((e) => ({
      employeeId: e.employeeId,
      email: e.email,
      name: `${e.firstName} ${e.lastName}`,
      department: e.departmentRef?.name || e.department,
      tournamentsPlayed: e.tournamentsPlayed,
      totalPoints: e.totalPoints,
      wins: e.wins,
      losses: e.losses,
    })),
    csv: csvRows.join("\n"),
  };
}

async function generateDepartmentReport(
  orgId: string,
  sport: Prisma.SportType,
  org: { id: string; name: string; type: string }
) {
  const departments = await db.corporateDepartment.findMany({
    where: { orgId, sport, isActive: true },
    include: {
      employees: { where: { isActive: true } },
    },
  });

  const csvRows = [
    "Department,Code,Total Employees,Active Players,Participation Rate,Total Points,Wins,Losses,Win Rate",
  ];

  const deptStats = departments.map((dept) => {
    const employees = dept.employees;
    const activePlayers = employees.filter((e) => e.tournamentsPlayed > 0);
    const totalPoints = employees.reduce((sum, e) => sum + e.totalPoints, 0);
    const wins = employees.reduce((sum, e) => sum + e.wins, 0);
    const losses = employees.reduce((sum, e) => sum + e.losses, 0);
    const participationRate = employees.length > 0 
      ? ((activePlayers.length / employees.length) * 100).toFixed(1) 
      : "0";
    const winRate = wins + losses > 0 
      ? ((wins / (wins + losses)) * 100).toFixed(1) 
      : "0";

    csvRows.push([
      dept.name,
      dept.code || "",
      employees.length,
      activePlayers.length,
      participationRate,
      totalPoints,
      wins,
      losses,
      winRate,
    ].join(","));

    return {
      id: dept.id,
      name: dept.name,
      code: dept.code,
      totalEmployees: employees.length,
      activePlayers: activePlayers.length,
      participationRate: parseFloat(participationRate),
      totalPoints,
      wins,
      losses,
      winRate: parseFloat(winRate),
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
  sport: Prisma.SportType,
  org: { id: string; name: string; type: string }
) {
  const participations = await db.employeeTournamentParticipation.findMany({
    where: {
      employee: { orgId, sport },
    },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          departmentRef: { select: { name: true } },
        },
      },
      tournament: {
        select: { id: true, name: true, startDate: true, status: true, prizePool: true },
      },
    },
  });

  // Group by tournament
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

  participations.forEach((p) => {
    const tId = p.tournamentId;
    if (!tournamentMap.has(tId)) {
      tournamentMap.set(tId, {
        id: p.tournament.id,
        name: p.tournament.name,
        startDate: p.tournament.startDate,
        status: p.tournament.status,
        prizePool: p.tournament.prizePool,
        participants: [],
      });
    }
    const t = tournamentMap.get(tId)!;
    t.participants.push({
      name: `${p.employee.firstName} ${p.employee.lastName}`,
      email: p.employee.email,
      department: p.employee.departmentRef?.name || p.employee.department || "",
      pointsEarned: p.pointsEarned,
      rank: p.rank,
    });
  });

  const tournaments = Array.from(tournamentMap.values()).sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  const csvRows = [
    "Tournament,Date,Status,Prize Pool,Total Participants,Avg Points",
  ];

  tournaments.forEach((t) => {
    const avgPoints = t.participants.length > 0
      ? (t.participants.reduce((sum, p) => sum + p.pointsEarned, 0) / t.participants.length).toFixed(1)
      : "0";
    csvRows.push([
      t.name,
      new Date(t.startDate).toLocaleDateString(),
      t.status,
      t.prizePool,
      t.participants.length,
      avgPoints,
    ].join(","));
  });

  return {
    type: "tournament",
    organization: org.name,
    sport,
    generatedAt: new Date().toISOString(),
    tournaments: tournaments.slice(0, 20).map((t) => ({
      id: t.id,
      name: t.name,
      startDate: t.startDate,
      status: t.status,
      prizePool: t.prizePool,
      participantCount: t.participants.length,
    })),
    csv: csvRows.join("\n"),
  };
}

async function generateEmployeeReport(
  orgId: string,
  sport: Prisma.SportType,
  org: { id: string; name: string; type: string }
) {
  const employees = await db.employee.findMany({
    where: { orgId, sport, isActive: true },
    include: {
      departmentRef: { select: { name: true } },
      user: { select: { id: true, verified: true } },
    },
    orderBy: { joinedAt: "desc" },
  });

  const csvRows = [
    "Employee ID,Email,First Name,Last Name,Phone,Department,Designation,Verified,Has Player Account,Joined Date,Tournaments,Points,Wins,Losses",
  ];

  employees.forEach((emp) => {
    csvRows.push([
      emp.employeeId || "",
      emp.email,
      emp.firstName,
      emp.lastName,
      emp.phone || "",
      emp.departmentRef?.name || emp.department || "",
      emp.designation || "",
      emp.isVerified ? "Yes" : "No",
      emp.user ? "Yes" : "No",
      new Date(emp.joinedAt).toLocaleDateString(),
      emp.tournamentsPlayed,
      emp.totalPoints,
      emp.wins,
      emp.losses,
    ].join(","));
  });

  return {
    type: "employee",
    organization: org.name,
    sport,
    generatedAt: new Date().toISOString(),
    summary: {
      total: employees.length,
      verified: employees.filter((e) => e.isVerified).length,
      withPlayerAccount: employees.filter((e) => e.user).length,
      active: employees.filter((e) => e.tournamentsPlayed > 0).length,
    },
    employees: employees.map((e) => ({
      employeeId: e.employeeId,
      email: e.email,
      name: `${e.firstName} ${e.lastName}`,
      department: e.departmentRef?.name || e.department,
      designation: e.designation,
      isVerified: e.isVerified,
      hasPlayerAccount: !!e.user,
      tournamentsPlayed: e.tournamentsPlayed,
      totalPoints: e.totalPoints,
    })),
    csv: csvRows.join("\n"),
  };
}
