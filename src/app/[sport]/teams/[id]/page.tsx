"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Search,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trophy,
  Target,
  Calendar,
  MapPin,
  RefreshCw,
  UserPlus,
  Mail,
  X,
  ChevronRight,
  Crown,
  Medal,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    hiddenElo: number;
    visiblePoints: number;
    city: string | null;
    state: string | null;
  };
}

interface Team {
  id: string;
  name: string;
  sport: string;
  format: string;
  status: string;
  teamElo: number;
  wins: number;
  losses: number;
  points: number;
  matchesPlayed: number;
  captainId: string;
  createdAt: string;
  isMember?: boolean;
  userRole?: string | null;
  members: TeamMember[];
}

interface Invitation {
  id: string;
  invitee: {
    id: string;
    firstName: string;
    lastName: string;
    hiddenElo: number;
  };
  expiresAt: string;
}

interface TournamentReg {
  id: string;
  status: string;
  registeredAt: string;
  tournament: {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    location: string;
    prizePool: number;
  };
}

interface Match {
  id: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
  playedAt: string;
  tournament: {
    id: string;
    name: string;
  } | null;
  teamA: {
    id: string;
    name: string;
    members: {
      user: { firstName: string; lastName: string };
    }[];
  };
  teamB: {
    id: string;
    name: string;
    members: {
      user: { firstName: string; lastName: string };
    }[];
  };
}

