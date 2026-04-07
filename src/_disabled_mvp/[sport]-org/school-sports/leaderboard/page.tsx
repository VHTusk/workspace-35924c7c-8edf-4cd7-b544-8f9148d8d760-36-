"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  ArrowLeft,
  Loader2,
  Medal,
  TrendingUp,
  Users,
  Filter,
  Crown,
  Star,
  AlertCircle,
  Globe,
  Target,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// ============ INTRA-SCHOOL TYPES ============
interface IntraLeaderboardEntry {
  id: string;
  rank: number;
  studentName: string;
  className: string;
  houseName?: string | null;
  points: number;
  elo: number;
  tournamentsPlayed: number;
  wins: number;
  matches: number;
  winRate: string;
}

interface IntraLeaderboardData {
  leaderboard: IntraLeaderboardEntry[];
  filters: {
    classes: string[];
    houses: string[];
  };
  stats: {
    totalStudents: number;
    topStudent: string | null;
    avgPoints: number;
  };
}

// ============ INTER-SCHOOL TYPES ============
interface InterTournamentDetail {
  id: string;
  name: string;
  scope: string | null;
  date: string;
  result: string;
  rank: number | null;
  matches: number;
  wins: number;
  winRate: number;
}

interface InterLeaderboardEntry {
  rank: number;
  id: string;
  studentName: string;
  className: string;
  houseName?: string | null;
  totalPoints: number;
  elo: number;
  tournamentsCount: number;
  tournaments: InterTournamentDetail[];
  totalMatches: number;
  wins: number;
  winRate: number;
  winRateStr: string;
  bestRank: number | null;
  podiumFinishes: number;
}

interface InterLeaderboardData {
  leaderboard: InterLeaderboardEntry[];
  stats: {
    totalParticipants: number;
    totalTournaments: number;
    topPerformer: string | null;
    totalWins: number;
    totalPodiums: number;
    scopeDistribution: Record<string, number>;
  };
  filters: {
    scopes: string[];
  };
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function SchoolLeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  // Common state
  const [org, setOrg] = useState<OrgData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("intra");

