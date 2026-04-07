import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedOrg } from '@/lib/auth';

// GET /api/org/payments - Get organization payment history
export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedOrg(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { org, session } = auth;

    // Get payment history from PaymentLedger
    const payments = await db.paymentLedger.findMany({
      where: {
        orgId: org.id,
        type: { in: ['SUBSCRIPTION', 'TOURNAMENT_ENTRY', 'UPGRADE'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Format payment data
    const formattedPayments = payments.map((payment) => ({
      id: payment.id,
      date: payment.createdAt.toISOString(),
      amount: payment.amount,
      type: payment.type,
      status: payment.status,
      method: payment.razorpayId ? 'Razorpay' : 'Wallet',
      invoice: `INV-${payment.id.slice(0, 8).toUpperCase()}`,
      description: payment.description || `${payment.type} Payment`,
      razorpayId: payment.razorpayId,
    }));

    // Get subscription details
    const subscription = org.subscription;

    // Calculate subscription status
    let subscriptionStatus = 'TRIAL';
    let daysRemaining = 0;
    let endDate: Date | null = null;

    if (subscription) {
      subscriptionStatus = subscription.status;
      endDate = subscription.endDate;
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    } else {
      // Calculate trial days
      const trialEnd = new Date(org.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      endDate = trialEnd;
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      subscriptionStatus = daysRemaining > 0 ? 'TRIAL' : 'EXPIRED';
    }

    // Calculate totals
    const totalSpent = payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayments = payments.filter((p) => p.status === 'INITIATED').length;

    return NextResponse.json({
      subscription: subscription
        ? {
            plan: subscription.plan || 'BASIC',
            status: subscriptionStatus,
            startDate: subscription.startDate.toISOString(),
            endDate: endDate?.toISOString(),
            autoRenew: false,
            amount: subscription.amount,
            daysRemaining,
            trialEndsAt: subscriptionStatus === 'TRIAL' ? endDate?.toISOString() : undefined,
          }
        : {
            plan: 'BASIC',
            status: subscriptionStatus,
            startDate: org.createdAt.toISOString(),
            endDate: endDate?.toISOString(),
            autoRenew: false,
            amount: 0,
            daysRemaining,
            trialEndsAt: subscriptionStatus === 'TRIAL' ? endDate?.toISOString() : undefined,
          },
      payments: formattedPayments,
      summary: {
        totalPayments: payments.length,
        totalSpent,
        pendingPayments,
        lastPayment: payments[0]
          ? {
              date: payments[0].createdAt.toISOString(),
              amount: payments[0].amount,
            }
          : null,
      },
      organization: {
        id: org.id,
        name: org.name,
        planTier: org.planTier,
      },
    });
  } catch (error) {
    console.error('Get org payments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
