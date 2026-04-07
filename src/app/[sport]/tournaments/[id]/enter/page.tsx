"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Info,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RosterPlayer {
  id: string;
  firstName: string;
  lastName: string;
  elo: number;
  tier: string;
  city?: string;
  matchesPlayed: number;
  wins: number;
}

interface Tournament {
  id: string;
  name: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  location: string;
  city?: string;
  state?: string;
  entryFee: number;
  maxPlayersPerOrg?: number;
  prizePool: number;
  currentParticipants: number;
  maxPlayers: number;
}

interface EntryStatus {
  isRegistered: boolean;
  registeredPlayers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    elo: number;
  }>;
  rosterPlayers: RosterPlayer[];
}

export default function TournamentEntryPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const tournamentId = params.id as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [entryStatus, setEntryStatus] = useState<EntryStatus | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  useEffect(() => {
    fetchTournament();
    fetchEntryStatus();
  }, [tournamentId]);

  const fetchTournament = async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}`);
      if (response.ok) {
        const data = await response.json();
        setTournament(data.tournament);
      }
    } catch (err) {
      setError("Failed to load tournament");
    }
  };

  const fetchEntryStatus = async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/org-enter`);
      if (response.ok) {
        const data = await response.json();
        setEntryStatus(data);
        if (data.isRegistered) {
          setSelectedPlayers(data.registeredPlayers.map((p: { id: string }) => p.id));
        }
      }
    } catch (err) {
      // User might not be logged in as org
    } finally {
      setLoading(false);
    }
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  };

  const handleSubmit = async () => {
    if (selectedPlayers.length === 0) {
      setError("Please select at least one player");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/org-enter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: selectedPlayers }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to register");
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError("Failed to register for tournament");
    } finally {
      setSubmitting(false);
    }
  };

  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      DIAMOND: "bg-purple-100 text-purple-700",
      PLATINUM: "bg-cyan-100 text-cyan-700",
      GOLD: "bg-amber-100 text-amber-700",
      SILVER: "bg-gray-200 text-gray-700",
      BRONZE: "bg-orange-100 text-orange-700",
      UNRANKED: "bg-gray-100 text-gray-500",
    };
    return (
      <Badge className={colors[tier] || colors.UNRANKED}>
        {tier}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md bg-white border-gray-100 shadow-sm">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Tournament Not Found</h2>
            <p className="text-gray-600 mb-4">The tournament you're looking for doesn't exist.</p>
            <Link href={`/${sport}/tournaments`}>
              <Button variant="outline">Browse Tournaments</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if this is an INTER_ORG tournament
  if (tournament.type !== "INTER_ORG") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md bg-white border-gray-100 shadow-sm">
          <CardContent className="p-8 text-center">
            <Info className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Not an Inter-Org Tournament</h2>
            <p className="text-gray-600 mb-4">This page is only for inter-organization tournaments.</p>
            <Link href={`/${sport}/tournaments/${tournamentId}`}>
              <Button variant="outline">View Tournament</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md bg-white border-gray-100 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Registration Complete!</h2>
            <p className="text-gray-600 mb-4">
              Your organization has successfully registered <strong>{selectedPlayers.length} players</strong> for {tournament.name}.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href={`/${sport}/org/dashboard`}>
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
              <Link href={`/${sport}/tournaments/${tournamentId}`}>
                <Button className={primaryBtnClass}>View Tournament</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const maxPlayersAllowed = tournament.maxPlayersPerOrg || tournament.maxPlayers;

  return (
    <div className="bg-gray-50 min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <Link
          href={`/${sport}/tournaments/${tournamentId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tournament
        </Link>

        <h1 className="text-2xl font-bold text-gray-900">Register Your Organization</h1>
        <p className="text-gray-500 mb-6">Select players from your roster to participate</p>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tournament Info */}
          <div className="lg:col-span-1">
            <Card className="bg-white border-gray-100 shadow-sm sticky top-4">
              <CardHeader>
                <CardTitle className="text-gray-900">{tournament.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-700">Inter-Org</Badge>
                  <Badge className="bg-emerald-100 text-emerald-700">Open</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(tournament.startDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{tournament.location}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>
                    {tournament.currentParticipants}/{tournament.maxPlayers} registered
                  </span>
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <DollarSign className="w-4 h-4" />
                    <span>Organization Fee: ₹{tournament.entryFee.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    One-time fee for your organization (not per player)
                  </p>
                </div>
                <div className="border-t pt-3 mt-3">
                  <p className="text-sm font-medium text-gray-900">Max {maxPlayersAllowed} players per org</p>
                  <p className="text-xs text-gray-500">
                    Selected: {selectedPlayers.length}/{maxPlayersAllowed}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Player Selection */}
          <div className="lg:col-span-2">
            {entryStatus?.isRegistered ? (
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    Already Registered
                  </CardTitle>
                  <CardDescription>
                    Your organization has already registered for this tournament
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {entryStatus.registeredPlayers.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-emerald-700">
                              {player.firstName[0]}
                              {player.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {player.firstName} {player.lastName}
                            </p>
                            <p className="text-xs text-gray-500">ELO: {Math.round(player.elo)}</p>
                          </div>
                        </div>
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Info Banner */}
                <Alert className="bg-blue-50 border-blue-200 text-blue-700 mb-6">
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    Select players from your organization's roster to participate in this inter-org tournament.
                    Your organization pays a one-time entry fee of ₹{tournament.entryFee.toLocaleString()}.
                  </AlertDescription>
                </Alert>

                {/* Roster Players */}
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-gray-900">Select Players from Roster</CardTitle>
                    <CardDescription>
                      {entryStatus?.rosterPlayers.length || 0} players available in your roster
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!entryStatus?.rosterPlayers || entryStatus.rosterPlayers.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No players in your roster</p>
                        <p className="text-sm">Add players to your roster first from the org dashboard</p>
                        <Link href={`/${sport}/org/dashboard`}>
                          <Button variant="outline" className="mt-4">
                            Go to Dashboard
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {entryStatus.rosterPlayers.map((player) => {
                          const isSelected = selectedPlayers.includes(player.id);
                          const isDisabled =
                            !isSelected && selectedPlayers.length >= maxPlayersAllowed;

                          return (
                            <div
                              key={player.id}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer",
                                isSelected
                                  ? "bg-emerald-50 border-emerald-200"
                                  : isDisabled
                                  ? "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed"
                                  : "bg-white border-gray-100 hover:border-gray-200"
                              )}
                              onClick={() => !isDisabled && togglePlayer(player.id)}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onCheckedChange={() => togglePlayer(player.id)}
                                />
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                  <span className="text-sm font-medium text-gray-600">
                                    {player.firstName[0]}
                                    {player.lastName[0]}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {player.firstName} {player.lastName}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    {getTierBadge(player.tier)}
                                    <span>ELO: {player.elo}</span>
                                    <span>
                                      {player.wins}W - {player.matchesPlayed - player.wins}L
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {isSelected && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Submit Button */}
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Organization Fee: <strong>₹{tournament.entryFee.toLocaleString()}</strong>
                  </p>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || selectedPlayers.length === 0}
                    className={cn("gap-2", primaryBtnClass)}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Register {selectedPlayers.length} Players
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
