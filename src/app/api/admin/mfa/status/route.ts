import { NextRequest, NextResponse } from "next/server";
import { checkMfaRequirement, getMfaStatus } from "@/lib/mfa";
import { getAuthenticatedAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getMfaStatus(session.user.id);
    const requirement = await checkMfaRequirement(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        required: requirement.required,
      },
    });
  } catch (error) {
    console.error("Admin MFA status error:", error);
    return NextResponse.json({ error: "Failed to get MFA status" }, { status: 500 });
  }
}
