import { NextResponse } from "next/server";
import { validateSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await validateSession();

    if (!session.isAuthenticated) {
      return NextResponse.json({
        authenticated: false,
      });
    }

    return NextResponse.json({
      authenticated: true,
      userType: session.userId ? "player" : session.orgId ? "org" : null,
      sport: session.sport ?? null,
    });
  } catch (error) {
    console.error("Landing auth status error:", error);

    return NextResponse.json(
      {
        authenticated: false,
      },
      { status: 200 },
    );
  }
}
