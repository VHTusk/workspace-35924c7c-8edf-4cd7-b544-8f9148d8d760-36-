import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get subscription revenue (from Subscription model)
    const activeSubscriptions = await db.subscription.count({
      where: {
        status: 'ACTIVE',
        createdAt: { gte: startOfYear },
      },
    });

    // Calculate estimated subscription revenue
    // Player: ₹1,200/year, Org School/Club: ₹15,000/year, Org Corporate: ₹1,00,000/year
    const playerSubs = await db.subscription.count({
      where: { status: 'ACTIVE', type: 'PLAYER' },
    });
    const orgSubs = await db.subscription.count({
      where: { status: 'ACTIVE', type: 'ORGANIZATION' },
    });

    const estimatedSubscriptionRevenue = (playerSubs * 1200) + (orgSubs * 15000);

    // Get payment totals from PaymentLedger
    const totalPayments = await db.paymentLedger.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startOfYear },
      },
      _sum: {
        amount: true,
      },
    });

    // Get this month's payments
    const monthlyPayments = await db.paymentLedger.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startOfMonth },
      },
      _sum: {
        amount: true,
        gstAmount: true,
      },
    });

    // Get tournament entry fees collected
    const tournamentFees = await db.tournamentRegistration.aggregate({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: startOfYear },
      },
      _sum: {
        amountPaid: true,
      },
    });

    // Revenue by source breakdown
    const revenueBySource = {
      subscriptions: estimatedSubscriptionRevenue,
      tournamentFees: tournamentFees._sum.amountPaid || 0,
      other: 0,
    };

    // Monthly revenue trend (last 12 months)
    const monthlyTrend = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthRevenue = await db.paymentLedger.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: {
          amount: true,
          gstAmount: true,
        },
      });

      monthlyTrend.push({
        month: monthStart.toISOString().slice(0, 7),
        revenue: monthRevenue._sum.amount || 0,
        gst: monthRevenue._sum.gstAmount || 0,
      });
    }

    // GST summary
    const gstCollected = await db.paymentLedger.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startOfYear },
      },
      _sum: {
        gstAmount: true,
        cgstAmount: true,
        sgstAmount: true,
      },
    });

    return NextResponse.json({
      summary: {
        totalRevenue: (totalPayments._sum.amount || 0) + estimatedSubscriptionRevenue,
        thisMonth: monthlyPayments._sum.amount || 0,
        subscriptions: estimatedSubscriptionRevenue,
        tournamentFees: tournamentFees._sum.amountPaid || 0,
      },
      subscriptions: {
        active: playerSubs + orgSubs,
        players: playerSubs,
        organizations: orgSubs,
      },
      revenueBySource,
      monthlyTrend,
      gst: {
        totalCollected: gstCollected._sum.gstAmount || 0,
        cgst: gstCollected._sum.cgstAmount || 0,
        sgst: gstCollected._sum.sgstAmount || 0,
      },
    });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue data' },
      { status: 500 }
    );
  }
}
