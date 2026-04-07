import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// GET /api/player/trophies - Get player trophy cabinet
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = auth;

    const { searchParams } = new URL(request.url);
    const featuredOnly = searchParams.get('featured') === 'true';
    const userId = searchParams.get('userId') || user.id;

    const where: Record<string, unknown> = {
      userId,
      sport: user.sport,
    };

    if (featuredOnly) {
      where.isFeatured = true;
    }

    const trophies = await db.playerTrophy.findMany({
      where,
      orderBy: [
        { displayOrder: 'asc' },
        { earnedAt: 'desc' },
      ],
    });

    // Get tournament results to generate missing trophies
    const tournamentResults = await db.tournamentResult.findMany({
      where: {
        userId,
        sport: user.sport,
        rank: { lte: 3 }, // Top 3
      },
      include: {
        tournament: {
          select: { id: true, name: true, scope: true },
        },
      },
      orderBy: { awardedAt: 'desc' },
    });

    // Generate trophy objects for results without trophies
    const missingTrophies = tournamentResults.filter(
      result => !trophies.some(t => t.tournamentId === result.tournamentId)
    );

    if (missingTrophies.length > 0) {
      for (const result of missingTrophies) {
        const trophyType = result.rank === 1 ? 'GOLD' : result.rank === 2 ? 'SILVER' : 'BRONZE';
        const title = result.rank === 1 
          ? `Champion - ${result.tournament?.name}`
          : result.rank === 2 
          ? `Runner-up - ${result.tournament?.name}`
          : `3rd Place - ${result.tournament?.name}`;

        await db.playerTrophy.create({
          data: {
            userId,
            sport: user.sport,
            tournamentId: result.tournamentId,
            title,
            description: `${result.tournament?.scope?.charAt(0) || 'C'}${(result.tournament?.scope?.slice(1) || 'ity').toLowerCase()} level tournament`,
            trophyType,
            position: result.rank,
            earnedAt: result.awardedAt,
          },
        });
      }

      // Re-fetch trophies
      const updatedTrophies = await db.playerTrophy.findMany({
        where,
        orderBy: [
          { displayOrder: 'asc' },
          { earnedAt: 'desc' },
        ],
      });

      return NextResponse.json({
        trophies: updatedTrophies,
        stats: {
          total: updatedTrophies.length,
          gold: updatedTrophies.filter(t => t.trophyType === 'GOLD').length,
          silver: updatedTrophies.filter(t => t.trophyType === 'SILVER').length,
          bronze: updatedTrophies.filter(t => t.trophyType === 'BRONZE').length,
          featured: updatedTrophies.filter(t => t.isFeatured).length,
        },
      });
    }

    return NextResponse.json({
      trophies,
      stats: {
        total: trophies.length,
        gold: trophies.filter(t => t.trophyType === 'GOLD').length,
        silver: trophies.filter(t => t.trophyType === 'SILVER').length,
        bronze: trophies.filter(t => t.trophyType === 'BRONZE').length,
        featured: trophies.filter(t => t.isFeatured).length,
      },
    });
  } catch (error) {
    console.error('Get trophies error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/player/trophies - Feature/unfeature a trophy
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = auth;

    const body = await request.json();
    const { trophyId, isFeatured, displayOrder } = body;

    const trophy = await db.playerTrophy.findFirst({
      where: {
        id: trophyId,
        userId: user.id,
      },
    });

    if (!trophy) {
      return NextResponse.json({ error: 'Trophy not found' }, { status: 404 });
    }

    const updatedTrophy = await db.playerTrophy.update({
      where: { id: trophyId },
      data: {
        isFeatured: isFeatured ?? trophy.isFeatured,
        displayOrder: displayOrder ?? trophy.displayOrder,
      },
    });

    return NextResponse.json({ success: true, trophy: updatedTrophy });
  } catch (error) {
    console.error('Update trophy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/player/trophies/share - Track trophy share
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = auth;

    const body = await request.json();
    const { trophyId } = body;

    const trophy = await db.playerTrophy.findFirst({
      where: {
        id: trophyId,
        userId: user.id,
      },
    });

    if (!trophy) {
      return NextResponse.json({ error: 'Trophy not found' }, { status: 404 });
    }

    const updatedTrophy = await db.playerTrophy.update({
      where: { id: trophyId },
      data: {
        shareCount: { increment: 1 },
        lastSharedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, shareCount: updatedTrophy.shareCount });
  } catch (error) {
    console.error('Share trophy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
