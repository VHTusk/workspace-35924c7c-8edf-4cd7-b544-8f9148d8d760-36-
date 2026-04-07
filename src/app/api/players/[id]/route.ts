import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTierFromPoints } from '@/lib/tier';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const user = await db.user.findUnique({
      where: { id },
      include: {
        rating: true,
        achievements: {
          include: { badge: true },
          orderBy: { earnedAt: 'desc' },
          take: 10
        },
        tournamentResults: {
          include: { tournament: true },
          orderBy: { awardedAt: 'desc' },
          take: 10
        },
        orgRosterEntries: {
          include: { org: true }
        },
        matchesAsA: {
          where: { outcome: 'PLAYED' },
          orderBy: { playedAt: 'desc' },
          take: 5,
          include: {
            playerB: { select: { id: true, firstName: true, lastName: true } },
            tournament: { select: { id: true, name: true } }
          }
        },
        matchesAsB: {
          where: { outcome: 'PLAYED' },
          orderBy: { playedAt: 'desc' },
          take: 5,
          include: {
            playerA: { select: { id: true, firstName: true, lastName: true } },
            tournament: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check privacy settings
    if (!user.showOnLeaderboard) {
      return NextResponse.json({ error: 'This profile is private' }, { status: 403 });
    }

    const tier = getTierFromPoints(user.visiblePoints);
    
    // Combine matches and sort
    const allMatches = [
      ...user.matchesAsA.map(m => ({
        ...m,
        opponent: m.playerB,
        isPlayerA: true
      })),
      ...user.matchesAsB.map(m => ({
        ...m,
        opponent: m.playerA,
        isPlayerA: false
      }))
    ].sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()).slice(0, 10);

    const wins = user.rating?.wins ?? 0;
    const losses = user.rating?.losses ?? 0;
    const totalMatches = wins + losses;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    const profile = {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      city: user.city,
      state: user.state,
      sport: user.sport,
      tier: tier.name,
      tierColor: tier.color,
      tierBgClass: tier.bgColor,
      tierTextClass: tier.textColor,
      visiblePoints: user.visiblePoints,
      hiddenElo: user.hideElo ? null : Math.round(user.hiddenElo),
      stats: {
        matches: totalMatches,
        wins,
        losses,
        winRate,
        tournamentsPlayed: user.rating?.tournamentsPlayed ?? 0,
        tournamentsWon: user.rating?.tournamentsWon ?? 0,
        currentStreak: user.rating?.currentStreak ?? 0,
        bestStreak: user.rating?.bestStreak ?? 0,
        highestElo: user.rating?.highestElo ?? user.hiddenElo
      },
      organization: user.orgRosterEntries[0]?.org?.name || null,
      achievements: user.achievements.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        earnedAt: a.earnedAt,
        iconUrl: a.badge?.iconUrl
      })),
      recentMatches: allMatches.map(m => ({
        id: m.id,
        opponent: m.opponent ? `${m.opponent.firstName} ${m.opponent.lastName}` : 'Unknown',
        opponentId: m.opponent?.id,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        won: m.isPlayerA ? m.winnerId === user.id : m.winnerId === user.id,
        tournament: m.tournament?.name,
        playedAt: m.playedAt
      })),
      tournamentResults: user.tournamentResults.map(r => ({
        id: r.id,
        tournamentId: r.tournamentId,
        tournamentName: r.tournament.name,
        rank: r.rank,
        bonusPoints: r.bonusPoints,
        awardedAt: r.awardedAt
      })),
      createdAt: user.createdAt,
      referralCode: user.referralCode
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching player profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
