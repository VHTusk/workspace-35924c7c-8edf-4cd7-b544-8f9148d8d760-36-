import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';

/**
 * Advanced Player Analytics API
 * 
 * Provides:
 * - Win rate trends over time (daily, weekly, monthly)
 * - Performance by tournament type/format/scope
 * - Form indicator
 * - Head-to-head stats
 */

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await validateSession(sessionToken);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const userId = session.user.id
    const sport = session.user.sport
    const { searchParams } = new URL(request.url)
    const dataType = searchParams.get('type') || 'all'
    const period = searchParams.get('period') || 'monthly' // daily, weekly, monthly

    const response: any = {}

    // 1. Win Rate Trends Over Time
    if (dataType === 'all' || dataType === 'trends') {
      response.trends = await getWinRateTrends(userId, sport, period)
    }

    // 2. Performance by Tournament Type/Format
    if (dataType === 'all' || dataType === 'byType') {
      response.byType = await getPerformanceByType(userId, sport)
    }

    // 3. Form Indicator
    if (dataType === 'all' || dataType === 'form') {
      response.form = await getFormIndicator(userId, sport)
    }

    // 4. Performance by Scope (City, District, State, National)
    if (dataType === 'all' || dataType === 'byScope') {
      response.byScope = await getPerformanceByScope(userId, sport)
    }

    // 5. Recent Performance Summary
    if (dataType === 'all' || dataType === 'recent') {
      response.recent = await getRecentPerformance(userId, sport)
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching player analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

// Get win rate trends over time
async function getWinRateTrends(userId: string, sport: string, periodType: string) {
  // Get all verified matches for this player
  const matches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
      playedAt: { not: null },
    },
    include: {
      tournament: {
        select: { scope: true },
      },
    },
    orderBy: { playedAt: 'asc' },
  })

  // Group matches by period
  const periodData: Record<string, { wins: number; losses: number; points: number }> = {}

  for (const match of matches) {
    if (!match.playedAt) continue
    
    const date = new Date(match.playedAt)
    let periodKey: string

    if (periodType === 'daily') {
      periodKey = date.toISOString().split('T')[0]
    } else if (periodType === 'weekly') {
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      periodKey = weekStart.toISOString().split('T')[0]
    } else {
      // Monthly
      periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }

    if (!periodData[periodKey]) {
      periodData[periodKey] = { wins: 0, losses: 0, points: 0 }
    }

    const won = match.winnerId === userId
    if (won) {
      periodData[periodKey].wins++
      const scope = match.tournament?.scope
      periodData[periodKey].points += scope === 'NATIONAL' ? 9 : scope === 'STATE' ? 6 : scope === 'DISTRICT' ? 4 : 3
    } else {
      periodData[periodKey].losses++
      const scope = match.tournament?.scope
      periodData[periodKey].points += scope === 'NATIONAL' ? 3 : scope === 'STATE' ? 2 : 1
    }
  }

  // Convert to array and calculate win rates
  const trends = Object.entries(periodData)
    .map(([period, data]) => ({
      period,
      wins: data.wins,
      losses: data.losses,
      matches: data.wins + data.losses,
      winRate: data.wins + data.losses > 0 
        ? Math.round((data.wins / (data.wins + data.losses)) * 1000) / 10 
        : 0,
      points: data.points,
    }))
    .sort((a, b) => a.period.localeCompare(b.period))

  // Calculate moving average (last 3 periods)
  const movingAverages = trends.map((trend, index) => {
    const start = Math.max(0, index - 2)
    const window = trends.slice(start, index + 1)
    const avgWinRate = window.reduce((sum, t) => sum + t.winRate, 0) / window.length
    return {
      ...trend,
      movingAverage: Math.round(avgWinRate * 10) / 10,
    }
  })

  return {
    periodType,
    data: movingAverages,
    summary: {
      totalPeriods: trends.length,
      totalWins: trends.reduce((sum, t) => sum + t.wins, 0),
      totalLosses: trends.reduce((sum, t) => sum + t.losses, 0),
      overallWinRate: trends.length > 0 
        ? Math.round((trends.reduce((sum, t) => sum + t.wins, 0) / 
            (trends.reduce((sum, t) => sum + t.wins, 0) + trends.reduce((sum, t) => sum + t.losses, 0))) * 1000) / 10
        : 0,
    },
  }
}

