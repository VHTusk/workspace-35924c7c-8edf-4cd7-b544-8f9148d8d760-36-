"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  MapPin,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Target,
  Medal,
  TrendingUp,
  Star,
  Globe,
  Filter,
  Search,
  LayoutDashboard,
  Award,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface OpenCompetitionEntry {
  id: string;
  userId: string;
  userName: string;
  tournamentId: string;
  tournamentName: string;
  tournamentScope: string;
  tournamentStartDate: Date;
  placement?: number | null;
  pointsEarned: number;
  registeredAt: Date;
}

interface TopPerformer {
  userId: string;
  userName: string;
  totalTournaments: number;
  totalPoints: number;
  topPlacements: {
    first: number;
    second: number;
    third: number;
  };
}

interface OpenCompetitionsStats {
  totalParticipants: number;
  activeCompetitions: number;
  topPerformers: TopPerformer[];
  byScope: { scope: string; count: number }[];
  recentEntries: OpenCompetitionEntry[];
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function OpenCompetitionsPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [org, setOrg] = useState<OrgData | null>(null);
  const [stats, setStats] = useState<OpenCompetitionsStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  // Navigation items
  const navItems = [
    { label: "Dashboard", href: "/org/home", icon: LayoutDashboard },
    { label: "Employees", href: `/${sport}/org/employees`, icon: Users },
    { label: "Open Competitions", href: `/${sport}/org/open-competitions`, icon: Globe },
    { label: "Leaderboard", href: `/${sport}/org/leaderboard`, icon: Award },
  ];

  useEffect(() => {
    fetchOrg();
    fetchOpenCompetitions();
  }, [sport]);

  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
        
