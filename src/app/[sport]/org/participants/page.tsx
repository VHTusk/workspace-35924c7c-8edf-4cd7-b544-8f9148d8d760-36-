"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  UserPlus,
  Search,
  Mail,
  Phone,
  Trophy,
  Star,
  MoreVertical,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RosterPlayer {
  id: string;
  playerId: string;
  firstName: string;
  lastName: string;
  email: string;
  city?: string;
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

interface RosterData {
  roster: RosterPlayer[];
  pendingRequests: PendingRequest[];
  stats: {
    currentCount: number;
    maxCount: number;
    availableSlots: number;
    pendingCount: number;
  };
}

export default function ParticipantsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [sport]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/org/roster", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch roster data");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load participants. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sendInvitation = async () => {
    if (!inviteEmail && !invitePhone) {
      toast.error("Please enter an email or phone number");
      return;
    }
    setSending(true);
    try {
      // First, search for player by email or phone
      const searchQuery = inviteEmail || invitePhone;
      const searchResponse = await fetch(`/api/search/players?sport=${sport.toUpperCase()}&q=${encodeURIComponent(searchQuery)}`, {
        credentials: "include",
      });
      
      if (!searchResponse.ok) {
        throw new Error("Failed to search for player");
      }
      
      const searchData = await searchResponse.json();
      
      if (!searchData.data?.results || searchData.data.results.length === 0) {
        toast.error("Player not found. They may need to register first.");
        return;
      }
      
      const player = searchData.data.results[0];
      
      // Send roster request
      const response = await fetch("/api/org/roster-request/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ playerId: player.id }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send invitation");
      }
      
      toast.success(`Invitation sent to ${player.firstName} ${player.lastName}`);
      setInviteEmail("");
      setInvitePhone("");
      fetchData();
    } catch (err: any) {
      console.error("Failed to send invitation:", err);
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setSending(false);
    }
  };

  const removePlayer = async (playerId: string, playerName: string) => {
    if (!confirm(`Are you sure you want to remove ${playerName} from the roster?`)) {
      return;
    }
    
    try {
      const response = await fetch("/api/org/roster", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ playerId }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to remove player");
      }
      
      toast.success(`${playerName} removed from roster`);
      fetchData();
    } catch (err) {
      console.error("Failed to remove player:", err);
      toast.error("Failed to remove player");
    }
  };

  const primaryClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "diamond": return "bg-blue-100 text-blue-800";
      case "platinum": return "bg-cyan-100 text-cyan-800";
      case "gold": return "bg-yellow-100 text-yellow-800";
      case "silver": return "bg-gray-100 text-gray-800";
      case "bronze": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getRequestStatusColor = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const hoursRemaining = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursRemaining < 0) return "bg-gray-100 text-gray-800";
    if (hoursRemaining < 24) return "bg-red-100 text-red-800";
    if (hoursRemaining < 72) return "bg-amber-100 text-amber-800";
    return "bg-green-100 text-green-800";
  };

  const roster = data?.roster || [];
  const pendingRequests = data?.pendingRequests || [];
  const stats = data?.stats || { currentCount: 0, maxCount: 25, availableSlots: 25, pendingCount: 0 };

  const filteredRoster = roster.filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchData} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Participants</h1>
          <p className="text-muted-foreground">Manage your organization roster</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {stats.currentCount}/{stats.maxCount} Members
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.currentCount}</p>
                <p className="text-sm text-muted-foreground">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending Invites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Trophy className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {roster.length > 0 ? Math.round(roster.reduce((sum, p) => sum + p.wins, 0) / roster.length) : 0}
                </p>
                <p className="text-sm text-muted-foreground">Avg Wins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Star className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {roster.length > 0 ? Math.round(roster.reduce((sum, p) => sum + p.elo, 0) / roster.length) : 0}
                </p>
                <p className="text-sm text-muted-foreground">Avg ELO</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="roster">
        <TabsList>
          <TabsTrigger value="roster">Roster ({roster.length})</TabsTrigger>
          <TabsTrigger value="invite">Invite Players</TabsTrigger>
          <TabsTrigger value="invitations">Invitations ({pendingRequests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Roster Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRoster.map((player) => (
              <Card key={player.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className={cn("text-white", isCornhole ? "bg-green-600" : "bg-teal-600")}>
                        {player.firstName[0]}{player.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{player.firstName} {player.lastName}</h3>
                        <Badge className={getTierColor(player.tier)}>{player.tier}</Badge>
                      </div>
                      {player.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{player.email}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                        <div><span className="text-muted-foreground">ELO:</span> <span className="font-medium">{player.elo}</span></div>
                        <div><span className="text-muted-foreground">Wins:</span> <span className="font-medium">{player.wins}</span></div>
                        <div><span className="text-muted-foreground">MP:</span> <span className="font-medium">{player.matchesPlayed}</span></div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removePlayer(player.playerId, `${player.firstName} ${player.lastName}`)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredRoster.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No players found</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="invite" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" />Invite New Player</CardTitle>
              <CardDescription>Search for an existing player by their email or phone to invite them to your roster</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input placeholder="player@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Phone (Optional)</Label>
                  <Input placeholder="+91 98765 43210" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} />
                </div>
              </div>
              <Button className={cn("text-white", primaryClass)} onClick={sendInvitation} disabled={sending || (!inviteEmail && !invitePhone)}>
                {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching...</> : <><Send className="w-4 h-4 mr-2" />Send Invitation</>}
              </Button>
              <p className="text-sm text-muted-foreground">
                Players must be registered in the system before they can be invited. 
                Invitations expire after 7 days. Players can only be in one organization per sport.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="mt-4 space-y-4">
          {pendingRequests.length > 0 ? pendingRequests.map((req) => (
            <Card key={req.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-full", getRequestStatusColor(req.expiresAt))}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">{req.firstName} {req.lastName}</p>
                      <div className="flex items-center gap-2">
                        <Badge className={getTierColor(req.tier)}>{req.tier}</Badge>
                        <span className="text-sm text-muted-foreground">ELO: {req.elo}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Sent: {new Date(req.requestedAt).toLocaleDateString()} • 
                        Expires: {new Date(req.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge className={getRequestStatusColor(req.expiresAt)}>
                    {new Date(req.expiresAt) > new Date() ? "Pending" : "Expired"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pending invitations</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
