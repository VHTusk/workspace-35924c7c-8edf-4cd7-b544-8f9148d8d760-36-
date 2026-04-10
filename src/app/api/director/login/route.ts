import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createDirectorSession, verifyDirectorPassword } from "@/lib/director-credentials";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const tournament = await db.tournament.findFirst({
      where: {
        directorUsername: username,
      },
      select: {
        id: true,
        name: true,
        sport: true,
        status: true,
        directorPasswordHash: true,
        directorName: true,
      },
    });

    if (!tournament?.directorPasswordHash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await verifyDirectorPassword(password, tournament.directorPasswordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const session = await createDirectorSession(tournament.id);

    return NextResponse.json({
      success: true,
      session,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        sport: tournament.sport,
        status: tournament.status,
        directorName: tournament.directorName || "Director",
      },
      redirectPath: "/director/dashboard",
    });
  } catch (error) {
    console.error("Director login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
