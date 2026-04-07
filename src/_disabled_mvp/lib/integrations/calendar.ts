/**
 * Calendar Integration for VALORHIVE
 * 
 * Features:
 * - ICS file format generation for tournaments and matches
 * - VCALENDAR and VEVENT components
 * - Timezone support (Asia/Kolkata by default)
 * - Alarms/reminders for events
 * - User calendar feed generation
 */

import { db } from '@/lib/db'

// ============================================
// Types and Interfaces
// ============================================

export interface CalendarEvent {
  uid: string
  summary: string
  description: string
  location: string
  startDate: Date
  endDate: Date
  organizer?: {
    name: string
    email?: string
  }
  url?: string
  alarms?: CalendarAlarm[]
  status?: 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'
  categories?: string[]
}

export interface CalendarAlarm {
  action: 'DISPLAY' | 'AUDIO' | 'EMAIL'
  trigger: number // Minutes before event
  description?: string
}

export interface TournamentForCalendar {
  id: string
  name: string
  sport: string
  type: string
  scope?: string | null
  location: string
  city?: string | null
  state?: string | null
  startDate: Date
  endDate: Date
  prizePool: number
  entryFee: number
  status: string
}

export interface MatchForCalendar {
  id: string
  scheduledAt?: Date | null
  courtAssignment?: string | null
  playerA?: { firstName: string; lastName: string } | null
  playerB?: { firstName: string; lastName: string } | null
  tournament: {
    id: string
    name: string
    sport: string
    location: string
    city?: string | null
    state?: string | null
  }
}

export interface UserCalendarEvent {
  type: 'tournament' | 'match'
  event: TournamentForCalendar | MatchForCalendar
}

// ============================================
// Constants
// ============================================

const ICS_DATE_FORMAT = "yyyyMMdd'T'HHmmss"
const TIMEZONE_ID = 'Asia/Kolkata'
const CALENDAR_PROD_ID = '-//VALORHIVE//Tournament Platform//EN'
const CALENDAR_VERSION = '2.0'

// Default alarm triggers (in minutes before event)
const DEFAULT_TOURNAMENT_ALARMS: CalendarAlarm[] = [
  { action: 'DISPLAY', trigger: 1440, description: 'Tournament starts tomorrow' }, // 1 day before
  { action: 'DISPLAY', trigger: 60, description: 'Tournament starts in 1 hour' }, // 1 hour before
]

const DEFAULT_MATCH_ALARMS: CalendarAlarm[] = [
  { action: 'DISPLAY', trigger: 30, description: 'Match starts in 30 minutes' },
  { action: 'DISPLAY', trigger: 10, description: 'Match starts in 10 minutes' },
]

// ============================================
// Helper Functions
// ============================================

/**
 * Format date for ICS format
 */
function formatICSDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}`
}

/**
 * Escape special characters in ICS text fields
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
}

/**
 * Fold long lines according to ICS spec (max 75 octets per line)
 */
function foldICSLine(line: string): string {
  const MAX_LINE_LENGTH = 75
  if (line.length <= MAX_LINE_LENGTH) {
    return line
  }
  
  const lines: string[] = []
  let remaining = line
  
  while (remaining.length > MAX_LINE_LENGTH) {
    lines.push(remaining.substring(0, MAX_LINE_LENGTH))
    remaining = ' ' + remaining.substring(MAX_LINE_LENGTH)
  }
  
  if (remaining.length > 0) {
    lines.push(remaining)
  }
  
  return lines.join('\r\n')
}

/**
 * Generate VTIMEZONE component for Asia/Kolkata
 */
function generateVTimezone(): string {
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${TIMEZONE_ID}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0530',
    'TZOFFSETTO:+0530',
    'TZNAME:IST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n')
}

/**
 * Generate VALARM component
 */
function generateVAlarm(alarm: CalendarAlarm): string {
  const lines: string[] = [
    'BEGIN:VALARM',
    `ACTION:${alarm.action}`,
    `TRIGGER:-PT${alarm.trigger}M`,
  ]
  
  if (alarm.description) {
    lines.push(`DESCRIPTION:${escapeICSText(alarm.description)}`)
  }
  
  lines.push('END:VALARM')
  
  return lines.join('\r\n')
}

/**
 * Generate VEVENT component
 */
function generateVEvent(event: CalendarEvent): string {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART;TZID=${TIMEZONE_ID}:${formatICSDate(event.startDate)}`,
    `DTEND;TZID=${TIMEZONE_ID}:${formatICSDate(event.endDate)}`,
    `SUMMARY:${escapeICSText(event.summary)}`,
    `DESCRIPTION:${escapeICSText(event.description)}`,
    `LOCATION:${escapeICSText(event.location)}`,
  ]
  
  if (event.organizer) {
    const organizerStr = event.organizer.email
      ? `ORGANIZER;CN=${escapeICSText(event.organizer.name)}:mailto:${event.organizer.email}`
      : `ORGANIZER;CN=${escapeICSText(event.organizer.name)}:noreply@valorhive.com`
    lines.push(organizerStr)
  }
  
  if (event.url) {
    lines.push(`URL:${event.url}`)
  }
  
  if (event.status) {
    lines.push(`STATUS:${event.status}`)
  }
  
  if (event.categories && event.categories.length > 0) {
    lines.push(`CATEGORIES:${event.categories.map(escapeICSText).join(',')}`)
  }
  
  // Add alarms
  if (event.alarms && event.alarms.length > 0) {
    for (const alarm of event.alarms) {
      lines.push(generateVAlarm(alarm))
    }
  }
  
  lines.push('END:VEVENT')
  
  return lines.map(foldICSLine).join('\r\n')
}

