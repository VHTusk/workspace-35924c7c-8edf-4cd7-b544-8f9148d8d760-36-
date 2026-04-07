import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Onboarding step definitions - 5 steps as per requirements
const ONBOARDING_STEPS = [
  { step: 1, title: "Organization Setup", canSkip: false },
  { step: 2, title: "Department Structure", canSkip: true },
  { step: 3, title: "Employee Import", canSkip: true },
  { step: 4, title: "Invite Admin Team", canSkip: true },
  { step: 5, title: "First Steps", canSkip: true },
];

// GET: Get onboarding status
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
        onboardingStep: true,
        onboardingSkippedAt: true,
        onboardingCompletedAt: true,
        industry: true,
        companySize: true,
        primarySportInterest: true,
        logoUrl: true,
        hasDepartments: true,
        hasEmployees: true,
        hasTournaments: true,
        hasTeams: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Build step completion status
    const steps = ONBOARDING_STEPS.map((stepDef) => {
      const isCompleted = org.onboardingCompleted || org.onboardingStep > stepDef.step;
      const isSkipped = stepDef.canSkip && org.onboardingSkippedAt && !isCompleted;

      return {
        step: stepDef.step,
        title: stepDef.title,
        completed: isCompleted,
        skipped: isSkipped,
      };
    });

    // Determine current step based on progress
    let currentStep = org.onboardingStep || 1;
    if (currentStep === 0) currentStep = 1; // Normalize step 0 to step 1
    if (org.onboardingCompleted) {
      currentStep = 5; // Last step
    }

    return NextResponse.json({
      completed: org.onboardingCompleted,
      currentStep,
      steps,
      canSkip: currentStep > 1, // Can skip steps 2-5
      organization: {
        id: org.id,
        name: org.name,
        type: org.type,
        industry: org.industry,
        companySize: org.companySize,
        primarySportInterest: org.primarySportInterest,
        logoUrl: org.logoUrl,
      },
      progress: {
        hasDepartments: org.hasDepartments,
        hasEmployees: org.hasEmployees,
        hasTournaments: org.hasTournaments,
        hasTeams: org.hasTeams,
      },
    });
  } catch (error) {
    console.error("Get onboarding status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch onboarding status" },
      { status: 500 }
    );
  }
}

// POST: Update onboarding progress
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await request.json();
    const { step, action, data } = body;

    // Validate action
    if (!["complete", "skip", "back"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Validate step
    if (typeof step !== "number" || step < 1 || step > 5) {
      return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    const org = await db.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Verify org is CORPORATE type
    if (org.type !== "CORPORATE") {
      return NextResponse.json({ error: "Onboarding is only for corporate organizations" }, { status: 400 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "complete":
        // Complete the current step and move to next
        if (step === 1) {
          // Organization Setup step - save org details
          updateData = {
            onboardingStep: step + 1,
            ...(data?.industry && { industry: data.industry }),
            ...(data?.companySize && { companySize: data.companySize }),
            ...(data?.primarySportInterest && { primarySportInterest: data.primarySportInterest }),
            ...(data?.logoUrl && { logoUrl: data.logoUrl }),
            ...(data?.city && { city: data.city }),
            ...(data?.state && { state: data.state }),
          };
        } else if (step === 2) {
          // Department Structure step
          updateData = {
            onboardingStep: step + 1,
            hasDepartments: data?.departmentsCreated || false,
          };
          
          // Create departments in database if provided
          if (data?.departments && Array.isArray(data.departments) && data.departments.length > 0) {
            // Create CorporateDepartment records
            for (const dept of data.departments) {
              await db.corporateDepartment.create({
                data: {
                  orgId: orgId,
                  name: dept.name,
                  code: dept.code,
                },
              });
            }
          }
        } else if (step === 3) {
          // Employee Import step
          updateData = {
            onboardingStep: step + 1,
            hasEmployees: data?.employeesImported || false,
          };
        } else if (step === 4) {
          // Invite Admin Team step
          updateData = {
            onboardingStep: step + 1,
          };
        } else if (step === 5) {
          // First Steps step - Complete onboarding
          updateData = {
            onboardingCompleted: true,
            onboardingCompletedAt: new Date(),
            hasTournaments: data?.tournamentCreated || false,
          };
        }
        break;

      case "skip":
        // Skip current step (only allowed for steps 2-5)
        if (step < 2) {
          return NextResponse.json({ error: "Cannot skip this step" }, { status: 400 });
        }
        
        if (step === 5) {
          // Skipping final step completes onboarding
          updateData = {
            onboardingCompleted: true,
            onboardingCompletedAt: new Date(),
            onboardingSkippedAt: new Date(),
          };
        } else {
          updateData = {
            onboardingStep: step + 1,
            onboardingSkippedAt: new Date(),
          };
        }
        break;

      case "back":
        // Go back to previous step
        if (step <= 1) {
          return NextResponse.json({ error: "Cannot go back from first step" }, { status: 400 });
        }
        updateData = {
          onboardingStep: step - 1,
        };
        break;
    }

    // If moving to step 6, mark as completed
    if (updateData.onboardingStep === 6) {
      updateData.onboardingCompleted = true;
      updateData.onboardingCompletedAt = new Date();
      updateData.onboardingStep = 5; // Keep at last step
    }

    const updatedOrg = await db.organization.update({
      where: { id: orgId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      currentStep: updatedOrg.onboardingStep || 1,
      completed: updatedOrg.onboardingCompleted,
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        industry: updatedOrg.industry,
        companySize: updatedOrg.companySize,
      },
    });
  } catch (error) {
    console.error("Update onboarding progress error:", error);
    return NextResponse.json(
      { error: "Failed to update onboarding progress" },
      { status: 500 }
    );
  }
}

// PATCH: Save step data without advancing
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await request.json();
    const { industry, companySize, primarySportInterest, logoUrl, city, state } = body;

    const org = await db.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    
    if (industry !== undefined) updateData.industry = industry;
    if (companySize !== undefined) updateData.companySize = companySize;
    if (primarySportInterest !== undefined) updateData.primarySportInterest = primarySportInterest;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;

    const updatedOrg = await db.organization.update({
      where: { id: orgId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: updatedOrg.id,
        industry: updatedOrg.industry,
        companySize: updatedOrg.companySize,
        primarySportInterest: updatedOrg.primarySportInterest,
        logoUrl: updatedOrg.logoUrl,
      },
    });
  } catch (error) {
    console.error("Save step data error:", error);
    return NextResponse.json(
      { error: "Failed to save step data" },
      { status: 500 }
    );
  }
}
