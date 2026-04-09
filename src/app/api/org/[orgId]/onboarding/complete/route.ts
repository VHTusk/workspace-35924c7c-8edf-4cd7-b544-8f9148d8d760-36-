import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

async function getCompletionSnapshot(orgId: string) {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      state: true,
      logoUrl: true,
      employees: {
        where: { isActive: true },
        select: { id: true, department: true },
      },
      orgAdmins: {
        select: { id: true },
      },
      repSquads: {
        select: { id: true },
      },
      hostedIntraOrgs: {
        select: { id: true },
      },
      tournamentRegs: {
        select: { id: true },
      },
    },
  });

  if (!org) {
    return null;
  }

  const departmentCount = new Set(
    org.employees
      .map((employee) => employee.department?.trim())
      .filter((department): department is string => Boolean(department)),
  ).size;

  const hasEmployees = org.employees.length > 0;
  const hasDepartments = departmentCount > 0;
  const hasTournaments =
    org.hostedIntraOrgs.length > 0 || org.tournamentRegs.length > 0;
  const hasTeams = org.repSquads.length > 0;
  const hasAdmins = org.orgAdmins.length > 0;
  const completed = hasEmployees && hasAdmins && hasTournaments;

  return {
    completed,
    completedAt: completed ? new Date().toISOString() : null,
    currentStep: completed
      ? 5
      : !hasDepartments
        ? 2
        : !hasEmployees
          ? 3
          : !hasAdmins
            ? 4
            : 5,
    organization: {
      id: org.id,
      name: org.name,
      type: org.type,
    },
    progress: {
      hasDepartments,
      hasEmployees,
      hasTournaments,
      hasTeams,
    },
    details: {
      industry: null,
      companySize: null,
      primarySportInterest: null,
    },
    stats: {
      hasDepartments,
      hasEmployees,
      hasTournaments,
      departmentsCreated: departmentCount,
      employeesImported: org.employees.length,
      adminsInvited: org.orgAdmins.length,
    },
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await request.json().catch(() => ({}));
    const { orgId } = await params;

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        type: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (org.type !== "CORPORATE") {
      return NextResponse.json({
        error: "Onboarding completion is only for corporate organizations",
      }, { status: 400 });
    }

    const snapshot = await getCompletionSnapshot(orgId);

    return NextResponse.json({
      success: true,
      message: "Onboarding status refreshed successfully",
      ...snapshot,
    });
  } catch (error) {
    console.error("Onboarding completion error:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    void request;
    const { orgId } = await params;
    const snapshot = await getCompletionSnapshot(orgId);

    if (!snapshot) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Get onboarding completion status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch onboarding status" },
      { status: 500 }
    );
  }
}
