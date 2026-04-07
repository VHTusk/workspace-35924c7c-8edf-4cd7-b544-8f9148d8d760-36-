"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trophy,
  Target,
  RefreshCw,
  UserPlus,
  Mail,
  X,
  ChevronRight,
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
  };
}

interface Team {
  id: string;
  name: string;
  sport: string;
  status: string;
  teamElo: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  createdAt: string;
  members: TeamMember[];
  pendingInvitations: {
    id: string;
    invitee: {
      id: string;
      firstName: string;
      lastName: string;
      hiddenElo: number;
    };
  }[];
  tournamentCount: number;
}

interface PlayerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  city: string | null;
  state: string | null;
  elo: number;
  points: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  isInTeam: boolean;
  canInvite: boolean;
}

interface Invitation {
  id: string;
  team: {
    id: string;
    name: string;
    sport: string;
    teamElo: number;
    captain: {
      id: string;
      firstName: string;
      lastName: string;
      hiddenElo: number;
    };
  };
  inviter: {
    id: string;
    firstName: string;
    lastName: string;
    hiddenElo: number;
  };
  createdAt: string;
  expiresAt: string;
  canAccept: boolean;
}

export default function DashboardTeamsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [teams, setTeams] = useState<Team[]>([]);
  const [receivedInvitations, setReceivedInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<PlayerSearchResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const sportUpper = sport.toUpperCase();

        const teamsRes = await fetch(`/api/teams?sport=${sportUpper}`);
        if (teamsRes.ok) {
          const data = await teamsRes.json();
          setTeams(data.teams || []);
        }

        const invRes = await fetch(`/api/teams/invitations?type=received&sport=${sportUpper}`);
        if (invRes.ok) {
          const data = await invRes.json();
          setReceivedInvitations(data.invitations || []);
        }
      } catch (err) {
        console.error("Failed to fetch teams:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sport]);

  useEffect(() => {
    const searchPlayers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        const sportUpper = sport.toUpperCase();
        const res = await fetch(`/api/teams/search-players?q=${encodeURIComponent(searchQuery)}&sport=${sportUpper}`);
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

  const handleCreateTeam = async () => {
    if (!teamName.trim() || !selectedPartner) {
      setCreateError("Please enter a team name and select a partner");
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);

      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName.trim(),
          sport: sport.toUpperCase(),
          partnerId: selectedPartner.id,
          format: "DOUBLES",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create team");
      }

      const teamsRes = await fetch(`/api/teams?sport=${sport.toUpperCase()}`);
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData.teams || []);
      }

      setShowCreateModal(false);
      setTeamName("");
      setSearchQuery("");
      setSelectedPartner(null);
      setSearchResults([]);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setCreating(false);
    }
  };

  const handleAcceptInvite = async (invitationId: string) => {
    try {
      setProcessingInvite(invitationId);
      const res = await fetch("/api/teams/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept invitation");
      }

      const [teamsRes, invRes] = await Promise.all([
        fetch(`/api/teams?sport=${sport.toUpperCase()}`),
        fetch(`/api/teams/invitations?type=received&sport=${sport.toUpperCase()}`),
      ]);

      if (teamsRes.ok) {
        const data = await teamsRes.json();
        setTeams(data.teams || []);
      }
      if (invRes.ok) {
        const data = await invRes.json();
        setReceivedInvitations(data.invitations || []);
      }
    } catch (err) {
      console.error("Failed to accept invitation:", err);
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleDeclineInvite = async (invitationId: string) => {
    try {
      setProcessingInvite(invitationId);
      const res = await fetch("/api/teams/invitations/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to decline invitation");
      }

      setReceivedInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } catch (err) {
      console.error("Failed to decline invitation:", err);
    } finally {
      setProcessingInvite(null);
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
      <div className="p-6 max-w-6xl flex items-center justify-center min-h-[40vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Teams</h1>
          <p className="text-muted-foreground">Manage your doubles teams for {isCornhole ? "Cornhole" : "Darts"}</p>
        </div>
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogTrigger asChild>
            <Button className={primaryBtnClass}>
              <Plus className="w-4 h-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Doubles Team</DialogTitle>
              <DialogDescription>
                Create a team and invite a partner. You'll be the team captain and will handle tournament registrations.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  placeholder="e.g., Cornhole Crushers"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label>Find Your Partner</Label>
                <p className="text-xs text-muted-foreground">
                  Both players must have a VALORHIVE account for {isCornhole ? "Cornhole" : "Darts"}
                </p>
                
                {selectedPartner ? (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted border">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className={cn(primaryBgClass, primaryTextClass)}>
                          {selectedPartner.firstName[0]}{selectedPartner.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{selectedPartner.firstName} {selectedPartner.lastName}</p>
                        <p className="text-xs text-muted-foreground">ELO: {selectedPartner.elo} • Win Rate: {selectedPartner.winRate}%</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPartner(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                            onClick={() => player.canInvite && setSelectedPartner(player)}
                            disabled={!player.canInvite}
                            className={cn(
                              "w-full flex items-center justify-between p-3 hover:bg-muted transition-colors",
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
                                <p className="text-xs text-muted-foreground">
                                  ELO: {player.elo} • {player.matchesPlayed} matches
                                </p>
                              </div>
                            </div>
                            {player.isInTeam ? (
                              <Badge variant="outline" className="text-muted-foreground">In Team</Badge>
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {createError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {createError}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateTeam}
                disabled={creating || !teamName.trim() || !selectedPartner}
                className={cn("text-white", primaryBtnClass)}
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create & Invite
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Received Invitations */}
      {receivedInvitations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="w-5 h-5" />
              Team Invitations
              <Badge className="bg-amber-100 text-amber-700">{receivedInvitations.length} pending</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {receivedInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-4 rounded-lg bg-muted border">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <Avatar className="h-12 w-12 mx-auto mb-1">
                        <AvatarFallback className={cn(primaryBgClass, primaryTextClass)}>
                          {invitation.team.captain.firstName[0]}{invitation.team.captain.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-xs text-muted-foreground">Captain</p>
                    </div>
                    <div className="text-center">
                      <Users className={cn("w-6 h-6 mx-auto mb-1", primaryTextClass)} />
                      <p className="font-medium">{invitation.team.name}</p>
                      <p className="text-xs text-muted-foreground">Team ELO: {Math.round(invitation.team.teamElo)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeclineInvite(invitation.id)}
                      disabled={processingInvite === invitation.id}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvite(invitation.id)}
                      disabled={processingInvite === invitation.id || !invitation.canAccept}
                      className={cn("text-white", primaryBtnClass)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Accept
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teams List */}
      {teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Teams Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a doubles team to participate in team tournaments
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className={cn("text-white", primaryBtnClass)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">{team.name}</h3>
                      {getStatusBadge(team.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(team.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{Math.round(team.teamElo)}</p>
                    <p className="text-xs text-muted-foreground">Team ELO</p>
                  </div>
                </div>

                {/* Team Members */}
                <div className="flex items-center gap-4 mb-4">
                  {team.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-2">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className={cn(
                          member.role === "CAPTAIN" ? primaryBgClass : "bg-muted",
                          member.role === "CAPTAIN" ? primaryTextClass : "text-muted-foreground"
                        )}>
                          {member.user.firstName[0]}{member.user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {member.user.firstName} {member.user.lastName}
                          {member.role === "CAPTAIN" && <span className="text-xs text-muted-foreground ml-1">(Captain)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">ELO: {Math.round(member.user.hiddenElo)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <Trophy className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-bold">{team.wins}</p>
                    <p className="text-xs text-muted-foreground">Wins</p>
                  </div>
                  <div className="text-center">
                    <Target className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-bold">{team.losses}</p>
                    <p className="text-xs text-muted-foreground">Losses</p>
                  </div>
                  <div className="text-center">
                    <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-bold">{team.tournamentCount}</p>
                    <p className="text-xs text-muted-foreground">Tournaments</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">
                      {team.matchesPlayed > 0 ? Math.round((team.wins / team.matchesPlayed) * 100) : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
