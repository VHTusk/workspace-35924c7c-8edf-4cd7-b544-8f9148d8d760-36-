"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy,
  Building2,
  Users,
  Search,
  Loader2,
  MapPin,
  Briefcase,
  TrendingUp,
  CheckCircle,
  ArrowLeft,
  Crown,
  Flame,
  Medal,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/layout/sidebar";

// Types
interface EmployeeLeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  department?: string;
  points: number;
  wins: number;
  matches: number;
  tier: string;
  change: number;
  avatar?: string;
}

interface CorporateLeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  city?: string;
  state?: string;
  totalPoints: number;
  totalMembers: number;
  avgPoints: number;
  tournamentsWon: number;
  isSubscribed: boolean;
}

interface OrganizationData {
  id: string;
  name: string;
  type: string;
  city?: string;
  state?: string;
  planTier: string;
}

const tierColors: Record<string, string> = {
  DIAMOND: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  PLATINUM: "text-teal-400 bg-teal-500/10 border-teal-500/30",
  GOLD: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  SILVER: "text-gray-400 bg-gray-500/10 border-gray-500/30",
  BRONZE: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  UNRANKED: "text-gray-400 bg-gray-500/10 border-gray-500/30",
};

const tierIcons: Record<string, string> = {
  DIAMOND: "💎",
  PLATINUM: "🔷",
  GOLD: "🥇",
  SILVER: "🥈",
  BRONZE: "🥉",
  UNRANKED: "⚪",
};

