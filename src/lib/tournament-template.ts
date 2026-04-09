/**
 * Tournament Template Library
 * 
 * Provides functions for creating, managing, and using tournament templates.
 * Organizations can save tournament configurations as templates for quick
 * creation of recurring tournaments.
 */

import { db } from '@/lib/db';

// Types
export interface TemplateData {
  name: string;
  sport: 'CORNHOLE' | 'DARTS';
  type?: 'INDIVIDUAL' | 'INTER_ORG' | 'INTRA_ORG';
  format?: 'INDIVIDUAL' | 'DOUBLES' | 'TEAM';
  scope?: 'CITY' | 'DISTRICT' | 'STATE' | 'NATIONAL';
  maxPlayers?: number;
  maxTeams?: number;
  teamSize?: number;
  entryFee?: number;
  earlyBirdFee?: number;
  earlyBirdDeadlineDays?: number;
  groupDiscountMin?: number;
  groupDiscountPercent?: number;
  bracketFormat?: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN';
  ageMin?: number;
  ageMax?: number;
  gender?: 'MALE' | 'FEMALE' | 'MIXED';
  scoringMode?: 'STAFF_ONLY' | 'PLAYER_SELF' | 'HYBRID';
  maxPlayersPerOrg?: number;
  prizePoolDefault?: number;
  regDeadlineDays?: number;
  durationDays?: number;
  isPublic?: boolean;
  defaultLocation?: string;
  defaultCity?: string;
  defaultState?: string;
  description?: string;
  rules?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  recurringDayOfWeek?: number;
  recurringDayOfMonth?: number;
  recurringWeekOfMonth?: number;
  recurringMonthQuarter?: number;
  seriesId?: string;
}

export interface CreateFromTemplateOptions {
  name?: string;
  startDate: Date | string;
  endDate?: Date | string;
  customEntryFee?: number;
  customPrizePool?: number;
  customLocation?: string;
  customCity?: string;
  customState?: string;
}

export interface RecurringSchedule {
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0=Sunday, 6=Saturday
  dayOfMonth?: number; // 1-31
  weekOfMonth?: number; // 1-4 (e.g., 2nd Saturday)
  monthQuarter?: number; // 1,4,7,10 for quarterly
  startDate: Date;
  endDate: Date;
  skipHolidays?: boolean;
}

/**
 * Create a new tournament template
 */
export async function createTemplate(orgId: string, templateData: TemplateData) {
  const template = await db.tournamentTemplate.create({
    data: {
      orgId,
      name: templateData.name,
      sport: templateData.sport,
      type: templateData.type || 'INDIVIDUAL',
      format: templateData.format || 'INDIVIDUAL',
      scope: templateData.scope,
      maxPlayers: templateData.maxPlayers || 64,
      maxTeams: templateData.maxTeams,
      teamSize: templateData.teamSize,
      entryFee: templateData.entryFee || 0,
      earlyBirdFee: templateData.earlyBirdFee,
      earlyBirdDeadlineDays: templateData.earlyBirdDeadlineDays,
      groupDiscountMin: templateData.groupDiscountMin,
      groupDiscountPercent: templateData.groupDiscountPercent,
      bracketFormat: templateData.bracketFormat || 'SINGLE_ELIMINATION',
      ageMin: templateData.ageMin,
      ageMax: templateData.ageMax,
      gender: templateData.gender,
      scoringMode: templateData.scoringMode || 'STAFF_ONLY',
      maxPlayersPerOrg: templateData.maxPlayersPerOrg,
      prizePoolDefault: templateData.prizePoolDefault,
      regDeadlineDays: templateData.regDeadlineDays || 7,
      durationDays: templateData.durationDays || 1,
      isPublic: templateData.isPublic ?? true,
      defaultLocation: templateData.defaultLocation,
      defaultCity: templateData.defaultCity,
      defaultState: templateData.defaultState,
      description: templateData.description,
      rules: templateData.rules,
      isRecurring: templateData.isRecurring || false,
      recurringFrequency: templateData.recurringFrequency,
      recurringDayOfWeek: templateData.recurringDayOfWeek,
      recurringDayOfMonth: templateData.recurringDayOfMonth,
      recurringWeekOfMonth: templateData.recurringWeekOfMonth,
      recurringMonthQuarter: templateData.recurringMonthQuarter,
      seriesId: templateData.seriesId,
    },
  });

  return template;
}

