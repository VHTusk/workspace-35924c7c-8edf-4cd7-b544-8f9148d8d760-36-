"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy, Target, ArrowLeft, Loader2, Search, Swords, TrendingUp, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HeadToHeadData {
  playerA: {
    id: string;
    name: string;
    elo: number;
    points: number;
  };
  playerB: {
    id: string;
    name: string;
    elo: number;
    points: number;
  };
  record: {
    playerAWins: number;
    playerBWins: number;
    totalMatches: number;
  };
  matches: Array<{
    id: string;
    tournamentId?: string;
    tournamentName?: string;
    tournamentScope?: string;
    playerAScore?: number;
    playerBScore?: number;
    winnerId?: string;
    playedAt: string;
  }>;
}

interface Player {
  id: string;
  name: string;
  points: number;
}

export default function HeadToHeadPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(false);
  const [searchingA, setSearchingA] = useState(false);
  const [searchingB, setSearchingB] = useState(false);
  const [searchResultsA, setSearchResultsA] = useState<Player[]>([]);
  const [searchResultsB, setSearchResultsB] = useState<Player[]>([]);
  const [searchQueryA, setSearchQueryA] = useState("");
  const [searchQueryB, setSearchQueryB] = useState("");

  const [playerAId, setPlayerAId] = useState<string>(searchParams.get("player") || "");
  const [playerBId, setPlayerBId] = useState<string>("");
  const [data, setData] = useState<HeadToHeadData | null>(null);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  // Search for players
  const searchPlayers = async (query: string, setResults: (r: Player[]) => void, setSearching: (s: boolean) => void) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/leaderboard?sport=${sport.toUpperCase()}&search=${encodeURIComponent(query)}`);
      if (response.ok) {
        const result = await response.json();
        setResults(result.players.slice(0, 10));
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  // Fetch head-to-head data
  const fetchHeadToHead = async () => {
    if (!playerAId || !playerBId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/head-to-head?playerAId=${playerAId}&playerBId=${playerBId}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (playerAId && playerBId) {
      fetchHeadToHead();
    }
  }, [playerAId, playerBId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl p-4 sm:p-6">
        {/* Back Button */}
        <Link href={`/${sport}/leaderboard`} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Leaderboard
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Swords className="w-6 h-6" />
            Head-to-Head Record
          </h1>
          <p className="text-gray-500">Compare match history between two players</p>
        </div>

        {/* Player Selection */}
        <Card className="bg-white border-gray-100 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Select Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Player A */}
              <div className="space-y-3">
                <Label className="text-gray-700">Player 1</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search player..."
                    value={searchQueryA}
                    onChange={(e) => {
                      setSearchQueryA(e.target.value);
                      searchPlayers(e.target.value, setSearchResultsA, setSearchingA);
                    }}
                    className="pl-10"
                  />
                  {searchingA && (
                    <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>
                {searchResultsA.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {searchResultsA.map((p) => (
                      <button
                        key={p.id}
                        className="w-full p-3 text-left hover:bg-gray-50 flex justify-between items-center"
                        onClick={() => {
                          setPlayerAId(p.id);
                          setSearchQueryA(p.name);
                          setSearchResultsA([]);
                        }}
                      >
                        <span className="text-gray-900">{p.name}</span>
                        <span className="text-sm text-gray-500">{p.points} pts</span>
                      </button>
                    ))}
                  </div>
                )}
                {playerAId && !searchResultsA.length && (
                  <Badge className={primaryBgClass}>Player selected</Badge>
                )}
              </div>

              {/* Player B */}
              <div className="space-y-3">
                <Label className="text-gray-700">Player 2</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search player..."
                    value={searchQueryB}
                    onChange={(e) => {
                      setSearchQueryB(e.target.value);
                      searchPlayers(e.target.value, setSearchResultsB, setSearchingB);
                    }}
                    className="pl-10"
                  />
                  {searchingB && (
                    <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>
                {searchResultsB.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {searchResultsB.map((p) => (
                      <button
                        key={p.id}
                        className="w-full p-3 text-left hover:bg-gray-50 flex justify-between items-center"
                        onClick={() => {
                          setPlayerBId(p.id);
                          setSearchQueryB(p.name);
                          setSearchResultsB([]);
                        }}
                      >
                        <span className="text-gray-900">{p.name}</span>
                        <span className="text-sm text-gray-500">{p.points} pts</span>
                      </button>
                    ))}
                  </div>
                )}
                {playerBId && !searchResultsB.length && (
                  <Badge className={primaryBgClass}>Player selected</Badge>
                )}
              </div>
            </div>

            <Button
              className={cn("w-full mt-4", isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700")}
              onClick={fetchHeadToHead}
              disabled={!playerAId || !playerBId || loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Target className="w-4 h-4 mr-2" />}
              Compare Players
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {data && (
          <>
            {/* Score Summary */}
            <Card className="bg-white border-gray-100 shadow-sm mb-6">
              <CardContent className="p-6">
                <div className="grid grid-cols-3 items-center text-center">
                  {/* Player A */}
                  <div>
                    <Link href={`/${sport}/players/${data.playerA.id}`} className="hover:underline">
                      <h3 className="text-lg font-bold text-gray-900">{data.playerA.name}</h3>
                    </Link>
                    <p className="text-sm text-gray-500">{data.playerA.points} pts • {data.playerA.elo} Elo</p>
                    <p className="text-4xl font-bold text-emerald-600 mt-2">{data.record.playerAWins}</p>
                    <p className="text-sm text-gray-500">wins</p>
                  </div>

                  {/* VS */}
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                      <Swords className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{data.record.totalMatches} matches</p>
                  </div>

                  {/* Player B */}
                  <div>
                    <Link href={`/${sport}/players/${data.playerB.id}`} className="hover:underline">
                      <h3 className="text-lg font-bold text-gray-900">{data.playerB.name}</h3>
                    </Link>
                    <p className="text-sm text-gray-500">{data.playerB.points} pts • {data.playerB.elo} Elo</p>
                    <p className="text-4xl font-bold text-red-500 mt-2">{data.record.playerBWins}</p>
                    <p className="text-sm text-gray-500">wins</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Match History */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Match History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.matches.length > 0 ? (
                  <div className="space-y-3">
                    {data.matches.map((match) => {
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
                                  href={`/${sport}/tournaments/${match.tournamentId}`}
                                  className="text-sm font-medium text-gray-900 hover:underline"
                                >
                                  {match.tournamentName}
                                </Link>
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
                  <p className="text-center text-gray-500 py-8">
                    No matches played between these players
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
