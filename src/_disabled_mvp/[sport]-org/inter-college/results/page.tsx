"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Calendar,
  MapPin,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Users,
  Medal,
  Shield,
  LayoutDashboard,
  Award,
  ExternalLink,
  TrendingUp,
  BarChart3,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Organization {
  id: string;
  name: string;
  type: string;
  email?: string;
  city?: string;
  state?: string;
  logoUrl?: string;
}

interface TournamentResult {
  id: string;
  tournamentId: string;
  tournamentName: string;
  tournamentScope: string;
  startDate: string;
  endDate?: string;
  location?: string;
  city?: string;
  state?: string;
  totalParticipants: number;
  totalTeams: number;
  ourTeamName: string;
  ourTeamId: string;
  finalPosition: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  pointsEarned: number;
  prize?: number;
  participants: {
    position: number;
    teamName: string;
    collegeName: string;
    points?: number;
  }[];
}

interface PerformanceStats {
  totalTournaments: number;
  tournamentsWon: number;
  tournamentsPodium: number;
  totalMatches: number;
  matchesWon: number;
  winRate: number;
  totalPoints: number;
  avgPosition: number;
  bestPosition: number;
  recentForm: string;
}

interface ResultsData {
  results: TournamentResult[];
  stats: PerformanceStats;
}

