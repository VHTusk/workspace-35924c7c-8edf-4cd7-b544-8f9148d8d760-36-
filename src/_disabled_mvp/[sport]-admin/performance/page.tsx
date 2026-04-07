"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Trophy,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Calendar,
  RefreshCw,
  Target,
  Award,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SiteFooter from "@/components/layout/site-footer";

interface AdminPerformance {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  metrics: {
    tournamentsManaged: number;
    disputesResolved: number;
    avgResolutionTime: number;
    playerSatisfaction: number;
    responseTime: number;
    tasksCompleted: number;
    tasksPending: number;
  };
  trend: {
    tournaments: number;
    disputes: number;
    satisfaction: number;
  };
}

const mockAdmins: AdminPerformance[] = [
  {
    id: "1",
    name: "Rajesh Kumar",
    email: "rajesh@valorhive.com",
    role: "STATE_ADMIN",
    metrics: {
      tournamentsManaged: 45,
      disputesResolved: 128,
      avgResolutionTime: 4.2,
      playerSatisfaction: 94,
      responseTime: 12,
      tasksCompleted: 156,
      tasksPending: 8,
    },
    trend: { tournaments: 12, disputes: 8, satisfaction: 2 },
  },
  {
    id: "2",
    name: "Priya Sharma",
    email: "priya@valorhive.com",
    role: "DISTRICT_ADMIN",
    metrics: {
      tournamentsManaged: 28,
      disputesResolved: 89,
      avgResolutionTime: 3.8,
      playerSatisfaction: 96,
      responseTime: 8,
      tasksCompleted: 134,
      tasksPending: 5,
    },
    trend: { tournaments: 18, disputes: 15, satisfaction: 4 },
  },
  {
    id: "3",
    name: "Amit Patel",
    email: "amit@valorhive.com",
    role: "SPORT_ADMIN",
    metrics: {
      tournamentsManaged: 72,
      disputesResolved: 210,
      avgResolutionTime: 3.5,
      playerSatisfaction: 92,
      responseTime: 15,
      tasksCompleted: 245,
      tasksPending: 12,
    },
    trend: { tournaments: 8, disputes: -3, satisfaction: -1 },
  },
];

const weeklyData = [
  { day: "Mon", tournaments: 12, disputes: 8 },
  { day: "Tue", tournaments: 15, disputes: 5 },
  { day: "Wed", tournaments: 8, disputes: 12 },
  { day: "Thu", tournaments: 20, disputes: 6 },
  { day: "Fri", tournaments: 18, disputes: 9 },
  { day: "Sat", tournaments: 25, disputes: 4 },
  { day: "Sun", tournaments: 22, disputes: 7 },
];