// Get performance by tournament type and format
async function getPerformanceByType(userId: string, sport: string) {
  const matches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
    },
    include: {
      tournament: {
        select: { type: true, format: true },
      },
    },
  })

  // Group by tournament type
  const byType: Record<string, { wins: number; losses: number; tournaments: Set<string> }> = {}
  const byFormat: Record<string, { wins: number; losses: number }> = {}

  for (const match of matches) {
    const won = match.winnerId === userId
    const type = match.tournament?.type || 'UNKNOWN'
    const format = match.tournament?.format || 'INDIVIDUAL'

    // By type
    if (!byType[type]) {
      byType[type] = { wins: 0, losses: 0, tournaments: new Set() }
    }
    if (won) byType[type].wins++
    else byType[type].losses++
    if (match.tournamentId) byType[type].tournaments.add(match.tournamentId)

    // By format
    if (!byFormat[format]) {
      byFormat[format] = { wins: 0, losses: 0 }
    }
    if (won) byFormat[format].wins++
    else byFormat[format].losses++
  }

  return {
    byType: Object.entries(byType).map(([type, data]) => ({
      type,
      wins: data.wins,
      losses: data.losses,
      matches: data.wins + data.losses,
      winRate: data.wins + data.losses > 0 
        ? Math.round((data.wins / (data.wins + data.losses)) * 1000) / 10 
        : 0,
      tournamentsPlayed: data.tournaments.size,
    })),
    byFormat: Object.entries(byFormat).map(([format, data]) => ({
      format,
      wins: data.wins,
      losses: data.losses,
      matches: data.wins + data.losses,
      winRate: data.wins + data.losses > 0 
        ? Math.round((data.wins / (data.wins + data.losses)) * 1000) / 10 
        : 0,
    })),
  }
}

