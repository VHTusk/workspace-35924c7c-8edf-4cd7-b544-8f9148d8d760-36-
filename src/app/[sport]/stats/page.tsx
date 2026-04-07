"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Trophy,
  Target,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Medal,
  BarChart3,
  Flame,
  Clock,
  Award,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowUpDown,
  User,
  Swords,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/layout/sidebar";

interface MatchHistory {
  id: string;
  tournamentId: string;
  tournamentName: string;
  opponent: { id: string; name: string };
  result: "WIN" | "LOSS";
  score: string;
  pointsEarned: number;
  eloChange: number;
  date: string;
  round?: string;
}

interface PlayerStats {
  visiblePoints: number;
  hiddenElo: number;
  highestElo: number;
  rank: number;
  totalPlayers: number;
  tier: string;
  tierProgress: number;
  nextTier: string;
  pointsToNextTier: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  podiumFinishes: number;
  averagePointsPerMatch: number;
  // Sport specific
  sportStats?: {
    // Darts
    averageScore?: number;
    oneEighties?: number;
    checkoutPercentage?: number;
    // Cornhole
    bagsThrown?: number;
    aces?: number;
    holeOuts?: number;
    pitchingPercentage?: number;
  };
  recentMatches: MatchHistory[];
  performanceHistory: Array<{ month: string; elo: number; points: number; matches: number }>;
  winLossByMonth: Array<{ month: string; wins: number; losses: number }>;
  totalMatches: number;
}

