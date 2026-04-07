import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { validateSession, validateOrgSession } from '@/lib/auth';

// Check if current user is following a target
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ isFollowing: false });
    }

    // Try to validate as player session first, then org session
    let session = await validateSession(sessionToken);
    let orgSession = null;

    if (!session) {
      orgSession = await validateOrgSession(sessionToken);
    }

    if (!session && !orgSession) {
      return NextResponse.json({ isFollowing: false });
    }

    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('targetType'); // 'user' or 'org'
    const targetId = searchParams.get('targetId');
    const sport = searchParams.get('sport');

    if (!targetId || !sport) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Player following a user
    if (targetType === 'user' && session?.user) {
      const follow = await db.userFollow.findUnique({
        where: {
          followerId_followingId_sport: {
            followerId: session.user.id,
            followingId: targetId,
            sport: sport as any
          }
        }
      });
      return NextResponse.json({ isFollowing: !!follow });
    }

    // Player following an org
    if (targetType === 'org' && session?.user) {
      const follow = await db.userFollowsOrg.findUnique({
        where: {
          userId_orgId_sport: {
            userId: session.user.id,
            orgId: targetId,
            sport: sport as any
          }
        }
      });
      return NextResponse.json({ isFollowing: !!follow });
    }

    // Org following a user
    if (targetType === 'user' && orgSession?.org) {
      const follow = await db.orgFollowsUser.findUnique({
        where: {
          orgId_userId_sport: {
            orgId: orgSession.org.id,
            userId: targetId,
            sport: sport as any
          }
        }
      });
      return NextResponse.json({ isFollowing: !!follow });
    }

    return NextResponse.json({ isFollowing: false });
  } catch (error) {
    console.error('Error checking follow status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
