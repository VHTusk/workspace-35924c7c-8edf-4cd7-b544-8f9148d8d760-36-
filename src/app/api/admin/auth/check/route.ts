import { NextRequest, NextResponse } from "next/server";
import { getOfficeAccess } from "@/lib/office-auth";

export async function GET(request: NextRequest) {
  try {
    const access = await getOfficeAccess(request);

    if (!access) {
      return NextResponse.json(
        { authenticated: false, error: "No valid office session" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      authenticated: true,
      admin: {
        id: access.user.id,
        email: access.user.email,
        firstName: access.user.firstName,
        lastName: access.user.lastName,
        role: access.user.role,
        sport: access.user.sport,
      },
      office: {
        role: access.primaryAssignment.adminRole,
        redirectPath: access.redirectPath,
        scope: {
          sport: access.primaryAssignment.sport,
          stateCode: access.primaryAssignment.stateCode,
          districtName: access.primaryAssignment.districtName,
        },
        assignments: access.assignments,
        legacyFallback: access.legacyFallback,
      },
    });
  } catch (error) {
    console.error("Office auth check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
