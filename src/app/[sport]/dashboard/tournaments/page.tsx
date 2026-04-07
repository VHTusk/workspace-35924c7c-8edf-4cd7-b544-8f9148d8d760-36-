"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Trophy, Users, ChevronRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Tournament {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  location: string;
  city: string;
  state: string;
  type: string;
  scope: string;
  maxPlayers: number;
  registeredPlayers: number;
  entryFee: number;
  registrationId: string;
  registrationStatus: string;
  registrationDate: string;
  matchesPlayed?: number;
  matchesWon?: number;
  finalRank?: number | null;
}

export default function DashboardTournamentsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [tournaments, setTournaments] = useState<{
    upcoming: Tournament[];
    active: Tournament[];
    completed: Tournament[];
  }>({ upcoming: [], active: [], completed: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournaments();
  }, [sport]);

  const fetchTournaments = async () => {
    try {
      const response = await fetch("/api/player/tournaments", {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setTournaments({
          upcoming: data.upcoming || [],
          active: data.active || [],
          completed: data.completed || [],
        });
      }
    } catch (err) {
      console.error("Failed to fetch tournaments:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "REGISTRATION_OPEN": return "bg-blue-100 text-blue-800";
      case "IN_PROGRESS": return "bg-green-100 text-green-800";
      case "COMPLETED": return "bg-gray-100 text-gray-800";
      case "CANCELLED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getScopeColor = (scope: string) => {
    switch (scope) {
      case "NATIONAL": return "bg-purple-100 text-purple-800";
      case "STATE": return "bg-orange-100 text-orange-800";
      case "DISTRICT": return "bg-cyan-100 text-cyan-800";
      case "CITY": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const primaryClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const TournamentCard = ({ tournament }: { tournament: Tournament }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg truncate">{tournament.name}</h3>
              <Badge className={getStatusColor(tournament.status)}>
                {tournament.status.replace(/_/g, " ")}
              </Badge>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{new Date(tournament.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{tournament.city}, {tournament.state}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{tournament.registeredPlayers}/{tournament.maxPlayers} players</span>
              </div>
            </div>

            {tournament.status === "COMPLETED" && tournament.finalRank && (
              <div className="mt-3 p-2 bg-purple-50 rounded-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-purple-600" />
                <p className="text-sm font-medium text-purple-800">Final Rank: #{tournament.finalRank}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={getScopeColor(tournament.scope)}>{tournament.scope}</Badge>
            <p className="text-sm font-semibold">₹{tournament.entryFee}</p>
            <Link href={`/${sport}/tournaments/${tournament.id}`}>
              <Button size="sm" className={cn("text-white", primaryClass)}>
                View <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const total = tournaments.upcoming.length + tournaments.active.length + tournaments.completed.length;

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Tournaments</h1>
        <p className="text-muted-foreground">Manage your tournament registrations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{total}</p><p className="text-sm text-muted-foreground">Total Registered</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{tournaments.upcoming.length}</p><p className="text-sm text-muted-foreground">Upcoming</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{tournaments.active.length}</p><p className="text-sm text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{tournaments.completed.length}</p><p className="text-sm text-muted-foreground">Completed</p></CardContent></Card>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">Upcoming ({tournaments.upcoming.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({tournaments.active.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4 space-y-4">
          {tournaments.upcoming.length > 0 ? tournaments.upcoming.map((t) => <TournamentCard key={t.id} tournament={t} />) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No upcoming tournaments</p>
              <Link href={`/${sport}/tournaments`}><Button className={cn("mt-4 text-white", primaryClass)}>Browse Tournaments</Button></Link>
            </div>
          )}
        </TabsContent>

        <TabsContent value="active" className="mt-4 space-y-4">
          {tournaments.active.length > 0 ? tournaments.active.map((t) => <TournamentCard key={t.id} tournament={t} />) : (
            <div className="text-center py-12"><p className="text-muted-foreground">No active tournaments</p></div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-4">
          {tournaments.completed.length > 0 ? tournaments.completed.map((t) => <TournamentCard key={t.id} tournament={t} />) : (
            <div className="text-center py-12"><p className="text-muted-foreground">No completed tournaments yet</p></div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
