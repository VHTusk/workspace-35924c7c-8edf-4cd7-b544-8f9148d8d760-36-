"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  History,
  Trophy,
  Calendar,
  MapPin,
  ChevronDown,
  ChevronRight,
  Users,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Swords,
  Medal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
}

interface Match {
  id: string;
  playedAt: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  outcome: string | null;
  playerA: Player;
  playerB: Player | null;
  pointsA: number | null;
  pointsB: number | null;
  eloChangeA: number | null;
  eloChangeB: number | null;
  verificationStatus: string;
}

interface Tournament {
  id: string;
  name: string;
  status: string;
  type: string;
  scope: string | null;
  startDate: string;
  endDate: string;
  location: string;
  matches: Match[];
}

interface Stats {
  totalMatches: number;
  completedMatches: number;
  pendingMatches: number;
  disputedMatches: number;
  orgWins: number;
  orgLosses: number;
  winRate: number;
}

interface MatchHistoryData {
  tournaments: Tournament[];
  stats: Stats;
  rosterPlayerIds: string[];
}

const getStatusBadge = (status: string) => {
  const colors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    REGISTRATION_OPEN: "bg-emerald-100 text-emerald-700",
    REGISTRATION_CLOSED: "bg-amber-100 text-amber-700",
    BRACKET_GENERATED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-purple-100 text-purple-700",
    COMPLETED: "bg-gray-100 text-gray-600",
    CANCELLED: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    REGISTRATION_OPEN: "Registration Open",
    REGISTRATION_CLOSED: "Registration Closed",
    BRACKET_GENERATED: "Bracket Generated",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return (
    <Badge className={colors[status] || "bg-gray-100 text-gray-700"}>
      {labels[status] || status}
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
  return <Badge className="bg-gray-100 text-gray-700">{type}</Badge>;
};

const getVerificationBadge = (status: string) => {
  const colors: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    VERIFIED: "bg-emerald-100 text-emerald-700",
    DISPUTED: "bg-red-100 text-red-700",
  };
  return (
    <Badge className={colors[status] || "bg-gray-100 text-gray-700"}>
      {status}
    </Badge>
  );
};

export default function OrgMatchHistoryPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MatchHistoryData | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchMatchHistory();
  }, [statusFilter]);

  const fetchMatchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(`/api/org/match-history?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch match history:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTournament = (tournamentId: string) => {
    setExpandedTournaments((prev) => {
      const next = new Set(prev);
      if (next.has(tournamentId)) {
        next.delete(tournamentId);
      } else {
        next.add(tournamentId);
      }
      return next;
    });
  };

  const isOrgPlayer = (playerId: string) => {
    return data?.rosterPlayerIds.includes(playerId) || false;
  };

  const getMatchResult = (match: Match) => {
    if (!match.winnerId || !match.playerB) return null;
    
    const playerAWon = match.winnerId === match.playerA.id;
    const playerAIsOrg = isOrgPlayer(match.playerA.id);
    const playerBIsOrg = isOrgPlayer(match.playerB.id);

    if (playerAIsOrg) {
      return playerAWon ? "win" : "loss";
    } else if (playerBIsOrg) {
      return playerAWon ? "loss" : "win";
    }
    return null;
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
      <main className="ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <History className={cn("w-7 h-7", primaryTextClass)} />
              Match History
            </h1>
            <p className="text-gray-500 mt-1">View all matches organized by tournament</p>
          </div>

          {/* Stats Cards */}
          {data?.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Swords className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{data.stats.totalMatches}</p>
                  <p className="text-xs text-gray-500">Total Matches</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{data.stats.completedMatches}</p>
                  <p className="text-xs text-gray-500">Verified</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{data.stats.pendingMatches}</p>
                  <p className="text-xs text-gray-500">Pending</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{data.stats.disputedMatches}</p>
                  <p className="text-xs text-gray-500">Disputed</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">{data.stats.orgWins}</p>
                  <p className="text-xs text-gray-500">Org Wins</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-6 h-6 text-red-500 rotate-180 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-600">{data.stats.orgLosses}</p>
                  <p className="text-xs text-gray-500">Org Losses</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Medal className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{data.stats.winRate}%</p>
                  <p className="text-xs text-gray-500">Win Rate</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filter */}
          <div className="mb-6 flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tournaments</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="REGISTRATION_OPEN">Registration Open</SelectItem>
                <SelectItem value="BRACKET_GENERATED">Bracket Generated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tournaments List */}
          {data?.tournaments.length === 0 ? (
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-12 text-center">
                <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Match History</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Matches will appear here when your organization&apos;s players participate in tournaments.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {data?.tournaments.map((tournament) => (
                <Card key={tournament.id} className="bg-white border-gray-100 shadow-sm overflow-hidden">
                  {/* Tournament Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleTournament(tournament.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {expandedTournaments.has(tournament.id) ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {getTournamentTypeBadge(tournament.type)}
                            {getStatusBadge(tournament.status)}
                            <Badge variant="outline" className="text-gray-600">
                              {tournament.matches.length} matches
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-gray-900">{tournament.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(tournament.startDate).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {tournament.location}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Link href={`/${sport}/tournaments/${tournament.id}`}>
                        <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                          View Tournament
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Matches List */}
                  {expandedTournaments.has(tournament.id) && (
                    <div className="border-t border-gray-100">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Player A</th>
                              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Score</th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Player B</th>
                              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Winner</th>
                              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {tournament.matches.map((match) => {
                              const result = getMatchResult(match);
                              return (
                                <tr key={match.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {new Date(match.playedAt).toLocaleDateString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "font-medium",
                                        isOrgPlayer(match.playerA.id) && "text-purple-600",
                                        result === "win" && match.winnerId === match.playerA.id && "text-green-600",
                                        result === "loss" && match.winnerId !== match.playerA.id && "text-red-600"
                                      )}>
                                        {match.playerA.firstName} {match.playerA.lastName}
                                      </span>
                                      {isOrgPlayer(match.playerA.id) && (
                                        <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">
                                          Org
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <span className={cn(
                                        "text-lg font-bold",
                                        match.winnerId === match.playerA.id ? "text-green-600" : "text-gray-600"
                                      )}>
                                        {match.scoreA ?? "-"}
                                      </span>
                                      <span className="text-gray-400">vs</span>
                                      <span className={cn(
                                        "text-lg font-bold",
                                        match.winnerId === match.playerB?.id ? "text-green-600" : "text-gray-600"
                                      )}>
                                        {match.scoreB ?? "-"}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {match.playerB ? (
                                      <div className="flex items-center gap-2">
                                        <span className={cn(
                                          "font-medium",
                                          isOrgPlayer(match.playerB.id) && "text-purple-600",
                                          result === "win" && match.winnerId === match.playerB.id && "text-green-600",
                                          result === "loss" && match.winnerId !== match.playerB.id && "text-red-600"
                                        )}>
                                          {match.playerB.firstName} {match.playerB.lastName}
                                        </span>
                                        {isOrgPlayer(match.playerB.id) && (
                                          <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">
                                            Org
                                          </Badge>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">Bye</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {match.winnerId ? (
                                      <span className={cn(
                                        "text-sm font-medium",
                                        result === "win" ? "text-green-600" : result === "loss" ? "text-red-600" : "text-gray-600"
                                      )}>
                                        {match.winnerId === match.playerA.id
                                          ? `${match.playerA.firstName} ${match.playerA.lastName}`
                                          : match.playerB
                                          ? `${match.playerB.firstName} ${match.playerB.lastName}`
                                          : "-"}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {getVerificationBadge(match.verificationStatus)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