// Get form indicator
async function getFormIndicator(userId: string, sport: string) {
  // Get recent matches for calculation
  const recentMatches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
    },
    include: {
      playerA: { select: { hiddenElo: true } },
      playerB: { select: { hiddenElo: true } },
    },
    orderBy: { playedAt: 'desc' },
    take: 20,
  })

  if (recentMatches.length === 0) {
    return {
      currentForm: 0,
      formLevel: 'NEUTRAL',
      trendDirection: 'STABLE',
      recentResults: [],
      recentWinRate: 0,
      currentStreak: 0,
      streakType: 'NONE',
    }
  }

  // Calculate recent results
  const recentResults = recentMatches.slice(0, 10).map(m => m.winnerId === userId ? 'W' : 'L')
  const recentWins = recentResults.filter(r => r === 'W').length
  const recentWinRate = (recentWins / recentResults.length) * 100

  // Calculate current streak
  let currentStreak = 0
  let streakType = 'NONE'
  for (const result of recentResults) {
    if (currentStreak === 0) {
      currentStreak = 1
      streakType = result === 'W' ? 'WIN' : 'LOSS'
    } else if ((streakType === 'WIN' && result === 'W') || (streakType === 'LOSS' && result === 'L')) {
      currentStreak++
    } else {
      break
    }
  }

  // Calculate form score (-10 to +10)
  let formScore = 0
  const weights = [3, 2.5, 2, 1.5, 1, 0.8, 0.6, 0.4, 0.3, 0.2]
  
  for (let i = 0; i < Math.min(recentMatches.length, 10); i++) {
    const match = recentMatches[i]
    const won = match.winnerId === userId
    const isPlayerA = match.playerAId === userId
    const opponentElo = isPlayerA ? match.playerB?.hiddenElo : match.playerA?.hiddenElo
    const playerElo = isPlayerA ? match.playerA?.hiddenElo : match.playerB?.hiddenElo
    
    let matchValue = won ? 1 : -1
    
    // Bonus for beating higher-rated opponents
    if (won && opponentElo && playerElo && opponentElo > playerElo) {
      matchValue *= 1.5
    }
    // Penalty for losing to lower-rated opponents
    if (!won && opponentElo && playerElo && opponentElo < playerElo) {
      matchValue *= 1.5
    }
    
    formScore += matchValue * weights[i]
  }

  // Normalize to -10 to +10 scale
  const maxPossible = weights.reduce((sum, w) => sum + w * 1.5, 0)
  formScore = Math.round((formScore / maxPossible) * 10 * 10) / 10

  // Determine form level
  let formLevel = 'NEUTRAL'
  if (formScore >= 6) formLevel = 'HOT'
  else if (formScore >= 3) formLevel = 'WARM'
  else if (formScore <= -6) formLevel = 'ICY'
  else if (formScore <= -3) formLevel = 'COLD'

  // Determine trend
  const last5 = recentResults.slice(0, 5)
  const prev5 = recentResults.slice(5, 10)
  const last5WinRate = last5.filter(r => r === 'W').length / last5.length
  const prev5WinRate = prev5.length > 0 ? prev5.filter(r => r === 'W').length / prev5.length : last5WinRate
  
  let trendDirection = 'STABLE'
  if (last5WinRate > prev5WinRate + 0.15) trendDirection = 'RISING'
  else if (last5WinRate < prev5WinRate - 0.15) trendDirection = 'FALLING'

  // Calculate period-based form
  const now = new Date()
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const periodMatches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
      playedAt: { gte: last90Days },
    },
    orderBy: { playedAt: 'desc' },
  })

  const calcPeriodWinRate = (startDate: Date) => {
    const matches = periodMatches.filter(m => m.playedAt && new Date(m.playedAt) >= startDate)
    const wins = matches.filter(m => m.winnerId === userId).length
    return matches.length > 0 ? Math.round((wins / matches.length) * 1000) / 10 : 0
  }

  // Update or create form indicator in database
  await db.playerFormIndicator.upsert({
    where: { userId_sport: { userId, sport: sport as any } },
    create: { 
      userId, 
      sport: sport as any, 
      currentForm: formScore,
      formLevel,
      trendDirection,
      trendMagnitude: Math.abs(last5WinRate - prev5WinRate) * 100,
      recentResults: JSON.stringify(recentResults),
      recentWinRate,
      currentStreak,
      streakType,
      last7DaysForm: calcPeriodWinRate(last7Days),
      last30DaysForm: calcPeriodWinRate(last30Days),
      last90DaysForm: calcPeriodWinRate(last90Days),
      matchesConsidered: recentMatches.length,
    },
    update: {
      currentForm: formScore,
      formLevel,
      trendDirection,
      trendMagnitude: Math.abs(last5WinRate - prev5WinRate) * 100,
      recentResults: JSON.stringify(recentResults),
      recentWinRate,
      currentStreak,
      streakType,
      last7DaysForm: calcPeriodWinRate(last7Days),
      last30DaysForm: calcPeriodWinRate(last30Days),
      last90DaysForm: calcPeriodWinRate(last90Days),
      calculatedAt: new Date(),
      matchesConsidered: recentMatches.length,
    },
  })

  return {
    currentForm: formScore,
    formLevel,
    trendDirection,
    trendMagnitude: Math.abs(last5WinRate - prev5WinRate) * 100,
    recentResults,
    recentWinRate,
    currentStreak,
    streakType,
    last7DaysForm: calcPeriodWinRate(last7Days),
    last30DaysForm: calcPeriodWinRate(last30Days),
    last90DaysForm: calcPeriodWinRate(last90Days),
  }
}

