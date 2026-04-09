import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateReferralCode } from '@/lib/tier';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import { ReferralType, SportType } from '@prisma/client';
import { buildReferralWhere } from '@/lib/user-sport';

// GET - Get referral stats for current user
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

    const user = session.user;
    const { searchParams } = new URL(request.url);
    const requestedSport = searchParams.get('sport');
    const sport =
      requestedSport && ['CORNHOLE', 'DARTS'].includes(requestedSport.toUpperCase())
        ? (requestedSport.toUpperCase() as SportType)
        : session.sport;
    const requestedReferralType = searchParams.get('referralType');
    const referralType: ReferralType | 'ALL' =
      requestedReferralType === 'PLATFORM'
        ? ReferralType.PLATFORM
        : requestedReferralType === 'SPORT_SPECIFIC'
          ? ReferralType.SPORT_SPECIFIC
          : 'ALL';

    // Get or create referral code
    let referralCode = user.referralCode;
    if (!referralCode) {
      referralCode = generateReferralCode(`${user.firstName} ${user.lastName}`);
      await db.user.update({
        where: { id: user.id },
        data: { referralCode }
      });
    }

    // Get referral stats
    const referrals = await db.referral.findMany({
      where: buildReferralWhere(user.id, {
        sport,
        referralType,
      }),
      include: {
        referee: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalReferrals = referrals.length;
    const completedReferrals = referrals.filter(r => r.status === 'COMPLETED' || r.status === 'REWARDED').length;
    const totalPointsEarned = referrals.reduce((sum, r) => sum + r.rewardPoints, 0);

    return NextResponse.json({
      referralCode,
      sport,
      referralType,
      totalReferrals,
      completedReferrals,
      pendingReferrals: totalReferrals - completedReferrals,
      totalPointsEarned,
      referrals: referrals.map(r => ({
        id: r.id,
        referee: {
          firstName: r.referee.firstName,
          lastName: r.referee.lastName,
        },
        sport: r.sport,
        referralType: r.referralType,
        status: r.status,
        rewardPoints: r.rewardPoints,
        conversionEvent: r.conversionEvent,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      }))
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
