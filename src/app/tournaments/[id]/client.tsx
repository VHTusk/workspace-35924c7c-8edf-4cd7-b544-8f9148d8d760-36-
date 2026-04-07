"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  Medal,
  Clock,
  Share2,
  ChevronRight,
  Building2,
  Wallet,
  Target,
  UserCheck,
} from "lucide-react";

interface TournamentData {
  id: string;
  name: string;
  sport: string;
  type: string;
  scope: string | null;
  status: string;
  location: string;
  city: string | null;
  state: string | null;
  startDate: string;
  endDate: string;
  regDeadline: string;
  entryFee: number;
  earlyBirdFee: number | null;
  earlyBirdDeadline: string | null;
  prizePool: number;
  maxPlayers: number;
  maxPlayersPerOrg: number | null;
  bracketFormat: string | null;
  ageMin: number | null;
  ageMax: number | null;
  gender: string | null;
  scoringMode: string;
  hostOrg: { id: string; name: string; type: string; logoUrl: string | null } | null;
  sponsors: Array<{ id: string; name: string; logoUrl: string | null; tier: string | null }>;
  hasBracket: boolean;
  bracket: { id: string; format: string; totalRounds: number } | null;
  stats: {
    registeredPlayers: number;
    totalMatches: number;
    availableSpots: number;
  };
  topPlayers: Array<{
    id: string;
    name: string;
    avatar: string | null;
    city: string | null;
    state: string | null;
  }>;
  results: Array<{
    rank: number;
    bonusPoints: number;
    player: { id: string; name: string; avatar: string | null };
  }> | null;
}

const sportColors: Record<string, string> = {
  CORNHOLE: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  DARTS: "bg-green-500/10 text-green-400 border-green-500/30",
};

const statusColors: Record<string, string> = {
  REGISTRATION_OPEN: "bg-green-500/10 text-green-400 border-green-500/30",
  REGISTRATION_CLOSED: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  BRACKET_GENERATED: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  IN_PROGRESS: "bg-purple-500/10 text-purple-400 border-purple-500/30 animate-pulse",
  COMPLETED: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  CANCELLED: "bg-red-500/10 text-red-400 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  REGISTRATION_OPEN: "Open for Registration",
  REGISTRATION_CLOSED: "Registration Closed",
  BRACKET_GENERATED: "Bracket Ready",
  IN_PROGRESS: "Tournament Live",
  COMPLETED: "Tournament Completed",
  CANCELLED: "Cancelled",
};

interface Props {
  tournamentId: string;
}

