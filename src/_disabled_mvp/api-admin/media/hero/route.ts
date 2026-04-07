import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/auth';

// GET /api/admin/media/hero - Get all hero slides
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth || auth.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: Record<string, unknown> = {};
    if (sport) where.sport = sport.toUpperCase();
    if (activeOnly) where.isActive = true;

    const slides = await db.heroSlide.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { uploadedAt: 'desc' }],
    });

    return NextResponse.json({ slides });
  } catch (error) {
    console.error('Get hero slides error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/media/hero - Create a new hero slide
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth || auth.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = auth;

    const body = await request.json();
    const {
      sport,
      title,
      subtitle,
      caption,
      imageUrl,
      videoUrl,
      thumbnailUrl,
      linkUrl,
      linkText,
      referenceType,
      referenceId,
      displayOrder,
      startDate,
      endDate,
    } = body;

    if (!sport || !title || !imageUrl) {
      return NextResponse.json({ 
        error: 'Sport, title, and imageUrl are required' 
      }, { status: 400 });
    }

    const slide = await db.heroSlide.create({
      data: {
        sport: sport.toUpperCase(),
        title,
        subtitle,
        caption,
        imageUrl,
        videoUrl,
        thumbnailUrl,
        linkUrl,
        linkText,
        referenceType,
        referenceId,
        displayOrder: displayOrder || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        uploadedById: user.id,
      },
    });

    return NextResponse.json({ success: true, slide });
  } catch (error) {
    console.error('Create hero slide error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/media/hero - Update a hero slide
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth || auth.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Slide ID is required' }, { status: 400 });
    }

    // Convert dates if provided
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

    const slide = await db.heroSlide.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, slide });
  } catch (error) {
    console.error('Update hero slide error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/media/hero - Delete a hero slide
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth || auth.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Slide ID is required' }, { status: 400 });
    }

    await db.heroSlide.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete hero slide error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
