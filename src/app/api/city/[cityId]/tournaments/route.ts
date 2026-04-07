/**
 * City Tournaments API
 * GET /api/city/[cityId]/tournaments - Get upcoming tournaments (Module 4)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCityTournaments } from '@/lib/city-utils';
import { SportType } from '@prisma/client';

// GET /api/city/[cityId]/tournaments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cityId: string }> }
) {
  try {
    const { cityId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status'); // Filter by status
    const includePast = searchParams.get('includePast') === 'true';

    // Find city
    let city = await db.city.findUnique({
      where: { cityId },
    });

    if (!city) {
      city = await db.city.findUnique({
        where: { id: cityId },
      });
    }

    if (!city) {
      return NextResponse.json(
        { success: false, error: 'City not found' },
        { status: 404 }
      );
    }

    // Build where clause
    const now = new Date();
    const where: Record<string, unknown> = {
      sport: city.sport,
      city: city.cityName,
      state: city.state,
      isPublic: true,
    };

    if (status) {
      where.status = status;
    } else {
      // Default: show upcoming and in-progress tournaments
      where.OR = [
        { status: 'REGISTRATION_OPEN' },
        { status: 'BRACKET_GENERATED' },
        { status: 'IN_PROGRESS' },
        ...(includePast ? [{ status: 'COMPLETED' }] : []),
      ];
    }

    if (!includePast) {
      where.startDate = { gte: now };
    }

    // Get tournaments
    const tournaments = await db.tournament.findMany({
      where,
      orderBy: { startDate: 'asc' },
      take: limit,
      include: {
        hostOrg: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: { registrations: true },
        },
      },
    });

    // Format response
    const formattedTournaments = tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      sport: t.sport,
      type: t.type,
      scope: t.scope,
      format: t.format,
      startDate: t.startDate,
      endDate: t.endDate,
      regDeadline: t.regDeadline,
      location: t.location,
      city: t.city,
      state: t.state,
      prizePool: t.prizePool,
      entryFee: t.entryFee,
      maxPlayers: t.maxPlayers,
      status: t.status,
      organizer: t.hostOrg?.name || 'ValorHive',
      organizerType: t.hostOrg?.type || 'ASSOCIATION',
      participants: t._count.registrations,
      isRegistrationOpen: t.status === 'REGISTRATION_OPEN' && t.regDeadline > now,
    }));

    return NextResponse.json({
      success: true,
      data: {
        city: {
          id: city.id,
          cityId: city.cityId,
          cityName: city.cityName,
          state: city.state,
          sport: city.sport,
        },
        tournaments: formattedTournaments,
        count: formattedTournaments.length,
      },
    });
  } catch (error) {
    console.error('Error fetching city tournaments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch city tournaments' },
      { status: 500 }
    );
  }
}
