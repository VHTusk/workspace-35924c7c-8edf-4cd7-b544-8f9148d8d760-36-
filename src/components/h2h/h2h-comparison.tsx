"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Trophy, Target, Loader2, Search, Swords, TrendingUp, Calendar,
  Share2, Copy, Check, Zap, Users, MapPin, Clock, Award, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface H2HPlayer {
  id: string;
  name: string;
  elo: number;
  points: number;
  city?: string;
  state?: string;
  tier: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
}

interface H2HMatch {
  id: string;
  tournamentId?: string;
  tournamentName?: string;
  tournamentScope?: string;
  playerAScore?: number;
  playerBScore?: number;
  winnerId?: string;
  playedAt: string;
}

interface H2HData {
  playerA: H2HPlayer;
  playerB: H2HPlayer;
  record: {
    playerAWins: number;
    playerBWins: number;
    totalMatches: number;
  };
  averageScores: {
    playerAAvg: number;
    playerBAvg: number;
  };
  last5Matches: H2HMatch[];
  projectedWinner?: {
    playerId: string;
    probability: number;
  };
  sport: string;
}

interface PlayerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  visiblePoints: number;
  hiddenElo: number;
  city?: string;
  state?: string;
  sport: string;
}

interface H2HComparisonProps {
  sport: string;
  initialPlayer1Id?: string;
  initialPlayer2Id?: string;
  showChallenge?: boolean;
  currentPlayerId?: string; // If set, this player is fixed as player 1
}

