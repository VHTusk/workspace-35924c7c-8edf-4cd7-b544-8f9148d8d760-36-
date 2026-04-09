import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

// GET /api/org/subscription - Get organization subscription details
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);

    if (!session || !session.org) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const org = session.org;
    const activeSubscription = org.subscription;

    // Get payment history
    const payments = await db.paymentLedger.findMany({
      where: {
        orgId: org.id,
        type: 'SUBSCRIPTION',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const now = new Date();

    // If no subscription, return trial/default info
    if (!activeSubscription) {
      return NextResponse.json({
        plan: 'BASIC',
        status: 'TRIAL',
        startDate: org.createdAt.toISOString(),
        endDate: new Date(org.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        autoRenew: false,
        amount: 0,
        trialEndsAt: new Date(org.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: Math.max(0, Math.ceil((new Date(org.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))),
        payments: payments.map(p => ({
          date: p.createdAt,
          amount: p.amount,
          status: p.status,
          invoice: `INV-${p.id.slice(0, 8).toUpperCase()}`,
        })),
      });
    }

    // Calculate days remaining
    const endDate = new Date(activeSubscription.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    return NextResponse.json({
      plan: org.planTier || 'BASIC',
      status: activeSubscription.status,
      startDate: activeSubscription.startDate.toISOString(),
      endDate: activeSubscription.endDate.toISOString(),
      autoRenew: false,
      amount: activeSubscription.amount,
      daysRemaining,
      payments: payments.map(p => ({
        date: p.createdAt,
        amount: p.amount,
        status: p.status,
        invoice: `INV-${p.id.slice(0, 8).toUpperCase()}`,
      })),
    });

  } catch (error) {
    console.error('Error fetching org subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

// POST /api/org/subscription - Update subscription (upgrade/downgrade)
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);

    if (!session || !session.org) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { plan } = body;

    if (!['BASIC', 'PRO', 'ENTERPRISE'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Get plan amounts
    const planAmounts: Record<string, number> = {
      BASIC: 15000,
      PRO: 50000,
      ENTERPRISE: 100000,
    };

    // Create payment order for upgrade
    const amount = planAmounts[plan];
    
    // Return payment initiation details
    return NextResponse.json({
      message: 'Payment required for plan upgrade',
      plan,
      amount,
      currency: 'INR',
      // Frontend should initiate Razorpay checkout
      requiresPayment: true,
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}
