"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Trophy,
  Calendar,
  BookOpen,
  Home,
  Award,
  Target,
  Medal,
  CheckCircle,
  AlertCircle,
  Loader2,
  TrendingUp,
  Plus,
  ArrowRight,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Organization {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  logoUrl?: string;
}

interface InternalStats {
  totalStudents: number;
  verifiedStudents: number;
  activeStudents: number;
  totalClasses: number;
  totalSections: number;
  totalHouses: number;
  activeTournaments: number;
  pendingApprovals: number;
  eventsThisWeek: number;
}

interface House {
  id: string;
  name: string;
  color: string;
  studentCount: number;
  points: number;
  rank?: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  type: "match" | "deadline" | "tournament" | "meeting";
  date: string;
  time?: string;
}

interface ClassData {
  id: string;
  name: string;
  gradeLevel: number;
  studentCount: number;
  sections: { id: string; name: string }[];
}

export default function SchoolInternalDashboard() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [org, setOrg] = useState<Organization | null>(null);
  const [stats, setStats] = useState<InternalStats | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

  // Theme classes
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchData();
  }, [sport]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // Get org info
      const orgResponse = await fetch("/api/org/me");
      if (!orgResponse.ok) {
        throw new Error("Failed to fetch organization data");
      }
      const orgData = await orgResponse.json();
      setOrg(orgData);

      // Verify this is a SCHOOL organization
      if (orgData.type !== "SCHOOL") {
        router.push("/org/home");
        return;
      }

      // Fetch school internal data
      const dashboardResponse = await fetch(`/api/orgs/${orgData.id}/school-dashboard?sport=${sport.toUpperCase()}`);
      
      if (dashboardResponse.ok) {
        const data = await dashboardResponse.json();
        setStats({
          totalStudents: data.campusSports?.totalStudents || 0,
          verifiedStudents: data.campusSports?.verifiedStudents || 0,
          activeStudents: data.campusSports?.totalStudents || 0,
          totalClasses: data.campusSports?.totalClasses || 0,
          totalSections: 0, // Calculate from classes
          totalHouses: data.campusSports?.totalHouses || 0,
          activeTournaments: data.campusSports?.activeTournaments || 0,
          pendingApprovals: 0,
          eventsThisWeek: 0,
        });
        setHouses(data.campusSports?.houses || []);
        setClasses(data.campusSports?.classes || []);
      } else {
        // Fallback to zero stats
        setStats({
          totalStudents: 0,
          verifiedStudents: 0,
          activeStudents: 0,
          totalClasses: 0,
          totalSections: 0,
          totalHouses: 0,
          activeTournaments: 0,
          pendingApprovals: 0,
          eventsThisWeek: 0,
        });
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError("Failed to load dashboard data");
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
  if (error && !org) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
          <Button onClick={fetchData} variant="outline" className="mt-4">
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  if (!org || !stats) return null;

  // Calculate total sections
  const totalSections = classes.reduce((sum, c) => sum + (c.sections?.length || 0), 0);
  
  // Get house color classes
  const getHouseColorClass = (color: string) => {
    const colors: Record<string, { bg: string; text: string; progress: string }> = {
      red: { bg: "bg-red-50", text: "text-red-600", progress: "bg-red-500" },
      blue: { bg: "bg-blue-50", text: "text-blue-600", progress: "bg-blue-500" },
      green: { bg: "bg-green-50", text: "text-green-600", progress: "bg-green-500" },
      yellow: { bg: "bg-yellow-50", text: "text-yellow-600", progress: "bg-yellow-500" },
      purple: { bg: "bg-purple-50", text: "text-purple-600", progress: "bg-purple-500" },
    };
    return colors[color?.toLowerCase()] || colors.red;
  };

  const maxHousePoints = Math.max(...houses.map(h => h.points), 1);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Internal School Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Manage campus sports - students, classes, houses, and internal tournaments
          </p>
        </div>
        <Badge className="bg-blue-100 text-blue-700 text-sm">
          Internal Mode
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <Users className={cn("w-5 h-5 mx-auto mb-1", primaryTextClass)} />
            <p className="text-lg font-bold text-gray-900">{stats.totalStudents}</p>
            <p className="text-xs text-gray-500">Students</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-lg font-bold text-gray-900">{stats.verifiedStudents}</p>
            <p className="text-xs text-gray-500">Verified</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <BookOpen className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
            <p className="text-lg font-bold text-gray-900">{stats.totalClasses}</p>
            <p className="text-xs text-gray-500">Classes</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <BookOpen className="w-5 h-5 mx-auto mb-1 text-cyan-500" />
            <p className="text-lg font-bold text-gray-900">{totalSections}</p>
            <p className="text-xs text-gray-500">Sections</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <Home className="w-5 h-5 mx-auto mb-1 text-purple-500" />
            <p className="text-lg font-bold text-gray-900">{stats.totalHouses}</p>
            <p className="text-xs text-gray-500">Houses</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <Trophy className="w-5 h-5 mx-auto mb-1 text-orange-500" />
            <p className="text-lg font-bold text-gray-900">{stats.activeTournaments}</p>
            <p className="text-xs text-gray-500">Tournaments</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <AlertCircle className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <p className="text-lg font-bold text-gray-900">{stats.pendingApprovals}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-3 text-center">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold text-gray-900">{stats.eventsThisWeek}</p>
            <p className="text-xs text-gray-500">This Week</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Management Cards */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Campus Management</h2>
          
          {/* Students Card */}
          <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer" 
            onClick={() => router.push(`/${sport}/org/school/internal/students`)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", primaryBgClass)}>
                    <Users className={cn("w-6 h-6", primaryTextClass)} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Students</p>
                    <p className="text-sm text-gray-500">
                      {stats.totalStudents} total, {stats.verifiedStudents} verified
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          {/* Classes Card */}
          <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push(`/${sport}/org/school/internal/classes`)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-50">
                    <BookOpen className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Classes & Sections</p>
                    <p className="text-sm text-gray-500">
                      {stats.totalClasses} classes, {totalSections} sections
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          {/* Houses Card */}
          <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push(`/${sport}/org/school/internal/houses`)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-50">
                    <Home className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Houses</p>
                    <p className="text-sm text-gray-500">
                      {stats.totalHouses} houses for inter-house competitions
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          {/* Internal Tournaments Card */}
          <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push(`/${sport}/org/school/internal/tournaments`)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-orange-50">
                    <Trophy className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Internal Tournaments</p>
                    <p className="text-sm text-gray-500">
                      {stats.activeTournaments} active tournaments
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          {/* Internal Leaderboard Card */}
          <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push(`/${sport}/org/school/internal/leaderboard`)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50">
                    <Award className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Leaderboard</p>
                    <p className="text-sm text-gray-500">
                      Student rankings and achievements
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* House Competition Widget */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">House Competition</h2>
          
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="w-5 h-5 text-purple-500" />
                  House Standings
                </CardTitle>
                {houses.length > 0 && (
                  <Badge className="bg-purple-100 text-purple-700">Live</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {houses.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Home className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No houses created yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => router.push(`/${sport}/org/school/internal/houses`)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create Houses
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {houses.slice(0, 4).map((house, index) => {
                    const colors = getHouseColorClass(house.color);
                    const progressPercent = (house.points / maxHousePoints) * 100;
                    return (
                      <div key={house.id} className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm",
                          colors.progress
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-900">{house.name} House</span>
                            <span className="text-sm font-semibold text-gray-700">
                              {house.points.toLocaleString()} pts
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full rounded-full transition-all", colors.progress)}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Banner */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900">Internal School Tournaments</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Only students from your school can participate. Students can compete by class, 
                    section, house, or as individuals in internal tournaments.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                className={cn("w-full justify-start text-white", primaryBtnClass)}
                onClick={() => router.push(`/${sport}/org/school/internal/students`)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Students
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push(`/${sport}/org/school/internal/tournaments`)}
              >
                <Trophy className="w-4 h-4 mr-2" />
                Create Tournament
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push(`/${sport}/org/school/internal/leaderboard`)}
              >
                <Award className="w-4 h-4 mr-2" />
                View Leaderboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
