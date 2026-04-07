import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';

// GET /api/admin/media/gallery - Get tournament gallery images
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
    const tournamentId = searchParams.get('tournamentId');
    const sport = searchParams.get('sport');
    const category = searchParams.get('category');
    const featuredOnly = searchParams.get('featuredOnly') === 'true';

    const where: Record<string, unknown> = {};
    if (tournamentId) where.tournamentId = tournamentId;
    if (sport) where.sport = sport.toUpperCase();
    if (category) where.category = category;
    if (featuredOnly) where.isFeatured = true;

    const images = await db.tournamentGalleryImage.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { uploadedAt: 'desc' }],
      include: {
        tournament: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Get gallery images error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/media/gallery - Upload a gallery image
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
      tournamentId,
      sport,
      imageUrl,
      thumbnailUrl,
      caption,
      category,
      tags,
      taggedPlayerIds,
      displayOrder,
      isFeatured,
    } = body;

    if (!tournamentId || !imageUrl) {
      return NextResponse.json({ 
        error: 'Tournament ID and imageUrl are required' 
      }, { status: 400 });
    }

    // Get sport from tournament if not provided
    let imageSport = sport;
    if (!imageSport) {
      const tournament = await db.tournament.findUnique({
        where: { id: tournamentId },
        select: { sport: true },
      });
      imageSport = tournament?.sport;
    }

    const image = await db.tournamentGalleryImage.create({
      data: {
        tournamentId,
        sport: (imageSport as string)?.toUpperCase() || 'CORNHOLE',
        imageUrl,
        thumbnailUrl,
        caption,
        category: category || 'GENERAL',
        tags,
        taggedPlayerIds,
        displayOrder: displayOrder || 0,
        isFeatured: isFeatured || false,
        uploadedById: session.user.id,
      },
    });

    return NextResponse.json({ success: true, image });
  } catch (error) {
    console.error('Create gallery image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/media/gallery - Update a gallery image
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

    const image = await db.tournamentGalleryImage.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, image });
  } catch (error) {
    console.error('Update gallery image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/media/gallery - Delete a gallery image
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

    await db.tournamentGalleryImage.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete gallery image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
