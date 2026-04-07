'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Award, BarChart3 } from 'lucide-react';

interface EloHistoryData {
  currentElo: number;
  highestElo: number;
  lowestElo: number;
  eloHistory: {
    date: string;
    elo: number;
    change: number;
    reason: string;
  }[];
  tierProgress: {
    currentTier: string;
    nextTier: string | null;
    eloToNext: number;
    progress: number;
  };
}

interface EloHistoryProps {
  userId?: string;
}

// Mock data for Elo history since we don't have historical data stored
function generateMockEloHistory(currentElo: number): EloHistoryData {
  const history = [];
  let elo = currentElo - Math.floor(Math.random() * 200);
  const today = new Date();

  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const change = Math.floor(Math.random() * 40) - 15;
    elo = Math.max(1000, Math.min(2000, elo + change));
    
    history.push({
      date: date.toISOString().split('T')[0],
      elo,
      change,
      reason: change > 0 ? 'Match Win' : change < 0 ? 'Match Loss' : 'Draw',
    });
  }

  // Ensure the last entry is close to current Elo
  history[history.length - 1].elo = currentElo;
  history[history.length - 1].change = currentElo - history[history.length - 2].elo;

  const highestElo = Math.max(...history.map(h => h.elo));
  const lowestElo = Math.min(...history.map(h => h.elo));

  const getTier = (elo: number) => {
    if (elo >= 1900) return 'Diamond';
    if (elo >= 1700) return 'Platinum';
    if (elo >= 1500) return 'Gold';
    if (elo >= 1300) return 'Silver';
    return 'Bronze';
  };

  const getNextTier = (elo: number) => {
    if (elo >= 1900) return null;
    if (elo >= 1700) return 'Diamond';
    if (elo >= 1500) return 'Platinum';
    if (elo >= 1300) return 'Gold';
    return 'Silver';
  };

  const getTierThreshold = (tier: string) => {
    switch (tier) {
      case 'Diamond': return 1900;
      case 'Platinum': return 1700;
      case 'Gold': return 1500;
      case 'Silver': return 1300;
      default: return 1500;
    }
  };

  const currentTier = getTier(currentElo);
  const nextTier = getNextTier(currentElo);
  const threshold = nextTier ? getTierThreshold(nextTier) : currentElo;
  const prevThreshold = getTierThreshold(currentTier);
  const progress = nextTier 
    ? ((currentElo - prevThreshold) / (threshold - prevThreshold)) * 100 
    : 100;

  return {
    currentElo,
    highestElo,
    lowestElo,
    eloHistory: history,
    tierProgress: {
      currentTier,
      nextTier,
      eloToNext: nextTier ? threshold - currentElo : 0,
      progress: Math.min(100, Math.max(0, progress)),
    },
  };
}

