// VALORHIVE Media Upload API
// Handles photo and video uploads for tournaments

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { MediaType } from '@prisma/client';
import { validateSession } from '@/lib/auth';

// GET /api/tournaments/[id]/media - Get tournament media gallery
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get('type') as MediaType | null;
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {
      tournamentId,
      isPublic: true,
      approvedAt: { not: null },
    };

    if (type) where.type = type;
    if (category) where.category = category;

    const [mediaItems, totalCount] = await Promise.all([
      db.tournamentMediaItem.findMany({
        where,
        orderBy: { uploadedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          url: true,
          thumbnailUrl: true,
          title: true,
          caption: true,
          category: true,
          duration: true,
          viewCount: true,
          uploadedAt: true,
          isHighlight: true,
          matchId: true,
        },
      }),
      db.tournamentMediaItem.count({ where }),
    ]);

    // Get video highlights separately
    const highlights = await db.videoHighlight.findMany({
      where: { tournamentId, status: 'READY' },
      orderBy: { viewCount: 'desc' },
      take: 10,
      select: {
        id: true,
        clipUrl: true,
        thumbnailUrl: true,
        title: true,
        duration: true,
        highlightType: true,
        viewCount: true,
        shareUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        media: mediaItems,
        highlights,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching tournament media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tournaments/[id]/media - Upload new media
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { id: tournamentId } = await params;
    const body = await request.json();

    const {
      type,
      url,
      thumbnailUrl,
      fileName,
      fileSize,
      mimeType,
      duration,
      title,
      caption,
      description,
      category,
      matchId,
      roundNumber,
      taggedPlayerIds,
      isHighlight,
      highlightType,
    } = body;

    // Validate tournament exists
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, sport: true, status: true },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Create media item
    const mediaItem = await db.tournamentMediaItem.create({
      data: {
        tournamentId,
        sport: tournament.sport,
        type: type as MediaType,
        url,
        thumbnailUrl,
        fileName,
        fileSize,
        mimeType,
        duration,
        title,
        caption,
        description,
        category: category || 'match',
        matchId,
        roundNumber,
        taggedPlayerIds,
        uploadedById: session.userId,
        isHighlight: isHighlight ?? false,
        highlightType,
        // Auto-approve for now (can add moderation later)
        approvedAt: new Date(),
        approvedById: session.userId,
      },
    });

    return NextResponse.json({ success: true, data: mediaItem }, { status: 201 });
  } catch (error) {
    console.error('Error uploading media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/tournaments/[id]/media - Update media item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { mediaId, ...updateData } = body;

    if (!mediaId) {
      return NextResponse.json({ error: 'Media ID required' }, { status: 400 });
    }

    const mediaItem = await db.tournamentMediaItem.update({
      where: { id: mediaId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: mediaItem });
  } catch (error) {
    console.error('Error updating media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/tournaments/[id]/media - Delete media item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('mediaId');

    if (!mediaId) {
      return NextResponse.json({ error: 'Media ID required' }, { status: 400 });
    }

    await db.tournamentMediaItem.delete({
      where: { id: mediaId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
