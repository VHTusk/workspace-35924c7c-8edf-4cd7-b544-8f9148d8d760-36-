"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/layout/sidebar";
import {
  Trophy,
  Search,
  Crown,
  Medal,
  TrendingUp,
  Building2,
  Users,
  Target,
  Flame,
  Loader2,
  Award,
  MapPin,
  CheckCircle,
  ArrowLeft,
  Shield,
  Briefcase,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface PlayerLeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  city: string;
  points: number;
  tier: string;
  matches: number;
  wins: number;
  elo: number;
  change: number;
  department?: string;
  isVerified?: boolean;
}

interface OrgLeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  type: string;
  city?: string;
  state?: string;
  planTier: string;
  isSubscribed: boolean;
  stats: {
    totalMembers: number;
    totalPoints: number;
    avgPoints: number;
    avgElo: number;
    tournamentsHosted: number;
    completedTournaments: number;
  };
}

interface PlayerStats {
  totalPlayers: number;
  activeThisMonth: number;
  topPlayer: string | null;
}

interface OrgStats {
  totalOrganizations: number;
  subscribedOrganizations: number;
  topOrg: string | null;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

// Intra-School leaderboard entry
interface IntraSchoolEntry {
  id: string;
  rank: number;
  studentName: string;
  className: string;
  houseName?: string;
  points: number;
  tournamentsPlayed: number;
  wins: number;
  winRate: string;
}

// Inter-School team entry (for external competitions)
interface InterSchoolTeamEntry {
  id: string;
  rank: number;
  teamName: string;
  tournamentsParticipated: number;
  tournamentsWon: number;
  totalMatches: number;
  matchesWon: number;
  totalPoints: number;
  recentTournament?: {
    name: string;
    position: string;
  date: string;
  };
}

const tierColors: Record<string, string> = {
  Diamond: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  Platinum: "text-teal-400 bg-teal-500/10 border-teal-500/30",
  Gold: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  Silver: "text-gray-400 bg-gray-500/10 border-gray-500/30",
  Bronze: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  UNRANKED: "text-gray-400 bg-gray-500/10 border-gray-500/30",
};

const tierIcons: Record<string, string> = {
  Diamond: "💎",
  Platinum: "🔷",
  Gold: "🥇",
  Silver: "🥈",
  Bronze: "🥉",
  UNRANKED: "⚪",
};

const orgTypeColors: Record<string, string> = {
  CLUB: "bg-blue-100 text-blue-700",
  SCHOOL: "bg-green-100 text-green-700",
  CORPORATE: "bg-purple-100 text-purple-700",
  ACADEMY: "bg-amber-100 text-amber-700",
};

export default function OrgLeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";

  const [org, setOrg] = useState<OrgData | null>(null);
  const [isCorporate, setIsCorporate] = useState(false);
  const [isSchool, setIsSchool] = useState(false);
  const [isCollege, setIsCollege] = useState(false);
  const [activeTab, setActiveTab] = useState("players");
  
