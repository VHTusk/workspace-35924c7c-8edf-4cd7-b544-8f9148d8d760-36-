import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';
import { 
  createFromTemplate, 
  scheduleRecurring,
  getTemplateStats,
  CreateFromTemplateOptions,
  RecurringSchedule
} from '@/lib/tournament-template';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Organization Tournament Template Create API
 * 
 * POST: Create a tournament from template
 * POST with ?action=schedule: Schedule recurring tournaments
 * GET: Get template statistics
 */

// GET - Get template statistics
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);

    if (!session?.orgId) {
      return NextResponse.json({ error: 'Organization session required' }, { status: 403 });
    }

    const { id } = await params;

    // Verify template ownership
    const template = await db.tournamentTemplate.findUnique({
      where: { id },
      select: { orgId: true }
    });

    if (!template || template.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Template not found or not authorized' }, { status: 404 });
    }

    const stats = await getTemplateStats(id);

    return NextResponse.json({ 
      success: true,
      stats 
    });
  } catch (error) {
    console.error('Error fetching template stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create tournament from template or schedule recurring
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);

    if (!session?.orgId) {
      return NextResponse.json({ error: 'Organization session required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'create';

    // Verify template ownership
    const template = await db.tournamentTemplate.findUnique({
      where: { id },
      select: { orgId: true }
    });

    if (!template || template.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Template not found or not authorized' }, { status: 404 });
    }

    if (action === 'schedule') {
      // Schedule recurring tournaments
      const scheduleData: RecurringSchedule = {
        frequency: body.frequency,
        dayOfWeek: body.dayOfWeek,
        dayOfMonth: body.dayOfMonth,
        weekOfMonth: body.weekOfMonth,
        monthQuarter: body.monthQuarter,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        skipHolidays: body.skipHolidays,
      };

      const result = await scheduleRecurring(id, scheduleData);

      return NextResponse.json({ 
        success: true,
        message: `Scheduled ${result.scheduledCount} tournaments`,
        ...result 
      }, { status: 201 });
    } else {
      // Create a single tournament from template
      const options: CreateFromTemplateOptions = {
        name: body.name,
        startDate: body.startDate,
        endDate: body.endDate,
        customEntryFee: body.customEntryFee,
        customPrizePool: body.customPrizePool,
        customLocation: body.customLocation,
        customCity: body.customCity,
        customState: body.customState,
      };

      const tournament = await createFromTemplate(id, options);

      return NextResponse.json({ 
        success: true,
        message: 'Tournament created successfully',
        tournament 
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating tournament from template:', error);
    if (error instanceof Error && error.message === 'Template not found') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
