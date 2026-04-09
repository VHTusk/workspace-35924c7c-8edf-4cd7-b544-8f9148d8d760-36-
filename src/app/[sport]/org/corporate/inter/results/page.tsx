"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import OrganizationLayoutWrapper from "@/components/org/organization-layout-wrapper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  ArrowLeft,
  Loader2,
  Shield,
  Medal,
  Target,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";


interface Result {
  id: string;
  tournamentId: string;
  tournamentName: string;
  tournamentDate: string;
  squadId: string;
  squadName: string;
  position: number;
  totalParticipants: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  prizeWon?: number;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function InterResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  useEffect(() => {
    fetchOrg();
    fetchResults();
  }, [sport]);

  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      const orgResponse = await fetch("/api/org/me");
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        const response = await fetch(`/api/orgs/${orgData.id}/inter-results?sport=${sport.toUpperCase()}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch results:", err);
    } finally {
      setLoading(false);
    }
  };

  const getPositionBadge = (position: number) => {
    if (position === 1) {
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">🥇 1st Place</Badge>;
    } else if (position === 2) {
      return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">🥈 2nd Place</Badge>;
    } else if (position === 3) {
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">🥉 3rd Place</Badge>;
    } else if (position <= 10) {
      return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Top 10</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">#{position}</Badge>;
  };

  const wins = results.reduce((acc, r) => acc + r.wins, 0);
  const losses = results.reduce((acc, r) => acc + r.losses, 0);
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const podiumFinishes = results.filter((r) => r.position <= 3).length;
  const totalPrize = results.reduce((acc, r) => acc + (r.prizeWon || 0), 0);

  return (
    <OrganizationLayoutWrapper>
      <div className="space-y-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(`/${sport}/org/corporate/inter`)}
              className="mb-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <Shield className="w-4 h-4" />
                <span>External</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Results & Performance</h1>
              <p className="text-gray-500 dark:text-gray-400">Track your squad performance in inter-corporate tournaments</p>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{podiumFinishes}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Podium Finishes</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{winRate}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Win Rate</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Target className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{wins}W - {losses}L</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Overall Record</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Medal className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">₹{totalPrize.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Prizes Won</p>
              </CardContent>
            </Card>
          </div>

          {/* Results List */}
          <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <Medal className="w-5 h-5" />
                Tournament Results
              </CardTitle>
              <CardDescription>Performance history in inter-corporate tournaments</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Medal className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No tournament results yet</p>
                  <p className="text-sm">Results will appear after your squads participate in tournaments</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-colors cursor-pointer"
                      onClick={() => router.push(`/${sport}/tournaments/${result.tournamentId}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-lg flex items-center justify-center",
                          result.position === 1 ? "bg-yellow-50 dark:bg-yellow-950/30" :
                          result.position === 2 ? "bg-gray-50 dark:bg-gray-800" :
                          result.position === 3 ? "bg-amber-50 dark:bg-amber-950/30" :
                          primaryBgClass
                        )}>
                          {result.position <= 3 ? (
                            <Trophy className={cn(
                              "w-6 h-6",
                              result.position === 1 ? "text-yellow-500" :
                              result.position === 2 ? "text-gray-400" :
                              "text-amber-600"
                            )} />
                          ) : (
                            <Medal className={cn("w-6 h-6", primaryTextClass)} />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{result.tournamentName}</p>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(result.tournamentDate).toLocaleDateString()}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              {result.squadName}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            W:{result.wins} L:{result.losses}
                          </p>
                          {result.prizeWon && result.prizeWon > 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              ₹{result.prizeWon.toLocaleString()} won
                            </p>
                          )}
                        </div>
                        {getPositionBadge(result.position)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </OrganizationLayoutWrapper>
  );
}
