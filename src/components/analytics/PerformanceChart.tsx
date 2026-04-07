'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, TrendingUp, MapPin } from 'lucide-react';

interface PerformanceData {
  scope: string;
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
  tournamentsPlayed: number;
  avgOpponentElo: number;
  pointsEarned: number;
  bonusPoints: number;
}

interface StrengthOfSchedule {
  averageOpponentElo: number;
  highestOpponentElo: number;
  lowestOpponentElo: number;
  top10PercentMatches: number;
  top25PercentMatches: number;
  bottom25PercentMatches: number;
  strengthRating: string;
  opponentTierDistribution: { tier: string; count: number }[];
}

interface PerformanceResponse {
  success: boolean;
  data: {
    byScope: PerformanceData[];
    strengthOfSchedule: StrengthOfSchedule | null;
  };
}

interface PerformanceChartProps {
  includeSOS?: boolean;
}

const scopeColors: Record<string, string> = {
  'NATIONAL': 'bg-purple-500',
  'STATE': 'bg-blue-500',
  'DISTRICT': 'bg-green-500',
  'CITY': 'bg-yellow-500',
};

const scopeLabels: Record<string, string> = {
  'NATIONAL': 'National',
  'STATE': 'State',
  'DISTRICT': 'District',
  'CITY': 'City',
};

export function PerformanceChart({ includeSOS = false }: PerformanceChartProps) {
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/player/analytics/performance?sos=${includeSOS}`);
        if (!res.ok) throw new Error('Failed to fetch performance data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [includeSOS]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance by Scope</CardTitle>
          <CardDescription>Loading performance data...</CardDescription>
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
          <CardTitle className="text-lg">Performance by Scope</CardTitle>
          <CardDescription className="text-destructive">{error || 'No data available'}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { byScope, strengthOfSchedule } = data.data;

  // Sort by scope hierarchy
  const sortedData = [...byScope].sort((a, b) => {
    const order = ['NATIONAL', 'STATE', 'DISTRICT', 'CITY'];
    return order.indexOf(a.scope) - order.indexOf(b.scope);
  });

  const maxMatches = Math.max(...sortedData.map(d => d.matches), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Performance by Scope</CardTitle>
            <CardDescription>Tournament performance breakdown</CardDescription>
          </div>
          <Trophy className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {sortedData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No tournament matches played yet
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bar Chart */}
            <div className="space-y-4">
              {sortedData.map((scope) => (
                <div key={scope.scope} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={scopeColors[scope.scope]}>
                        {scopeLabels[scope.scope] || scope.scope}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {scope.tournamentsPlayed} tournaments
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{scope.winRate}%</span>
                      <span className="text-xs text-muted-foreground">
                        ({scope.wins}W - {scope.losses}L)
                      </span>
                    </div>
                  </div>
                  
                  {/* Win/Loss Bar */}
                  <div className="relative h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {/* Total matches bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-gray-200 dark:bg-gray-700"
                      style={{ width: `${(scope.matches / maxMatches) * 100}%` }}
                    />
                    {/* Wins portion */}
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-green-500 to-green-400"
                      style={{ width: `${(scope.wins / maxMatches) * 100}%` }}
                    />
                    {/* Losses portion */}
                    <div
                      className="absolute top-0 bottom-0 bg-gradient-to-r from-red-400 to-red-500"
                      style={{ 
                        left: `${(scope.wins / maxMatches) * 100}%`,
                        width: `${(scope.losses / maxMatches) * 100}%` 
                      }}
                    />
                  </div>
                  
                  {/* Points info */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      <span>{scope.pointsEarned} pts</span>
                    </div>
                    {scope.bonusPoints > 0 && (
                      <div className="flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-yellow-500" />
                        <span>+{scope.bonusPoints} bonus</span>
                      </div>
                    )}
                    {scope.avgOpponentElo > 0 && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        <span>Avg Opp: {scope.avgOpponentElo} ELO</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Strength of Schedule */}
            {strengthOfSchedule && (
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Strength of Schedule
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-2 bg-muted rounded-lg">
                    <div className="text-lg font-bold">{strengthOfSchedule.averageOpponentElo}</div>
                    <div className="text-xs text-muted-foreground">Avg Opp ELO</div>
                  </div>
                  <div className="text-center p-2 bg-muted rounded-lg">
                    <div className="text-lg font-bold">{strengthOfSchedule.highestOpponentElo}</div>
                    <div className="text-xs text-muted-foreground">Highest Opp</div>
                  </div>
                  <div className="text-center p-2 bg-muted rounded-lg">
                    <Badge variant={
                      strengthOfSchedule.strengthRating === 'VERY_STRONG' || strengthOfSchedule.strengthRating === 'STRONG'
                        ? 'default'
                        : strengthOfSchedule.strengthRating === 'VERY_WEAK' || strengthOfSchedule.strengthRating === 'WEAK'
                          ? 'destructive'
                          : 'secondary'
                    }>
                      {strengthOfSchedule.strengthRating.replace('_', ' ')}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">Schedule Rating</div>
                  </div>
                </div>
                
                {/* Tier distribution */}
                {strengthOfSchedule.opponentTierDistribution.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs text-muted-foreground mb-2">Opponent Tier Distribution</div>
                    <div className="flex gap-2">
                      {strengthOfSchedule.opponentTierDistribution.map((tier) => (
                        <div
                          key={tier.tier}
                          className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded"
                        >
                          <span className="font-medium">{tier.tier}</span>
                          <span className="text-muted-foreground">({tier.count})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
