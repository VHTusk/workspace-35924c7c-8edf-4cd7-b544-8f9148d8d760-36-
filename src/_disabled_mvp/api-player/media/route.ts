/**
 * Player Media API
 * Fetches photos and videos for the authenticated player
 * Includes tournament media where player participated
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Validate session
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = session.userId;

    // Get tournaments the player participated in
    const playerTournaments = await db.tournamentRegistration.findMany({
      where: { userId },
      select: { tournamentId: true },
    });

    const tournamentIds = playerTournaments.map(t => t.tournamentId);

    // Get tournament media (photos and videos)
    const tournamentMedia = await db.tournamentMediaItem.findMany({
      where: {
        tournamentId: { in: tournamentIds },
      },
      include: {
        tournament: {
          select: {
            name: true,
            startDate: true,
          },
        },
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Separate photos and videos
    const photos = tournamentMedia
      .filter(m => m.type === 'IMAGE')
      .map(m => ({
        id: m.id,
        url: m.url,
        title: m.caption || `${m.tournament.name} Photo`,
        tournament: m.tournament.name,
        tournamentId: m.tournamentId,
        date: m.createdAt.toISOString(),
        uploadedBy: m.uploadedBy ? `${m.uploadedBy.firstName} ${m.uploadedBy.lastName}` : 'Admin',
      }));

    const videos = tournamentMedia
      .filter(m => m.type === 'VIDEO')
      .map(m => ({
        id: m.id,
        url: m.url,
        thumbnail: m.thumbnailUrl || m.url,
        title: m.caption || `${m.tournament.name} Video`,
        tournament: m.tournament.name,
        tournamentId: m.tournamentId,
        duration: m.duration || '0:00',
        date: m.createdAt.toISOString(),
      }));

    // Get video highlights featuring this player
    const videoHighlights = await db.videoHighlight.findMany({
      where: {
        OR: [
          { playerAId: userId },
          { playerBId: userId },
        ],
      },
      include: {
        tournament: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add video highlights to videos list
    const highlightVideos = videoHighlights.map(h => ({
      id: h.id,
      url: h.videoUrl,
      thumbnail: h.thumbnailUrl || h.videoUrl,
      title: h.title || 'Match Highlight',
      tournament: h.tournament.name,
      tournamentId: h.tournamentId,
      duration: h.duration || '0:00',
      date: h.createdAt.toISOString(),
    }));

    // Combine all videos
    const allVideos = [...videos, ...highlightVideos];

    // Calculate stats
    const stats = {
      totalPhotos: photos.length,
      totalVideos: allVideos.length,
      tournaments: tournamentIds.length,
      totalViews: tournamentMedia.reduce((sum, m) => sum + (m.views || 0), 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        photos,
        videos: allVideos,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching player media:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    );
  }
}
