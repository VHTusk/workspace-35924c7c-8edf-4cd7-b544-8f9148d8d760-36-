import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// GET /api/player/friends-activity - Get friends currently playing/available
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = auth;

    // Get user's followed users
    const following = await db.userFollow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    const followingIds = following.map(f => f.followingId);

    // Get friends' current activity
    const friendsActivity = await db.friendActivity.findMany({
      where: {
        userId: { in: followingIds },
        sport: user.sport,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Get live matches where friends are playing
    const liveMatches = await db.match.findMany({
      where: {
        OR: [
          { playerAId: { in: followingIds } },
          { playerBId: { in: followingIds } },
        ],
        tournament: {
          status: 'IN_PROGRESS',
        },
      },
      include: {
        playerA: { select: { id: true, firstName: true, lastName: true } },
        playerB: { select: { id: true, firstName: true, lastName: true } },
        tournament: { select: { id: true, name: true } },
      },
    });

    // Get friends looking for team (doubles partner)
    const friendsLookingForTeam = friendsActivity.filter(a => a.lookingForTeam);

    // Categorize activities
    const playing = friendsActivity.filter(a => a.status === 'PLAYING' || a.status === 'IN_TOURNAMENT');
    const available = friendsActivity.filter(a => a.status === 'AVAILABLE');
    const watching = friendsActivity.filter(a => a.status === 'WATCHING');

    return NextResponse.json({
      friendsPlaying: playing.map(a => ({
        ...a,
        isLive: liveMatches.some(m => m.playerAId === a.userId || m.playerBId === a.userId),
      })),
      friendsAvailable: available,
      friendsWatching: watching,
      friendsLookingForTeam: friendsLookingForTeam.map(a => ({
        ...a,
        preferences: a.teamPreferences ? JSON.parse(a.teamPreferences) : null,
      })),
      liveMatches: liveMatches.map(m => {
        const isPlayerAFollowed = followingIds.includes(m.playerAId || '');
        return {
          id: m.id,
          tournamentId: m.tournamentId,
          tournamentName: m.tournament?.name,
          playerA: m.playerA,
          playerB: m.playerB,
          yourFriend: isPlayerAFollowed ? m.playerA : m.playerB,
          isLive: true,
        };
      }),
      summary: {
        totalActive: friendsActivity.length,
        playing: playing.length,
        available: available.length,
        lookingForTeam: friendsLookingForTeam.length,
      },
    });
  } catch (error) {
    console.error('Get friends activity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/player/friends-activity - Update own activity status
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = auth;

    const body = await request.json();
    const { status, tournamentId, tournamentName, matchId, lookingForTeam, teamPreferences } = body;

    // Update or create friend activity
    const activity = await db.friendActivity.upsert({
      where: { userId: user.id },
      update: {
        status: status || 'AVAILABLE',
        tournamentId,
        tournamentName,
        matchId,
        lookingForTeam: lookingForTeam || false,
        teamPreferences: teamPreferences ? JSON.stringify(teamPreferences) : null,
        statusUpdatedAt: new Date(),
        expiresAt: status === 'AVAILABLE' 
          ? new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours for available
          : null,
      },
      create: {
        userId: user.id,
        sport: user.sport,
        status: status || 'AVAILABLE',
        tournamentId,
        tournamentName,
        matchId,
        lookingForTeam: lookingForTeam || false,
        teamPreferences: teamPreferences ? JSON.stringify(teamPreferences) : null,
        expiresAt: status === 'AVAILABLE' 
          ? new Date(Date.now() + 4 * 60 * 60 * 1000)
          : null,
      },
    });

    return NextResponse.json({ success: true, activity });
  } catch (error) {
    console.error('Update friend activity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/player/friends-activity - Clear activity status
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = auth;

    await db.friendActivity.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete friend activity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
