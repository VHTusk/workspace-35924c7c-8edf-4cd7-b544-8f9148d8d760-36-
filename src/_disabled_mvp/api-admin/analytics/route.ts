/**
 * Admin Analytics Dashboard API
 * 
 * Provides comprehensive platform-wide analytics:
 * - Overview: Users, tournaments, revenue, session duration
 * - User Funnel: Registration to subscription conversion
 * - Revenue: MRR, ARR, by sport, by user type, ARPU
 * - Churn: Rate by month, user type, reasons, win-back
 * - Engagement: Matches, tournaments, login frequency, feature usage
 * 
 * Query Params:
 * - type: 'overview' | 'funnel' | 'revenue' | 'churn' | 'engagement'
 * - sport: 'CORNHOLE' | 'DARTS' | 'all'
 * - period: '7d' | '30d' | '90d' | '1y'
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cacheGetOrSet, buildCacheKey, CACHE_TTL } from '@/lib/cache';
import { addVersionHeaders } from '@/lib/api-versioning';
import { SubscriptionStatus, TournamentStatus, SportType, TournamentType } from '@prisma/client';

// Types
type AnalyticsType = 'overview' | 'funnel' | 'revenue' | 'churn' | 'engagement';
type SportFilter = 'CORNHOLE' | 'DARTS' | 'all';
type Period = '7d' | '30d' | '90d' | '1y';

interface TrendData {
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface PeriodDates {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
}

// ============================================
// Main GET Handler
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get('type') || 'overview') as AnalyticsType;
  const sport = (searchParams.get('sport') || 'all') as SportFilter;
  const period = (searchParams.get('period') || '30d') as Period;

  // Validate parameters
  if (!['overview', 'funnel', 'revenue', 'churn', 'engagement'].includes(type)) {
    return NextResponse.json(
      { success: false, error: 'Invalid type parameter' },
      { status: 400 }
    );
  }

  if (!['CORNHOLE', 'DARTS', 'all'].includes(sport)) {
    return NextResponse.json(
      { success: false, error: 'Invalid sport parameter' },
      { status: 400 }
    );
  }

  if (!['7d', '30d', '90d', '1y'].includes(period)) {
    return NextResponse.json(
      { success: false, error: 'Invalid period parameter' },
      { status: 400 }
    );
  }

  try {
    const cacheKey = buildCacheKey('admin', 'analytics', type, sport, period);
    
    const analytics = await cacheGetOrSet(
      cacheKey,
      async () => {
        const periodDates = getPeriodDates(period);
        const sportFilter: SportFilter = sport === 'all' ? 'all' : sport as SportFilter;

        switch (type) {
          case 'overview':
            return await getOverviewAnalytics(sportFilter, periodDates);
          case 'funnel':
            return await getFunnelAnalytics(sportFilter, periodDates);
          case 'revenue':
            return await getRevenueAnalytics(sportFilter, periodDates);
          case 'churn':
            return await getChurnAnalytics(sportFilter, periodDates);
          case 'engagement':
            return await getEngagementAnalytics(sportFilter, periodDates);
          default:
            return await getOverviewAnalytics(sportFilter, periodDates);
        }
      },
      CACHE_TTL.ORG_STATS
    );

    const response = NextResponse.json({
      success: true,
      data: {
        ...analytics,
        meta: {
          type,
          sport,
          period,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    addVersionHeaders(response);
    return response;
  } catch (error) {
    console.error('Failed to get admin analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get admin analytics' },
      { status: 500 }
    );
  }
}

// ============================================
// Period Date Calculator
// ============================================

function getPeriodDates(period: Period): PeriodDates {
  const now = new Date();
  let currentStart: Date;
  let periodDays: number;

  switch (period) {
    case '7d':
      periodDays = 7;
      break;
    case '30d':
      periodDays = 30;
      break;
    case '90d':
      periodDays = 90;
      break;
    case '1y':
      periodDays = 365;
      break;
    default:
      periodDays = 30;
  }

  currentStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const previousStart = new Date(currentStart.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const previousEnd = currentStart;

  return {
    currentStart,
    currentEnd: now,
    previousStart,
    previousEnd,
  };
}

// ============================================
// Helper Functions
// ============================================

function calculateTrend(current: number, previous: number): TrendData {
  const change = current - previous;
  const changePercent = previous > 0 ? (change / previous) * 100 : 0;
  
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(changePercent) >= 5) {
    trend = change > 0 ? 'up' : 'down';
  }

  return {
    value: current,
    previousValue: previous,
    change,
    changePercent: Math.round(changePercent * 100) / 100,
    trend,
  };
}

function getSportFilter(sport: SportFilter): { sport: SportType } | Record<string, never> {
  return sport === 'all' ? {} : { sport: sport as SportType };
}

// ============================================
// Overview Analytics
// ============================================

async function getOverviewAnalytics(sport: SportFilter, dates: PeriodDates) {
  const sportPrismaFilter = getSportFilter(sport);
  const { currentStart, previousStart, previousEnd } = dates;

  // Total Users (Players, Orgs, New this period)
  const [
    totalPlayersCurrent,
    totalPlayersPrevious,
    totalOrgsCurrent,
    totalOrgsPrevious,
    newPlayersCurrent,
    newPlayersPrevious,
    newOrgsCurrent,
    newOrgsPrevious,
  ] = await Promise.all([
    // Total players
    db.user.count({
      where: { ...sportPrismaFilter, isActive: true },
    }),
    db.user.count({
      where: { ...sportPrismaFilter, isActive: true, createdAt: { lt: previousStart } },
    }),
    // Total orgs
    db.organization.count({ where: sportPrismaFilter }),
    db.organization.count({
      where: { ...sportPrismaFilter, createdAt: { lt: previousStart } },
    }),
    // New players this period
    db.user.count({
      where: { ...sportPrismaFilter, createdAt: { gte: currentStart } },
    }),
    db.user.count({
      where: { ...sportPrismaFilter, createdAt: { gte: previousStart, lt: previousEnd } },
    }),
    // New orgs this period
    db.organization.count({
      where: { ...sportPrismaFilter, createdAt: { gte: currentStart } },
    }),
    db.organization.count({
      where: { ...sportPrismaFilter, createdAt: { gte: previousStart, lt: previousEnd } },
    }),
  ]);

  // Active Users (DAU, WAU, MAU)
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [dau, wau, mau] = await Promise.all([
    db.session.count({
      where: {
        ...sportPrismaFilter,
        lastActivityAt: { gte: oneDayAgo },
        expiresAt: { gte: now },
      },
    }),
    db.session.count({
      where: {
        ...sportPrismaFilter,
        lastActivityAt: { gte: oneWeekAgo },
        expiresAt: { gte: now },
      },
    }),
    db.session.count({
      where: {
        ...sportPrismaFilter,
        lastActivityAt: { gte: oneMonthAgo },
        expiresAt: { gte: now },
      },
    }),
  ]);

  // Tournaments (by status, type)
  const [
    totalTournaments,
    tournamentsByStatus,
    tournamentsByType,
    newTournamentsCurrent,
    newTournamentsPrevious,
  ] = await Promise.all([
    db.tournament.count({ where: sportPrismaFilter }),
    db.tournament.groupBy({
      by: ['status'],
      where: sportPrismaFilter,
      _count: true,
    }),
    db.tournament.groupBy({
      by: ['type'],
      where: sportPrismaFilter,
      _count: true,
    }),
    db.tournament.count({
      where: { ...sportPrismaFilter, createdAt: { gte: currentStart } },
    }),
    db.tournament.count({
      where: { ...sportPrismaFilter, createdAt: { gte: previousStart, lt: previousEnd } },
    }),
  ]);

  // Revenue (subscriptions, tournament fees)
  const [subscriptionRevenue, tournamentRevenue] = await Promise.all([
    db.paymentLedger.aggregate({
      where: {
        ...sportPrismaFilter,
        status: 'PAID',
        type: 'SUBSCRIPTION',
        createdAt: { gte: currentStart },
      },
      _sum: { amount: true },
    }),
    db.paymentLedger.aggregate({
      where: {
        ...sportPrismaFilter,
        status: 'PAID',
        type: 'TOURNAMENT_FEE',
        createdAt: { gte: currentStart },
      },
      _sum: { amount: true },
    }),
  ]);

  // Average session duration (from sessions table)
  const sessions = await db.session.findMany({
    where: {
      ...sportPrismaFilter,
      lastActivityAt: { gte: currentStart },
    },
    select: {
      createdAt: true,
      lastActivityAt: true,
    },
    take: 1000,
  });

  const avgSessionDuration = sessions.length > 0
    ? sessions.reduce((sum, s) => {
        const duration = s.lastActivityAt.getTime() - s.createdAt.getTime();
        return sum + duration / (1000 * 60); // in minutes
      }, 0) / sessions.length
    : 0;

  return {
    users: {
      totalPlayers: calculateTrend(totalPlayersCurrent, totalPlayersPrevious),
      totalOrganizations: calculateTrend(totalOrgsCurrent, totalOrgsPrevious),
      newUsers: calculateTrend(newPlayersCurrent + newOrgsCurrent, newPlayersPrevious + newOrgsPrevious),
      newPlayers: calculateTrend(newPlayersCurrent, newPlayersPrevious),
      newOrganizations: calculateTrend(newOrgsCurrent, newOrgsPrevious),
    },
    activeUsers: {
      dau: { value: dau, label: 'Daily Active Users' },
      wau: { value: wau, label: 'Weekly Active Users' },
      mau: { value: mau, label: 'Monthly Active Users' },
      dauToMauRatio: mau > 0 ? Math.round((dau / mau) * 100) / 100 : 0,
    },
    tournaments: {
      total: calculateTrend(totalTournaments, totalTournaments - newTournamentsCurrent + newTournamentsPrevious),
      byStatus: tournamentsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byType: tournamentsByType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {} as Record<string, number>),
      newThisPeriod: calculateTrend(newTournamentsCurrent, newTournamentsPrevious),
    },
    revenue: {
      subscriptions: {
        value: subscriptionRevenue._sum.amount || 0,
        currency: 'INR',
      },
      tournamentFees: {
        value: tournamentRevenue._sum.amount || 0,
        currency: 'INR',
      },
      total: {
        value: (subscriptionRevenue._sum.amount || 0) + (tournamentRevenue._sum.amount || 0),
        currency: 'INR',
      },
    },
    sessionDuration: {
      averageMinutes: Math.round(avgSessionDuration * 10) / 10,
      trend: avgSessionDuration > 30 ? 'good' : avgSessionDuration > 10 ? 'moderate' : 'low',
    },
  };
}

// ============================================
// Funnel Analytics
// ============================================

async function getFunnelAnalytics(sport: SportFilter, dates: PeriodDates) {
  const sportPrismaFilter = getSportFilter(sport);
  const { currentStart, previousStart, previousEnd } = dates;

  // Registration starts vs completed
  // In this system, registration is single-step, so starts ~= completed
  const [
    registrationsCurrent,
    registrationsPrevious,
    verifiedUsersCurrent,
    verifiedUsersPrevious,
  ] = await Promise.all([
    db.user.count({
      where: { ...sportPrismaFilter, createdAt: { gte: currentStart } },
    }),
    db.user.count({
      where: { ...sportPrismaFilter, createdAt: { gte: previousStart, lt: previousEnd } },
    }),
    db.user.count({
      where: { ...sportPrismaFilter, verified: true, verifiedAt: { gte: currentStart } },
    }),
    db.user.count({
      where: { ...sportPrismaFilter, verified: true, verifiedAt: { gte: previousStart, lt: previousEnd } },
    }),
  ]);

  // Profile completion rate
  const [totalUsers, usersWithCompleteProfile] = await Promise.all([
    db.user.count({ where: { ...sportPrismaFilter, isActive: true } }),
    db.user.count({
      where: {
        ...sportPrismaFilter,
        isActive: true,
        city: { not: null },
        state: { not: null },
        firstName: { not: '' },
        lastName: { not: '' },
      },
    }),
  ]);

  // First tournament registration rate
  const [newUsersCurrent, usersWithFirstTournament] = await Promise.all([
    db.user.count({
      where: { ...sportPrismaFilter, createdAt: { gte: currentStart } },
    }),
    db.tournamentRegistration.groupBy({
      by: ['userId'],
      where: {
        registeredAt: { gte: currentStart },
        user: sportPrismaFilter,
      },
      _count: true,
    }),
  ]);

  const usersRegisteredFirstTournament = usersWithFirstTournament.length;

  // Subscription conversion rate
  const [
    totalActiveUsers,
    subscribedUsers,
    newSubscriptionsCurrent,
    newSubscriptionsPrevious,
  ] = await Promise.all([
    db.user.count({
      where: { ...sportPrismaFilter, isActive: true },
    }),
    db.subscription.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
        ...sportPrismaFilter,
      },
    }),
    db.subscription.count({
      where: {
        ...sportPrismaFilter,
        createdAt: { gte: currentStart },
      },
    }),
    db.subscription.count({
      where: {
        ...sportPrismaFilter,
        createdAt: { gte: previousStart, lt: previousEnd },
      },
    }),
  ]);

  // Calculate rates
  const profileCompletionRate = totalUsers > 0
    ? Math.round((usersWithCompleteProfile / totalUsers) * 10000) / 100
    : 0;

  const firstTournamentRate = newUsersCurrent > 0
    ? Math.round((usersRegisteredFirstTournament / newUsersCurrent) * 10000) / 100
    : 0;

  const subscriptionConversionRate = totalActiveUsers > 0
    ? Math.round((subscribedUsers / totalActiveUsers) * 10000) / 100
    : 0;

  // Funnel stages
  const funnelStages = [
    { stage: 'Registration Started', count: registrationsCurrent },
    { stage: 'Email Verified', count: verifiedUsersCurrent },
    { stage: 'Profile Completed', count: usersWithCompleteProfile },
    { stage: 'First Tournament', count: usersRegisteredFirstTournament },
    { stage: 'Subscribed', count: subscribedUsers },
  ];

  // Calculate drop-off between stages
  const funnelWithDropoff = funnelStages.map((stage, index) => ({
    ...stage,
    dropoffFromPrevious: index === 0 ? 0 
      : Math.round((1 - stage.count / funnelStages[index - 1].count) * 10000) / 100,
    conversionFromStart: Math.round((stage.count / registrationsCurrent) * 10000) / 100,
  }));

  return {
    registrations: {
      current: calculateTrend(registrationsCurrent, registrationsPrevious),
      verified: calculateTrend(verifiedUsersCurrent, verifiedUsersPrevious),
      verificationRate: registrationsCurrent > 0
        ? Math.round((verifiedUsersCurrent / registrationsCurrent) * 10000) / 100
        : 0,
    },
    profileCompletion: {
      completed: usersWithCompleteProfile,
      total: totalUsers,
      rate: profileCompletionRate,
    },
    firstTournament: {
      usersRegisteredFirstTournament,
      newUsers: newUsersCurrent,
      rate: firstTournamentRate,
    },
    subscriptionConversion: {
      subscribed: subscribedUsers,
      totalUsers: totalActiveUsers,
      rate: subscriptionConversionRate,
      newSubscriptions: calculateTrend(newSubscriptionsCurrent, newSubscriptionsPrevious),
    },
    funnel: funnelWithDropoff,
    summary: {
      overallConversion: registrationsCurrent > 0
        ? Math.round((subscribedUsers / registrationsCurrent) * 10000) / 100
        : 0,
      keyBottleneck: funnelWithDropoff.reduce((worst, stage, index) => {
        if (index === 0) return stage;
        return stage.dropoffFromPrevious > worst.dropoffFromPrevious ? stage : worst;
      }, funnelWithDropoff[1] || funnelWithDropoff[0]),
    },
  };
}

// ============================================
// Revenue Analytics
// ============================================

async function getRevenueAnalytics(sport: SportFilter, dates: PeriodDates) {
  const sportPrismaFilter = getSportFilter(sport);
  const { currentStart, previousStart, previousEnd } = dates;

  // MRR (Monthly Recurring Revenue)
  const activeSubscriptions = await db.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      ...sportPrismaFilter,
    },
    select: { amount: true, startDate: true, endDate: true },
  });

  const orgSubscriptions = await db.orgSubscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      ...(sport ? { org: { sport: sport as SportType } } : {}),
    },
    select: { amount: true, startDate: true, endDate: true },
  });

  // Calculate MRR (assuming subscriptions are monthly)
  const playerMrr = activeSubscriptions.reduce((sum, sub) => sum + sub.amount, 0);
  const orgMrr = orgSubscriptions.reduce((sum, sub) => sum + sub.amount, 0);
  const totalMrr = playerMrr + orgMrr;

  // ARR (Annual Recurring Revenue)
  const arr = totalMrr * 12;

  // Revenue by sport
  const revenueBySport = await db.paymentLedger.groupBy({
    by: ['sport'],
    where: {
      status: 'PAID',
      createdAt: { gte: currentStart },
    },
    _sum: { amount: true },
  });

  // Revenue by user type (player vs org)
  const [
    playerRevenue,
    orgRevenue,
  ] = await Promise.all([
    db.paymentLedger.aggregate({
      where: {
        status: 'PAID',
        createdAt: { gte: currentStart },
        userId: { not: null },
        ...sportPrismaFilter,
      },
      _sum: { amount: true },
    }),
    db.paymentLedger.aggregate({
      where: {
        status: 'PAID',
        createdAt: { gte: currentStart },
        orgId: { not: null },
        ...(sport ? { sport: sport as SportType } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  // Previous period revenue for comparison
  const previousRevenue = await db.paymentLedger.aggregate({
    where: {
      status: 'PAID',
      createdAt: { gte: previousStart, lt: previousEnd },
      ...sportPrismaFilter,
    },
    _sum: { amount: true },
  });

  const currentRevenue = await db.paymentLedger.aggregate({
    where: {
      status: 'PAID',
      createdAt: { gte: currentStart },
      ...sportPrismaFilter,
    },
    _sum: { amount: true },
  });

  // ARPU (Average Revenue Per User)
  const [totalUsers, totalOrgs] = await Promise.all([
    db.user.count({ where: { ...sportPrismaFilter, isActive: true } }),
    db.organization.count({ where: sportPrismaFilter }),
  ]);

  const totalEntities = totalUsers + totalOrgs;
  const arpu = totalEntities > 0 ? Math.round((currentRevenue._sum.amount || 0) / totalEntities) : 0;

  // Revenue by payment type
  const revenueByType = await db.paymentLedger.groupBy({
    by: ['type'],
    where: {
      status: 'PAID',
      createdAt: { gte: currentStart },
      ...sportPrismaFilter,
    },
    _sum: { amount: true },
  });

  return {
    mrr: {
      total: { value: totalMrr, currency: 'INR' },
      players: { value: playerMrr, currency: 'INR' },
      organizations: { value: orgMrr, currency: 'INR' },
      breakdown: {
        players: Math.round((playerMrr / (totalMrr || 1)) * 100),
        organizations: Math.round((orgMrr / (totalMrr || 1)) * 100),
      },
    },
    arr: {
      total: { value: arr, currency: 'INR' },
    },
    revenueBySport: revenueBySport.reduce((acc, item) => {
      acc[item.sport] = item._sum.amount || 0;
      return acc;
    }, {} as Record<string, number>),
    revenueByUserType: {
      players: playerRevenue._sum.amount || 0,
      organizations: orgRevenue._sum.amount || 0,
    },
    arpu: {
      value: arpu,
      currency: 'INR',
      totalUsers,
      totalOrganizations: totalOrgs,
    },
    revenueByType: revenueByType.reduce((acc, item) => {
      acc[item.type] = item._sum.amount || 0;
      return acc;
    }, {} as Record<string, number>),
    periodComparison: calculateTrend(
      currentRevenue._sum.amount || 0,
      previousRevenue._sum.amount || 0
    ),
    subscriptionCounts: {
      activePlayers: activeSubscriptions.length,
      activeOrganizations: orgSubscriptions.length,
    },
  };
}

// ============================================
// Churn Analytics
// ============================================

async function getChurnAnalytics(sport: SportFilter, dates: PeriodDates) {
  const sportPrismaFilter = getSportFilter(sport);
  const { currentStart, previousStart, previousEnd } = dates;

  // Churn rate by month (last 6 months)
  const churnByMonth = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - i);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const [activeAtStart, churned] = await Promise.all([
      db.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          startDate: { lt: monthEnd },
          ...sportPrismaFilter,
        },
      }),
      db.subscription.count({
        where: {
          status: SubscriptionStatus.EXPIRED,
          updatedAt: { gte: monthStart, lt: monthEnd },
          ...sportPrismaFilter,
        },
      }),
    ]);

    churnByMonth.push({
      month: monthStart.toISOString().slice(0, 7),
      active: activeAtStart,
      churned,
      rate: activeAtStart > 0 ? Math.round((churned / activeAtStart) * 10000) / 100 : 0,
    });
  }

  // Churn by user type (player vs org)
  const [playerChurn, orgChurn, totalActivePlayers, totalActiveOrgs] = await Promise.all([
    db.subscription.count({
      where: {
        status: SubscriptionStatus.EXPIRED,
        updatedAt: { gte: currentStart },
        ...sportPrismaFilter,
      },
    }),
    db.orgSubscription.count({
      where: {
        status: SubscriptionStatus.EXPIRED,
        updatedAt: { gte: currentStart },
        ...(sport ? { org: { sport: sport as SportType } } : {}),
      },
    }),
    db.subscription.count({
      where: { status: SubscriptionStatus.ACTIVE, ...sportPrismaFilter },
    }),
    db.orgSubscription.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
        ...(sport ? { org: { sport: sport as SportType } } : {}),
      },
    }),
  ]);

  // Common churn reasons (from user deactivation)
  const churnReasons = await db.user.groupBy({
    by: ['deactivationReason'],
    where: {
      isActive: false,
      deactivationReason: { not: null },
      deactivatedAt: { gte: currentStart },
      ...sportPrismaFilter,
    },
    _count: true,
    orderBy: { _count: { deactivationReason: 'desc' } },
    take: 5,
  });

  // Win-back rate (users who re-subscribed after churning)
  const churnedUsers = await db.subscription.findMany({
    where: {
      status: SubscriptionStatus.EXPIRED,
      updatedAt: { gte: previousStart, lt: previousEnd },
      ...sportPrismaFilter,
    },
    select: { userId: true },
  });

  const churnedUserIds = [...new Set(churnedUsers.map(s => s.userId))];

  const winBackUsers = await db.subscription.count({
    where: {
      userId: { in: churnedUserIds },
      status: SubscriptionStatus.ACTIVE,
      createdAt: { gte: currentStart },
      ...sportPrismaFilter,
    },
  });

  const winBackRate = churnedUserIds.length > 0
    ? Math.round((winBackUsers / churnedUserIds.length) * 10000) / 100
    : 0;

  // Previous period churn for comparison
  const previousChurned = await db.subscription.count({
    where: {
      status: SubscriptionStatus.EXPIRED,
      updatedAt: { gte: previousStart, lt: previousEnd },
      ...sportPrismaFilter,
    },
  });

  const currentChurned = playerChurn;

  // Calculate overall churn rate
  const totalSubscriptions = totalActivePlayers + totalActiveOrgs + currentChurned;
  const overallChurnRate = totalSubscriptions > 0
    ? Math.round((currentChurned / totalSubscriptions) * 10000) / 100
    : 0;

  return {
    overallChurnRate: {
      current: overallChurnRate,
      comparison: calculateTrend(currentChurned, previousChurned),
    },
    churnByMonth,
    churnByUserType: {
      players: {
        churned: playerChurn,
        active: totalActivePlayers,
        rate: totalActivePlayers > 0
          ? Math.round((playerChurn / (totalActivePlayers + playerChurn)) * 10000) / 100
          : 0,
      },
      organizations: {
        churned: orgChurn,
        active: totalActiveOrgs,
        rate: totalActiveOrgs > 0
          ? Math.round((orgChurn / (totalActiveOrgs + orgChurn)) * 10000) / 100
          : 0,
      },
    },
    churnReasons: churnReasons.map(r => ({
      reason: r.deactivationReason || 'Unknown',
      count: r._count,
      percentage: currentChurned > 0
        ? Math.round((r._count / currentChurned) * 10000) / 100
        : 0,
    })),
    winBack: {
      churnedUsers: churnedUserIds.length,
      wonBack: winBackUsers,
      rate: winBackRate,
    },
    atRisk: {
      expiringIn7Days: await db.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          endDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          ...sportPrismaFilter,
        },
      }),
      expiringIn30Days: await db.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          endDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          ...sportPrismaFilter,
        },
      }),
    },
  };
}

// ============================================
// Engagement Analytics
// ============================================

async function getEngagementAnalytics(sport: SportFilter, dates: PeriodDates) {
  const sportPrismaFilter = getSportFilter(sport);
  const { currentStart, previousStart, previousEnd } = dates;

  // Matches played per user
  const matchesCurrent = await db.match.findMany({
    where: {
      playedAt: { gte: currentStart },
      ...sportPrismaFilter,
    },
    select: { playerAId: true, playerBId: true },
  });

  const matchesPrevious = await db.match.findMany({
    where: {
      playedAt: { gte: previousStart, lt: previousEnd },
      ...sportPrismaFilter,
    },
    select: { playerAId: true, playerBId: true },
  });

  const uniquePlayersCurrent = new Set([
    ...matchesCurrent.map(m => m.playerAId),
    ...matchesCurrent.map(m => m.playerBId).filter(Boolean),
  ]);

  const matchesPerUser = uniquePlayersCurrent.size > 0
    ? Math.round((matchesCurrent.length / uniquePlayersCurrent.size) * 100) / 100
    : 0;

  // Tournaments per user
  const tournamentRegs = await db.tournamentRegistration.findMany({
    where: {
      registeredAt: { gte: currentStart },
      user: sportPrismaFilter,
    },
    select: { userId: true },
  });

  const uniqueTournamentPlayers = new Set(tournamentRegs.map(r => r.userId));
  const tournamentsPerUser = uniqueTournamentPlayers.size > 0
    ? Math.round((tournamentRegs.length / uniqueTournamentPlayers.size) * 100) / 100
    : 0;

  // Average login frequency (from sessions)
  const sessions = await db.session.groupBy({
    by: ['userId'],
    where: {
      createdAt: { gte: currentStart },
      ...sportPrismaFilter,
    },
    _count: true,
  });

  const avgLoginFrequency = sessions.length > 0
    ? Math.round((sessions.reduce((sum, s) => sum + s._count, 0) / sessions.length) * 100) / 100
    : 0;

  // Feature usage
  const [
    messagesSent,
    followsCreated,
    conversationsActive,
    profileUpdates,
  ] = await Promise.all([
    // Messages sent
    db.message.count({
      where: {
        createdAt: { gte: currentStart },
        conversation: sportPrismaFilter,
      },
    }),
    // Follows created
    db.userFollow.count({
      where: {
        createdAt: { gte: currentStart },
        ...sportPrismaFilter,
      },
    }),
    // Active conversations
    db.conversation.count({
      where: {
        updatedAt: { gte: currentStart },
        ...sportPrismaFilter,
      },
    }),
    // Profile updates (approximated from user updates)
    db.user.count({
      where: {
        updatedAt: { gte: currentStart },
        ...sportPrismaFilter,
      },
    }),
  ]);

  // Previous period engagement for comparison
  const [
    prevMatches,
    prevTournamentRegs,
    prevMessages,
    prevFollows,
  ] = await Promise.all([
    db.match.count({
      where: {
        playedAt: { gte: previousStart, lt: previousEnd },
        ...sportPrismaFilter,
      },
    }),
    db.tournamentRegistration.count({
      where: {
        registeredAt: { gte: previousStart, lt: previousEnd },
      },
    }),
    db.message.count({
      where: {
        createdAt: { gte: previousStart, lt: previousEnd },
        conversation: sportPrismaFilter,
      },
    }),
    db.userFollow.count({
      where: {
        createdAt: { gte: previousStart, lt: previousEnd },
        ...sportPrismaFilter,
      },
    }),
  ]);

  // Engagement score calculation
  const engagementScore = calculateEngagementScore({
    matches: matchesCurrent.length,
    tournaments: tournamentRegs.length,
    messages: messagesSent,
    follows: followsCreated,
  });

  return {
    matches: {
      total: calculateTrend(matchesCurrent.length, prevMatches),
      uniquePlayers: uniquePlayersCurrent.size,
      perUser: matchesPerUser,
    },
    tournaments: {
      registrations: calculateTrend(tournamentRegs.length, prevTournamentRegs),
      uniqueParticipants: uniqueTournamentPlayers.size,
      perUser: tournamentsPerUser,
    },
    loginFrequency: {
      average: avgLoginFrequency,
      totalSessions: sessions.length,
      activeUsers: sessions.length,
    },
    featureUsage: {
      messaging: {
        messagesSent: calculateTrend(messagesSent, prevMessages),
        activeConversations: conversationsActive,
      },
      social: {
        followsCreated: calculateTrend(followsCreated, prevFollows),
        profileUpdates,
      },
    },
    engagementScore: {
      value: engagementScore,
      level: engagementScore >= 80 ? 'high' : engagementScore >= 50 ? 'moderate' : 'low',
      components: {
        matches: Math.min(100, (matchesCurrent.length / (prevMatches || 1)) * 50),
        tournaments: Math.min(100, (tournamentRegs.length / (prevTournamentRegs || 1)) * 30),
        social: Math.min(100, ((messagesSent + followsCreated) / ((prevMessages + prevFollows) || 1)) * 20),
      },
    },
    summary: {
      mostActiveFeature: messagesSent > followsCreated && messagesSent > tournamentRegs.length
        ? 'messaging'
        : followsCreated > tournamentRegs.length
          ? 'social'
          : 'tournaments',
      averageSessionDepth: avgLoginFrequency > 3 ? 'deep' : avgLoginFrequency > 1 ? 'moderate' : 'shallow',
    },
  };
}

// ============================================
// Engagement Score Calculator
// ============================================

function calculateEngagementScore(data: {
  matches: number;
  tournaments: number;
  messages: number;
  follows: number;
}): number {
  // Weighted scoring system
  const weights = {
    matches: 0.4,
    tournaments: 0.3,
    messages: 0.15,
    follows: 0.15,
  };

  // Normalize each metric (assuming benchmarks)
  const benchmarks = {
    matches: 100,
    tournaments: 50,
    messages: 500,
    follows: 100,
  };

  const scores = {
    matches: Math.min(100, (data.matches / benchmarks.matches) * 100),
    tournaments: Math.min(100, (data.tournaments / benchmarks.tournaments) * 100),
    messages: Math.min(100, (data.messages / benchmarks.messages) * 100),
    follows: Math.min(100, (data.follows / benchmarks.follows) * 100),
  };

  return Math.round(
    scores.matches * weights.matches +
    scores.tournaments * weights.tournaments +
    scores.messages * weights.messages +
    scores.follows * weights.follows
  );
}