interface ComparePlayer {
  id: string;
  name: string;
  city?: string;
  state?: string;
  tier: string;
  points: number;
  elo: number;
  rank: number | null;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

const ITEMS_PER_PAGE = 10;

const tierColors: Record<string, string> = {
  UNRANKED: "from-gray-400 to-gray-600",
  BRONZE: "from-orange-400 to-orange-600",
  SILVER: "from-gray-300 to-gray-500",
  GOLD: "from-yellow-400 to-yellow-600",
  PLATINUM: "from-cyan-400 to-cyan-600",
  DIAMOND: "from-blue-400 to-blue-600",
};

const tierBadgeColors: Record<string, string> = {
  UNRANKED: "bg-gray-100 text-gray-700",
  BRONZE: "bg-orange-100 text-orange-700",
  SILVER: "bg-gray-200 text-gray-700",
  GOLD: "bg-amber-100 text-amber-700",
  PLATINUM: "bg-cyan-100 text-cyan-700",
  DIAMOND: "bg-blue-100 text-blue-700",
};

export default function MyStatsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Match history pagination and filters
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterResult, setFilterResult] = useState<string>("all");
  const [filterTournament, setFilterTournament] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Compare feature
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ComparePlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<ComparePlayer | null>(null);
  const [comparisonData, setComparisonData] = useState<{
    headToHead?: { wins: number; losses: number; matches: number };
    commonOpponents?: Array<{ name: string; youWon: number; theyWon: number }>;
  } | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchMatchHistory();
  }, [sport]);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/player/stats", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      setError("Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchHistory = async (page = 1) => {
    setMatchesLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (filterResult !== "all") params.set("result", filterResult);
      if (filterTournament) params.set("tournament", filterTournament);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const response = await fetch(`/api/player/matches?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch matches");
      const data = await response.json();
      setMatches(data.matches);
      setTotalPages(data.totalPages);
      setCurrentPage(data.currentPage);
    } catch (err) {
      console.error("Failed to fetch matches:", err);
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
    fetchMatchHistory(1);
  };

  const handlePageChange = (page: number) => {
    fetchMatchHistory(page);
  };

  const searchPlayers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(
        `/api/search/players?q=${encodeURIComponent(query)}&sport=${sport.toUpperCase()}&limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.players || data.results || []);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const fetchComparison = async (playerId: string) => {
    setComparisonLoading(true);
    try {
      const response = await fetch(
        `/api/player/compare?playerId=${playerId}&sport=${sport.toUpperCase()}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setComparisonData(data);
      }
    } catch (err) {
      console.error("Failed to fetch comparison:", err);
    } finally {
      setComparisonLoading(false);
    }
  };

  const handleSelectPlayer = (player: ComparePlayer) => {
    setSelectedPlayer(player);
    setSearchResults([]);
    setSearchQuery("");
    fetchComparison(player.id);
  };

  const exportMatchHistory = async () => {
    try {
      const response = await fetch("/api/player/matches?export=true", { credentials: "include" });
      if (response.ok) {
        const data = await response.text();
        const blob = new Blob([data], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `match-history-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-100" : "bg-teal-100";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  if (loading) {
    return (
      <div className="bg-muted min-h-screen">
        <Sidebar userType="player" />
        <main className="ml-0 md:ml-72">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-muted min-h-screen">
        <Sidebar userType="player" />
        <main className="ml-0 md:ml-72">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
            <p className="text-muted-foreground">{error || "No stats available"}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-muted min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72">
        <div className="p-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Statistics</h1>
              <p className="text-muted-foreground">Track your performance and progress</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCompareDialogOpen(true)}
                className="gap-2"
              >
                <Swords className="w-4 h-4" />
                Compare
              </Button>
              <Button onClick={exportMatchHistory} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Top Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Tier Card */}
            <Card className="overflow-hidden">
              <div className={cn("h-2 bg-gradient-to-r", tierColors[stats.tier])} />
              <CardContent className="p-4 text-center">
                <div className={cn("w-16 h-16 mx-auto rounded-full bg-gradient-to-r flex items-center justify-center mb-2", tierColors[stats.tier])}>
                  <Medal className="w-8 h-8 text-white" />
                </div>
                <p className="text-2xl font-bold">{stats.tier}</p>
                <p className="text-sm text-muted-foreground">Current Tier</p>
                <div className="mt-2">
                  <Progress value={stats.tierProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.pointsToNextTier} pts to {stats.nextTier}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Points Card */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                    <Target className={cn("w-5 h-5", primaryTextClass)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.visiblePoints.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total Points</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                  <span className="text-muted-foreground">ELO Rating</span>
                  <span className="font-semibold">{stats.hiddenElo}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Highest ELO</span>
                  <span className="font-semibold text-amber-600">{stats.highestElo}</span>
                </div>
              </CardContent>
            </Card>

            {/* Rank Card */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Trophy className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">#{stats.rank}</p>
                    <p className="text-sm text-muted-foreground">Global Rank</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                  <span className="text-muted-foreground">Percentile</span>
                  <span className="font-semibold">
                    Top {stats.totalPlayers > 0 ? ((stats.rank / stats.totalPlayers) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Win Rate Card */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <BarChart3 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                  <span className="text-muted-foreground">W/L Record</span>
                  <span className="font-semibold">{stats.matchesWon}W - {stats.matchesLost}L</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  Streaks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Current Streak</span>
                    <Badge className="bg-orange-100 text-orange-700">
                      {stats.currentStreak} wins
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Best Streak</span>
                    <Badge className="bg-green-100 text-green-700">
                      {stats.bestStreak} wins
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Tournaments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Played</span>
                    <span className="font-semibold">{stats.tournamentsPlayed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Won</span>
                    <Badge className="bg-yellow-100 text-yellow-700">{stats.tournamentsWon}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Podium Finishes</span>
                    <span className="font-semibold">{stats.podiumFinishes}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  Match Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Matches</span>
                    <span className="font-semibold">{stats.matchesPlayed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg Points/Match</span>
                    <span className="font-semibold">{stats.averagePointsPerMatch.toFixed(1)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sport Specific Stats */}
            {stats.sportStats && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-500" />
                    {isCornhole ? "Cornhole" : "Darts"} Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {isCornhole && stats.sportStats && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Aces</span>
                          <span className="font-semibold">{stats.sportStats.aces || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Hole Outs</span>
                          <span className="font-semibold">{stats.sportStats.holeOuts || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Pitch %</span>
                          <span className="font-semibold">{stats.sportStats.pitchingPercentage?.toFixed(1) || 0}%</span>
                        </div>
                      </>
                    )}
                    {!isCornhole && stats.sportStats && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Avg Score</span>
                          <span className="font-semibold">{stats.sportStats.averageScore?.toFixed(1) || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">180s Hit</span>
                          <span className="font-semibold">{stats.sportStats.oneEighties || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Checkout %</span>
                          <span className="font-semibold">{stats.sportStats.checkoutPercentage?.toFixed(1) || 0}%</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Tabs for Analytics and Match History */}
          <Tabs defaultValue="history" className="space-y-6">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="history">Match History</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            {/* Match History Tab */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Match History</CardTitle>
                      <CardDescription>All your recorded matches</CardDescription>
                    </div>
                    <Badge variant="outline">{stats.totalMatches} total matches</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4 p-4 bg-muted rounded-lg">
                    <div>
                      <Label className="text-xs text-muted-foreground">Result</Label>
                      <Select value={filterResult} onValueChange={(v) => { setFilterResult(v); handleFilterChange(); }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Results</SelectItem>
                          <SelectItem value="WIN">Wins</SelectItem>
                          <SelectItem value="LOSS">Losses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Tournament</Label>
                      <Input
                        placeholder="Tournament name"
                        value={filterTournament}
                        onChange={(e) => setFilterTournament(e.target.value)}
                        onBlur={handleFilterChange}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">From Date</Label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        onBlur={handleFilterChange}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">To Date</Label>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        onBlur={handleFilterChange}
                      />
                    </div>
                  </div>

                  {/* Match List */}
                  {matchesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : matches.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No matches found</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {matches.map((match) => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <Badge
                              className={cn(
                                "font-semibold",
                                match.result === "WIN" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                              )}
                            >
                              {match.result}
                            </Badge>
                            <div>
                              <p className="font-medium text-foreground">
                                vs {match.opponent.name}
                              </p>
                              <p className="text-sm text-muted-foreground">{match.tournamentName}</p>
                              {match.round && (
                                <p className="text-xs text-muted-foreground">{match.round}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="font-semibold text-foreground">{match.score}</p>
                              <p className="text-xs text-muted-foreground">Score</p>
                            </div>
                            <div className="text-center">
                              <p className={cn(
                                "font-semibold",
                                match.pointsEarned > 0 ? "text-green-600" : "text-muted-foreground"
                              )}>
                                +{match.pointsEarned}
                              </p>
                              <p className="text-xs text-muted-foreground">Points</p>
                            </div>
                            <div className="text-center">
                              <p className={cn(
                                "font-semibold flex items-center gap-1",
                                match.eloChange > 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {match.eloChange > 0 ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                )}
                                {match.eloChange > 0 ? "+" : ""}{match.eloChange}
                              </p>
                              <p className="text-xs text-muted-foreground">ELO</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">
                                {new Date(match.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
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
                            onClick={() => handlePageChange(page)}
                            className={cn(page === currentPage && primaryBtnClass)}
                          >
                            {page}
                          </Button>
                        );
                      })}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ELO Progression */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      ELO Progression
                    </CardTitle>
                    <CardDescription>Your rating over the last 6 months</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-end justify-between gap-2">
                      {stats.performanceHistory.map((data, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center">
                          <div
                            className={cn("w-full rounded-t transition-all", primaryBgClass)}
                            style={{
                              height: `${Math.max(20, ((data.elo - 800) / 1000) * 150)}px`,
                            }}
                            title={`ELO: ${data.elo}`}
                          />
                          <span className="text-xs text-muted-foreground mt-2">{data.month}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                      <span className="text-muted-foreground">Current: <strong>{stats.hiddenElo}</strong></span>
                      <span className="text-muted-foreground">Peak: <strong className="text-amber-600">{stats.highestElo}</strong></span>
                    </div>
                  </CardContent>
                </Card>

                {/* Win/Loss Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Win/Loss Distribution
                    </CardTitle>
                    <CardDescription>Breakdown of your match results</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center mb-6">
                      <div className="relative w-32 h-32">
                        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                          <circle
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="3"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="3"
                            strokeDasharray={`${stats.winRate} ${100 - stats.winRate}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-bold">{stats.winRate.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-sm text-muted-foreground">Wins ({stats.matchesWon})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300" />
                        <span className="text-sm text-muted-foreground">Losses ({stats.matchesLost})</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Performance */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Monthly Performance
                    </CardTitle>
                    <CardDescription>Wins and losses by month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-end justify-between gap-4">
                      {stats.winLossByMonth.map((data, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center">
                          <div className="w-full flex flex-col-reverse gap-1">
                            <div
                              className="w-full rounded-t bg-green-400"
                              style={{ height: `${Math.max(4, data.wins * 8)}px` }}
                              title={`Wins: ${data.wins}`}
                            />
                            <div
                              className="w-full rounded-t bg-red-300"
                              style={{ height: `${Math.max(4, data.losses * 8)}px` }}
                              title={`Losses: ${data.losses}`}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground mt-2">{data.month}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-green-400" />
                        <span className="text-sm text-muted-foreground">Wins</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-red-300" />
                        <span className="text-sm text-muted-foreground">Losses</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Compare Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="w-5 h-5" />
              Compare with Another Player
            </DialogTitle>
            <DialogDescription>
              Search for a player to compare your stats
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search player by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchPlayers(e.target.value);
                }}
                className="pl-10"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {searchResults.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handleSelectPlayer(player)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                          {player.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <p className="font-medium text-foreground">{player.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {player.city && player.state ? `${player.city}, ${player.state}` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge className={tierBadgeColors[player.tier]}>{player.tier}</Badge>
                  </button>
                ))}
              </div>
            )}

            {/* Comparison Results */}
            {selectedPlayer && (
              <div className="mt-6">
                {comparisonLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Players Comparison */}
                    <div className="grid grid-cols-3 gap-4">
                      {/* You */}
                      <Card className="text-center">
                        <CardContent className="p-4">
                          <Avatar className="w-12 h-12 mx-auto mb-2">
                            <AvatarFallback className={cn("text-white", primaryBtnClass)}>
                              You
                            </AvatarFallback>
                          </Avatar>
                          <p className="font-semibold">You</p>
                          <Badge className={cn("mt-1", tierBadgeColors[stats.tier])}>
                            {stats.tier}
                          </Badge>
                        </CardContent>
                      </Card>

                      {/* VS */}
                      <div className="flex items-center justify-center">
                        <div className="text-2xl font-bold text-muted-foreground">VS</div>
                      </div>

                      {/* Opponent */}
                      <Card className="text-center">
                        <CardContent className="p-4">
                          <Avatar className="w-12 h-12 mx-auto mb-2">
                            <AvatarFallback className="bg-muted text-muted-foreground">
                              {selectedPlayer.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <p className="font-semibold">{selectedPlayer.name}</p>
                          <Badge className={cn("mt-1", tierBadgeColors[selectedPlayer.tier])}>
                            {selectedPlayer.tier}
                          </Badge>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Stats Comparison */}
                    <div className="space-y-2">
                      {[
                        { label: "Points", you: stats.visiblePoints, them: selectedPlayer.points },
                        { label: "ELO", you: stats.hiddenElo, them: selectedPlayer.elo },
                        { label: "Rank", you: stats.rank, them: selectedPlayer.rank || 999 },
                        { label: "Matches", you: stats.matchesPlayed, them: selectedPlayer.matchesPlayed },
                        { label: "Wins", you: stats.matchesWon, them: selectedPlayer.wins },
                        { label: "Losses", you: stats.matchesLost, them: selectedPlayer.losses },
                        { label: "Win Rate", you: `${stats.winRate.toFixed(1)}%`, them: `${selectedPlayer.winRate.toFixed(1)}%` },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="grid grid-cols-3 gap-4 p-3 bg-muted rounded-lg"
                        >
                          <div className="text-right">
                            <span className={cn(
                              "font-semibold",
                              typeof stat.you === "number" && typeof stat.them === "number" && stat.you > stat.them
                                ? primaryTextClass
                                : ""
                            )}>
                              {stat.you}
                            </span>
                          </div>
                          <div className="text-center text-sm text-muted-foreground">{stat.label}</div>
                          <div className="text-left">
                            <span className={cn(
                              "font-semibold",
                              typeof stat.you === "number" && typeof stat.them === "number" && stat.them > stat.you
                                ? "text-red-600"
                                : ""
                            )}>
                              {stat.them}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Head to Head */}
                    {comparisonData?.headToHead && comparisonData.headToHead.matches > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Head to Head Record</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-center gap-6">
                            <div className="text-center">
                              <p className="text-3xl font-bold text-green-600">{comparisonData.headToHead.wins}</p>
                              <p className="text-sm text-gray-500">Your Wins</p>
                            </div>
                            <div className="text-2xl font-bold text-gray-300">-</div>
                            <div className="text-center">
                              <p className="text-3xl font-bold text-red-600">{comparisonData.headToHead.losses}</p>
                              <p className="text-sm text-gray-500">Their Wins</p>
                            </div>
                          </div>
                          <p className="text-center text-sm text-gray-500 mt-2">
                            {comparisonData.headToHead.matches} matches played
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
