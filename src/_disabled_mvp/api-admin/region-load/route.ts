/**
 * Admin Region Load API
 *
 * Provides comprehensive region load metrics for visualization dashboard:
 * - Heat map data for tournament density by state
 * - Bar chart data for tournaments per admin
 * - Trend line data for load changes over time
 * - Alert indicators for overloaded regions
 * - Summary statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AdminRole, SportType, TournamentStatus } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { indianStates } from '@/lib/indian-locations';

// Load threshold for alerting (tournaments/admin ratio)
const LOAD_THRESHOLDS = {
  LOW: 5,      // Healthy
  MEDIUM: 10,  // Moderate
  HIGH: 15,    // High
  CRITICAL: 20 // Critical
};

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sportParam = searchParams.get('sport') as SportType | null;
    const timePeriod = searchParams.get('period') || 'month'; // week, month, year
    const sortBy = searchParams.get('sort') || 'high'; // high, low, name
    const stateCode = searchParams.get('state'); // For detailed breakdown

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    switch (timePeriod) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // If stateCode is provided, get detailed breakdown for that state
    if (stateCode) {
      return getDetailedBreakdown(stateCode, sportParam, startDate, timePeriod);
    }

    // Get summary statistics
    const summary = await getSummaryStats(sportParam, startDate);

    // Get heat map data (tournament density by state)
    const heatMapData = await getHeatMapData(sportParam, startDate, sortBy);

    // Get bar chart data (tournaments per admin by state)
    const barChartData = await getBarChartData(sportParam, startDate, sortBy);

    // Get trend line data (load changes over time)
    const trendData = await getTrendData(sportParam, timePeriod);

    // Get alert indicators (overloaded regions)
    const alerts = await getAlertRegions(sportParam, startDate);

    return NextResponse.json({
      success: true,
      summary,
      heatMapData,
      barChartData,
      trendData,
      alerts,
      filters: {
        sport: sportParam,
        period: timePeriod,
        sortBy
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Region load API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get summary statistics
async function getSummaryStats(sport: SportType | null, startDate: Date) {
  const sportFilter = sport ? { sport } : {};

  // Total active admins
  const totalAdmins = await db.adminAssignment.count({
    where: {
      isActive: true,
      ...sportFilter
    }
  });

  // Total active tournaments
  const activeStatuses: TournamentStatus[] = [
    TournamentStatus.REGISTRATION_OPEN,
    TournamentStatus.REGISTRATION_CLOSED,
    TournamentStatus.BRACKET_GENERATED,
    TournamentStatus.IN_PROGRESS
  ];

  const totalActiveTournaments = await db.tournament.count({
    where: {
      status: { in: activeStatuses },
      createdAt: { gte: startDate },
      ...sportFilter
    }
  });

  // Get load metrics for average calculation
  const loadMetrics = await db.regionLoadMetric.findMany({
    where: {
      createdAt: { gte: startDate }
    },
    select: {
      currentLoadPercent: true
    }
  });

  const avgLoad = loadMetrics.length > 0
    ? loadMetrics.reduce((sum, m) => sum + m.currentLoadPercent, 0) / loadMetrics.length
    : 0;

  // Count critical regions (tournaments/admin > threshold)
  const criticalRegions = await getCriticalRegionsCount(sport, startDate);

  return {
    totalAdmins,
    totalActiveTournaments,
    avgLoad: Math.round(avgLoad * 10) / 10,
    criticalRegions
  };
}

// Get heat map data for tournament density by state
async function getHeatMapData(
  sport: SportType | null,
  startDate: Date,
  sortBy: string
) {
  const sportFilter = sport ? { sport } : {};

  // Get tournaments grouped by state
  const tournamentsByState = await db.tournament.groupBy({
    by: ['state'],
    where: {
      state: { not: null },
      createdAt: { gte: startDate },
      ...sportFilter
    },
    _count: { id: true }
  });

  // Get admins grouped by state
  const adminsByState = await db.adminAssignment.groupBy({
    by: ['stateCode'],
    where: {
      stateCode: { not: null },
      isActive: true,
      ...sportFilter
    },
    _count: { id: true }
  });

  // Combine into heat map data
  const heatMapData = indianStates.map(state => {
    const tournamentCount = tournamentsByState.find(t => t.state === state.code)?._count.id || 0;
    const adminCount = adminsByState.find(a => a.stateCode === state.code)?._count.id || 0;
    const load = adminCount > 0 ? tournamentCount / adminCount : tournamentCount;
    const density = getDensityLevel(tournamentCount);

    return {
      stateCode: state.code,
      stateName: state.name,
      stateType: state.type,
      tournaments: tournamentCount,
      admins: adminCount,
      load: Math.round(load * 10) / 10,
      density,
      densityScore: tournamentCount, // For coloring
      status: getLoadStatus(load)
    };
  });

  // Sort based on sortBy parameter
  if (sortBy === 'high') {
    heatMapData.sort((a, b) => b.load - a.load);
  } else if (sortBy === 'low') {
    heatMapData.sort((a, b) => a.load - b.load);
  } else {
    heatMapData.sort((a, b) => a.stateName.localeCompare(b.stateName));
  }

  return heatMapData;
}

// Get bar chart data for tournaments per admin
async function getBarChartData(
  sport: SportType | null,
  startDate: Date,
  sortBy: string
) {
  const sportFilter = sport ? { sport } : {};

  // Get admins with their tournament counts
  const admins = await db.adminAssignment.findMany({
    where: {
      isActive: true,
      ...sportFilter
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });

  // Get tournament staff assignments
  const tournamentStaff = await db.tournamentStaff.findMany({
    where: {
      tournament: {
        createdAt: { gte: startDate },
        ...sportFilter
      }
    },
    select: {
      userId: true
    }
  });

  // Count tournaments per admin
  const tournamentCounts: Record<string, number> = {};
  tournamentStaff.forEach(ts => {
    tournamentCounts[ts.userId] = (tournamentCounts[ts.userId] || 0) + 1;
  });

  // Group by state
  const stateMap = new Map<string, { admins: number; tournaments: number; adminNames: string[] }>();

  admins.forEach(admin => {
    const stateKey = admin.stateCode || 'Unknown';
    const tournamentCount = tournamentCounts[admin.userId] || 0;
    const adminName = `${admin.user.firstName} ${admin.user.lastName}`;

    if (!stateMap.has(stateKey)) {
      stateMap.set(stateKey, { admins: 0, tournaments: 0, adminNames: [] });
    }
    const entry = stateMap.get(stateKey)!;
    entry.admins++;
    entry.tournaments += tournamentCount;
    entry.adminNames.push(adminName);
  });

  // Convert to bar chart data
  let barChartData = Array.from(stateMap.entries()).map(([stateCode, data]) => {
    const state = indianStates.find(s => s.code === stateCode);
    return {
      stateCode,
      stateName: state?.name || stateCode,
      admins: data.admins,
      tournaments: data.tournaments,
      avgPerAdmin: data.admins > 0 ? Math.round((data.tournaments / data.admins) * 10) / 10 : 0,
      topAdmins: data.adminNames.slice(0, 3)
    };
  });

  // Sort
  if (sortBy === 'high') {
    barChartData.sort((a, b) => b.avgPerAdmin - a.avgPerAdmin);
  } else if (sortBy === 'low') {
    barChartData.sort((a, b) => a.avgPerAdmin - b.avgPerAdmin);
  }

  // Return top 15
  return barChartData.slice(0, 15);
}

// Get trend data for load changes over time
async function getTrendData(sport: SportType | null, period: string) {
  const sportFilter = sport ? { sport } : {};
  const now = new Date();
  const dataPoints: Array<{ date: string; load: number; tournaments: number; admins: number }> = [];

  // Determine intervals based on period
  let intervals: number;
  let intervalMs: number;
  let dateFormat: (d: Date) => string;

  switch (period) {
    case 'week':
      intervals = 7;
      intervalMs = 24 * 60 * 60 * 1000; // 1 day
      dateFormat = (d) => d.toLocaleDateString('en-US', { weekday: 'short' });
      break;
    case 'year':
      intervals = 12;
      intervalMs = 30 * 24 * 60 * 60 * 1000; // ~1 month
      dateFormat = (d) => d.toLocaleDateString('en-US', { month: 'short' });
      break;
    case 'month':
    default:
      intervals = 4;
      intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
      dateFormat = (d) => `Week ${Math.ceil(d.getDate() / 7)}`;
  }

  for (let i = intervals - 1; i >= 0; i--) {
    const endDate = new Date(now.getTime() - i * intervalMs);
    const startDate = new Date(endDate.getTime() - intervalMs);

    const tournaments = await db.tournament.count({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        ...sportFilter
      }
    });

    const admins = await db.adminAssignment.count({
      where: {
        isActive: true,
        assignedAt: { lt: endDate },
        ...sportFilter
      }
    });

    const load = admins > 0 ? tournaments / admins : tournaments;

    dataPoints.push({
      date: dateFormat(endDate),
      load: Math.round(load * 10) / 10,
      tournaments,
      admins
    });
  }

  return dataPoints;
}

// Get alert regions (overloaded)
async function getAlertRegions(sport: SportType | null, startDate: Date) {
  const heatMapData = await getHeatMapData(sport, startDate, 'high');

  return heatMapData
    .filter(item => item.status === 'critical' || item.status === 'high')
    .map(item => ({
      stateCode: item.stateCode,
      stateName: item.stateName,
      load: item.load,
      tournaments: item.tournaments,
      admins: item.admins,
      status: item.status,
      recommendation: getRecommendation(item)
    }));
}

// Get detailed breakdown for a specific state
async function getDetailedBreakdown(
  stateCode: string,
  sport: SportType | null,
  startDate: Date,
  _period: string
) {
  const sportFilter = sport ? { sport } : {};
  const state = indianStates.find(s => s.code === stateCode);

  if (!state) {
    return NextResponse.json({ error: 'Invalid state code' }, { status: 400 });
  }

  // Get tournaments in this state
  const tournaments = await db.tournament.findMany({
    where: {
      state: stateCode,
      createdAt: { gte: startDate },
      ...sportFilter
    },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      city: true,
      _count: {
        select: { participants: true }
      }
    },
    orderBy: { startDate: 'desc' }
  });

  // Get admins in this state
  const admins = await db.adminAssignment.findMany({
    where: {
      stateCode,
      isActive: true,
      ...sportFilter
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  // Get tournament assignments per admin
  const adminTournamentCounts = await Promise.all(
    admins.map(async (admin) => {
      const count = await db.tournamentStaff.count({
        where: {
          userId: admin.userId,
          tournament: {
            state: stateCode,
            ...sportFilter
          }
        }
      });
      return {
        ...admin,
        tournamentCount: count
      };
    })
  );

  return NextResponse.json({
    success: true,
    state: {
      code: state.code,
      name: state.name,
      type: state.type
    },
    tournaments: tournaments.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      startDate: t.startDate,
      city: t.city,
      participants: t._count.participants
    })),
    admins: adminTournamentCounts.map(a => ({
      id: a.id,
      name: `${a.user.firstName} ${a.user.lastName}`,
      email: a.user.email,
      role: a.adminRole,
      tournamentCount: a.tournamentCount,
      load: a.tournamentCount
    })),
    summary: {
      totalTournaments: tournaments.length,
      totalAdmins: admins.length,
      avgLoad: admins.length > 0 ? Math.round((tournaments.length / admins.length) * 10) / 10 : tournaments.length
    }
  });
}

// Helper functions
function getDensityLevel(count: number): string {
  if (count === 0) return 'none';
  if (count < 5) return 'low';
  if (count < 15) return 'medium';
  if (count < 30) return 'high';
  return 'very-high';
}

function getLoadStatus(load: number): string {
  if (load === 0) return 'healthy';
  if (load < LOAD_THRESHOLDS.LOW) return 'healthy';
  if (load < LOAD_THRESHOLDS.MEDIUM) return 'moderate';
  if (load < LOAD_THRESHOLDS.HIGH) return 'high';
  return 'critical';
}

function getCriticalRegionsCount(sport: SportType | null, startDate: Date): Promise<number> {
  return new Promise(async (resolve) => {
    const alerts = await getAlertRegions(sport, startDate);
    resolve(alerts.length);
  });
}

function getRecommendation(item: { load: number; admins: number; tournaments: number }): string {
  if (item.admins === 0) {
    return 'No admins assigned. Assign at least one admin to this region.';
  }
  if (item.load > LOAD_THRESHOLDS.CRITICAL) {
    return `Critical load. Consider adding ${Math.ceil(item.tournaments / LOAD_THRESHOLDS.MEDIUM) - item.admins} more admins.`;
  }
  if (item.load > LOAD_THRESHOLDS.HIGH) {
    return `High load. Consider redistributing tournaments or adding 1-2 more admins.`;
  }
  return 'Load is within acceptable range.';
}