  // Intra-school state
  const [intraLoading, setIntraLoading] = useState(true);
  const [intraError, setIntraError] = useState<string | null>(null);
  const [intraData, setIntraData] = useState<IntraLeaderboardData | null>(null);
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterHouse, setFilterHouse] = useState<string>("all");

  // Inter-school state
  const [interLoading, setInterLoading] = useState(true);
  const [interError, setInterError] = useState<string | null>(null);
  const [interData, setInterData] = useState<InterLeaderboardData | null>(null);
  const [filterScope, setFilterScope] = useState<string>("all");

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  useEffect(() => {
    fetchOrg();
  }, [sport]);

  useEffect(() => {
    if (org && org.type === "SCHOOL") {
      if (activeTab === "intra") {
        fetchIntraLeaderboard();
      } else {
        fetchInterLeaderboard();
      }
    }
  }, [org, activeTab, filterClass, filterHouse, filterScope]);

  const fetchOrg = async () => {
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
  };

  const fetchIntraLeaderboard = async () => {
    setIntraLoading(true);
    setIntraError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filterClass && filterClass !== "all") {
        queryParams.append("class", filterClass);
      }
      if (filterHouse && filterHouse !== "all") {
        queryParams.append("house", filterHouse);
      }
      
      const response = await fetch(`/api/org/school/leaderboard/intra?${queryParams.toString()}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard");
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        setIntraData(result.data);
      } else {
        throw new Error(result.error || "Failed to load leaderboard");
      }
    } catch (err: any) {
      console.error("Failed to fetch intra leaderboard:", err);
      setIntraError(err.message || "Failed to load leaderboard");
      toast.error("Failed to load intra-school leaderboard");
    } finally {
      setIntraLoading(false);
    }
  };

  const fetchInterLeaderboard = async () => {
    setInterLoading(true);
    setInterError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filterScope && filterScope !== "all") {
        queryParams.append("scope", filterScope);
      }
      
      const response = await fetch(`/api/org/school/leaderboard/inter?${queryParams.toString()}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch inter-school leaderboard");
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        setInterData(result.data);
      } else {
        throw new Error(result.error || "Failed to load inter-school leaderboard");
      }
    } catch (err: any) {
      console.error("Failed to fetch inter leaderboard:", err);
      setInterError(err.message || "Failed to load inter-school leaderboard");
      toast.error("Failed to load inter-school leaderboard");
    } finally {
      setInterLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-sm font-medium text-gray-500">#{rank}</span>;
  };

  const getRankBgClass = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200";
    if (rank === 2) return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200";
    if (rank === 3) return "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200";
    return "bg-white border-gray-100";
  };

  const getScopeBadgeVariant = (scope: string | null) => {
    switch (scope) {
      case 'INTERNATIONAL':
        return 'default';
      case 'NATIONAL':
        return 'secondary';
      case 'STATE':
        return 'outline';
      case 'DISTRICT':
        return 'outline';
      case 'CITY':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getScopeBadgeColor = (scope: string | null) => {
    switch (scope) {
      case 'INTERNATIONAL':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'NATIONAL':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'STATE':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'DISTRICT':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'CITY':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  // Data for rendering
  const intraLeaderboard = intraData?.leaderboard || [];
  const intraFilters = intraData?.filters || { classes: [], houses: [] };
  const intraStats = intraData?.stats || { totalStudents: 0, topStudent: null, avgPoints: 0 };

  const interLeaderboard = interData?.leaderboard || [];
  const interStats = interData?.stats || { 
    totalParticipants: 0, 
    totalTournaments: 0, 
    topPerformer: null, 
    totalWins: 0, 
    totalPodiums: 0,
    scopeDistribution: {} 
  };

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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">School Leaderboard</h1>
                <p className="text-gray-500">Track student performance across internal and inter-school tournaments</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="intra" className="gap-2">
                <Users className="w-4 h-4" />
                Intra-School
              </TabsTrigger>
              <TabsTrigger value="inter" className="gap-2">
                <Globe className="w-4 h-4" />
                Inter-School
              </TabsTrigger>
            </TabsList>

            {/* INTRA-SCHOOL TAB */}
            <TabsContent value="intra">
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <p className="text-2xl font-bold text-gray-900">{intraStats.totalStudents}</p>
                    <p className="text-xs text-gray-500">Total Participants</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <Trophy className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                    <p className="text-2xl font-bold text-gray-900">
                      {intraLeaderboard.reduce((sum, e) => sum + e.tournamentsPlayed, 0)}
                    </p>
                    <p className="text-xs text-gray-500">Tournaments Played</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <p className="text-2xl font-bold text-gray-900">
                      {intraLeaderboard.reduce((sum, e) => sum + e.wins, 0)}
                    </p>
                    <p className="text-xs text-gray-500">Total Wins</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <Star className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                    <p className="text-2xl font-bold text-gray-900">
                      {intraStats.avgPoints.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">Avg Points</p>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card className="bg-white border-gray-100 shadow-sm mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Class:</span>
                        <Select value={filterClass} onValueChange={setFilterClass}>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="All Classes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Classes</SelectItem>
                            {intraFilters.classes.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">House:</span>
                        <Select value={filterHouse} onValueChange={setFilterHouse}>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="All Houses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Houses</SelectItem>
                            {intraFilters.houses.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Error State */}
              {intraError && (
                <Card className="border-red-200 bg-red-50 mb-6">
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                    <p className="text-red-600 mb-4">{intraError}</p>
                    <Button onClick={fetchIntraLeaderboard} variant="outline">
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Leaderboard */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                    Student Rankings
                  </CardTitle>
                  <CardDescription>Based on performance in internal tournaments</CardDescription>
                </CardHeader>
                <CardContent>
                  {intraLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : intraLeaderboard.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No leaderboard data yet</p>
                      <p className="text-sm">Students will appear here after participating in internal tournaments</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {intraLeaderboard.map((entry) => (
                        <div
                          key={entry.id}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-lg border transition-colors",
                            getRankBgClass(entry.rank)
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100">
                              {getRankIcon(entry.rank)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{entry.studentName}</p>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>{entry.className}</span>
                                {entry.houseName && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="outline" className="text-xs">
                                      {entry.houseName}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="text-lg font-bold text-gray-900">{entry.points.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">Points</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-semibold text-gray-700">{entry.tournamentsPlayed}</p>
                              <p className="text-xs text-gray-500">Events</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-semibold text-green-600">{entry.winRate}</p>
                              <p className="text-xs text-gray-500">Win Rate</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* INTER-SCHOOL TAB */}
            <TabsContent value="inter">
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <p className="text-2xl font-bold text-gray-900">{interStats.totalParticipants}</p>
                    <p className="text-xs text-gray-500">Representatives</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <Globe className="w-8 h-8 mx-auto mb-2 text-indigo-500" />
                    <p className="text-2xl font-bold text-gray-900">{interStats.totalTournaments}</p>
                    <p className="text-xs text-gray-500">Inter-School Events</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <Target className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <p className="text-2xl font-bold text-gray-900">{interStats.totalWins}</p>
                    <p className="text-xs text-gray-500">Total Wins</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <Award className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                    <p className="text-2xl font-bold text-gray-900">{interStats.totalPodiums}</p>
                    <p className="text-xs text-gray-500">Podium Finishes</p>
                  </CardContent>
                </Card>
              </div>

              {/* Scope Distribution */}
              {Object.keys(interStats.scopeDistribution).length > 0 && (
                <Card className="bg-white border-gray-100 shadow-sm mb-6">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Participation by Scope</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(interStats.scopeDistribution).map(([scope, count]) => (
                        <Badge 
                          key={scope} 
                          variant="outline" 
                          className={cn("text-xs", getScopeBadgeColor(scope))}
                        >
                          {scope}: {count}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Filters */}
              <Card className="bg-white border-gray-100 shadow-sm mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Scope:</span>
                      <Select value={filterScope} onValueChange={setFilterScope}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="All Scopes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Scopes</SelectItem>
                          <SelectItem value="CITY">City</SelectItem>
                          <SelectItem value="DISTRICT">District</SelectItem>
                          <SelectItem value="STATE">State</SelectItem>
                          <SelectItem value="NATIONAL">National</SelectItem>
                          <SelectItem value="INTERNATIONAL">International</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Error State */}
              {interError && (
                <Card className="border-red-200 bg-red-50 mb-6">
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                    <p className="text-red-600 mb-4">{interError}</p>
                    <Button onClick={fetchInterLeaderboard} variant="outline">
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Leaderboard */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <Globe className={cn("w-5 h-5", primaryTextClass)} />
                    Inter-School Representatives
                  </CardTitle>
                  <CardDescription>Students who represented the school in inter-school tournaments</CardDescription>
                </CardHeader>
                <CardContent>
                  {interLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : interLeaderboard.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No inter-school participation yet</p>
                      <p className="text-sm">Students will appear here after representing the school in inter-school tournaments</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[800px] overflow-y-auto">
                      {interLeaderboard.map((entry) => (
                        <div
                          key={entry.id}
                          className={cn(
                            "p-4 rounded-lg border transition-colors",
                            getRankBgClass(entry.rank)
                          )}
                        >
                          {/* Student Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100">
                                {getRankIcon(entry.rank)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{entry.studentName}</p>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <span>{entry.className}</span>
                                  {entry.houseName && (
                                    <>
                                      <span>•</span>
                                      <Badge variant="outline" className="text-xs">
                                        {entry.houseName}
                                      </Badge>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {entry.bestRank && entry.bestRank <= 3 && (
                                <Badge className={cn(
                                  "text-xs",
                                  entry.bestRank === 1 ? "bg-yellow-100 text-yellow-700" :
                                  entry.bestRank === 2 ? "bg-gray-100 text-gray-700" :
                                  "bg-amber-100 text-amber-700"
                                )}>
                                  Best: {entry.bestRank}${entry.bestRank === 1 ? 'st' : entry.bestRank === 2 ? 'nd' : 'rd'}
                                </Badge>
                              )}
                              {entry.podiumFinishes > 0 && (
                                <Badge className="bg-amber-100 text-amber-700 text-xs">
                                  <Award className="w-3 h-3 mr-1" />
                                  {entry.podiumFinishes} Podium{entry.podiumFinishes > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Stats Row */}
                          <div className="flex items-center gap-6 mb-3 pl-14">
                            <div className="text-center">
                              <p className="text-lg font-bold text-gray-900">{entry.totalPoints}</p>
                              <p className="text-xs text-gray-500">Points</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-semibold text-indigo-600">{entry.tournamentsCount}</p>
                              <p className="text-xs text-gray-500">Tournaments</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-semibold text-gray-700">{entry.totalMatches}</p>
                              <p className="text-xs text-gray-500">Matches</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-semibold text-green-600">{entry.wins}</p>
                              <p className="text-xs text-gray-500">Wins</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-semibold text-blue-600">{entry.winRateStr}</p>
                              <p className="text-xs text-gray-500">Win Rate</p>
                            </div>
                          </div>

                          {/* Tournament Details */}
                          {entry.tournaments.length > 0 && (
                            <div className="pl-14">
                              <p className="text-xs font-medium text-gray-500 mb-2">Tournaments:</p>
                              <div className="flex flex-wrap gap-2">
                                {entry.tournaments.map((tournament) => (
                                  <div
                                    key={tournament.id}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-50 border border-gray-200 text-xs"
                                  >
                                    <Badge 
                                      variant="outline" 
                                      className={cn("text-[10px] px-1.5 py-0", getScopeBadgeColor(tournament.scope))}
                                    >
                                      {tournament.scope || 'Inter-School'}
                                    </Badge>
                                    <span className="font-medium text-gray-700">{tournament.name}</span>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-500">{tournament.result}</span>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-500">
                                      {tournament.wins}/{tournament.matches} wins
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
