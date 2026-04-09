"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Trophy,
  Calendar,
  Users,
  Lock,
  ArrowRight,
  CreditCard,
  Loader2,
  Eye,
  Zap,
  Target,
  Award,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Tournament {
  id: string;
  name: string;
  type: string;
  status: string;
  startDate: string;
  endDate?: string;
  city?: string;
  maxParticipants: number;
  currentParticipants: number;
  prizePool?: number;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  wins: number;
  matches: number;
}

const SPORT_CONFIGS: Record<string, { name: string; icon: string; color: string; description: string }> = {
  cornhole: { name: "Cornhole", icon: "🎯", color: "bg-green-500", description: "Bag toss competition" },
  darts: { name: "Darts", icon: "🎯", color: "bg-teal-500", description: "Precision throwing" },
  badminton: { name: "Badminton", icon: "🏸", color: "bg-blue-500", description: "Racquet sport" },
  cricket: { name: "Cricket", icon: "🏏", color: "bg-orange-500", description: "Bat and ball game" },
  football: { name: "Football", icon: "⚽", color: "bg-emerald-500", description: "The beautiful game" },
  "table-tennis": { name: "Table Tennis", icon: "🏓", color: "bg-purple-500", description: "Ping pong" },
};

export default function SportExplorePage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const sportConfig = SPORT_CONFIGS[sport] || SPORT_CONFIGS.cornhole;

  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const isCornhole = sport === "cornhole";
  const primaryClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-100 dark:bg-green-900/30" : "bg-teal-100 dark:bg-teal-900/30";

  useEffect(() => {
    fetchExploreData();
  }, [sport]);

  const fetchExploreData = async () => {
    setLoading(true);
    try {
      // Fetch public tournaments for this sport
      const tournamentsResponse = await fetch(`/api/public/tournaments?sport=${sport.toUpperCase()}`);
      if (tournamentsResponse.ok) {
        const data = await tournamentsResponse.json();
        setTournaments(data.tournaments || []);
      }

      // Fetch public leaderboard for this sport
      const leaderboardResponse = await fetch(`/api/public/leaderboard?sport=${sport.toUpperCase()}`);
      if (leaderboardResponse.ok) {
        const data = await leaderboardResponse.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error("Failed to fetch explore data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = () => {
    router.push(`/${sport}/org/subscription`);
  };

  const handleGoBack = () => {
    router.push(`/${sport}/org/home`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        {/* Preview Banner */}
        <div className={cn("border-b", primaryBgClass)}>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl", sportConfig.color)}>
                  {sportConfig.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">{sportConfig.name}</h1>
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <Eye className="w-3 h-3 mr-1" /> Preview Mode
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">{sportConfig.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleGoBack}>
                  Back to Dashboard
                </Button>
                <Button className={cn("text-white", primaryClass)} onClick={handleSubscribe}>
                  <Zap className="w-4 h-4 mr-2" />
                  Subscribe to {sportConfig.name}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Locked Feature Banner */}
        <div className="px-6 py-4">
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Preview Mode - Subscribe to Unlock Full Access
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    You can view tournaments and leaderboards. Subscribe to {sportConfig.name} to access:
                    employee management, internal tournaments, squad creation, and corporate league participation.
                  </p>
                  <Button
                    className={cn("mt-3 text-white", primaryClass)}
                    size="sm"
                    onClick={handleSubscribe}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    View Subscription Plans
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="px-6 pb-6">
          <Tabs defaultValue="tournaments" className="space-y-4">
            <TabsList className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <TabsTrigger value="tournaments" className="gap-2">
                <Trophy className="w-4 h-4" />
                Tournaments
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="gap-2">
                <Award className="w-4 h-4" />
                Leaderboard
              </TabsTrigger>
              <TabsTrigger value="features" className="gap-2">
                <Zap className="w-4 h-4" />
                Features
              </TabsTrigger>
            </TabsList>

            {/* Tournaments Tab */}
            <TabsContent value="tournaments" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 bg-white dark:bg-gray-800 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                      Upcoming Tournaments
                    </CardTitle>
                    <CardDescription>
                      View-only mode - Subscribe to register your organization
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tournaments.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No upcoming tournaments</p>
                        <p className="text-sm">Check back later for new events</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tournaments.slice(0, 5).map((tournament) => (
                          <div key={tournament.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <div className="flex items-center gap-4">
                              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", primaryBgClass)}>
                                <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{tournament.name}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Calendar className="w-3 h-3" />
                                  <span>{new Date(tournament.startDate).toLocaleDateString()}</span>
                                  {tournament.city && <span>• {tournament.city}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className={
                                tournament.type === "INTER_ORG" ? "bg-purple-100 text-purple-700" :
                                tournament.type === "INTRA_ORG" ? "bg-blue-100 text-blue-700" :
                                "bg-gray-100 text-gray-600"
                              }>
                                {tournament.type === "INTER_ORG" ? "External" : tournament.type === "INTRA_ORG" ? "Internal" : tournament.type}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {tournament.currentParticipants}/{tournament.maxParticipants}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Tournament Types</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-800 dark:text-blue-200">Internal</span>
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Employee-only tournaments within your organization
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-purple-600" />
                        <span className="font-medium text-purple-800 dark:text-purple-200">External</span>
                      </div>
                      <p className="text-xs text-purple-700 dark:text-purple-300">
                        Corporate leagues with other organizations
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard" className="space-y-4">
              <Card className="bg-white dark:bg-gray-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className={cn("w-5 h-5", primaryTextClass)} />
                    Public Leaderboard
                  </CardTitle>
                  <CardDescription>
                    Top players in {sportConfig.name} - Subscribe to see your organization ranking
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No leaderboard data available</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg divide-y dark:border-gray-700">
                      {leaderboard.slice(0, 10).map((entry) => (
                        <div key={entry.rank} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                              entry.rank === 1 ? "bg-yellow-100 text-yellow-700" :
                              entry.rank === 2 ? "bg-gray-100 text-gray-600" :
                              entry.rank === 3 ? "bg-amber-100 text-amber-700" :
                              "bg-gray-50 text-gray-500"
                            )}>
                              {entry.rank}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{entry.name}</p>
                              <p className="text-xs text-gray-500">{entry.wins}W - {entry.matches - entry.wins}L</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900 dark:text-white">{entry.points.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">points</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-white dark:bg-gray-800 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      Internal Mode
                    </CardTitle>
                    <CardDescription>Employee sports within your organization</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>Manage employee roster</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Trophy className="w-4 h-4 text-gray-400" />
                      <span>Create internal tournaments</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Award className="w-4 h-4 text-gray-400" />
                      <span>Internal leaderboards</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <BarChart3 className="w-4 h-4 text-gray-400" />
                      <span>Department competitions</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-600" />
                      External Mode
                    </CardTitle>
                    <CardDescription>Corporate league participation</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>Contract player management</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Target className="w-4 h-4 text-gray-400" />
                      <span>Create rep squads</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Trophy className="w-4 h-4 text-gray-400" />
                      <span>Register for corporate leagues</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Award className="w-4 h-4 text-gray-400" />
                      <span>Inter-org rankings</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-dashed border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <CardContent className="p-6 text-center">
                  <Lock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Subscribe to Unlock All Features
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Get full access to Internal and External modes for {sportConfig.name}
                  </p>
                  <Button className={cn("text-white", primaryClass)} onClick={handleSubscribe}>
                    <CreditCard className="w-4 h-4 mr-2" />
                    View Subscription Plans
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
