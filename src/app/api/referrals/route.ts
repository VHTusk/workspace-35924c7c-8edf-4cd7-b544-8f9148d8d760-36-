import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateReferralCode } from '@/lib/tier';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';

// GET - Get referral stats for current user
export async function GET() {
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
      where: { referrerId: user.id },
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
        status: r.status,
        rewardPoints: r.rewardPoints,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      }))
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

