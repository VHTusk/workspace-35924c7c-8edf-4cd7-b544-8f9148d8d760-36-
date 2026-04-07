"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Trophy,
  Medal,
  Crown,
  Loader2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ThirdPlaceDisplayProps {
  tournamentId: string;
  bracketFormat: string;
  sport: string;
}

interface PodiumPlace {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  city: string | null;
  visiblePoints: number;
  tier: string;
  bonusPoints: number;
}

export function ThirdPlaceDisplay({
  tournamentId,
  bracketFormat,
  sport,
}: ThirdPlaceDisplayProps) {
  const [loading, setLoading] = useState(true);
  const [podium, setPodium] = useState<PodiumPlace[]>([]);
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState<{
    id: string;
    playerA: { firstName: string; lastName: string } | null;
    playerB: { firstName: string; lastName: string } | null;
    scoreA: number | null;
    scoreB: number | null;
    winnerId: string | null;
    status: string;
  } | null>(null);

  const isCornhole = sport === "cornhole";
  const primaryColor = isCornhole ? "text-green-600" : "text-teal-600";

  useEffect(() => {
    fetchThirdPlaceData();
  }, [tournamentId]);

  const fetchThirdPlaceData = async () => {
    try {
      // Fetch tournament results
      const resultsRes = await fetch(`/api/tournaments/${tournamentId}/results`);
      if (resultsRes.ok) {
        const data = await resultsRes.json();
        setPodium(data.results || []);
      }

      // For single elimination, fetch third place match
      if (bracketFormat === "SINGLE_ELIMINATION") {
        const matchRes = await fetch(`/api/tournaments/${tournamentId}/third-place-match`);
        if (matchRes.ok) {
          const matchData = await matchRes.json();
          setThirdPlaceMatch(matchData.match);
        }
      }
    } catch (err) {
      console.error("Failed to fetch third place data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  const thirdPlace = podium.find(p => p.rank === 3);

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      DIAMOND: "bg-purple-100 text-purple-700",
      PLATINUM: "bg-cyan-100 text-cyan-700",
      GOLD: "bg-amber-100 text-amber-700",
      SILVER: "bg-gray-200 text-gray-700",
      BRONZE: "bg-orange-100 text-orange-700",
      UNRANKED: "bg-gray-100 text-gray-500",
    };
    return colors[tier] || colors.UNRANKED;
  };

  const getPlaceColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-300";
      case 2:
        return "bg-gradient-to-r from-gray-100 to-slate-100 border-gray-300";
      case 3:
        return "bg-gradient-to-r from-orange-100 to-amber-100 border-orange-300";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getPlaceIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-amber-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-orange-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Third Place Match (Single Elimination only) */}
      {bracketFormat === "SINGLE_ELIMINATION" && thirdPlaceMatch && (
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Medal className="w-5 h-5 text-orange-500" />
              Third Place Match
            </CardTitle>
            <p className="text-sm text-gray-500">
              Semifinal losers compete for 3rd place
            </p>
          </CardHeader>
          <CardContent>
            {thirdPlaceMatch.status === "PENDING" ? (
              <div className="text-center py-4 text-gray-500">
                <p>Match not yet played</p>
                {thirdPlaceMatch.playerA && thirdPlaceMatch.playerB && (
                  <p className="text-sm mt-2">
                    {thirdPlaceMatch.playerA.firstName} vs {thirdPlaceMatch.playerB.firstName}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="font-medium">
                    {thirdPlaceMatch.playerA?.firstName} {thirdPlaceMatch.playerA?.lastName}
                  </p>
                  <p className="text-2xl font-bold">{thirdPlaceMatch.scoreA}</p>
                </div>
                <div className="text-gray-400 font-medium">vs</div>
                <div className="text-center">
                  <p className="font-medium">
                    {thirdPlaceMatch.playerB?.firstName} {thirdPlaceMatch.playerB?.lastName}
                  </p>
                  <p className="text-2xl font-bold">{thirdPlaceMatch.scoreB}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Double Elimination Note */}
      {bracketFormat === "DOUBLE_ELIMINATION" && (
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Medal className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Third Place Determination</p>
                <p className="text-sm text-gray-600">
                  In double elimination format, the loser of the loser's bracket final 
                  automatically becomes the third-place finisher. No additional match required.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Round Robin Note */}
      {bracketFormat === "ROUND_ROBIN" && (
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Third Place Determination</p>
                <p className="text-sm text-gray-600">
                  In round robin format, final standings determine 1st, 2nd, and 3rd place. 
                  Tiebreakers: head-to-head result → point differential → total points scored.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Podium Display */}
      {podium.length > 0 && (
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className={cn("w-5 h-5", primaryColor)} />
              Final Standings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {podium.map((place) => (
                <div
                  key={place.userId}
                  className={cn(
                    "p-4 rounded-lg border",
                    getPlaceColor(place.rank)
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getPlaceIcon(place.rank)}
                        <span className="text-lg font-bold text-gray-900">
                          #{place.rank}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {place.firstName} {place.lastName}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          {place.city && <span>{place.city}</span>}
                          <Badge className={getTierBadge(place.tier)}>
                            {place.tier}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        +{place.bonusPoints}
                      </p>
                      <p className="text-xs text-gray-500">bonus pts</p>
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
