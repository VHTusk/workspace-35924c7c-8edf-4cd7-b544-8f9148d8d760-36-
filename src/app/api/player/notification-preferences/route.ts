import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    // Return existing preferences or defaults
    const prefs = await db.notificationPreference.findUnique({
      where: { userId: session.user.id },
    })

    return NextResponse.json({
      emailNotifications: prefs?.emailNotifications ?? true,
      pushNotifications: prefs?.pushNotifications ?? true,
      matchResultNotifs: prefs?.matchResultNotifs ?? true,
      tournamentNotifs: prefs?.tournamentNotifs ?? true,
      pointsNotifs: prefs?.pointsNotifs ?? true,
    })
  } catch (error) {
    console.error("Error fetching notification preferences:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const session = await validateSession(sessionToken);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 })
    }

    const body = await request.json()
    const {
      emailNotifications,
      pushNotifications,
      matchResultNotifs,
      tournamentNotifs,
      pointsNotifs,
    } = body

    // Upsert notification preferences
    const prefs = await db.notificationPreference.upsert({
      where: { userId: session.userId },
      update: {
        emailNotifications: emailNotifications ?? true,
        pushNotifications: pushNotifications ?? true,
        matchResultNotifs: matchResultNotifs ?? true,
        tournamentNotifs: tournamentNotifs ?? true,
        pointsNotifs: pointsNotifs ?? true,
      },
      create: {
        userId: session.userId,
        emailNotifications: emailNotifications ?? true,
        pushNotifications: pushNotifications ?? true,
        matchResultNotifs: matchResultNotifs ?? true,
        tournamentNotifs: tournamentNotifs ?? true,
        pointsNotifs: pointsNotifs ?? true,
      },
    })

    return NextResponse.json(prefs)
  } catch (error) {
    console.error("Error updating notification preferences:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
