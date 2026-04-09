"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  UserPlus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Trophy,
  Target,
  TrendingUp,
  Crown,
  Star,
  Download,
  ChevronDown,
  ChevronRight,
  Award,
  Swords,
  Calendar,
  BarChart3,
  UserX,
  History,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentMatch {
  id: string;
  tournamentName: string;
  opponent: string;
  score: string;
  result: 'win' | 'loss' | 'draw';
  playedAt: string;
}

interface Player {
  id: string;
  playerId: string;
  uniqueId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  elo: number;
  tier: string;
  // Overall stats
  overallMatchesPlayed: number;
  overallWins: number;
  overallLosses: number;
  // Performance in this org
  orgMatchesPlayed: number;
  orgWins: number;
  orgLosses: number;
  orgTournamentsPlayed: number;
  orgPointsEarned: number;
  orgWinRate: number;
  recentMatches: RecentMatch[];
  joinedAt: string;
  isCaptain: boolean;
  tags: string[];
}

interface PendingInvitation {
  id: string;
  playerId: string;
  firstName: string;
  lastName: string;
  elo: number;
  tier: string;
  matchesPlayed: number;
  requestedAt: string;
  expiresAt: string;
  daysLeft: number;
}

interface TransferRecord {
  playerId: string;
  firstName: string;
  lastName: string;
  elo: number;
  joinedAt: string;
  leftAt: string | null;
  cooldownEnds?: string;
}

interface RosterStats {
  currentCount: number;
  maxCount: number;
  availableSlots: number;
  pendingCount: number;
  avgElo: number;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  overallWinRate: number;
  tierDistribution: Record<string, number>;
}

interface PlayerManagementData {
  roster: Player[];
  pendingInvitations: PendingInvitation[];
  transferHistory: TransferRecord[];
  stats: RosterStats;
}

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  hiddenElo: number;
  tier: string;
  matchesPlayed: number;
}

const MAX_ROSTER_SIZE = 25;

