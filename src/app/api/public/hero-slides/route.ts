import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SportType } from '@prisma/client';

// GET /api/public/hero-slides - Get active hero slides for a sport
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');

    if (!sport) {
      return NextResponse.json({ error: 'Sport parameter is required' }, { status: 400 });
    }

    const normalizedSport = sport.toUpperCase() as SportType;
    if (!['CORNHOLE', 'DARTS'].includes(normalizedSport)) {
      return NextResponse.json({ error: 'Invalid sport parameter' }, { status: 400 });
    }

    const now = new Date();

    const slides = await db.heroSlide.findMany({
      where: {
        sport: normalizedSport,
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } },
            ],
          },
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { uploadedAt: 'desc' }],
      select: {
        id: true,
        title: true,
        subtitle: true,
        caption: true,
        imageUrl: true,
        videoUrl: true,
        thumbnailUrl: true,
        linkUrl: true,
        linkText: true,
        referenceType: true,
        referenceId: true,
      },
    });

    return NextResponse.json({ slides });
  } catch (error) {
    console.error('Get public hero slides error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
