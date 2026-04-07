"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import OrganizationLayoutWrapper from "@/components/org/organization-layout-wrapper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  ArrowLeft,
  Loader2,
  Building2,
  Award,
  Medal,
  Crown,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";


interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  city?: string;
  department: string;
  points: number;
  elo: number;
  matches: number;
  wins: number;
  tournaments: number;
  isVerified: boolean;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function IntraLeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  useEffect(() => {
    fetchData();
  }, [sport]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch org info
      const orgResponse = await fetch("/api/org/me", { credentials: "include" });
      if (!orgResponse.ok) {
        if (orgResponse.status === 401) {
          router.push("/org/login");
          return;
        }
        throw new Error("Failed to fetch organization data");
      }
      const orgData = await orgResponse.json();
      setOrg(orgData);

      // Fetch leaderboard using the correct API route
      const leaderboardResponse = await fetch(
        `/api/org/corporate/leaderboard?type=intra&sport=${sport.toUpperCase()}`,
        { credentials: "include" }
      );

      if (!leaderboardResponse.ok) {
        throw new Error("Failed to fetch leaderboard data");
      }

      const result = await leaderboardResponse.json();
      
      if (result.success && result.data?.leaderboard) {
        setLeaderboard(result.data.leaderboard);
      } else {
        setLeaderboard([]);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="text-sm font-medium text-gray-500">{rank}</span>;
    }
  };

  const getRankBadgeClass = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
      case 2:
        return "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700";
      case 3:
        return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
      default:
        return "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700";
    }
  };

  const getWinRate = (wins: number, matches: number) => {
    if (matches === 0) return 0;
    return Math.round((wins / matches) * 100);
  };

  const getLosses = (matches: number, wins: number) => {
    return matches - wins;
  };

  return (
    <OrganizationLayoutWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/${sport}/org/corporate/intra`)}
            className="mb-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <Building2 className="w-4 h-4" />
              <span>Internal</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leaderboard</h1>
            <p className="text-gray-500 dark:text-gray-400">Employee rankings based on internal tournament performance</p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={fetchData}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Top 3 Podium */}
            {leaderboard.length >= 3 && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* 2nd Place */}
                <div className="pt-8">
                  <Card className={cn("text-center border-2", getRankBadgeClass(2))}>
                    <CardContent className="p-4">
                      <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <Medal className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white truncate">{leaderboard[1]?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{leaderboard[1]?.department}</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mt-2">{leaderboard[1]?.points} pts</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        W:{leaderboard[1]?.wins} L:{getLosses(leaderboard[1]?.matches || 0, leaderboard[1]?.wins || 0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                {/* 1st Place */}
                <div>
                  <Card className={cn("text-center border-2 border-yellow-400 dark:border-yellow-600", getRankBadgeClass(1))}>
                    <CardContent className="p-4">
                      <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                        <Crown className="w-10 h-10 text-yellow-500" />
                      </div>
                      <p className="font-bold text-gray-900 dark:text-white truncate">{leaderboard[0]?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{leaderboard[0]?.department}</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white mt-2">{leaderboard[0]?.points} pts</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        W:{leaderboard[0]?.wins} L:{getLosses(leaderboard[0]?.matches || 0, leaderboard[0]?.wins || 0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                {/* 3rd Place */}
                <div className="pt-12">
                  <Card className={cn("text-center border-2", getRankBadgeClass(3))}>
                    <CardContent className="p-4">
                      <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Medal className="w-7 h-7 text-amber-600" />
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white truncate">{leaderboard[2]?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{leaderboard[2]?.department}</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mt-2">{leaderboard[2]?.points} pts</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        W:{leaderboard[2]?.wins} L:{getLosses(leaderboard[2]?.matches || 0, leaderboard[2]?.wins || 0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Leaderboard Table */}
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Full Leaderboard
                </CardTitle>
                <CardDescription>All employee rankings from intra-corporate tournaments</CardDescription>
              </CardHeader>
              <CardContent>
                {leaderboard.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No leaderboard data yet</p>
                    <p className="text-sm">Employee rankings will appear after tournaments are completed</p>
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y dark:border-gray-700 dark:divide-gray-700">
                    {leaderboard.map((entry) => (
                      <div
                        key={entry.id}
                        className={cn(
                          "flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50",
                          entry.rank <= 3 && getRankBadgeClass(entry.rank)
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 flex items-center justify-center">
                            {getRankIcon(entry.rank)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{entry.name}</p>
                            {entry.department && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{entry.department}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="font-bold text-gray-900 dark:text-white">{entry.points} pts</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{entry.tournaments} events</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-900 dark:text-white">W:{entry.wins} L:{getLosses(entry.matches, entry.wins)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{getWinRate(entry.wins, entry.matches)}% win rate</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </OrganizationLayoutWrapper>
  );
}
