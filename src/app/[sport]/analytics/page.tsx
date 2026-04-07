'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Flame,
  Trophy,
  Calendar,
  Activity,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Users,
  DollarSign,
  LineChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Sidebar from '@/components/layout/sidebar';

interface TrendData {
  period: string;
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
  movingAverage: number;
  points: number;
}

interface FormIndicator {
  currentForm: number;
  formLevel: string;
  trendDirection: string;
  trendMagnitude: number;
  recentResults: string[];
  recentWinRate: number;
  currentStreak: number;
  streakType: string;
  last7DaysForm: number;
  last30DaysForm: number;
  last90DaysForm: number;
}

interface PerformanceByType {
  byType: Array<{
    type: string;
    wins: number;
    losses: number;
    matches: number;
    winRate: number;
    tournamentsPlayed: number;
  }>;
  byFormat: Array<{
    format: string;
    wins: number;
    losses: number;
    matches: number;
    winRate: number;
  }>;
}

interface PerformanceByScope {
  scope: string;
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
  tournamentsPlayed: number;
  avgOpponentElo?: number;
  pointsEarned?: number;
  bonusPoints?: number;
}

interface AnalyticsData {
  trends: {
    periodType: string;
    data: TrendData[];
    summary: {
      totalPeriods: number;
      totalWins: number;
      totalLosses: number;
      overallWinRate: number;
    };
  };
  form: FormIndicator;
  byType: PerformanceByType;
  byScope: PerformanceByScope[];
  recent: {
    last30Days: {
      matches: number;
      wins: number;
      losses: number;
      winRate: number;
      tournaments: number;
    };
    bestScope: {
      scope: string;
      averageRank: number;
      tournaments: number;
    };
    averageMargin: number;
  };
}

interface OrgDevelopmentData {
  totalMembers: number;
  activeMembers: number;
  avgEloGrowth: number;
  totalPointsGrowth: number;
  developmentScore: number;
  playersImproved: number;
  playersDeclined: number;
  monthlyData: Array<{
    month: string;
    elo: number;
    eloChange: number;
    matchesPlayed: number;
    winRate: number;
    pointsEarned: number;
  }>;
  topDevelopers: Array<{
    id: string;
    name: string;
    eloGrowth: number;
    pointsGrowth: number;
  }>;
}

interface OrgROIData {
  totalTournaments: number;
  totalInvestment: number;
  totalPrizeMoney: number;
  totalPointsEarned: number;
  avgROI: number;
  profitableTournaments: number;
  lossTournaments: number;
  roiDistribution: Array<{ range: string; count: number }>;
  tournaments: Array<{
    tournamentId: string;
    tournamentName: string;
    scope: string;
    entryFee: number;
    prizeWon: number;
    placement: number;
    roi: number;
  }>;
}

const formColors: Record<string, string> = {
  HOT: 'bg-red-500',
  WARM: 'bg-orange-400',
  NEUTRAL: 'bg-slate-400',
  COLD: 'bg-blue-400',
  ICY: 'bg-blue-600',
};

const formTextColors: Record<string, string> = {
  HOT: 'text-red-600 dark:text-red-400',
  WARM: 'text-orange-500 dark:text-orange-400',
  NEUTRAL: 'text-muted-foreground',
  COLD: 'text-blue-500 dark:text-blue-400',
  ICY: 'text-blue-700 dark:text-blue-400',
};

const scopeColors: Record<string, string> = {
  CITY: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
  DISTRICT: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300',
  STATE: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  NATIONAL: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300',
};

