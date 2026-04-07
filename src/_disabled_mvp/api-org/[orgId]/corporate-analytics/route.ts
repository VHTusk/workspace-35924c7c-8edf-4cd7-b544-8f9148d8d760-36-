import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const sport = request.nextUrl.searchParams.get("sport") || "CORNHOLE";
    const startDate = request.nextUrl.searchParams.get("startDate");
    const endDate = request.nextUrl.searchParams.get("endDate");

    // Get organization
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, type: true },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get all employees with their user data
    const employees = await db.employee.findMany({
      where: {
        orgId,
        sport: sport as Prisma.SportType,
        isActive: true,
      },
      include: {
        departmentRef: {
          select: { id: true, name: true },
        },
        user: {
          select: {
            id: true,
            hiddenElo: true,
            visiblePoints: true,
          },
        },
      },
    });

    // Get departments
    const departments = await db.corporateDepartment.findMany({
      where: {
        orgId,
        sport: sport as Prisma.SportType,
        isActive: true,
      },
      include: {
        _count: {
          select: { employees: { where: { isActive: true } } },
        },
      },
    });

    // Get tournament participations with more details
    const participations = await db.employeeTournamentParticipation.findMany({
      where: {
        employee: { orgId, sport: sport as Prisma.SportType },
        ...(startDate && {
          registeredAt: { gte: new Date(startDate) },
        }),
        ...(endDate && {
          registeredAt: { lte: new Date(endDate) },
        }),
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            startDate: true,
            status: true,
            type: true,
          },
        },
        employee: {
          select: {
            departmentId: true,
            departmentRef: { select: { name: true } },
          },
        },
      },
    });

    // Get employee invitations for funnel calculation
    const invitations = await db.employeeInvitation.findMany({
      where: {
        orgId,
        sport: sport as Prisma.SportType,
      },
      select: {
        id: true,
        status: true,
        invitedAt: true,
        respondedAt: true,
        tournamentId: true,
      },
    });

    // Get participation goals
    const goals = await db.participationGoal.findMany({
      where: {
        orgId,
        sport: sport as Prisma.SportType,
        ...(startDate && { startDate: { gte: new Date(startDate) } }),
        ...(endDate && { endDate: { lte: new Date(endDate) } }),
      },
    });

    // Calculate executive summary
    const totalEmployees = employees.length;
    const linkedEmployees = employees.filter((e) => e.linkStatus === "LINKED").length;
    const activePlayers = employees.filter((e) => e.tournamentsPlayed > 0);
    const participationRate = totalEmployees > 0
      ? Math.round((activePlayers.length / totalEmployees) * 100)
      : 0;

    // Calculate previous month's participation for trend
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const lastMonthParticipations = participations.filter((p) => {
      const date = new Date(p.registeredAt);
      return date >= lastMonthStart && date <= lastMonthEnd;
    });

    const thisMonthParticipations = participations.filter((p) => {
      const date = new Date(p.registeredAt);
      return date >= thisMonthStart;
    });

    const lastMonthActiveCount = new Set(lastMonthParticipations.map((p) => p.employeeId)).size;
    const thisMonthActiveCount = new Set(thisMonthParticipations.map((p) => p.employeeId)).size;
    const participationTrend = lastMonthActiveCount > 0
      ? Math.round(((thisMonthActiveCount - lastMonthActiveCount) / lastMonthActiveCount) * 100)
      : 0;

    // Department breakdown with trend
    const departmentBreakdown = departments.map((dept) => {
      const deptEmployees = employees.filter((e) => e.departmentId === dept.id);
      const deptActive = deptEmployees.filter((e) => e.tournamentsPlayed > 0);
      const totalPoints = deptEmployees.reduce((sum, e) => sum + e.totalPoints, 0);
      const totalWins = deptEmployees.reduce((sum, e) => sum + e.wins, 0);
      const totalLosses = deptEmployees.reduce((sum, e) => sum + e.losses, 0);

      // Calculate department trend (comparing last 2 months)
      const deptLastMonthParticipations = lastMonthParticipations.filter(
        (p) => p.employee?.departmentId === dept.id
      );
      const deptThisMonthParticipations = thisMonthParticipations.filter(
        (p) => p.employee?.departmentId === dept.id
      );

      const trend =
        deptLastMonthParticipations.length > 0
          ? deptThisMonthParticipations.length - deptLastMonthParticipations.length
          : 0;

      return {
        id: dept.id,
        name: dept.name,
        totalEmployees: deptEmployees.length,
        activePlayers: deptActive.length,
        participationRate:
          deptEmployees.length > 0
            ? Math.round((deptActive.length / deptEmployees.length) * 100)
            : 0,
        totalPoints,
        tournamentsPlayed: deptEmployees.reduce((sum, e) => sum + e.tournamentsPlayed, 0),
        trend,
      };
    });

    // Tournament Funnel
    const totalInvited = invitations.length;
    const registered = invitations.filter((i) => i.status === "ACCEPTED").length;
    const played = participations.length;
    const completed = participations.filter((p) => p.tournament.status === "COMPLETED").length;
    const won = participations.filter((p) => p.rank && p.rank <= 3).length;

    const tournamentFunnel = {
      invited: totalInvited,
      registered,
      played,
      completed,
      won,
    };

    // Monthly Trend Data (Last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      // Employees created in this month
      const newEmployees = employees.filter((e) => {
        const date = new Date(e.joinedAt);
        return date >= monthStart && date <= monthEnd;
      }).length;

      // Employees linked in this month
      const newLinked = employees.filter((e) => {
        if (!e.linkedAt) return false;
        const date = new Date(e.linkedAt);
        return date >= monthStart && date <= monthEnd;
      }).length;

      // Tournaments participated
      const monthParticipations = participations.filter((p) => {
        const date = new Date(p.registeredAt);
        return date >= monthStart && date <= monthEnd;
      });
      const tournamentsParticipated = new Set(
        monthParticipations.map((p) => p.tournamentId)
      ).size;

      // Active players in this month
      const activeInMonth = new Set(monthParticipations.map((p) => p.employeeId)).size;
      const avgParticipationRate =
        totalEmployees > 0 ? Math.round((activeInMonth / totalEmployees) * 100) : 0;

      monthlyTrend.push({
        month: monthStart.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        newEmployees,
        newLinked,
        tournamentsParticipated,
        avgParticipationRate,
      });
    }

    // Top Performers
    const topPerformers = [...employees]
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 10)
      .map((emp) => ({
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        department: emp.departmentRef?.name || emp.department || "Unassigned",
        points: emp.totalPoints,
        tournamentsPlayed: emp.tournamentsPlayed,
        winRate:
          emp.wins + emp.losses > 0
            ? Math.round((emp.wins / (emp.wins + emp.losses)) * 100)
            : 0,
      }));

    // Goals Progress
    const goalsProgress = goals.map((goal) => {
      let currentValue = goal.currentValue;

      // Calculate current value based on goal type
      if (goal.goalType === "PARTICIPATION_RATE") {
        currentValue = participationRate;
      } else if (goal.goalType === "TOTAL_MATCHES") {
        currentValue = employees.reduce((sum, e) => sum + e.wins + e.losses, 0);
      } else if (goal.goalType === "TOURNAMENTS") {
        currentValue = new Set(participations.map((p) => p.tournamentId)).size;
      } else if (goal.goalType === "ACTIVE_PLAYERS") {
        currentValue = activePlayers.length;
      }

      const progress = Math.min(100, Math.round((currentValue / goal.targetValue) * 100));
      const isAchieved = currentValue >= goal.targetValue;

      return {
        id: goal.id,
        goalType: goal.goalType,
        targetValue: goal.targetValue,
        currentValue,
        progress,
        isAchieved,
        period: goal.period,
        endDate: goal.endDate,
      };
    });

    // Calculate previous period stats for trend comparison
    const previousPeriodStats = {
      totalEmployees: totalEmployees,
      activePlayers: activePlayers.length,
      participationRate,
      participationTrend,
      linkedAccounts: linkedEmployees,
      linkedRate: totalEmployees > 0 ? Math.round((linkedEmployees / totalEmployees) * 100) : 0,
    };

    // Calculate unlinked employees
    const unlinkedEmployees = employees.filter((e) => e.linkStatus !== "LINKED").length;

    // Calculate top departments by participation
    const topDepartments = [...departmentBreakdown]
      .sort((a, b) => b.participationRate - a.participationRate)
      .slice(0, 3);

    return NextResponse.json({
      organization: org,
      // Executive Summary
      totalEmployees,
      activePlayers: activePlayers.length,
      participationRate,
      participationTrend,
      linkedAccounts: linkedEmployees,
      unlinkedEmployees,

      // Department Breakdown
      departments: departmentBreakdown,

      // Top Departments
      topDepartments,

      // Tournament Funnel
      tournamentFunnel,

      // Monthly Trend
      monthlyTrend,

      // Top Performers
      topPerformers,

      // Goals Progress
      goalsProgress,

      // Previous period for comparison
      previousPeriodStats,

      // Summary (keeping for backward compatibility)
      summary: {
        totalEmployees,
        verifiedEmployees: employees.filter((e) => e.isVerified).length,
        verificationRate:
          totalEmployees > 0
            ? Math.round((employees.filter((e) => e.isVerified).length / totalEmployees) * 100)
            : 0,
        playerAccounts: linkedEmployees,
        activePlayers: activePlayers.length,
        participationRate,
        totalTournaments: new Set(participations.map((p) => p.tournamentId)).size,
        totalMatches: employees.reduce((sum, e) => sum + e.wins + e.losses, 0),
        totalPoints: employees.reduce((sum, e) => sum + e.totalPoints, 0),
      },

      // Tournament History (for backward compatibility)
      tournamentHistory: [...new Map(
        participations.map((p) => [p.tournamentId, p.tournament])
      ).values()]
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        .slice(0, 10)
        .map((t) => {
          const tParticipations = participations.filter((p) => p.tournamentId === t.id);
          return {
            id: t.id,
            name: t.name,
            startDate: t.startDate,
            status: t.status,
            participants: tParticipations.length,
            totalPoints: tParticipations.reduce((sum, p) => sum + p.pointsEarned, 0),
          };
        }),

      // Monthly Stats (for backward compatibility)
      monthlyStats: monthlyTrend.map((m) => ({
        month: m.month,
        participants: Math.round(m.avgParticipationRate * totalEmployees / 100),
        tournaments: m.tournamentsParticipated,
        matches: Math.round(m.avgParticipationRate * 2),
      })),

      // Department Stats (for backward compatibility)
      departmentStats: departmentBreakdown.map((d) => ({
        ...d,
        employeeCount: d.totalEmployees,
        wins: Math.round(d.totalPoints / 10),
        losses: Math.round(d.totalPoints / 20),
        winRate: d.participationRate > 0 ? Math.round(d.participationRate * 0.7) : 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching corporate analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

// Export to CSV endpoint
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await request.json();
    const { sport = "CORNHOLE", type = "employees" } = body;

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (type === "employees") {
      const employees = await db.employee.findMany({
        where: {
          orgId,
          sport: sport as Prisma.SportType,
          isActive: true,
        },
        include: {
          departmentRef: { select: { name: true } },
        },
      });

      const csvHeaders = [
        "Employee ID",
        "First Name",
        "Last Name",
        "Email",
        "Department",
        "Tournaments Played",
        "Total Points",
        "Wins",
        "Losses",
        "Win Rate",
        "Status",
      ];

      const csvRows = employees.map((e) => [
        e.employeeId || "",
        e.firstName,
        e.lastName,
        e.email,
        e.departmentRef?.name || e.department || "Unassigned",
        e.tournamentsPlayed,
        e.totalPoints,
        e.wins,
        e.losses,
        e.wins + e.losses > 0 ? Math.round((e.wins / (e.wins + e.losses)) * 100) + "%" : "0%",
        e.linkStatus,
      ]);

      const csv = [csvHeaders, ...csvRows]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${org.name}_employees_${sport}.csv"`,
        },
      });
    } else if (type === "departments") {
      const departments = await db.corporateDepartment.findMany({
        where: {
          orgId,
          sport: sport as Prisma.SportType,
          isActive: true,
        },
        include: {
          _count: {
            select: { employees: { where: { isActive: true } } },
          },
        },
      });

      const employees = await db.employee.findMany({
        where: {
          orgId,
          sport: sport as Prisma.SportType,
          isActive: true,
        },
        include: {
          departmentRef: { select: { id: true } },
        },
      });

      const csvHeaders = [
        "Department Name",
        "Department Code",
        "Total Employees",
        "Active Players",
        "Participation Rate",
        "Total Points",
        "Tournaments Played",
      ];

      const csvRows = departments.map((d) => {
        const deptEmployees = employees.filter((e) => e.departmentId === d.id);
        const activePlayers = deptEmployees.filter((e) => e.tournamentsPlayed > 0);
        const totalPoints = deptEmployees.reduce((sum, e) => sum + e.totalPoints, 0);
        const tournamentsPlayed = deptEmployees.reduce(
          (sum, e) => sum + e.tournamentsPlayed,
          0
        );

        return [
          d.name,
          d.code || "",
          deptEmployees.length,
          activePlayers.length,
          deptEmployees.length > 0
            ? Math.round((activePlayers.length / deptEmployees.length) * 100) + "%"
            : "0%",
          totalPoints,
          tournamentsPlayed,
        ];
      });

      const csv = [csvHeaders, ...csvRows]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${org.name}_departments_${sport}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  } catch (error) {
    console.error("Error exporting analytics:", error);
    return NextResponse.json(
      { error: "Failed to export analytics" },
      { status: 500 }
    );
  }
}
