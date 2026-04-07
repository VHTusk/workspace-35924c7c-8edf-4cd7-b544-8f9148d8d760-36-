"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import OrganizationLayoutWrapper from "@/components/org/organization-layout-wrapper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trophy,
  Calendar,
  Users,
  MapPin,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Eye,
  Shield,
  Target,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";


interface Tournament {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  startDate: string;
  endDate?: string;
  location: string;
  city?: string;
  state?: string;
  maxPlayers: number;
  currentParticipants: number;
  prizePool?: number;
  registrationDeadline: string;
  isRegistered?: boolean;
  squadName?: string;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function InterTournamentsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [org, setOrg] = useState<OrgData | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registeredTournaments, setRegisteredTournaments] = useState<Tournament[]>([]);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  useEffect(() => {
    fetchOrg();
    fetchTournaments();
  }, [sport]);

  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      // Fetch inter-org tournaments (type=INTER_ORG)
      const response = await fetch(`/api/tournaments?type=INTER_ORG&sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        // Filter for INTER_ORG tournaments only (extra safety)
        const interOrgTournaments = (data.tournaments || []).filter(
          (t: Tournament) => t.type === "INTER_ORG"
        );
        setTournaments(interOrgTournaments);
      }

      // Fetch registered tournaments
      const regResponse = await fetch(`/api/org/tournaments?type=INTER_ORG`);
      if (regResponse.ok) {
        const regData = await regResponse.json();
        const registered = (regData.tournaments || []).filter(
          (t: Tournament) => t.type === "INTER_ORG" && t.isRegistered
        );
        setRegisteredTournaments(registered);
      }
    } catch (err) {
      console.error("Failed to fetch tournaments:", err);
      setError("Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
      REGISTRATION_OPEN: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      REGISTRATION_CLOSED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      COMPLETED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    const labels: Record<string, string> = {
      DRAFT: "Draft",
      REGISTRATION_OPEN: "Open",
      REGISTRATION_CLOSED: "Closed",
      IN_PROGRESS: "In Progress",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    };
    return (
      <Badge className={styles[status] || "bg-gray-100 text-gray-700"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const openTournaments = tournaments.filter((t) => t.status === "REGISTRATION_OPEN");
  const activeTournaments = tournaments.filter((t) => t.status === "IN_PROGRESS");
  const completedTournaments = tournaments.filter((t) => t.status === "COMPLETED");

  return (
    <OrganizationLayoutWrapper>
      <div className="space-y-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(`/${sport}/org/corporate/inter`)}
              className="mb-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                  <Shield className="w-4 h-4" />
                  <span>External</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">External Tournaments</h1>
                <p className="text-gray-500 dark:text-gray-400">External competitive tournaments for your squads</p>
              </div>
              <Button variant="outline" onClick={() => router.push(`/${sport}/tournaments`)}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Browse All Tournaments
              </Button>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Target className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{openTournaments.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Open for Registration</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeTournaments.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">In Progress</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Shield className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{registeredTournaments.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Registered</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedTournaments.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
              </CardContent>
            </Card>
          </div>

          {/* Registered Tournaments */}
          {registeredTournaments.length > 0 && (
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm mb-6">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-500" />
                  Your Registered Tournaments
                </CardTitle>
                <CardDescription>Inter-corporate tournaments your squads are participating in</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {registeredTournaments.map((tournament) => (
                    <div
                      key={tournament.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <Trophy className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{tournament.name}</p>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(tournament.startDate).toLocaleDateString()}
                            </span>
                            {tournament.squadName && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Shield className="w-3 h-3" />
                                  {tournament.squadName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(tournament.status)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/${sport}/tournaments/${tournament.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Tournaments */}
          <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">External Tournaments</CardTitle>
              <CardDescription>Tournaments open for inter-corporate participation (INTER_ORG)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : tournaments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No inter-corporate tournaments available</p>
                  <p className="text-sm">Check back later for new tournaments</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tournaments.map((tournament) => (
                    <div
                      key={tournament.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", primaryBgClass)}>
                          <Trophy className={cn("w-6 h-6", primaryTextClass)} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{tournament.name}</p>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(tournament.startDate).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {tournament.currentParticipants}/{tournament.maxPlayers}
                            </span>
                            {(tournament.city || tournament.state) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {[tournament.city, tournament.state].filter(Boolean).join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(tournament.status)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/${sport}/tournaments/${tournament.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </OrganizationLayoutWrapper>
  );
}
