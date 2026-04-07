import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyDirectorPassword } from '@/lib/director-credentials';

// Director login
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Find tournament with this director username
    const tournament = await db.tournament.findFirst({
      where: {
        directorUsername: username.toLowerCase(),
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

    if (!tournament || !tournament.directorPasswordHash) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyDirectorPassword(password, tournament.directorPasswordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create a session for the director
    const session = await db.session.create({
      data: {
        token: `td_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        sport: tournament.sport,
        accountType: 'PLAYER', // Using existing enum
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Log login
    console.log(`Director login: ${username} for tournament ${tournament.name}`);

    return NextResponse.json({
      success: true,
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        directorName: tournament.directorName,
      },
    });
  } catch (error) {
    console.error('Director login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
