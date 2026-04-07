/**
 * API Route: Player Titles Management
 * 
 * GET - Get titles for a player
 * POST - Set primary title
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';
import { getPlayerTitles, setPrimaryTitle, getPrimaryTitle } from '@/lib/titles';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sport = searchParams.get('sport') as SportType;
    const primaryOnly = searchParams.get('primaryOnly') === 'true';

    if (!userId || !sport) {
      return NextResponse.json(
        { error: 'userId and sport are required' },
        { status: 400 }
      );
    }

    if (primaryOnly) {
      const title = await getPrimaryTitle(userId, sport);
      return NextResponse.json({ title });
    }

    const titles = await getPlayerTitles(userId, sport);
    return NextResponse.json({ titles });
  } catch (error) {
    console.error('[API/Titles] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch titles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, titleId, sport } = body;

    if (!userId || !titleId || !sport) {
      return NextResponse.json(
        { error: 'userId, titleId, and sport are required' },
        { status: 400 }
      );
    }

    // Verify the title belongs to this user
    const title = await db.playerTitle.findFirst({
      where: {
        id: titleId,
        userId,
        sport: sport as SportType,
        isActive: true,
      },
    });

    if (!title) {
      return NextResponse.json(
        { error: 'Title not found or not owned by user' },
        { status: 404 }
      );
    }

    await setPrimaryTitle(userId, titleId, sport as SportType);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/Titles] Error:', error);
    return NextResponse.json(
      { error: 'Failed to set primary title' },
      { status: 500 }
    );
  }
}
