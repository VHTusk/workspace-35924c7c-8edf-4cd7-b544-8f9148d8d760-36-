"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  Medal,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building2,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AuthenticatedLayout from "@/components/layout/authenticated-layout";

interface Tournament {
  id: string;
  name: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  city: string | null;
  state: string | null;
  scope: string | null;
  maxParticipants: number;
  currentParticipants: number;
  prizePool: number;
  entryFee: number;
  registeredAt: string;
  registrationStatus: string;
  registrationId: string | null;
  isHost?: boolean;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  REGISTRATION_OPEN: "bg-green-100 text-green-700",
  REGISTRATION_CLOSED: "bg-amber-100 text-amber-700",
  BRACKET_GENERATED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  REGISTRATION_OPEN: "Open",
  REGISTRATION_CLOSED: "Closed",
  BRACKET_GENERATED: "Brackets Ready",
  IN_PROGRESS: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const registrationStatusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
  WAITLISTED: "bg-blue-100 text-blue-700",
  HOST: "bg-purple-100 text-purple-700",
};

const registrationStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  WAITLISTED: "Waitlisted",
  HOST: "Host",
};

const scopeColors: Record<string, string> = {
  CITY: "bg-blue-50 text-blue-700 border-blue-200",
  DISTRICT: "bg-purple-50 text-purple-700 border-purple-200",
  STATE: "bg-amber-50 text-amber-700 border-amber-200",
  NATIONAL: "bg-red-50 text-red-700 border-red-200",
};

export default function OrgMyTournamentsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const response = await fetch("/api/org/my-tournaments");
        if (response.ok) {
          const data = await response.json();
          setTournaments(data.tournaments);
        }
      } catch (error) {
        console.error("Failed to fetch tournaments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, []);

  // Filter tournaments by status
  const activeTournaments = tournaments.filter(
    (t) => t.status === "REGISTRATION_OPEN" || t.status === "IN_PROGRESS" || t.status === "BRACKET_GENERATED"
  );
  const completedTournaments = tournaments.filter((t) => t.status === "COMPLETED");
  const pendingRegistrations = tournaments.filter((t) => t.registrationStatus === "PENDING");

  const TournamentCard = ({ tournament }: { tournament: Tournament }) => (
    <Card key={tournament.id} className="border-gray-100 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              {tournament.name}
              {tournament.isHost && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  <Crown className="w-3 h-3 mr-1" />
                  Host
                </Badge>
              )}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={cn("text-xs", statusColors[tournament.status])}>
                {statusLabels[tournament.status] || tournament.status}
              </Badge>
              {tournament.scope && (
                <Badge variant="outline" className={cn("text-xs", scopeColors[tournament.scope])}>
                  {tournament.scope}
                </Badge>
              )}
            </div>
          </div>
          <Badge className={cn(registrationStatusColors[tournament.registrationStatus])}>
            {registrationStatusLabels[tournament.registrationStatus] || tournament.registrationStatus}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm text-gray-500 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date(tournament.startDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{tournament.city || tournament.state || "TBD"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Medal className={cn("w-4 h-4", primaryTextClass)} />
            <span className="font-medium text-gray-900">
              {(tournament.prizePool / 1000).toFixed(0)}K Prize
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>
              {tournament.currentParticipants}/{tournament.maxParticipants}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            Registered:{" "}
            <span className="text-gray-900">
              {new Date(tournament.registeredAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </span>
          </span>
          <Button size="sm" variant="outline" className="text-gray-600">
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Tournaments</h1>
            <p className="text-gray-500 mt-1">
              Tournaments your organization has joined or is hosting
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              <Building2 className="w-3 h-3 mr-1" />
              {tournaments.length} Tournaments
            </Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-gray-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", primaryBgClass)}>
                  <CheckCircle className={cn("w-5 h-5", primaryTextClass)} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {tournaments.filter((t) => t.registrationStatus === "CONFIRMED").length}
                  </p>
                  <p className="text-sm text-gray-500">Confirmed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {tournaments.filter((t) => t.isHost).length}
                  </p>
                  <p className="text-sm text-gray-500">Hosting</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{pendingRegistrations.length}</p>
                  <p className="text-sm text-gray-500">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tournament Tabs */}
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="bg-gray-100">
            <TabsTrigger value="active" className="data-[state=active]:bg-white">
              Active ({activeTournaments.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-white">
              Completed ({completedTournaments.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-white">
              All ({tournaments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto" />
                <p className="text-gray-500 mt-4">Loading tournaments...</p>
              </div>
            ) : activeTournaments.length === 0 ? (
              <Card className="border-gray-100">
                <CardContent className="py-12 text-center">
                  <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No active tournaments</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Register for tournaments to see them here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {activeTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedTournaments.length === 0 ? (
              <Card className="border-gray-100">
                <CardContent className="py-12 text-center">
                  <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No completed tournaments yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {completedTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {tournaments.length === 0 ? (
              <Card className="border-gray-100">
                <CardContent className="py-12 text-center">
                  <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No tournaments found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Register for tournaments to see them here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {tournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AuthenticatedLayout>
  );
}
