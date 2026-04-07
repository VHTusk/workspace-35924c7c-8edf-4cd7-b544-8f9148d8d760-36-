import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOrg } from "@/lib/auth";
import { clearSessionCookie } from "@/lib/session-helpers";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);

    if (!auth) {
      // Clear invalid cookies
      const response = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      clearSessionCookie(response);
      return response;
    }

    const { org, session } = auth;

    return NextResponse.json({ 
      authenticated: true,
      userType: "org",
      org: {
        id: session.orgId,
        sport: session.sport,
        name: org.name,
      }
    });
  } catch (error) {
    console.error("Org auth check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
