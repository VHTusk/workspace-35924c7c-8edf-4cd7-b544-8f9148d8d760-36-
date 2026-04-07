/**
 * Global Leaderboard Component
 * v3.39.0 - Displays global rating leaderboard
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { GlobalRatingBadge } from './global-rating-badge';
import { getTierColor, TIER_WEIGHTS, CATEGORY_TIER_MAPPING } from '@/lib/global-rating';
import { Trophy, Search, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  firstName: string;
  lastName: string;
  globalElo: number;
  isProvisional: boolean;
  provisionalMatches: number;
  city?: string | null;
  state?: string | null;
  tier: string;
  wins: number;
  losses: number;
  rank: number;
}

interface GlobalLeaderboardProps {
  sport: 'CORNHOLE' | 'DARTS';
  limit?: number;
}

export function GlobalLeaderboard({ sport, limit = 50 }: GlobalLeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [excludeProvisional, setExcludeProvisional] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [sport, offset, stateFilter, excludeProvisional]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        sport,
        limit: limit.toString(),
        offset: offset.toString(),
        ...(stateFilter && { state: stateFilter }),
        excludeProvisional: excludeProvisional.toString(),
      });

      const response = await fetch(`/api/ratings/leaderboard?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch leaderboard');
      }

      setEntries(data.data.entries);
      setTotal(data.data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Global Rankings</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Global Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchLeaderboard} variant="outline" className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Global Rankings
          </CardTitle>
          <CardDescription>
            {total} ranked players • Updated in real-time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search players..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All States</SelectItem>
                <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                <SelectItem value="Karnataka">Karnataka</SelectItem>
                <SelectItem value="Delhi">Delhi</SelectItem>
                <SelectItem value="Gujarat">Gujarat</SelectItem>
                <SelectItem value="Tamil Nadu">Tamil Nadu</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={excludeProvisional ? 'default' : 'outline'}
              onClick={() => setExcludeProvisional(!excludeProvisional)}
            >
              {excludeProvisional ? 'Hide Provisional' : 'Show All'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Top 3 Podium */}
      {offset === 0 && entries.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {/* 2nd Place */}
          <div className="order-1 pt-8">
            <Card className="text-center p-4 bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
              <div className="text-2xl mb-2">🥈</div>
              <p className="font-semibold truncate">{entries[1].firstName} {entries[1].lastName[0]}.</p>
              <GlobalRatingBadge
                globalElo={entries[1].globalElo}
                tier={entries[1].tier}
                size="sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {entries[1].wins}W - {entries[1].losses}L
              </p>
            </Card>
          </div>
          {/* 1st Place */}
          <div className="order-2">
            <Card className="text-center p-4 bg-gradient-to-b from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-300">
              <div className="text-3xl mb-2">👑</div>
              <p className="font-bold truncate">{entries[0].firstName} {entries[0].lastName[0]}.</p>
              <GlobalRatingBadge
                globalElo={entries[0].globalElo}
                tier={entries[0].tier}
                rank={1}
                size="md"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {entries[0].wins}W - {entries[0].losses}L
              </p>
            </Card>
          </div>
          {/* 3rd Place */}
          <div className="order-3 pt-12">
            <Card className="text-center p-4 bg-gradient-to-b from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-300">
              <div className="text-2xl mb-2">🥉</div>
              <p className="font-semibold truncate">{entries[2].firstName} {entries[2].lastName[0]}.</p>
              <GlobalRatingBadge
                globalElo={entries[2].globalElo}
                tier={entries[2].tier}
                size="sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {entries[2].wins}W - {entries[2].losses}L
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* Full Rankings Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Rank</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Player</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Rating</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">W/L</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.slice(offset === 0 ? 3 : 0).map((entry, idx) => {
                  const actualRank = offset === 0 ? idx + 4 : offset + idx + 1;
                  return (
                    <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-muted-foreground">
                          #{actualRank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {entry.firstName} {entry.lastName}
                          </span>
                          {entry.isProvisional && (
                            <Badge variant="outline" className="text-xs">
                              Provisional
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <GlobalRatingBadge
                          globalElo={entry.globalElo}
                          tier={entry.tier}
                          isProvisional={entry.isProvisional}
                          provisionalMatches={entry.provisionalMatches}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-green-600">{entry.wins}</span>
                        <span className="text-muted-foreground mx-1">-</span>
                        <span className="text-red-600">{entry.losses}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {entry.city || entry.state ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[entry.city, entry.state].filter(Boolean).join(', ')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Category Weights Info */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How Ratings Work</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Tournament category affects rating changes. Higher tier competitions have more impact.
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TIER_WEIGHTS).map(([tier, weight]) => (
              <Badge key={tier} variant="outline" className="text-xs">
                Tier {tier}: {weight}x
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
