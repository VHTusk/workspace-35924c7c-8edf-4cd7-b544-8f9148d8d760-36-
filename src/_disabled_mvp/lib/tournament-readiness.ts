/**
 * Tournament Readiness Checker
 * Validates tournament setup before starting
 * 
 * v3.43.0 - Prevents starting tournaments with incomplete setup
 */

import { db } from '@/lib/db';

export interface ReadinessCheck {
  id: string;
  label: string;
  status: 'PASS' | 'WARNING' | 'FAIL' | 'SKIP';
  critical: boolean;
  details?: string;
  action?: string;
  autoFixable?: boolean;
}

export interface ReadinessReport {
  tournamentId: string;
  tournamentName: string;
  status: 'READY' | 'WARNING' | 'NOT_READY';
  checks: ReadinessCheck[];
  passCount: number;
  warningCount: number;
  failCount: number;
  canStart: boolean;
  blockingIssues: string[];
}

/**
 * Get full readiness report for a tournament
 */
export async function getTournamentReadiness(tournamentId: string): Promise<ReadinessReport> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: { in: ['CONFIRMED', 'WAITLISTED'] } },
      },
      staff: { where: { isActive: true } },
      bracket: { include: { matches: true } },
      scheduleSlots: true,
      checkins: true,
      sponsors: true,
      prizeDistributions: true,
    },
  });

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  const checks: ReadinessCheck[] = [];

  // 1. Registration Check
  const minPlayers = tournament.format === 'INDIVIDUAL' ? 4 : 2; // At least 2 teams
  checks.push({
    id: 'registrations',
    label: 'Player Registrations',
    status: tournament.registrations.length >= tournament.maxPlayers
      ? 'PASS'
      : tournament.registrations.length >= minPlayers
        ? 'WARNING'
        : 'FAIL',
    critical: true,
    details: `${tournament.registrations.length}/${tournament.maxPlayers} players registered`,
    action: tournament.registrations.length < minPlayers ? 'Need more registrations' : undefined,
  });

  // 2. Director Assignment Check
  const hasHeadDirector = tournament.staff.some(s => s.role === 'HEAD_DIRECTOR');
  checks.push({
    id: 'director_assigned',
    label: 'Head Director Assigned',
    status: hasHeadDirector ? 'PASS' : 'FAIL',
    critical: true,
    details: hasHeadDirector ? 'Head director assigned' : 'No head director assigned',
    action: hasHeadDirector ? undefined : 'Assign a head director before starting',
  });

  // 3. Bracket Generation Check
  const hasBracket = !!tournament.bracket;
  const hasMatches = tournament.bracket?.matches.length ?? 0 > 0;
  checks.push({
    id: 'bracket_generated',
    label: 'Bracket Generated',
    status: hasBracket && hasMatches ? 'PASS' : 'FAIL',
    critical: true,
    details: hasBracket
      ? `${tournament.bracket?.matches.length || 0} matches generated`
      : 'No bracket generated',
    action: !hasBracket ? 'Generate bracket before starting' : undefined,
    autoFixable: !hasBracket,
  });

  // 4. Courts Configured Check
  checks.push({
    id: 'courts_configured',
    label: 'Courts/Venues Configured',
    status: tournament.scheduleSlots.length > 0 ? 'PASS' : 'WARNING',
    critical: false, // Can run without predefined courts
    details: `${tournament.scheduleSlots.length} schedule slots configured`,
    action: tournament.scheduleSlots.length === 0 ? 'Consider setting up schedule slots' : undefined,
  });

  // 5. Venue Confirmed Check
  checks.push({
    id: 'venue_confirmed',
    label: 'Venue Confirmed',
    status: tournament.location ? 'PASS' : 'FAIL',
    critical: true,
    details: tournament.location || 'No venue specified',
    action: !tournament.location ? 'Set venue location' : undefined,
  });

  // 6. Prize Pool Check (if paid tournament)
  const hasPrizes = tournament.prizePool > 0;
  checks.push({
    id: 'prize_confirmed',
    label: 'Prize Pool Confirmed',
    status: tournament.entryFee > 0
      ? hasPrizes
        ? 'PASS'
        : 'WARNING'
      : 'SKIP',
    critical: false,
    details: hasPrizes
      ? `₹${tournament.prizePool} prize pool`
      : tournament.entryFee > 0
        ? 'Paid tournament but no prize pool set'
        : 'Free tournament',
    action: tournament.entryFee > 0 && !hasPrizes ? 'Consider setting prize pool' : undefined,
  });

  // 7. Player Check-ins Check
  const checkedInCount = tournament.checkins.length;
  const checkinRate = tournament.registrations.length > 0
    ? (checkedInCount / tournament.registrations.length) * 100
    : 0;
  checks.push({
    id: 'player_checkins',
    label: 'Player Check-ins',
    status: checkinRate >= 80
      ? 'PASS'
      : checkinRate >= 50
        ? 'WARNING'
        : 'FAIL',
    critical: false, // Not blocking, but important
    details: `${checkedInCount}/${tournament.registrations.length} players checked in (${Math.round(checkinRate)}%)`,
    action: checkinRate < 50 ? 'Many players not checked in' : undefined,
  });

  // 8. Sponsor visibility
  checks.push({
    id: 'sponsors',
    label: 'Tournament Sponsors',
    status: tournament.sponsors.length > 0 ? 'PASS' : 'SKIP',
    critical: false,
    details: `${tournament.sponsors.length} sponsors added`,
  });

  // 9. Entry Fee Collection (if paid)
  const totalCollected = tournament.registrations.reduce((sum, r) => sum + (r.paymentId ? tournament.entryFee : 0), 0);
  checks.push({
    id: 'fee_collection',
    label: 'Entry Fee Collection',
    status: tournament.entryFee > 0
      ? totalCollected > 0
        ? 'PASS'
        : 'WARNING'
      : 'SKIP',
    critical: false,
    details: tournament.entryFee > 0
      ? `₹${totalCollected} collected from registrations`
      : 'Free tournament',
  });

  // 10. Tournament Details Complete
  const hasAllDetails = tournament.managerName && tournament.managerPhone;
  checks.push({
    id: 'details_complete',
    label: 'Tournament Details Complete',
    status: hasAllDetails ? 'PASS' : 'WARNING',
    critical: false,
    details: hasAllDetails ? 'All required details filled' : 'Some details missing',
    action: !hasAllDetails ? 'Complete tournament details' : undefined,
  });

  // Calculate summary
  const passCount = checks.filter(c => c.status === 'PASS').length;
  const warningCount = checks.filter(c => c.status === 'WARNING').length;
  const failCount = checks.filter(c => c.status === 'FAIL').length;

  // Determine if tournament can start
  const criticalFailures = checks.filter(c => c.critical && c.status === 'FAIL');
  const canStart = criticalFailures.length === 0;

  // Get blocking issues
  const blockingIssues = criticalFailures.map(c => c.label);

  // Determine overall status
  let status: 'READY' | 'WARNING' | 'NOT_READY';
  if (criticalFailures.length > 0) {
    status = 'NOT_READY';
  } else if (warningCount > 0) {
    status = 'WARNING';
  } else {
    status = 'READY';
  }

  // Save readiness check to database
  await db.tournamentReadinessCheck.upsert({
    where: { tournamentId },
    create: {
      tournamentId,
      registrationsChecked: true,
      bracketChecked: checks.find(c => c.id === 'bracket_generated')?.status === 'PASS',
      courtsChecked: checks.find(c => c.id === 'courts_configured')?.status === 'PASS',
      directorsChecked: checks.find(c => c.id === 'director_assigned')?.status === 'PASS',
      prizesChecked: checks.find(c => c.id === 'prize_confirmed')?.status !== 'FAIL',
      venueChecked: checks.find(c => c.id === 'venue_confirmed')?.status === 'PASS',
      allChecksPassed: canStart && warningCount === 0,
      checkedAt: new Date(),
    },
    update: {
      registrationsChecked: true,
      bracketChecked: checks.find(c => c.id === 'bracket_generated')?.status === 'PASS',
      courtsChecked: checks.find(c => c.id === 'courts_configured')?.status === 'PASS',
      directorsChecked: checks.find(c => c.id === 'director_assigned')?.status === 'PASS',
      prizesChecked: checks.find(c => c.id === 'prize_confirmed')?.status !== 'FAIL',
      venueChecked: checks.find(c => c.id === 'venue_confirmed')?.status === 'PASS',
      allChecksPassed: canStart && warningCount === 0,
      checkedAt: new Date(),
    },
  });

  return {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    status,
    checks,
    passCount,
    warningCount,
    failCount,
    canStart,
    blockingIssues,
  };
}

/**
 * Quick check if tournament can start
 */
export async function canStartTournament(tournamentId: string): Promise<{
  canStart: boolean;
  blockingIssues: string[];
}> {
  const report = await getTournamentReadiness(tournamentId);
  return {
    canStart: report.canStart,
    blockingIssues: report.blockingIssues,
  };
}

/**
 * Auto-fix issues where possible
 */
export async function autoFixReadinessIssues(tournamentId: string): Promise<{
  fixed: string[];
  remaining: string[];
}> {
  const report = await getTournamentReadiness(tournamentId);
  const fixed: string[] = [];
  const remaining: string[] = [];

  for (const check of report.checks) {
    if (check.status === 'FAIL' && check.autoFixable) {
      // Currently only bracket generation is auto-fixable
      if (check.id === 'bracket_generated') {
        // Bracket generation would be called here
        // For now, just note it as remaining
        remaining.push(check.label);
      }
    } else if (check.status === 'FAIL') {
      remaining.push(check.label);
    }
  }

  return { fixed, remaining };
}
