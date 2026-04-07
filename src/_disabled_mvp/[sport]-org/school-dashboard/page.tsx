"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Sidebar from "@/components/layout/sidebar";
import {
  Users,
  Trophy,
  Calendar,
  UserPlus,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  GraduationCap,
  Shield,
  Target,
  Medal,
  Users2,
  BookOpen,
  MapPin,
  Mail,
  Phone,
  Settings,
  Home,
  Clock,
  TrendingUp,
  Award,
  Bell,
  FileText,
  Globe,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types for School Dashboard
interface Organization {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  planTier: string;
  logoUrl?: string;
}

interface SchoolClass {
  id: string;
  name: string;
  sections: string[];
  studentCount: number;
}

interface House {
  id: string;
  name: string;
  color: string;
  studentCount: number;
  points: number;
  rank?: number;
}

interface Student {
  id: string;
  userId?: string;
  rollNo?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  class?: string;
  section?: string;
  house?: string;
  isVerified: boolean;
  isActive: boolean;
  joinedAt: string;
}

interface SchoolTeam {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  status: string;
  formedAt: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  tournamentsParticipated: number;
  tournamentsWon: number;
  playerCount: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  type: "match" | "deadline" | "tournament" | "meeting";
  date: string;
  time?: string;
  description?: string;
}

interface Achievement {
  id: string;
  title: string;
  position: string;
  event: string;
  date: string;
  icon: "gold" | "silver" | "bronze" | "trophy";
}

interface ActivityItem {
  id: string;
  type: "registration" | "win" | "tournament" | "verification" | "team";
  message: string;
  timestamp: string;
  icon: React.ReactNode;
}

interface SchoolDashboardData {
  organization: Organization;
  sport: string;
  quickStats: {
    totalStudents: number;
    verifiedStudents: number;
    totalHouses: number;
    activeTournaments: number;
    pendingApprovals: number;
    eventsThisWeek: number;
    schoolTeams: number;
    openCompParticipants: number;
  };
  campusSports: {
    totalClasses: number;
    totalSections: number;
    activeTournaments: number;
    pendingInvitations: number;
    upcomingTournaments: UpcomingEvent[];
    classes: SchoolClass[];
    houses: House[];
  };
  schoolTeams: {
    totalTeams: number;
    totalPlayers: number;
    activeRegistrations: number;
    teams: SchoolTeam[];
  };
  openCompetitions: {
    participatingStudents: number;
    activeTournaments: number;
    topPerformers: { name: string; tournament: string; rank: number }[];
  };
  houses: House[];
  upcomingEvents: UpcomingEvent[];
  achievements: Achievement[];
  recentActivity: ActivityItem[];
}

export default function SchoolDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboardData, setDashboardData] = useState<SchoolDashboardData | null>(null);

  // Theme classes
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";

  useEffect(() => {
    fetchDashboardData();
  }, [sport]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError("");
    try {
      // First get org info
      const orgResponse = await fetch("/api/org/me");
      if (!orgResponse.ok) {
        throw new Error("Failed to fetch organization data");
      }
      const orgData = await orgResponse.json();

      // Check if this is a SCHOOL organization
      if (orgData.type !== "SCHOOL") {
        // Redirect to org home for sport selection
        router.push("/org/home");
        return;
      }

      // Fetch school dashboard data
      const dashboardResponse = await fetch(`/api/orgs/${orgData.id}/school-dashboard?sport=${sport.toUpperCase()}`);
      if (!dashboardResponse.ok) {
        // Use empty state when API fails
        setDashboardData({
          organization: orgData,
          sport: sport.toUpperCase(),
          quickStats: {
            totalStudents: 0,
            verifiedStudents: 0,
            totalHouses: 0,
            activeTournaments: 0,
            pendingApprovals: 0,
            eventsThisWeek: 0,
            schoolTeams: 0,
            openCompParticipants: 0,
          },
          campusSports: {
            totalClasses: 0,
            totalSections: 0,
            activeTournaments: 0,
            pendingInvitations: 0,
            upcomingTournaments: [],
            classes: [],
            houses: [],
          },
          schoolTeams: {
            totalTeams: 0,
            totalPlayers: 0,
            activeRegistrations: 0,
            teams: [],
          },
          openCompetitions: {
            participatingStudents: 0,
            activeTournaments: 0,
            topPerformers: [],
          },
          houses: [],
          upcomingEvents: [],
          achievements: [],
          recentActivity: [],
        });
      } else {
        const data = await dashboardResponse.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state
  if (error && !dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
          <Button onClick={fetchDashboardData} variant="outline" className="mt-4">
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  if (!dashboardData) return null;

  const { organization, quickStats, houses, upcomingEvents, achievements, recentActivity, campusSports, schoolTeams, openCompetitions } = dashboardData;

  // Get house color classes
  const getHouseColorClass = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; progress: string }> = {
      red: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", progress: "bg-red-500" },
      blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", progress: "bg-blue-500" },
      green: { bg: "bg-green-50", text: "text-green-600", border: "border-green-200", progress: "bg-green-500" },
      yellow: { bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-200", progress: "bg-yellow-500" },
    };
    return colors[color] || colors.red;
  };

  // Get event icon
  const getEventIcon = (type: string) => {
    switch (type) {
      case "match": return <Trophy className="w-4 h-4 text-orange-500" />;
      case "deadline": return <Clock className="w-4 h-4 text-red-500" />;
      case "tournament": return <Medal className="w-4 h-4 text-purple-500" />;
      case "meeting": return <Users className="w-4 h-4 text-blue-500" />;
      default: return <Calendar className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get achievement icon
  const getAchievementIcon = (icon: string) => {
    switch (icon) {
      case "gold": return <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center"><Medal className="w-6 h-6 text-yellow-500" /></div>;
      case "silver": return <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><Medal className="w-6 h-6 text-gray-400" /></div>;
      case "bronze": return <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center"><Medal className="w-6 h-6 text-orange-400" /></div>;
      default: return <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center"><Trophy className="w-6 h-6 text-purple-500" /></div>;
    }
  };

  // Format date for display
  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  // Calculate max house points for progress bar
  const maxHousePoints = Math.max(...houses.map(h => h.points));

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header with Org Info */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center", primaryBgClass)}>
                  {organization.logoUrl ? (
                    <img src={organization.logoUrl} alt={organization.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <GraduationCap className={cn("w-8 h-8", primaryTextClass)} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900">{organization.name}</h1>
                    <Badge className="bg-blue-100 text-blue-700">School</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    {organization.city && organization.state && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {organization.city}, {organization.state}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {sport.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => router.push(`/${sport}/org/settings`)} className="gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Status Bar */}
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-3 text-center">
                <Users className={cn("w-5 h-5 mx-auto mb-1", primaryTextClass)} />
                <p className="text-lg font-bold text-gray-900">{quickStats.totalStudents}</p>
                <p className="text-xs text-gray-500">Students</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-3 text-center">
                <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
                <p className="text-lg font-bold text-gray-900">{quickStats.verifiedStudents}</p>
                <p className="text-xs text-gray-500">Verified</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-3 text-center">
                <Home className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                <p className="text-lg font-bold text-gray-900">{quickStats.totalHouses}</p>
                <p className="text-xs text-gray-500">Houses</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-3 text-center">
                <Trophy className="w-5 h-5 mx-auto mb-1 text-orange-500" />
                <p className="text-lg font-bold text-gray-900">{quickStats.activeTournaments}</p>
                <p className="text-xs text-gray-500">Active</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-3 text-center">
                <AlertCircle className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                <p className="text-lg font-bold text-gray-900">{quickStats.pendingApprovals}</p>
                <p className="text-xs text-gray-500">Pending</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-3 text-center">
                <Calendar className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <p className="text-lg font-bold text-gray-900">{quickStats.eventsThisWeek}</p>
                <p className="text-xs text-gray-500">This Week</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-3 text-center">
                <Shield className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
                <p className="text-lg font-bold text-gray-900">{quickStats.schoolTeams}</p>
                <p className="text-xs text-gray-500">Teams</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-3 text-center">
                <Globe className="w-5 h-5 mx-auto mb-1 text-cyan-500" />
                <p className="text-lg font-bold text-gray-900">{quickStats.openCompParticipants}</p>
                <p className="text-xs text-gray-500">Open Comp</p>
              </CardContent>
            </Card>
          </div>

          {/* Engagement Row - House Competition & Upcoming Events */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* House Competition Widget */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Home className="w-5 h-5 text-purple-500" />
                    House Competition
                  </CardTitle>
                  <Badge className="bg-purple-100 text-purple-700">Live</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {houses.map((house) => {
                    const colors = getHouseColorClass(house.color);
                    const progressPercent = (house.points / maxHousePoints) * 100;
                    return (
                      <div key={house.id} className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm", colors.progress)}>
                          {house.rank}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-900">{house.name} House</span>
                            <span className="text-sm font-semibold text-gray-700">{house.points.toLocaleString()} pts</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", colors.progress)} style={{ width: `${progressPercent}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button variant="outline" className="w-full mt-4" onClick={() => router.push(`/${sport}/org/school/internal/houses`)}>
                  Manage Houses
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* Upcoming Events Widget */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    This Week
                  </CardTitle>
                  <span className="text-sm text-gray-500">{quickStats.eventsThisWeek} events</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingEvents.slice(0, 4).map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{event.title}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className={cn("font-medium", event.type === "deadline" && "text-red-600")}>
                            {formatEventDate(event.date)}
                          </span>
                          {event.time && <span>• {event.time}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4" onClick={() => router.push(`/${sport}/org/school/internal/tournaments`)}>
                  View All Events
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* MANAGEMENT CONSOLE - 70% */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-400" />
              Management Console
            </h2>

            {/* Layer 1: Campus Sports (Internal) */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-blue-100 text-blue-700">Layer 1</Badge>
                <span className="text-sm font-medium text-gray-700">Campus Sports (Internal)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {/* Students */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/school/internal/students`)}>
                  <CardContent className="p-4 text-center">
                    <div className={cn("w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center", primaryBgClass)}>
                      <Users className={cn("w-6 h-6", primaryTextClass)} />
                    </div>
                    <p className="font-semibold text-gray-900">Students</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{quickStats.totalStudents}</p>
                    <p className="text-xs text-gray-500">{quickStats.verifiedStudents} verified</p>
                    <Button size="sm" variant="ghost" className={cn("mt-2 group-hover:visible", primaryTextClass)}>
                      Manage <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Classes */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/school/internal/classes`)}>
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-indigo-50">
                      <BookOpen className="w-6 h-6 text-indigo-600" />
                    </div>
                    <p className="font-semibold text-gray-900">Classes</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{campusSports.totalClasses}</p>
                    <p className="text-xs text-gray-500">{campusSports.totalSections} sections</p>
                    <Button size="sm" variant="ghost" className="mt-2 text-indigo-600 group-hover:visible">
                      Manage <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Houses */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/school/internal/houses`)}>
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-purple-50">
                      <Home className="w-6 h-6 text-purple-600" />
                    </div>
                    <p className="font-semibold text-gray-900">Houses</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{quickStats.totalHouses}</p>
                    <p className="text-xs text-gray-500">Active competition</p>
                    <Button size="sm" variant="ghost" className="mt-2 text-purple-600 group-hover:visible">
                      Manage <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Internal Tournaments */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/school/internal/tournaments`)}>
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-orange-50">
                      <Trophy className="w-6 h-6 text-orange-600" />
                    </div>
                    <p className="font-semibold text-gray-900">Internal Tournaments</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{campusSports.activeTournaments}</p>
                    <p className="text-xs text-gray-500">Active now</p>
                    <Button size="sm" variant="ghost" className="mt-2 text-orange-600 group-hover:visible">
                      Manage <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Internal Leaderboard */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/school/internal/leaderboard`)}>
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-amber-50">
                      <Award className="w-6 h-6 text-amber-600" />
                    </div>
                    <p className="font-semibold text-gray-900">Leaderboard</p>
                    <p className="text-sm text-gray-500 mt-1">Student Rankings</p>
                    <p className="text-xs text-gray-400">Intra-School</p>
                    <Button size="sm" variant="ghost" className="mt-2 text-amber-600 group-hover:visible">
                      View <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Layer 2: Inter-School League (External) */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-purple-100 text-purple-700">Layer 2</Badge>
                <span className="text-sm font-medium text-gray-700">Inter-School League (External)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* School Teams */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/school/inter/teams`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-50 flex-shrink-0">
                        <Shield className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">School Teams</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{schoolTeams.totalTeams}</p>
                        <p className="text-xs text-gray-500">{schoolTeams.totalPlayers} players</p>
                        <div className="flex items-center gap-2 mt-2">
                          {schoolTeams.activeRegistrations > 0 && (
                            <Badge className="bg-green-100 text-green-700 text-xs">{schoolTeams.activeRegistrations} Active Reg</Badge>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>

                {/* Inter-School Tournaments */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/school/inter/tournaments`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-50 flex-shrink-0">
                        <Trophy className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">Inter-School Tournaments</p>
                        <p className="text-sm text-gray-500 mt-1">Browse & Register</p>
                        <p className="text-xs text-gray-400">External competitions</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className="bg-indigo-100 text-indigo-700 text-xs">Browse Available</Badge>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>

                {/* Results History */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/leaderboard`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-50 flex-shrink-0">
                        <Medal className="w-6 h-6 text-cyan-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">Results & History</p>
                        <p className="text-sm text-gray-500 mt-1">Past performances</p>
                        <p className="text-xs text-gray-400">School achievements</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className="bg-cyan-100 text-cyan-700 text-xs">{achievements.length} Achievements</Badge>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-cyan-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Layer 3: Open Competitions (Students participating individually) */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-cyan-100 text-cyan-700">Layer 3</Badge>
                <span className="text-sm font-medium text-gray-700">Open Competitions (Individual Participation)</span>
                <span className="text-xs text-gray-400">- Students participating independently</span>
              </div>
              <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">{openCompetitions.participatingStudents}</p>
                        <p className="text-xs text-gray-500">Students in Open Comps</p>
                      </div>
                      <div className="h-10 w-px bg-gray-200" />
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">{openCompetitions.activeTournaments}</p>
                        <p className="text-xs text-gray-500">Active Tournaments</p>
                      </div>
                      {openCompetitions.topPerformers.length > 0 && (
                        <>
                          <div className="h-10 w-px bg-gray-200" />
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Top Performers</p>
                            {openCompetitions.topPerformers.slice(0, 2).map((p, i) => (
                              <p key={i} className="text-sm font-medium text-gray-700">
                                {p.name} - #{p.rank} in {p.tournament}
                              </p>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <Button variant="outline" className="border-cyan-300 text-cyan-700 hover:bg-cyan-100" onClick={() => router.push(`/${sport}/org/open-competitions`)}>
                      Track Students
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom Row - Achievements & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trophy Cabinet */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    Trophy Cabinet
                  </CardTitle>
                  <span className="text-sm text-gray-500">{achievements.length} achievements</span>
                </div>
              </CardHeader>
              <CardContent>
                {achievements.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Trophy className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No achievements yet</p>
                    <p className="text-xs">Participate in tournaments to earn trophies!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {achievements.map((achievement) => (
                      <div key={achievement.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                        {getAchievementIcon(achievement.icon)}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{achievement.title}</p>
                          <p className="text-xs text-gray-500">{achievement.event}</p>
                        </div>
                        <Badge className={cn(
                          "text-xs",
                          achievement.icon === "gold" ? "bg-yellow-100 text-yellow-700" :
                          achievement.icon === "silver" ? "bg-gray-200 text-gray-700" :
                          "bg-orange-100 text-orange-700"
                        )}>
                          {achievement.position}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" className="w-full mt-4" onClick={() => router.push(`/${sport}/org/achievements`)}>
                  View All Achievements
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* Activity Feed */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bell className="w-5 h-5 text-blue-500" />
                    Recent Activity
                  </CardTitle>
                  <span className="text-xs text-gray-400">Last 24 hours</span>
                </div>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          {activity.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">{activity.message}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(activity.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" className="w-full mt-4" onClick={() => router.push(`/${sport}/org/activity`)}>
                  View All Activity
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
