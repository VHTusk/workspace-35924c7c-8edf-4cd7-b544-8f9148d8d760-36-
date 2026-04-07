/**
 * V1 Tournament by ID API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/tournaments/:id
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "tournament_id",
 *     "name": "Tournament Name",
 *     ...
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getCDNUrl } from '@/lib/cdn-url';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        sport: true,
        type: true,
        scope: true,
        format: true,
        city: true,
        district: true,
        state: true,
        location: true,
        venueGoogleMapsUrl: true,
        startDate: true,
        endDate: true,
        regDeadline: true,
        prizePool: true,
        maxPlayers: true,
        maxTeams: true,
        teamSize: true,
        entryFee: true,
        earlyBirdFee: true,
        earlyBirdDeadline: true,
        groupDiscountMin: true,
        groupDiscountPercent: true,
        bracketFormat: true,
        status: true,
        isPublic: true,
        bannerImage: true,
        managerName: true,
        managerPhone: true,
        managerWhatsApp: true,
        showDirectorContact: true,
        autopilotEnabled: true,
        scoringMode: true,
        gender: true,
        ageMin: true,
        ageMax: true,
        isProfessionExclusive: true,
        allowedProfessions: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            registrations: true,
            teamRegistrations: true,
            matches: true,
          },
        },
        hostOrg: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!tournament) {
      return apiError(
        ApiErrorCodes.NOT_FOUND,
        'Tournament not found',
        { id },
        404
      );
    }

    // Calculate available spots
    const registeredCount = tournament.format === 'INDIVIDUAL'
      ? tournament._count.registrations
      : tournament._count.teamRegistrations;
    const maxCount = tournament.format === 'INDIVIDUAL'
      ? tournament.maxPlayers
      : tournament.maxTeams;
    const availableSpots = maxCount ? Math.max(0, maxCount - registeredCount) : null;

    const response = NextResponse.json({
      success: true,
      data: {
        id: tournament.id,
        name: tournament.name,
        sport: tournament.sport,
        type: tournament.type,
        scope: tournament.scope,
        format: tournament.format,
        location: {
          venue: tournament.location,
          city: tournament.city,
          district: tournament.district,
          state: tournament.state,
          googleMapsUrl: tournament.venueGoogleMapsUrl,
        },
        dates: {
          start: tournament.startDate?.toISOString() || null,
          end: tournament.endDate?.toISOString() || null,
          registrationDeadline: tournament.regDeadline?.toISOString() || null,
        },
        pricing: {
          entryFee: tournament.entryFee,
          earlyBirdFee: tournament.earlyBirdFee,
          earlyBirdDeadline: tournament.earlyBirdDeadline?.toISOString() || null,
          groupDiscount: tournament.groupDiscountMin ? {
            minimum: tournament.groupDiscountMin,
            percent: tournament.groupDiscountPercent,
          } : null,
        },
        competition: {
          prizePool: tournament.prizePool,
          bracketFormat: tournament.bracketFormat,
          scoringMode: tournament.scoringMode,
        },
        capacity: {
          maxPlayers: tournament.maxPlayers,
          maxTeams: tournament.maxTeams,
          teamSize: tournament.teamSize,
          registered: registeredCount,
          availableSpots,
        },
        eligibility: {
          gender: tournament.gender,
          ageMin: tournament.ageMin,
          ageMax: tournament.ageMax,
          isProfessionExclusive: tournament.isProfessionExclusive,
          allowedProfessions: tournament.allowedProfessions
            ? JSON.parse(tournament.allowedProfessions)
            : [],
        },
        status: tournament.status,
        isPublic: tournament.isPublic,
        autopilotEnabled: tournament.autopilotEnabled,
        bannerImage: getCDNUrl(tournament.bannerImage),
        contact: tournament.showDirectorContact ? {
          manager: {
            name: tournament.managerName,
            phone: tournament.managerPhone,
            whatsapp: tournament.managerWhatsApp || tournament.managerPhone,
          },
        } : null,
        hostOrganization: tournament.hostOrg,
        createdAt: tournament.createdAt.toISOString(),
        updatedAt: tournament.updatedAt.toISOString(),
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    // Add v1 headers
    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');

    return response;
  } catch (error) {
    console.error('[V1 Tournament] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch tournament',
      undefined,
      500
    );
  }
}