interface PlayerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hiddenElo: number;
  visiblePoints: number;
  city: string | null;
  state: string | null;
  matchesPlayed: number;
  isInTeam: boolean;
  canInvite: boolean;
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const teamId = params.id as string;
  const isCornhole = sport === "cornhole";

  const [team, setTeam] = useState<Team | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [tournamentRegs, setTournamentRegs] = useState<TournamentReg[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit team state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Invite member state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Dissolve team state
  const [dissolving, setDissolving] = useState(false);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";

  // Fetch team data
  useEffect(() => {
    const fetchTeam = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/teams/${teamId}`);
        
        if (!res.ok) {
          if (res.status === 404) {
            setError("Team not found");
          } else {
            setError("Failed to load team");
          }
          return;
        }

        const data = await res.json();
        setTeam(data.team);
        setInvitations(data.invitations || []);
        setTournamentRegs(data.tournamentRegistrations || []);
        setRecentMatches(data.recentMatches || []);
        setEditName(data.team.name);
      } catch (err) {
        console.error("Failed to fetch team:", err);
        setError("Failed to load team");
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [teamId]);

  // Search for players
  useEffect(() => {
    const searchPlayers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        const res = await fetch(`/api/teams/search-players?q=${encodeURIComponent(searchQuery)}&sport=${sport.toUpperCase()}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.players || []);
        }
      } catch (err) {
        console.error("Search failed:", err);
      }
    };

    const debounce = setTimeout(searchPlayers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, sport]);

  // Check if user is captain
  const isCaptain = team?.userRole === "CAPTAIN";
  const isMember = team?.isMember;

  // Update team name
  const handleUpdateTeam = async () => {
    if (!editName.trim()) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update team");

      setTeam({ ...team!, name: editName.trim() });
      setShowEditModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update team");
    } finally {
      setSaving(false);
    }
  };

  // Invite member
  const handleInviteMember = async () => {
    if (!selectedPlayer) return;

    try {
      setInviting(true);
      setInviteError(null);

      const res = await fetch("/api/teams/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          inviteeId: selectedPlayer.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invitation");

      // Refresh team data
      const teamRes = await fetch(`/api/teams/${teamId}`);
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setInvitations(teamData.invitations || []);
      }

      setShowInviteModal(false);
      setSelectedPlayer(null);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  // Cancel invitation
  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch("/api/teams/invitations/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });

      if (!res.ok) throw new Error("Failed to cancel invitation");

      setInvitations(invitations.filter(inv => inv.id !== invitationId));
    } catch (err) {
      alert("Failed to cancel invitation");
    }
  };

  // Dissolve team
  const handleDissolveTeam = async () => {
    try {
      setDissolving(true);
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dissolve team");

      router.push(`/${sport}/teams`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to dissolve team");
    } finally {
      setDissolving(false);
    }
  };

  // Transfer captaincy
  const handleTransferCaptaincy = async (newCaptainId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newCaptainId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to transfer captaincy");

      // Refresh team data
      const teamRes = await fetch(`/api/teams/${teamId}`);
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeam(teamData.team);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to transfer captaincy");
    }
  };

  // Remove member
  const handleRemoveMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members?memberId=${memberId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove member");

      // Refresh team data
      const teamRes = await fetch(`/api/teams/${teamId}`);
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeam(teamData.team);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline" className="text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" />Waiting for Partner</Badge>;
      case "ACTIVE":
        return <Badge variant="outline" className="text-green-600 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Sidebar userType="player" />
        <main className="ml-0 md:ml-72">
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Sidebar userType="player" />
        <main className="ml-0 md:ml-72">
          <div className="p-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-red-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{error || "Team not found"}</h3>
                <Button onClick={() => router.push(`/${sport}/teams`)} variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Teams
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const winRate = team.matchesPlayed > 0 ? Math.round((team.wins / team.matchesPlayed) * 100) : 0;

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Back Button */}
          <Button variant="ghost" className="mb-4" onClick={() => router.push(`/${sport}/teams`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Teams
          </Button>

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
                {getStatusBadge(team.status)}
              </div>
              <p className="text-gray-500">
                {team.format} Team • Created {new Date(team.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            {isCaptain && (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowEditModal(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={tournamentRegs.length > 0}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Dissolve
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Dissolve Team</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to dissolve this team? This action cannot be undone.
                        All pending invitations will be cancelled.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDissolveTeam}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={dissolving}
                      >
                        {dissolving ? "Dissolving..." : "Dissolve Team"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Column - Team Info */}
            <div className="col-span-2 space-y-6">
              {/* Team Members */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="w-5 h-5" />
                      Team Members
                    </CardTitle>
                    {isCaptain && team.members.length < (team.format === "DOUBLES" ? 2 : 4) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowInviteModal(true)}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {team.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className={cn(
                              member.role === "CAPTAIN" ? primaryBgClass : "bg-gray-100",
                              member.role === "CAPTAIN" ? primaryTextClass : "text-gray-600"
                            )}>
                              {member.user.firstName[0]}{member.user.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {member.user.firstName} {member.user.lastName}
                              </p>
                              {member.role === "CAPTAIN" && (
                                <Badge className={cn(primaryBgClass, primaryTextClass, primaryBorderClass)}>
                                  <Crown className="w-3 h-3 mr-1" />
                                  Captain
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              ELO: {Math.round(member.user.hiddenElo)} • {member.user.city && member.user.state ? `${member.user.city}, ${member.user.state}` : "Location not set"}
                            </p>
                          </div>
                        </div>
                        {isCaptain && member.role !== "CAPTAIN" && tournamentRegs.length === 0 && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTransferCaptaincy(member.userId)}
                            >
                              <Crown className="w-3 h-3 mr-1" />
                              Make Captain
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleRemoveMember(member.userId)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Pending Invitations */}
                    {invitations.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-amber-100 text-amber-600">
                              {inv.invitee.firstName[0]}{inv.invitee.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-amber-700">
                              {inv.invitee.firstName} {inv.invitee.lastName}
                            </p>
                            <p className="text-xs text-amber-600">
                              Invitation Pending • Expires {new Date(inv.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {isCaptain && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleCancelInvitation(inv.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Matches */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="w-5 h-5" />
                    Recent Matches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentMatches.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Target className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p>No matches yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentMatches.map((match) => {
                        const isTeamA = match.teamA.id === teamId;
                        const ourScore = isTeamA ? match.scoreA : match.scoreB;
                        const theirScore = isTeamA ? match.scoreB : match.scoreA;
                        const opponentTeam = isTeamA ? match.teamB : match.teamA;
                        const didWin = match.winnerTeamId === teamId;
                        const isDraw = match.winnerTeamId === null && ourScore !== null;

                        return (
                          <div key={match.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                            <div>
                              <p className="font-medium">
                                vs {opponentTeam.members.map(m => `${m.user.firstName} ${m.user.lastName[0]}.`).join(" & ")}
                              </p>
                              <p className="text-xs text-gray-500">
                                {match.tournament?.name || "Friendly"} • {new Date(match.playedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={cn(
                                  "font-bold text-lg",
                                  didWin ? "text-green-600" : "text-red-600"
                                )}>
                                  {ourScore ?? "-"} - {theirScore ?? "-"}
                                </p>
                                <Badge variant="outline" className={cn(
                                  didWin ? "text-green-600 border-green-200" : "text-red-600 border-red-200"
                                )}>
                                  {didWin ? "Won" : "Lost"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tournament Registrations */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Trophy className="w-5 h-5" />
                    Tournament Registrations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tournamentRegs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Trophy className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p>No tournament registrations yet</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => router.push(`/${sport}/tournaments`)}
                      >
                        Browse Tournaments
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tournamentRegs.map((reg) => (
                        <Link
                          key={reg.id}
                          href={`/${sport}/tournaments/${reg.tournament.id}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border hover:bg-gray-100 transition-colors"
                        >
                          <div>
                            <p className="font-medium">{reg.tournament.name}</p>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(reg.tournament.startDate).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {reg.tournament.location}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{reg.status}</Badge>
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Stats */}
            <div className="space-y-6">
              {/* Team Rating */}
              <Card className={cn("border shadow-sm", primaryBorderClass)}>
                <CardContent className="p-6 text-center">
                  <div className={cn("inline-flex items-center justify-center w-16 h-16 rounded-full mb-3", primaryBgClass)}>
                    <Medal className={cn("w-8 h-8", primaryTextClass)} />
                  </div>
                  <p className="text-4xl font-bold">{Math.round(team.teamElo)}</p>
                  <p className="text-sm text-gray-500 mt-1">Team ELO Rating</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Average of member ELOs
                  </p>
                </CardContent>
              </Card>

              {/* Team Stats */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg bg-green-50">
                      <p className="text-2xl font-bold text-green-600">{team.wins}</p>
                      <p className="text-xs text-gray-500">Wins</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-50">
                      <p className="text-2xl font-bold text-red-600">{team.losses}</p>
                      <p className="text-xs text-gray-500">Losses</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-gray-50">
                      <p className="text-2xl font-bold">{team.matchesPlayed}</p>
                      <p className="text-xs text-gray-500">Matches</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-gray-50">
                      <p className="text-2xl font-bold">{winRate}%</p>
                      <p className="text-xs text-gray-500">Win Rate</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Tournaments</span>
                      <span className="font-medium">{tournamentRegs.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-gray-500">Total Points</span>
                      <span className="font-medium">{team.points}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Team Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update your team details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Team Name</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={50}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button
              onClick={handleUpdateTeam}
              disabled={saving || !editName.trim()}
              className={cn(isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700")}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Search for a player to invite to your team.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedPlayer ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={cn(primaryBgClass, primaryTextClass)}>
                      {selectedPlayer.firstName[0]}{selectedPlayer.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedPlayer.firstName} {selectedPlayer.lastName}</p>
                    <p className="text-xs text-gray-500">ELO: {selectedPlayer.hiddenElo} • {selectedPlayer.matchesPlayed} matches</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPlayer(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                    {searchResults.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => player.canInvite && setSelectedPlayer(player)}
                        disabled={!player.canInvite}
                        className={cn(
                          "w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors",
                          !player.canInvite && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className={cn(primaryBgClass, primaryTextClass)}>
                              {player.firstName[0]}{player.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-left">
                            <p className="font-medium text-sm">{player.firstName} {player.lastName}</p>
                            <p className="text-xs text-gray-500">
                              ELO: {player.hiddenElo} • {player.matchesPlayed} matches
                            </p>
                          </div>
                        </div>
                        {player.isInTeam ? (
                          <Badge variant="outline" className="text-gray-400">In Team</Badge>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {inviteError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {inviteError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowInviteModal(false);
              setSelectedPlayer(null);
              setSearchQuery("");
              setSearchResults([]);
              setInviteError(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleInviteMember}
              disabled={inviting || !selectedPlayer}
              className={cn(isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700")}
            >
              {inviting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