export default function InterCollegeResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [org, setOrg] = useState<Organization | null>(null);

  // Results data
  const [results, setResults] = useState<TournamentResult[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Theme classes
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";

  useEffect(() => {
    fetchOrgAndResults();
  }, [sport]);

  const fetchOrgAndResults = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch organization data
      const orgResponse = await fetch("/api/org/me");
      if (!orgResponse.ok) {
        throw new Error("Failed to fetch organization data");
      }
      const orgData = await orgResponse.json();
      setOrg(orgData);

      // Verify it's a COLLEGE type organization
      if (orgData.type !== "COLLEGE") {
        // Redirect to org home for sport selection
        router.push("/org/home");
        return;
      }

      // Fetch tournament results
      const resultsResponse = await fetch(
        `/api/tournaments?sport=${sport.toUpperCase()}&status=COMPLETED&scope=INTER_COLLEGE&orgId=${orgData.id}`
      );

      if (resultsResponse.ok) {
        const data: ResultsData = await resultsResponse.json();
        setResults(data.results || []);
        setStats(data.stats || getDefaultStats());
      } else {
        // Use mock data if API fails
        setResults(getMockResults(orgData.name));
        setStats(getDefaultStats());
      }

    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load results. Please try again.");
      // Use mock data on error
      setResults(getMockResults(org?.name));
      setStats(getDefaultStats());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultStats = (): PerformanceStats => ({
    totalTournaments: 0,
    tournamentsWon: 0,
    tournamentsPodium: 0,
    totalMatches: 0,
    matchesWon: 0,
    winRate: 0,
    totalPoints: 0,
    avgPosition: 0,
    bestPosition: 0,
    recentForm: "-",
  });

  const getMockResults = (orgName?: string): TournamentResult[] => [
    {
      id: "1",
      tournamentId: "t1",
      tournamentName: "University Championship 2024",
      tournamentScope: "STATE",
      startDate: "2024-03-15",
      endDate: "2024-03-17",
      location: "State Sports Complex",
      city: "Mumbai",
      state: "Maharashtra",
      totalParticipants: 32,
      totalTeams: 32,
      ourTeamName: "College A Team",
      ourTeamId: "team1",
      finalPosition: 1,
      matchesPlayed: 5,
      matchesWon: 5,
      matchesLost: 0,
      pointsEarned: 500,
      prize: 50000,
      participants: [
        { position: 1, teamName: "College A Team", collegeName: orgName || "Our College", points: 500 },
        { position: 2, teamName: "College B Team", collegeName: "Rival College" },
        { position: 3, teamName: "College C Team", collegeName: "Third College" },
      ],
    },
    {
      id: "2",
      tournamentId: "t2",
      tournamentName: "Inter-College Zonal 2024",
      tournamentScope: "DISTRICT",
      startDate: "2024-02-20",
      endDate: "2024-02-22",
      location: "District Ground",
      city: "Pune",
      state: "Maharashtra",
      totalParticipants: 24,
      totalTeams: 24,
      ourTeamName: "College A Team",
      ourTeamId: "team1",
      finalPosition: 2,
      matchesPlayed: 4,
      matchesWon: 3,
      matchesLost: 1,
      pointsEarned: 300,
      prize: 25000,
      participants: [
        { position: 1, teamName: "Rival Team", collegeName: "Rival College", points: 400 },
        { position: 2, teamName: "College A Team", collegeName: orgName || "Our College", points: 300 },
        { position: 3, teamName: "Other Team", collegeName: "Third College" },
      ],
    },
    {
      id: "3",
      tournamentId: "t3",
      tournamentName: "National University Games 2023",
      tournamentScope: "NATIONAL",
      startDate: "2023-12-10",
      endDate: "2023-12-15",
      location: "National Stadium",
      city: "Delhi",
      state: "Delhi",
      totalParticipants: 64,
      totalTeams: 64,
      ourTeamName: "College A Team",
      ourTeamId: "team1",
      finalPosition: 3,
      matchesPlayed: 6,
      matchesWon: 4,
      matchesLost: 2,
      pointsEarned: 200,
      prize: 15000,
      participants: [
        { position: 1, teamName: "Top University", collegeName: "Top University", points: 600 },
        { position: 2, teamName: "Runner Up", collegeName: "Second University", points: 450 },
        { position: 3, teamName: "College A Team", collegeName: orgName || "Our College", points: 200 },
      ],
    },
  ];

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format short date
  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Get position badge
  const getPositionBadge = (position: number) => {
    if (position === 1) {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 gap-1">
          <Trophy className="w-3 h-3" />
          1st Place
        </Badge>
      );
    }
    if (position === 2) {
      return (
        <Badge className="bg-gray-100 text-gray-700 gap-1">
          <Medal className="w-3 h-3" />
          2nd Place
        </Badge>
      );
    }
    if (position === 3) {
      return (
        <Badge className="bg-orange-100 text-orange-700 gap-1">
          <Medal className="w-3 h-3" />
          3rd Place
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-600">
        #{position}
      </Badge>
    );
  };

  // Get scope badge
  const getScopeBadge = (scope: string) => {
    const styles: Record<string, string> = {
      CITY: "bg-blue-100 text-blue-700",
      DISTRICT: "bg-green-100 text-green-700",
      STATE: "bg-purple-100 text-purple-700",
      NATIONAL: "bg-amber-100 text-amber-700",
    };
    return (
      <Badge className={styles[scope] || "bg-gray-100 text-gray-700"}>
        {scope}
      </Badge>
    );
  };

  // Render result card
  const renderResultCard = (result: TournamentResult) => {
    return (
      <Card key={result.id} className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">{result.tournamentName}</h3>
                {getScopeBadge(result.tournamentScope)}
              </div>
              <p className="text-sm text-gray-500">
                Team: <span className="font-medium text-gray-700">{result.ourTeamName}</span>
              </p>
            </div>
            {getPositionBadge(result.finalPosition)}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Date */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>{formatShortDate(result.startDate)}</span>
              {result.endDate && (
                <span className="text-gray-400">- {formatShortDate(result.endDate)}</span>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="truncate">
                {result.location || result.city || "TBD"}
                {result.state && `, ${result.state}`}
              </span>
            </div>

            {/* Match Record */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Target className="w-4 h-4 text-gray-400" />
              <span>
                {result.matchesWon}W - {result.matchesLost}L
                <span className="text-gray-400 ml-1">({result.matchesPlayed} matches)</span>
              </span>
            </div>

            {/* Participants */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4 text-gray-400" />
              <span>{result.totalTeams} teams participated</span>
            </div>
          </div>

          {/* Points & Prize */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="font-medium text-green-600">+{result.pointsEarned} pts</span>
            </div>
            {result.prize && result.prize > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Award className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-amber-600">₹{result.prize.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Top 3 Podium */}
          {result.participants && result.participants.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-500 mb-2">Podium Finishers</p>
              <div className="flex items-center gap-2">
                {result.participants.slice(0, 3).map((p, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 p-2 rounded-lg text-center text-xs",
                      p.teamName === result.ourTeamName ? "bg-green-50 border border-green-200" : "bg-gray-50"
                    )}
                  >
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {i === 0 && <Trophy className="w-3 h-3 text-yellow-500" />}
                      {i === 1 && <Medal className="w-3 h-3 text-gray-400" />}
                      {i === 2 && <Medal className="w-3 h-3 text-orange-400" />}
                      <span className="font-medium text-gray-700">{p.position}</span>
                    </div>
                    <p className="font-medium text-gray-900 truncate">{p.teamName}</p>
                    <p className="text-gray-500 truncate">{p.collegeName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/${sport}/tournaments/${result.tournamentId}`)}
            >
              View Details
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${sport}/teams/${result.ourTeamId}`)}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Team Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state
  if (error && !org) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
          <Button onClick={fetchOrgAndResults} variant="outline" className="mt-4">
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  // Filter results by time period
  const filterResultsByTab = (tab: string) => {
    const now = new Date();
    const thisYear = now.getFullYear();
    
    switch (tab) {
      case "this_year":
        return results.filter(r => new Date(r.startDate).getFullYear() === thisYear);
      case "last_year":
        return results.filter(r => new Date(r.startDate).getFullYear() === thisYear - 1);
      default:
        return results;
    }
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
              onClick={() => router.push(`/${sport}/org/college-dashboard`)}
              className="mb-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Results & History</h1>
                <p className="text-gray-500">Past tournament performances and achievements</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn("text-xs", primaryBgClass, primaryTextClass)}>
                  {sport.toUpperCase()}
                </Badge>
                <Badge className="bg-indigo-100 text-indigo-700">Inter-College</Badge>
              </div>
            </div>
          </div>

          {/* Horizontal Navbar */}
          <div className="mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-0">
                <nav className="flex items-center gap-1 px-2 py-1">
                  <Link
                    href={`/${sport}/org/college-dashboard`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Link>
                  <Link
                    href={`/${sport}/org/college-teams`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Shield className="w-4 h-4" />
                    College Teams
                  </Link>
                  <Link
                    href={`/${sport}/org/inter-college/tournaments`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Trophy className="w-4 h-4" />
                    Tournaments
                  </Link>
                  <Link
                    href={`/${sport}/org/inter-college/results`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      primaryBgClass, primaryTextClass
                    )}
                  >
                    <Medal className="w-4 h-4" />
                    Results
                  </Link>
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Performance Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Trophy className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                  <p className="text-2xl font-bold text-gray-900">{stats.totalTournaments}</p>
                  <p className="text-xs text-gray-500">Tournaments</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Medal className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                  <p className="text-2xl font-bold text-gray-900">{stats.tournamentsWon}</p>
                  <p className="text-xs text-gray-500">Wins</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Award className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  <p className="text-2xl font-bold text-gray-900">{stats.tournamentsPodium}</p>
                  <p className="text-xs text-gray-500">Podiums</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold text-gray-900">{stats.winRate}%</p>
                  <p className="text-xs text-gray-500">Win Rate</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPoints.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Total Points</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Results Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all" className="gap-2">
                <Trophy className="w-4 h-4" />
                All Time
                {results.length > 0 && (
                  <Badge className="ml-1 bg-gray-100 text-gray-700 text-xs">
                    {results.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="this_year" className="gap-2">
                <Calendar className="w-4 h-4" />
                This Year
              </TabsTrigger>
              <TabsTrigger value="last_year" className="gap-2">
                <Calendar className="w-4 h-4" />
                Last Year
              </TabsTrigger>
            </TabsList>

            {/* All Time Tab */}
            <TabsContent value="all">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Tournament History</CardTitle>
                  <CardDescription>
                    Complete history of inter-college tournament participations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {results.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No tournament history yet</p>
                      <p className="text-sm">Your completed tournaments will appear here</p>
                      <Button
                        className={cn("text-white mt-4", primaryBtnClass)}
                        onClick={() => router.push(`/${sport}/org/inter-college/tournaments`)}
                      >
                        Browse Tournaments
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {results.map((result) => renderResultCard(result))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* This Year Tab */}
            <TabsContent value="this_year">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">This Year&apos;s Results</CardTitle>
                  <CardDescription>
                    Inter-college tournaments completed in {new Date().getFullYear()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filterResultsByTab("this_year").length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No results this year</p>
                      <p className="text-sm">Tournaments from {new Date().getFullYear()} will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filterResultsByTab("this_year").map((result) => renderResultCard(result))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Last Year Tab */}
            <TabsContent value="last_year">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">{new Date().getFullYear() - 1} Results</CardTitle>
                  <CardDescription>
                    Inter-college tournaments completed last year
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filterResultsByTab("last_year").length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No results from last year</p>
                      <p className="text-sm">Tournaments from {new Date().getFullYear() - 1} will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filterResultsByTab("last_year").map((result) => renderResultCard(result))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Stats Summary Card */}
          {results.length > 0 && (
            <Card className={cn("mt-6 border", primaryBorderClass)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", primaryBgClass)}>
                    <BarChart3 className={cn("w-5 h-5", primaryTextClass)} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">Performance Summary</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {stats && (
                        <>
                          Participated in <strong>{stats.totalTournaments}</strong> inter-college tournaments
                          with <strong>{stats.tournamentsWon}</strong> wins and <strong>{stats.tournamentsPodium}</strong> podium finishes.
                          Overall win rate: <strong>{stats.winRate}%</strong>.
                          {stats.bestPosition === 1 && " Best result: Tournament Winner!"}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
