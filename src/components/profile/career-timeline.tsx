"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Loader2,
  Award,
  TrendingUp,
  Medal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TournamentResult {
  id: string;
  tournamentId: string;
  tournament: {
    id: string;
    name: string;
    type: string;
    scope: string;
    city: string | null;
    state: string | null;
    startDate: Date;
    status: string;
  };
  rank: number;
  bonusPoints: number;
  awardedAt: string;
}

interface MatchHistory {
  id: string;
  playedAt: string;
  scoreA: number;
  scoreB: number;
  winnerId: string | null;
  opponent: {
    id: string;
    firstName: string;
    lastName: string;
  };
  isWinner: boolean;
  tournament?: {
    id: string;
    name: string;
  } | null;
  pointsEarned: number;
}

interface CareerData {
  tournamentResults: TournamentResult[];
  recentMatches: MatchHistory[];
  stats: {
    totalTournaments: number;
    wins: number;
    losses: number;
    podiums: number;
    totalPoints: number;
    bestRank: number | null;
  };
}

export default function CareerTimeline() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CareerData | null>(null);

  useEffect(() => {
    fetchCareerData();
  }, [sport]);

  const fetchCareerData = async () => {
    try {
      const response = await fetch("/api/player/career", {
        credentials: "include",
      });
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch career data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { emoji: "🥇", color: "bg-amber-100 text-amber-700", label: "Winner" };
    if (rank === 2) return { emoji: "🥈", color: "bg-gray-100 text-gray-600", label: "Runner-up" };
    if (rank === 3) return { emoji: "🥉", color: "bg-orange-100 text-orange-700", label: "3rd Place" };
    return { emoji: `#${rank}`, color: "bg-blue-100 text-blue-700", label: `${rank}${getOrdinal(rank)} Place` };
  };

  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const getScopeBadge = (scope: string) => {
    const colors: Record<string, string> = {
      NATIONAL: "bg-purple-100 text-purple-700",
      STATE: "bg-blue-100 text-blue-700",
      DISTRICT: "bg-teal-100 text-teal-700",
      CITY: "bg-green-100 text-green-700",
    };
    return colors[scope] || "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return (
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardContent className="py-8 text-center text-gray-500">
          <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No career history yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <Trophy className="w-6 h-6 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold text-gray-900">{data.stats.totalTournaments}</p>
            <p className="text-xs text-gray-500">Tournaments</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <Medal className="w-6 h-6 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold text-gray-900">{data.stats.podiums}</p>
            <p className="text-xs text-gray-500">Podium Finishes</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold text-gray-900">{data.stats.wins}W - {data.stats.losses}L</p>
            <p className="text-xs text-gray-500">Win/Loss</p>
          </CardContent>
        </Card>
      </div>

      {/* Tournament Results */}
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Tournament History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.tournamentResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No tournament results yet</p>
              <p className="text-sm">Enter a tournament to start your journey!</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {data.tournamentResults.map((result) => {
                const rankBadge = getRankBadge(result.rank);
                return (
                  <div
                    key={result.id}
                    className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0",
                      rankBadge.color
                    )}>
                      {rankBadge.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{result.tournament.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getScopeBadge(result.tournament.scope)}>
                          {result.tournament.scope}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {result.tournament.city || result.tournament.state}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-500">
                          {new Date(result.tournament.startDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <span className="text-green-600 font-medium">
                          +{result.bonusPoints} pts
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge className={rankBadge.color}>{rankBadge.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Matches */}
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-500" />
            Recent Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentMatches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No matches played yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.recentMatches.map((match) => (
                <div
                  key={match.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    match.isWinner ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        vs {match.opponent.firstName} {match.opponent.lastName}
                      </span>
                      {match.isWinner ? (
                        <Badge className="bg-green-100 text-green-700">Won</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700">Lost</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>Score: {match.scoreA} - {match.scoreB}</span>
                      {match.tournament && <span>• {match.tournament.name}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "font-semibold",
                      match.pointsEarned > 0 ? "text-green-600" : "text-red-500"
                    )}>
                      {match.pointsEarned > 0 ? `+${match.pointsEarned}` : match.pointsEarned} pts
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(match.playedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
