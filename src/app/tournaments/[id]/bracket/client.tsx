"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy,
  Clock,
  Share2,
  ChevronRight,
  RefreshCw,
  Users,
  Target,
} from "lucide-react";

interface BracketMatch {
  id: string;
  matchId: string | null;
  matchNumber: number;
  status: string;
  scheduledAt: string | null;
  courtAssignment: string | null;
  playerA: {
    id: string;
    name: string;
    elo: number;
    avatar?: string | null;
    score: number | null;
  } | null;
  playerB: {
    id: string;
    name: string;
    elo: number;
    avatar?: string | null;
    score: number | null;
  } | null;
  winnerId: string | null;
  bracketSide: string | null;
}

interface Round {
  roundNumber: number;
  roundName: string;
  matches: BracketMatch[];
}

interface BracketData {
  hasBracket: boolean;
  bracket: {
    id: string;
    format: string;
    totalRounds: number;
    seedingMethod: string;
    generatedAt: string;
    rounds: Round[];
  } | null;
  tournament: {
    id: string;
    name: string;
    sport: string;
    status: string;
  };
  lastUpdated: string;
}

interface Props {
  tournamentId: string;
}

export function PublicBracketClient({ tournamentId }: Props) {
  const [bracketData, setBracketData] = useState<BracketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchBracket = useCallback(async () => {
    try {
      const response = await fetch(`/api/public/tournaments/${tournamentId}/bracket`);
      const data = await response.json();
      if (data.success) {
        setBracketData(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch bracket:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchBracket();
  }, [fetchBracket]);

  // Auto-refresh every 30 seconds for live tournaments
  useEffect(() => {
    if (!bracketData || bracketData.tournament.status !== "IN_PROGRESS" || !autoRefresh) {
      return;
    }

    const interval = setInterval(() => {
      fetchBracket();
    }, 30000);

    return () => clearInterval(interval);
  }, [bracketData, autoRefresh, fetchBracket]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBracket();
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${bracketData?.tournament.name} Bracket`,
          text: `Check out the ${bracketData?.tournament.name} bracket on VALORHIVE`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!bracketData || !bracketData.hasBracket || !bracketData.bracket) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Bracket Not Available</h2>
        <p className="text-muted-foreground mb-4">
          The bracket hasn&apos;t been generated yet or the tournament doesn&apos;t exist.
        </p>
        <Link href="/tournaments">
          <Button>Browse Tournaments</Button>
        </Link>
      </div>
    );
  }

  const { bracket, tournament } = bracketData;
  const isLive = tournament.status === "IN_PROGRESS";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "LIVE":
        return "bg-red-500/10 text-red-400 border-red-500/30 animate-pulse";
      case "COMPLETED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "BYE":
        return "bg-gray-500/10 text-gray-400 border-gray-500/30";
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/5 to-background border-b border-border/50">
        <div className="container mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/tournaments" className="hover:text-foreground">
              Tournaments
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link
              href={`/tournaments/${tournamentId}`}
              className="hover:text-foreground truncate max-w-[200px]"
            >
              {tournament.name}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground">Bracket</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-foreground">{tournament.name}</h1>
                {isLive && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 animate-pulse">
                    LIVE
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-muted-foreground text-sm">
                <span>
                  {bracket.format.replace(/_/g, " ")} • {bracket.totalRounds} Rounds
                </span>
                <span>
                  Last updated: {new Date(bracketData.lastUpdated).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              {isLive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={autoRefresh ? "border-primary text-primary" : ""}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
                  Auto-refresh {autoRefresh ? "ON" : "OFF"}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bracket Display */}
      <div className="container mx-auto px-4 py-6">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-6 min-w-max px-2">
                {bracket.rounds.map((round) => (
                  <div key={round.roundNumber} className="flex flex-col min-w-[280px]">
                    {/* Round Header */}
                    <div className="text-center mb-4">
                      <h3 className="font-semibold text-foreground">{round.roundName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {round.matches.length} match{round.matches.length !== 1 ? "es" : ""}
                      </p>
                    </div>

                    {/* Matches */}
                    <div className="flex flex-col gap-4 flex-1 justify-around">
                      {round.matches.map((match) => (
                        <div
                          key={match.id}
                          className={`rounded-lg border ${
                            match.status === "LIVE"
                              ? "border-red-500/50 bg-red-500/5"
                              : match.status === "COMPLETED"
                              ? "border-emerald-500/50 bg-emerald-500/5"
                              : "border-border/50 bg-muted/30"
                          }`}
                        >
                          {/* Match Header */}
                          <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
                            <span className="text-xs text-muted-foreground">
                              Match {match.matchNumber}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getStatusColor(match.status)}`}
                            >
                              {match.status}
                            </Badge>
                          </div>

                          {/* Players */}
                          <div className="p-3 space-y-2">
                            {/* Player A */}
                            <div
                              className={`flex items-center justify-between p-2 rounded ${
                                match.winnerId === match.playerA?.id
                                  ? "bg-emerald-500/20"
                                  : "bg-muted/30"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {match.playerA ? (
                                  <>
                                    <Link
                                      href={`/players/${match.playerA.id}?sport=${tournament.sport}`}
                                      className="text-sm font-medium truncate max-w-[120px] hover:text-primary"
                                    >
                                      {match.playerA.name}
                                    </Link>
                                    <span className="text-xs text-muted-foreground">
                                      ({match.playerA.elo})
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-sm text-muted-foreground italic">TBD</span>
                                )}
                              </div>
                              {match.playerA?.score !== null &&
                                match.playerA?.score !== undefined && (
                                  <span className="font-bold text-sm">{match.playerA.score}</span>
                                )}
                            </div>

                            {/* VS */}
                            <div className="text-center text-xs text-muted-foreground">vs</div>

                            {/* Player B */}
                            <div
                              className={`flex items-center justify-between p-2 rounded ${
                                match.winnerId === match.playerB?.id
                                  ? "bg-emerald-500/20"
                                  : "bg-muted/30"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {match.playerB ? (
                                  <>
                                    <Link
                                      href={`/players/${match.playerB.id}?sport=${tournament.sport}`}
                                      className="text-sm font-medium truncate max-w-[120px] hover:text-primary"
                                    >
                                      {match.playerB.name}
                                    </Link>
                                    <span className="text-xs text-muted-foreground">
                                      ({match.playerB.elo})
                                    </span>
                                  </>
                                ) : match.status === "BYE" ? (
                                  <span className="text-sm text-muted-foreground italic">Bye</span>
                                ) : (
                                  <span className="text-sm text-muted-foreground italic">TBD</span>
                                )}
                              </div>
                              {match.playerB?.score !== null &&
                                match.playerB?.score !== undefined && (
                                  <span className="font-bold text-sm">{match.playerB.score}</span>
                                )}
                            </div>
                          </div>

                          {/* Court/Schedule Info */}
                          {(match.courtAssignment || match.scheduledAt) && (
                            <div className="px-3 pb-2 text-xs text-muted-foreground">
                              {match.courtAssignment && (
                                <span className="mr-2">Court: {match.courtAssignment}</span>
                              )}
                              {match.scheduledAt && (
                                <span>
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {new Date(match.scheduledAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Champion Placeholder */}
                {bracket.rounds.length > 0 && (
                  <div className="flex flex-col min-w-[200px] items-center justify-center">
                    <div className="text-center mb-4">
                      <Trophy className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                      <h3 className="font-semibold text-foreground">Champion</h3>
                    </div>
                    <div className="w-full border-2 border-dashed border-amber-500/30 rounded-lg p-4 text-center">
                      <p className="text-sm text-muted-foreground italic">TBD</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm text-muted-foreground">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">Live</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-sm text-muted-foreground">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span className="text-sm text-muted-foreground">Bye</span>
          </div>
        </div>
      </div>
    </div>
  );
}
