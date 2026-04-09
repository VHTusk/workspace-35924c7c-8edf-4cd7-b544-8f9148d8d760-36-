"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Sidebar from "@/components/layout/sidebar";
import {
  Users,
  UserPlus,
  Search,
  Calendar,
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Building2,
  MapPin,
  Mail,
  Phone,
  ArrowRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
  MailPlus,
  BarChart3,
  TrendingUp,
  Target,
  Flame,
  Zap,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  playerId: string;
  firstName: string;
  lastName: string;
  email?: string;
  city?: string;
  state?: string;
  elo: number;
  tier: string;
  matchesPlayed: number;
  wins: number;
  joinedAt: string;
}

interface PendingRequest {
  id: string;
  playerId: string;
  firstName: string;
  lastName: string;
  elo: number;
  tier: string;
  requestedAt: string;
  expiresAt: string;
}

interface Tournament {
  id: string;
  name: string;
  type: string;
  status: string;
  startDate: string;
  endDate?: string;
  registrationDeadline: string;
  city?: string;
  state?: string;
  scope: string;
  maxParticipants: number;
  currentParticipants: number;
  prizePool?: number;
}

interface OrgData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type: string;
  city?: string;
  state?: string;
  planTier: string;
  subscription?: {
    status: string;
    endDate: string;
  };
}

interface RosterStats {
  currentCount: number;
  maxCount: number;
  availableSlots: number;
  pendingCount: number;
}

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  city?: string;
  state?: string;
  hiddenElo: number;
  tier: string;
  matchesPlayed: number;
  isAvailable: boolean;
  unavailabilityReason?: string;
}

const MAX_ROSTER_SIZE = 25;

