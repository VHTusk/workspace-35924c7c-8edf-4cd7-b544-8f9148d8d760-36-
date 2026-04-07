import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import { SportType } from '@prisma/client';

/**
 * GET /api/social/friends-playing
 * 
 * Get list of friends currently playing or looking for teams
 */
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
    const sport = (searchParams.get('sport') || session.user.sport) as SportType;
    const userId = session.user.id;

    // Get user's friends
    const following = await db.userFollow.findMany({
      where: { followerId: userId, sport },
      select: { followingId: true },
    });

    const friendIds = following.map(f => f.followingId);

    if (friendIds.length === 0) {
      return NextResponse.json({
        success: true,
        friendsPlaying: [],
        friendsLookingForTeam: [],
        onlineFriends: [],
      });
    }

    // Get friends' playing status
    const playingStatuses = await db.friendPlayingStatus.findMany({
      where: {
        userId: { in: friendIds },
        sport,
        status: { not: 'OFFLINE' },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hiddenElo: true,
            profileImage: true,
          },
        },
      },
    });

    // Get online friends (recently active)
    const onlineThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes
    const recentActiveFriends = await db.session.findMany({
      where: {
        userId: { in: friendIds },
        sport,
        expiresAt: { gte: new Date() },
        lastActivityAt: { gte: onlineThreshold },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hiddenElo: true,
            profileImage: true,
          },
        },
      },
      distinct: ['userId'],
    });

    // Categorize friends
    const friendsPlaying = playingStatuses
      .filter(s => s.status === 'PLAYING' || s.status === 'IN_TOURNAMENT')
      .map(s => ({
        ...s,
        tournament: s.tournamentId,
        match: s.matchId,
        venue: s.venue,
        court: s.courtName,
      }));

    const friendsLookingForTeam = playingStatuses
      .filter(s => s.lookingForTeam)
      .map(s => ({
        ...s,
        teamFormat: s.teamFormat,
        message: s.message,
      }));

    const onlineFriends = recentActiveFriends
      .filter(s => !playingStatuses.some(ps => ps.userId === s.userId && ps.status !== 'ONLINE'))
      .map(s => s.user);

    return NextResponse.json({
      success: true,
      friendsPlaying,
      friendsLookingForTeam,
      onlineFriends,
      totalOnline: friendsPlaying.length + onlineFriends.length,
    });

  } catch (error) {
    console.error('Error fetching friends playing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/social/friends-playing
 * 
 * Update current user's playing status
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { 
      status, 
      tournamentId, 
      matchId, 
      venue, 
      courtName,
      lookingForTeam,
      teamFormat,
      message,
      duration = 120, // minutes until status expires
    } = body;

    const sport = session.user.sport as SportType;
    const userId = session.user.id;

    // Upsert playing status
    const playingStatus = await db.friendPlayingStatus.upsert({
      where: {
        userId_sport: { userId, sport },
      },
      create: {
        userId,
        sport,
        status: status || 'ONLINE',
        tournamentId,
        matchId,
        venue,
        courtName,
        lookingForTeam: lookingForTeam || false,
        teamFormat,
        message,
        expiresAt: new Date(Date.now() + duration * 60 * 1000),
      },
      update: {
        status: status || 'ONLINE',
        tournamentId,
        matchId,
        venue,
        courtName,
        lookingForTeam: lookingForTeam || false,
        teamFormat,
        message,
        expiresAt: new Date(Date.now() + duration * 60 * 1000),
        updatedAt: new Date(),
      },
    });

    // Create friend activity notifications
    if (lookingForTeam) {
      const followers = await db.userFollow.findMany({
        where: { followingId: userId, sport },
        select: { followerId: true },
      });

      await db.friendActivity.createMany({
        data: followers.map(f => ({
          userId,
          friendId: f.followerId,
          sport,
          activityType: 'LOOKING_FOR_TEAM',
          title: `${session.user.firstName} is looking for a ${teamFormat?.toLowerCase() || 'doubles'} partner!`,
          description: message || 'Join them for a tournament',
          metadata: JSON.stringify({ teamFormat, message }),
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      success: true,
      playingStatus,
    });

  } catch (error) {
    console.error('Error updating playing status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/social/friends-playing
 * 
 * Clear playing status (go offline)
 */
export async function DELETE(request: NextRequest) {
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

    const sport = session.user.sport as SportType;
    const userId = session.user.id;

    await db.friendPlayingStatus.update({
      where: {
        userId_sport: { userId, sport },
      },
      data: {
        status: 'OFFLINE',
        tournamentId: null,
        matchId: null,
        venue: null,
        courtName: null,
        lookingForTeam: false,
        teamFormat: null,
        message: null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error clearing playing status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
