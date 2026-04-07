import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession, validateOrgSession, hashToken } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Clone Tournament API
 * 
 * POST /api/tournaments/[id]/clone
 * Creates a new tournament by cloning an existing one
 */

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = request.cookies;
    const sessionToken = cookieStore.get('session_token')?.value;

    // Support both org and admin sessions
    let orgId: string | null = null;
    let isAdmin = false;

    if (sessionToken) {
      // Try org session first
      const orgSession = await validateOrgSession(sessionToken);
      if (orgSession?.orgId) {
        orgId = orgSession.orgId;
      } else {
        // Try player session (to check for admin)
        const playerSession = await validateSession(sessionToken);
        if (playerSession?.user?.role === 'ADMIN' || playerSession?.user?.role === 'SUB_ADMIN') {
          isAdmin = true;
        }
      }
    }

    if (!orgId && !isAdmin) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { 
      newName, 
      newStartDate, 
      newEndDate,
      newRegDeadline,
      seriesId, // Optional: link to a series
    } = body;

    // Get the source tournament
    const sourceTournament = await db.tournament.findUnique({
      where: { id },
      include: {
        sponsors: true,
        // Don't include registrations, matches, etc.
      },
    });

    if (!sourceTournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Verify ownership (org must own the tournament, or admin can clone any)
    if (!isAdmin && sourceTournament.orgId !== orgId) {
      return NextResponse.json({ error: 'Not authorized to clone this tournament' }, { status: 403 });
    }

    // Calculate dates
    const startDate = newStartDate ? new Date(newStartDate) : new Date(sourceTournament.startDate);
    const endDate = newEndDate ? new Date(newEndDate) : new Date(sourceTournament.endDate);
    
    let regDeadline: Date;
    if (newRegDeadline) {
      regDeadline = new Date(newRegDeadline);
    } else {
      // Default to 7 days before start
      regDeadline = new Date(startDate);
      regDeadline.setDate(regDeadline.getDate() - 7);
    }

    // Create the cloned tournament
    const clonedTournament = await db.tournament.create({
      data: {
        name: newName || `${sourceTournament.name} (Copy)`,
        sport: sourceTournament.sport,
        type: sourceTournament.type,
        scope: sourceTournament.scope,
        location: sourceTournament.location,
        startDate,
        endDate,
        regDeadline,
        prizePool: sourceTournament.prizePool,
        maxPlayers: sourceTournament.maxPlayers,
        entryFee: sourceTournament.entryFee,
        maxPlayersPerOrg: sourceTournament.maxPlayersPerOrg,
        format: sourceTournament.format,
        teamSize: sourceTournament.teamSize,
        maxTeams: sourceTournament.maxTeams,
        earlyBirdFee: sourceTournament.earlyBirdFee,
        earlyBirdDeadline: sourceTournament.earlyBirdDeadline,
        groupDiscountMin: sourceTournament.groupDiscountMin,
        groupDiscountPercent: sourceTournament.groupDiscountPercent,
        bracketFormat: sourceTournament.bracketFormat,
        city: sourceTournament.city,
        district: sourceTournament.district,
        state: sourceTournament.state,
        orgId: orgId || sourceTournament.orgId,
        ageMin: sourceTournament.ageMin,
        ageMax: sourceTournament.ageMax,
        gender: sourceTournament.gender,
        isPublic: sourceTournament.isPublic,
        status: 'DRAFT',
        scoringMode: sourceTournament.scoringMode,
        rosterLockDate: null,
        templateId: sourceTournament.templateId,
        seriesId: seriesId || sourceTournament.seriesId,
        seriesPoints: sourceTournament.seriesPoints,
        // Clone sponsors if any
        sponsors: sourceTournament.sponsors.length > 0 ? {
          create: sourceTournament.sponsors.map(s => ({
            name: s.name,
            logoUrl: s.logoUrl,
            website: s.website,
            tier: s.tier,
            orgId: s.orgId,
          }))
        } : undefined,
      },
      include: {
        sponsors: true,
      }
    });

    // Update template usage if sourced from template
    if (sourceTournament.templateId) {
      await db.tournamentTemplate.update({
        where: { id: sourceTournament.templateId },
        data: {
          timesUsed: { increment: 1 },
          lastUsedAt: new Date(),
        }
      });
    }

    return NextResponse.json({ 
      tournament: clonedTournament,
      message: 'Tournament cloned successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error cloning tournament:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