export default function OrgDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [rosterStats, setRosterStats] = useState<RosterStats | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Admin management state
  const [admins, setAdmins] = useState<Array<{
    id: string;
    userId: string;
    name: string;
    email?: string;
    phone?: string;
    city?: string;
    role: string;
    isActive: boolean;
    invitedAt: string;
    acceptedAt?: string;
    invitedBy?: string;
  }>>([]);
  const [pendingInvites, setPendingInvites] = useState<Array<{
    id: string;
    userId: string;
    name: string;
    email?: string;
    role: string;
    invitedAt: string;
    invitedBy?: string;
  }>>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("STAFF");
  const [showInviteForm, setShowInviteForm] = useState(false);

  // Leaderboard and Analytics state
  const [leaderboard, setLeaderboard] = useState<Array<{
    rank: number;
    userId: string;
    name: string;
    visiblePoints: number;
    tier: string;
    stats: { wins: number; losses: number; winRate: number; currentStreak: number; };
  }>>([]);
  const [analytics, setAnalytics] = useState<{
    overview: {
      totalMembers: number;
      activeMembers: number;
      totalWins: number;
      totalMatches: number;
      overallWinRate: number;
      avgPoints: number;
    };
    topPerformers: {
      byPoints: Array<{ userId: string; name: string; points: number }>;
      byWinRate: Array<{ userId: string; name: string; winRate: number }>;
      byStreak: Array<{ userId: string; name: string; streak: number }>;
    };
  } | null>(null);
  const [lbLoading, setLbLoading] = useState(false);

  useEffect(() => {
    fetchOrgData();
    fetchRoster();
    fetchTournaments();
    fetchAdmins();
  }, [sport]);

  const fetchOrgData = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        // Redirect CORPORATE organizations to the Corporate Dashboard
        if (data.type === "CORPORATE") {
          router.push(`/${sport}/org/corporate/intra`);
          return;
        }
        setOrg(data);
      }
    } catch (error) {
      console.error("Failed to fetch org:", error);
    }
  };

  const fetchRoster = async () => {
    try {
      const response = await fetch("/api/org/roster");
      if (response.ok) {
        const data = await response.json();
        setRoster(data.roster);
        setPendingRequests(data.pendingRequests);
        setRosterStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch roster:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTournaments = async () => {
    try {
      // Fetch only INTER_ORG and INTRA_ORG tournaments for this org
      const response = await fetch(`/api/org/tournaments`);
      if (response.ok) {
        const data = await response.json();
        setTournaments(data.tournaments);
      }
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await fetch("/api/org/admins");
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.admins || []);
        setPendingInvites(data.pendingInvitations || []);
      }
    } catch (error) {
      console.error("Failed to fetch admins:", error);
    }
  };

  const fetchLeaderboard = async () => {
    if (!org?.id) return;
    setLbLoading(true);
    try {
      const response = await fetch(`/api/org/leaderboard?orgId=${org.id}`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setLbLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!org?.id) return;
    try {
      const response = await fetch(`/api/org/analytics?orgId=${org.id}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    }
  };

  const inviteAdmin = async () => {
    if (!inviteEmail.trim()) return;

    setActionLoading("invite");
    setError("");

    try {
      const response = await fetch("/api/org/admins/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send invitation");
        return;
      }

      setSuccess(`Invited ${data.admin.name} as ${data.admin.role}`);
      setInviteEmail("");
      setShowInviteForm(false);
      fetchAdmins();
    } catch (error) {
      setError("Failed to send invitation");
    } finally {
      setActionLoading(null);
    }
  };

  const removeAdmin = async (adminId: string) => {
    if (!confirm("Are you sure you want to remove this admin?")) return;

    setActionLoading(adminId);
    setError("");

    try {
      const response = await fetch("/api/org/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to remove admin");
        return;
      }

      setSuccess("Admin removed successfully");
      fetchAdmins();
    } catch (error) {
      setError("Failed to remove admin");
    } finally {
      setActionLoading(null);
    }
  };

  const searchPlayers = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError("");

    try {
      const response = await fetch(
        `/api/leaderboard?search=${encodeURIComponent(searchQuery)}&sport=${sport.toUpperCase()}`
      );
      if (response.ok) {
        const data = await response.json();
        // Filter and check availability
        const results = (data.leaderboard || []).slice(0, 10).map((player: SearchResult) => ({
          ...player,
          isAvailable: true,
        }));
        setSearchResults(results);
      }
    } catch (error) {
      console.error("Search failed:", error);
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const sendRosterRequest = async (playerId: string) => {
    setActionLoading(playerId);
    setError("");

    try {
      const response = await fetch("/api/org/roster/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send request");
        return;
      }

      setSuccess(`Invitation sent to ${data.request.playerName}`);
      setSearchResults([]);
      setSearchQuery("");
      fetchRoster();
    } catch (error) {
      setError("Failed to send request");
    } finally {
      setActionLoading(null);
    }
  };

  const cancelRequest = async (requestId: string) => {
    setActionLoading(requestId);
    setError("");

    try {
      const response = await fetch("/api/org/roster/request", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to cancel request");
        return;
      }

      setSuccess("Request cancelled");
      fetchRoster();
    } catch (error) {
      setError("Failed to cancel request");
    } finally {
      setActionLoading(null);
    }
  };

  const removePlayer = async (playerId: string) => {
    if (!confirm("Are you sure you want to remove this player from your roster?")) return;

    setActionLoading(playerId);
    setError("");

    try {
      const response = await fetch("/api/org/roster", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to remove player");
        return;
      }

      setSuccess("Player removed from roster");
      fetchRoster();
    } catch (error) {
      setError("Failed to remove player");
    } finally {
      setActionLoading(null);
    }
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBorderClass = isCornhole ? "border-green-500" : "border-teal-500";

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      DIAMOND: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      PLATINUM: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
      GOLD: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      SILVER: "bg-muted text-muted-foreground",
      BRONZE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      UNRANKED: "bg-muted text-muted-foreground",
    };
    return (
      <Badge className={colors[tier] || colors.UNRANKED}>
        {tier}
      </Badge>
    );
  };

  const getTournamentTypeBadge = (type: string) => {
    if (type === "INTER_ORG") {
      return <Badge className="bg-blue-100 text-blue-700">Inter-Org</Badge>;
    }
    if (type === "INTRA_ORG") {
      return <Badge className="bg-purple-100 text-purple-700">Intra-Org</Badge>;
    }
    return <Badge>{type}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      REGISTRATION_OPEN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      REGISTRATION_CLOSED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      COMPLETED: "bg-muted text-muted-foreground",
      CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    const labels: Record<string, string> = {
      REGISTRATION_OPEN: "Open",
      REGISTRATION_CLOSED: "Closed",
      IN_PROGRESS: "Live",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    };
    return (
      <Badge className={colors[status] || "bg-muted text-muted-foreground"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72 min-h-screen">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Organization Dashboard</h1>
            <p className="text-gray-500">Welcome back, {org?.name || "Organization"}!</p>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4 bg-emerald-50 border-emerald-200 text-emerald-700">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Org Info Card */}
          {org && (
            <Card className="bg-white border-gray-100 shadow-sm mb-6">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-16 h-16 rounded-xl flex items-center justify-center", primaryBgClass)}>
                      <Building2 className={cn("w-8 h-8", primaryTextClass)} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{org.name}</h2>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <Badge variant="outline">{org.type}</Badge>
                        {org.city && org.state && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {org.city}, {org.state}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        {org.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {org.email}
                          </span>
                        )}
                        {org.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {org.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/${sport}/org/profile`)}
                    className="gap-2"
                  >
                    Edit Profile
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Roster Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900">
                  {rosterStats?.currentCount || 0}/{MAX_ROSTER_SIZE}
                </p>
                <p className="text-xs text-gray-500">Roster Players</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <UserPlus className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{rosterStats?.pendingCount || 0}</p>
                <p className="text-xs text-gray-500">Pending Invites</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Calendar className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{tournaments.length}</p>
                <p className="text-xs text-gray-500">Tournaments</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{org?.planTier || "BASIC"}</p>
                <p className="text-xs text-gray-500">Plan</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="roster" className="space-y-4">
            <TabsList className="bg-white border border-gray-200">
              <TabsTrigger value="roster" className="gap-2">
                <Users className="w-4 h-4" />
                Manage Players
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="gap-2" onClick={fetchLeaderboard}>
                <Trophy className="w-4 h-4" />
                Leaderboard
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2" onClick={fetchAnalytics}>
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="tournaments" className="gap-2">
                <Calendar className="w-4 h-4" />
                Tournaments
              </TabsTrigger>
              <TabsTrigger value="admins" className="gap-2">
                <Shield className="w-4 h-4" />
                Admins
              </TabsTrigger>
            </TabsList>

            {/* Roster Tab */}
            <TabsContent value="roster" className="space-y-4">
              {/* Search Players */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Add Players to Roster</CardTitle>
                  <CardDescription>
                    Search leaderboard to find players. Max {MAX_ROSTER_SIZE} players per roster.
                    {rosterStats && ` ${rosterStats.availableSlots} slots available.`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search players by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchPlayers()}
                        className="pl-10"
                      />
                    </div>
                    <Button onClick={searchPlayers} disabled={searching} className={cn("text-white", primaryBtnClass)}>
                      {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                    </Button>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="border rounded-lg divide-y">
                      {searchResults.map((player) => {
                        const alreadyInRoster = roster.some(r => r.playerId === player.id);
                        const alreadyRequested = pendingRequests.some(r => r.playerId === player.id);
                        
                        return (
                          <div key={player.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-600">
                                  {player.firstName[0]}{player.lastName[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {player.firstName} {player.lastName}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  {getTierBadge(player.tier)}
                                  <span>{player.matchesPlayed} matches</span>
                                  {player.city && <span>• {player.city}</span>}
                                </div>
                              </div>
                            </div>
                            <div>
                              {alreadyInRoster ? (
                                <Badge className="bg-emerald-100 text-emerald-700">In Roster</Badge>
                              ) : alreadyRequested ? (
                                <Badge className="bg-amber-100 text-amber-700">Invite Sent</Badge>
                              ) : rosterStats?.availableSlots === 0 ? (
                                <Badge className="bg-gray-100 text-gray-500">Roster Full</Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => sendRosterRequest(player.id)}
                                  disabled={actionLoading === player.id}
                                  className={cn("text-white", primaryBtnClass)}
                                >
                                  {actionLoading === player.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <UserPlus className="w-4 h-4 mr-1" />
                                      Invite
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pending Requests */}
              {pendingRequests.length > 0 && (
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-gray-900">Pending Invitations</CardTitle>
                    <CardDescription>
                      Invitations expire after 7 days. Players can accept or decline.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pendingRequests.map((request) => {
                        const expiresDate = new Date(request.expiresAt);
                        const daysLeft = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        
                        return (
                          <div key={request.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-amber-700">
                                  {request.firstName[0]}{request.lastName[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {request.firstName} {request.lastName}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  {getTierBadge(request.tier)}
                                  <span className="text-amber-600">
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    Expires in {daysLeft} days
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelRequest(request.id)}
                              disabled={actionLoading === request.id}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              {actionLoading === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Current Roster */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Current Roster ({roster.length}/{MAX_ROSTER_SIZE})</CardTitle>
                  <CardDescription>
                    Players in your roster can be selected for tournament participation.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {roster.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No players in roster yet</p>
                      <p className="text-sm">Search and invite players from the leaderboard</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg divide-y">
                      {roster.map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-600">
                                {player.firstName[0]}{player.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {player.firstName} {player.lastName}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {getTierBadge(player.tier)}
                                <span>{player.wins}W - {player.matchesPlayed - player.wins}L</span>
                                {player.city && <span>• {player.city}</span>}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removePlayer(player.playerId)}
                            disabled={actionLoading === player.playerId}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {actionLoading === player.playerId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard" className="space-y-4">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Intra-Org Leaderboard
                  </CardTitle>
                  <CardDescription>
                    Rankings of all players in your organization based on points.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {lbLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : leaderboard.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No players ranked yet</p>
                      <p className="text-sm">Add players to your roster to see rankings</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg divide-y">
                      {leaderboard.map((player) => (
                        <div key={player.userId} className="flex items-center justify-between p-3 hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                              player.rank === 1 ? "bg-yellow-100 text-yellow-700" :
                              player.rank === 2 ? "bg-gray-100 text-gray-600" :
                              player.rank === 3 ? "bg-amber-100 text-amber-700" :
                              "bg-gray-50 text-gray-500"
                            )}>
                              {player.rank}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{player.name}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Badge variant="outline" className="text-xs">{player.tier}</Badge>
                                <span>{player.stats.wins}W - {player.stats.losses}L</span>
                                {player.stats.currentStreak > 0 && (
                                  <span className="text-orange-500 flex items-center gap-1">
                                    <Flame className="w-3 h-3" />
                                    {player.stats.currentStreak}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">{player.visiblePoints.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">points</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-4">
              {analytics ? (
                <>
                  {/* Overview Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Card className="bg-white border-gray-100 shadow-sm">
                      <CardContent className="p-4 text-center">
                        <Users className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                        <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalMembers}</p>
                        <p className="text-xs text-gray-500">Total Members</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-gray-100 shadow-sm">
                      <CardContent className="p-4 text-center">
                        <Target className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                        <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalMatches}</p>
                        <p className="text-xs text-gray-500">Total Matches</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-gray-100 shadow-sm">
                      <CardContent className="p-4 text-center">
                        <TrendingUp className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                        <p className="text-2xl font-bold text-gray-900">{analytics.overview.overallWinRate}%</p>
                        <p className="text-xs text-gray-500">Win Rate</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-gray-100 shadow-sm">
                      <CardContent className="p-4 text-center">
                        <Award className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                        <p className="text-2xl font-bold text-gray-900">{analytics.overview.avgPoints}</p>
                        <p className="text-xs text-gray-500">Avg Points</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Top Performers */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Top by Points */}
                    <Card className="bg-white border-gray-100 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Award className="w-4 h-4 text-amber-500" />
                          Top by Points
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analytics.topPerformers.byPoints.map((player, i) => (
                            <div key={player.userId} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium">
                                  {i + 1}
                                </span>
                                <span className="text-sm text-gray-900">{player.name}</span>
                              </div>
                              <span className="text-sm font-medium text-gray-600">{player.points}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Top by Win Rate */}
                    <Card className="bg-white border-gray-100 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          Top Win Rate
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analytics.topPerformers.byWinRate.map((player, i) => (
                            <div key={player.userId} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium">
                                  {i + 1}
                                </span>
                                <span className="text-sm text-gray-900">{player.name}</span>
                              </div>
                              <span className="text-sm font-medium text-emerald-600">{player.winRate}%</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Top Streaks */}
                    <Card className="bg-white border-gray-100 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Flame className="w-4 h-4 text-orange-500" />
                          Active Streaks
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {analytics.topPerformers.byStreak.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">No active streaks</p>
                        ) : (
                          <div className="space-y-2">
                            {analytics.topPerformers.byStreak.map((player, i) => (
                              <div key={player.userId} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium">
                                    {i + 1}
                                  </span>
                                  <span className="text-sm text-gray-900">{player.name}</span>
                                </div>
                                <span className="text-sm font-medium text-orange-600 flex items-center gap-1">
                                  <Flame className="w-3 h-3" />
                                  {player.streak}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Loading analytics...</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tournaments Tab */}
            <TabsContent value="tournaments" className="space-y-4">
              {/* Create Tournament Button */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">Request Tournament</h3>
                      <p className="text-sm text-gray-500">Submit a tournament request for admin approval</p>
                    </div>
                    <Link href={`/${sport}/org/request-tournament`}>
                      <Button className={cn("text-white gap-2", primaryBtnClass)}>
                        <Trophy className="w-4 h-4" />
                        Request Tournament
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Your Tournaments</CardTitle>
                  <CardDescription>
                    Inter-organization and intra-organization tournaments for your org.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tournaments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No tournaments available</p>
                      <p className="text-sm">Register for inter-org tournaments or create intra-org tournaments</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tournaments.map((tournament) => (
                        <Link
                          key={tournament.id}
                          href={`/${sport}/tournaments/${tournament.id}`}
                          className="block p-4 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {getTournamentTypeBadge(tournament.type)}
                                {getStatusBadge(tournament.status)}
                              </div>
                              <p className="font-medium text-gray-900">{tournament.name}</p>
                              <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(tournament.startDate).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {tournament.currentParticipants}/{tournament.maxParticipants}
                                </span>
                                {tournament.prizePool && (
                                  <span className="flex items-center gap-1">
                                    <Trophy className="w-3 h-3" />
                                    ₹{tournament.prizePool.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Admins Tab */}
            <TabsContent value="admins" className="space-y-4">
              {/* Invite Admin */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Manage Organization Admins</CardTitle>
                  <CardDescription>
                    Invite players to help manage your organization. Admins can manage roster and register for tournaments.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!showInviteForm ? (
                    <Button
                      onClick={() => setShowInviteForm(true)}
                      className={cn("text-white gap-2", primaryBtnClass)}
                    >
                      <MailPlus className="w-4 h-4" />
                      Invite Admin
                    </Button>
                  ) : (
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="text-sm text-gray-600 mb-1 block">Player Email</label>
                          <Input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="player@example.com"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Player must be registered on the platform for this sport
                          </p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-600 mb-1 block">Role</label>
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                          >
                            <option value="STAFF">Staff</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={inviteAdmin}
                          disabled={actionLoading === "invite" || !inviteEmail.trim()}
                          className={cn("text-white", primaryBtnClass)}
                        >
                          {actionLoading === "invite" ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Send Invitation
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowInviteForm(false);
                            setInviteEmail("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Current Admins */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Organization Admins ({admins.length})</CardTitle>
                  <CardDescription>
                    Role permissions: PRIMARY (full access), ADMIN (manage roster & tournaments), STAFF (view only)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {admins.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No admins yet</p>
                      <p className="text-sm">Invite admins to help manage your organization</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {admins.map((admin) => {
                        const getRoleIcon = (role: string) => {
                          switch (role) {
                            case "PRIMARY":
                              return <ShieldCheck className="w-4 h-4 text-purple-600" />;
                            case "ADMIN":
                              return <Shield className="w-4 h-4 text-blue-600" />;
                            default:
                              return <ShieldAlert className="w-4 h-4 text-gray-500" />;
                          }
                        };

                        const getRoleBadge = (role: string) => {
                          switch (role) {
                            case "PRIMARY":
                              return "bg-purple-100 text-purple-700";
                            case "ADMIN":
                              return "bg-blue-100 text-blue-700";
                            default:
                              return "bg-gray-100 text-gray-600";
                          }
                        };

                        return (
                          <div
                            key={admin.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-600">
                                  {admin.name.split(" ").map((n) => n[0]).join("")}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{admin.name}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  {getRoleIcon(admin.role)}
                                  <Badge className={getRoleBadge(admin.role)}>{admin.role}</Badge>
                                  {admin.email && <span>• {admin.email}</span>}
                                  {admin.acceptedAt && (
                                    <span className="text-emerald-600">
                                      <CheckCircle className="w-3 h-3 inline mr-1" />
                                      Active
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {admin.role !== "PRIMARY" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeAdmin(admin.id)}
                                disabled={actionLoading === admin.id}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                {actionLoading === admin.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
