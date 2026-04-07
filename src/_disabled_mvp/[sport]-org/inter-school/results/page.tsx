"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Medal,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Search,
  Filter,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchResult {
  id: string;
  tournamentId: string;
  tournamentName: string;
  round: number;
  roundName: string;
  opponentName: string;
  opponentOrg?: string;
  score: string;
  result: 'WIN' | 'LOSS' | 'DRAW';
  date: string;
  stage: string;
}

interface TournamentResult {
  id: string;
  name: string;
  scope: string;
  status: string;
  startDate: string;
  endDate: string;
  location?: string;
  format?: string;
  participants: number;
  position?: number;
  prize?: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  teamName?: string;
}

interface PerformanceStats {
  totalTournaments: number;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  trophies: number;
  podiumFinishes: number;
  recentForm: ('W' | 'L' | 'D')[];
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function InterSchoolResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [org, setOrg] = useState<OrgData | null>(null);
  const [tournamentResults, setTournamentResults] = useState<TournamentResult[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const fetchOrg = useCallback(async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
        
        if (data.type !== "SCHOOL") {
          router.push(`/${sport}/org/dashboard`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  }, [sport, router]);

  const fetchResults = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      // Fetch completed tournaments for the org
      const params = new URLSearchParams({
        sport: sport.toUpperCase(),
        status: "COMPLETED",
      });
      if (scopeFilter) params.append("scope", scopeFilter);

      const response = await fetch(`/api/tournaments?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        
        // Transform tournaments into results format
        const results: TournamentResult[] = (data.tournaments || []).map((t: TournamentResult) => ({
          id: t.id,
          name: t.name,
          scope: t.scope,
          status: t.status,
          startDate: t.startDate,
          endDate: t.endDate,
          location: t.location,
          format: t.format,
          participants: t.participants || 0,
          matchesPlayed: Math.floor(Math.random() * 5) + 1, // Placeholder
          wins: Math.floor(Math.random() * 4), // Placeholder
          losses: Math.floor(Math.random() * 2), // Placeholder
          position: Math.random() > 0.5 ? Math.floor(Math.random() * 8) + 1 : undefined, // Placeholder
          prize: t.position && t.position <= 3 ? Math.floor(Math.random() * 5000) : undefined, // Placeholder
        }));
        
        setTournamentResults(results);

        // Calculate performance stats
        const totalMatches = results.reduce((sum, r) => sum + r.matchesPlayed, 0);
        const wins = results.reduce((sum, r) => sum + r.wins, 0);
        const losses = results.reduce((sum, r) => sum + r.losses, 0);
        const podiumFinishes = results.filter(r => r.position && r.position <= 3).length;
        const trophies = results.filter(r => r.position === 1).length;
        
        setPerformanceStats({
          totalTournaments: results.length,
          totalMatches,
          wins,
          losses,
          winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0,
          trophies,
          podiumFinishes,
          recentForm: ['W', 'W', 'L', 'W', 'L'], // Placeholder
        });

        // Generate mock match results
        const matches: MatchResult[] = results.slice(0, 10).flatMap((t) => {
          const numMatches = Math.floor(Math.random() * 3) + 1;
          return Array.from({ length: numMatches }, (_, i) => ({
            id: `${t.id}-${i}`,
            tournamentId: t.id,
            tournamentName: t.name,
            round: i + 1,
            roundName: i === 0 ? 'Round 1' : i === 1 ? 'Quarter Final' : 'Semi Final',
            opponentName: `Opponent ${i + 1}`,
            opponentOrg: `School ${String.fromCharCode(65 + i)}`,
            score: `${Math.floor(Math.random() * 3)}-${Math.floor(Math.random() * 3)}`,
            result: Math.random() > 0.4 ? 'WIN' : 'LOSS',
            date: t.startDate,
            stage: i === 0 ? 'Group' : i === 1 ? 'QF' : 'SF',
          }));
        });
        setMatchResults(matches);
      } else {
        setError("Failed to load results");
      }
    } catch (err) {
      console.error("Failed to fetch results:", err);
      setError("Failed to load results");
    } finally {
      setLoading(false);
    }
  }, [org?.id, sport, scopeFilter]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  useEffect(() => {
    if (org?.id) {
      fetchResults();
    }
  }, [org?.id, fetchResults]);

  const getScopeBadge = (scope: string) => {
    const styles: Record<string, string> = {
      INTER_SCHOOL: "bg-blue-100 text-blue-700",
      INTER_ORG: "bg-purple-100 text-purple-700",
      INTER_COLLEGE: "bg-indigo-100 text-indigo-700",
      INTRA_ORG: "bg-green-100 text-green-700",
    };
    return (
      <Badge className={styles[scope] || "bg-gray-100 text-gray-700"}>
        {scope.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const getResultBadge = (result: string) => {
    const styles: Record<string, string> = {
      WIN: "bg-green-100 text-green-700",
      LOSS: "bg-red-100 text-red-700",
      DRAW: "bg-gray-100 text-gray-700",
    };
    return (
      <Badge className={styles[result] || "bg-gray-100 text-gray-700"}>
        {result}
      </Badge>
    );
  };

  const getPositionBadge = (position?: number) => {
    if (!position) return null;
    if (position === 1) {
      return (
        <div className="flex items-center gap-1 text-yellow-600">
          <Trophy className="w-4 h-4" />
          <span className="font-bold">1st</span>
        </div>
      );
    }
    if (position === 2) {
      return (
        <div className="flex items-center gap-1 text-gray-500">
          <Medal className="w-4 h-4" />
          <span className="font-bold">2nd</span>
        </div>
      );
    }
    if (position === 3) {
      return (
        <div className="flex items-center gap-1 text-amber-600">
          <Medal className="w-4 h-4" />
          <span className="font-bold">3rd</span>
        </div>
      );
    }
    return <span className="text-gray-500 font-medium">{position}th</span>;
  };

  const filteredTournaments = tournamentResults.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(`/${sport}/org/school-dashboard`)}
              className="mb-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Results & History</h1>
              <p className="text-gray-500">Tournament results and performance statistics</p>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Performance Stats */}
          {performanceStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Trophy className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
                  <p className="text-2xl font-bold text-gray-900">{performanceStats.trophies}</p>
                  <p className="text-xs text-gray-500">Trophies</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Medal className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                  <p className="text-2xl font-bold text-gray-900">{performanceStats.podiumFinishes}</p>
                  <p className="text-xs text-gray-500">Podiums</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Target className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold text-gray-900">{performanceStats.totalTournaments}</p>
                  <p className="text-xs text-gray-500">Tournaments</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <BarChart3 className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                  <p className="text-2xl font-bold text-gray-900">{performanceStats.totalMatches}</p>
                  <p className="text-xs text-gray-500">Total Matches</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold text-gray-900">{performanceStats.wins}</p>
                  <p className="text-xs text-gray-500">Wins</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <TrendingDown className="w-6 h-6 mx-auto mb-2 text-red-500" />
                  <p className="text-2xl font-bold text-gray-900">{performanceStats.losses}</p>
                  <p className="text-xs text-gray-500">Losses</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <div className="w-6 h-6 mx-auto mb-2 rounded-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">%</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{performanceStats.winRate}%</p>
                  <p className="text-xs text-gray-500">Win Rate</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent Form */}
          {performanceStats && performanceStats.recentForm.length > 0 && (
            <Card className="bg-white border-gray-100 shadow-sm mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Recent Form</p>
                    <p className="text-xs text-gray-500">Last 5 matches</p>
                  </div>
                  <div className="flex gap-2">
                    {performanceStats.recentForm.map((result, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                          result === 'W' ? "bg-green-100 text-green-700" :
                          result === 'L' ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-700"
                        )}
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content Tabs */}
          <Tabs defaultValue="tournaments" className="space-y-4">
            <TabsList className="bg-white border border-gray-200">
              <TabsTrigger value="tournaments" className="gap-2">
                <Trophy className="w-4 h-4" />
                Tournament Results
              </TabsTrigger>
              <TabsTrigger value="matches" className="gap-2">
                <Target className="w-4 h-4" />
                Match Archive
              </TabsTrigger>
            </TabsList>

            {/* Tournament Results Tab */}
            <TabsContent value="tournaments" className="space-y-4">
              {/* Search & Filter */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search tournaments..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={scopeFilter} onValueChange={setScopeFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All Scopes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Scopes</SelectItem>
                        <SelectItem value="INTER_SCHOOL">Inter-School</SelectItem>
                        <SelectItem value="INTER_ORG">Inter-Org</SelectItem>
                        <SelectItem value="INTER_COLLEGE">Inter-College</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={timeFilter} onValueChange={setTimeFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All Time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="month">Last Month</SelectItem>
                        <SelectItem value="quarter">Last Quarter</SelectItem>
                        <SelectItem value="year">Last Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Tournament List */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Tournament History</CardTitle>
                  <CardDescription>Completed tournaments and results</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : filteredTournaments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No tournament results found</p>
                      <p className="text-sm">Results will appear here after tournaments are completed</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg divide-y max-h-[600px] overflow-y-auto">
                      {filteredTournaments.map((tournament) => (
                        <div
                          key={tournament.id}
                          className="p-4 hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push(`/${sport}/tournaments/${tournament.id}`)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", primaryBgClass)}>
                                <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{tournament.name}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(tournament.startDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                  {tournament.location && (
                                    <>
                                      <span>•</span>
                                      <MapPin className="w-3 h-3" />
                                      {tournament.location}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {getScopeBadge(tournament.scope)}
                              {getPositionBadge(tournament.position)}
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 ml-13 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {tournament.participants} participants
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              {tournament.matchesPlayed} matches
                            </span>
                            <span className="flex items-center gap-1 text-green-600">
                              {tournament.wins}W
                            </span>
                            <span className="flex items-center gap-1 text-red-600">
                              {tournament.losses}L
                            </span>
                            {tournament.prize && (
                              <span className="text-amber-600 font-medium">
                                ₹{tournament.prize.toLocaleString()} prize
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Match Archive Tab */}
            <TabsContent value="matches" className="space-y-4">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Match Results Archive</CardTitle>
                  <CardDescription>Individual match results from tournaments</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : matchResults.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No match results found</p>
                      <p className="text-sm">Match results will appear here after tournaments are completed</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg divide-y max-h-[600px] overflow-y-auto">
                      {matchResults.map((match) => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between p-4 hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              match.result === 'WIN' ? "bg-green-50" : "bg-red-50"
                            )}>
                              {match.result === 'WIN' ? (
                                <TrendingUp className="w-5 h-5 text-green-600" />
                              ) : (
                                <TrendingDown className="w-5 h-5 text-red-600" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">{match.tournamentName}</p>
                                <Badge variant="outline" className="text-xs">{match.roundName}</Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                <span>vs</span>
                                <span className="font-medium text-gray-700">{match.opponentName}</span>
                                {match.opponentOrg && (
                                  <span className="text-gray-400">({match.opponentOrg})</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-lg font-bold text-gray-900">{match.score}</p>
                              <p className="text-xs text-gray-500">Score</p>
                            </div>
                            {getResultBadge(match.result)}
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
