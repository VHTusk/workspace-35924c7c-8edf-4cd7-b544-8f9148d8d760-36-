import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// GET /api/player/activity-feed - Get personalized activity feed
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = auth;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // Filter by activity type
    const isRead = searchParams.get('isRead');
    const limit = parseInt(searchParams.get('limit') || '20');
    const cursor = searchParams.get('cursor');

    // Build where clause
    const where: Record<string, unknown> = {
      userId: user.id,
      sport: user.sport,
    };

    if (type) {
      where.type = type;
    }

    if (isRead !== null) {
      where.isRead = isRead === 'true';
    }

    // Get personalized feed items
    const feedItems = await db.playerActivityFeedItem.findMany({
      where,
      orderBy: [
        { relevanceScore: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
    });

    // If no personalized items yet, generate some from recent activities
    if (feedItems.length === 0) {
      // Get user's followed users
      const following = await db.userFollow.findMany({
        where: { followerId: user.id },
        select: { followingId: true },
      });
      const followingIds = following.map(f => f.followingId);

      // Get recent matches for followed users
      const recentMatches = await db.match.findMany({
        where: {
          OR: [
            { playerAId: { in: followingIds } },
            { playerBId: { in: followingIds } },
          ],
        },
        include: {
          playerA: { select: { id: true, firstName: true, lastName: true } },
          playerB: { select: { id: true, firstName: true, lastName: true } },
          tournament: { select: { id: true, name: true } },
        },
        orderBy: { playedAt: 'desc' },
        take: 10,
      });

      // Create feed items from matches
      for (const match of recentMatches) {
        const isPlayerAFollowed = followingIds.includes(match.playerAId || '');
        const followedPlayer = isPlayerAFollowed ? match.playerA : match.playerB;
        const opponent = isPlayerAFollowed ? match.playerB : match.playerA;
        const won = match.winnerId === followedPlayer?.id;

        await db.playerActivityFeedItem.create({
          data: {
            userId: user.id,
            sport: user.sport,
            type: 'FRIEND_ACTIVITY',
            actorId: followedPlayer?.id,
            actorName: `${followedPlayer?.firstName} ${followedPlayer?.lastName}`,
            title: `${followedPlayer?.firstName} ${won ? 'won' : 'lost'} a match`,
            description: `${won ? 'Defeated' : 'Lost to'} ${opponent?.firstName} ${opponent?.lastName} (${match.scoreA}-${match.scoreB}) in ${match.tournament?.name || 'a tournament'}`,
            metadata: JSON.stringify({
              matchId: match.id,
              tournamentId: match.tournamentId,
              result: won ? 'WIN' : 'LOSS',
              score: `${match.scoreA}-${match.scoreB}`,
            }),
            relevanceScore: won ? 0.9 : 0.7,
            linkUrl: `/${user.sport.toLowerCase()}/tournaments/${match.tournamentId}`,
          },
        });
      }

      // Re-fetch feed items
      const newFeedItems = await db.playerActivityFeedItem.findMany({
        where,
        orderBy: [
          { relevanceScore: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
      });

      return NextResponse.json({
        activities: newFeedItems,
        nextCursor: newFeedItems.length === limit ? newFeedItems[newFeedItems.length - 1]?.id : null,
        unreadCount: newFeedItems.filter(i => !i.isRead).length,
      });
    }

    return NextResponse.json({
      activities: feedItems,
      nextCursor: feedItems.length === limit ? feedItems[feedItems.length - 1]?.id : null,
      unreadCount: feedItems.filter(i => !i.isRead).length,
    });
  } catch (error) {
    console.error('Get activity feed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/player/activity-feed/mark-read - Mark items as read
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = auth;

    const body = await request.json();
    const { itemIds, markAll } = body;

    if (markAll) {
      await db.playerActivityFeedItem.updateMany({
        where: {
          userId: user.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    } else if (itemIds && Array.isArray(itemIds)) {
      await db.playerActivityFeedItem.updateMany({
        where: {
          id: { in: itemIds },
          userId: user.id,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
