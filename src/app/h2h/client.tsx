"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy, Target, ArrowLeft, Loader2, Search, Swords, TrendingUp, Calendar,
  Share2, Copy, Check, Zap, Users, MapPin, ExternalLink, MessageSquare,
  AlertCircle, Clock, Award
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
  avatarUrl?: string;
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
  tournamentMeetings: {
    tournamentId: string;
    tournamentName: string;
    count: number;
  }[];
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

export default function H2HClientPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [searchingA, setSearchingA] = useState(false);
  const [searchingB, setSearchingB] = useState(false);
  const [searchResultsA, setSearchResultsA] = useState<PlayerSearchResult[]>([]);
  const [searchResultsB, setSearchResultsB] = useState<PlayerSearchResult[]>([]);
  const [searchQueryA, setSearchQueryA] = useState("");
  const [searchQueryB, setSearchQueryB] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const [selectedSport, setSelectedSport] = useState<string>("CORNHOLE");
  const [player1Id, setPlayer1Id] = useState<string>(searchParams.get("player1") || "");
  const [player2Id, setPlayer2Id] = useState<string>(searchParams.get("player2") || "");
  const [player1Name, setPlayer1Name] = useState("");
  const [player2Name, setPlayer2Name] = useState("");
  const [data, setData] = useState<H2HData | null>(null);

  const [copied, setCopied] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeMessage, setChallengeMessage] = useState("");
  const [challengeLoading, setChallengeLoading] = useState(false);

  // Initialize from URL params
  useEffect(() => {
    const p1 = searchParams.get("player1");
    const p2 = searchParams.get("player2");
    const sport = searchParams.get("sport");

    if (sport && (sport === "CORNHOLE" || sport === "DARTS")) {
      setSelectedSport(sport);
    }

    if (p1 && p2) {
      setPlayer1Id(p1);
      setPlayer2Id(p2);
      fetchH2HData(p1, p2, sport || selectedSport);
    }
  }, [searchParams]);

  // Search for players
  const searchPlayers = useCallback(async (query: string, setResults: (r: PlayerSearchResult[]) => void, setSearching: (s: boolean) => void) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/h2h/search?q=${encodeURIComponent(query)}&sport=${selectedSport}`);
      if (response.ok) {
        const result = await response.json();
        setResults(result.players || []);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  }, [selectedSport]);

  // Debounced search
  const debouncedSearch = useCallback((query: string, setResults: (r: PlayerSearchResult[]) => void, setSearching: (s: boolean) => void) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    const timer = setTimeout(() => {
      searchPlayers(query, setResults, setSearching);
    }, 300);
    setDebounceTimer(timer);
  }, [debounceTimer, searchPlayers]);

  // Fetch H2H data
  const fetchH2HData = async (p1: string, p2: string, sport: string) => {
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

  // Update URL with current selection
  const updateUrl = (p1: string, p2: string, sport: string) => {
    const params = new URLSearchParams();
    if (p1) params.set("player1", p1);
    if (p2) params.set("player2", p2);
    params.set("sport", sport);
    router.push(`/h2h?${params.toString()}`, { scroll: false });
  };

  // Handle compare
  const handleCompare = () => {
    if (player1Id && player2Id) {
      updateUrl(player1Id, player2Id, selectedSport);
      fetchH2HData(player1Id, player2Id, selectedSport);
    }
  };

  // Copy share URL
  const copyShareUrl = async () => {
    const url = `${window.location.origin}/h2h?player1=${player1Id}&player2=${player2Id}&sport=${selectedSport}`;
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
          challengerId: player1Id,
          challengedId: player2Id,
          sport: selectedSport,
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Swords className="w-6 h-6" />
            Head-to-Head Comparison
          </h1>
          <p className="text-gray-500">Compare match history between any two players and share the results</p>
        </div>

        {/* Sport Selection */}
        <Card className="bg-white border-gray-100 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Select Sport</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedSport} onValueChange={setSelectedSport}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select sport" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CORNHOLE">Cornhole</SelectItem>
                <SelectItem value="DARTS">Darts</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Player Selection */}
        <Card className="bg-white border-gray-100 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Select Players to Compare</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Player 1 */}
              <div className="space-y-3">
                <Label className="text-gray-700 font-medium">Player 1</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by name..."
                    value={searchQueryA}
                    onChange={(e) => {
                      setSearchQueryA(e.target.value);
                      debouncedSearch(e.target.value, setSearchResultsA, setSearchingA);
                    }}
                    className="pl-10"
                  />
                  {searchingA && (
                    <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>
                {searchResultsA.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto bg-white shadow-lg">
                    {searchResultsA.map((p) => (
                      <button
                        key={p.id}
                        className="w-full p-3 text-left hover:bg-gray-50 flex justify-between items-center"
                        onClick={() => {
                          setPlayer1Id(p.id);
                          setSearchQueryA(`${p.firstName} ${p.lastName}`);
                          setSearchResultsA([]);
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
                {player1Id && !searchResultsA.length && searchQueryA && (
                  <Badge className="bg-emerald-50 text-emerald-600">Player selected</Badge>
                )}
              </div>

              {/* Player 2 */}
              <div className="space-y-3">
                <Label className="text-gray-700 font-medium">Player 2</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by name..."
                    value={searchQueryB}
                    onChange={(e) => {
                      setSearchQueryB(e.target.value);
                      debouncedSearch(e.target.value, setSearchResultsB, setSearchingB);
                    }}
                    className="pl-10"
                  />
                  {searchingB && (
                    <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>
                {searchResultsB.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto bg-white shadow-lg">
                    {searchResultsB.map((p) => (
                      <button
                        key={p.id}
                        className="w-full p-3 text-left hover:bg-gray-50 flex justify-between items-center"
                        onClick={() => {
                          setPlayer2Id(p.id);
                          setSearchQueryB(`${p.firstName} ${p.lastName}`);
                          setSearchResultsB([]);
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
                {player2Id && !searchResultsB.length && searchQueryB && (
                  <Badge className="bg-emerald-50 text-emerald-600">Player selected</Badge>
                )}
              </div>
            </div>

            <Button
              className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
              onClick={handleCompare}
              disabled={!player1Id || !player2Id || loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Target className="w-4 h-4 mr-2" />}
              Compare Players
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {data && (
          <>
            {/* Share & Challenge Actions */}
            <div className="flex flex-wrap gap-3 mb-6">
              <Button variant="outline" onClick={copyShareUrl} className="gap-2">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Share Comparison"}
              </Button>
              <Button variant="outline" onClick={() => setShowChallengeModal(true)} className="gap-2">
                <Zap className="w-4 h-4" />
                Challenge to Match
              </Button>
            </div>

            {/* Score Summary */}
            <Card className="bg-white border-gray-100 shadow-sm mb-6">
              <CardContent className="p-6">
                <div className="grid grid-cols-3 items-center text-center">
                  {/* Player A */}
                  <div className="space-y-2">
                    <Link href={`/cornhole/players/${data.playerA.id}`} className="hover:underline block">
                      <Avatar className="w-16 h-16 mx-auto mb-2">
                        <AvatarFallback className="text-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                          {data.playerA.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="text-lg font-bold text-gray-900">{data.playerA.name}</h3>
                    </Link>
                    <div className="flex flex-wrap gap-1 justify-center">
                      <Badge className={cn("text-xs", getTierColor(data.playerA.tier))}>
                        {data.playerA.tier}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {data.playerA.points} pts • {Math.round(data.playerA.elo)} Elo
                    </p>
                    <p className="text-5xl font-bold text-emerald-600 mt-2">{data.record.playerAWins}</p>
                    <p className="text-sm text-gray-500">wins</p>
                  </div>

                  {/* VS */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <Swords className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-lg font-semibold text-gray-700 mt-3">VS</p>
                    <p className="text-sm text-gray-500">{data.record.totalMatches} matches</p>
                    {data.record.totalMatches > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Win rate: {Math.round((data.record.playerAWins / data.record.totalMatches) * 100)}% - {Math.round((data.record.playerBWins / data.record.totalMatches) * 100)}%
                      </p>
                    )}
                  </div>

                  {/* Player B */}
                  <div className="space-y-2">
                    <Link href={`/cornhole/players/${data.playerB.id}`} className="hover:underline block">
                      <Avatar className="w-16 h-16 mx-auto mb-2">
                        <AvatarFallback className="text-xl bg-gradient-to-br from-rose-400 to-red-500 text-white">
                          {data.playerB.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="text-lg font-bold text-gray-900">{data.playerB.name}</h3>
                    </Link>
                    <div className="flex flex-wrap gap-1 justify-center">
                      <Badge className={cn("text-xs", getTierColor(data.playerB.tier))}>
                        {data.playerB.tier}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {data.playerB.points} pts • {Math.round(data.playerB.elo)} Elo
                    </p>
                    <p className="text-5xl font-bold text-red-500 mt-2">{data.record.playerBWins}</p>
                    <p className="text-sm text-gray-500">wins</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Average Scores */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Average Scores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-emerald-600">{data.averageScores.playerAAvg.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">{data.playerA.name}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Avg Score</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-500">{data.averageScores.playerBAvg.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">{data.playerB.name}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Elo Comparison */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Elo Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-emerald-600">{Math.round(data.playerA.elo)}</p>
                      <p className="text-xs text-gray-500">{data.playerA.name}</p>
                    </div>
                    <div className="text-center">
                      {data.projectedWinner && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-700">Projected Winner</p>
                          <p className="text-lg font-bold text-indigo-600">
                            {data.projectedWinner.playerId === data.playerA.id ? data.playerA.name : data.playerB.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {Math.round(data.projectedWinner.probability * 100)}% probability
                          </p>
                        </div>
                      )}
                      {!data.projectedWinner && data.record.totalMatches === 0 && (
                        <p className="text-sm text-gray-500">No data</p>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-500">{Math.round(data.playerB.elo)}</p>
                      <p className="text-xs text-gray-500">{data.playerB.name}</p>
                    </div>
                  </div>
                  {data.projectedWinner && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-red-500"
                          style={{
                            width: `${data.projectedWinner.playerId === data.playerA.id
                              ? data.projectedWinner.probability * 100
                              : (1 - data.projectedWinner.probability) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Player Stats */}
            <Card className="bg-white border-gray-100 shadow-sm mb-6">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Overall Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="border-r">
                    <p className="text-sm text-gray-500 mb-1">Matches</p>
                    <div className="flex justify-center gap-4">
                      <div>
                        <p className="font-bold text-emerald-600">{data.playerA.matchesPlayed}</p>
                        <p className="text-xs text-gray-400">{data.playerA.name}</p>
                      </div>
                      <div>
                        <p className="font-bold text-red-500">{data.playerB.matchesPlayed}</p>
                        <p className="text-xs text-gray-400">{data.playerB.name}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-r">
                    <p className="text-sm text-gray-500 mb-1">Wins</p>
                    <div className="flex justify-center gap-4">
                      <div>
                        <p className="font-bold text-emerald-600">{data.playerA.wins}</p>
                        <p className="text-xs text-gray-400">{data.playerA.name}</p>
                      </div>
                      <div>
                        <p className="font-bold text-red-500">{data.playerB.wins}</p>
                        <p className="text-xs text-gray-400">{data.playerB.name}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Win Rate</p>
                    <div className="flex justify-center gap-4">
                      <div>
                        <p className="font-bold text-emerald-600">
                          {data.playerA.matchesPlayed > 0
                            ? Math.round((data.playerA.wins / data.playerA.matchesPlayed) * 100)
                            : 0}%
                        </p>
                        <p className="text-xs text-gray-400">{data.playerA.name}</p>
                      </div>
                      <div>
                        <p className="font-bold text-red-500">
                          {data.playerB.matchesPlayed > 0
                            ? Math.round((data.playerB.wins / data.playerB.matchesPlayed) * 100)
                            : 0}%
                        </p>
                        <p className="text-xs text-gray-400">{data.playerB.name}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Last 5 Matches */}
            <Card className="bg-white border-gray-100 shadow-sm mb-6">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Last 5 Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.last5Matches.length > 0 ? (
                  <div className="space-y-3">
                    {data.last5Matches.slice(0, 5).map((match) => {
                      const playerAWon = match.winnerId === data.playerA.id;
                      return (
                        <div key={match.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                              playerAWon ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                            )}>
                              {playerAWon ? "W" : "L"}
                            </div>
                            <div>
                              {match.tournamentName && (
                                <Link
                                  href={`/cornhole/tournaments/${match.tournamentId}`}
                                  className="text-sm font-medium text-gray-900 hover:underline"
                                >
                                  {match.tournamentName}
                                </Link>
                              )}
                              {!match.tournamentName && (
                                <span className="text-sm text-gray-500">Friendly Match</span>
                              )}
                              {match.tournamentScope && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {match.tournamentScope}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">
                              {match.playerAScore} - {match.playerBScore}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(match.playedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No matches played between these players</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tournament Meetings */}
            {data.tournamentMeetings.length > 0 && (
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Tournament Meetings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.tournamentMeetings.map((t) => (
                      <Link
                        key={t.tournamentId}
                        href={`/cornhole/tournaments/${t.tournamentId}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-500" />
                          <span className="font-medium text-gray-900">{t.tournamentName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{t.count} meetings</Badge>
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </div>
                      </Link>
                    ))}
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
                Send a challenge request to {player2Name || "your opponent"} for a head-to-head match.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="font-medium text-gray-900">{player1Name || "You"}</p>
                    <p className="text-xs text-gray-500">Challenger</p>
                  </div>
                  <Swords className="w-6 h-6 text-gray-400" />
                  <div className="text-center">
                    <p className="font-medium text-gray-900">{player2Name || "Opponent"}</p>
                    <p className="text-xs text-gray-500">Challenged</p>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="message">Message (optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Add a personal message to your challenge..."
                  value={challengeMessage}
                  onChange={(e) => setChallengeMessage(e.target.value)}
                  rows={3}
                />
              </div>
              <p className="text-xs text-gray-500">
                The challenged player will receive a notification and can accept or decline.
                If accepted, nearby upcoming tournaments will be suggested.
              </p>
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
    </div>
  );
}
