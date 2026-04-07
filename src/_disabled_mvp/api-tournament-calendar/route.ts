/**
 * Tournament Calendar Export API
 * GET /api/tournaments/[id]/calendar
 * 
 * Downloads an ICS calendar file for a tournament
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  generateTournamentICS,
  generateMatchICS,
  getTournamentCalendarFilename,
  type TournamentForCalendar,
} from '@/lib/integrations/calendar'

// ============================================
// GET Handler - Download Tournament Calendar
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        sport: true,
        type: true,
        scope: true,
        location: true,
        city: true,
        state: true,
        startDate: true,
        endDate: true,
        prizePool: true,
        entryFee: true,
        status: true,
      },
    })
    
    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      )
    }
    
    // Check if we should include matches
    const includeMatches = request.nextUrl.searchParams.get('matches') === 'true'
    
    // Format tournament for calendar
    const tournamentData: TournamentForCalendar = {
      ...tournament,
      sport: tournament.sport as string,
      type: tournament.type as string,
      scope: tournament.scope as string | null,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
    }
    
    // Get base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      `${request.nextUrl.protocol}//${request.nextUrl.host}`
    
    let icsContent: string
    
    if (includeMatches) {
      // Get scheduled matches for this tournament
      const matches = await getScheduledMatches(id)
      
      // Generate combined ICS with tournament and matches
      icsContent = await generateCombinedICS(tournamentData, matches, baseUrl)
    } else {
      // Generate tournament-only ICS
      icsContent = generateTournamentICS(tournamentData, baseUrl)
    }
    
    // Generate filename
    const filename = getTournamentCalendarFilename(tournament.name)
    
    // Return ICS file with proper headers
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-API-Version': '1.0',
      },
    })
  } catch (error) {
    console.error('[Calendar API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate calendar file' },
      { status: 500 }
    )
  }
}

// ============================================
// Helper Functions
// ============================================

interface ScheduledMatch {
  id: string
  scheduledAt: Date | null
  courtAssignment: string | null
  playerA: { firstName: string; lastName: string } | null
  playerB: { firstName: string; lastName: string } | null
  tournament: {
    id: string
    name: string
    sport: string
    location: string
    city: string | null
    state: string | null
  }
}

/**
 * Get scheduled matches for a tournament
 */
async function getScheduledMatches(tournamentId: string): Promise<ScheduledMatch[]> {
  const bracketMatches = await db.bracketMatch.findMany({
    where: {
      bracket: { tournamentId },
      scheduledAt: { not: null },
    },
    include: {
      bracket: {
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              sport: true,
              location: true,
              city: true,
              state: true,
            },
          },
        },
      },
      playerA: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      playerB: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      scheduledAt: 'asc',
    },
  })
  
  return bracketMatches.map(m => ({
    id: m.id,
    scheduledAt: m.scheduledAt,
    courtAssignment: m.courtAssignment,
    playerA: m.playerA,
    playerB: m.playerB,
    tournament: {
      ...m.bracket.tournament,
      sport: m.bracket.tournament.sport as string,
    },
  }))
}

/**
 * Generate combined ICS file with tournament and matches
 */
async function generateCombinedICS(
  tournament: TournamentForCalendar,
  matches: ScheduledMatch[],
  baseUrl: string
): Promise<string> {
  const { generateICSFile, generateTournamentCalendarEvent, generateMatchCalendarEvent } = await import('@/lib/integrations/calendar')
  
  const events = []
  
  // Add tournament event
  events.push(generateTournamentCalendarEvent(tournament, baseUrl))
  
  // Add match events
  for (const match of matches) {
    const matchEvent = generateMatchCalendarEvent(match, baseUrl)
    if (matchEvent) {
      events.push(matchEvent)
    }
  }
  
  return generateICSFile(events, `${tournament.name} - VALORHIVE`)
}
