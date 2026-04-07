'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Award, BarChart3 } from 'lucide-react';

interface EloSnapshot {
  currentElo: number;
  currentTier: string;
  nextTier: string | null;
  eloToNext: number;
  progress: number;
}

interface EloHistoryProps {
  userId?: string;
}

const tierColors: Record<string, { bg: string; text: string; border: string }> = {
  Diamond: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-300' },
  Platinum: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-300' },
  Gold: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-300' },
  Silver: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-300' },
  Bronze: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-300' },
};

function getTier(elo: number) {
  if (elo >= 1900) return 'Diamond';
  if (elo >= 1700) return 'Platinum';
  if (elo >= 1500) return 'Gold';
  if (elo >= 1300) return 'Silver';
  return 'Bronze';
}

function getNextTier(elo: number) {
  if (elo >= 1900) return null;
  if (elo >= 1700) return 'Diamond';
  if (elo >= 1500) return 'Platinum';
  if (elo >= 1300) return 'Gold';
  return 'Silver';
}

function getTierThreshold(tier: string) {
  switch (tier) {
    case 'Diamond':
      return 1900;
    case 'Platinum':
      return 1700;
    case 'Gold':
      return 1500;
    case 'Silver':
      return 1300;
    default:
      return 1000;
  }
}

function buildSnapshot(currentElo: number): EloSnapshot {
  const currentTier = getTier(currentElo);
  const nextTier = getNextTier(currentElo);
  const currentThreshold = getTierThreshold(currentTier);
  const nextThreshold = nextTier ? getTierThreshold(nextTier) : currentElo;
  const progress = nextTier
    ? ((currentElo - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    : 100;

  return {
    currentElo,
    currentTier,
    nextTier,
    eloToNext: nextTier ? Math.max(0, nextThreshold - currentElo) : 0,
    progress: Math.min(100, Math.max(0, progress)),
  };
}

export function EloHistory({ userId }: EloHistoryProps) {
  const [data, setData] = useState<EloSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch('/api/player/me');
        if (!res.ok) {
          setData(null);
          return;
        }

        const json = await res.json();
        const currentElo = json.user?.hiddenElo;

        if (typeof currentElo !== 'number') {
          setData(null);
          return;
        }

        setData(buildSnapshot(Math.round(currentElo)));
      } catch {
        setData(null);
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
          <CardTitle className="text-lg">ELO Status</CardTitle>
          <CardDescription>Loading rating data...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ELO Status</CardTitle>
          <CardDescription>Historical rating data is not available yet.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Your current rating summary will appear here once player ELO data is available for this account.
        </CardContent>
      </Card>
    );
  }

  const tierColor = tierColors[data.currentTier] || tierColors.Bronze;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">ELO Status</CardTitle>
            <CardDescription>Current rating and tier based on recorded results</CardDescription>
          </div>
          <Badge className={`${tierColor.bg} ${tierColor.text} ${tierColor.border} border`}>
            <Award className="mr-1 h-4 w-4" />
            {data.currentTier}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold">{data.currentElo}</div>
            <div className="text-sm text-muted-foreground">Current ELO</div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div className="font-medium text-foreground">
              {data.nextTier ? `${data.eloToNext} to ${data.nextTier}` : 'Top tier reached'}
            </div>
            <div>Progress is based on recorded match results only.</div>
          </div>
        </div>

        {data.nextTier && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress to {data.nextTier}</span>
              <span className="font-medium">{data.eloToNext} ELO needed</span>
            </div>
            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 bottom-0 rounded-full bg-primary transition-all"
                style={{ width: `${data.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <BarChart3 className="h-4 w-4" />
            Historical chart unavailable
          </div>
          We removed generated sample ELO history. This section will show a real rating timeline once historical snapshots are stored.
        </div>
      </CardContent>
    </Card>
  );
}