export default function CorporateLeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";

  const [orgData, setOrgData] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaderboardType, setLeaderboardType] = useState<"intra" | "inter">("intra");

  // Leaderboard data
  const [intraLeaderboard, setIntraLeaderboard] = useState<EmployeeLeaderboardEntry[]>([]);
  const [interLeaderboard, setInterLeaderboard] = useState<CorporateLeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");

  // Theme classes
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  useEffect(() => {
    fetchOrgData();
  }, []);

  useEffect(() => {
    if (orgData?.id) {
      fetchLeaderboards();
    }
  }, [orgData?.id, sport]);

  const fetchOrgData = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        if (data.type !== "CORPORATE") {
          router.push(`/${sport}/org/dashboard`);
          return;
        }
        setOrgData(data);
      }
    } catch (error) {
      console.error("Failed to fetch org data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboards = async () => {
    if (!orgData?.id) return;
    setLeaderboardLoading(true);
    try {
      // Fetch intra-corporate leaderboard
      const intraResponse = await fetch(`/api/orgs/${orgData.id}/intra-leaderboard?sport=${sport.toUpperCase()}`);
      if (intraResponse.ok) {
        const data = await intraResponse.json();
        setIntraLeaderboard(data.leaderboard || getMockIntraLeaderboard());
      } else {
        setIntraLeaderboard(getMockIntraLeaderboard());
      }

      // Fetch inter-corporate leaderboard
      const interResponse = await fetch(`/api/organizations/leaderboard?sport=${sport.toUpperCase()}&type=CORPORATE`);
      if (interResponse.ok) {
        const data = await interResponse.json();
        setInterLeaderboard(data.leaderboard || getMockInterLeaderboard());
      } else {
        setInterLeaderboard(getMockInterLeaderboard());
      }
    } catch (error) {
      console.error("Failed to fetch leaderboards:", error);
      setIntraLeaderboard(getMockIntraLeaderboard());
      setInterLeaderboard(getMockInterLeaderboard());
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const getMockIntraLeaderboard = (): EmployeeLeaderboardEntry[] => [
    { rank: 1, id: "1", name: "Rahul Sharma", department: "Engineering", points: 2850, wins: 24, matches: 30, tier: "GOLD", change: 2 },
    { rank: 2, id: "2", name: "Priya Patel", department: "Marketing", points: 2640, wins: 22, matches: 28, tier: "GOLD", change: 1 },
    { rank: 3, id: "3", name: "Amit Kumar", department: "Sales", points: 2420, wins: 18, matches: 25, tier: "SILVER", change: -1 },
    { rank: 4, id: "4", name: "Sneha Gupta", department: "Engineering", points: 2180, wins: 16, matches: 22, tier: "SILVER", change: 3 },
    { rank: 5, id: "5", name: "Vikram Singh", department: "HR", points: 1950, wins: 14, matches: 20, tier: "SILVER", change: 0 },
    { rank: 6, id: "6", name: "Ananya Reddy", department: "Finance", points: 1820, wins: 12, matches: 18, tier: "BRONZE", change: -2 },
    { rank: 7, id: "7", name: "Karthik Nair", department: "Operations", points: 1680, wins: 10, matches: 16, tier: "BRONZE", change: 1 },
    { rank: 8, id: "8", name: "Meera Iyer", department: "Engineering", points: 1540, wins: 8, matches: 14, tier: "BRONZE", change: 0 },
    { rank: 9, id: "9", name: "Rohan Mehta", department: "Sales", points: 1420, wins: 6, matches: 12, tier: "BRONZE", change: 2 },
    { rank: 10, id: "10", name: "Divya Krishnan", department: "Marketing", points: 1350, wins: 5, matches: 10, tier: "UNRANKED", change: -1 },
  ];

  const getMockInterLeaderboard = (): CorporateLeaderboardEntry[] => [
    { rank: 1, id: "1", name: "TechCorp India", city: "Bangalore", state: "Karnataka", totalPoints: 45000, totalMembers: 120, avgPoints: 375, tournamentsWon: 8, isSubscribed: true },
    { rank: 2, id: "2", name: "Global Solutions Ltd", city: "Mumbai", state: "Maharashtra", totalPoints: 42800, totalMembers: 95, avgPoints: 450, tournamentsWon: 6, isSubscribed: true },
    { rank: 3, id: "3", name: orgData?.name || "Your Company", city: orgData?.city || "Mumbai", state: orgData?.state || "Maharashtra", totalPoints: 38500, totalMembers: 85, avgPoints: 453, tournamentsWon: 5, isSubscribed: true },
    { rank: 4, id: "4", name: "Innovate Partners", city: "Pune", state: "Maharashtra", totalPoints: 35200, totalMembers: 70, avgPoints: 503, tournamentsWon: 4, isSubscribed: true },
    { rank: 5, id: "5", name: "Digital Dynamics", city: "Hyderabad", state: "Telangana", totalPoints: 32100, totalMembers: 65, avgPoints: 494, tournamentsWon: 3, isSubscribed: false },
    { rank: 6, id: "6", name: "Cloud Nine Corp", city: "Chennai", state: "Tamil Nadu", totalPoints: 29800, totalMembers: 55, avgPoints: 542, tournamentsWon: 3, isSubscribed: true },
    { rank: 7, id: "7", name: "Quantum Systems", city: "Delhi", state: "Delhi", totalPoints: 27500, totalMembers: 50, avgPoints: 550, tournamentsWon: 2, isSubscribed: true },
    { rank: 8, id: "8", name: "Apex Technologies", city: "Ahmedabad", state: "Gujarat", totalPoints: 25200, totalMembers: 45, avgPoints: 560, tournamentsWon: 2, isSubscribed: false },
  ];

  // Get unique departments for filter
  const departments = [...new Set(intraLeaderboard.map(e => e.department).filter(Boolean))];

  // Filter intra leaderboard
  const filteredIntraLeaderboard = intraLeaderboard.filter(entry => {
    if (search && !entry.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (departmentFilter !== "all" && entry.department !== departmentFilter) return false;
    if (tierFilter !== "all" && entry.tier !== tierFilter) return false;
    return true;
  });

  // Filter inter leaderboard
  const filteredInterLeaderboard = interLeaderboard.filter(entry => {
    if (search && !entry.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Theme classes
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex">
        <Sidebar />
        <main className="ml-72 flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen flex">
      <Sidebar />
      <main className="ml-72 flex-1 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Building2 className="w-4 h-4" />
          <span>Corporate Leaderboard</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
            <p className="text-gray-500">View rankings for {sportName} competitions</p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.push(`/${sport}/org/corporate-dashboard`)}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Your Rank</p>
                <p className="text-xl font-bold text-gray-900">#3</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <Medal className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Top Performers</p>
                <p className="text-xl font-bold text-gray-900">{filteredIntraLeaderboard.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Competitors</p>
                <p className="text-xl font-bold text-gray-900">{filteredInterLeaderboard.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

          {/* Toggle Switch */}
          <div className="mb-6">
            <Tabs value={leaderboardType} onValueChange={(v) => setLeaderboardType(v as "intra" | "inter")} className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-white border border-gray-200 p-1 h-auto shadow-sm">
                  <TabsTrigger 
                    value="intra" 
                    className={cn(
                      "gap-2 px-6 py-2.5 rounded-md transition-all",
                      "data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
                      "text-gray-600"
                    )}
                  >
                    <Briefcase className="w-4 h-4" />
                    Intra-Corporate
                  </TabsTrigger>
                  <TabsTrigger 
                    value="inter" 
                    className={cn(
                      "gap-2 px-6 py-2.5 rounded-md transition-all",
                      "data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
                      "text-gray-600"
                    )}
                  >
                    <Building2 className="w-4 h-4" />
                    Inter-Corporate
                  </TabsTrigger>
                </TabsList>

                {/* Stats Summary */}
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500">
                    <span className="font-medium text-gray-900">
                      {leaderboardType === "intra" ? filteredIntraLeaderboard.length : filteredInterLeaderboard.length}
                    </span>{" "}
                    {leaderboardType === "intra" ? "employees" : "companies"}
                  </div>
                </div>
              </div>

              {/* Filters */}
              <Card className="bg-white border-gray-100 shadow-sm mb-4">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder={`Search ${leaderboardType === "intra" ? "employees" : "companies"}...`}
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>

                    {leaderboardType === "intra" && (
                      <>
                        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                          <SelectTrigger className="w-full sm:w-40">
                            <SelectValue placeholder="Department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map(dept => (
                              <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Intra-Corporate Leaderboard */}
              <TabsContent value="intra" className="space-y-4">
                {/* Info Card */}
                <Card className="bg-purple-50 border-purple-100">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Briefcase className="w-5 h-5 text-purple-600 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-purple-900">Intra-Corporate Leaderboard</h3>
                        <p className="text-sm text-purple-700">
                          Rankings of employees within {orgData?.name || "your organization"}. 
                          Top performers from internal tournaments and matches.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top 3 Podium */}
                {!leaderboardLoading && filteredIntraLeaderboard.length >= 3 && (
                  <div className="grid grid-cols-3 gap-4">
                    {filteredIntraLeaderboard.slice(0, 3).map((player, index) => (
                      <Card 
                        key={player.id} 
                        className={cn(
                          "bg-white border-gray-100 shadow-sm",
                          index === 0 ? "order-2 sm:scale-105 border-amber-300" : 
                          index === 1 ? "order-1" : 
                          "order-3"
                        )}
                      >
                        <CardContent className={cn("p-4 text-center", index === 0 ? "pt-6" : "")}>
                          <div className="text-2xl mb-2">{tierIcons[player.tier] || "⚪"}</div>
                          <Avatar className={cn("mx-auto mb-2", index === 0 ? "w-16 h-16" : "w-12 h-12")}>
                            <AvatarFallback className={cn(primaryBgClass, primaryTextClass, "text-lg")}>
                              {player.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <p className="font-semibold text-gray-900 truncate">{player.name}</p>
                          <p className="text-xs text-gray-500">{player.department}</p>
                          <Badge variant="outline" className={cn("mt-2", tierColors[player.tier] || tierColors.UNRANKED)}>
                            {player.tier}
                          </Badge>
                          <div className="mt-2">
                            <p className="text-2xl font-bold text-gray-900">{player.points.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">points</p>
                          </div>
                          <div className={cn(
                            "text-2xl font-bold",
                            index === 0 ? "text-amber-500" : 
                            index === 1 ? "text-gray-400" : 
                            "text-orange-400"
                          )}>
                            #{player.rank}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Full Leaderboard Table */}
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-gray-900 flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      Employee Rankings
                    </CardTitle>
                    <CardDescription>Internal leaderboard for {orgData?.name || "your company"} employees</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {leaderboardLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    ) : filteredIntraLeaderboard.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No employees found</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-white z-10">
                            <tr className="border-b border-gray-100">
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Tier</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Points</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Win Rate</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Change</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredIntraLeaderboard.map((player) => (
                              <tr key={player.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
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
                                      <p className="text-xs text-gray-500">{player.department}</p>
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
                                  {player.matches > 0 ? Math.round((player.wins / player.matches) * 100) : 0}%
                                </td>
                                <td className="px-4 py-3 text-right hidden md:table-cell">
                                  {player.change > 0 ? (
                                    <span className="flex items-center justify-end gap-1 text-green-600">
                                      <TrendingUp className="w-3 h-3" />
                                      +{player.change}
                                    </span>
                                  ) : player.change < 0 ? (
                                    <span className="flex items-center justify-end gap-1 text-red-600">
                                      <TrendingUp className="w-3 h-3 rotate-180" />
                                      {player.change}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
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

              {/* Inter-Corporate Leaderboard */}
              <TabsContent value="inter" className="space-y-4">
                {/* Info Card */}
                <Card className="bg-blue-50 border-blue-100">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-blue-900">Inter-Corporate Leaderboard</h3>
                        <p className="text-sm text-blue-700">
                          Compare your company against other corporations in the {sportName} ecosystem. 
                          Rankings based on external tournament performance.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top 3 Podium */}
                {!leaderboardLoading && filteredInterLeaderboard.length >= 3 && (
                  <div className="grid grid-cols-3 gap-4">
                    {filteredInterLeaderboard.slice(0, 3).map((corp, index) => (
                      <Card 
                        key={corp.id} 
                        className={cn(
                          "bg-white border-gray-100 shadow-sm",
                          index === 0 ? "order-2 sm:scale-105 border-amber-300" : 
                          index === 1 ? "order-1" : 
                          "order-3",
                          corp.name === orgData?.name && "ring-2 ring-purple-300"
                        )}
                      >
                        <CardContent className={cn("p-4 text-center", index === 0 ? "pt-6" : "")}>
                          <div className={cn(
                            "w-12 h-12 mx-auto mb-2 rounded-xl flex items-center justify-center",
                            index === 0 ? "w-16 h-16" : "",
                            corp.isSubscribed ? "bg-purple-100" : "bg-gray-100"
                          )}>
                            <Building2 className={cn(
                              corp.isSubscribed ? "text-purple-500" : "text-gray-500",
                              index === 0 ? "w-8 h-8" : "w-6 h-6"
                            )} />
                          </div>
                          <p className="font-semibold text-gray-900 truncate">{corp.name}</p>
                          <p className="text-xs text-gray-500">{corp.city || "-"}, {corp.state || "-"}</p>
                          {corp.name === orgData?.name && (
                            <Badge className="mt-1 bg-purple-100 text-purple-700">Your Company</Badge>
                          )}
                          <div className="mt-2">
                            <p className="text-2xl font-bold text-gray-900">{(corp.totalPoints || 0).toLocaleString()}</p>
                            <p className="text-xs text-gray-500">points</p>
                          </div>
                          <div className={cn(
                            "text-2xl font-bold",
                            index === 0 ? "text-amber-500" : 
                            index === 1 ? "text-gray-400" : 
                            "text-orange-400"
                          )}>
                            #{corp.rank}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Full Leaderboard Table */}
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-gray-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Corporate Rankings
                    </CardTitle>
                    <CardDescription>Compare your company against other corporations</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {leaderboardLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    ) : filteredInterLeaderboard.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No companies found</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-white z-10">
                            <tr className="border-b border-gray-100">
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Members</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Points</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Avg Points</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Wins</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredInterLeaderboard.map((corp) => (
                              <tr 
                                key={corp.id} 
                                className={cn(
                                  "hover:bg-gray-50 transition-colors cursor-pointer",
                                  corp.name === orgData?.name && "bg-purple-50"
                                )}
                              >
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "font-bold",
                                    corp.rank <= 3 ? primaryTextClass : "text-gray-900"
                                  )}>
                                    #{corp.rank}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "w-10 h-10 rounded-lg flex items-center justify-center",
                                      corp.isSubscribed ? "bg-purple-100" : "bg-gray-100"
                                    )}>
                                      <Building2 className={cn(
                                        "w-5 h-5",
                                        corp.isSubscribed ? "text-purple-500" : "text-gray-500"
                                      )} />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900">{corp.name}</p>
                                        {corp.isSubscribed && (
                                          <CheckCircle className="w-4 h-4 text-purple-500" />
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                          <MapPin className="w-3 h-3" />
                                          {corp.city || "-"}, {corp.state || "-"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center hidden sm:table-cell">
                                  <div className="flex items-center justify-center gap-1">
                                    <Users className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium text-gray-900">{corp.totalMembers}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900">
                                  {(corp.totalPoints || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                                  {(corp.avgPoints || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-center hidden md:table-cell">
                                  <div className="flex items-center justify-center gap-1">
                                    <Trophy className="w-4 h-4 text-amber-500" />
                                    <span className="text-gray-600">{corp.tournamentsWon}</span>
                                  </div>
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
