"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Clock, Loader2 } from "lucide-react";

interface BracketMatch {
  id: string;
  matchId: string | null;
  matchNumber: number;
  status: string;
  scheduledAt: string | null;
  courtAssignment: string | null;
  playerA: { id: string; name: string; elo: number; score: number | null } | null;
  playerB: { id: string; name: string; elo: number; score: number | null } | null;
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
    status: string;
  };
}

interface BracketViewProps {
  tournamentId: string;
  sport: string;
}

export default function BracketView({ tournamentId, sport }: BracketViewProps) {
  const [loading, setLoading] = useState(true);
  const [bracketData, setBracketData] = useState<BracketData | null>(null);

  // PERFORMANCE: Memoize fetchBracket to prevent unnecessary re-renders
  const fetchBracket = useCallback(async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/bracket`);
      const data = await response.json();
      setBracketData(data);
    } catch (error) {
      console.error("Failed to fetch bracket:", error);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchBracket();
  }, [fetchBracket]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bracketData || !bracketData.hasBracket || !bracketData.bracket) {
    return (
      <Card className="bg-gradient-card border-border/50">
        <CardContent className="py-12 text-center">
          <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Bracket Not Yet Generated</h3>
          <p className="text-muted-foreground">
            The tournament bracket will be generated once registration closes.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { bracket } = bracketData;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "LIVE":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      case "COMPLETED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "BYE":
        return "bg-gray-500/10 text-gray-400 border-gray-500/30";
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* Bracket Header */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Tournament Bracket</CardTitle>
              <p className="text-sm text-muted-foreground">
                {bracket.format.replace(/_/g, " ")} • {bracket.totalRounds} Rounds • {bracket.seedingMethod} Seeding
              </p>
            </div>
            <Badge variant="outline">
              Generated: {new Date(bracket.generatedAt).toLocaleDateString()}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Bracket Display */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 md:gap-6 min-w-max px-2">
          {bracket.rounds.map((round) => (
            <div key={round.roundNumber} className="flex flex-col min-w-[240px] sm:min-w-[280px]">
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
                      <Badge variant="outline" className={`text-xs ${getStatusColor(match.status)}`}>
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
                              <span className="text-sm font-medium truncate max-w-[120px]">
                                {match.playerA.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({match.playerA.elo})
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-italic text-muted-foreground">
                              TBD
                            </span>
                          )}
                        </div>
                        {match.playerA?.score !== null && match.playerA?.score !== undefined && (
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
                              <span className="text-sm font-medium truncate max-w-[120px]">
                                {match.playerB.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({match.playerB.elo})
                              </span>
                            </>
                          ) : match.status === "BYE" ? (
                            <span className="text-sm text-muted-foreground italic">Bye</span>
                          ) : (
                            <span className="text-sm italic text-muted-foreground">TBD</span>
                          )}
                        </div>
                        {match.playerB?.score !== null && match.playerB?.score !== undefined && (
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
    </div>
  );
}
