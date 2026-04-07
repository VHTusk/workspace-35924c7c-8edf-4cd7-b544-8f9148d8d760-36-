import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';
import { 
  getTemplate, 
  updateTemplate, 
  deleteTemplate,
  TemplateData 
} from '@/lib/tournament-template';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Organization Tournament Template [id] API
 * 
 * GET: Get template details
 * PUT: Update template
 * DELETE: Delete template
 */

// GET - Get template details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const template = await getTemplate(id);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      template 
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update template
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const updateData: Partial<TemplateData> = {};
    
    // Only include fields that are provided
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.format !== undefined) updateData.format = body.format;
    if (body.scope !== undefined) updateData.scope = body.scope;
    if (body.maxPlayers !== undefined) updateData.maxPlayers = body.maxPlayers;
    if (body.maxTeams !== undefined) updateData.maxTeams = body.maxTeams;
    if (body.teamSize !== undefined) updateData.teamSize = body.teamSize;
    if (body.entryFee !== undefined) updateData.entryFee = body.entryFee;
    if (body.earlyBirdFee !== undefined) updateData.earlyBirdFee = body.earlyBirdFee;
    if (body.earlyBirdDeadlineDays !== undefined) updateData.earlyBirdDeadlineDays = body.earlyBirdDeadlineDays;
    if (body.groupDiscountMin !== undefined) updateData.groupDiscountMin = body.groupDiscountMin;
    if (body.groupDiscountPercent !== undefined) updateData.groupDiscountPercent = body.groupDiscountPercent;
    if (body.bracketFormat !== undefined) updateData.bracketFormat = body.bracketFormat;
    if (body.ageMin !== undefined) updateData.ageMin = body.ageMin;
    if (body.ageMax !== undefined) updateData.ageMax = body.ageMax;
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.scoringMode !== undefined) updateData.scoringMode = body.scoringMode;
    if (body.maxPlayersPerOrg !== undefined) updateData.maxPlayersPerOrg = body.maxPlayersPerOrg;
    if (body.prizePoolDefault !== undefined) updateData.prizePoolDefault = body.prizePoolDefault;
    if (body.regDeadlineDays !== undefined) updateData.regDeadlineDays = body.regDeadlineDays;
    if (body.durationDays !== undefined) updateData.durationDays = body.durationDays;
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
    if (body.defaultLocation !== undefined) updateData.defaultLocation = body.defaultLocation;
    if (body.defaultCity !== undefined) updateData.defaultCity = body.defaultCity;
    if (body.defaultState !== undefined) updateData.defaultState = body.defaultState;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.rules !== undefined) updateData.rules = body.rules;
    if (body.isRecurring !== undefined) updateData.isRecurring = body.isRecurring;
    if (body.recurringFrequency !== undefined) updateData.recurringFrequency = body.recurringFrequency;
    if (body.recurringDayOfWeek !== undefined) updateData.recurringDayOfWeek = body.recurringDayOfWeek;
    if (body.recurringDayOfMonth !== undefined) updateData.recurringDayOfMonth = body.recurringDayOfMonth;
    if (body.recurringWeekOfMonth !== undefined) updateData.recurringWeekOfMonth = body.recurringWeekOfMonth;
    if (body.recurringMonthQuarter !== undefined) updateData.recurringMonthQuarter = body.recurringMonthQuarter;
    if (body.seriesId !== undefined) updateData.seriesId = body.seriesId;

    const template = await updateTemplate(id, session.orgId, updateData);

    return NextResponse.json({ 
      success: true,
      template 
    });
  } catch (error) {
    console.error('Error updating template:', error);
    if (error instanceof Error && error.message === 'Not authorized') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete template (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    await deleteTemplate(id, session.orgId);

    return NextResponse.json({ 
      success: true,
      message: 'Template deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    if (error instanceof Error) {
      if (error.message === 'Not authorized') {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
      if (error.message === 'Cannot delete template with scheduled tournaments') {
        return NextResponse.json({ 
          error: 'Cannot delete template with scheduled tournaments. Cancel them first.' 
        }, { status: 400 });
      }
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
