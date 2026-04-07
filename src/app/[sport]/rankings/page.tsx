"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Trophy,
  Search,
  Crown,
  Users,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  Minus,
  Loader2,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  points: number;
  tier: string;
  matches: number;
  wins: number;
  winRate: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalPlayers: number;
    activeThisMonth: number;
    topPlayer: string | null;
    topPlayerCity: string | null;
  };
  sport: string;
  scope: string;
}

const tierColors: Record<string, string> = {
  Diamond: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  Platinum: "text-teal-400 bg-teal-500/10 border-teal-500/30",
  Gold: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  Silver: "text-gray-400 bg-gray-500/10 border-gray-500/30",
  Bronze: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  UNRANKED: "text-gray-400 bg-gray-500/10 border-gray-500/30",
};

export default function PublicLeaderboardPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("national");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchLeaderboard();
  }, [sport, scopeFilter, page]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sport: sport.toUpperCase(),
        scope: scopeFilter,
        page: page.toString(),
      });
      if (search) params.append("search", search);

      const response = await fetch(`/api/public/leaderboard?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchLeaderboard();
      } else {
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  return (
    <div className="min-h-screen bg-muted pt-20 pb-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* SEO Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            {sportName} Rankings India
          </h1>
          <p className="text-muted-foreground">
            Official {sportName} leaderboard - View top players across India
          </p>
        </div>

        {/* Stats Cards */}
        {data?.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-foreground">{data.stats.totalPlayers.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Players</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                <p className="text-2xl font-bold text-foreground">{data.stats.activeThisMonth.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Active This Month</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4 text-center">
                <Crown className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                <p className="text-lg font-bold text-foreground truncate">
                  {data.stats.topPlayer || "--"}
                </p>
                <p className="text-xs text-muted-foreground">#1 Player</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                <p className="text-lg font-bold text-foreground">{sportName}</p>
                <p className="text-xs text-muted-foreground">{scopeFilter === 'national' ? 'National Rankings' : scopeFilter}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="bg-card border-border shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players by name or city..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={scopeFilter} onValueChange={setScopeFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="national">National</SelectItem>
                  <SelectItem value="state">State</SelectItem>
                  <SelectItem value="district">District</SelectItem>
                  <SelectItem value="city">City</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Top 3 Podium */}
        {!loading && data && data.leaderboard.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {data.leaderboard.slice(0, 3).map((player, index) => (
              <Card 
                key={player.id} 
                className={cn(
                  "bg-card border-border shadow-sm",
                  index === 0 ? "order-2 sm:scale-105 border-amber-300" : 
                  index === 1 ? "order-1" : 
                  "order-3"
                )}
              >
                <CardContent className={cn("p-4 text-center", index === 0 ? "pt-6" : "")}>
                  <Avatar className={cn("mx-auto mb-2", index === 0 ? "w-16 h-16" : "w-12 h-12")}>
                    <AvatarFallback className={cn(primaryBgClass, primaryTextClass, "text-lg font-bold")}>
                      {player.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-semibold text-foreground truncate">{player.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    {player.city && <><MapPin className="w-3 h-3" />{player.city}</>}
                  </p>
                  <Badge variant="outline" className={cn("mt-2", tierColors[player.tier] || tierColors.UNRANKED)}>
                    {player.tier}
                  </Badge>
                  <div className="mt-2">
                    <p className="text-2xl font-bold text-foreground">{player.points.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                  <div className={cn(
                    "text-2xl font-bold",
                    index === 0 ? "text-amber-500" : 
                    index === 1 ? "text-gray-400" : 
                    "text-orange-400"
                  )}>
                    #{player.rank}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Full Leaderboard */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">All Rankings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !data || data.leaderboard.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No players found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Player</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase hidden sm:table-cell">Tier</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Points</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Matches</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.leaderboard.map((player) => (
                      <tr key={player.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={cn(
                            "font-bold",
                            player.rank <= 3 ? primaryTextClass : "text-foreground"
                          )}>
                            #{player.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className={cn(primaryBgClass, primaryTextClass, "text-xs")}>
                                {player.name.split(" ").map(n => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{player.name}</p>
                              <p className="text-xs text-muted-foreground">{player.city || player.state || ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge variant="outline" className={tierColors[player.tier] || tierColors.UNRANKED}>
                            {player.tier}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {player.points.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                          {player.matches}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                          {player.winRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * data.pagination.limit) + 1} - {Math.min(page * data.pagination.limit, data.pagination.total)} of {data.pagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm rounded border border-border disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                    disabled={page === data.pagination.totalPages}
                    className="px-3 py-1 text-sm rounded border border-border disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SEO Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            {sportName} rankings updated in real-time. Join VALORHIVE to compete and climb the leaderboard.
          </p>
        </div>
      </div>
    </div>
  );
}