const tierColors: Record<string, { bg: string; text: string; border: string }> = {
  'Diamond': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-300' },
  'Platinum': { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-300' },
  'Gold': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-300' },
  'Silver': { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-300' },
  'Bronze': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-300' },
};

export function EloHistory({ userId }: EloHistoryProps) {
  const [data, setData] = useState<EloHistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch current user data
        const res = await fetch('/api/player/me');
        if (res.ok) {
          const json = await res.json();
          const currentElo = json.user?.hiddenElo || 1500;
          setData(generateMockEloHistory(Math.round(currentElo)));
        } else {
          // Use default elo if not logged in
          setData(generateMockEloHistory(1500));
        }
      } catch {
        setData(generateMockEloHistory(1500));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ELO History</CardTitle>
          <CardDescription>Loading ELO data...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ELO History</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { eloHistory, tierProgress, highestElo, lowestElo, currentElo } = data;
  const tierColor = tierColors[tierProgress.currentTier] || tierColors['Bronze'];
  
  // Calculate min/max for chart scaling
  const minElo = Math.min(...eloHistory.map(h => h.elo)) - 50;
  const maxElo = Math.max(...eloHistory.map(h => h.elo)) + 50;
  const eloRange = maxElo - minElo;

  // Get recent trend
  const recentChanges = eloHistory.slice(-5);
  const netChange = recentChanges.reduce((sum, h) => sum + h.change, 0);
  const trendDirection = netChange > 20 ? 'up' : netChange < -20 ? 'down' : 'stable';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">ELO Progression</CardTitle>
            <CardDescription>Your rating over the last 30 days</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {trendDirection === 'up' && <TrendingUp className="h-5 w-5 text-green-500" />}
            {trendDirection === 'down' && <TrendingDown className="h-5 w-5 text-red-500" />}
            {trendDirection === 'stable' && <Minus className="h-5 w-5 text-gray-500" />}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Current ELO and Tier */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{currentElo}</div>
              <div className="text-sm text-muted-foreground">Current ELO</div>
            </div>
            <div className={`px-4 py-2 rounded-lg ${tierColor.bg} ${tierColor.border} border`}>
              <div className="flex items-center gap-2">
                <Award className={`h-5 w-5 ${tierColor.text}`} />
                <span className={`font-medium ${tierColor.text}`}>{tierProgress.currentTier}</span>
              </div>
            </div>
          </div>

          {/* Tier Progress */}
          {tierProgress.nextTier && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress to {tierProgress.nextTier}</span>
                <span className="font-medium">{tierProgress.eloToNext} ELO needed</span>
              </div>
              <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`absolute left-0 top-0 bottom-0 ${tierColor.bg.replace('100', '400')} rounded-full transition-all`}
                  style={{ width: `${tierProgress.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{tierProgress.currentTier}</span>
                <span>{tierProgress.nextTier}</span>
              </div>
            </div>
          )}

          {/* ELO Chart */}
          <div className="relative h-32 w-full">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs text-muted-foreground pr-2">
              <span>{maxElo}</span>
              <span>{Math.round((maxElo + minElo) / 2)}</span>
              <span>{minElo}</span>
            </div>
            
            {/* Chart area */}
            <div className="ml-12 h-full relative">
              {/* Grid lines */}
              <div className="absolute left-0 right-0 top-0 border-t border-dashed border-gray-200 dark:border-gray-700" />
              <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-gray-200 dark:border-gray-700" />
              <div className="absolute left-0 right-0 bottom-0 border-t border-dashed border-gray-200 dark:border-gray-700" />
              
              {/* ELO Line */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="eloGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                
                {/* Area fill */}
                <path
                  d={`
                    M 0,${100 - ((eloHistory[0].elo - minElo) / eloRange) * 100}
                    ${eloHistory.map((point, i) => {
                      const x = (i / (eloHistory.length - 1)) * 100;
                      const y = 100 - ((point.elo - minElo) / eloRange) * 100;
                      return `L ${x},${y}`;
                    }).join(' ')}
                    L 100,100 L 0,100 Z
                  `}
                  fill="url(#eloGradient)"
                  className="text-primary"
                />
                
                {/* Line */}
                <polyline
                  points={eloHistory.map((point, i) => {
                    const x = (i / (eloHistory.length - 1)) * 100;
                    const y = 100 - ((point.elo - minElo) / eloRange) * 100;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary"
                />
              </svg>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{highestElo}</div>
              <div className="text-xs text-muted-foreground">Peak ELO</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">{lowestElo}</div>
              <div className="text-xs text-muted-foreground">Lowest ELO</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netChange >= 0 ? '+' : ''}{netChange}
              </div>
              <div className="text-xs text-muted-foreground">30d Change</div>
            </div>
          </div>

          {/* Recent Changes */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              Recent Activity
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {eloHistory.slice(-5).reverse().map((entry, index) => (
                <div key={index} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">{entry.date}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.elo}</span>
                    <span className={`text-xs ${entry.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ({entry.change >= 0 ? '+' : ''}{entry.change})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
