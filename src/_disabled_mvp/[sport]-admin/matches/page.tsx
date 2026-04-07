"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trophy,
  Calendar,
  Clock,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Play,
  Users,
  Filter,
  Search,
  Save,
} from "lucide-react";

interface Match {
  id: string;
  tournamentId: string | null;
  tournament?: { id: string; name: string } | null;
  playerA: { id: string; firstName: string; lastName: string; hiddenElo: number };
  playerB: { id: string; firstName: string; lastName: string; hiddenElo: number } | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  outcome: string | null;
  status: string;
  scheduledTime: string | null;
  courtName: string | null;
  round?: string;
  bracketMatch?: {
    roundNumber: number;
    matchNumber: number;
  };
}

export default function AdminMatchesPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [tournamentFilter, setTournamentFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, [sport]);

  useEffect(() => {
    filterMatches();
  }, [matches, statusFilter, tournamentFilter, searchQuery]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/matches?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
      } else {
        setError("Failed to load matches");
      }
    } catch (err) {
      setError("Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  const filterMatches = () => {
    let filtered = [...matches];

    if (statusFilter !== "all") {
      filtered = filtered.filter((m) => {
        if (statusFilter === "pending") return m.scoreA === null && m.scoreB === null;
        if (statusFilter === "completed") return m.scoreA !== null && m.scoreB !== null;
        return true;
      });
    }

    if (tournamentFilter !== "all") {
      filtered = filtered.filter((m) => m.tournamentId === tournamentFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((m) => {
        const playerAName = `${m.playerA.firstName} ${m.playerA.lastName}`.toLowerCase();
        const playerBName = m.playerB ? `${m.playerB.firstName} ${m.playerB.lastName}`.toLowerCase() : "";
        const tournamentName = m.tournament?.name?.toLowerCase() || "";
        return playerAName.includes(query) || playerBName.includes(query) || tournamentName.includes(query);
      });
    }

    setFilteredMatches(filtered);
  };

  const startEditing = (match: Match) => {
    setEditingMatch(match.id);
    setScoreA(match.scoreA?.toString() || "");
    setScoreB(match.scoreB?.toString() || "");
  };

  const cancelEditing = () => {
    setEditingMatch(null);
    setScoreA("");
    setScoreB("");
  };

  const saveResult = async (matchId: string) => {
    if (scoreA === "" || scoreB === "") {
      setError("Both scores are required");
      return;
    }

    const scoreAInt = parseInt(scoreA);
    const scoreBInt = parseInt(scoreB);

    if (isNaN(scoreAInt) || isNaN(scoreBInt)) {
      setError("Scores must be valid numbers");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/matches/${matchId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scoreA: scoreAInt,
          scoreB: scoreBInt,
          outcome: "PLAYED",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save result");
        return;
      }

      setSuccess("Match result saved successfully");
      setEditingMatch(null);
      fetchMatches();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to save result");
    } finally {
      setSaving(false);
    }
  };

  const uniqueTournaments = Array.from(
    new Set(matches.filter((m) => m.tournament).map((m) => m.tournament!))
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        {/* Back Button */}
        <Link href={`/${sport}/admin`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ChevronLeft className="w-4 h-4" />
          Back to Admin Console
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Match Management</h1>
            <p className="text-muted-foreground">Enter and manage match results</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge className="bg-amber-500/10 text-amber-400">
              {filteredMatches.filter((m) => m.scoreA === null).length} Pending
            </Badge>
            <Badge className="bg-emerald-500/10 text-emerald-400">
              {filteredMatches.filter((m) => m.scoreA !== null).length} Completed
            </Badge>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4 bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by player or tournament..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Matches</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tournamentFilter} onValueChange={setTournamentFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Tournament" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tournaments</SelectItem>
                  {uniqueTournaments.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Matches List */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle>Matches ({filteredMatches.length})</CardTitle>
            <CardDescription>Click on a match to enter results</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredMatches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No matches found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMatches.map((match) => {
                  const isEditing = editingMatch === match.id;
                  const isCompleted = match.scoreA !== null && match.scoreB !== null;

                  return (
                    <div
                      key={match.id}
                      className={`p-4 rounded-lg border ${
                        isEditing
                          ? "border-primary bg-primary/5"
                          : isCompleted
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-border/50 bg-muted/30"
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Match Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {match.tournament && (
                              <Badge variant="outline" className="text-xs">
                                {match.tournament.name}
                              </Badge>
                            )}
                            {match.bracketMatch && (
                              <Badge variant="outline" className="text-xs">
                                R{match.bracketMatch.roundNumber} M{match.bracketMatch.matchNumber}
                              </Badge>
                            )}
                            {isCompleted ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400">Completed</Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-400">Pending</Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-4 items-center">
                            {/* Player A */}
                            <div className="text-right">
                              <p className="font-medium text-foreground">
                                {match.playerA.firstName} {match.playerA.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ELO: {Math.round(match.playerA.hiddenElo)}
                              </p>
                            </div>

                            {/* VS / Scores */}
                            <div className="text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Input
                                    type="number"
                                    value={scoreA}
                                    onChange={(e) => setScoreA(e.target.value)}
                                    className="w-16 text-center"
                                    min="0"
                                  />
                                  <span className="text-muted-foreground">-</span>
                                  <Input
                                    type="number"
                                    value={scoreB}
                                    onChange={(e) => setScoreB(e.target.value)}
                                    className="w-16 text-center"
                                    min="0"
                                  />
                                </div>
                              ) : isCompleted ? (
                                <div className="flex items-center justify-center gap-2">
                                  <span className={`text-xl font-bold ${match.winnerId === match.playerA.id ? "text-emerald-400" : ""}`}>
                                    {match.scoreA}
                                  </span>
                                  <span className="text-muted-foreground">-</span>
                                  <span className={`text-xl font-bold ${match.winnerId === match.playerB?.id ? "text-emerald-400" : ""}`}>
                                    {match.scoreB}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">vs</span>
                              )}
                            </div>

                            {/* Player B */}
                            <div className="text-left">
                              {match.playerB ? (
                                <>
                                  <p className="font-medium text-foreground">
                                    {match.playerB.firstName} {match.playerB.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    ELO: {Math.round(match.playerB.hiddenElo)}
                                  </p>
                                </>
                              ) : (
                                <span className="text-muted-foreground italic">Bye</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEditing}
                                disabled={saving}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"
                                onClick={() => saveResult(match.id)}
                                disabled={saving}
                              >
                                {saving ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                                Save
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant={isCompleted ? "outline" : "default"}
                              onClick={() => startEditing(match)}
                            >
                              {isCompleted ? "Edit" : "Enter Result"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
