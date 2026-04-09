"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Trophy,
  Users,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  Medal,
  Activity,
  Award,
  Star,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Sidebar from "@/components/layout/sidebar";

interface AnalyticsData {
  totalPoints: number;
  avgElo: number;
  totalMembers: number;
  activeMembers: number;
  tournamentsHosted: number;
  tournamentsWon: number;
  matchesPlayed: number;
  matchesWon: number;
  winRate: number;
  rank: number;
  totalOrganizations: number;
  topPlayers: Array<{
    id: string;
    name: string;
    points: number;
    elo: number;
    tier: string;
    matches: number;
    wins: number;
    winRate: number;
  }>;
  allPlayers: Array<{
    id: string;
    name: string;
    city?: string;
    state?: string;
    points: number;
    elo: number;
    tier: string;
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
    verificationStatus: string;
  }>;
  recentPerformance: { month: string; matches: number; wins: number }[];
  tierDistribution: { tier: string; count: number }[];
  recentMatches: Array<{
    id: string;
    player: string;
    opponent: string;
    tournament: string;
    result: "WIN" | "LOSS";
    score: string;
    date: string;
  }>;
}

export default function AnalyticsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Player list state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("points");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchAnalytics();
  }, [sport]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch("/api/org/analytics", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const primaryClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-100" : "bg-teal-100";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "diamond": return "bg-blue-100 text-blue-800";
      case "platinum": return "bg-cyan-100 text-cyan-800";
      case "gold": return "bg-yellow-100 text-yellow-800";
      case "silver": return "bg-gray-100 text-gray-800";
      case "bronze": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Filter and sort players
  const filteredPlayers = analytics?.allPlayers
    ? analytics.allPlayers
        .filter((player) =>
          player.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
          const aVal = a[sortBy as keyof typeof a];
          const bVal = b[sortBy as keyof typeof b];
          if (typeof aVal === "number" && typeof bVal === "number") {
            return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
          }
          if (typeof aVal === "string" && typeof bVal === "string") {
            return sortOrder === "desc"
              ? bVal.localeCompare(aVal)
              : aVal.localeCompare(bVal);
          }
          return 0;
        })
    : [];

  // Pagination
  const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage);
  const paginatedPlayers = filteredPlayers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const exportPlayers = () => {
    if (!analytics?.allPlayers) return;

    const csvRows = [
      "Name,City,State,Points,ELO,Tier,Matches,Wins,Losses,Win Rate",
    ];

    for (const player of analytics.allPlayers) {
      csvRows.push(
        [
          player.name,
          player.city || "",
          player.state || "",
          player.points,
          player.elo,
          player.tier,
          player.matches,
          player.wins,
          player.losses,
          `${player.winRate.toFixed(1)}%`,
        ].join(",")
      );
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `organization-players-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex">
        <Sidebar />
        <main className="ml-72 flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </main>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-gray-50 min-h-screen flex">
        <Sidebar />
        <main className="ml-72 flex-1 flex items-center justify-center">
          <p className="text-gray-500">No analytics data available</p>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics & Stats</h1>
              <p className="text-gray-500">Organization performance and player statistics</p>
            </div>
            <Button onClick={exportPlayers} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export Data
            </Button>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                    <Trophy className={cn("w-5 h-5", primaryClass)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.totalPoints.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Total Points</p>
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
                    <p className="text-2xl font-bold">{analytics.avgElo}</p>
                    <p className="text-sm text-gray-500">Avg ELO</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.winRate}%</p>
                    <p className="text-sm text-gray-500">Win Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Medal className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">#{analytics.rank}</p>
                    <p className="text-sm text-gray-500">Org Rank</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.totalMembers}</p>
                    <p className="text-sm text-gray-500">Members</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="players" className="space-y-6">
            <TabsList className="bg-white border border-gray-200">
              <TabsTrigger value="players">Player Stats</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="matches">Recent Matches</TabsTrigger>
            </TabsList>

            {/* Player Stats Tab */}
            <TabsContent value="players">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Player Performance</CardTitle>
                      <CardDescription>All affiliated players and their statistics</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search players..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="pl-10 w-64"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                            <button
                              onClick={() => handleSort("name")}
                              className="flex items-center gap-1 hover:text-gray-700"
                            >
                              Player <ArrowUpDown className="w-3 h-3" />
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Tier</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                            <button
                              onClick={() => handleSort("points")}
                              className="flex items-center gap-1 hover:text-gray-700 ml-auto"
                            >
                              Points <ArrowUpDown className="w-3 h-3" />
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                            <button
                              onClick={() => handleSort("elo")}
                              className="flex items-center gap-1 hover:text-gray-700 ml-auto"
                            >
                              ELO <ArrowUpDown className="w-3 h-3" />
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Matches</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">W/L</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                            <button
                              onClick={() => handleSort("winRate")}
                              className="flex items-center gap-1 hover:text-gray-700 ml-auto"
                            >
                              Win % <ArrowUpDown className="w-3 h-3" />
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedPlayers.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                              No players found
                            </td>
                          </tr>
                        ) : (
                          paginatedPlayers.map((player) => (
                            <tr key={player.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-gray-900">{player.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {player.city && player.state
                                      ? `${player.city}, ${player.state}`
                                      : player.state || player.city || ""}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={getTierColor(player.tier)}>{player.tier}</Badge>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold">{player.points.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right">{player.elo}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{player.matches}</td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-green-600">{player.wins}</span>
                                <span className="text-gray-400">/</span>
                                <span className="text-red-600">{player.losses}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    player.winRate >= 50
                                      ? "border-green-200 text-green-700"
                                      : "border-red-200 text-red-700"
                                  )}
                                >
                                  {player.winRate.toFixed(1)}%
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Link href={`/${sport}/players/${player.id}`}>
                                  <Button variant="ghost" size="sm" className="gap-1">
                                    View <ExternalLink className="w-3 h-3" />
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-500">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                        {Math.min(currentPage * itemsPerPage, filteredPlayers.length)} of{" "}
                        {filteredPlayers.length} players
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let page: number;
                          if (totalPages <= 5) {
                            page = i + 1;
                          } else if (currentPage <= 3) {
                            page = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            page = totalPages - 4 + i;
                          } else {
                            page = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={page}
                              variant={page === currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className={cn(page === currentPage && primaryBtnClass)}
                            >
                              {page}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Performance Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" /> Performance Trend
                    </CardTitle>
                    <CardDescription>Matches played and won over the last 6 months</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-end justify-between gap-2">
                      {analytics.recentPerformance.map((data) => (
                        <div key={data.month} className="flex-1 flex flex-col items-center">
                          <div className="w-full flex flex-col gap-1">
                            <div
                              className="w-full rounded-t bg-green-400"
                              style={{
                                height: `${Math.max(10, (data.wins / 40) * 100)}px`,
                              }}
                              title={`Wins: ${data.wins}`}
                            />
                            <div
                              className="w-full rounded-t bg-red-300"
                              style={{
                                height: `${Math.max(5, ((data.matches - data.wins) / 40) * 100)}px`,
                              }}
                              title={`Losses: ${data.matches - data.wins}`}
                            />
                          </div>
                          <span className="text-xs text-gray-500 mt-2">{data.month}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-green-400" />
                        <span className="text-sm text-gray-500">Wins</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-red-300" />
                        <span className="text-sm text-gray-500">Losses</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Players */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="w-5 h-5" /> Top Performers
                    </CardTitle>
                    <CardDescription>Highest performing members this month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.topPlayers.slice(0, 5).map((player, index) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                                index === 0
                                  ? "bg-yellow-100 text-yellow-800"
                                  : index === 1
                                  ? "bg-gray-200 text-gray-800"
                                  : index === 2
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-gray-100 text-gray-600"
                              )}
                            >
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900">{player.name}</p>
                              <p className="text-sm text-gray-500">
                                {player.wins}W - {player.matches - player.wins}L
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={getTierColor(player.tier)}>{player.tier}</Badge>
                            <p className="text-sm font-semibold text-gray-700 mt-1">
                              {player.points.toLocaleString()} pts
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4" /> Members
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Total Members</span>
                        <span className="font-semibold">{analytics.totalMembers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Active Members</span>
                        <span className="font-semibold">{analytics.activeMembers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Activity Rate</span>
                        <span className="font-semibold">
                          {analytics.totalMembers > 0
                            ? Math.round((analytics.activeMembers / analytics.totalMembers) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Trophy className="w-4 h-4" /> Tournaments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Hosted</span>
                        <span className="font-semibold">{analytics.tournamentsHosted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Won by Members</span>
                        <span className="font-semibold">{analytics.tournamentsWon}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Success Rate</span>
                        <span className="font-semibold">
                          {analytics.tournamentsHosted > 0
                            ? Math.round((analytics.tournamentsWon / analytics.tournamentsHosted) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-4 h-4" /> Matches
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Total Played</span>
                        <span className="font-semibold">{analytics.matchesPlayed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Won</span>
                        <span className="font-semibold text-green-600">{analytics.matchesWon}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Lost</span>
                        <span className="font-semibold text-red-600">
                          {analytics.matchesPlayed - analytics.matchesWon}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tier Distribution */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5" /> Tier Distribution
                  </CardTitle>
                  <CardDescription>Player tier breakdown in your organization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {analytics.tierDistribution.map((t) => (
                      <div key={t.tier} className="flex items-center gap-3 p-4 rounded-lg border bg-gray-50">
                        <Badge className={getTierColor(t.tier)}>{t.tier}</Badge>
                        <span className="text-2xl font-bold">{t.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recent Matches Tab */}
            <TabsContent value="matches">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Matches by Organization Players</CardTitle>
                  <CardDescription>Latest match results from your affiliated players</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.recentMatches.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No recent matches</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {analytics.recentMatches.map((match) => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-4">
                            <Badge
                              className={cn(
                                "font-semibold",
                                match.result === "WIN"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              )}
                            >
                              {match.result}
                            </Badge>
                            <div>
                              <p className="font-medium text-gray-900">
                                {match.player} vs {match.opponent}
                              </p>
                              <p className="text-sm text-gray-500">{match.tournament}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <p className="font-semibold text-gray-900">{match.score}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(match.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
