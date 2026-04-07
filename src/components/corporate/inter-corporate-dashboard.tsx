"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Users2,
  Target,
  Medal,
  ArrowRight,
  Plus,
  Loader2,
  AlertCircle,
  Trophy,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RepSquad {
  id: string;
  name: string;
  status: string;
  playerCount: number;
  contractPlayerCount: number;
  wins: number;
  losses: number;
  tournamentsParticipated: number;
}

interface InterDashboardData {
  totalSquads: number;
  totalRepPlayers: number;
  contractPlayers: number;
  activeRegistrations: number;
  squads: RepSquad[];
}

interface InterCorporateDashboardProps {
  orgId: string;
}

export function InterCorporateDashboard({ orgId }: InterCorporateDashboardProps) {
  const router = useRouter();
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InterDashboardData | null>(null);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchDashboardData();
  }, [orgId, sport]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orgs/${orgId}/corporate-dashboard?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const result = await response.json();
        setData({
          totalSquads: result.competitiveRepresentation?.totalSquads || 0,
          totalRepPlayers: result.competitiveRepresentation?.totalRepPlayers || 0,
          contractPlayers: result.competitiveRepresentation?.contractPlayers || 0,
          activeRegistrations: result.competitiveRepresentation?.activeRegistrations || 0,
          squads: result.competitiveRepresentation?.squads || [],
        });
      }
    } catch (err) {
      console.error("Failed to fetch inter dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Failed to load dashboard data</p>
      </div>
    );
  }

  const winRate = data.squads.length > 0
    ? Math.round((data.squads.reduce((acc, s) => acc + s.wins, 0) / 
        (data.squads.reduce((acc, s) => acc + s.wins + s.losses, 0) || 1)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.totalSquads}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Rep Squads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", primaryBgClass)}>
                <Users2 className={cn("w-5 h-5", primaryTextClass)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.totalRepPlayers}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Rep Players</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.contractPlayers}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Contract Players</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.activeRegistrations}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Active Registrations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Overview */}
      <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-gray-900 dark:text-white">Squad Performance</CardTitle>
          <CardDescription>Overall win rate across all squads</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Win Rate</span>
                <span className="font-medium text-gray-900 dark:text-white">{winRate}%</span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all", primaryBtnClass)}
                  style={{ width: `${winRate}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <p className="text-xl font-bold text-green-600">
                  {data.squads.reduce((acc, s) => acc + s.wins, 0)}
                </p>
                <p className="text-xs text-green-600/80">Wins</p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <p className="text-xl font-bold text-red-600">
                  {data.squads.reduce((acc, s) => acc + s.losses, 0)}
                </p>
                <p className="text-xs text-red-600/80">Losses</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Quick Actions</CardTitle>
          <CardDescription>Manage your External activities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className={cn("w-full text-white", primaryBtnClass)}
            onClick={() => router.push(`/${sport}/org/corporate/inter/squads`)}
          >
            <Shield className="w-4 h-4 mr-2" />
            Manage Rep Squads
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Button>
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => router.push(`/${sport}/org/corporate/inter/tournaments`)}
          >
            <span className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              External Tournaments
            </span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => router.push(`/${sport}/org/corporate/inter/results`)}
          >
            <span className="flex items-center gap-2">
              <Medal className="w-4 h-4" />
              Results & Performance
            </span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Active Squads */}
      <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-gray-900 dark:text-white">Rep Squads</CardTitle>
            <CardDescription>Your competitive representation squads</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push(`/${sport}/org/corporate/inter/squads`)}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {data.squads.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No squads created yet</p>
              <Button
                variant="link"
                className={cn("mt-2", primaryTextClass)}
                onClick={() => router.push(`/${sport}/org/corporate/inter/squads`)}
              >
                Create your first squad
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {data.squads.slice(0, 4).map((squad) => (
                <div
                  key={squad.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-colors cursor-pointer"
                  onClick={() => router.push(`/${sport}/org/corporate/inter/squads/${squad.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{squad.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {squad.playerCount} players • {squad.contractPlayerCount} contract
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={squad.status === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}>
                      {squad.status}
                    </Badge>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      W:{squad.wins} L:{squad.losses}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Registrations Alert */}
      {data.activeRegistrations > 0 && (
        <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-purple-600" />
              <div>
                <p className="font-medium text-purple-800 dark:text-purple-200">Active Registrations</p>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  You have {data.activeRegistrations} active inter-corporate tournament registration(s)
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300"
                onClick={() => router.push(`/${sport}/org/corporate/inter/tournaments`)}
              >
                View
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
