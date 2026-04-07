"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import BracketView from "@/components/bracket/bracket-view";
import { TournamentStatusBadge } from "@/components/tournament/tournament-status-badge";
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  Clock,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Play,
  Flag,
  Settings,
  Building2,
} from "lucide-react";

interface Tournament {
  id: string;
  name: string;
  type: string;
  scope: string;
  status: string;
  location: string;
  city?: string;
  state?: string;
  startDate: string;
  endDate: string;
  regDeadline: string;
  prizePool: number;
  entryFee: number;
  maxPlayers: number;
  bracketFormat: string;
  hostOrg?: { id: string; name: string } | null;
  createdAt: string;
  counts: {
    registrations: number;
    matches: number;
    waitlist: number;
    checkins: number;
  };
  bracket?: {
    id: string;
    totalRounds: number;
  } | null;
}

interface Registration {
  id: string;
  status: string;
  registeredAt: string;
  seedNumber: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    elo: number;
    city?: string;
    matchesPlayed: number;
    wins: number;
  };
}

export default function AdminTournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const tournamentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchTournament();
  }, [tournamentId]);

  const fetchTournament = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/tournaments/${tournamentId}`);
      if (response.ok) {
        const data = await response.json();
        setTournament(data.tournament);
        setRegistrations(data.registrations || []);
      } else {
        setError("Tournament not found");
      }
    } catch (err) {
      setError("Failed to load tournament");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm("Publish this tournament? It will be open for registration.")) return;
    
    setActionLoading("publish");
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/publish`, {
        method: "POST",
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to publish");
        return;
      }

      setSuccess("Tournament published successfully");
      fetchTournament();
    } catch (err) {
      setError("Failed to publish");
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateBracket = async () => {
    if (!confirm("Generate bracket? This will create matches based on current registrations.")) return;
    
    setActionLoading("bracket");
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/generate-bracket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedingMethod: "ELO" }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to generate bracket");
        return;
      }

      setSuccess(`Bracket generated: ${data.bracket.matchesGenerated} matches`);
      fetchTournament();
    } catch (err) {
      setError("Failed to generate bracket");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async () => {
    if (!confirm("Start the tournament? First round matches will go live.")) return;
    
    setActionLoading("start");
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/start`, {
        method: "POST",
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to start tournament");
        return;
      }

      setSuccess(`Tournament started! ${data.tournament.firstRoundMatches} first-round matches are now live.`);
      fetchTournament();
    } catch (err) {
      setError("Failed to start tournament");
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async () => {
    if (!confirm("Mark this tournament as complete? This will finalize standings and award bonus points.")) return;
    
    setActionLoading("complete");
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/complete`, {
        method: "POST",
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to complete tournament");
        return;
      }

      setSuccess(`Tournament completed! Results: ${data.results?.map((r: { rank: number; playerName: string }) => `${r.rank}. ${r.playerName}`).join(", ")}`);
      fetchTournament();
    } catch (err) {
      setError("Failed to complete tournament");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    const reason = prompt("Reason for cancellation (required):");
    if (!reason) return;
    
    setActionLoading("cancel");
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to cancel");
        return;
      }

      setSuccess("Tournament cancelled");
      fetchTournament();
    } catch (err) {
      setError("Failed to cancel");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="py-8 px-4">
        <div className="container mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error || "Tournament not found"}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        {/* Back Button */}
        <Link href={`/${sport}/admin/tournaments`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ChevronLeft className="w-4 h-4" />
          Back to Tournaments
        </Link>

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

        {/* Header */}
        <div className="flex flex-col lg:flex-row gap-6 mb-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-foreground">{tournament.name}</h1>
              <TournamentStatusBadge
                startDate={tournament.startDate}
                endDate={tournament.endDate}
                dbStatus={tournament.status}
                detailed
                size="md"
              />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Badge variant="outline">{tournament.type}</Badge>
              <Badge variant="outline">{tournament.scope}</Badge>
              {tournament.hostOrg && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {tournament.hostOrg.name}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-5 h-5" />
                <span>{new Date(tournament.startDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-5 h-5" />
                <span>{tournament.location}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-5 h-5" />
                <span>{tournament.counts.registrations}/{tournament.maxPlayers}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy className="w-5 h-5" />
                <span>₹{tournament.prizePool.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Action Card */}
          <Card className="bg-gradient-card border-border/50 lg:w-72">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tournament.status === "DRAFT" && (
                <Button
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={handlePublish}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "publish" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Publish Tournament
                </Button>
              )}

              {(tournament.status === "REGISTRATION_OPEN" || tournament.status === "REGISTRATION_CLOSED") && !tournament.bracket && (
                <Button
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={handleGenerateBracket}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "bracket" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Generate Bracket
                </Button>
              )}

              {tournament.status === "BRACKET_GENERATED" && (
                <Button
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                  onClick={handleStart}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "start" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Start Tournament
                </Button>
              )}

              {tournament.status === "IN_PROGRESS" && (
                <Button
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={handleComplete}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "complete" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Flag className="w-4 h-4 mr-2" />
                  )}
                  Complete Tournament
                </Button>
              )}

              {tournament.status !== "COMPLETED" && tournament.status !== "CANCELLED" && (
                <Button
                  variant="outline"
                  className="w-full text-red-400 border-red-400/30 hover:bg-red-500/10"
                  onClick={handleCancel}
                  disabled={actionLoading !== null}
                >
                  Cancel Tournament
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="registrations" className="space-y-6">
          <TabsList>
            <TabsTrigger value="registrations">Registrations ({tournament.counts.registrations})</TabsTrigger>
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="registrations">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Registered Players</CardTitle>
                <CardDescription>Seed order based on ELO ranking</CardDescription>
              </CardHeader>
              <CardContent>
                {registrations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No registrations yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {registrations.map((reg) => (
                      <div
                        key={reg.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                            {reg.seedNumber}
                          </span>
                          <div>
                            <p className="font-medium">
                              {reg.user.firstName} {reg.user.lastName}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>ELO: {reg.user.elo}</span>
                              <span>• {reg.user.wins}W-{reg.user.matchesPlayed - reg.user.wins}L</span>
                              {reg.user.city && <span>• {reg.user.city}</span>}
                            </div>
                          </div>
                        </div>
                        <Badge
                          className={
                            reg.status === "CONFIRMED"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          }
                        >
                          {reg.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bracket">
            <BracketView tournamentId={tournamentId} sport={sport} />
          </TabsContent>

          <TabsContent value="settings">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Tournament Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Format:</span>
                    <span className="ml-2">{tournament.bracketFormat?.replace(/_/g, " ") || "Not set"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Entry Fee:</span>
                    <span className="ml-2">₹{tournament.entryFee}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Players:</span>
                    <span className="ml-2">{tournament.maxPlayers}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prize Pool:</span>
                    <span className="ml-2">₹{tournament.prizePool.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Registration Deadline:</span>
                    <span className="ml-2">{new Date(tournament.regDeadline).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <span className="ml-2">{new Date(tournament.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
