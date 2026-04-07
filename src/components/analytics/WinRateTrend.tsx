'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendData {
  period: string;
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
  points: number;
  movingAverage: number;
}

interface TrendResponse {
  success: boolean;
  data: {
    periodType: string;
    data: TrendData[];
    summary: {
      totalPeriods: number;
      totalWins: number;
      totalLosses: number;
      overallWinRate: number;
    };
  };
}

interface WinRateTrendProps {
  months?: number;
}

export function WinRateTrend({ months = 12 }: WinRateTrendProps) {
  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/player/analytics/trend?months=${months}`);
        if (!res.ok) throw new Error('Failed to fetch trend data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [months]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Win Rate Trend</CardTitle>
          <CardDescription>Loading trend data...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Win Rate Trend</CardTitle>
          <CardDescription className="text-destructive">{error || 'No data available'}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { data: trendData, summary } = data.data;
  const maxWinRate = 100;

  // Calculate trend direction
  const lastTwoPeriods = trendData.slice(-2);
  const trendDirection = lastTwoPeriods.length === 2
    ? lastTwoPeriods[1].winRate > lastTwoPeriods[0].winRate
      ? 'up'
      : lastTwoPeriods[1].winRate < lastTwoPeriods[0].winRate
        ? 'down'
        : 'stable'
    : 'stable';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Win Rate Trend</CardTitle>
            <CardDescription>Last {months} months performance</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {trendDirection === 'up' && <TrendingUp className="h-5 w-5 text-green-500" />}
            {trendDirection === 'down' && <TrendingDown className="h-5 w-5 text-red-500" />}
            {trendDirection === 'stable' && <Minus className="h-5 w-5 text-gray-500" />}
            <span className={`text-sm font-medium ${
              trendDirection === 'up' ? 'text-green-500' : 
              trendDirection === 'down' ? 'text-red-500' : 'text-gray-500'
            }`}>
              {summary.overallWinRate}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {trendData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No matches played in the selected period
          </div>
        ) : (
          <>
            {/* Simple Line Chart using CSS */}
            <div className="relative h-48 w-full">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs text-muted-foreground">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
              </div>
              
              {/* Chart area */}
              <div className="ml-10 h-40 relative">
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-dashed border-gray-200"
                    style={{ top: `${i * 25}%` }}
                  />
                ))}
                
                {/* Data points and lines */}
                <div className="absolute inset-0 flex items-end justify-between gap-1">
                  {trendData.map((point, index) => {
                    const height = (point.winRate / maxWinRate) * 100;
                    const movingAvgHeight = (point.movingAverage / maxWinRate) * 100;
                    
                    return (
                      <div
                        key={point.period}
                        className="relative flex-1 flex flex-col items-center group"
                      >
                        {/* Moving average line */}
                        <div
                          className="absolute left-0 right-0 border-t-2 border-blue-300 opacity-50"
                          style={{ bottom: `${movingAvgHeight}%` }}
                        />
                        
                        {/* Win rate bar */}
                        <div
                          className="w-full bg-gradient-to-t from-primary/80 to-primary rounded-t transition-all group-hover:opacity-80"
                          style={{ height: `${height}%` }}
                        />
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                            <div className="font-medium">{point.period}</div>
                            <div>Win Rate: {point.winRate}%</div>
                            <div>W: {point.wins} / L: {point.losses}</div>
                            <div>Avg: {point.movingAverage}%</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* X-axis labels */}
              <div className="ml-10 h-8 flex items-center justify-between text-xs text-muted-foreground overflow-hidden">
                {trendData.map((point, index) => (
                  <span
                    key={point.period}
                    className="flex-1 text-center truncate"
                  >
                    {index % Math.ceil(trendData.length / 6) === 0 ? point.period.split('-')[1] : ''}
                  </span>
                ))}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{summary.totalWins}</div>
                <div className="text-xs text-muted-foreground">Total Wins</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">{summary.totalLosses}</div>
                <div className="text-xs text-muted-foreground">Total Losses</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.totalWins + summary.totalLosses}</div>
                <div className="text-xs text-muted-foreground">Total Matches</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.totalPeriods}</div>
                <div className="text-xs text-muted-foreground">Active Months</div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
