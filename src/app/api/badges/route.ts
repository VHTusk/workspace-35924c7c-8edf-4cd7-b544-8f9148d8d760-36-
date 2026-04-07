import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';

// GET /api/badges - Get badge definitions
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const admin = searchParams.get('admin') === 'true';

    // If admin request, check if user is admin
    if (admin && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const badges = await db.badgeDefinition.findMany({
      where: {
        sport: session.user.sport,
        ...(admin ? {} : { isActive: true }),
      },
      orderBy: [{ category: 'asc' }, { tier: 'asc' }],
    });

    return NextResponse.json({ badges });
  } catch (error) {
    console.error('Get badges error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/badges - Create badge (admin only)
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { code, name, description, iconUrl, category, tier, pointsRequired, conditionExpr, isActive = true } = body;

    if (!code || !name || !description || !category || !tier) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
    }

    const badge = await db.badgeDefinition.create({
      data: {
        sport: session.user.sport,
        code,
        name,
        description,
        iconUrl,
        category,
        tier,
        pointsRequired,
        conditionExpr,
        isActive,
      },
    });

    return NextResponse.json({ badge });
  } catch (error) {
    console.error('Create badge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/badges - Update badge (admin only)
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Badge ID required' }, { status: 400 });
    }

    const badge = await db.badgeDefinition.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ badge });
  } catch (error) {
    console.error('Update badge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
