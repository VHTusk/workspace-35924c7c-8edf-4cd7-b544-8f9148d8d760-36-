"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  Eye,
  Bell,
  Radio,
  Clock,
  ChevronRight,
  Loader2,
  Zap,
} from "lucide-react";
import { LiveScoreTicker } from "@/components/live-score-ticker";
import { cn } from "@/lib/utils";

interface PublicTournament {
  id: string;
  name: string;
  sport: string;
  scope: string;
  location: string;
  startDate: string;
  endDate: string;
  prizePool: number;
  maxPlayers: number;
  registeredCount: number;
  status: string;
  format?: string;
}

const scopeColors: Record<string, string> = {
  CITY: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  DISTRICT: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  STATE: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  NATIONAL: "bg-red-500/10 text-red-400 border-red-500/30",
};

const sportColors: Record<string, { primary: string; bg: string; text: string }> = {
  CORNHOLE: { primary: "bg-green-600 hover:bg-green-700", bg: "bg-green-50", text: "text-green-600" },
  DARTS: { primary: "bg-teal-600 hover:bg-teal-700", bg: "bg-teal-50", text: "text-teal-600" },
};

export default function SpectatorLandingPage() {
  const [tournaments, setTournaments] = useState<PublicTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState<"all" | "CORNHOLE" | "DARTS">("all");

  useEffect(() => {
    fetchTournaments();
  }, [activeSport]);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("isPublic", "true");
      
      const response = await fetch(`/api/public/tournaments?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        let filtered = data.tournaments || [];
        
        if (activeSport !== "all") {
          filtered = filtered.filter((t: PublicTournament) => t.sport === activeSport);
        }
        
        setTournaments(filtered);
      }
    } catch (err) {
      console.error("Failed to fetch tournaments:", err);
    } finally {
      setLoading(false);
    }
  };

  const liveTournaments = tournaments.filter(t => t.status === "IN_PROGRESS");
  const openTournaments = tournaments.filter(t => t.status === "REGISTRATION_OPEN");
  const upcomingTournaments = tournaments.filter(t => 
    t.status === "BRACKET_GENERATED" || t.status === "REGISTRATION_CLOSED"
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-600/10 via-transparent to-teal-600/10" />
        <div className="container mx-auto px-4 py-12 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Eye className="h-8 w-8 text-primary" />
              <Badge variant="outline" className="text-sm">
                No Account Required
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Spectator Hub
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Follow tournaments, track live scores, and stay updated on your favorite events.
              Subscribe with just your email or phone!
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="#live">
                <Button className="bg-red-600 hover:bg-red-700 gap-2">
                  <Radio className="h-4 w-4 animate-pulse" />
                  Watch Live
                  {liveTournaments.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {liveTournaments.length}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link href="#tournaments">
                <Button variant="outline" className="gap-2">
                  <Trophy className="h-4 w-4" />
                  Browse Tournaments
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-12">
        {/* Sport Filter */}
        <div className="flex justify-center">
          <Tabs value={activeSport} onValueChange={(v) => setActiveSport(v as typeof activeSport)}>
            <TabsList>
              <TabsTrigger value="all">All Sports</TabsTrigger>
              <TabsTrigger value="CORNHOLE" className="gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Cornhole
              </TabsTrigger>
              <TabsTrigger value="DARTS" className="gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                Darts
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Live Tournaments */}
        <section id="live">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Radio className="h-6 w-6 text-red-500 animate-pulse" />
              <h2 className="text-2xl font-bold text-foreground">Live Now</h2>
            </div>
          </div>

          {liveTournaments.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Live Score Ticker */}
              <LiveScoreTicker sport={activeSport === "all" ? "cornhole" : activeSport.toLowerCase()} maxItems={5} />
              
              {/* Live Tournament Cards */}
              <div className="space-y-4">
                {liveTournaments.slice(0, 3).map((tournament) => {
                  const colors = sportColors[tournament.sport] || sportColors.CORNHOLE;
                  return (
                    <Card key={tournament.id} className="border-red-500/30 bg-red-500/5">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-red-500 text-white text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                LIVE
                              </Badge>
                              <Badge variant="outline" className={scopeColors[tournament.scope]}>
                                {tournament.scope}
                              </Badge>
                            </div>
                            <h3 className="font-semibold text-foreground">{tournament.name}</h3>
                            <p className="text-sm text-muted-foreground">{tournament.location}</p>
                          </div>
                          <Link href={`/${tournament.sport.toLowerCase()}/tournaments/${tournament.id}`}>
                            <Button size="sm" className={colors.primary}>
                              Watch
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Live Tournaments</h3>
                <p className="text-muted-foreground">
                  Check back soon for live action!
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Open for Registration */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-green-500" />
              <h2 className="text-2xl font-bold text-foreground">Open for Registration</h2>
            </div>
            <Link href="/tournaments">
              <Button variant="ghost" className="gap-2">
                View All
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : openTournaments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {openTournaments.slice(0, 6).map((tournament) => {
                const colors = sportColors[tournament.sport] || sportColors.CORNHOLE;
                return (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    colors={colors}
                  />
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Open Registrations</h3>
                <p className="text-muted-foreground">
                  Check back later for new tournaments
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Upcoming Tournaments */}
        {upcomingTournaments.length > 0 && (
          <section id="tournaments">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-amber-500" />
                <h2 className="text-2xl font-bold text-foreground">Starting Soon</h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingTournaments.slice(0, 6).map((tournament) => {
                const colors = sportColors[tournament.sport] || sportColors.CORNHOLE;
                return (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    colors={colors}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* How It Works */}
        <section className="py-8">
          <Card className="bg-gradient-to-r from-muted/50 to-muted/30">
            <CardHeader>
              <CardTitle className="text-center">How Spectator Mode Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-8 md:grid-cols-3">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                    <Eye className="h-6 w-6" />
                  </div>
                  <h3 className="font-medium text-foreground mb-2">Browse Freely</h3>
                  <p className="text-sm text-muted-foreground">
                    View tournaments, brackets, and results without creating an account
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                    <Bell className="h-6 w-6" />
                  </div>
                  <h3 className="font-medium text-foreground mb-2">Follow & Subscribe</h3>
                  <p className="text-sm text-muted-foreground">
                    Just provide your email or phone to get notifications about your favorite events
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <h3 className="font-medium text-foreground mb-2">Ready to Play?</h3>
                  <p className="text-sm text-muted-foreground">
                    Register anytime to join tournaments and compete for prizes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function TournamentCard({ 
  tournament, 
  colors 
}: { 
  tournament: PublicTournament;
  colors: { primary: string; bg: string; text: string };
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={scopeColors[tournament.scope]}>
              {tournament.scope}
            </Badge>
            {tournament.format && (
              <Badge variant="outline" className="text-xs">
                {tournament.format === "DOUBLES" ? "2v2" : tournament.format === "TEAM" ? "Team" : "1v1"}
              </Badge>
            )}
          </div>
          <Badge variant="outline" className={cn("text-xs", colors.bg, colors.text)}>
            {tournament.sport}
          </Badge>
        </div>
        
        <h3 className="font-semibold text-foreground mb-2">{tournament.name}</h3>
        
        <div className="space-y-1 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="truncate">{tournament.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>
              {new Date(tournament.startDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{tournament.registeredCount}/{tournament.maxPlayers}</span>
            </div>
            {tournament.prizePool > 0 && (
              <div className="flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                <span>₹{(tournament.prizePool / 1000).toFixed(0)}K</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Link href={`/${tournament.sport.toLowerCase()}/tournaments/${tournament.id}`} className="flex-1">
            <Button size="sm" className={cn("w-full", colors.primary)}>
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
