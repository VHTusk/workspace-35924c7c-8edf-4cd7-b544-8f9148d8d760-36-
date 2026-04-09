"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import OrganizationLayoutWrapper from "@/components/org/organization-layout-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Users,
  TrendingUp,
  Target,
  Flame,
  Award,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function IntraAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <OrganizationLayoutWrapper>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </OrganizationLayoutWrapper>
    );
  }

  const analytics = {
    overview: {
      totalEmployees: 0,
      activeParticipants: 0,
      totalMatches: 0,
      overallWinRate: 0,
      avgPoints: 0,
    },
    topPerformers: {
      byPoints: [] as Array<{ userId: string; name: string; points: number }>,
      byWinRate: [] as Array<{ userId: string; name: string; winRate: number }>,
      byStreak: [] as Array<{ userId: string; name: string; streak: number }>,
    },
  };

  return (
    <OrganizationLayoutWrapper>
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/org/home")}
          className="mb-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <BarChart3 className="w-4 h-4" />
          <span>Internal Analytics</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Internal Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400">Track internal sports performance and engagement</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4 text-center">
            <Users className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.totalEmployees}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Employees</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4 text-center">
            <Target className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.totalMatches}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Matches</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.overallWinRate}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Win Rate</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4 text-center">
            <Award className="w-6 h-6 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.avgPoints}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Avg Points</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Top by Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topPerformers.byPoints.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No data yet</p>
            ) : (
              <div className="space-y-2">
                {analytics.topPerformers.byPoints.map((player, i) => (
                  <div key={player.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-900 dark:text-white">{player.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{player.points}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Top Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topPerformers.byWinRate.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No data yet</p>
            ) : (
              <div className="space-y-2">
                {analytics.topPerformers.byWinRate.map((player, i) => (
                  <div key={player.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-900 dark:text-white">{player.name}</span>
                    </div>
                    <span className="text-sm font-medium text-emerald-600">{player.winRate}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Active Streaks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topPerformers.byStreak.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No data yet</p>
            ) : (
              <div className="space-y-2">
                {analytics.topPerformers.byStreak.map((player, i) => (
                  <div key={player.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-900 dark:text-white">{player.name}</span>
                    </div>
                    <span className="text-sm font-medium text-orange-500">{player.streak} 🔥</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 shadow-sm">
        <CardContent className="p-6 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-blue-600" />
          <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Analytics Coming Soon</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Start organizing intra tournaments and tracking employee participation to see detailed analytics here.
          </p>
        </CardContent>
      </Card>
    </OrganizationLayoutWrapper>
  );
}