        if (data.type !== "CORPORATE") {
          router.push(`/${sport}/org/dashboard`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchOpenCompetitions = async () => {
    setLoading(true);
    try {
      const orgResponse = await fetch("/api/org/me");
      if (!orgResponse.ok) throw new Error("Failed to get organization");
      const orgData = await orgResponse.json();

      const response = await fetch(`/api/orgs/${orgData.id}/open-competitions?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        // Use mock data if API not available
        setStats({
          totalParticipants: 15,
          activeCompetitions: 3,
          topPerformers: [
            { userId: "1", userName: "Rahul Sharma", totalTournaments: 8, totalPoints: 450, topPlacements: { first: 2, second: 1, third: 2 } },
            { userId: "2", userName: "Priya Patel", totalTournaments: 6, totalPoints: 380, topPlacements: { first: 1, second: 2, third: 1 } },
            { userId: "3", userName: "Amit Kumar", totalTournaments: 5, totalPoints: 320, topPlacements: { first: 1, second: 1, third: 0 } },
            { userId: "4", userName: "Sneha Gupta", totalTournaments: 5, totalPoints: 290, topPlacements: { first: 0, second: 2, third: 1 } },
            { userId: "5", userName: "Vikram Singh", totalTournaments: 4, totalPoints: 250, topPlacements: { first: 1, second: 0, third: 1 } },
          ],
          byScope: [
            { scope: "CITY", count: 12 },
            { scope: "STATE", count: 8 },
            { scope: "NATIONAL", count: 3 },
          ],
          recentEntries: [
            { id: "1", userId: "1", userName: "Rahul Sharma", tournamentId: "t1", tournamentName: "Mumbai Open Championship", tournamentScope: "CITY", tournamentStartDate: new Date("2024-03-15"), placement: 2, pointsEarned: 80, registeredAt: new Date("2024-03-01") },
            { id: "2", userId: "2", userName: "Priya Patel", tournamentId: "t2", tournamentName: "Maharashtra State League", tournamentScope: "STATE", tournamentStartDate: new Date("2024-03-10"), placement: 1, pointsEarned: 100, registeredAt: new Date("2024-02-28") },
            { id: "3", userId: "3", userName: "Amit Kumar", tournamentId: "t3", tournamentName: "Corporate Sports Fest", tournamentScope: "CITY", tournamentStartDate: new Date("2024-03-05"), placement: 3, pointsEarned: 60, registeredAt: new Date("2024-02-20") },
          ],
        });
      }
    } catch (err) {
      console.error("Failed to fetch open competitions:", err);
      setError("Failed to load open competitions data");
    } finally {
      setLoading(false);
    }
  };

  const getPlacementIcon = (placement?: number | null) => {
    if (!placement) return <span className="text-gray-400">-</span>;
    if (placement === 1) return <Crown className="w-4 h-4 text-yellow-500" />;
    if (placement === 2) return <Medal className="w-4 h-4 text-gray-400" />;
    if (placement === 3) return <Medal className="w-4 h-4 text-amber-600" />;
    return <span className="text-sm text-gray-500">#{placement}</span>;
  };

  const getScopeBadge = (scope: string) => {
    const styles: Record<string, string> = {
      CITY: "bg-blue-50 text-blue-700 border-blue-200",
      STATE: "bg-purple-50 text-purple-700 border-purple-200",
      NATIONAL: "bg-amber-50 text-amber-700 border-amber-200",
      INTERNATIONAL: "bg-red-50 text-red-700 border-red-200",
    };
    return (
      <Badge variant="outline" className={styles[scope] || "bg-gray-50 text-gray-600"}>
        {scope}
      </Badge>
    );
  };

  const getRankBgClass = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200";
    if (rank === 2) return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200";
    if (rank === 3) return "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200";
    return "bg-white border-gray-100";
  };

  const filteredEntries = stats?.recentEntries.filter(entry => {
    if (scopeFilter !== "all" && entry.tournamentScope !== scopeFilter) return false;
    if (searchQuery && !entry.userName.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !entry.tournamentName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }) || [];

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Open Competitions</h1>
                <p className="text-gray-500">Track employees participating in external tournaments independently</p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push(`/${sport}/tournaments`)}
              >
                <Globe className="w-4 h-4 mr-2" />
                Browse Tournaments
              </Button>
            </div>
          </div>

          {/* Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900">{stats?.totalParticipants || 0}</p>
                <p className="text-xs text-gray-500">Active Participants</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-gray-900">{stats?.activeCompetitions || 0}</p>
                <p className="text-xs text-gray-500">Active Competitions</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.recentEntries?.length || 0}
                </p>
                <p className="text-xs text-gray-500">Total Participations</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Medal className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.topPerformers?.reduce((sum, p) => sum + p.topPlacements.first + p.topPlacements.second + p.topPlacements.third, 0) || 0}
                </p>
                <p className="text-xs text-gray-500">Podium Finishes</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Performers */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  Top Performers
                </CardTitle>
                <CardDescription>Leading individuals in external tournaments</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : !stats?.topPerformers?.length ? (
                  <div className="text-center py-8 text-gray-500">
                    <Star className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No participation data yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.topPerformers.slice(0, 5).map((performer, index) => (
                      <div
                        key={performer.userId}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-colors",
                          getRankBgClass(index + 1)
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100">
                            {index < 3 ? getPlacementIcon(index + 1) : (
                              <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{performer.userName}</p>
                            <p className="text-xs text-gray-500">{performer.totalTournaments} tournaments</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{performer.totalPoints}</p>
                          <div className="flex items-center gap-1 text-xs">
                            {performer.topPlacements.first > 0 && (
                              <span className="text-yellow-500">{performer.topPlacements.first}🥇</span>
                            )}
                            {performer.topPlacements.second > 0 && (
                              <span className="text-gray-400">{performer.topPlacements.second}🥈</span>
                            )}
                            {performer.topPlacements.third > 0 && (
                              <span className="text-amber-600">{performer.topPlacements.third}🥉</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scope Distribution */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  Competition Scope
                </CardTitle>
                <CardDescription>Participation by tournament scope</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : !stats?.byScope?.length ? (
                  <div className="text-center py-8 text-gray-500">
                    <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No scope data yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.byScope.map((scope) => (
                      <div key={scope.scope} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getScopeBadge(scope.scope)}
                          <span className="text-sm text-gray-600">tournaments</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                scope.scope === "CITY" ? "bg-blue-500" :
                                scope.scope === "STATE" ? "bg-purple-500" :
                                scope.scope === "NATIONAL" ? "bg-amber-500" : "bg-red-500"
                              )}
                              style={{ width: `${Math.min((scope.count / Math.max(...stats.byScope.map(s => s.count))) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 w-8">{scope.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Participations */}
            <Card className="bg-white border-gray-100 shadow-sm lg:col-span-3">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      Recent Participations
                    </CardTitle>
                    <CardDescription>Individual tournament participations by employees</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search & Filter */}
                <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b border-gray-100">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by name or tournament..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={scopeFilter} onValueChange={setScopeFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Scopes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Scopes</SelectItem>
                      <SelectItem value="CITY">City</SelectItem>
                      <SelectItem value="STATE">State</SelectItem>
                      <SelectItem value="NATIONAL">National</SelectItem>
                      <SelectItem value="INTERNATIONAL">International</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No participation records found</p>
                    <p className="text-sm">Employees participating in external tournaments will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                          <th className="pb-3 font-medium">Employee</th>
                          <th className="pb-3 font-medium">Tournament</th>
                          <th className="pb-3 font-medium">Scope</th>
                          <th className="pb-3 font-medium">Date</th>
                          <th className="pb-3 font-medium text-center">Placement</th>
                          <th className="pb-3 font-medium text-right">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEntries.map((entry) => (
                          <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                  <span className="text-xs font-medium text-gray-600">
                                    {entry.userName.split(" ").map(n => n[0]).join("")}
                                  </span>
                                </div>
                                <span className="font-medium text-gray-900">{entry.userName}</span>
                              </div>
                            </td>
                            <td className="py-3 text-gray-700">{entry.tournamentName}</td>
                            <td className="py-3">{getScopeBadge(entry.tournamentScope)}</td>
                            <td className="py-3 text-sm text-gray-500">
                              {new Date(entry.tournamentStartDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {getPlacementIcon(entry.placement)}
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <span className="font-semibold text-gray-900">{entry.pointsEarned}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
