import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await validateSession();

    if (!session.isAuthenticated) {
      return NextResponse.json({
        authenticated: false,
      });
    }

    let displayName: string | null = null;
    let avatarUrl: string | null = null;

    if (session.userId) {
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: {
          firstName: true,
          lastName: true,
          photoUrl: true,
        },
      });

      if (user) {
        displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;
        avatarUrl = user.photoUrl ?? null;
      }
    } else if (session.orgId) {
      const org = await db.organization.findUnique({
        where: { id: session.orgId },
        select: {
          name: true,
          logoUrl: true,
        },
      });

      if (org) {
        displayName = org.name ?? null;
        avatarUrl = org.logoUrl ?? null;
      }
    }

    return NextResponse.json({
      authenticated: true,
      userType: session.userId ? "player" : session.orgId ? "org" : null,
      sport: session.sport ?? null,
      displayName,
      avatarUrl,
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
