"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Target,
  Trophy,
  Building,
  BarChart3,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Clock,
  UserCheck,
  UserX,
  Award,
  Activity,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExecutiveDashboardProps {
  orgId: string;
  sport: string;
}

interface AnalyticsData {
  organization: { id: string; name: string };
  totalEmployees: number;
  activePlayers: number;
  participationRate: number;
  participationTrend: number;
  linkedAccounts: number;
  unlinkedEmployees: number;
  departments: Array<{
    id: string;
    name: string;
    totalEmployees: number;
    activePlayers: number;
    participationRate: number;
    totalPoints: number;
    tournamentsPlayed: number;
    trend: number;
  }>;
  topDepartments: Array<{
    id: string;
    name: string;
    participationRate: number;
  }>;
  tournamentFunnel: {
    invited: number;
    registered: number;
    played: number;
    completed: number;
    won: number;
  };
  monthlyTrend: Array<{
    month: string;
    newEmployees: number;
    newLinked: number;
    tournamentsParticipated: number;
    avgParticipationRate: number;
  }>;
  topPerformers: Array<{
    id: string;
    name: string;
    department: string;
    points: number;
    tournamentsPlayed: number;
    winRate: number;
  }>;
  goalsProgress: Array<{
    id: string;
    goalType: string;
    targetValue: number;
    currentValue: number;
    progress: number;
    isAchieved: boolean;
    period: string;
    endDate: string;
  }>;
}

export function ExecutiveAnalyticsDashboard({ orgId, sport }: ExecutiveDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState("30d");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [orgId, sport, dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/org/${orgId}/corporate-analytics?sport=${sport}&range=${dateRange}`
      );
      if (!response.ok) throw new Error("Failed to fetch analytics");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: "employees" | "departments") => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/org/${orgId}/corporate-analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport, type }),
      });
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_${sport}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-700">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAnalytics}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const participationColor = data.participationTrend >= 0 ? "text-green-600" : "text-red-600";
  const TrendIcon = data.participationTrend >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Executive Dashboard</h2>
          <p className="text-sm text-gray-500">{data.organization.name} • {sport}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("employees")}
            disabled={isExporting}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Participation Rate */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Participation Rate</p>
                <p className="text-3xl font-bold text-green-900">{data.participationRate}%</p>
                <div className={cn("flex items-center text-sm mt-1", participationColor)}>
                  <TrendIcon className="w-4 h-4 mr-1" />
                  {Math.abs(data.participationTrend)}% vs last month
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Employees */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Total Employees</p>
                <p className="text-3xl font-bold text-blue-900">{data.totalEmployees}</p>
                <p className="text-sm text-blue-600 mt-1">
                  {data.activePlayers} active players
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Linked Accounts */}
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-purple-700 font-medium">Linked Accounts</p>
                <p className="text-3xl font-bold text-purple-900">{data.linkedAccounts}</p>
                <p className="text-sm text-purple-600 mt-1">
                  {data.totalEmployees > 0
                    ? Math.round((data.linkedAccounts / data.totalEmployees) * 100)
                    : 0}% linked
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unlinked Accounts */}
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-amber-700 font-medium">Pending Linking</p>
                <p className="text-3xl font-bold text-amber-900">{data.unlinkedEmployees}</p>
                <p className="text-sm text-amber-600 mt-1">Need invitation</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                <UserX className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="departments" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="departments" className="gap-2">
            <Building className="w-4 h-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-2">
            <Target className="w-4 h-4" />
            Funnel
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="performers" className="gap-2">
            <Award className="w-4 h-4" />
            Top Performers
          </TabsTrigger>
        </TabsList>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Department Breakdown</CardTitle>
              <CardDescription>Participation metrics by department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.departments.map((dept) => (
                  <div key={dept.id} className="p-4 rounded-lg border bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{dept.name}</h4>
                        <p className="text-sm text-gray-500">
                          {dept.activePlayers}/{dept.totalEmployees} active players
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={dept.participationRate >= 50 ? "default" : "outline"}
                          className={cn(
                            dept.participationRate >= 50
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          )}
                        >
                          {dept.participationRate}% participation
                        </Badge>
                        {dept.trend !== 0 && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              dept.trend > 0
                                ? "border-green-300 text-green-600"
                                : "border-red-300 text-red-600"
                            )}
                          >
                            {dept.trend > 0 ? "+" : ""}
                            {dept.trend}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress value={dept.participationRate} className="h-2" />
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{dept.tournamentsPlayed} tournaments</span>
                      <span>{dept.totalPoints} points</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Funnel Tab */}
        <TabsContent value="funnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tournament Funnel</CardTitle>
              <CardDescription>Employee journey from invitation to completion</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "Invited", value: data.tournamentFunnel.invited, color: "bg-blue-500" },
                  { label: "Registered", value: data.tournamentFunnel.registered, color: "bg-indigo-500" },
                  { label: "Played", value: data.tournamentFunnel.played, color: "bg-purple-500" },
                  { label: "Completed", value: data.tournamentFunnel.completed, color: "bg-green-500" },
                  { label: "Won (Top 3)", value: data.tournamentFunnel.won, color: "bg-amber-500" },
                ].map((step, index) => {
                  const maxValue = data.tournamentFunnel.invited || 1;
                  const percentage = Math.round((step.value / maxValue) * 100);
                  return (
                    <div key={step.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">{step.label}</span>
                        <span className="text-gray-900 font-semibold">
                          {step.value} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", step.color)}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Trends</CardTitle>
              <CardDescription>Last 6 months activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Month</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">New Employees</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Linked</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Tournaments</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Participation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthlyTrend.map((month, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 px-3 font-medium">{month.month}</td>
                        <td className="text-right py-2 px-3">{month.newEmployees}</td>
                        <td className="text-right py-2 px-3">{month.newLinked}</td>
                        <td className="text-right py-2 px-3">{month.tournamentsParticipated}</td>
                        <td className="text-right py-2 px-3">
                          <Badge variant="outline" className="text-xs">
                            {month.avgParticipationRate}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Performers Tab */}
        <TabsContent value="performers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Performers</CardTitle>
              <CardDescription>Leading players by points</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.topPerformers.map((performer, index) => (
                  <div
                    key={performer.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                          index === 0
                            ? "bg-amber-100 text-amber-700"
                            : index === 1
                            ? "bg-gray-200 text-gray-700"
                            : index === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{performer.name}</p>
                        <p className="text-xs text-gray-500">{performer.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="font-semibold text-gray-900">{performer.points}</p>
                        <p className="text-xs text-gray-500">Points</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-gray-900">{performer.tournamentsPlayed}</p>
                        <p className="text-xs text-gray-500">Tournaments</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-gray-900">{performer.winRate}%</p>
                        <p className="text-xs text-gray-500">Win Rate</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Goals Progress */}
      {data.goalsProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Goals Progress</CardTitle>
            <CardDescription>Track your participation targets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.goalsProgress.map((goal) => (
                <div key={goal.id} className="p-4 rounded-lg border bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{goal.goalType.replace(/_/g, " ")}</h4>
                    {goal.isAchieved && (
                      <Badge className="bg-green-100 text-green-700">
                        <Trophy className="w-3 h-3 mr-1" />
                        Achieved
                      </Badge>
                    )}
                  </div>
                  <Progress value={goal.progress} className="h-3 mb-2" />
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      {goal.currentValue} / {goal.targetValue}
                    </span>
                    <span>{goal.progress}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {goal.period} • Ends {new Date(goal.endDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
