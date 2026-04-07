"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Sidebar from "@/components/layout/sidebar";
import {
  Users,
  Trophy,
  Calendar,
  Bell,
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
  Clock,
  TrendingUp,
  Award,
  Sparkles,
  Activity,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types for School Home
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

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success";
  createdAt: string;
}

interface UpcomingEvent {
  id: string;
  name: string;
  type: "internal" | "external";
  date: string;
  participants?: number;
  opponent?: string;
}

interface RecentActivity {
  id: string;
  type: "tournament" | "match" | "registration" | "achievement";
  title: string;
  description: string;
  timestamp: string;
}

interface SchoolHomeData {
  organization: Organization;
  sport: string;
  quickStats: {
    totalStudents: number;
    verifiedStudents: number;
    totalHouses: number;
    totalClasses: number;
    activeTeams: number;
    upcomingTournaments: number;
    recentWins: number;
    participationRate: number;
  };
  announcements: Announcement[];
  upcomingEvents: UpcomingEvent[];
  recentActivity: RecentActivity[];
  topPerformers: {
    name: string;
    type: "student" | "house" | "team";
    achievement: string;
    points?: number;
  }[];
}

export default function SchoolHomePage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [homeData, setHomeData] = useState<SchoolHomeData | null>(null);

  // Theme classes
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchHomeData();
  }, [sport]);

  const fetchHomeData = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch home data from API
      const response = await fetch("/api/org/home");
      if (!response.ok) {
        throw new Error("Failed to fetch organization data");
      }
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to load home data");
      }

      const data = result.data;

      // Check if this is a SCHOOL organization
      if (data.organization.type !== "SCHOOL") {
        // Redirect to appropriate home
        if (data.organization.type === "CORPORATE") {
          router.push(`/${sport}/org/corporate-home`);
        } else if (data.organization.type === "COLLEGE") {
          router.push(`/${sport}/org/college-home`);
        } else {
          router.push(`/${sport}/org/dashboard`);
        }
        return;
      }

      setHomeData({
        organization: data.organization,
        sport: data.sport,
        quickStats: data.quickStats || {
          totalStudents: 0,
          verifiedStudents: 0,
          totalHouses: 0,
          totalClasses: 0,
          activeTeams: 0,
          upcomingTournaments: 0,
          recentWins: 0,
          participationRate: 0,
        },
        announcements: data.announcements || [],
        upcomingEvents: data.upcomingEvents || [],
        recentActivity: data.recentActivity || [],
        topPerformers: data.topPerformers || [],
      });
    } catch (err) {
      console.error("Home fetch error:", err);
      setError("Failed to load home data. Please try again.");
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
  if (error && !homeData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
          <Button onClick={fetchHomeData} variant="outline" className="mt-4">
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  if (!homeData) return null;

  const { organization, quickStats, announcements, upcomingEvents, recentActivity, topPerformers } = homeData;

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Welcome Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <GraduationCap className="w-4 h-4" />
              <span>School Home</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Welcome, {organization.name}!</h1>
                <p className="text-gray-500">Here&apos;s what&apos;s happening in your school sports program</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-700">School</Badge>
                {organization.city && organization.state && (
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPin className="w-3 h-3" />
                    {organization.city}, {organization.state}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{quickStats.verifiedStudents}</p>
                    <p className="text-xs text-gray-500">Verified Students</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{quickStats.activeTeams}</p>
                    <p className="text-xs text-gray-500">Active Teams</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{quickStats.upcomingTournaments}</p>
                    <p className="text-xs text-gray-500">Upcoming Events</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{quickStats.participationRate}%</p>
                    <p className="text-xs text-gray-500">Participation Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Announcements & Activity */}
            <div className="lg:col-span-2 space-y-6">
              {/* Announcements */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-amber-500" />
                      <CardTitle className="text-gray-900">Announcements</CardTitle>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700">{announcements.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {announcements.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No announcements</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {announcements.map((announcement) => (
                        <div
                          key={announcement.id}
                          className={cn(
                            "p-4 rounded-lg border",
                            announcement.type === "warning" && "bg-amber-50 border-amber-200",
                            announcement.type === "success" && "bg-green-50 border-green-200",
                            announcement.type === "info" && "bg-blue-50 border-blue-200"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {announcement.type === "warning" && <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />}
                            {announcement.type === "success" && <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />}
                            {announcement.type === "info" && <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />}
                            <div>
                              <p className="font-medium text-gray-900">{announcement.title}</p>
                              <p className="text-sm text-gray-600 mt-1">{announcement.message}</p>
                              <p className="text-xs text-gray-400 mt-2">
                                {new Date(announcement.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Events */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      <CardTitle className="text-gray-900">Upcoming Events</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/${sport}/org/school/internal/tournaments`)}>
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {upcomingEvents.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No upcoming events</p>
                      <Button className={cn("mt-3 text-white", primaryBtnClass)} onClick={() => router.push(`/${sport}/org/school/internal/tournaments`)}>
                        Create Tournament
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingEvents.map((event) => (
                        <div key={event.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              event.type === "internal" ? "bg-blue-50" : "bg-purple-50"
                            )}>
                              {event.type === "internal" ? (
                                <BookOpen className="w-5 h-5 text-blue-600" />
                              ) : (
                                <Shield className="w-5 h-5 text-purple-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{event.name}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(event.date).toLocaleDateString()}</span>
                                {event.participants !== undefined && (
                                  <>
                                    <span>•</span>
                                    <span>{event.participants} participants</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge className={event.type === "internal" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}>
                            {event.type === "internal" ? "Internal" : "Inter-School"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-500" />
                    <CardTitle className="text-gray-900">Recent Activity</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {recentActivity.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No recent activity</p>
                      <p className="text-sm">Activity will appear here as you use the platform</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            activity.type === "tournament" && "bg-blue-50",
                            activity.type === "match" && "bg-green-50",
                            activity.type === "registration" && "bg-purple-50",
                            activity.type === "achievement" && "bg-amber-50"
                          )}>
                            {activity.type === "tournament" && <Trophy className="w-4 h-4 text-blue-600" />}
                            {activity.type === "match" && <Target className="w-4 h-4 text-green-600" />}
                            {activity.type === "registration" && <Users2 className="w-4 h-4 text-purple-600" />}
                            {activity.type === "achievement" && <Medal className="w-4 h-4 text-amber-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{activity.title}</p>
                            <p className="text-sm text-gray-500">{activity.description}</p>
                            <p className="text-xs text-gray-400 mt-1">{activity.timestamp}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Quick Actions & Top Performers */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <CardTitle className="text-gray-900">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <Button className={cn("w-full text-white justify-start", primaryBtnClass)} onClick={() => router.push(`/${sport}/org/school-dashboard`)}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => router.push(`/${sport}/org/school/internal/students`)}>
                    <Users className="w-4 h-4 mr-2" />
                    Manage Students
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => router.push(`/${sport}/org/school/internal/tournaments`)}>
                    <Trophy className="w-4 h-4 mr-2" />
                    Create Tournament
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => router.push(`/${sport}/org/school/inter/teams`)}>
                    <Shield className="w-4 h-4 mr-2" />
                    Manage Teams
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => router.push(`/${sport}/org/school/internal/leaderboard`)}>
                    <Award className="w-4 h-4 mr-2" />
                    View Leaderboard
                  </Button>
                </CardContent>
              </Card>

              {/* Top Performers */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <CardTitle className="text-gray-900">Top Performers</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {topPerformers.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <Award className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No performers yet</p>
                      <p className="text-sm">Top students and teams will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topPerformers.map((performer, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm",
                            index === 0 && "bg-amber-500",
                            index === 1 && "bg-gray-400",
                            index === 2 && "bg-amber-700"
                          )}>
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{performer.name}</p>
                            <p className="text-xs text-gray-500">{performer.achievement}</p>
                          </div>
                          {performer.points && (
                            <Badge className="bg-green-100 text-green-700">{performer.points} pts</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats Summary */}
              <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-100 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Campus Overview</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Students</span>
                      <span className="font-medium text-gray-900">{quickStats.totalStudents}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Houses</span>
                      <span className="font-medium text-gray-900">{quickStats.totalHouses}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Classes</span>
                      <span className="font-medium text-gray-900">{quickStats.totalClasses}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Recent Wins</span>
                      <span className="font-medium text-green-600">{quickStats.recentWins}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