export default function AdvancedAnalyticsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === 'cornhole';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState('monthly');
  const [viewType, setViewType] = useState<'player' | 'org'>('player');
  const [orgDevelopment, setOrgDevelopment] = useState<OrgDevelopmentData | null>(null);
  const [orgROI, setOrgROI] = useState<OrgROIData | null>(null);
  const [isOrg, setIsOrg] = useState(false);

  useEffect(() => {
    // Check if user is org or player
    const checkUserType = async () => {
      const orgRes = await fetch('/api/auth/check-org', { credentials: 'include' });
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        if (orgData.authenticated) {
          setIsOrg(true);
          setViewType('org');
        }
      }
    };
    checkUserType();
  }, []);

  useEffect(() => {
    if (viewType === 'player') {
      fetchPlayerAnalytics();
    } else {
      fetchOrgAnalytics();
    }
  }, [sport, period, viewType]);

  const fetchPlayerAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/player/analytics?period=${period}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgAnalytics = async () => {
    setLoading(true);
    try {
      const [devRes, roiRes] = await Promise.all([
        fetch('/api/org/analytics/development', { credentials: 'include' }),
        fetch('/api/org/analytics/roi', { credentials: 'include' }),
      ]);
      
      if (devRes.ok) {
        const devData = await devRes.json();
        setOrgDevelopment(devData.data);
      }
      if (roiRes.ok) {
        const roiData = await roiRes.json();
        setOrgROI(roiData.data);
      }
    } catch (error) {
      console.error('Failed to fetch org analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const primaryTextClass = isCornhole ? 'text-green-600' : 'text-teal-600';
  const primaryBgClass = isCornhole ? 'bg-green-100' : 'bg-teal-100';

  if (loading) {
    return (
      <div className="bg-muted min-h-screen">
        <Sidebar userType={isOrg ? 'org' : 'player'} />
        <main className="ml-0 md:ml-72">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-muted min-h-screen">
      <Sidebar userType={isOrg ? 'org' : 'player'} />
      <main className="ml-0 md:ml-72">
        <div className="p-6 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Advanced Analytics</h1>
              <p className="text-muted-foreground">Deep insights into your performance</p>
            </div>
            <div className="flex items-center gap-3">
              {isOrg && (
                <Select value={viewType} onValueChange={(v) => setViewType(v as 'player' | 'org')}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">Player View</SelectItem>
                    <SelectItem value="org">Org View</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {viewType === 'player' && (
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {viewType === 'player' ? (
            <PlayerAnalyticsView 
              data={data} 
              period={period} 
              primaryTextClass={primaryTextClass}
              primaryBgClass={primaryBgClass}
            />
          ) : (
            <OrgAnalyticsView 
              development={orgDevelopment}
              roi={orgROI}
              primaryTextClass={primaryTextClass}
              primaryBgClass={primaryBgClass}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// Player Analytics View Component
function PlayerAnalyticsView({ 
  data, 
  period,
  primaryTextClass,
  primaryBgClass
}: { 
  data: AnalyticsData | null; 
  period: string;
  primaryTextClass: string;
  primaryBgClass: string;
}) {
  if (!data) {
    return (
      <div className="text-center py-12">
        <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No analytics data available</p>
      </div>
    );
  }

  return (
    <>
      {/* Form Indicator */}
      <Card className="mb-6 overflow-hidden">
        <div className={cn('h-2', formColors[data.form.formLevel])} />
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Current Form */}
            <div className="text-center">
              <div className={cn(
                'w-20 h-20 mx-auto rounded-full flex items-center justify-center text-white text-2xl font-bold mb-2',
                formColors[data.form.formLevel]
              )}>
                {data.form.currentForm > 0 ? `+${data.form.currentForm}` : data.form.currentForm}
              </div>
              <p className={cn('font-semibold capitalize', formTextColors[data.form.formLevel])}>
                {data.form.formLevel}
              </p>
              <p className="text-sm text-muted-foreground">Current Form</p>
            </div>

            {/* Trend */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {data.form.trendDirection === 'RISING' ? (
                  <ArrowUpRight className="w-8 h-8 text-green-500" />
                ) : data.form.trendDirection === 'FALLING' ? (
                  <ArrowDownRight className="w-8 h-8 text-red-500" />
                ) : (
                  <Minus className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <p className="font-semibold capitalize">{data.form.trendDirection.toLowerCase()}</p>
              <p className="text-sm text-muted-foreground">Trend</p>
            </div>

            {/* Streak */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Flame className={cn(
                  'w-8 h-8',
                  data.form.streakType === 'WIN' ? 'text-orange-500' : 'text-blue-500'
                )} />
                <span className="text-2xl font-bold">{data.form.currentStreak}</span>
              </div>
              <p className="font-semibold">{data.form.streakType === 'WIN' ? 'Win' : 'Loss'} Streak</p>
              <p className="text-sm text-muted-foreground">Current</p>
            </div>

            {/* Recent Results */}
            <div>
              <p className="text-sm text-muted-foreground mb-2 text-center">Last 10 Matches</p>
              <div className="flex justify-center gap-1 flex-wrap">
                {data.form.recentResults.map((result, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
                      result === 'W' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    )}
                  >
                    {result}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Period Form */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold">{data.form.last7DaysForm}%</p>
              <p className="text-sm text-muted-foreground">Last 7 Days</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{data.form.last30DaysForm}%</p>
              <p className="text-sm text-muted-foreground">Last 30 Days</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{data.form.last90DaysForm}%</p>
              <p className="text-sm text-muted-foreground">Last 90 Days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different analytics views */}
      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="trends">Win Rate Trends</TabsTrigger>
          <TabsTrigger value="breakdown">Performance Breakdown</TabsTrigger>
          <TabsTrigger value="scope">By Scope</TabsTrigger>
        </TabsList>

        {/* Win Rate Trends Tab */}
        <TabsContent value="trends">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Win Rate Over Time
                </CardTitle>
                <CardDescription>
                  {period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly'} win rate progression
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.trends.data.length > 0 ? (
                  <div className="h-64">
                    <div className="h-full flex items-end justify-between gap-1">
                      {data.trends.data.slice(-12).map((trend, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center min-w-0">
                          <div className="w-full flex flex-col gap-1">
                            <div
                              className="w-full bg-green-400 rounded-t transition-all hover:bg-green-500"
                              style={{ height: `${Math.max(4, trend.winRate * 2)}px` }}
                              title={`Win Rate: ${trend.winRate}%`}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground mt-2 truncate w-full text-center">
                            {trend.period.split('-').slice(1).join('/')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{data.trends.summary.totalWins}</p>
                      <p className="text-sm text-muted-foreground">Total Wins</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                      <Target className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{data.trends.summary.totalLosses}</p>
                      <p className="text-sm text-muted-foreground">Total Losses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', primaryBgClass)}>
                      <BarChart3 className={cn('w-5 h-5', primaryTextClass)} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{data.trends.summary.overallWinRate}%</p>
                      <p className="text-sm text-muted-foreground">Overall Win Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{data.trends.summary.totalPeriods}</p>
                      <p className="text-sm text-muted-foreground">Periods Tracked</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Performance Breakdown Tab */}
        <TabsContent value="breakdown">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>By Tournament Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.byType.byType.map((type) => (
                    <div key={type.type} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium capitalize">{type.type.replace('_', ' ').toLowerCase()}</p>
                        <p className="text-sm text-muted-foreground">{type.tournamentsPlayed} tournaments</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{type.winRate}%</p>
                        <p className="text-sm text-muted-foreground">{type.wins}W - {type.losses}L</p>
                      </div>
                    </div>
                  ))}
                  {data.byType.byType.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Tournament Format</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.byType.byFormat.map((format) => (
                    <div key={format.format} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium capitalize">{format.format.toLowerCase()}</p>
                        <p className="text-sm text-muted-foreground">{format.matches} matches</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{format.winRate}%</p>
                        <p className="text-sm text-muted-foreground">{format.wins}W - {format.losses}L</p>
                      </div>
                    </div>
                  ))}
                  {data.byType.byFormat.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* By Scope Tab */}
        <TabsContent value="scope">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Tournament Scope</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.byScope.map((scope) => (
                  <Card key={scope.scope}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={scopeColors[scope.scope] || 'bg-muted text-muted-foreground'}>
                          {scope.scope}
                        </Badge>
                        <span className="text-lg font-bold">{scope.winRate}%</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Wins</span>
                          <span className="font-medium text-green-600 dark:text-green-400">{scope.wins}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Losses</span>
                          <span className="font-medium text-red-600 dark:text-red-400">{scope.losses}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tournaments</span>
                          <span className="font-medium">{scope.tournamentsPlayed}</span>
                        </div>
                        {scope.avgOpponentElo !== undefined && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Avg Opp ELO</span>
                            <span className="font-medium">{scope.avgOpponentElo}</span>
                          </div>
                        )}
                        {scope.pointsEarned !== undefined && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Points Earned</span>
                            <span className="font-medium text-green-600 dark:text-green-400">{scope.pointsEarned}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {data.recent.bestScope && (
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center justify-center gap-3">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <p className="text-muted-foreground">
                      Best performing scope: <strong className="text-foreground">{data.recent.bestScope.scope}</strong>
                      (Avg rank: {data.recent.bestScope.averageRank})
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.recent.last30Days.matches}</p>
                <p className="text-sm text-muted-foreground">Matches (Last 30 Days)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Target className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.recent.last30Days.winRate}%</p>
                <p className="text-sm text-muted-foreground">Win Rate (Last 30 Days)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Activity className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.recent.averageMargin}</p>
                <p className="text-sm text-muted-foreground">Avg Win Margin</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Organization Analytics View Component
function OrgAnalyticsView({ 
  development,
  roi,
  primaryTextClass,
  primaryBgClass
}: { 
  development: OrgDevelopmentData | null;
  roi: OrgROIData | null;
  primaryTextClass: string;
  primaryBgClass: string;
}) {
  if (!development && !roi) {
    return (
      <div className="text-center py-12">
        <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">No organization analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Development Overview */}
      {development && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Player Development
            </CardTitle>
            <CardDescription>Track player improvement over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{development.playersImproved}</p>
                <p className="text-sm text-gray-600">Players Improved</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-600">{development.playersDeclined}</p>
                <p className="text-sm text-gray-600">Players Declined</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{development.avgEloGrowth}</p>
                <p className="text-sm text-gray-600">Avg ELO Growth</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">{development.developmentScore}%</p>
                <p className="text-sm text-gray-600">Development Score</p>
              </div>
            </div>

            {/* Monthly Progress Chart */}
            {development.monthlyData && development.monthlyData.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-4">Monthly Progress</h4>
                <div className="h-32 flex items-end justify-between gap-2">
                  {development.monthlyData.map((month, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className={cn(
                          'w-full rounded-t transition-all',
                          month.eloChange >= 0 ? 'bg-green-400' : 'bg-red-400'
                        )}
                        style={{ height: `${Math.max(8, Math.abs(month.eloChange) * 2)}px` }}
                        title={`${month.month}: ${month.eloChange > 0 ? '+' : ''}${month.eloChange} ELO`}
                      />
                      <span className="text-xs text-gray-500 mt-1">{month.month.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Developers */}
            {development.topDevelopers && development.topDevelopers.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Top Improving Players</h4>
                <div className="space-y-2">
                  {development.topDevelopers.map((player, i) => (
                    <div key={player.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500">#{i + 1}</span>
                        <span className="font-medium">{player.name}</span>
                      </div>
                      <Badge variant={player.eloGrowth >= 0 ? 'default' : 'destructive'}>
                        {player.eloGrowth >= 0 ? '+' : ''}{player.eloGrowth} ELO
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tournament ROI */}
      {roi && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Tournament ROI
            </CardTitle>
            <CardDescription>Return on Investment for tournaments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold">{roi.totalTournaments}</p>
                <p className="text-sm text-gray-600">Total Tournaments</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">₹{roi.totalInvestment.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total Investment</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">₹{roi.totalPrizeMoney.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Prize Money Won</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">{roi.avgROI}%</p>
                <p className="text-sm text-gray-600">Avg ROI</p>
              </div>
            </div>

            {/* ROI Distribution */}
            {roi.roiDistribution && roi.roiDistribution.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-3">ROI Distribution</h4>
                <div className="flex gap-2">
                  {roi.roiDistribution.map((range, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs bg-muted px-3 py-1 rounded">
                      <span className="font-medium">{range.range}</span>
                      <span className="text-muted-foreground">({range.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tournament List */}
            {roi.tournaments && roi.tournaments.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Tournament Breakdown</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {roi.tournaments.slice(0, 10).map((tournament) => (
                    <div key={tournament.tournamentId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{tournament.tournamentName}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Badge variant="outline" className="text-xs">{tournament.scope}</Badge>
                          <span>Fee: ₹{tournament.entryFee}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={tournament.roi >= 0 ? 'default' : 'destructive'}>
                          {tournament.roi >= 0 ? '+' : ''}{tournament.roi}% ROI
                        </Badge>
                        {tournament.placement > 0 && (
                          <p className="text-sm text-gray-500 mt-1">#{tournament.placement}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
