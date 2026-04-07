import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, SportType } from '@prisma/client';
import { getAuthenticatedDirector } from '@/lib/auth';

// GET - Fetch sport rules
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') as SportType;

    let rules = await db.sportRules.findUnique({
      where: { sport },
    });

    // Create default rules if not exist
    if (!rules) {
      rules = await db.sportRules.create({
        data: {
          sport,
          cityParticipation: 1,
          cityWin: 2,
          districtParticipation: 1,
          districtWin: 3,
          stateParticipation: 2,
          stateWin: 4,
          nationalParticipation: 3,
          nationalWin: 6,
          cityFirst: 10,
          citySecond: 6,
          cityThird: 3,
          districtFirst: 15,
          districtSecond: 9,
          districtThird: 5,
          stateFirst: 20,
          stateSecond: 12,
          stateThird: 6,
          nationalFirst: 30,
          nationalSecond: 18,
          nationalThird: 9,
        },
      });
    }

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('Fetch sport rules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update sport rules
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      sport,
      cityParticipation,
      cityWin,
      districtParticipation,
      districtWin,
      stateParticipation,
      stateWin,
      nationalParticipation,
      nationalWin,
      cityFirst,
      citySecond,
      cityThird,
      districtFirst,
      districtSecond,
      districtThird,
      stateFirst,
      stateSecond,
      stateThird,
      nationalFirst,
      nationalSecond,
      nationalThird,
    } = body;

    if (!sport) {
      return NextResponse.json({ error: 'Sport is required' }, { status: 400 });
    }

    const rules = await db.sportRules.upsert({
      where: { sport },
      update: {
        cityParticipation,
        cityWin,
        districtParticipation,
        districtWin,
        stateParticipation,
        stateWin,
        nationalParticipation,
        nationalWin,
        cityFirst,
        citySecond,
        cityThird,
        districtFirst,
        districtSecond,
        districtThird,
        stateFirst,
        stateSecond,
        stateThird,
        nationalFirst,
        nationalSecond,
        nationalThird,
      },
      create: {
        sport,
        cityParticipation,
        cityWin,
        districtParticipation,
        districtWin,
        stateParticipation,
        stateWin,
        nationalParticipation,
        nationalWin,
        cityFirst,
        citySecond,
        cityThird,
        districtFirst,
        districtSecond,
        districtThird,
        stateFirst,
        stateSecond,
        stateThird,
        nationalFirst,
        nationalSecond,
        nationalThird,
      },
    });

    // Log audit
    await db.auditLog.create({
      data: {
        sport: sport as SportType,
        action: 'ADMIN_OVERRIDE',
        actorId: user.id,
        actorRole: user.role,
        targetType: 'SportRules',
        targetId: rules.id,
        metadata: JSON.stringify({ action: 'SPORT_RULES_UPDATED' }),
      },
    });

    return NextResponse.json({ success: true, rules });
  } catch (error) {
    console.error('Update sport rules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