/**
 * Generate complete ICS file content
 */
export function generateICSFile(events: CalendarEvent[], calendarName: string = 'VALORHIVE Events'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    `PRODID:${CALENDAR_PROD_ID}`,
    `VERSION:${CALENDAR_VERSION}`,
    `CALSCALE:GREGORIAN`,
    `METHOD:PUBLISH`,
    `X-WR-CALNAME:${escapeICSText(calendarName)}`,
    `X-WR-TIMEZONE:${TIMEZONE_ID}`,
    generateVTimezone(),
  ]
  
  // Add all events
  for (const event of events) {
    lines.push(generateVEvent(event))
  }
  
  lines.push('END:VCALENDAR')
  
  return lines.map(foldICSLine).join('\r\n')
}

// ============================================
// Tournament Calendar Functions
// ============================================

/**
 * Generate calendar event for a tournament
 */
export function generateTournamentCalendarEvent(tournament: TournamentForCalendar, baseUrl: string): CalendarEvent {
  const location = [
    tournament.location,
    tournament.city,
    tournament.state,
  ].filter(Boolean).join(', ')
  
  const description = [
    `${tournament.name}`,
    `Sport: ${tournament.sport}`,
    `Type: ${tournament.type}${tournament.scope ? ` (${tournament.scope})` : ''}`,
    `Prize Pool: ₹${tournament.prizePool.toLocaleString()}`,
    `Entry Fee: ₹${tournament.entryFee}`,
    `Status: ${tournament.status}`,
    '',
    'Register now on VALORHIVE!',
  ].join('\n')
  
  // Set tournament time (default to 9 AM start if not specified)
  const startDate = new Date(tournament.startDate)
  startDate.setHours(9, 0, 0, 0)
  
  const endDate = new Date(tournament.endDate)
  endDate.setHours(18, 0, 0, 0)
  
  return {
    uid: `tournament-${tournament.id}@valorhive.com`,
    summary: `${tournament.name} - ${tournament.sport} Tournament`,
    description,
    location,
    startDate,
    endDate,
    url: `${baseUrl}/tournaments/${tournament.id}`,
    status: tournament.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
    categories: [tournament.sport, 'Tournament', tournament.type],
    alarms: DEFAULT_TOURNAMENT_ALARMS,
  }
}

/**
 * Generate ICS file content for a tournament
 */
export function generateTournamentICS(tournament: TournamentForCalendar, baseUrl: string): string {
  const event = generateTournamentCalendarEvent(tournament, baseUrl)
  return generateICSFile([event], `${tournament.name} - VALORHIVE`)
}

// ============================================
// Match Calendar Functions
// ============================================

/**
 * Generate calendar event for a match
 */
export function generateMatchCalendarEvent(match: MatchForCalendar, baseUrl: string): CalendarEvent | null {
  // If match has no scheduled time, return null
  if (!match.scheduledAt) {
    return null
  }
  
  const location = [
    match.tournament.location,
    match.tournament.city,
    match.tournament.state,
    match.courtAssignment ? `Court: ${match.courtAssignment}` : null,
  ].filter(Boolean).join(', ')
  
  const playerAName = match.playerA 
    ? `${match.playerA.firstName} ${match.playerA.lastName}`
    : 'TBD'
  const playerBName = match.playerB
    ? `${match.playerB.firstName} ${match.playerB.lastName}`
    : 'TBD'
  
  const description = [
    `Tournament: ${match.tournament.name}`,
    `Match: ${playerAName} vs ${playerBName}`,
    `Sport: ${match.tournament.sport}`,
    match.courtAssignment ? `Court: ${match.courtAssignment}` : '',
    '',
    'View match details on VALORHIVE',
  ].filter(Boolean).join('\n')
  
  // Match duration: 30 minutes for most matches
  const startDate = new Date(match.scheduledAt)
  const endDate = new Date(match.scheduledAt)
  endDate.setMinutes(endDate.getMinutes() + 30)
  
  return {
    uid: `match-${match.id}@valorhive.com`,
    summary: `${playerAName} vs ${playerBName} - ${match.tournament.name}`,
    description,
    location,
    startDate,
    endDate,
    url: `${baseUrl}/tournaments/${match.tournament.id}`,
    categories: [match.tournament.sport, 'Match'],
    alarms: DEFAULT_MATCH_ALARMS,
  }
}