  // Player leaderboard state
  const [playerLeaderboard, setPlayerLeaderboard] = useState<PlayerLeaderboardEntry[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [playerLoading, setPlayerLoading] = useState(true);
  
  // Org leaderboard state
  const [orgLeaderboard, setOrgLeaderboard] = useState<OrgLeaderboardEntry[]>([]);
  const [orgStats, setOrgStats] = useState<OrgStats | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  // Intra-org (employees) leaderboard state for corporate
  const [intraOrgLeaderboard, setIntraOrgLeaderboard] = useState<PlayerLeaderboardEntry[]>([]);
  const [intraOrgLoading, setIntraOrgLoading] = useState(false);

  // Intra-school leaderboard state
  const [intraSchoolLeaderboard, setIntraSchoolLeaderboard] = useState<IntraSchoolEntry[]>([]);
  const [intraSchoolLoading, setIntraSchoolLoading] = useState(false);
  
  // Inter-school teams leaderboard state
  const [interSchoolTeams, setInterSchoolTeams] = useState<InterSchoolTeamEntry[]>([]);
  const [interSchoolLoading, setInterSchoolLoading] = useState(false);

  // Filter states
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("national");
  const [tierFilter, setTierFilter] = useState("all");
  const [sortBy, setSortBy] = useState("points");
  const [orgTypeFilter, setOrgTypeFilter] = useState("all");

  // Theme classes
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBorderClass = isCornhole ? "border-green-500" : "border-teal-500";

  // Navigation items for horizontal navbar
  const navItems = [
    { label: "Dashboard", href: "/org/home", icon: LayoutDashboard },
    { label: "Employees", href: `/${sport}/org/employer-sports/employees`, icon: Users },
    { label: "Tournaments", href: `/${sport}/org/employer-sports/tournaments`, icon: Trophy },
    { label: "Leaderboard", href: `/${sport}/org/leaderboard`, icon: Award },
  ];

  // Fetch org info first
  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const response = await fetch("/api/org/me");
        if (response.ok) {
          const data = await response.json();
          setOrg(data);
          setIsCorporate(data.type === "CORPORATE");
          setIsSchool(data.type === "SCHOOL");
          setIsCollege(data.type === "COLLEGE");
          
          // Set default tab based on org type
          if (data.type === "CORPORATE") {
            setActiveTab("intra-org");
          } else if (data.type === "SCHOOL" || data.type === "COLLEGE") {
            setActiveTab("intra-school");
          }
        }
      } catch (error) {
        console.error("Failed to fetch org:", error);
      }
    };
    fetchOrg();
  }, []);

  useEffect(() => {
    fetchPlayerLeaderboard();
  }, [sport, scopeFilter]);

  useEffect(() => {
    if (activeTab === "organizations" || (isCorporate && activeTab === "inter-corporate")) {
      fetchOrgLeaderboard();
    }
    if (isCorporate && activeTab === "intra-org" && org?.id) {
      fetchIntraOrgLeaderboard();
    }
    if ((isSchool || isCollege) && activeTab === "intra-school") {
      fetchIntraSchoolLeaderboard();
    }
    if ((isSchool || isCollege) && activeTab === "inter-school") {
      fetchInterSchoolTeams();
    }
  }, [activeTab, sport, scopeFilter, orgTypeFilter, org?.id, isCorporate, isSchool, isCollege]);

  const fetchPlayerLeaderboard = async () => {
    setPlayerLoading(true);
    try {
      const queryParams = new URLSearchParams({
        sport: sport.toUpperCase(),
        scope: scopeFilter,
      });
      if (search) queryParams.append("search", search);

      const response = await fetch(`/api/leaderboard?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPlayerLeaderboard(data.leaderboard || []);
        setPlayerStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch player leaderboard:", error);
    } finally {
      setPlayerLoading(false);
    }
  };

  const fetchOrgLeaderboard = async () => {
    setOrgLoading(true);
    try {
      const queryParams = new URLSearchParams({
        sport: sport.toUpperCase(),
        scope: scopeFilter,
      });
      if (search) queryParams.append("search", search);
      // For inter-corporate leaderboard, filter by CORPORATE type
      if (isCorporate && activeTab === "inter-corporate") {
        queryParams.append("type", "CORPORATE");
      } else if (orgTypeFilter !== "all") {
        queryParams.append("type", orgTypeFilter);
      }

      const response = await fetch(`/api/organizations/leaderboard?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setOrgLeaderboard(data.leaderboard || []);
        setOrgStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch org leaderboard:", error);
    } finally {
      setOrgLoading(false);
    }
  };

  const fetchIntraOrgLeaderboard = async () => {
    if (!org?.id) return;
    setIntraOrgLoading(true);
    try {
      const response = await fetch(`/api/org/leaderboard?orgId=${org.id}`);
      if (response.ok) {
        const data = await response.json();
        setIntraOrgLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error("Failed to fetch intra-org leaderboard:", error);
    } finally {
      setIntraOrgLoading(false);
    }
  };

  const fetchIntraSchoolLeaderboard = async () => {
    setIntraSchoolLoading(true);
    try {
      const response = await fetch("/api/org/school/leaderboard/intra");
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIntraSchoolLeaderboard(data.data.leaderboard);
        }
      }
    } catch (error) {
      console.error("Failed to fetch intra-school leaderboard:", error);
    } finally {
      setIntraSchoolLoading(false);
    }
  };

  const fetchInterSchoolTeams = async () => {
    setInterSchoolLoading(true);
    try {
      const response = await fetch("/api/org/school/leaderboard/inter");
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInterSchoolTeams(data.data.leaderboard);
        }
      }
    } catch (error) {
      console.error("Failed to fetch inter-school teams:", error);
    } finally {
      setInterSchoolLoading(false);
    }
  };

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isCorporate && activeTab === "intra-org") {
        // Intra-org search is client-side
      } else if (activeTab === "players" || (isCorporate && activeTab !== "inter-corporate")) {
        fetchPlayerLeaderboard();
      } else {
        fetchOrgLeaderboard();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Apply client-side filters
  const filteredPlayerLeaderboard = playerLeaderboard
    .filter((player) => {
      if (tierFilter !== "all" && player.tier.toUpperCase() !== tierFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "points") return b.points - a.points;
      if (sortBy === "elo") return b.elo - a.elo;
      if (sortBy === "matches") return b.matches - a.matches;
      return 0;
    });

  const filteredOrgLeaderboard = orgLeaderboard
    .filter((orgItem) => {
      if (orgTypeFilter !== "all" && orgItem.type !== orgTypeFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "points") return b.stats.totalPoints - a.stats.totalPoints;
      if (sortBy === "members") return b.stats.totalMembers - a.stats.totalMembers;
      if (sortBy === "avgPoints") return b.stats.avgPoints - a.stats.avgPoints;
      return 0;
    });

  const filteredIntraOrgLeaderboard = intraOrgLeaderboard
    .filter((player) => {
      if (search) {
        const searchLower = search.toLowerCase();
        if (!player.name.toLowerCase().includes(searchLower) && 
            !player.department?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      return true;
    });

  // Corporate-specific tabs
  if (isCorporate) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Sidebar />
        <main className="ml-0 md:ml-72">
          {/* Horizontal Navbar */}
          <div className="bg-white border-b border-gray-200 sticky top-16 z-30">
            <div className="px-6 py-3">
              <nav className="flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/org/home" && pathname.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "gap-2",
                          isActive ? cn(primaryBgClass, primaryTextClass) : "text-gray-600 hover:text-gray-900"
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <Button
                variant="ghost"
                onClick={() => router.push("/org/home")}
                className="mb-2 text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Corporate Leaderboard</h1>
              <p className="text-gray-500">View internal employee rankings and inter-corporate standings</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Users className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
                  <p className="text-2xl font-bold text-gray-900">{intraOrgLeaderboard.length || 0}</p>
                  <p className="text-xs text-gray-500">Employees</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Building2 className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                  <p className="text-2xl font-bold text-gray-900">{filteredOrgLeaderboard.length || 0}</p>
                  <p className="text-xs text-gray-500">Corporations</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Trophy className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                  <p className="text-lg font-bold text-gray-900 truncate">
                    {filteredIntraOrgLeaderboard[0]?.name || "--"}
                  </p>
                  <p className="text-xs text-gray-500">Top Employee</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Medal className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-lg font-bold text-gray-900">
                    {orgLeaderboard.find(o => o.id === org?.id)?.rank || "--"}
                  </p>
                  <p className="text-xs text-gray-500">Your Rank</p>
                </CardContent>
              </Card>
            </div>

            {/* Corporate Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-white border border-gray-200">
                <TabsTrigger value="intra-org" className="gap-2">
                  <Users className="w-4 h-4" />
                  Intra-Organization
                </TabsTrigger>
                <TabsTrigger value="inter-corporate" className="gap-2">
                  <Shield className="w-4 h-4" />
                  Inter-Corporate
                </TabsTrigger>
              </TabsList>

              {/* Intra-Organization Tab (Employees within company) */}
              <TabsContent value="intra-org" className="space-y-4">
                <Card className="bg-white border-gray-100 shadow-sm mb-4">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Briefcase className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Intra-Organization Leaderboard</CardTitle>
                        <CardDescription>Employee rankings within {org?.name || "your company"}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search employees by name or department..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Employee Leaderboard Table */}
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-0">
                    {intraOrgLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    ) : filteredIntraOrgLeaderboard.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No employees found</p>
                        <p className="text-sm">Add employees to see rankings</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-96">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-gray-100">
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Department</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Points</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Matches</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredIntraOrgLeaderboard.map((player, index) => (
                              <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "font-bold",
                                    index < 3 ? primaryTextClass : "text-gray-900"
                                  )}>
                                    #{index + 1}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="w-8 h-8">
                                      <AvatarFallback className={cn(primaryBgClass, primaryTextClass, "text-xs")}>
                                        {player.name.split(" ").map(n => n[0]).join("")}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium text-gray-900">{player.name}</p>
                                      <p className="text-xs text-gray-500">{player.city}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 hidden sm:table-cell">
                                  <span className="text-sm text-gray-600">{player.department || "N/A"}</span>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900">
                                  {player.points.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                                  {player.matches}
                                </td>
                                <td className="px-4 py-3 text-center hidden md:table-cell">
                                  {player.isVerified ? (
                                    <Badge className="bg-green-100 text-green-700">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Verified
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Inter-Corporate Tab (Company vs Company) */}
              <TabsContent value="inter-corporate" className="space-y-4">
                <Card className="bg-white border-gray-100 shadow-sm mb-4">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Inter-Corporate Leaderboard</CardTitle>
                        <CardDescription>Corporate organization rankings for {sportName}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search corporations..."
                          className="pl-10"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <Select value={scopeFilter} onValueChange={setScopeFilter}>
                        <SelectTrigger className="w-full sm:w-40">
                          <SelectValue placeholder="Scope" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="national">National</SelectItem>
                          <SelectItem value="state">State</SelectItem>
                          <SelectItem value="district">District</SelectItem>
                          <SelectItem value="city">City</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Top 3 Podium */}
                {!orgLoading && filteredOrgLeaderboard.length >= 3 && (
                  <div className="grid grid-cols-3 gap-4">
                    {filteredOrgLeaderboard.slice(0, 3).map((orgItem, index) => (
                      <Card 
                        key={orgItem.id} 
                        className={cn(
                          "bg-white border-gray-100 shadow-sm",
                          index === 0 ? "order-2 sm:scale-105 border-amber-300" : 
                          index === 1 ? "order-1" : 
                          "order-3",
                          orgItem.id === org?.id && "ring-2 ring-purple-500"
                        )}
                      >
                        <CardContent className={cn("p-4 text-center", index === 0 ? "pt-6" : "")}>
                          <div className={cn(
                            "w-12 h-12 mx-auto mb-2 rounded-xl flex items-center justify-center",
                            index === 0 ? "w-16 h-16" : "",
                            orgItem.id === org?.id ? "bg-purple-500 text-white" : "bg-purple-100"
                          )}>
                            <Building2 className={cn(
                              orgItem.id === org?.id ? "text-white" : "text-purple-500",
                              index === 0 ? "w-8 h-8" : "w-6 h-6"
                            )} />
                          </div>
                          <p className="font-semibold text-gray-900 truncate">{orgItem.name}</p>
                          <p className="text-xs text-gray-500">{orgItem.city || orgItem.state || ""}</p>
                          {orgItem.id === org?.id && (
                            <Badge className="mt-1 bg-purple-500 text-white">Your Company</Badge>
                          )}
                          <div className="mt-2">
                            <p className="text-2xl font-bold text-gray-900">{orgItem.stats.totalPoints.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">points</p>
                          </div>
                          <div className={cn(
                            "text-2xl font-bold",
                            index === 0 ? "text-amber-500" : 
                            index === 1 ? "text-gray-400" : 
                            "text-orange-400"
                          )}>
                            #{orgItem.rank}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Corporate Leaderboard Table */}
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Corporate Rankings</CardTitle>
                    <CardDescription>
                      {filteredOrgLeaderboard.length} corporations found
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {orgLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    ) : filteredOrgLeaderboard.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No corporations found</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-96">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-gray-100">
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Corporation</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Employees</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Points</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Avg Points</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredOrgLeaderboard.map((orgItem) => (
                              <tr 
                                key={orgItem.id} 
                                className={cn(
                                  "hover:bg-gray-50 transition-colors cursor-pointer",
                                  orgItem.id === org?.id && "bg-purple-50"
                                )}
                              >
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "font-bold",
                                    orgItem.rank <= 3 ? primaryTextClass : "text-gray-900"
                                  )}>
                                    #{orgItem.rank}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "w-10 h-10 rounded-lg flex items-center justify-center",
                                      orgItem.id === org?.id ? "bg-purple-500" : "bg-purple-100"
                                    )}>
                                      <Building2 className={cn(
                                        "w-5 h-5",
                                        orgItem.id === org?.id ? "text-white" : "text-purple-500"
                                      )} />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900">{orgItem.name}</p>
                                        {orgItem.id === org?.id && (
                                          <Badge className="bg-purple-500 text-white text-xs">You</Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        {orgItem.city && (
                                          <span className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            {orgItem.city}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center hidden sm:table-cell">
                                  <div className="flex items-center justify-center gap-1">
                                    <Users className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium text-gray-900">{orgItem.stats.totalMembers}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900">
                                  {orgItem.stats.totalPoints.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                                  {orgItem.stats.avgPoints.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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

  // School-specific tabs
  if (isSchool || isCollege) {
    const orgTypeName = isSchool ? "School" : "College";
    const dashboardRoute = isSchool ? "school-dashboard" : "college-dashboard";
    
    return (
      <div className="bg-gray-50 min-h-screen">
        <Sidebar />
        <main className="ml-0 md:ml-72">
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <Button
                variant="ghost"
                onClick={() => router.push(`/${sport}/org/${dashboardRoute}`)}
                className="mb-2 text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">{orgTypeName} Leaderboard</h1>
              <p className="text-gray-500">View intra-{orgTypeName.toLowerCase()} rankings and inter-{orgTypeName.toLowerCase()} league standings</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Users className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
                  <p className="text-2xl font-bold text-gray-900">{intraSchoolLeaderboard.length || 0}</p>
                  <p className="text-xs text-gray-500">Students</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Shield className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                  <p className="text-2xl font-bold text-gray-900">{interSchoolTeams.length || 0}</p>
                  <p className="text-xs text-gray-500">School Teams</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Trophy className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                  <p className="text-lg font-bold text-gray-900 truncate">
                    {intraSchoolLeaderboard[0]?.studentName || "--"}
                  </p>
                  <p className="text-xs text-gray-500">Top Student</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Medal className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-lg font-bold text-gray-900">
                    {interSchoolTeams.filter(t => t.tournamentsWon > 0).length || 0}
                  </p>
                  <p className="text-xs text-gray-500">Tournament Wins</p>
                </CardContent>
              </Card>
            </div>

            {/* School Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-white border border-gray-200">
                <TabsTrigger value="intra-school" className="gap-2">
                  <Users className="w-4 h-4" />
                  Intra-{orgTypeName}
                </TabsTrigger>
                <TabsTrigger value="inter-school" className="gap-2">
                  <Shield className="w-4 h-4" />
                  Inter-{orgTypeName} League
                </TabsTrigger>
              </TabsList>

              {/* Intra-School Tab (Students within school) */}
              <TabsContent value="intra-school" className="space-y-4">
                <Card className="bg-white border-gray-100 shadow-sm mb-4">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Intra-{orgTypeName} Leaderboard</CardTitle>
                        <CardDescription>Student rankings within {org?.name || "your school"}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search students by name, class, or house..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Student Leaderboard */}
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-0">
                    {intraSchoolLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    ) : intraSchoolLeaderboard.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No students found</p>
                        <p className="text-sm">Students will appear here after participating in internal tournaments</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-96">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-gray-100">
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Class</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">House</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Points</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Events</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Win Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {intraSchoolLeaderboard.map((student) => (
                              <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "font-bold",
                                    student.rank <= 3 ? primaryTextClass : "text-gray-900"
                                  )}>
                                    #{student.rank}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-gray-900">{student.studentName}</p>
                                </td>
                                <td className="px-4 py-3 hidden sm:table-cell">
                                  <span className="text-sm text-gray-600">{student.className}</span>
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell">
                                  {student.houseName && (
                                    <Badge variant="outline" className="text-xs">{student.houseName}</Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900">
                                  {student.points.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                                  {student.tournamentsPlayed}
                                </td>
                                <td className="px-4 py-3 text-center hidden md:table-cell">
                                  <span className="text-green-600 font-medium">{student.winRate}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Inter-School League Tab (School Teams in External Tournaments) */}
              <TabsContent value="inter-school" className="space-y-4">
                <Card className="bg-white border-gray-100 shadow-sm mb-4">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Inter-{orgTypeName} League</CardTitle>
                        <CardDescription>Your school teams&apos; performance in external tournaments</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* School Teams Performance */}
                {interSchoolLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : interSchoolTeams.length === 0 ? (
                  <Card className="bg-white border-gray-100 shadow-sm">
                    <CardContent className="py-12">
                      <div className="text-center text-gray-500">
                        <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No school teams registered yet</p>
                        <p className="text-sm">Create teams to participate in inter-school tournaments</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {interSchoolTeams.map((team) => (
                      <Card key={team.id} className="bg-white border-gray-100 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
                                <Shield className="w-6 h-6 text-purple-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-gray-900">{team.teamName}</h3>
                                  <Badge className={cn(
                                    team.rank === 1 ? "bg-amber-100 text-amber-700" :
                                    team.rank === 2 ? "bg-gray-100 text-gray-700" :
                                    "bg-orange-100 text-orange-700"
                                  )}>
                                    #{team.rank}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                  {team.tournamentsParticipated} tournaments • {team.matchesWon}/{team.totalMatches} matches won
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-gray-900">{team.totalPoints.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">points</p>
                            </div>
                          </div>
                          
                          {/* Team Stats */}
                          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                            <div className="text-center">
                              <p className="text-lg font-bold text-purple-600">{team.tournamentsParticipated}</p>
                              <p className="text-xs text-gray-500">Tournaments</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-green-600">{team.tournamentsWon}</p>
                              <p className="text-xs text-gray-500">Wins</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-gray-700">{team.matchesWon}/{team.totalMatches}</p>
                              <p className="text-xs text-gray-500">Matches</p>
                            </div>
                          </div>

                          {/* Recent Tournament */}
                          {team.recentTournament && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <p className="text-xs text-gray-500 mb-1">Recent Tournament</p>
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-900">{team.recentTournament.name}</p>
                                <Badge className={cn(
                                  team.recentTournament.position.includes("1st") ? "bg-amber-100 text-amber-700" :
                                  team.recentTournament.position.includes("2nd") ? "bg-gray-100 text-gray-700" :
                                  team.recentTournament.position.includes("3rd") ? "bg-orange-100 text-orange-700" :
                                  "bg-blue-100 text-blue-700"
                                )}>
                                  {team.recentTournament.position}
                                </Badge>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    );
  }

  // Regular organization leaderboard (non-corporate)
  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
            <p className="text-gray-500">View player and organization rankings for {sportName}</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900">{playerStats?.totalPlayers || 0}</p>
                <p className="text-xs text-gray-500">Total Players</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Building2 className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-gray-900">{orgStats?.totalOrganizations || 0}</p>
                <p className="text-xs text-gray-500">Organizations</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                <p className="text-lg font-bold text-gray-900 truncate">
                  {activeTab === "players" 
                    ? (playerStats?.topPlayer || "--")
                    : (orgStats?.topOrg || "--")}
                </p>
                <p className="text-xs text-gray-500">Top {activeTab === "players" ? "Player" : "Org"}</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                <p className="text-2xl font-bold text-gray-900">{playerStats?.activeThisMonth || 0}</p>
                <p className="text-xs text-gray-500">Active This Month</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <TabsList className="bg-white border border-gray-200">
                <TabsTrigger value="players" className="gap-2">
                  <Users className="w-4 h-4" />
                  Players
                </TabsTrigger>
                <TabsTrigger value="organizations" className="gap-2">
                  <Building2 className="w-4 h-4" />
                  Organizations
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Filters Card */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={`Search ${activeTab === "players" ? "players" : "organizations"}...`}
                      className="pl-10"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select value={scopeFilter} onValueChange={setScopeFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national">National</SelectItem>
                      <SelectItem value="state">State</SelectItem>
                      <SelectItem value="district">District</SelectItem>
                      <SelectItem value="city">City</SelectItem>
                    </SelectContent>
                  </Select>
                  {activeTab === "players" ? (
                    <>
                      <Select value={tierFilter} onValueChange={setTierFilter}>
                        <SelectTrigger className="w-full sm:w-32">
                          <SelectValue placeholder="Tier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Tiers</SelectItem>
                          <SelectItem value="DIAMOND">Diamond</SelectItem>
                          <SelectItem value="PLATINUM">Platinum</SelectItem>
                          <SelectItem value="GOLD">Gold</SelectItem>
                          <SelectItem value="SILVER">Silver</SelectItem>
                          <SelectItem value="BRONZE">Bronze</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-full sm:w-36">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="points">Points</SelectItem>
                          <SelectItem value="elo">ELO Rating</SelectItem>
                          <SelectItem value="matches">Matches</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <>
                      <Select value={orgTypeFilter} onValueChange={setOrgTypeFilter}>
                        <SelectTrigger className="w-full sm:w-32">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="CLUB">Club</SelectItem>
                          <SelectItem value="SCHOOL">School</SelectItem>
                          <SelectItem value="CORPORATE">Corporate</SelectItem>
                          <SelectItem value="ACADEMY">Academy</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-full sm:w-36">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="points">Total Points</SelectItem>
                          <SelectItem value="members">Members</SelectItem>
                          <SelectItem value="avgPoints">Avg Points</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Players Tab Content */}
            <TabsContent value="players" className="space-y-4">
              {/* Full Leaderboard Table */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Player Rankings</CardTitle>
                  <CardDescription>
                    {filteredPlayerLeaderboard.length} players found
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {playerLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : filteredPlayerLeaderboard.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No players found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-white">
                          <tr className="border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Tier</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Points</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Matches</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Win Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredPlayerLeaderboard.map((player) => (
                            <tr key={player.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => window.location.href = `/${sport}/players/${player.id}`}>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "font-bold",
                                  player.rank <= 3 ? primaryTextClass : "text-gray-900"
                                )}>
                                  #{player.rank}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback className={cn(primaryBgClass, primaryTextClass, "text-xs")}>
                                      {player.name.split(" ").map(n => n[0]).join("")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-gray-900">{player.name}</p>
                                    <p className="text-xs text-gray-500">{player.city}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <Badge variant="outline" className={tierColors[player.tier] || tierColors.UNRANKED}>
                                  {player.tier}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900">
                                {player.points.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                                {player.matches}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                                {player.matches > 0 ? Math.round((player.wins / player.matches) * 100) : 0}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Organizations Tab Content */}
            <TabsContent value="organizations" className="space-y-4">
              {/* Full Leaderboard Table */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Organization Rankings</CardTitle>
                  <CardDescription>
                    {filteredOrgLeaderboard.length} organizations found
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {orgLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : filteredOrgLeaderboard.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No organizations found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-white">
                          <tr className="border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Members</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Points</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Avg Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredOrgLeaderboard.map((orgItem) => (
                            <tr key={orgItem.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => window.location.href = `/${sport}/organizations/${orgItem.id}`}>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "font-bold",
                                  orgItem.rank <= 3 ? primaryTextClass : "text-gray-900"
                                )}>
                                  #{orgItem.rank}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center",
                                    orgItem.isSubscribed ? "bg-purple-100" : "bg-gray-100"
                                  )}>
                                    <Building2 className={cn(
                                      "w-5 h-5",
                                      orgItem.isSubscribed ? "text-purple-500" : "text-gray-500"
                                    )} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-gray-900">{orgItem.name}</p>
                                      {orgItem.isSubscribed && (
                                        <CheckCircle className="w-4 h-4 text-purple-500" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      <Badge className={cn("text-xs", orgTypeColors[orgItem.type] || "bg-gray-100")}>
                                        {orgItem.type}
                                      </Badge>
                                      {orgItem.city && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="w-3 h-3" />
                                          {orgItem.city}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center hidden sm:table-cell">
                                <div className="flex items-center justify-center gap-1">
                                  <Users className="w-4 h-4 text-gray-400" />
                                  <span className="font-medium text-gray-900">{orgItem.stats.totalMembers}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900">
                                {orgItem.stats.totalPoints.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                                {orgItem.stats.avgPoints.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