/**
 * Get all templates for an organization
 * Optionally filter by sport
 */
export async function getTemplates(orgId: string, sport?: 'CORNHOLE' | 'DARTS') {
  const where: { orgId: string; sport?: 'CORNHOLE' | 'DARTS'; isActive: boolean } = { 
    orgId, 
    isActive: true 
  };
  if (sport) where.sport = sport;

  const templates = await db.tournamentTemplate.findMany({
    where,
    orderBy: [
      { timesUsed: 'desc' },
      { createdAt: 'desc' }
    ],
    include: {
      series: {
        select: { id: true, name: true, status: true }
      },
      _count: {
        select: { scheduledTournaments: true }
      }
    }
  });

  return templates;
}

/**
 * Get a single template by ID
 */
export async function getTemplate(templateId: string) {
  const template = await db.tournamentTemplate.findUnique({
    where: { id: templateId },
    include: {
      org: { select: { id: true, name: true } },
      series: { select: { id: true, name: true, status: true } },
      scheduledTournaments: {
        where: { status: 'SCHEDULED' },
        orderBy: { scheduledStartDate: 'asc' },
        take: 10,
      },
    },
  });

  if (!template) return null;

  // Get recent tournaments created from this template
  const recentTournaments = await db.tournament.findMany({
    where: { templateId },
    select: {
      id: true,
      name: true,
      startDate: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return {
    ...template,
    recentTournaments,
  };
}

/**
 * Create a tournament from a template
 */
export async function createFromTemplate(
  templateId: string,
  options: CreateFromTemplateOptions
) {
  // Get the template
  const template = await db.tournamentTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const templateOrg = await db.organization.findUnique({
    where: { id: template.orgId },
    select: { name: true, phone: true },
  });

  if (!templateOrg) {
    throw new Error('Template organization not found');
  }

  // Calculate dates
  const startDate = new Date(options.startDate);
  const endDate = options.endDate 
    ? new Date(options.endDate) 
    : new Date(startDate.getTime() + (template.durationDays - 1) * 24 * 60 * 60 * 1000);
  
  // Calculate registration deadline
  const regDeadline = new Date(startDate);
  regDeadline.setDate(regDeadline.getDate() - template.regDeadlineDays);

  // Calculate early bird deadline if applicable
  let earlyBirdDeadline = null;
  if (template.earlyBirdFee && template.earlyBirdDeadlineDays) {
    earlyBirdDeadline = new Date(regDeadline.getTime() + template.earlyBirdDeadlineDays * 24 * 60 * 60 * 1000);
  }

  // Create tournament
  const tournament = await db.tournament.create({
    data: {
      name: options.name || template.name,
      sport: template.sport,
      type: template.type,
      format: template.format,
      scope: template.scope,
      location: options.customLocation || template.defaultLocation || 'TBD',
      managerName: templateOrg.name,
      managerPhone: templateOrg.phone || 'N/A',
      startDate,
      endDate,
      regDeadline,
      prizePool: options.customPrizePool || template.prizePoolDefault || 0,
      maxPlayers: template.maxPlayers,
      entryFee: options.customEntryFee ?? template.entryFee,
      maxPlayersPerOrg: template.maxPlayersPerOrg,
      teamSize: template.teamSize,
      maxTeams: template.maxTeams,
      earlyBirdFee: template.earlyBirdFee,
      earlyBirdDeadline,
      groupDiscountMin: template.groupDiscountMin,
      groupDiscountPercent: template.groupDiscountPercent,
      bracketFormat: template.bracketFormat,
      city: options.customCity || template.defaultCity,
      state: options.customState || template.defaultState,
      orgId: template.orgId,
      ageMin: template.ageMin,
      ageMax: template.ageMax,
      gender: template.gender,
      isPublic: template.isPublic,
      status: 'DRAFT',
      scoringMode: template.scoringMode,
      templateId,
      seriesId: template.seriesId,
    },
  });

  // Update template usage stats
  await db.tournamentTemplate.update({
    where: { id: templateId },
    data: {
      timesUsed: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  return tournament;
}

/**
 * Schedule recurring tournaments from a template
 */
export async function scheduleRecurring(
  templateId: string,
  schedule: RecurringSchedule
) {
  const template = await db.tournamentTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  // Update template as recurring
  await db.tournamentTemplate.update({
    where: { id: templateId },
    data: {
      isRecurring: true,
      recurringFrequency: schedule.frequency,
      recurringDayOfWeek: schedule.dayOfWeek,
      recurringDayOfMonth: schedule.dayOfMonth,
      recurringWeekOfMonth: schedule.weekOfMonth,
      recurringMonthQuarter: schedule.monthQuarter,
    },
  });

  // Generate scheduled dates
  const scheduledDates = generateRecurringDates(schedule);
  
  // Create scheduled tournament records
  const scheduledTournaments = [];
  
  for (const date of scheduledDates) {
    const regDeadline = new Date(date);
    regDeadline.setDate(regDeadline.getDate() - template.regDeadlineDays);

    const scheduled = await db.recurringTournament.create({
      data: {
        templateId,
        scheduledStartDate: date,
        scheduledRegDeadline: regDeadline,
        status: 'SCHEDULED',
      },
    });
    
    scheduledTournaments.push(scheduled);
  }

  return {
    templateId,
    scheduledCount: scheduledTournaments.length,
    scheduledTournaments,
  };
}

/**
 * Update a template
 */
export async function updateTemplate(
  templateId: string,
  orgId: string,
  updateData: Partial<TemplateData>
) {
  // Verify ownership
  const template = await db.tournamentTemplate.findUnique({
    where: { id: templateId },
    select: { orgId: true },
  });

  if (!template || template.orgId !== orgId) {
    throw new Error('Not authorized');
  }

  const updated = await db.tournamentTemplate.update({
    where: { id: templateId },
    data: updateData,
  });

  return updated;
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string, orgId: string) {
  // Verify ownership
  const template = await db.tournamentTemplate.findUnique({
    where: { id: templateId },
    select: { orgId: true },
  });

  if (!template || template.orgId !== orgId) {
    throw new Error('Not authorized');
  }

  // Check for scheduled tournaments
  const scheduledCount = await db.recurringTournament.count({
    where: { templateId, status: 'SCHEDULED' },
  });

  if (scheduledCount > 0) {
    throw new Error('Cannot delete template with scheduled tournaments');
  }

  // Soft delete by setting isActive to false
  await db.tournamentTemplate.update({
    where: { id: templateId },
    data: { isActive: false },
  });

  return { success: true };
}

/**
 * Get upcoming scheduled tournaments for a template
 */
export async function getScheduledTournaments(templateId: string) {
  const scheduled = await db.recurringTournament.findMany({
    where: {
      templateId,
      status: 'SCHEDULED',
      scheduledStartDate: { gte: new Date() },
    },
    orderBy: { scheduledStartDate: 'asc' },
    take: 20,
  });

  return scheduled;
}

/**
 * Cancel a scheduled tournament
 */
export async function cancelScheduledTournament(scheduledId: string) {
  const scheduled = await db.recurringTournament.update({
    where: { id: scheduledId },
    data: { status: 'SKIPPED' },
  });

  return scheduled;
}

/**
 * Process scheduled tournaments that are due
 * This should be called by a cron job
 */
export async function processDueScheduledTournaments() {
  const now = new Date();
  const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead

  const dueScheduled = await db.recurringTournament.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledStartDate: { lte: dueDate },
    },
    include: {
      template: true,
    },
  });

  const results = [];

  for (const scheduled of dueScheduled) {
    try {
      // Create the tournament
      const tournament = await createFromTemplate(scheduled.templateId, {
        startDate: scheduled.scheduledStartDate,
      });

      // Mark as created
      await db.recurringTournament.update({
        where: { id: scheduled.id },
        data: {
          status: 'CREATED',
          tournamentId: tournament.id,
          tournamentCreatedAt: new Date(),
        },
      });

      results.push({ scheduledId: scheduled.id, tournamentId: tournament.id, success: true });
    } catch (error) {
      // Mark as failed
      await db.recurringTournament.update({
        where: { id: scheduled.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      results.push({ scheduledId: scheduled.id, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return results;
}

/**
 * Generate recurring dates based on schedule
 */
function generateRecurringDates(schedule: RecurringSchedule): Date[] {
  const dates: Date[] = [];
  const start = new Date(schedule.startDate);
  const end = new Date(schedule.endDate);

  switch (schedule.frequency) {
    case 'weekly':
      if (schedule.dayOfWeek === undefined) break;
      let current = getNextDayOfWeek(start, schedule.dayOfWeek);
      while (current <= end) {
        dates.push(new Date(current));
        current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      break;

    case 'biweekly':
      if (schedule.dayOfWeek === undefined) break;
      current = getNextDayOfWeek(start, schedule.dayOfWeek);
      while (current <= end) {
        dates.push(new Date(current));
        current = new Date(current.getTime() + 14 * 24 * 60 * 60 * 1000);
      }
      break;

    case 'monthly':
      if (schedule.dayOfMonth) {
        // Specific day of month
        current = new Date(start.getFullYear(), start.getMonth(), schedule.dayOfMonth);
        if (current < start) {
          current = new Date(start.getFullYear(), start.getMonth() + 1, schedule.dayOfMonth);
        }
        while (current <= end) {
          dates.push(new Date(current));
          current = new Date(current.getFullYear(), current.getMonth() + 1, schedule.dayOfMonth);
        }
      } else if (schedule.weekOfMonth !== undefined && schedule.dayOfWeek !== undefined) {
        // Nth day of month (e.g., 2nd Saturday)
        current = getNthDayOfMonth(start.getFullYear(), start.getMonth(), schedule.weekOfMonth, schedule.dayOfWeek);
        if (current < start) {
          current = getNthDayOfMonth(start.getFullYear(), start.getMonth() + 1, schedule.weekOfMonth, schedule.dayOfWeek);
        }
        while (current <= end) {
          dates.push(new Date(current));
          const nextMonth = current.getMonth() + 1;
          current = getNthDayOfMonth(current.getFullYear(), nextMonth, schedule.weekOfMonth, schedule.dayOfWeek);
        }
      }
      break;

    case 'quarterly':
      if (schedule.monthQuarter === undefined || schedule.dayOfMonth === undefined) break;
      // Start from the next quarter month
      const quarterMonths = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct
      let year = start.getFullYear();
      for (const month of quarterMonths) {
        if (month < schedule.monthQuarter) continue;
        const date = new Date(year, month, schedule.dayOfMonth);
        if (date >= start && date <= end) {
          dates.push(date);
        }
      }
      year++;
      while (new Date(year, 0, 1) <= end) {
        for (const month of quarterMonths) {
          const date = new Date(year, month + schedule.monthQuarter, schedule.dayOfMonth);
          if (date <= end) {
            dates.push(date);
          }
        }
        year++;
      }
      break;
  }

  return dates;
}

/**
 * Get the next occurrence of a specific day of week
 */
function getNextDayOfWeek(from: Date, dayOfWeek: number): Date {
  const result = new Date(from);
  const currentDay = result.getDay();
  const daysUntil = (dayOfWeek - currentDay + 7) % 7;
  result.setDate(result.getDate() + daysUntil);
  return result;
}

/**
 * Get the Nth occurrence of a specific day of week in a month
 */
function getNthDayOfMonth(year: number, month: number, n: number, dayOfWeek: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();
  const daysUntil = (dayOfWeek - firstDayOfWeek + 7) % 7;
  const firstOccurrence = daysUntil + 1;
  const nthOccurrence = firstOccurrence + (n - 1) * 7;
  return new Date(year, month, nthOccurrence);
}

/**
 * Get template statistics
 */
export async function getTemplateStats(templateId: string) {
  const template = await db.tournamentTemplate.findUnique({
    where: { id: templateId },
    select: {
      timesUsed: true,
      lastUsedAt: true,
      isRecurring: true,
      recurringFrequency: true,
    },
  });

  if (!template) return null;

  const tournamentsCreated = await db.tournament.count({
    where: { templateId },
  });

  const completedTournaments = await db.tournament.count({
    where: { templateId, status: 'COMPLETED' },
  });

  const scheduledTournaments = await db.recurringTournament.count({
    where: { templateId, status: 'SCHEDULED' },
  });

  const totalRegistrations = await db.tournamentRegistration.count({
    where: {
      tournament: { templateId },
    },
  });

  return {
    timesUsed: template.timesUsed,
    lastUsedAt: template.lastUsedAt,
    tournamentsCreated,
    completedTournaments,
    scheduledTournaments,
    totalRegistrations,
    isRecurring: template.isRecurring,
    recurringFrequency: template.recurringFrequency,
  };
}
