"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Radio,
  Trophy,
  Users,
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveMatch {
  id: string;
  tournamentId: string;
  tournamentName: string;
  sport: string;
  roundNumber: number;
  matchNumber: number;
  playerA: { id: string; name: string };
  playerB: { id: string; name: string };
  scoreA: number | null;
  scoreB: number | null;
  status: "LIVE" | "PENDING" | "COMPLETED";
  winnerId: string | null;
  courtAssignment: string | null;
  updatedAt: string;
}

interface LiveScoreTickerProps {
  sport: string;
  maxItems?: number;
  showHeader?: boolean;
  compact?: boolean;
}

export function LiveScoreTicker({
  sport,
  maxItems = 5,
  showHeader = true,
  compact = false,
}: LiveScoreTickerProps) {
  const params = useParams();
  const currentSport = sport || (params?.sport as string) || "cornhole";
  const isCornhole = currentSport === "cornhole";
  const primaryClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // PERFORMANCE: Memoize fetchLiveMatches to prevent unnecessary re-renders
  const fetchLiveMatches = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/public/live-matches?sport=${currentSport.toUpperCase()}&limit=${maxItems}`
      );

      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
      } else {
        setError("Failed to load live matches");
      }
    } catch (err) {
      setError("Failed to load live matches");
    } finally {
      setLoading(false);
    }
  }, [currentSport, maxItems]);

  useEffect(() => {
    fetchLiveMatches();

    // Auto-refresh every 30 seconds
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchLiveMatches, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchLiveMatches, autoRefresh]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || matches.length === 0) {
    return null; // Don't show if no live matches
  }

  const liveMatches = matches.filter((m) => m.status === "LIVE");
  const completedMatches = matches.filter((m) => m.status === "COMPLETED");

  return (
    <Card>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Radio className={cn("h-5 w-5", primaryTextClass, "animate-pulse")} />
              Live Scores
              {liveMatches.length > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-200">
                  {liveMatches.length} LIVE
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchLiveMatches}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent className={cn("space-y-2", compact && "py-2")}>
        {/* Live Matches */}
        {liveMatches.map((match) => (
          <div
            key={match.id}
            className={cn(
              "p-3 rounded-lg border",
              "bg-red-500/5 border-red-500/20"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-500">
                  LIVE
                </Badge>
                <span>R{match.roundNumber}M{match.matchNumber}</span>
                {match.courtAssignment && (
                  <span>• Court {match.courtAssignment}</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className={cn(
                  "font-medium",
                  match.winnerId === match.playerA.id && "text-green-600"
                )}>
                  {match.playerA.name}
                </p>
              </div>
              <div className="px-4 text-center">
                <span className="text-2xl font-bold">
                  {match.scoreA ?? "-"} - {match.scoreB ?? "-"}
                </span>
              </div>
              <div className="flex-1 text-right">
                <p className={cn(
                  "font-medium",
                  match.winnerId === match.playerB.id && "text-green-600"
                )}>
                  {match.playerB.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-2 truncate">
              {match.tournamentName}
            </p>
          </div>
        ))}

        {/* Recently Completed */}
        {completedMatches.length > 0 && !compact && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Recently Completed</p>
            {completedMatches.slice(0, 3).map((match) => (
              <div
                key={match.id}
                className="p-2 rounded-lg bg-muted/50 mb-1"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className={cn(
                    match.winnerId === match.playerA.id && "font-medium text-green-600"
                  )}>
                    {match.playerA.name}
                  </span>
                  <span className="text-muted-foreground">
                    {match.scoreA} - {match.scoreB}
                  </span>
                  <span className={cn(
                    match.winnerId === match.playerB.id && "font-medium text-green-600"
                  )}>
                    {match.playerB.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
