'use client';

/**
 * VALORHIVE v3.42.0 - Player Quick Stats
 * Shows players in similar ELO range registered for tournament
 */

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, TrendingUp, Award } from 'lucide-react';

interface PlayerQuickStatsProps {
  tournamentId: string;
  sport: string;
  currentPlayerElo?: number;
  compact?: boolean;
}

interface QuickStats {
  similarEloPlayers: number;
  totalRegistrations: number;
  tierDistribution: {
    tier: string;
    count: number;
    color: string;
  }[];
  averageElo: number;
  userTier: string | null;
}

export function PlayerQuickStats({
  tournamentId,
  sport,
  currentPlayerElo,
  compact = false,
}: PlayerQuickStatsProps) {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const params = new URLSearchParams({
          sport,
          ...(currentPlayerElo && { userElo: currentPlayerElo.toString() }),
        });

        const res = await fetch(`/api/tournaments/${tournamentId}/player-stats?${params}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch player stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [tournamentId, sport, currentPlayerElo]);

  if (loading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (!stats) return null;

  // Compact variant for tournament cards
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Users className="w-4 h-4" />
        <span>
          {stats.similarEloPlayers > 0 ? (
            <>
              <strong>{stats.similarEloPlayers}</strong> player{stats.similarEloPlayers !== 1 ? 's' : ''} like you registered
            </>
          ) : (
            <>{stats.totalRegistrations} players registered</>
          )}
        </span>
      </div>
    );
  }

  // Full variant for tournament detail page
  return (
    <div className="space-y-3">
      {/* Similar ELO Players */}
      {stats.similarEloPlayers > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
          <Users className="w-5 h-5 text-blue-600" />
          <div>
            <span className="font-semibold text-blue-700">{stats.similarEloPlayers}</span>
            <span className="text-blue-600"> player{stats.similarEloPlayers !== 1 ? 's' : ''} in your ELO range registered</span>
          </div>
        </div>
      )}

      {/* Tier Distribution */}
      {stats.tierDistribution.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Award className="w-4 h-4" />
            Competition Level
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.tierDistribution.map((tier) => (
              <Badge
                key={tier.tier}
                variant="outline"
                style={{ 
                  backgroundColor: `${tier.color}15`,
                  borderColor: tier.color,
                  color: tier.color,
                }}
              >
                {tier.count} {tier.tier}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Average Rating */}
      {stats.averageElo > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <TrendingUp className="w-4 h-4" />
          Average Rating: <strong>{Math.round(stats.averageElo)}</strong>
        </div>
      )}

      {/* Your Tier Indicator */}
      {stats.userTier && (
        <div className="text-sm text-gray-600">
          Your tier: <strong className="capitalize">{stats.userTier.toLowerCase()}</strong>
        </div>
      )}
    </div>
  );
}
