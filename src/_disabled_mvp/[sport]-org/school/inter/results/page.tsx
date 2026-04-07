"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  ArrowLeft,
  Loader2,
  Shield,
  TrendingUp,
  Medal,
  Calendar,
  Users,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TournamentResult {
  id: string;
  tournamentId: string;
  tournamentName: string;
  tournamentScope: string;
  completedAt: string;
  teamId: string;
  teamName: string;
  position: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  points: number;
  medal?: "GOLD" | "SILVER" | "BRONZE";
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
  const [org, setOrg] = useState<OrgData | null>(null);
  const [results, setResults] = useState<TournamentResult[]>([]);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  useEffect(() => {
    fetchOrg();
  }, [sport]);

  useEffect(() => {
    if (org?.id) {
      fetchResults();
    }
  }, [org?.id, sport]);

  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
        if (data.type !== "SCHOOL") {
          router.push(`/${sport}/org/home`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/orgs/${org?.id}/inter-results?sport=${sport.toUpperCase()}&type=SCHOOL`
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      }
    } catch (err) {
      console.error("Failed to fetch results:", err);
    } finally {
      setLoading(false);
    }
  };

  const getMedalIcon = (medal?: string) => {
    switch (medal) {
      case "GOLD":
        return <Medal className="w-5 h-5 text-yellow-500" />;
      case "SILVER":
        return <Medal className="w-5 h-5 text-gray-400" />;
      case "BRONZE":
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getMedalBadgeClass = (medal?: string) => {
    switch (medal) {
      case "GOLD":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "SILVER":
        return "bg-gray-100 text-gray-700 border-gray-200";
      case "BRONZE":
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-gray-50 text-gray-600";
    }
  };

  const getPositionLabel = (position: number) => {
    if (position === 1) return "1st";
    if (position === 2) return "2nd";
    if (position === 3) return "3rd";
    return `${position}th`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const totalMedals = {
    gold: results.filter((r) => r.medal === "GOLD").length,
    silver: results.filter((r) => r.medal === "SILVER").length,
    bronze: results.filter((r) => r.medal === "BRONZE").length,
  };

  const totalPoints = results.reduce((sum, r) => sum + r.points, 0);

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/${sport}/org/school/inter`)}
            className="mb-2 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Shield className="w-4 h-4" />
              <span>Inter-School</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Results</h1>
            <p className="text-gray-500">Past performances in inter-school tournaments</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Trophy className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
              <p className="text-2xl font-bold text-gray-900">{results.length}</p>
              <p className="text-xs text-gray-500">Tournaments</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Medal className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold text-gray-900">{totalMedals.gold}</p>
              <p className="text-xs text-gray-500">Gold</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Medal className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-2xl font-bold text-gray-900">{totalMedals.silver}</p>
              <p className="text-xs text-gray-500">Silver</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Medal className="w-8 h-8 mx-auto mb-2 text-amber-600" />
              <p className="text-2xl font-bold text-gray-900">{totalMedals.bronze}</p>
              <p className="text-xs text-gray-500">Bronze</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-gray-900">{totalPoints}</p>
              <p className="text-xs text-gray-500">Total Points</p>
            </CardContent>
          </Card>
        </div>

        {/* Results List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : results.length === 0 ? (
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-12 text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No results yet</h3>
              <p className="text-gray-500">
                Your school&apos;s inter-school tournament results will appear here
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push(`/${sport}/org/school/inter/tournaments`)}
              >
                Browse Tournaments
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Tournament Results
              </CardTitle>
              <CardDescription>Your school&apos;s performance history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg divide-y">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/${sport}/tournaments/${result.tournamentId}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10">
                        {getMedalIcon(result.medal)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{result.tournamentName}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            {result.teamName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(result.completedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <Badge className={getMedalBadgeClass(result.medal)}>
                            {getPositionLabel(result.position)}
                          </Badge>
                          <span className="font-bold text-gray-900">{result.points} pts</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          W:{result.matchesWon} L:{result.matchesLost}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