/**
 * Generate ICS file content for a match
 */
export function generateMatchICS(match: MatchForCalendar, baseUrl: string): string | null {
  const event = generateMatchCalendarEvent(match, baseUrl)
  if (!event) {
    return null
  }
  return generateICSFile([event], `${match.tournament.name} Match - VALORHIVE`)
}

// ============================================
// User Calendar Feed Functions
// ============================================

/**
 * Get user's upcoming tournaments
 */
async function getUserUpcomingTournaments(userId: string): Promise<TournamentForCalendar[]> {
  const now = new Date()
  
  const registrations = await db.tournamentRegistration.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      tournament: {
        endDate: { gte: now },
        status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
      },
    },
    include: {
      tournament: {
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
      },
    },
    orderBy: {
      tournament: {
        startDate: 'asc',
      },
    },
  })
  
  return registrations.map(r => ({
    ...r.tournament,
    sport: r.tournament.sport as string,
    type: r.tournament.type as string,
    scope: r.tournament.scope as string | null,
    startDate: r.tournament.startDate,
    endDate: r.tournament.endDate,
  }))
}

/**
 * Get user's upcoming matches
 */
async function getUserUpcomingMatches(userId: string): Promise<MatchForCalendar[]> {
  const now = new Date()
  
  // Get matches where user is playerA or playerB
  const bracketMatches = await db.bracketMatch.findMany({
    where: {
      OR: [
        { playerAId: userId },
        { playerBId: userId },
      ],
      status: 'PENDING',
      scheduledAt: { gte: now },
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
    take: 50,
  })
  
  return bracketMatches.map(m => ({
    id: m.id,
    scheduledAt: m.scheduledAt,
    courtAssignment: m.courtAssignment,
    playerA: m.playerA,
    playerB: m.playerB,
    tournament: {
      id: m.bracket.tournament.id,
      name: m.bracket.tournament.name,
      sport: m.bracket.tournament.sport as string,
      location: m.bracket.tournament.location,
      city: m.bracket.tournament.city,
      state: m.bracket.tournament.state,
    },
  }))
}

/**
 * Generate user's calendar feed with all upcoming events
 */
export async function generateCalendarFeed(userId: string, baseUrl: string): Promise<string> {
  const events: CalendarEvent[] = []
  
  // Get upcoming tournaments
  const tournaments = await getUserUpcomingTournaments(userId)
  for (const tournament of tournaments) {
    events.push(generateTournamentCalendarEvent(tournament, baseUrl))
  }
  
  // Get upcoming matches
  const matches = await getUserUpcomingMatches(userId)
  for (const match of matches) {
    const matchEvent = generateMatchCalendarEvent(match, baseUrl)
    if (matchEvent) {
      events.push(matchEvent)
    }
  }
  
  // Sort events by start date
  events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  
  return generateICSFile(events, 'My VALORHIVE Schedule')
}

/**
 * Get calendar feed URL for a user
 */
export function getCalendarFeedUrl(userId: string, baseUrl: string): string {
  return `${baseUrl}/api/calendar/feed?userId=${userId}`
}

// ============================================
// Organization Calendar Functions
// ============================================

/**
 * Get organization's upcoming tournaments
 */
export async function getOrgUpcomingTournaments(orgId: string): Promise<TournamentForCalendar[]> {
  const now = new Date()
  
  const tournaments = await db.tournament.findMany({
    where: {
      orgId,
      endDate: { gte: now },
      status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'IN_PROGRESS'] },
    },
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
    orderBy: {
      startDate: 'asc',
    },
  })
  
  return tournaments.map(t => ({
    ...t,
    sport: t.sport as string,
    type: t.type as string,
    scope: t.scope as string | null,
    startDate: t.startDate,
    endDate: t.endDate,
  }))
}

/**
 * Generate organization's calendar feed
 */
export async function generateOrgCalendarFeed(orgId: string, baseUrl: string): Promise<string> {
  const events: CalendarEvent[] = []
  
  const tournaments = await getOrgUpcomingTournaments(orgId)
  for (const tournament of tournaments) {
    events.push(generateTournamentCalendarEvent(tournament, baseUrl))
  }
  
  // Sort events by start date
  events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  
  return generateICSFile(events, 'VALORHIVE Organization Events')
}

// ============================================
// Export Utilities
// ============================================

/**
 * Get filename for tournament ICS download
 */
export function getTournamentCalendarFilename(tournamentName: string): string {
  const sanitizedName = tournamentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  
  return `${sanitizedName}-tournament.ics`
}

/**
 * Get filename for match ICS download
 */
export function getMatchCalendarFilename(matchId: string): string {
  return `match-${matchId}.ics`
}

/**
 * Get filename for user calendar feed
 */
export function getUserCalendarFilename(userId: string): string {
  return `valorhive-schedule-${userId}.ics`
}
