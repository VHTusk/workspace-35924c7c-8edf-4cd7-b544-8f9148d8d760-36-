import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const template = await db.tournamentTemplate.findUnique({
      where: { id },
      include: {
        org: { select: { id: true, name: true } },
        series: { select: { id: true, name: true } },
        scheduledTournaments: {
          where: { status: 'SCHEDULED' },
          orderBy: { scheduledStartDate: 'asc' },
          take: 10,
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Get tournaments created from this template
    const tournaments = await db.tournament.findMany({
      where: { templateId: id },
      select: {
        id: true,
        name: true,
        startDate: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({ 
      template: {
        ...template,
        recentTournaments: tournaments,
      }
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = request.cookies;
    const orgSessionToken = cookieStore.get('session_token')?.value;

    if (!orgSessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateOrgSession(orgSessionToken);

    if (!session) {
      return NextResponse.json({ error: 'Organization session required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existingTemplate = await db.tournamentTemplate.findUnique({
      where: { id },
      select: { orgId: true }
    });

    if (!existingTemplate || existingTemplate.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const {
      name,
      type,
      format,
      scope,
      maxPlayers,
      maxTeams,
      teamSize,
      entryFee,
      earlyBirdFee,
      earlyBirdDeadlineDays,
      groupDiscountMin,
      groupDiscountPercent,
      bracketFormat,
      ageMin,
      ageMax,
      gender,
      scoringMode,
      maxPlayersPerOrg,
      prizePoolDefault,
      regDeadlineDays,
      durationDays,
      isPublic,
      defaultLocation,
      defaultCity,
      defaultState,
      description,
      rules,
      isRecurring,
      recurringFrequency,
      recurringDayOfWeek,
      recurringDayOfMonth,
      recurringWeekOfMonth,
      recurringMonthQuarter,
      seriesId,
      isActive,
    } = body;

    const updateData: any = {};
    
    // Basic info
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (format !== undefined) updateData.format = format;
    if (scope !== undefined) updateData.scope = scope;
    
    // Player/team limits
    if (maxPlayers !== undefined) updateData.maxPlayers = maxPlayers;
    if (maxTeams !== undefined) updateData.maxTeams = maxTeams;
    if (teamSize !== undefined) updateData.teamSize = teamSize;
    
    // Fees
    if (entryFee !== undefined) updateData.entryFee = entryFee;
    if (earlyBirdFee !== undefined) updateData.earlyBirdFee = earlyBirdFee;
    if (earlyBirdDeadlineDays !== undefined) updateData.earlyBirdDeadlineDays = earlyBirdDeadlineDays;
    if (groupDiscountMin !== undefined) updateData.groupDiscountMin = groupDiscountMin;
    if (groupDiscountPercent !== undefined) updateData.groupDiscountPercent = groupDiscountPercent;
    
    // Format
    if (bracketFormat !== undefined) updateData.bracketFormat = bracketFormat;
    
    // Eligibility
    if (ageMin !== undefined) updateData.ageMin = ageMin;
    if (ageMax !== undefined) updateData.ageMax = ageMax;
    if (gender !== undefined) updateData.gender = gender;
    
    // Settings
    if (scoringMode !== undefined) updateData.scoringMode = scoringMode;
    if (maxPlayersPerOrg !== undefined) updateData.maxPlayersPerOrg = maxPlayersPerOrg;
    if (prizePoolDefault !== undefined) updateData.prizePoolDefault = prizePoolDefault;
    if (regDeadlineDays !== undefined) updateData.regDeadlineDays = regDeadlineDays;
    if (durationDays !== undefined) updateData.durationDays = durationDays;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    
    // Location
    if (defaultLocation !== undefined) updateData.defaultLocation = defaultLocation;
    if (defaultCity !== undefined) updateData.defaultCity = defaultCity;
    if (defaultState !== undefined) updateData.defaultState = defaultState;
    
    // Description
    if (description !== undefined) updateData.description = description;
    if (rules !== undefined) updateData.rules = rules;
    
    // Recurring
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
    if (recurringFrequency !== undefined) updateData.recurringFrequency = recurringFrequency;
    if (recurringDayOfWeek !== undefined) updateData.recurringDayOfWeek = recurringDayOfWeek;
    if (recurringDayOfMonth !== undefined) updateData.recurringDayOfMonth = recurringDayOfMonth;
    if (recurringWeekOfMonth !== undefined) updateData.recurringWeekOfMonth = recurringWeekOfMonth;
    if (recurringMonthQuarter !== undefined) updateData.recurringMonthQuarter = recurringMonthQuarter;
    
    // Series linkage
    if (seriesId !== undefined) updateData.seriesId = seriesId;
    
    // Status
    if (isActive !== undefined) updateData.isActive = isActive;

    const template = await db.tournamentTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = request.cookies;
    const orgSessionToken = cookieStore.get('session_token')?.value;

    if (!orgSessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateOrgSession(orgSessionToken);

    if (!session) {
      return NextResponse.json({ error: 'Organization session required' }, { status: 403 });
    }

    const { id } = await params;

    // Verify ownership
    const existingTemplate = await db.tournamentTemplate.findUnique({
      where: { id },
      select: { orgId: true }
    });

    if (!existingTemplate || existingTemplate.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Check for scheduled tournaments
    const scheduledCount = await db.recurringTournament.count({
      where: { templateId: id, status: 'SCHEDULED' }
    });

    if (scheduledCount > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete template with scheduled tournaments. Cancel them first.' 
      }, { status: 400 });
    }

    await db.tournamentTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create tournament from template
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = request.cookies;
    const orgSessionToken = cookieStore.get('session_token')?.value;

    if (!orgSessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateOrgSession(orgSessionToken);

    if (!session) {
      return NextResponse.json({ error: 'Organization session required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      startDate,
      endDate,
      customEntryFee,
      customPrizePool,
    } = body;

    // Get the template
    const template = await db.tournamentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Calculate dates
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + (template.durationDays - 1) * 24 * 60 * 60 * 1000);
    
    // Calculate registration deadline
    const regDeadline = new Date(start);
    regDeadline.setDate(regDeadline.getDate() - template.regDeadlineDays);

    // Create tournament from template
    const tournament = await db.tournament.create({
      data: {
        name: name || template.name,
        sport: template.sport,
        type: template.type,
        format: template.format,
        scope: template.scope,
        location: template.defaultLocation || 'TBD',
        startDate: start,
        endDate: end,
        regDeadline,
        prizePool: customPrizePool || template.prizePoolDefault || 0,
        maxPlayers: template.maxPlayers,
        entryFee: customEntryFee || template.entryFee,
        maxPlayersPerOrg: template.maxPlayersPerOrg,
        teamSize: template.teamSize,
        maxTeams: template.maxTeams,
        earlyBirdFee: template.earlyBirdFee,
        earlyBirdDeadline: template.earlyBirdDeadlineDays 
          ? new Date(regDeadline.getTime() + template.earlyBirdDeadlineDays * 24 * 60 * 60 * 1000)
          : null,
        groupDiscountMin: template.groupDiscountMin,
        groupDiscountPercent: template.groupDiscountPercent,
        bracketFormat: template.bracketFormat,
        city: template.defaultCity,
        district: null,
        state: template.defaultState,
        orgId: session.orgId,
        ageMin: template.ageMin,
        ageMax: template.ageMax,
        gender: template.gender,
        isPublic: template.isPublic,
        status: 'DRAFT',
        scoringMode: template.scoringMode,
        templateId: id,
        seriesId: template.seriesId,
      },
    });

    // Update template usage
    await db.tournamentTemplate.update({
      where: { id },
      data: {
        timesUsed: { increment: 1 },
        lastUsedAt: new Date(),
      }
    });

    return NextResponse.json({ tournament }, { status: 201 });
  } catch (error) {
    console.error('Error creating tournament from template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
