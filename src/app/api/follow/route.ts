import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedEntity } from '@/lib/auth';
import { SportType } from '@prisma/client';

// GET - Get followers/following for a user or org
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'followers', 'following', 'followingOrgs', 'followersOrg'
    let userId = searchParams.get('userId');
    let orgId = searchParams.get('orgId');
    const sport = searchParams.get('sport') as SportType;

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }

    if (userId === 'current' || orgId === 'current') {
      const auth = await getAuthenticatedEntity(request);

      if (!auth) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      if (userId === 'current') {
        userId = auth.type === 'user' ? auth.user.id : null;
      }

      if (orgId === 'current') {
        orgId = auth.type === 'org' ? auth.org.id : null;
      }
    }

    if (type === 'followers' && userId) {
      // Get users following this user
      const followers = await db.userFollow.findMany({
        where: { followingId: userId, sport },
        include: {
          follower: {
            select: { id: true, firstName: true, lastName: true, city: true, visiblePoints: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json({ 
        followers: followers.map(f => ({
          id: f.follower.id,
          name: `${f.follower.firstName} ${f.follower.lastName}`,
          city: f.follower.city,
          points: f.follower.visiblePoints,
          followedAt: f.createdAt
        }))
      });
    }

    if (type === 'following' && userId) {
      // Get users this user is following
      const following = await db.userFollow.findMany({
        where: { followerId: userId, sport },
        include: {
          following: {
            select: { id: true, firstName: true, lastName: true, city: true, visiblePoints: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json({ 
        following: following.map(f => ({
          id: f.following.id,
          name: `${f.following.firstName} ${f.following.lastName}`,
          city: f.following.city,
          points: f.following.visiblePoints,
          followedAt: f.createdAt
        }))
      });
    }

    if (type === 'followingOrgs' && userId) {
      // Get orgs this user is following
      const followingOrgs = await db.userFollowsOrg.findMany({
        where: { userId, sport },
        include: {
          org: { select: { id: true, name: true, type: true, city: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json({ 
        followingOrgs: followingOrgs.map(f => ({
          id: f.org.id,
          name: f.org.name,
          type: f.org.type,
          city: f.org.city,
          followedAt: f.createdAt
        }))
      });
    }

    if (type === 'followersOrg' && orgId) {
      // Get users following this org
      const followers = await db.userFollowsOrg.findMany({
        where: { orgId, sport },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, city: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json({ 
        followers: followers.map(f => ({
          id: f.user.id,
          name: `${f.user.firstName} ${f.user.lastName}`,
          city: f.user.city,
          followedAt: f.createdAt
        }))
      });
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching follow data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Follow a user or org
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedEntity(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { targetType, targetId, sport } = body; // targetType: 'user' or 'org'

    if (!targetType || !targetId) {
      return NextResponse.json({ error: 'Missing follow target' }, { status: 400 });
    }

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }

    // Player following a user
    if (targetType === 'user' && auth.type === 'user') {
      const { user } = auth;
      
      if (user.id === targetId) {
        return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
      }

      const existing = await db.userFollow.findUnique({
        where: {
          followerId_followingId_sport: {
            followerId: user.id,
            followingId: targetId,
            sport
          }
        }
      });

      if (existing) {
        return NextResponse.json({ error: 'Already following' }, { status: 400 });
      }

      const targetUser = await db.user.findFirst({
        where: {
          id: targetId,
          sport,
        },
        select: { id: true },
      });

      if (!targetUser) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }

      await db.userFollow.create({
        data: {
          followerId: user.id,
          followingId: targetId,
          sport
        }
      });

      // Create notification for the followed user
      const follower = await db.user.findUnique({
        where: { id: user.id },
        select: { firstName: true, lastName: true }
      });

      await db.notification.create({
        data: {
          userId: targetId,
          sport,
          type: 'NEW_FOLLOWER',
          title: 'New Follower',
          message: `${follower?.firstName} ${follower?.lastName} started following you`,
          link: `/players/${user.id}`
        }
      });

      return NextResponse.json({ success: true, message: 'Following user' });
    }

    // Player following an org
    if (targetType === 'org' && auth.type === 'user') {
      const { user } = auth;
      
      const existing = await db.userFollowsOrg.findUnique({
        where: {
          userId_orgId_sport: {
            userId: user.id,
            orgId: targetId,
            sport
          }
        }
      });

      if (existing) {
        return NextResponse.json({ error: 'Already following' }, { status: 400 });
      }

      const targetOrg = await db.organization.findFirst({
        where: {
          id: targetId,
          sport,
        },
        select: { id: true },
      });

      if (!targetOrg) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      await db.userFollowsOrg.create({
        data: {
          userId: user.id,
          orgId: targetId,
          sport
        }
      });

      return NextResponse.json({ success: true, message: 'Following organization' });
    }

    // Org following a user
    if (targetType === 'user' && auth.type === 'org') {
      const { org } = auth;
      
      const existing = await db.orgFollowsUser.findUnique({
        where: {
          orgId_userId_sport: {
            orgId: org.id,
            userId: targetId,
            sport
          }
        }
      });

      if (existing) {
        return NextResponse.json({ error: 'Already following' }, { status: 400 });
      }

      const targetUser = await db.user.findFirst({
        where: {
          id: targetId,
          sport,
        },
        select: { id: true },
      });

      if (!targetUser) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }

      await db.orgFollowsUser.create({
        data: {
          orgId: org.id,
          userId: targetId,
          sport
        }
      });

      return NextResponse.json({ success: true, message: 'Following player' });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error following:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Unfollow a user or org
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedEntity(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('targetType'); // 'user' or 'org'
    const targetId = searchParams.get('targetId');
    const sport = searchParams.get('sport') as SportType;

    if (!targetType || !targetId) {
      return NextResponse.json({ error: 'Missing follow target' }, { status: 400 });
    }

    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }

    // Player unfollowing a user
    if (targetType === 'user' && auth.type === 'user') {
      const { user } = auth;
      
      await db.userFollow.deleteMany({
        where: {
          followerId: user.id,
          followingId: targetId,
          sport,
        },
      });
      return NextResponse.json({ success: true, message: 'Unfollowed user' });
    }

    // Player unfollowing an org
    if (targetType === 'org' && auth.type === 'user') {
      const { user } = auth;
      
      await db.userFollowsOrg.deleteMany({
        where: {
          userId: user.id,
          orgId: targetId,
          sport,
        },
      });
      return NextResponse.json({ success: true, message: 'Unfollowed organization' });
    }

    // Org unfollowing a user
    if (targetType === 'user' && auth.type === 'org') {
      const { org } = auth;
      
      await db.orgFollowsUser.deleteMany({
        where: {
          orgId: org.id,
          userId: targetId,
          sport,
        },
      });
      return NextResponse.json({ success: true, message: 'Unfollowed player' });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error unfollowing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
