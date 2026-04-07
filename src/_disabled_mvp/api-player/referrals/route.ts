import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';

/**
 * Player Referrals API
 * GET - Get user's referral code and stats
 * Updated: Using validateSession instead of getSession
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const sport = request.nextUrl.searchParams.get('sport') as string;
    if (!sport) {
      return NextResponse.json({ error: 'Sport parameter required' }, { status: 400 });
    }

    const userId = session.user.id;

    // Get user with referral code
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        referralCode: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate referral code if not exists
    let referralCode = user.referralCode;
    if (!referralCode) {
      // Generate unique code based on user's name
      const baseCode = `${user.firstName}${user.lastName}`.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 8);
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      referralCode = `${baseCode}${randomSuffix}`;
      
      // Update user with new referral code
      await db.user.update({
        where: { id: userId },
        data: { referralCode },
      });
    }

    // Get referral stats
    const referrals = await db.referral.findMany({
      where: {
        referrerId: userId,
        sport: sport.toUpperCase() as any,
      },
      include: {
        referee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate stats
    const totalReferrals = referrals.length;
    const completedReferrals = referrals.filter(r => r.status === 'COMPLETED' || r.status === 'REWARDED').length;
    const pendingReferrals = referrals.filter(r => r.status === 'PENDING').length;
    const totalRewardsEarned = referrals.reduce((sum, r) => sum + r.rewardPoints, 0);

    return NextResponse.json({
      referralCode,
      stats: {
        totalReferrals,
        completedReferrals,
        pendingReferrals,
        totalRewardsEarned,
      },
      referrals: referrals.map(r => ({
        id: r.id,
        name: `${r.referee.firstName} ${r.referee.lastName}`,
        status: r.status,
        rewardPoints: r.rewardPoints,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
