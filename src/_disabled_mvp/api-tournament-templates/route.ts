import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

/**
 * Tournament Templates API
 *
 * Allows organizations to save tournament configurations as templates
 * for quick creation of recurring tournaments.
 */

// GET - List all templates for the organization
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Validate org session (properly hashes token before lookup)
    const session = await validateOrgSession(sessionToken);

    if (!session?.org) {
      return NextResponse.json({ error: 'Organization session required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');

    const where: any = { orgId: session.org.id };
    if (sport) where.sport = sport;

    const templates = await db.tournamentTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new template
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Validate org session (properly hashes token before lookup)
    const session = await validateOrgSession(sessionToken);

    if (!session?.org) {
      return NextResponse.json({ error: 'Organization session required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      sport,
      type,
      scope,
      maxPlayers,
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
    } = body;

    const template = await db.tournamentTemplate.create({
      data: {
        orgId: session.org.id,
        name,
        sport,
        type: type || 'INDIVIDUAL',
        scope,
        maxPlayers: maxPlayers || 64,
        entryFee: entryFee || 0,
        earlyBirdFee,
        earlyBirdDeadlineDays,
        groupDiscountMin,
        groupDiscountPercent,
        bracketFormat: bracketFormat || 'SINGLE_ELIMINATION',
        ageMin,
        ageMax,
        gender,
        scoringMode: scoringMode || 'STAFF_ONLY',
        maxPlayersPerOrg,
        prizePoolDefault,
        regDeadlineDays: regDeadlineDays || 7,
        durationDays: durationDays || 1,
        isPublic: isPublic ?? true,
      }
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
