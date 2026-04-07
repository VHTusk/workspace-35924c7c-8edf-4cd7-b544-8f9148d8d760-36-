import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';

// GET /api/activity-feed - Get activity feed
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
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '20');

    const activities = await db.activityFeed.findMany({
      where: {
        sport: session.user.sport,
        isPublic: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
    });

    return NextResponse.json({
      activities,
      nextCursor: activities.length === limit ? activities[activities.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Get activity feed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
