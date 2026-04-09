import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ONBOARDING_STEPS = [
  { step: 1, title: "Organization Setup", canSkip: false },
  { step: 2, title: "Department Structure", canSkip: true },
  { step: 3, title: "Employee Import", canSkip: true },
  { step: 4, title: "Invite Admin Team", canSkip: true },
  { step: 5, title: "First Steps", canSkip: true },
];

async function getOnboardingSnapshot(orgId: string) {
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
        select: {
          id: true,
          department: true,
        },
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

  const departmentNames = new Set(
    org.employees
      .map((employee) => employee.department?.trim())
      .filter((department): department is string => Boolean(department)),
  );

  const progress = {
    hasDepartments: departmentNames.size > 0,
    hasEmployees: org.employees.length > 0,
    hasTournaments:
      org.hostedIntraOrgs.length > 0 || org.tournamentRegs.length > 0,
    hasTeams: org.repSquads.length > 0,
    hasAdmins: org.orgAdmins.length > 0,
  };

  const currentStep = !progress.hasDepartments
    ? 2
    : !progress.hasEmployees
      ? 3
      : !progress.hasAdmins
        ? 4
        : !progress.hasTournaments
          ? 5
          : 5;

  const completed =
    progress.hasEmployees && progress.hasAdmins && progress.hasTournaments;

  const steps = ONBOARDING_STEPS.map((stepDef) => {
    const completedStep =
      stepDef.step === 1
        ? true
        : stepDef.step === 2
          ? progress.hasDepartments
          : stepDef.step === 3
            ? progress.hasEmployees
            : stepDef.step === 4
              ? progress.hasAdmins
              : progress.hasTournaments;

    return {
      step: stepDef.step,
      title: stepDef.title,
      completed: completedStep,
      skipped: false,
    };
  });

  return {
    completed,
    currentStep,
    steps,
    canSkip: currentStep > 1,
    organization: {
      id: org.id,
      name: org.name,
      type: org.type,
      industry: null,
      companySize: null,
      primarySportInterest: null,
      logoUrl: org.logoUrl,
    },
    progress: {
      hasDepartments: progress.hasDepartments,
      hasEmployees: progress.hasEmployees,
      hasTournaments: progress.hasTournaments,
      hasTeams: progress.hasTeams,
    },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    void request;
    const { orgId } = await params;
    const snapshot = await getOnboardingSnapshot(orgId);

    if (!snapshot) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Get onboarding status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch onboarding status" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await request.json().catch(() => ({}));

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, type: true },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (org.type !== "CORPORATE") {
      return NextResponse.json({ error: "Onboarding is only for corporate organizations" }, { status: 400 });
    }

    const updateData: { city?: string; state?: string; logoUrl?: string | null } = {};
    if (typeof body?.data?.city === "string") updateData.city = body.data.city;
    if (typeof body?.data?.state === "string") updateData.state = body.data.state;
    if (typeof body?.data?.logoUrl === "string" || body?.data?.logoUrl === null) {
      updateData.logoUrl = body.data.logoUrl;
    }

    if (Object.keys(updateData).length > 0) {
      await db.organization.update({
        where: { id: orgId },
        data: updateData,
      });
    }

    const snapshot = await getOnboardingSnapshot(orgId);
    return NextResponse.json({
      success: true,
      ...snapshot,
    });
  } catch (error) {
    console.error("Update onboarding progress error:", error);
    return NextResponse.json(
      { error: "Failed to update onboarding progress" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await request.json().catch(() => ({}));

    const updateData: { city?: string; state?: string; logoUrl?: string | null } = {};
    if (typeof body?.city === "string") updateData.city = body.city;
    if (typeof body?.state === "string") updateData.state = body.state;
    if (typeof body?.logoUrl === "string" || body?.logoUrl === null) {
      updateData.logoUrl = body.logoUrl;
    }

    if (Object.keys(updateData).length > 0) {
      await db.organization.update({
        where: { id: orgId },
        data: updateData,
      });
    }

    const snapshot = await getOnboardingSnapshot(orgId);

    return NextResponse.json({
      success: true,
      organization: snapshot?.organization ?? null,
    });
  } catch (error) {
    console.error("Save step data error:", error);
    return NextResponse.json(
      { error: "Failed to save step data" },
      { status: 500 }
    );
  }
}
