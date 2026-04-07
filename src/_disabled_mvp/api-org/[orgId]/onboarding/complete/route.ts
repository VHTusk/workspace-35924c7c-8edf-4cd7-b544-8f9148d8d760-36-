import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST: Complete onboarding for an organization
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await request.json();
    const { 
      tournamentCreated,
      departmentsCreated,
      employeesImported,
      adminsInvited,
      skippedSteps,
    } = body;

    // Verify org exists and is CORPORATE type
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        type: true,
        onboardingCompleted: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (org.type !== "CORPORATE") {
      return NextResponse.json({ 
        error: "Onboarding completion is only for corporate organizations" 
      }, { status: 400 });
    }

    if (org.onboardingCompleted) {
      return NextResponse.json({ 
        error: "Onboarding already completed",
        completed: true,
      }, { status: 400 });
    }

    // Update organization with completion data
    const updatedOrg = await db.organization.update({
      where: { id: orgId },
      data: {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        onboardingStep: 5, // Mark as at final step
        hasTournaments: tournamentCreated || false,
        hasDepartments: departmentsCreated || false,
        hasEmployees: employeesImported > 0,
      },
    });

    // Create audit log for onboarding completion
    await db.auditLog.create({
      data: {
        sport: updatedOrg.sport,
        action: "ADMIN_OVERRIDE" as never, // Using existing enum
        actorId: orgId,
        actorRole: "ORG_ADMIN" as never,
        targetType: "ORGANIZATION",
        targetId: orgId,
        metadata: JSON.stringify({
          action: "onboarding_completed",
          tournamentCreated,
          departmentsCreated,
          employeesImported,
          adminsInvited,
          skippedSteps,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully",
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        onboardingCompleted: updatedOrg.onboardingCompleted,
        onboardingCompletedAt: updatedOrg.onboardingCompletedAt,
      },
      stats: {
        hasDepartments: updatedOrg.hasDepartments,
        hasEmployees: updatedOrg.hasEmployees,
        hasTournaments: updatedOrg.hasTournaments,
        departmentsCreated: departmentsCreated || 0,
        employeesImported: employeesImported || 0,
        adminsInvited: adminsInvited || 0,
      },
    });
  } catch (error) {
    console.error("Onboarding completion error:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}

// GET: Check if onboarding is complete
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        type: true,
        onboardingCompleted: true,
        onboardingCompletedAt: true,
        onboardingStep: true,
        hasDepartments: true,
        hasEmployees: true,
        hasTournaments: true,
        hasTeams: true,
        industry: true,
        companySize: true,
        primarySportInterest: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      completed: org.onboardingCompleted,
      completedAt: org.onboardingCompletedAt,
      currentStep: org.onboardingStep || 1,
      organization: {
        id: org.id,
        name: org.name,
        type: org.type,
      },
      progress: {
        hasDepartments: org.hasDepartments,
        hasEmployees: org.hasEmployees,
        hasTournaments: org.hasTournaments,
        hasTeams: org.hasTeams,
      },
      details: {
        industry: org.industry,
        companySize: org.companySize,
        primarySportInterest: org.primarySportInterest,
      },
    });
  } catch (error) {
    console.error("Get onboarding completion status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch onboarding status" },
      { status: 500 }
    );
  }
}