export function TournamentDetailClient({ tournamentId }: Props) {
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();

  useEffect(() => {
    fetchTournament();
  }, [tournamentId]);

  const fetchTournament = async () => {
    try {
      const response = await fetch(`/api/public/tournaments/${tournamentId}`);
      const data = await response.json();
      if (data.success) {
        setTournament(data.data.tournament);
      }
    } catch (error) {
      console.error("Failed to fetch tournament:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: tournament?.name,
          text: `Check out ${tournament?.name} tournament on VALORHIVE`,
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
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Tournament Not Found</h2>
        <p className="text-muted-foreground mb-4">This tournament doesn&apos;t exist or is not public.</p>
        <Link href="/tournaments">
          <Button>Browse Tournaments</Button>
        </Link>
      </div>
    );
  }

  const registrationOpen = tournament.status === "REGISTRATION_OPEN";
  const isLive = tournament.status === "IN_PROGRESS";
  const isCompleted = tournament.status === "COMPLETED";

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-primary/5 to-background border-b border-border/50">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/tournaments" className="hover:text-foreground">
              Tournaments
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground truncate">{tournament.name}</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="outline" className={sportColors[tournament.sport] || ""}>
                  {tournament.sport}
                </Badge>
                <Badge variant="outline" className={statusColors[tournament.status] || ""}>
                  {statusLabels[tournament.status]}
                </Badge>
                {tournament.scope && (
                  <Badge variant="outline">{tournament.scope}</Badge>
                )}
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-3">{tournament.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {tournament.location}
                    {tournament.city && tournament.state && ` • ${tournament.city}, ${tournament.state}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              {registrationOpen && (
                <Link href={`/${tournament.sport.toLowerCase()}/tournaments/${tournament.id}`}>
                  <Button>
                    Register Now
                  </Button>
                </Link>
              )}
              {(isLive || isCompleted) && tournament.hasBracket && (
                <Link href={`/tournaments/${tournament.id}/bracket`}>
                  <Button>
                    <Target className="w-4 h-4 mr-2" />
                    View Bracket
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dates Card */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Tournament Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">
                    {new Date(tournament.startDate).toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium">
                    {new Date(tournament.endDate).toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Registration Deadline</p>
                  <p className="font-medium">
                    {new Date(tournament.regDeadline).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Prize & Entry */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Medal className="w-5 h-5" />
                  Prizes & Entry
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Prize Pool</p>
                  <p className="text-2xl font-bold text-primary">
                    ₹{tournament.prizePool.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entry Fee</p>
                  {tournament.earlyBirdFee && new Date(tournament.earlyBirdDeadline!) > new Date() ? (
                    <div>
                      <p className="text-lg font-bold text-green-400">
                        ₹{tournament.earlyBirdFee} (Early Bird)
                      </p>
                      <p className="text-sm text-muted-foreground line-through">
                        ₹{tournament.entryFee}
                      </p>
                    </div>
                  ) : (
                    <p className="text-lg font-bold">₹{tournament.entryFee}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Format */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Tournament Format
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">
                    {tournament.type.replace(/_/g, " ").toLowerCase()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bracket Format</p>
                  <p className="font-medium capitalize">
                    {tournament.bracketFormat?.replace(/_/g, " ").toLowerCase() || "TBD"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Players</p>
                  <p className="font-medium">{tournament.maxPlayers}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Scoring Mode</p>
                  <p className="font-medium capitalize">
                    {tournament.scoringMode.replace(/_/g, " ").toLowerCase()}
                  </p>
                </div>
                {tournament.ageMin || tournament.ageMax ? (
                  <div>
                    <p className="text-sm text-muted-foreground">Age Restriction</p>
                    <p className="font-medium">
                      {tournament.ageMin && tournament.ageMax
                        ? `${tournament.ageMin} - ${tournament.ageMax} years`
                        : tournament.ageMin
                        ? `${tournament.ageMin}+ years`
                        : `Under ${tournament.ageMax} years`}
                    </p>
                  </div>
                ) : null}
                {tournament.gender && (
                  <div>
                    <p className="text-sm text-muted-foreground">Gender Category</p>
                    <p className="font-medium capitalize">{tournament.gender.toLowerCase()}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Results (if completed) */}
            {isCompleted && tournament.results && tournament.results.length > 0 && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    Final Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tournament.results.slice(0, 3).map((result) => (
                      <div
                        key={result.rank}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          result.rank === 1
                            ? "bg-amber-500/10 border border-amber-500/30"
                            : result.rank === 2
                            ? "bg-gray-400/10 border border-gray-400/30"
                            : result.rank === 3
                            ? "bg-orange-600/10 border border-orange-600/30"
                            : "bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold">#{result.rank}</span>
                          <Link
                            href={`/players/${result.player.id}?sport=${tournament.sport}`}
                            className="font-medium hover:text-primary"
                          >
                            {result.player.name}
                          </Link>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          +{result.bonusPoints} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Registration Stats */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Registration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Registered</span>
                  <span className="text-xl font-bold">
                    {tournament.stats.registeredPlayers}/{tournament.maxPlayers}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        (tournament.stats.registeredPlayers / tournament.maxPlayers) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                {tournament.stats.availableSpots > 0 ? (
                  <p className="text-sm text-green-400">
                    {tournament.stats.availableSpots} spots available
                  </p>
                ) : (
                  <p className="text-sm text-amber-400">Tournament is full</p>
                )}
              </CardContent>
            </Card>

            {/* Host Organization */}
            {tournament.hostOrg && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Host Organization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      {tournament.hostOrg.logoUrl ? (
                        <img
                          src={tournament.hostOrg.logoUrl}
                          alt={tournament.hostOrg.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{tournament.hostOrg.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {tournament.hostOrg.type.toLowerCase()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Players Preview */}
            {tournament.topPlayers.length > 0 && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    Registered Players
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tournament.topPlayers.slice(0, 5).map((player) => (
                      <Link
                        key={player.id}
                        href={`/players/${player.id}?sport=${tournament.sport}`}
                        className="flex items-center gap-3 hover:bg-muted/30 p-2 rounded-lg transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                          {player.avatar ? (
                            <img
                              src={player.avatar}
                              alt={player.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            player.name.charAt(0)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{player.name}</p>
                          {player.city && player.state && (
                            <p className="text-xs text-muted-foreground truncate">
                              {player.city}, {player.state}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                    {tournament.stats.registeredPlayers > 5 && (
                      <p className="text-sm text-muted-foreground text-center pt-2">
                        +{tournament.stats.registeredPlayers - 5} more players
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Call to Action */}
            {registrationOpen && (
              <Card className="bg-gradient-card border-primary/30">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">Ready to compete?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Register now and secure your spot in this tournament.
                  </p>
                  <Link href={`/${tournament.sport.toLowerCase()}/tournaments/${tournament.id}`}>
                    <Button className="w-full">
                      Register Now
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
