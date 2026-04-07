import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';

// GET /api/admin/media/spotlight - Get player spotlight images
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');
    const sport = searchParams.get('sport');
    const type = searchParams.get('type');
    const featuredOnly = searchParams.get('featuredOnly') === 'true';

    const where: Record<string, unknown> = {};
    if (playerId) where.playerId = playerId;
    if (sport) where.sport = sport.toUpperCase();
    if (type) where.type = type;
    if (featuredOnly) where.isFeatured = true;

    const images = await db.playerSpotlightImage.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { uploadedAt: 'desc' }],
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Get spotlight images error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/media/spotlight - Upload a spotlight image
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      playerId,
      sport,
      imageUrl,
      thumbnailUrl,
      caption,
      type,
      displayOrder,
      isFeatured,
    } = body;

    if (!playerId || !imageUrl) {
      return NextResponse.json({ 
        error: 'Player ID and imageUrl are required' 
      }, { status: 400 });
    }

    // Get sport from player if not provided
    let imageSport = sport;
    if (!imageSport) {
      const player = await db.user.findUnique({
        where: { id: playerId },
        select: { sport: true },
      });
      imageSport = player?.sport;
    }

    const image = await db.playerSpotlightImage.create({
      data: {
        playerId,
        sport: (imageSport as string)?.toUpperCase() || 'CORNHOLE',
        imageUrl,
        thumbnailUrl,
        caption,
        type: type || 'ACTION',
        displayOrder: displayOrder || 0,
        isFeatured: isFeatured || false,
        uploadedById: session.user.id,
      },
    });

    return NextResponse.json({ success: true, image });
  } catch (error) {
    console.error('Create spotlight image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/media/spotlight - Update a spotlight image
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Image ID is required' }, { status: 400 });
    }

    const image = await db.playerSpotlightImage.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, image });
  } catch (error) {
    console.error('Update spotlight image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/media/spotlight - Delete a spotlight image
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Image ID is required' }, { status: 400 });
    }

    await db.playerSpotlightImage.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete spotlight image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
