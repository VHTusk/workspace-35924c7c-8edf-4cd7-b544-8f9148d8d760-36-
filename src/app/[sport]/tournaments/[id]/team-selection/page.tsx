"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar-org";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  Crown,
  Send,
  ArrowLeft,
  Trophy,
  UserCheck,
  Briefcase,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EligiblePlayer {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  elo: number;
  points: number;
  playerOrgType: string;
  verificationStatus: string;
}

interface SelectedPlayer {
  id: string;
  playerId: string;
  playerOrgType: string;
  isCaptain: boolean;
  player: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    elo: number;
    points: number;
    playerOrgType: string;
  };
}

interface TeamSelection {
  id: string;
  isSubmitted: boolean;
  submittedAt?: string;
  players: SelectedPlayer[];
}

interface TournamentInfo {
  id: string;
  name: string;
  type: string;
  maxPlayersPerOrg?: number;
}

export default function TeamSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const tournamentId = params.id as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [teamSelection, setTeamSelection] = useState<TeamSelection | null>(null);
  
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string>("");

  useEffect(() => {
    fetchTeamSelection();
  }, [tournamentId]);

  const fetchTeamSelection = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/team-selection`);
      if (response.ok) {
        const data = await response.json();
        setTournament(data.tournament);
        setEligiblePlayers(data.eligiblePlayers || []);
        setTeamSelection(data.teamSelection);
        
        if (data.teamSelection) {
          setSelectedPlayerIds(data.teamSelection.players.map((p: SelectedPlayer) => p.playerId));
          const captain = data.teamSelection.players.find((p: SelectedPlayer) => p.isCaptain);
          if (captain) setCaptainId(captain.playerId);
        }
      } else {
        const data = await response.json();
        setError(data.error || "Failed to load team selection");
      }
    } catch (err) {
      console.error("Failed to fetch team selection:", err);
      setError("Failed to load team selection");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlayer = (playerId: string) => {
    setSelectedPlayerIds(prev => {
      if (prev.includes(playerId)) {
        if (captainId === playerId) setCaptainId("");
        return prev.filter(id => id !== playerId);
      }
      return [...prev, playerId];
    });
  };

  const handleSaveSelection = async () => {
    if (selectedPlayerIds.length === 0) {
      setError("Please select at least one player");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/team-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: selectedPlayerIds,
          captainId: captainId || selectedPlayerIds[0],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save team selection");
        return;
      }

      setSuccess("Team selection saved successfully!");
      fetchTeamSelection();
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitSelection = async () => {
    if (selectedPlayerIds.length === 0) {
      setError("Please select at least one player");
      return;
    }

    if (!confirm("Are you sure you want to submit this team selection? This action cannot be undone.")) {
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      // First save the selection
      await fetch(`/api/tournaments/${tournamentId}/team-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: selectedPlayerIds,
          captainId: captainId || selectedPlayerIds[0],
        }),
      });

      // Then submit
      const response = await fetch(`/api/tournaments/${tournamentId}/team-selection/submit`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit team selection");
        return;
      }

      setSuccess("Team selection submitted successfully! Your team is now registered for the tournament.");
      fetchTeamSelection();
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const getPlayerTypeBadge = (type: string) => {
    switch (type) {
      case "EMPLOYEE":
        return <Badge className="bg-blue-100 text-blue-700"><UserCheck className="w-3 h-3 mr-1" />Employee</Badge>;
      case "CONTRACTED":
        return <Badge className="bg-purple-100 text-purple-700"><Briefcase className="w-3 h-3 mr-1" />Contracted</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Sidebar />
        <main className="ml-0 md:ml-72">
          <div className="p-6 max-w-4xl">
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>Tournament not found or not an inter-organization tournament</AlertDescription>
            </Alert>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              className="mb-4 text-gray-600 hover:text-gray-900"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Trophy className="w-6 h-6" />
                  Team Selection
                </h1>
                <p className="text-gray-500">{tournament.name}</p>
              </div>
              {teamSelection?.isSubmitted && (
                <Badge className="bg-green-100 text-green-700 px-4 py-2">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submitted
                </Badge>
              )}
            </div>
          </div>

          {/* Messages */}
          {success && (
            <Alert className="mb-6 bg-emerald-50 border-emerald-200">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">{success}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Selection Info */}
          <Card className="mb-6 bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-sm text-gray-500">Selected Players</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {selectedPlayerIds.length}
                      {tournament.maxPlayersPerOrg && ` / ${tournament.maxPlayersPerOrg}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Captain</p>
                    <p className="font-medium text-gray-900">
                      {captainId 
                        ? eligiblePlayers.find(p => p.id === captainId)?.name || "Not selected"
                        : "Not selected"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSaveSelection}
                    disabled={saving || submitting || teamSelection?.isSubmitted}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Save Draft
                  </Button>
                  <Button
                    className={cn("text-white", primaryBtnClass)}
                    onClick={handleSubmitSelection}
                    disabled={saving || submitting || teamSelection?.isSubmitted || selectedPlayerIds.length === 0}
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Submit Team
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Eligible Players */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Eligible Players
              </CardTitle>
              <CardDescription>
                Select players from your roster. Employees and contracted players are eligible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eligiblePlayers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No eligible players found. Please verify players and add them to your roster first.
                </div>
              ) : (
                <div className="space-y-2">
                  {eligiblePlayers.map((player) => {
                    const isSelected = selectedPlayerIds.includes(player.id);
                    const isCaptain = captainId === player.id;
                    
                    return (
                      <div
                        key={player.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border transition-colors",
                          isSelected 
                            ? "border-green-200 bg-green-50" 
                            : "border-gray-100 hover:border-gray-200",
                          teamSelection?.isSubmitted && "cursor-not-allowed opacity-75"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => !teamSelection?.isSubmitted && handleTogglePlayer(player.id)}
                            disabled={teamSelection?.isSubmitted}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{player.name}</p>
                              {isCaptain && (
                                <Badge className="bg-amber-100 text-amber-700">
                                  <Crown className="w-3 h-3 mr-1" />
                                  Captain
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>{player.email}</span>
                              <span>•</span>
                              <span>ELO: {Math.round(player.elo)}</span>
                              <span>•</span>
                              {getPlayerTypeBadge(player.playerOrgType)}
                            </div>
                          </div>
                        </div>
                        {isSelected && !teamSelection?.isSubmitted && (
                          <Button
                            size="sm"
                            variant={isCaptain ? "default" : "outline"}
                            onClick={() => setCaptainId(isCaptain ? "" : player.id)}
                            className={isCaptain ? primaryBtnClass : ""}
                          >
                            <Crown className="w-4 h-4 mr-1" />
                            {isCaptain ? "Captain" : "Make Captain"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Selection */}
          {teamSelection?.isSubmitted && (
            <Card className="mt-6 bg-white border-green-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Submitted Team
                </CardTitle>
                <CardDescription>
                  Submitted on {teamSelection.submittedAt && new Date(teamSelection.submittedAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teamSelection.players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{p.player.name}</p>
                        {p.isCaptain && (
                          <Badge className="bg-amber-100 text-amber-700">
                            <Crown className="w-3 h-3 mr-1" />
                            Captain
                          </Badge>
                        )}
                      </div>
                      {getPlayerTypeBadge(p.playerOrgType)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