// Get performance by tournament scope
async function getPerformanceByScope(userId: string, sport: string) {
  const matches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
    },
    include: {
      tournament: {
        select: { scope: true },
      },
    },
  })

  const byScope: Record<string, { wins: number; losses: number; tournaments: Set<string> }> = {}

  for (const match of matches) {
    const won = match.winnerId === userId
    const scope = match.tournament?.scope || 'CITY'

    if (!byScope[scope]) {
      byScope[scope] = { wins: 0, losses: 0, tournaments: new Set() }
    }
    if (won) byScope[scope].wins++
    else byScope[scope].losses++
    if (match.tournamentId) byScope[scope].tournaments.add(match.tournamentId)
  }

  return Object.entries(byScope).map(([scope, data]) => ({
    scope,
    wins: data.wins,
    losses: data.losses,
    matches: data.wins + data.losses,
    winRate: data.wins + data.losses > 0 
      ? Math.round((data.wins / (data.wins + data.losses)) * 1000) / 10 
      : 0,
    tournamentsPlayed: data.tournaments.size,
  }))
}

// Get recent performance summary
async function getRecentPerformance(userId: string, sport: string) {
  const now = new Date()
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const recentMatches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
      playedAt: { gte: last30Days },
    },
    include: {
      tournament: {
        select: { id: true, name: true, scope: true },
      },
    },
    orderBy: { playedAt: 'desc' },
  })

  const recentTournaments = await db.tournamentRegistration.findMany({
    where: {
      userId,
      tournament: { sport: sport as any },
      registeredAt: { gte: last30Days },
    },
    include: {
      tournament: {
        select: { id: true, name: true, status: true },
      },
    },
  })

  const wins = recentMatches.filter(m => m.winnerId === userId).length
  const losses = recentMatches.length - wins

  return {
    last30Days: {
      matches: recentMatches.length,
      wins,
      losses,
      winRate: recentMatches.length > 0 ? Math.round((wins / recentMatches.length) * 1000) / 10 : 0,
      tournaments: recentTournaments.length,
    },
    bestScope: await getBestPerformingScope(userId, sport),
    averageMargin: await getAverageMargin(userId),
  }
}

async function getBestPerformingScope(userId: string, sport: string) {
  const results = await db.tournamentResult.findMany({
    where: { userId },
    include: {
      tournament: {
        select: { scope: true },
      },
    },
  })

  const scopeRanks: Record<string, number[]> = {}
  for (const result of results) {
    const scope = result.tournament?.scope || 'CITY'
    if (!scopeRanks[scope]) scopeRanks[scope] = []
    scopeRanks[scope].push(result.rank)
  }

  let bestScope = 'CITY'
  let bestAvgRank = Infinity

  for (const [scope, ranks] of Object.entries(scopeRanks)) {
    const avg = ranks.reduce((sum, r) => sum + r, 0) / ranks.length
    if (avg < bestAvgRank) {
      bestAvgRank = avg
      bestScope = scope
    }
  }

  return {
    scope: bestScope,
    averageRank: Math.round(bestAvgRank * 10) / 10,
    tournaments: scopeRanks[bestScope]?.length || 0,
  }
}

async function getAverageMargin(userId: string) {
  const matches = await db.match.findMany({
    where: {
      OR: [{ playerAId: userId }, { playerBId: userId }],
      verificationStatus: 'VERIFIED',
      scoreA: { not: null },
      scoreB: { not: null },
    },
    take: 50,
  })

  let totalMargin = 0
  let count = 0

  for (const match of matches) {
    if (match.scoreA === null || match.scoreB === null) continue
    
    const isPlayerA = match.playerAId === userId
    const playerScore = isPlayerA ? match.scoreA : match.scoreB
    const opponentScore = isPlayerA ? match.scoreB : match.scoreA
    const won = match.winnerId === userId

    if (won) {
      totalMargin += playerScore - opponentScore
      count++
    }
  }

  return count > 0 ? Math.round((totalMargin / count) * 10) / 10 : 0
}
