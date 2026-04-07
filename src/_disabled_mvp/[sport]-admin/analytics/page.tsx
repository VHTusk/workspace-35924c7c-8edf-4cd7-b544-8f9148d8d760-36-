"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Trophy,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface TrendData {
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface AnalyticsData {
  meta: { type: string; sport: string; period: string; generatedAt: string };
  users?: {
    totalPlayers: TrendData;
    totalOrganizations: TrendData;
    newUsers: TrendData;
  };
  activeUsers?: {
    dau: { value: number };
    wau: { value: number };
    mau: { value: number };
    dauToMauRatio: number;
  };
  tournaments?: {
    total: TrendData;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  revenue?: {
    total: { value: number };
  };
  sessionDuration?: { averageMinutes: number; trend: string };
  funnel?: Array<{ stage: string; count: number; dropoffFromPrevious: number; conversionFromStart: number }>;
  mrr?: { total: { value: number }; players: { value: number }; organizations: { value: number } };
  arr?: { total: { value: number } };
  churnByMonth?: Array<{ month: string; active: number; churned: number; rate: number }>;
  matches?: { total: TrendData; uniquePlayers: number; perUser: number };
  engagementScore?: { value: number; level: string };
}

export default function AdminAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [analyticsType, setAnalyticsType] = useState("overview");
  const [sportFilter, setSportFilter] = useState("all");
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { checkAuth(); }, [sport]);
  useEffect(() => { if (analyticsType) fetchAnalytics(); }, [analyticsType, sportFilter, period, sport]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth/check");
      if (!response.ok) router.push(`/${sport}/admin/login`);
    } catch { router.push(`/${sport}/admin/login`); }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/analytics?type=${analyticsType}&sport=${sportFilter}&period=${period}`);
      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      } else setError("Failed to load analytics");
    } catch { setError("Failed to load analytics"); }
    finally { setLoading(false); }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
  const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);
  const getTrendIcon = (trend: string) => trend === "up" ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : trend === "down" ? <TrendingDown className="w-4 h-4 text-red-500" /> : <Activity className="w-4 h-4 text-gray-400" />;
  const getTrendColor = (trend: string) => trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-gray-500";

  if (loading && !data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">Platform-wide insights and metrics</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={analyticsType} onValueChange={setAnalyticsType}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="funnel">User Funnel</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="churn">Churn</SelectItem>
                <SelectItem value="engagement">Engagement</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sportFilter} onValueChange={setSportFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Sport" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                <SelectItem value="CORNHOLE">Cornhole</SelectItem>
                <SelectItem value="DARTS">Darts</SelectItem>
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Period" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mb-6 flex items-center gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

        {/* Overview */}
        {analyticsType === "overview" && data?.users && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Players", value: data.users.totalPlayers.value, trend: data.users.totalPlayers, icon: Users, color: "text-primary" },
                { label: "Organizations", value: data.users.totalOrganizations.value, trend: data.users.totalOrganizations, icon: Trophy, color: "text-amber-500" },
                { label: "Total Revenue", value: formatCurrency(data.revenue?.total.value || 0), sub: "This period", icon: DollarSign, color: "text-green-500" },
                { label: "Active Users (DAU)", value: formatNumber(data.activeUsers?.dau.value || 0), sub: `MAU: ${formatNumber(data.activeUsers?.mau.value || 0)}`, icon: Activity, color: "text-purple-500" },
              ].map((item, i) => (
                <Card key={i} className="bg-gradient-card border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        <p className="text-2xl font-bold text-foreground">{typeof item.value === 'number' ? formatNumber(item.value) : item.value}</p>
                        {item.trend && <div className="flex items-center gap-1 mt-1">{getTrendIcon(item.trend.trend)}<span className={`text-xs ${getTrendColor(item.trend.trend)}`}>{item.trend.changePercent > 0 ? "+" : ""}{item.trend.changePercent.toFixed(1)}%</span></div>}
                        {item.sub && <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>}
                      </div>
                      <item.icon className={`w-10 h-10 ${item.color}/30`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-primary" />Active Users</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[{ label: "Daily Active (DAU)", value: data.activeUsers?.dau.value }, { label: "Weekly Active (WAU)", value: data.activeUsers?.wau.value }, { label: "Monthly Active (MAU)", value: data.activeUsers?.mau.value }].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <span className="font-semibold">{formatNumber(item.value || 0)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <span className="text-sm font-medium">DAU/MAU Ratio</span>
                      <span className="font-semibold text-primary">{((data.activeUsers?.dauToMauRatio || 0) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />Session Metrics</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Avg. Session Duration</span>
                        <span className="font-semibold">{data.sessionDuration?.averageMinutes || 0} min</span>
                      </div>
                      <Progress value={(data.sessionDuration?.averageMinutes || 0) / 60 * 100} className="h-2" />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm text-muted-foreground">Session Quality</span>
                      <Badge className={data.sessionDuration?.trend === 'good' ? 'bg-emerald-500/10 text-emerald-400' : data.sessionDuration?.trend === 'moderate' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}>{data.sessionDuration?.trend || 'unknown'}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {data.tournaments && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-400" />Tournaments by Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(data.tournaments.byStatus || {}).map(([status, count]) => (
                      <div key={status} className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-2xl font-bold">{formatNumber(count)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{status.replace(/_/g, ' ')}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Funnel */}
        {analyticsType === "funnel" && data?.funnel && (
          <Card className="bg-gradient-card border-border/50">
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-primary" />User Conversion Funnel</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.funnel.map((stage, i) => (
                  <div key={stage.stage}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{stage.stage}</span>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold">{formatNumber(stage.count)}</span>
                        {i > 0 && <Badge variant="outline" className="text-xs">-{stage.dropoffFromPrevious.toFixed(1)}%</Badge>}
                      </div>
                    </div>
                    <Progress value={stage.conversionFromStart} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">{stage.conversionFromStart.toFixed(1)}% of registrations</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Revenue */}
        {analyticsType === "revenue" && data?.mrr && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Monthly Recurring Revenue", value: formatCurrency(data.mrr.total.value), sub: `Players: ${formatCurrency(data.mrr.players.value)} | Orgs: ${formatCurrency(data.mrr.organizations.value)}` },
              { label: "Annual Recurring Revenue", value: formatCurrency(data.arr?.total.value || 0), sub: "Projected yearly" },
              { label: "Revenue This Period", value: formatCurrency(data.revenue?.total.value || 0), sub: "" },
            ].map((item, i) => (
              <Card key={i} className="bg-gradient-card border-border/50">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{item.value}</p>
                  {item.sub && <p className="text-xs text-muted-foreground mt-2">{item.sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Churn */}
        {analyticsType === "churn" && data?.churnByMonth && (
          <Card className="bg-gradient-card border-border/50">
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-400" />Churn Rate by Month</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.churnByMonth.map((month) => (
                  <div key={month.month} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <span className="w-20 font-medium">{month.month}</span>
                    <div className="flex-1"><Progress value={month.rate} className="h-2" /></div>
                    <span className="font-semibold">{month.rate.toFixed(1)}%</span>
                    <span className="text-xs text-muted-foreground">({month.churned}/{month.active})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Engagement */}
        {analyticsType === "engagement" && data?.matches && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Total Matches</p>
                <p className="text-2xl font-bold mt-2">{formatNumber(data.matches.total.value)}</p>
                <div className="flex items-center gap-1 mt-1">{getTrendIcon(data.matches.total.trend)}<span className={`text-xs ${getTrendColor(data.matches.total.trend)}`}>{data.matches.total.changePercent.toFixed(1)}%</span></div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Unique Players</p>
                <p className="text-2xl font-bold mt-2">{formatNumber(data.matches.uniquePlayers)}</p>
                <p className="text-xs text-muted-foreground mt-1">{data.matches.perUser} matches/player</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Engagement Score</p>
                <p className="text-2xl font-bold mt-2">{data.engagementScore?.value || 0}</p>
                <Badge className={`mt-2 ${data.engagementScore?.level === 'high' ? 'bg-emerald-500/10 text-emerald-400' : data.engagementScore?.level === 'moderate' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>{data.engagementScore?.level}</Badge>
              </CardContent>
            </Card>
          </div>
        )}

        {data?.meta && <div className="text-center text-xs text-muted-foreground mt-8">Last updated: {new Date(data.meta.generatedAt).toLocaleString()}</div>}
      </div>
    </div>
  );
}
