"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shield,
  Users,
  Trophy,
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Plus,
  Eye,
  Target,
  Medal,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Organization {
  id: string;
  name: string;
  type: string;
  email?: string;
  city?: string;
  state?: string;
}

interface SchoolTeam {
  id: string;
  name: string;
  description?: string;
  status: string;
  formedAt: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  tournamentsParticipated: number;
  tournamentsWon: number;
  playerCount: number;
}

interface InterSchoolStats {
  totalTeams: number;
  totalTeamMembers: number;
  activeRegistrations: number;
  upcomingTournaments: number;
  recentWins: number;
  totalMedals: number;
}

interface Tournament {
  id: string;
  name: string;
  scope: string;
  status: string;
  startDate: string;
  endDate: string;
  location: string;
  city?: string;
  entryFee: number;
  registeredCount: number;
  maxPlayers: number;
  regDeadline: string;
}

export default function SchoolInterDashboard() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [org, setOrg] = useState<Organization | null>(null);
  const [stats, setStats] = useState<InterSchoolStats | null>(null);
  const [teams, setTeams] = useState<SchoolTeam[]>([]);
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([]);

  // Theme classes
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchData();
  }, [sport]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // Get org info
      const orgResponse = await fetch("/api/org/me");
      if (!orgResponse.ok) {
        throw new Error("Failed to fetch organization data");
      }
      const orgData = await orgResponse.json();
      setOrg(orgData);

      // Verify this is a SCHOOL organization
      if (orgData.type !== "SCHOOL") {
        router.push("/org/home");
        return;
      }

      // Fetch school teams data
      const dashboardResponse = await fetch(`/api/orgs/${orgData.id}/school-dashboard?sport=${sport.toUpperCase()}`);
      
      if (dashboardResponse.ok) {
        const data = await dashboardResponse.json();
        setStats({
          totalTeams: data.schoolTeams?.totalTeams || 0,
          totalTeamMembers: data.schoolTeams?.totalPlayers || 0,
          activeRegistrations: data.schoolTeams?.activeRegistrations || 0,
          upcomingTournaments: 0,
          recentWins: 0,
          totalMedals: 0,
        });
        setTeams(data.schoolTeams?.teams || []);
      } else {
        setStats({
          totalTeams: 0,
          totalTeamMembers: 0,
          activeRegistrations: 0,
          upcomingTournaments: 0,
          recentWins: 0,
          totalMedals: 0,
        });
      }

      // Fetch inter-school tournaments
      const tournamentsResponse = await fetch(`/api/tournaments?sport=${sport.toUpperCase()}&scope=INTER_SCHOOL&status=REGISTRATION_OPEN`);
      if (tournamentsResponse.ok) {
        const data = await tournamentsResponse.json();
        setUpcomingTournaments((data.tournaments || []).slice(0, 5));
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!org || !stats) return null;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-700",
      INACTIVE: "bg-gray-100 text-gray-700",
      DISBANDED: "bg-red-100 text-red-700",
    };
    return styles[status] || "bg-gray-100 text-gray-700";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inter-School Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Manage school teams and inter-school tournament participation
          </p>
        </div>
        <Badge className="bg-purple-100 text-purple-700 text-sm">
          Inter-School Mode
        </Badge>
      </div>

      {/* Important Notice */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-purple-900">Inter-School Competitions</h3>
              <p className="text-sm text-purple-700 mt-1">
                Teams are formed from your school&apos;s students only. No contract players allowed.
                Each team represents your school in external tournaments.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <Shield className={cn("w-5 h-5 mx-auto mb-1", primaryTextClass)} />
            <p className="text-lg font-bold text-gray-900">{stats.totalTeams}</p>
            <p className="text-xs text-gray-500">Teams</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold text-gray-900">{stats.totalTeamMembers}</p>
            <p className="text-xs text-gray-500">Team Members</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <Target className="w-5 h-5 mx-auto mb-1 text-purple-500" />
            <p className="text-lg font-bold text-gray-900">{stats.activeRegistrations}</p>
            <p className="text-xs text-gray-500">Registrations</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <Trophy className="w-5 h-5 mx-auto mb-1 text-orange-500" />
            <p className="text-lg font-bold text-gray-900">{stats.recentWins}</p>
            <p className="text-xs text-gray-500">Recent Wins</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <Medal className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <p className="text-lg font-bold text-gray-900">{stats.totalMedals}</p>
            <p className="text-xs text-gray-500">Medals</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-cyan-500" />
            <p className="text-lg font-bold text-gray-900">{upcomingTournaments.length}</p>
            <p className="text-xs text-gray-500">Upcoming</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* School Teams */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">School Teams</h2>
            <Button
              className={cn("text-white", primaryBtnClass)}
              size="sm"
              onClick={() => router.push(`/${sport}/org/school/inter/teams`)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Team
            </Button>
          </div>

          {teams.length === 0 ? (
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-8 text-center">
                <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-900">No teams created yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Create a school team to participate in inter-school tournaments
                </p>
                <Button
                  className={cn("mt-4 text-white", primaryBtnClass)}
                  onClick={() => router.push(`/${sport}/org/school/inter/teams`)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create First Team
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {teams.slice(0, 4).map((team) => (
                <Card 
                  key={team.id} 
                  className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/${sport}/org/school/inter/teams/${team.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-50">
                          <Shield className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{team.name}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {team.playerCount} players
                            </span>
                            <span className="flex items-center gap-1">
                              <Trophy className="w-3 h-3" />
                              {team.wins}W - {team.losses}L
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusBadge(team.status)}>{team.status}</Badge>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {teams.length > 4 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/${sport}/org/school/inter/teams`)}
                >
                  View All Teams ({teams.length})
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Upcoming Tournaments */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Tournaments</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/${sport}/org/school/inter/tournaments`)}
            >
              View All
            </Button>
          </div>

          {upcomingTournaments.length === 0 ? (
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-8 text-center">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-900">No upcoming tournaments</p>
                <p className="text-sm text-gray-500 mt-1">
                  Check back later for inter-school tournaments
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingTournaments.map((tournament) => (
                <Card 
                  key={tournament.id} 
                  className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/${sport}/tournaments/${tournament.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{tournament.name}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span>{tournament.location}{tournament.city ? `, ${tournament.city}` : ''}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(tournament.startDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Reg by {formatDate(tournament.regDeadline)}
                          </span>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-700">Open</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Results & Leaderboard */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Card 
              className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/${sport}/org/school/inter/results`)}
            >
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="font-medium text-gray-900">Results</p>
                <p className="text-xs text-gray-500">Past performances</p>
              </CardContent>
            </Card>
            <Card 
              className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/${sport}/org/school/inter/leaderboard`)}
            >
              <CardContent className="p-4 text-center">
                <Medal className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="font-medium text-gray-900">Leaderboard</p>
                <p className="text-xs text-gray-500">Team rankings</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className={cn("w-5 h-5", primaryTextClass)} />
              <div>
                <p className="font-medium text-gray-900">Ready to compete?</p>
                <p className="text-sm text-gray-500">
                  Create a team from your students and register for inter-school tournaments
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/${sport}/org/school/inter/tournaments`)}
              >
                Browse Tournaments
              </Button>
              <Button
                className={cn("text-white", primaryBtnClass)}
                onClick={() => router.push(`/${sport}/org/school/inter/teams`)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Team
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
