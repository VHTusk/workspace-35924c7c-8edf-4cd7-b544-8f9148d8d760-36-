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
  Building2,
  Trophy,
  Calendar,
  UserPlus,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  Shield,
  Target,
  Medal,
  Users2,
  MapPin,
  Settings,
  Clock,
  Award,
  Bell,
  Globe,
  ChevronRight,
  Sparkles,
  Landmark,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types for College Dashboard
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

interface Department {
  id: string;
  name: string;
  code: string;
  studentCount: number;
  batches: string[];
  points?: number;
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
  department?: string;
  batch?: string;
  isVerified: boolean;
  isActive: boolean;
  joinedAt: string;
}

interface CollegeTeam {
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

interface CollegeDashboardData {
  organization: Organization;
  sport: string;
  quickStats: {
    totalStudents: number;
    verifiedStudents: number;
    totalDepartments: number;
    totalBatches: number;
    activeTournaments: number;
    pendingApprovals: number;
    eventsThisWeek: number;
    collegeTeams: number;
    openCompParticipants: number;
  };
  campusSports: {
    totalDepartments: number;
    totalBatches: number;
    activeTournaments: number;
    pendingInvitations: number;
    upcomingTournaments: UpcomingEvent[];
    departments: Department[];
  };
  collegeTeams: {
    totalTeams: number;
    totalPlayers: number;
    activeRegistrations: number;
    teams: CollegeTeam[];
  };
  openCompetitions: {
    participatingStudents: number;
    activeTournaments: number;
    topPerformers: { name: string; tournament: string; rank: number }[];
  };
  departments: Department[];
  upcomingEvents: UpcomingEvent[];
  achievements: Achievement[];
  recentActivity: ActivityItem[];
}

export default function CollegeDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboardData, setDashboardData] = useState<CollegeDashboardData | null>(null);

  // Theme classes
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

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

      // Check if this is a COLLEGE organization
      if (orgData.type !== "COLLEGE") {
        // Redirect to org home for sport selection
        router.push("/org/home");
        return;
      }

      // Fetch college dashboard data
      const dashboardResponse = await fetch(`/api/orgs/${orgData.id}/college-dashboard?sport=${sport.toUpperCase()}`);
      if (!dashboardResponse.ok) {
        // If API doesn't exist, create mock data for now
        setDashboardData({
          organization: orgData,
          sport: sport.toUpperCase(),
          quickStats: {
            totalStudents: 850,
            verifiedStudents: 720,
            totalDepartments: 6,
            totalBatches: 24,
            activeTournaments: 4,
            pendingApprovals: 18,
            eventsThisWeek: 7,
            collegeTeams: 3,
            openCompParticipants: 28,
          },
          campusSports: {
            totalDepartments: 6,
            totalBatches: 24,
            activeTournaments: 2,
            pendingInvitations: 8,
            upcomingTournaments: [],
            departments: [],
          },
          collegeTeams: {
            totalTeams: 3,
            totalPlayers: 27,
            activeRegistrations: 2,
            teams: [],
          },
          openCompetitions: {
            participatingStudents: 28,
            activeTournaments: 5,
            topPerformers: [
              { name: "Amit Kumar", tournament: "University Open Championship", rank: 1 },
              { name: "Sneha Reddy", tournament: "State Open Tournament", rank: 3 },
              { name: "Vikram Singh", tournament: "City League", rank: 4 },
            ],
          },
          departments: [
            { id: "1", name: "Engineering", code: "ENG", studentCount: 280, batches: ["2021", "2022", "2023", "2024"], points: 1850, rank: 1 },
            { id: "2", name: "Management", code: "MGT", studentCount: 180, batches: ["2021", "2022", "2023", "2024"], points: 1620, rank: 2 },
            { id: "3", name: "Science", code: "SCI", studentCount: 150, batches: ["2021", "2022", "2023", "2024"], points: 1400, rank: 3 },
            { id: "4", name: "Arts", code: "ARTS", studentCount: 120, batches: ["2021", "2022", "2023", "2024"], points: 1100, rank: 4 },
            { id: "5", name: "Commerce", code: "COM", studentCount: 80, batches: ["2021", "2022", "2023", "2024"], points: 950, rank: 5 },
            { id: "6", name: "Law", code: "LAW", studentCount: 40, batches: ["2021", "2022", "2023", "2024"], points: 780, rank: 6 },
          ],
          upcomingEvents: [
            { id: "1", title: "Engineering vs Management Final", type: "match", date: new Date().toISOString(), time: "2:00 PM", description: "Inter-Department Championship" },
            { id: "2", title: "Team Selection Meeting", type: "meeting", date: new Date(Date.now() + 86400000).toISOString(), time: "11:00 AM" },
            { id: "3", title: "University Championship Registration", type: "deadline", date: new Date(Date.now() + 172800000).toISOString(), description: "Last day to register" },
            { id: "4", title: "Inter-College Tournament", type: "tournament", date: new Date(Date.now() + 432000000).toISOString(), description: "Zone qualifiers begin" },
            { id: "5", title: "National University Games", type: "tournament", date: new Date(Date.now() + 604800000).toISOString(), description: "28 students participating" },
          ],
          achievements: [
            { id: "1", title: "University Champions", position: "1st", event: "University Championship 2024", date: "2024-03-15", icon: "gold" },
            { id: "2", title: "Zonal Winners", position: "1st", event: "Inter-College Zonal 2024", date: "2024-02-20", icon: "gold" },
            { id: "3", title: "National Finalists", position: "3rd", event: "National University Games 2023", date: "2023-12-10", icon: "bronze" },
          ],
          recentActivity: [
            { id: "1", type: "win", message: "Engineering Department won Inter-Dept Championship", timestamp: new Date(Date.now() - 3600000).toISOString(), icon: <Trophy className="w-4 h-4 text-yellow-500" /> },
            { id: "2", type: "verification", message: "25 students verified for new batch", timestamp: new Date(Date.now() - 7200000).toISOString(), icon: <CheckCircle className="w-4 h-4 text-green-500" /> },
            { id: "3", type: "team", message: "College Team A confirmed for University Championship", timestamp: new Date(Date.now() - 86400000).toISOString(), icon: <Shield className="w-4 h-4 text-purple-500" /> },
            { id: "4", type: "registration", message: "12 new student registrations pending", timestamp: new Date(Date.now() - 172800000).toISOString(), icon: <UserPlus className="w-4 h-4 text-blue-500" /> },
          ],
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

  const { organization, quickStats, departments, upcomingEvents, achievements, recentActivity, campusSports, collegeTeams, openCompetitions } = dashboardData;

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

  // Calculate max department points for progress bar
  const maxDeptPoints = Math.max(...departments.map(d => d.points || 0));

  // Get department color
  const getDeptColor = (index: number) => {
    const colors = ["indigo", "purple", "blue", "cyan", "teal", "green"];
    return colors[index % colors.length];
  };

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
                    <Landmark className={cn("w-8 h-8", primaryTextClass)} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900">{organization.name}</h1>
                    <Badge className="bg-indigo-100 text-indigo-700">College</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    {organization.city && organization.state && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {organization.city}, {organization.state}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" />
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
                <Building2 className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
                <p className="text-lg font-bold text-gray-900">{quickStats.totalDepartments}</p>
                <p className="text-xs text-gray-500">Depts</p>
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
                <Shield className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                <p className="text-lg font-bold text-gray-900">{quickStats.collegeTeams}</p>
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

          {/* Engagement Row - Department Competition & Upcoming Events */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Department Competition Widget */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-500" />
                    Department Competition
                  </CardTitle>
                  <Badge className="bg-indigo-100 text-indigo-700">Inter-Dept</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {departments.slice(0, 5).map((dept, index) => {
                    const progressPercent = maxDeptPoints > 0 ? ((dept.points || 0) / maxDeptPoints) * 100 : 0;
                    const colorClass = getDeptColor(index);
                    return (
                      <div key={dept.id} className="flex items-center gap-3">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs", `bg-${colorClass}-500`)}>
                          {dept.rank || index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-900 text-sm">{dept.name}</span>
                            <span className="text-xs font-semibold text-gray-600">{(dept.points || 0).toLocaleString()} pts</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", `bg-${colorClass}-500`)} style={{ width: `${progressPercent}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button variant="outline" className="w-full mt-4" onClick={() => router.push(`/${sport}/org/college-sports/departments`)}>
                  Manage Departments
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
                <Button variant="outline" className="w-full mt-4" onClick={() => router.push(`/${sport}/org/college-sports/tournaments`)}>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Departments */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/college-sports/departments`)}>
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-indigo-50">
                      <Building2 className="w-6 h-6 text-indigo-600" />
                    </div>
                    <p className="font-semibold text-gray-900">Departments</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{quickStats.totalDepartments}</p>
                    <p className="text-xs text-gray-500">{quickStats.totalBatches} batches</p>
                    <Button size="sm" variant="ghost" className="mt-2 text-indigo-600 group-hover:visible">
                      Manage <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Students */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/college-sports/students`)}>
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

                {/* Internal Tournaments */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/college-sports/tournaments`)}>
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
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/college-sports/leaderboard`)}>
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-amber-50">
                      <Award className="w-6 h-6 text-amber-600" />
                    </div>
                    <p className="font-semibold text-gray-900">Leaderboard</p>
                    <p className="text-sm text-gray-500 mt-1">Student Rankings</p>
                    <p className="text-xs text-gray-400">Intra-College</p>
                    <Button size="sm" variant="ghost" className="mt-2 text-amber-600 group-hover:visible">
                      View <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Layer 2: Inter-College League (External) */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-purple-100 text-purple-700">Layer 2</Badge>
                <span className="text-sm font-medium text-gray-700">Inter-College League (External)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* College Teams */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/college-teams`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-50 flex-shrink-0">
                        <Shield className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">College Teams</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{collegeTeams.totalTeams}</p>
                        <p className="text-xs text-gray-500">{collegeTeams.totalPlayers} players</p>
                        <div className="flex items-center gap-2 mt-2">
                          {collegeTeams.activeRegistrations > 0 && (
                            <Badge className="bg-green-100 text-green-700 text-xs">{collegeTeams.activeRegistrations} Active Reg</Badge>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>

                {/* Inter-College Tournaments */}
                <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push(`/${sport}/org/inter-college/tournaments`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-50 flex-shrink-0">
                        <Trophy className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">Inter-College Tournaments</p>
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
                        <p className="text-xs text-gray-400">College achievements</p>
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
                            {openCompetitions.topPerformers.slice(0, 3).map((p, i) => (
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