export function H2HComparison({
  sport,
  initialPlayer1Id,
  initialPlayer2Id,
  showChallenge = true,
  currentPlayerId
}: H2HComparisonProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [player1Id, setPlayer1Id] = useState<string>(initialPlayer1Id || currentPlayerId || "");
  const [player2Id, setPlayer2Id] = useState<string>(initialPlayer2Id || "");
  const [player1Name, setPlayer1Name] = useState("");
  const [player2Name, setPlayer2Name] = useState("");
  const [data, setData] = useState<H2HData | null>(null);

  const [copied, setCopied] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeMessage, setChallengeMessage] = useState("");
  const [challengeLoading, setChallengeLoading] = useState(false);

  // Load initial data if both players are provided
  useEffect(() => {
    if (initialPlayer1Id && initialPlayer2Id) {
      fetchH2HData(initialPlayer1Id, initialPlayer2Id);
    }
  }, [initialPlayer1Id, initialPlayer2Id]);

  // Search for players
  const searchPlayers = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/h2h/search?q=${encodeURIComponent(query)}&sport=${sport}`);
      if (response.ok) {
        const result = await response.json();
        // Filter out already selected player
        const filtered = result.players.filter((p: PlayerSearchResult) => {
          if (currentPlayerId && p.id === currentPlayerId) return false;
          if (player1Id && p.id === player1Id) return false;
          return true;
        });
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  // Fetch H2H data
  const fetchH2HData = async (p1: string, p2: string) => {
    if (!p1 || !p2) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/h2h?player1=${p1}&player2=${p2}&sport=${sport}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setPlayer1Name(result.playerA.name);
        setPlayer2Name(result.playerB.name);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to fetch comparison data",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch comparison data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle compare
  const handleCompare = () => {
    if (player1Id && player2Id) {
      fetchH2HData(player1Id, player2Id);
    }
  };

  // Copy share URL
  const copyShareUrl = async () => {
    const url = `${window.location.origin}/h2h?player1=${player1Id}&player2=${player2Id}&sport=${sport}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share this link to compare these players",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy error:", error);
    }
  };

  // Send challenge
  const sendChallenge = async () => {
    if (!player1Id || !player2Id) return;

    setChallengeLoading(true);
    try {
      const response = await fetch("/api/h2h/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengerId: currentPlayerId || player1Id,
          challengedId: player2Id,
          sport,
          message: challengeMessage,
        }),
      });

      if (response.ok) {
        toast({
          title: "Challenge sent!",
          description: "Your challenge has been sent to the opponent",
        });
        setShowChallengeModal(false);
        setChallengeMessage("");
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to send challenge",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Challenge error:", error);
      toast({
        title: "Error",
        description: "Failed to send challenge",
        variant: "destructive",
      });
    } finally {
      setChallengeLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      DIAMOND: "text-cyan-500 bg-cyan-50",
      PLATINUM: "text-slate-500 bg-slate-50",
      GOLD: "text-amber-500 bg-amber-50",
      SILVER: "text-gray-400 bg-gray-50",
      BRONZE: "text-orange-600 bg-orange-50",
    };
    return colors[tier] || "text-gray-500 bg-gray-50";
  };

  return (
    <div className="space-y-6">
      {/* Player Selection */}
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Compare Players</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Player 1 */}
            {!currentPlayerId ? (
              <div className="space-y-3">
                <Label className="text-gray-700 font-medium">Player 1</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by name..."
                    value={player1Name || searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPlayer1Name("");
                      searchPlayers(e.target.value);
                    }}
                    className="pl-10"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>
                {searchResults.length > 0 && !player1Id && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto bg-white shadow-lg z-10 relative">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        className="w-full p-3 text-left hover:bg-gray-50 flex justify-between items-center"
                        onClick={() => {
                          setPlayer1Id(p.id);
                          setPlayer1Name(`${p.firstName} ${p.lastName}`);
                          setSearchResults([]);
                        }}
                      >
                        <div>
                          <span className="text-gray-900">{p.firstName} {p.lastName}</span>
                          {(p.city || p.state) && (
                            <span className="text-sm text-gray-500 ml-2">
                              <MapPin className="w-3 h-3 inline mr-1" />
                              {[p.city, p.state].filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">{p.visiblePoints} pts</span>
                      </button>
                    ))}
                  </div>
                )}
                {player1Id && (
                  <Badge className="bg-emerald-50 text-emerald-600">{player1Name || "Player selected"}</Badge>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Label className="text-gray-700 font-medium">You</Label>
                <Input value={player1Name} disabled className="bg-gray-50" />
              </div>
            )}

            {/* Player 2 */}
            <div className="space-y-3">
              <Label className="text-gray-700 font-medium">Opponent</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name..."
                  value={player2Name}
                  onChange={(e) => {
                    setPlayer2Name(e.target.value);
                    setPlayer2Id("");
                    searchPlayers(e.target.value);
                  }}
                  className="pl-10"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-gray-400" />
                )}
              </div>
              {searchResults.length > 0 && !player2Id && (
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto bg-white shadow-lg z-10 relative">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      className="w-full p-3 text-left hover:bg-gray-50 flex justify-between items-center"
                      onClick={() => {
                        setPlayer2Id(p.id);
                        setPlayer2Name(`${p.firstName} ${p.lastName}`);
                        setSearchResults([]);
                      }}
                    >
                      <div>
                        <span className="text-gray-900">{p.firstName} {p.lastName}</span>
                        {(p.city || p.state) && (
                          <span className="text-sm text-gray-500 ml-2">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {[p.city, p.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">{p.visiblePoints} pts</span>
                    </button>
                  ))}
                </div>
              )}
              {player2Id && (
                <Badge className="bg-emerald-50 text-emerald-600">{player2Name || "Opponent selected"}</Badge>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
              onClick={handleCompare}
              disabled={!player1Id || !player2Id || loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Target className="w-4 h-4 mr-2" />}
              Compare
            </Button>
            {data && (
              <>
                <Button variant="outline" onClick={copyShareUrl}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                {showChallenge && (
                  <Button variant="outline" onClick={() => setShowChallengeModal(true)}>
                    <Zap className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {data && (
        <>
          {/* Score Summary */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-6">
              <div className="grid grid-cols-3 items-center text-center">
                {/* Player A */}
                <div className="space-y-2">
                  <Avatar className="w-12 h-12 mx-auto">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                      {data.playerA.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <Link href={`/${sport.toLowerCase()}/players/${data.playerA.id}`} className="hover:underline block">
                    <h3 className="font-bold text-gray-900">{data.playerA.name}</h3>
                  </Link>
                  <Badge className={cn("text-xs", getTierColor(data.playerA.tier))}>
                    {data.playerA.tier}
                  </Badge>
                  <p className="text-4xl font-bold text-emerald-600 mt-2">{data.record.playerAWins}</p>
                  <p className="text-xs text-gray-500">wins</p>
                </div>

                {/* VS */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <Swords className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mt-2">VS</p>
                  <p className="text-xs text-gray-500">{data.record.totalMatches} matches</p>
                </div>

                {/* Player B */}
                <div className="space-y-2">
                  <Avatar className="w-12 h-12 mx-auto">
                    <AvatarFallback className="bg-gradient-to-br from-rose-400 to-red-500 text-white">
                      {data.playerB.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <Link href={`/${sport.toLowerCase()}/players/${data.playerB.id}`} className="hover:underline block">
                    <h3 className="font-bold text-gray-900">{data.playerB.name}</h3>
                  </Link>
                  <Badge className={cn("text-xs", getTierColor(data.playerB.tier))}>
                    {data.playerB.tier}
                  </Badge>
                  <p className="text-4xl font-bold text-red-500 mt-2">{data.record.playerBWins}</p>
                  <p className="text-xs text-gray-500">wins</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <Award className="w-4 h-4" />
                  Elo
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-emerald-600">{Math.round(data.playerA.elo)}</span>
                  <span className="font-bold text-red-500">{Math.round(data.playerB.elo)}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <TrendingUp className="w-4 h-4" />
                  Avg Score
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-emerald-600">{data.averageScores.playerAAvg.toFixed(1)}</span>
                  <span className="font-bold text-red-500">{data.averageScores.playerBAvg.toFixed(1)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Projected Winner */}
          {data.projectedWinner && data.record.totalMatches === 0 && (
            <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Projected Winner</p>
                    <p className="font-bold text-indigo-600">
                      {data.projectedWinner.playerId === data.playerA.id ? data.playerA.name : data.playerB.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-indigo-600">
                      {Math.round(data.projectedWinner.probability * 100)}%
                    </p>
                    <p className="text-xs text-gray-500">probability</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Last 5 Matches */}
          {data.last5Matches.length > 0 && (
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.last5Matches.slice(0, 5).map((match) => {
                    const playerAWon = match.winnerId === data.playerA.id;
                    return (
                      <div key={match.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                            playerAWon ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                          )}>
                            {playerAWon ? "W" : "L"}
                          </div>
                          <div>
                            {match.tournamentName && (
                              <p className="text-sm font-medium text-gray-900">{match.tournamentName}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              {new Date(match.playedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-gray-900">
                          {match.playerAScore} - {match.playerBScore}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Challenge Modal */}
      <Dialog open={showChallengeModal} onOpenChange={setShowChallengeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Challenge to Match
            </DialogTitle>
            <DialogDescription>
              Send a challenge request to {player2Name} for a head-to-head match.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="font-medium text-gray-900">{player1Name}</p>
                  <p className="text-xs text-gray-500">Challenger</p>
                </div>
                <Swords className="w-6 h-6 text-gray-400" />
                <div className="text-center">
                  <p className="font-medium text-gray-900">{player2Name}</p>
                  <p className="text-xs text-gray-500">Challenged</p>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a personal message..."
                value={challengeMessage}
                onChange={(e) => setChallengeMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChallengeModal(false)}>
              Cancel
            </Button>
            <Button onClick={sendChallenge} disabled={challengeLoading}>
              {challengeLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Send Challenge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
