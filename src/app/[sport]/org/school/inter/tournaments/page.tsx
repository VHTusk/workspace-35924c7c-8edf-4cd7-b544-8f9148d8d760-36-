"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy,
  Calendar,
  Users,
  MapPin,
  Clock,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Eye,
  Shield,
  Search,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Tournament {
  id: string;
  name: string;
  description?: string;
  type: string;
  scope: string;
  status: string;
  startDate: string;
  endDate?: string;
  location: string;
  city?: string;
  state?: string;
  maxPlayers: number;
  currentParticipants: number;
  entryFee: number;
  prizePool?: number;
  regDeadline: string;
  createdAt: string;
}

interface SchoolTeam {
  id: string;
  name: string;
  status: string;
  playerCount: number;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function InterSchoolTournamentsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [org, setOrg] = useState<OrgData | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [filteredTournaments, setFilteredTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<SchoolTeam[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchOrg();
  }, [sport]);

  useEffect(() => {
    if (org?.id) {
      fetchData();
    }
  }, [org?.id, sport]);

  useEffect(() => {
    filterTournaments();
  }, [searchQuery, statusFilter, scopeFilter, tournaments]);

  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
        if (data.type !== "SCHOOL") {
          router.push(`/${sport}/org/home`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch tournaments - INTER_ORG type for inter-school
      const tournamentsResponse = await fetch(`/api/tournaments?sport=${sport.toUpperCase()}&type=INTER_ORG`);
      if (tournamentsResponse.ok) {
        const data = await tournamentsResponse.json();
        setTournaments(data.tournaments || []);
        setFilteredTournaments(data.tournaments || []);
      }

      // Fetch teams
      const teamsResponse = await fetch(`/api/orgs/${org?.id}/school-teams?sport=${sport.toUpperCase()}`);
      if (teamsResponse.ok) {
        const data = await teamsResponse.json();
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  };

  const filterTournaments = () => {
    let filtered = [...tournaments];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.location.toLowerCase().includes(query) ||
          t.city?.toLowerCase().includes(query) ||
          t.state?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    if (scopeFilter !== "all") {
      filtered = filtered.filter((t) => t.scope === scopeFilter);
    }

    setFilteredTournaments(filtered);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-700",
      REGISTRATION_OPEN: "bg-green-100 text-green-700",
      REGISTRATION_CLOSED: "bg-amber-100 text-amber-700",
      IN_PROGRESS: "bg-blue-100 text-blue-700",
      COMPLETED: "bg-purple-100 text-purple-700",
      CANCELLED: "bg-red-100 text-red-700",
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const openCount = tournaments.filter((t) => t.status === "REGISTRATION_OPEN").length;
  const inProgressCount = tournaments.filter((t) => t.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/${sport}/org/school/inter`)}
            className="mb-2 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Shield className="w-4 h-4" />
              <span>Inter-School</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
            <p className="text-gray-500">Browse and register for inter-school tournaments</p>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-purple-900">Inter-School Competitions</h3>
                <p className="text-sm text-purple-700 mt-1">
                  Register your school team for inter-school tournaments. Teams must be formed from your school&apos;s students only - no contract players allowed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Trophy className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
              <p className="text-2xl font-bold text-gray-900">{tournaments.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold text-gray-900">{openCount}</p>
              <p className="text-xs text-gray-500">Open for Registration</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Shield className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-gray-900">{teams.length}</p>
              <p className="text-xs text-gray-500">Your Teams</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold text-gray-900">{inProgressCount}</p>
              <p className="text-xs text-gray-500">In Progress</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search tournaments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="REGISTRATION_OPEN">Open</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scopes</SelectItem>
              <SelectItem value="CITY">City</SelectItem>
              <SelectItem value="DISTRICT">District</SelectItem>
              <SelectItem value="STATE">State</SelectItem>
              <SelectItem value="NATIONAL">National</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error */}
        {error && (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Tournaments List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredTournaments.length === 0 ? (
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-12 text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery || statusFilter !== "all" || scopeFilter !== "all"
                  ? "No tournaments match your filters"
                  : "No inter-school tournaments available"}
              </h3>
              <p className="text-gray-500">
                Check back later for inter-school tournaments
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTournaments.map((tournament) => (
              <Card
                key={tournament.id}
                className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/${sport}/tournaments/${tournament.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", primaryBgClass)}>
                        <Trophy className={cn("w-6 h-6", primaryTextClass)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{tournament.name}</h3>
                          {getStatusBadge(tournament.status)}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {tournament.location}
                            {tournament.city && `, ${tournament.city}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(tournament.startDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {tournament.currentParticipants}/{tournament.maxPlayers}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Reg by {formatDate(tournament.regDeadline)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/${sport}/tournaments/${tournament.id}`);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
