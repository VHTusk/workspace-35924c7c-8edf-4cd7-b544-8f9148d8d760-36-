"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  Medal,
  Search,
  Clock,
  Filter,
  Share2,
} from "lucide-react";

interface Tournament {
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
  entryFee: number;
  prizePool: number;
  maxPlayers: number;
  registeredPlayers: number;
  availableSpots: number;
  bracketFormat: string | null;
  hostOrg: { id: string; name: string } | null;
}

const sportColors: Record<string, string> = {
  CORNHOLE: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  DARTS: "bg-green-500/10 text-green-400 border-green-500/30",
};

const scopeColors: Record<string, string> = {
  CITY: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  DISTRICT: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  STATE: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  NATIONAL: "bg-red-500/10 text-red-400 border-red-500/30",
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500/10 text-gray-400",
  REGISTRATION_OPEN: "bg-green-500/10 text-green-400",
  REGISTRATION_CLOSED: "bg-yellow-500/10 text-yellow-400",
  BRACKET_GENERATED: "bg-blue-500/10 text-blue-400",
  IN_PROGRESS: "bg-purple-500/10 text-purple-400",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-red-500/10 text-red-400",
};

const statusLabels: Record<string, string> = {
  REGISTRATION_OPEN: "Open for Registration",
  REGISTRATION_CLOSED: "Registration Closed",
  BRACKET_GENERATED: "Bracket Ready",
  IN_PROGRESS: "Live Now",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function PublicTournamentsClient() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const params = new URLSearchParams();
      if (sportFilter !== "all") params.append("sport", sportFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (scopeFilter !== "all") params.append("scope", scopeFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (search) params.append("search", search);

      const response = await fetch(`/api/public/tournaments?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setTournaments(data.data.tournaments);
      }
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchTournaments();
    }, 300);
    return () => clearTimeout(debounce);
  }, [sportFilter, statusFilter, scopeFilter, typeFilter, search]);

  const filteredTournaments = tournaments.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.location.toLowerCase().includes(search.toLowerCase()) ||
      (t.city?.toLowerCase().includes(search.toLowerCase())) ||
      (t.state?.toLowerCase().includes(search.toLowerCase()));
    const matchesSport = sportFilter === "all" || t.sport === sportFilter;
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesScope = scopeFilter === "all" || t.scope === scopeFilter;
    const matchesType = typeFilter === "all" || t.type === typeFilter;
    return matchesSearch && matchesSport && matchesStatus && matchesScope && matchesType;
  });

  const upcomingTournaments = filteredTournaments.filter(
    (t) => t.status === "REGISTRATION_OPEN" || t.status === "REGISTRATION_CLOSED"
  );
  const liveTournaments = filteredTournaments.filter((t) => t.status === "IN_PROGRESS");
  const completedTournaments = filteredTournaments.filter((t) => t.status === "COMPLETED");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/5 to-background border-b border-border/50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Discover Tournaments</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Browse cornhole and darts competitions happening near you. From local city events to national championships.
            </p>
          </div>

          {/* Search and Filters */}
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by tournament name, city, or state..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                  <Select value={sportFilter} onValueChange={setSportFilter}>
                    <SelectTrigger className="w-full sm:w-36">
                      <SelectValue placeholder="Sport" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sports</SelectItem>
                      <SelectItem value="CORNHOLE">Cornhole</SelectItem>
                      <SelectItem value="DARTS">Darts</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="REGISTRATION_OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">Live</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={scopeFilter} onValueChange={setScopeFilter}>
                    <SelectTrigger className="w-full sm:w-36">
                      <SelectValue placeholder="Scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="CITY">City</SelectItem>
                      <SelectItem value="DISTRICT">District</SelectItem>
                      <SelectItem value="STATE">State</SelectItem>
                      <SelectItem value="NATIONAL">National</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm-w-40">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                      <SelectItem value="INTER_ORG">Inter-Org</SelectItem>
                      <SelectItem value="INTRA_ORG">Intra-Org</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tournament List */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upcoming" className="gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming ({upcomingTournaments.length})
            </TabsTrigger>
            <TabsTrigger value="live" className="gap-2">
              <Trophy className="w-4 h-4" />
              Live ({liveTournaments.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <Clock className="w-4 h-4" />
              Completed ({completedTournaments.length})
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="bg-gradient-card border-border/50">
                  <CardContent className="p-6 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <TabsContent value="upcoming">
                {upcomingTournaments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upcomingTournaments.map((tournament) => (
                      <TournamentCard key={tournament.id} tournament={tournament} />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No upcoming tournaments found" />
                )}
              </TabsContent>

              <TabsContent value="live">
                {liveTournaments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {liveTournaments.map((tournament) => (
                      <TournamentCard key={tournament.id} tournament={tournament} />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No live tournaments at the moment" />
                )}
              </TabsContent>

              <TabsContent value="completed">
                {completedTournaments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {completedTournaments.map((tournament) => (
                      <TournamentCard key={tournament.id} tournament={tournament} />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No completed tournaments found" />
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  return (
    <Link href={`/tournaments/${tournament.id}`}>
      <Card className="bg-gradient-card border-border/50 hover:border-primary/30 transition-all hover:scale-[1.01] cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg text-foreground line-clamp-2">{tournament.name}</CardTitle>
            <div className="flex gap-1 flex-shrink-0">
              <Badge variant="outline" className={sportColors[tournament.sport] || ""}>
                {tournament.sport}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="truncate">
              {tournament.location}
              {tournament.city && tournament.state && ` • ${tournament.city}, ${tournament.state}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            {new Date(tournament.startDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Medal className="w-4 h-4 text-primary" />
              <span className="text-foreground font-medium">
                ₹{(tournament.prizePool / 1000).toFixed(0)}K
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {tournament.registeredPlayers}/{tournament.maxPlayers}
              </span>
            </div>
          </div>
          <div className="pt-2 flex items-center justify-between border-t border-border/40">
            <Badge variant="outline" className={statusColors[tournament.status] || ""}>
              {statusLabels[tournament.status] || tournament.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Entry: <span className="text-foreground font-medium">₹{tournament.entryFee}</span>
            </span>
          </div>
          {tournament.scope && (
            <Badge variant="outline" className={scopeColors[tournament.scope] || ""}>
              {tournament.scope}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="bg-gradient-card border-border/50">
      <CardContent className="py-12 text-center">
        <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">{message}</h3>
        <p className="text-muted-foreground">
          Try adjusting your filters or check back later for new tournaments.
        </p>
      </CardContent>
    </Card>
  );
}