const PLAYER_TAGS = [
  { value: 'pro', label: 'Pro', color: 'bg-purple-100 text-purple-700' },
  { value: 'amateur', label: 'Amateur', color: 'bg-blue-100 text-blue-700' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-700' },
  { value: 'rising', label: 'Rising Star', color: 'bg-amber-100 text-amber-700' },
];

export default function OrgPlayersPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PlayerManagementData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Expanded players for showing details
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
  
  // Tag dialog
  const [tagDialogPlayer, setTagDialogPlayer] = useState<Player | null>(null);
  
  // Filter
  const [tierFilter, setTierFilter] = useState("all");
  const [sortBy, setSortBy] = useState("joinedAt");

  useEffect(() => {
    fetchData();
  }, [sport]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/org/players");
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
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
        const result = await response.json();
        setSearchResults((result.leaderboard || []).slice(0, 10));
      }
    } catch (error) {
      console.error("Search failed:", error);
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const sendInvitation = async (playerId: string) => {
    setActionLoading(playerId);
    setError("");

    try {
      const response = await fetch("/api/org/roster/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to send invitation");
        return;
      }

      setSuccess(`Invitation sent to ${result.request.playerName}`);
      setSearchResults([]);
      setSearchQuery("");
      fetchData();
    } catch (error) {
      setError("Failed to send invitation");
    } finally {
      setActionLoading(null);
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    setActionLoading(invitationId);
    setError("");

    try {
      const response = await fetch("/api/org/roster/request", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: invitationId }),
      });

      if (!response.ok) {
        const result = await response.json();
        setError(result.error || "Failed to cancel invitation");
        return;
      }

      setSuccess("Invitation cancelled");
      fetchData();
    } catch (error) {
      setError("Failed to cancel invitation");
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
        const result = await response.json();
        setError(result.error || "Failed to remove player");
        return;
      }

      setSuccess("Player removed from roster");
      fetchData();
    } catch (error) {
      setError("Failed to remove player");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleCaptain = async (playerId: string, isCaptain: boolean) => {
    setActionLoading(playerId);
    setError("");

    try {
      const response = await fetch("/api/org/roster", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, isCaptain: !isCaptain }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to update captain status");
        return;
      }

      setSuccess(isCaptain ? "Player removed as captain" : "Player set as captain");
      fetchData();
    } catch (error) {
      setError("Failed to update captain status");
    } finally {
      setActionLoading(null);
    }
  };

  const exportRoster = () => {
    if (!data?.roster.length) return;
    
    const csv = [
      ['Name', 'Email', 'Phone', 'City', 'State', 'ELO', 'Tier', 'Org Matches', 'Org Wins', 'Org Losses', 'Win Rate', 'Joined'].join(','),
      ...data.roster.map(p => [
        `${p.firstName} ${p.lastName}`,
        p.email || '',
        p.phone || '',
        p.city || '',
        p.state || '',
        p.elo,
        p.tier,
        p.orgMatchesPlayed,
        p.orgWins,
        p.orgLosses,
        `${p.orgWinRate}%`,
        new Date(p.joinedAt).toLocaleDateString()
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roster-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const togglePlayerExpand = (playerId: string) => {
    setExpandedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      DIAMOND: "bg-purple-100 text-purple-700 border-purple-200",
      PLATINUM: "bg-cyan-100 text-cyan-700 border-cyan-200",
      GOLD: "bg-amber-100 text-amber-700 border-amber-200",
      SILVER: "bg-gray-200 text-gray-700 border-gray-300",
      BRONZE: "bg-orange-100 text-orange-700 border-orange-200",
      UNRANKED: "bg-gray-100 text-gray-500 border-gray-200",
    };
    return (
      <Badge variant="outline" className={colors[tier] || colors.UNRANKED}>
        {tier}
      </Badge>
    );
  };

  const getTagBadge = (tag: string) => {
    const tagInfo = PLAYER_TAGS.find(t => t.value === tag);
    if (!tagInfo) return null;
    return (
      <Badge className={tagInfo.color}>
        {tagInfo.label}
      </Badge>
    );
  };

  const getResultBadge = (result: string) => {
    if (result === 'win') return <Badge className="bg-green-100 text-green-700">W</Badge>;
    if (result === 'loss') return <Badge className="bg-red-100 text-red-700">L</Badge>;
    return <Badge className="bg-gray-100 text-gray-600">D</Badge>;
  };

  // Filter and sort roster
  const filteredRoster = data?.roster
    .filter(p => tierFilter === 'all' || p.tier === tierFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'elo': return b.elo - a.elo;
        case 'orgWins': return b.orgWins - a.orgWins;
        case 'orgWinRate': return b.orgWinRate - a.orgWinRate;
        case 'name': return a.firstName.localeCompare(b.firstName);
        default: return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
      }
    }) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className={cn("w-7 h-7", primaryTextClass)} />
                Manage Players
              </h1>
              <p className="text-gray-500 mt-1">Build and manage your organization&apos;s roster</p>
            </div>
            {data?.roster.length && (
              <Button variant="outline" onClick={exportRoster} className="gap-2">
                <Download className="w-4 h-4" />
                Export Roster
              </Button>
            )}
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

          {/* Stats Cards */}
          {data?.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Users className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
                  <p className="text-2xl font-bold text-gray-900">
                    {data.stats.currentCount}/{data.stats.maxCount}
                  </p>
                  <p className="text-xs text-gray-500">Roster Size</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Target className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{data.stats.avgElo}</p>
                  <p className="text-xs text-gray-500">Avg ELO</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Swords className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{data.stats.totalMatches}</p>
                  <p className="text-xs text-gray-500">Org Matches</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">{data.stats.totalWins}</p>
                  <p className="text-xs text-gray-500">Org Wins</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <BarChart3 className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{data.stats.overallWinRate}%</p>
                  <p className="text-xs text-gray-500">Win Rate</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <UserPlus className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{data.stats.pendingCount}</p>
                  <p className="text-xs text-gray-500">Pending</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tier Distribution */}
          {data?.stats.tierDistribution && (
            <Card className="bg-white border-gray-100 shadow-sm mb-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-sm font-medium text-gray-600">Tier Distribution:</span>
                  {Object.entries(data.stats.tierDistribution).map(([tier, count]) => (
                    <div key={tier} className="flex items-center gap-1">
                      {getTierBadge(tier)}
                      <span className="text-sm text-gray-600">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content Tabs */}
          <Tabs defaultValue="roster" className="space-y-4">
            <TabsList className="bg-white border border-gray-200">
              <TabsTrigger value="roster" className="gap-2">
                <Users className="w-4 h-4" />
                Roster ({data?.roster.length || 0})
              </TabsTrigger>
              <TabsTrigger value="add" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Add Players
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="w-4 h-4" />
                Pending ({data?.pendingInvitations.length || 0})
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" />
                Transfer History
              </TabsTrigger>
            </TabsList>

            {/* Roster Tab */}
            <TabsContent value="roster" className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-4">
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="DIAMOND">Diamond</SelectItem>
                    <SelectItem value="PLATINUM">Platinum</SelectItem>
                    <SelectItem value="GOLD">Gold</SelectItem>
                    <SelectItem value="SILVER">Silver</SelectItem>
                    <SelectItem value="BRONZE">Bronze</SelectItem>
                    <SelectItem value="UNRANKED">Unranked</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="joinedAt">Recently Joined</SelectItem>
                    <SelectItem value="elo">ELO Rating</SelectItem>
                    <SelectItem value="orgWins">Org Wins</SelectItem>
                    <SelectItem value="orgWinRate">Win Rate</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Player Cards */}
              {filteredRoster.length === 0 ? (
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Players Found</h3>
                    <p className="text-gray-500">
                      {tierFilter !== 'all' 
                        ? 'No players match the selected tier filter.'
                        : 'Start building your roster by adding players.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredRoster.map((player) => {
                    const isExpanded = expandedPlayers.has(player.id);
                    return (
                      <Card key={player.id} className="bg-white border-gray-100 shadow-sm overflow-hidden">
                        {/* Player Header */}
                        <div
                          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => togglePlayerExpand(player.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                              )}
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                {player.firstName[0]}{player.lastName[0]}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">
                                    {player.firstName} {player.lastName}
                                  </span>
                                  {player.isCaptain && (
                                    <Crown className="w-4 h-4 text-amber-500" />
                                  )}
                                  {player.tags.map(tag => getTagBadge(tag))}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  {getTierBadge(player.tier)}
                                  <span className="text-sm text-gray-500">ELO: {Math.round(player.elo)}</span>
                                  {player.uniqueId && (
                                    <span className="text-xs text-gray-400 font-mono">{player.uniqueId}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {/* Quick Stats */}
                              <div className="hidden sm:flex items-center gap-6 text-center">
                                <div>
                                  <p className="text-lg font-bold text-gray-900">{player.orgMatchesPlayed}</p>
                                  <p className="text-xs text-gray-500">Matches</p>
                                </div>
                                <div>
                                  <p className="text-lg font-bold text-green-600">{player.orgWins}</p>
                                  <p className="text-xs text-gray-500">Wins</p>
                                </div>
                                <div>
                                  <p className="text-lg font-bold text-gray-900">{player.orgWinRate}%</p>
                                  <p className="text-xs text-gray-500">Win Rate</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removePlayer(player.playerId);
                                }}
                                disabled={actionLoading === player.playerId}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                {actionLoading === player.playerId ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <UserX className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 p-4 bg-gray-50">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Player Info */}
                              <div className="space-y-4">
                                <h4 className="font-medium text-gray-900">Player Information</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <Mail className="w-4 h-4" />
                                    {player.email || 'No email'}
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <Phone className="w-4 h-4" />
                                    {player.phone || 'No phone'}
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <MapPin className="w-4 h-4" />
                                    {[player.city, player.state].filter(Boolean).join(', ') || 'No location'}
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <Calendar className="w-4 h-4" />
                                    Joined {new Date(player.joinedAt).toLocaleDateString()}
                                  </div>
                                </div>

                                {/* Stats Comparison */}
                                <div className="mt-4">
                                  <h4 className="font-medium text-gray-900 mb-2">Performance Statistics</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white p-3 rounded-lg border">
                                      <p className="text-xs text-gray-500 mb-1">Overall Career</p>
                                      <p className="text-lg font-bold">{player.overallWins}W - {player.overallLosses}L</p>
                                      <p className="text-xs text-gray-500">{player.overallMatchesPlayed} matches</p>
                                    </div>
                                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                      <p className="text-xs text-purple-600 mb-1">With This Org</p>
                                      <p className="text-lg font-bold text-purple-700">{player.orgWins}W - {player.orgLosses}L</p>
                                      <p className="text-xs text-purple-600">{player.orgMatchesPlayed} matches • {player.orgTournamentsPlayed} tournaments</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Tags & Captain */}
                                <div className="flex items-center gap-2 mt-4">
                                  <Button
                                    size="sm"
                                    variant={player.isCaptain ? "default" : "outline"}
                                    onClick={() => toggleCaptain(player.playerId, player.isCaptain)}
                                    className="gap-1"
                                  >
                                    <Crown className="w-3 h-3" />
                                    {player.isCaptain ? 'Remove Captain' : 'Make Captain'}
                                  </Button>
                                </div>
                              </div>

                              {/* Recent Matches */}
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Recent Matches (with Org)</h4>
                                {player.recentMatches.length === 0 ? (
                                  <p className="text-sm text-gray-500">No matches played yet with this organization.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {player.recentMatches.map((match) => (
                                      <div key={match.id} className="flex items-center justify-between p-2 bg-white rounded border">
                                        <div>
                                          <p className="text-sm font-medium">{match.tournamentName}</p>
                                          <p className="text-xs text-gray-500">vs {match.opponent}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-mono">{match.score}</span>
                                          {getResultBadge(match.result)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Add Players Tab */}
            <TabsContent value="add" className="space-y-4">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Search Players</CardTitle>
                  <CardDescription>
                    Search the leaderboard to find players. Max {MAX_ROSTER_SIZE} players per roster.
                    {data?.stats && ` ${data.stats.availableSlots} slots available.`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search players by name, email, or phone..."
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
                        const alreadyInRoster = data?.roster.some(r => r.playerId === player.id);
                        const alreadyRequested = data?.pendingInvitations.some(r => r.playerId === player.id);

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
                                  <span>ELO: {Math.round(player.hiddenElo)}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                                  {player.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="w-3 h-3" />
                                      {player.email}
                                    </span>
                                  )}
                                  {player.city && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {player.city}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div>
                              {alreadyInRoster ? (
                                <Badge className="bg-emerald-100 text-emerald-700">In Roster</Badge>
                              ) : alreadyRequested ? (
                                <Badge className="bg-amber-100 text-amber-700">Invite Sent</Badge>
                              ) : data?.stats.availableSlots === 0 ? (
                                <Badge className="bg-gray-100 text-gray-500">Roster Full</Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => sendInvitation(player.id)}
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
            </TabsContent>

            {/* Pending Tab */}
            <TabsContent value="pending" className="space-y-4">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Pending Invitations</CardTitle>
                  <CardDescription>
                    Invitations expire after 7 days. Players can accept or decline.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data?.pendingInvitations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No pending invitations</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data?.pendingInvitations.map((invitation) => (
                        <div key={invitation.id} className="flex items-center justify-between p-4 rounded-lg bg-amber-50 border border-amber-100">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                              <span className="text-lg font-medium text-amber-700">
                                {invitation.firstName[0]}{invitation.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {invitation.firstName} {invitation.lastName}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {getTierBadge(invitation.tier)}
                                <span>{invitation.matchesPlayed} matches</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                                <Clock className="w-3 h-3" />
                                Expires in {invitation.daysLeft} days
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelInvitation(invitation.id)}
                            disabled={actionLoading === invitation.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {actionLoading === invitation.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Transfer History Tab */}
            <TabsContent value="history" className="space-y-4">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Transfer History</CardTitle>
                  <CardDescription>
                    Players who have left your organization.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data?.transferHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No transfer history</p>
                      <p className="text-sm">Players who leave your org will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data?.transferHistory.map((record) => (
                        <div key={record.playerId} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-600">
                                {record.firstName[0]}{record.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {record.firstName} {record.lastName}
                              </p>
                              <p className="text-xs text-gray-500">ELO: {Math.round(record.elo)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">
                              Joined {new Date(record.joinedAt).toLocaleDateString()}
                            </p>
                            {record.cooldownEnds && (
                              <p className="text-xs text-amber-600">
                                Transfer cooldown until {new Date(record.cooldownEnds).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
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
