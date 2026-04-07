import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedOrg } from '@/lib/auth';
import { 
  createTemplate, 
  getTemplates, 
  TemplateData 
} from '@/lib/tournament-template';

/**
 * Organization Tournament Templates API
 * 
 * GET: List all templates for the organization
 * POST: Create a new template
 */

// GET - List all templates for the organization
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Organization authentication required' }, { status: 401 });
    }

    const { org } = auth;

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as 'CORNHOLE' | 'DARTS' | null;

    const templates = await getTemplates(org.id, sport || undefined);

    return NextResponse.json({ 
      success: true,
      templates 
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new template
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Organization authentication required' }, { status: 401 });
    }

    const { org } = auth;

    const body = await request.json();
    
    const templateData: TemplateData = {
      name: body.name,
      sport: body.sport,
      type: body.type,
      format: body.format,
      scope: body.scope,
      maxPlayers: body.maxPlayers,
      maxTeams: body.maxTeams,
      teamSize: body.teamSize,
      entryFee: body.entryFee,
      earlyBirdFee: body.earlyBirdFee,
      earlyBirdDeadlineDays: body.earlyBirdDeadlineDays,
      groupDiscountMin: body.groupDiscountMin,
      groupDiscountPercent: body.groupDiscountPercent,
      bracketFormat: body.bracketFormat,
      ageMin: body.ageMin,
      ageMax: body.ageMax,
      gender: body.gender,
      scoringMode: body.scoringMode,
      maxPlayersPerOrg: body.maxPlayersPerOrg,
      prizePoolDefault: body.prizePoolDefault,
      regDeadlineDays: body.regDeadlineDays,
      durationDays: body.durationDays,
      isPublic: body.isPublic,
      defaultLocation: body.defaultLocation,
      defaultCity: body.defaultCity,
      defaultState: body.defaultState,
      description: body.description,
      rules: body.rules,
      isRecurring: body.isRecurring,
      recurringFrequency: body.recurringFrequency,
      recurringDayOfWeek: body.recurringDayOfWeek,
      recurringDayOfMonth: body.recurringDayOfMonth,
      recurringWeekOfMonth: body.recurringWeekOfMonth,
      recurringMonthQuarter: body.recurringMonthQuarter,
      seriesId: body.seriesId,
    };

    const template = await createTemplate(org.id, templateData);

    return NextResponse.json({ 
      success: true,
      template 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