export default function AdminPerformanceDashboard() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [admins] = useState<AdminPerformance[]>(mockAdmins);
  const [timeRange, setTimeRange] = useState("week");
  const [loading, setLoading] = useState(false);

  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";
  const primaryColor = isCornhole ? "#16a34a" : "#0d9488";

  const teamMetrics = {
    totalTournaments: admins.reduce((sum, a) => sum + a.metrics.tournamentsManaged, 0),
    activeDisputes: admins.reduce((sum, a) => sum + a.metrics.tasksPending, 0),
    resolvedThisWeek: admins.reduce((sum, a) => sum + a.metrics.disputesResolved, 0),
    avgResolutionTime: admins.reduce((sum, a) => sum + a.metrics.avgResolutionTime, 0) / admins.length,
    avgSatisfaction: admins.reduce((sum, a) => sum + a.metrics.playerSatisfaction, 0) / admins.length,
    totalTasks: admins.reduce((sum, a) => sum + a.metrics.tasksCompleted + a.metrics.tasksPending, 0),
    completedTasks: admins.reduce((sum, a) => sum + a.metrics.tasksCompleted, 0),
  };

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <main className="flex-1 md:ml-72 p-4 md:p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Activity className={cn("w-6 h-6", primaryTextClass)} />
                Admin Performance Dashboard
              </h1>
              <p className="text-muted-foreground">Monitor team performance and workload distribution</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Team Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Tournaments</span>
                </div>
                <p className="text-2xl font-bold">{teamMetrics.totalTournaments}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-500">+12%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Resolved</span>
                </div>
                <p className="text-2xl font-bold">{teamMetrics.resolvedThisWeek}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-500">+8%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Timer className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">Avg. Resolution</span>
                </div>
                <p className="text-2xl font-bold">{teamMetrics.avgResolutionTime.toFixed(1)}h</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-500">15% faster</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Satisfaction</span>
                </div>
                <p className="text-2xl font-bold">{teamMetrics.avgSatisfaction.toFixed(0)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-500">+3%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-card border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Weekly Activity</CardTitle>
                <CardDescription>Tournaments and disputes handled this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="tournaments" fill={primaryColor} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="disputes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Task Completion</CardTitle>
                <CardDescription>Team task completion rate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Completed Tasks</span>
                    <span className="font-semibold">{teamMetrics.completedTasks} / {teamMetrics.totalTasks}</span>
                  </div>
                  <Progress value={(teamMetrics.completedTasks / teamMetrics.totalTasks) * 100} className="h-3" />
                  
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-green-500">
                        {((teamMetrics.completedTasks / teamMetrics.totalTasks) * 100).toFixed(0)}%
                      </p>
                      <p className="text-sm text-muted-foreground">Completion Rate</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-amber-500">{teamMetrics.activeDisputes}</p>
                      <p className="text-sm text-muted-foreground">Pending Tasks</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Admin Performance Table */}
          <Card className="bg-card border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Individual Performance</CardTitle>
              <CardDescription>Performance metrics by admin</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Admin</th>
                      <th className="text-center p-4 text-sm font-medium text-muted-foreground">Role</th>
                      <th className="text-center p-4 text-sm font-medium text-muted-foreground">Tournaments</th>
                      <th className="text-center p-4 text-sm font-medium text-muted-foreground">Disputes</th>
                      <th className="text-center p-4 text-sm font-medium text-muted-foreground">Resolution</th>
                      <th className="text-center p-4 text-sm font-medium text-muted-foreground">Satisfaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => (
                      <tr key={admin.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback>{admin.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{admin.name}</p>
                              <p className="text-xs text-muted-foreground">{admin.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant="outline" className="text-xs">
                            {admin.role.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-medium">{admin.metrics.tournamentsManaged}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-medium">{admin.metrics.disputesResolved}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={cn(
                            "font-medium",
                            admin.metrics.avgResolutionTime < 4 ? "text-green-500" : "text-amber-500"
                          )}>
                            {admin.metrics.avgResolutionTime}h
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={cn(
                            "font-medium",
                            admin.metrics.playerSatisfaction >= 95 ? "text-green-500" : "text-amber-500"
                          )}>
                            {admin.metrics.playerSatisfaction}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border/50 shadow-sm hover:border-primary/50 cursor-pointer transition-all">
              <CardContent className="p-4 text-center">
                <Users className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                <p className="font-medium text-sm">Assign Tasks</p>
                <p className="text-xs text-muted-foreground">Balance workload</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 shadow-sm hover:border-primary/50 cursor-pointer transition-all">
              <CardContent className="p-4 text-center">
                <BarChart3 className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                <p className="font-medium text-sm">View Reports</p>
                <p className="text-xs text-muted-foreground">Detailed analytics</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 shadow-sm hover:border-primary/50 cursor-pointer transition-all">
              <CardContent className="p-4 text-center">
                <Calendar className="w-6 h-6 mx-auto mb-2 text-green-500" />
                <p className="font-medium text-sm">Schedule Review</p>
                <p className="text-xs text-muted-foreground">Team meetings</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 shadow-sm hover:border-primary/50 cursor-pointer transition-all">
              <CardContent className="p-4 text-center">
                <Target className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                <p className="font-medium text-sm">Set Goals</p>
                <p className="text-xs text-muted-foreground">Performance targets</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <SiteFooter />
      </main>
    </div>
  );
}
