"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Calendar,
  MapPin,
  Loader2,
  Users,
  Clock,
  Radio,
  Share2,
  ChevronRight,
  CheckCircle,
  XCircle,
  Play,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SeedingManager } from "@/components/tournament/seeding-manager";

interface BracketData {
  tournament: {
    id: string;
    name: string;
    sport: string;
    type: string;
    status: string;
    startDate: string;
    endDate: string | null;
    location: string;
    city: string | null;
    state: string | null;
  };
  bracket: {
    id: string;
    format: string | null;
    totalRounds: number;
    rounds: Record<number, Array<{
      id: string;
      roundNumber: number;
      matchNumber: number;
      status: string;
      scheduledAt: string | null;
      courtAssignment: string | null;
      playerA: { id: string; name: string } | null;
      playerB: { id: string; name: string } | null;
      scoreA: number | null;
      scoreB: number | null;
      winnerId: string | null;
    }>>;
  } | null;
  liveMatches: Array<{
    id: string;
    roundNumber: number;
    matchNumber: number;
    court: string | null;
    playerA: string;
    playerB: string;
    scoreA: number;
    scoreB: number;
  }>;
  totalMatches: number;
  completedMatches: number;
}

export default function PublicBracketPage() {
  const params = useParams();
  const sport = params.sport as string;
  const tournamentId = params.id as string;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BracketData | null>(null);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchBracket();
    checkAdminStatus();
    // Poll for live updates every 30 seconds
    const interval = setInterval(fetchBracket, 30000);
    return () => clearInterval(interval);
  }, [tournamentId]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch("/api/admin/auth/check");
      setIsAdmin(response.ok);
    } catch {
      setIsAdmin(false);
    }
  };

  const fetchBracket = async () => {
    try {
      const response = await fetch(`/api/public/bracket?tournamentId=${tournamentId}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        setError("Tournament not found");
      }
    } catch (err) {
      console.error("Failed to fetch bracket:", err);
      setError("Failed to load bracket");
    } finally {
      setLoading(false);
    }
  };

  const shareBracket = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: `${data?.tournament.name} - Live Bracket`,
        url
      });
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-muted text-muted-foreground",
      LIVE: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse",
      COMPLETED: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
      BYE: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    };
    return (
      <Badge className={colors[status] || colors.PENDING}>
        {status}
      </Badge>
    );
  };

  const getMatchStatusIcon = (status: string) => {
    switch (status) {
      case 'LIVE':
        return <Radio className="w-4 h-4 text-red-500 animate-pulse" />;
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'PENDING':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold text-foreground mb-2">{error || "Not Found"}</h2>
          <Link href={`/${sport}/tournaments`}>
            <Button>Browse Tournaments</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { tournament, bracket, liveMatches, totalMatches, completedMatches } = data;

  return (
    <div className="min-h-screen bg-muted pt-20 pb-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link href={`/${sport}`} className="hover:text-foreground">Home</Link>
              <ChevronRight className="w-4 h-4" />
              <Link href={`/${sport}/tournaments`} className="hover:text-foreground">Tournaments</Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-foreground">{tournament.name}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{tournament.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {tournament.city || tournament.location}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(tournament.startDate).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && !bracket && (
              <SeedingManager 
                tournamentId={tournamentId} 
                sport={sport}
                onSeedingApplied={fetchBracket}
              />
            )}
            <Button onClick={shareBracket} variant="outline" className="gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>
        </div>

        {/* Live Banner */}
        {liveMatches.length > 0 && (
          <Card className="bg-red-50 border-red-200 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                <span className="font-semibold text-red-600">LIVE NOW</span>
                <Badge className="bg-red-500 text-white">{liveMatches.length} matches</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {liveMatches.map((match) => (
                  <div
                    key={match.id}
                    className="bg-white rounded-lg p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{match.playerA}</p>
                        <p className="text-2xl font-bold text-gray-900">{match.scoreA}</p>
                      </div>
                      <div className="text-center px-2">
                        <span className="text-gray-400">vs</span>
                      </div>
                      <div className="flex-1 text-right">
                        <p className="font-medium text-gray-900">{match.playerB}</p>
                        <p className="text-2xl font-bold text-gray-900">{match.scoreB}</p>
                      </div>
                    </div>
                    {match.court && (
                      <p className="text-xs text-gray-500 mt-2">Court: {match.court}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${(completedMatches / totalMatches) * 100}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">
            {completedMatches}/{totalMatches} matches
          </span>
        </div>

        {/* Bracket */}
        {bracket ? (
          <div className="space-y-6">
            {Object.entries(bracket.rounds).map(([roundNum, matches]) => (
              <Card key={roundNum} className="bg-white border-gray-100 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Round {roundNum}
                    {parseInt(roundNum) === bracket.totalRounds && (
                      <Badge className="bg-amber-100 text-amber-700">Finals</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {matches.map((match) => (
                      <div
                        key={match.id}
                        className={cn(
                          "border rounded-lg p-3",
                          match.status === 'LIVE' && "border-red-300 bg-red-50",
                          match.status === 'COMPLETED' && "border-gray-200"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getMatchStatusIcon(match.status)}
                            <span className="text-xs text-gray-500">Match {match.matchNumber}</span>
                          </div>
                          {match.courtAssignment && (
                            <span className="text-xs text-gray-500">Court: {match.courtAssignment}</span>
                          )}
                        </div>

                        <div className="space-y-2">
                          {/* Player A */}
                          <div className={cn(
                            "flex items-center justify-between p-2 rounded",
                            match.winnerId === match.playerA?.id && "bg-green-100"
                          )}>
                            <span className={cn(
                              "font-medium",
                              !match.playerA && "text-gray-400 italic"
                            )}>
                              {match.playerA?.name || "TBD"}
                            </span>
                            {match.scoreA !== null && (
                              <span className="font-bold text-lg">{match.scoreA}</span>
                            )}
                          </div>

                          {/* Player B */}
                          <div className={cn(
                            "flex items-center justify-between p-2 rounded",
                            match.winnerId === match.playerB?.id && "bg-green-100"
                          )}>
                            <span className={cn(
                              "font-medium",
                              !match.playerB && "text-gray-400 italic"
                            )}>
                              {match.playerB?.name || "TBD"}
                            </span>
                            {match.scoreB !== null && (
                              <span className="font-bold text-lg">{match.scoreB}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="py-12 text-center">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Bracket not yet generated</p>
              <p className="text-sm text-gray-400 mt-1">Check back after registration closes</p>
              {isAdmin && (
                <div className="mt-6">
                  <SeedingManager 
                    tournamentId={tournamentId} 
                    sport={sport}
                    onSeedingApplied={fetchBracket}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Want to compete?{" "}
            <Link href={`/${sport}/register`} className={cn("font-medium", primaryTextClass)}>
              Register for {sportName} tournaments
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
