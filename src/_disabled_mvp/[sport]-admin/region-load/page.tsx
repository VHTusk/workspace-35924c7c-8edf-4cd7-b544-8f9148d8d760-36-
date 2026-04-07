"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Users,
  Trophy,
  AlertTriangle,
  MapPin,
  Activity,
  Loader2,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Zap,
  BarChart3,
  Globe,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

// Types
interface SummaryData {
  totalAdmins: number;
  totalActiveTournaments: number;
  avgLoad: number;
  criticalRegions: number;
}

interface HeatMapItem {
  stateCode: string;
  stateName: string;
  stateType: string;
  tournaments: number;
  admins: number;
  load: number;
  density: string;
  densityScore: number;
  status: string;
}

interface BarChartItem {
  stateCode: string;
  stateName: string;
  admins: number;
  tournaments: number;
  avgPerAdmin: number;
  topAdmins: string[];
}

interface TrendPoint {
  date: string;
  load: number;
  tournaments: number;
  admins: number;
}

interface AlertItem {
  stateCode: string;
  stateName: string;
  load: number;
  tournaments: number;
  admins: number;
  status: string;
  recommendation: string;
}

interface RegionLoadData {
  summary: SummaryData;
  heatMapData: HeatMapItem[];
  barChartData: BarChartItem[];
  trendData: TrendPoint[];
  alerts: AlertItem[];
  filters: {
    sport: string | null;
    period: string;
    sortBy: string;
  };
  generatedAt: string;
}

interface StateDetail {
  state: {
    code: string;
    name: string;
    type: string;
  };
  tournaments: Array<{
    id: string;
    name: string;
    status: string;
    startDate: string;
    city: string | null;
    participants: number;
  }>;
  admins: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    tournamentCount: number;
    load: number;
  }>;
  summary: {
    totalTournaments: number;
    totalAdmins: number;
    avgLoad: number;
  };
}

export default function RegionLoadPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RegionLoadData | null>(null);
  const [error, setError] = useState("");

  // Filters
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("month");
  const [sortFilter, setSortFilter] = useState<string>("high");

  // State detail dialog
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [stateDetail, setStateDetail] = useState<StateDetail | null>(null);
  const [stateDetailLoading, setStateDetailLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [sport, sportFilter, periodFilter, sortFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (sportFilter !== "all") params.append("sport", sportFilter);
      params.append("period", periodFilter);
      params.append("sort", sortFilter);

      const response = await fetch(`/api/admin/region-load?${params.toString()}`);

      if (response.status === 401) {
        router.push(`/${sport}/admin/login`);
        return;
      }

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        setError("Failed to load region load data");
      }
    } catch (err) {
      setError("Failed to load region load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchStateDetail = async (stateCode: string) => {
    try {
      setStateDetailLoading(true);
      const params = new URLSearchParams();
      params.append("state", stateCode);
      params.append("period", periodFilter);
      if (sportFilter !== "all") params.append("sport", sportFilter);

      const response = await fetch(`/api/admin/region-load?${params.toString()}`);

      if (response.ok) {
        const result = await response.json();
        setStateDetail(result);
      }
    } catch (err) {
      console.error("Failed to fetch state detail:", err);
    } finally {
      setStateDetailLoading(false);
    }
  };

  const handleStateClick = (stateCode: string) => {
    setSelectedState(stateCode);
    fetchStateDetail(stateCode);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      healthy: "text-emerald-400",
      moderate: "text-yellow-400",
      high: "text-orange-400",
      critical: "text-red-400",
    };
    return colors[status] || "text-gray-400";
  };

  const getStatusBgColor = (status: string) => {
    const colors: Record<string, string> = {
      healthy: "bg-emerald-500/10 border-emerald-500/30",
      moderate: "bg-yellow-500/10 border-yellow-500/30",
      high: "bg-orange-500/10 border-orange-500/30",
      critical: "bg-red-500/10 border-red-500/30",
    };
    return colors[status] || "bg-gray-500/10 border-gray-500/30";
  };

  const getDensityColor = (density: string) => {
    const colors: Record<string, string> = {
      none: "#f3f4f6",
      low: "#86efac",
      medium: "#fde047",
      high: "#fb923c",
      "very-high": "#ef4444",
    };
    return colors[density] || "#f3f4f6";
  };

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    if (trend === "up") return <TrendingUp className="w-4 h-4 text-red-400" />;
    if (trend === "down") return <TrendingDown className="w-4 h-4 text-emerald-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryColor = isCornhole ? "#16a34a" : "#0d9488";

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold text-foreground mb-2">{error}</h2>
          <Button onClick={fetchData}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Globe className="w-6 h-6 text-primary" />
              Region Load Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualize tournament distribution and admin load across regions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "Never"}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sport:</span>
            <Select value={sportFilter} onValueChange={setSportFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Sports" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                <SelectItem value="CORNHOLE">Cornhole</SelectItem>
                <SelectItem value="DARTS">Darts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Period:</span>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select value={sortFilter} onValueChange={setSortFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Load (High to Low)</SelectItem>
                <SelectItem value="low">Load (Low to High)</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-muted-foreground">Total Admins</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{data?.summary.totalAdmins || 0}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span className="text-sm text-muted-foreground">Active Tournaments</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{data?.summary.totalActiveTournaments || 0}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-muted-foreground">Average Load</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{data?.summary.avgLoad || 0}x</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-sm text-muted-foreground">Critical Regions</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{data?.summary.criticalRegions || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Section */}
        {data?.alerts && data.alerts.length > 0 && (
          <Card className="bg-red-500/10 border-red-500/30 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-red-400">
                <Zap className="w-5 h-5" />
                Alert: Overloaded Regions
              </CardTitle>
              <CardDescription>
                Regions with tournaments/admin ratio above threshold
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {data.alerts.map((alert) => (
                    <div
                      key={alert.stateCode}
                      className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-colors"
                      onClick={() => handleStateClick(alert.stateCode)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-red-400" />
                          <div>
                            <p className="font-medium text-foreground">{alert.stateName}</p>
                            <p className="text-xs text-muted-foreground">
                              {alert.tournaments} tournaments, {alert.admins} admins
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${getStatusColor(alert.status)}`}>
                            {alert.load}x
                          </span>
                          <Badge className={`${getStatusBgColor(alert.status)} border`}>
                            {alert.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 pl-7">
                        {alert.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Main Charts */}
        <Tabs defaultValue="heatmap" className="space-y-6">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="heatmap" className="gap-2">
              <Globe className="w-4 h-4" />
              Heat Map
            </TabsTrigger>
            <TabsTrigger value="barchart" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Bar Chart
            </TabsTrigger>
            <TabsTrigger value="trend" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Trend Line
            </TabsTrigger>
          </TabsList>

          {/* Heat Map Tab */}
          <TabsContent value="heatmap">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Tournament Density by State
                </CardTitle>
                <CardDescription>
                  Click on a state to see detailed breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Legend */}
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-sm text-muted-foreground">Density:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: getDensityColor("none") }} />
                    <span className="text-xs">None</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: getDensityColor("low") }} />
                    <span className="text-xs">Low</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: getDensityColor("medium") }} />
                    <span className="text-xs">Medium</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: getDensityColor("high") }} />
                    <span className="text-xs">High</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: getDensityColor("very-high") }} />
                    <span className="text-xs">Very High</span>
                  </div>
                </div>

                <ScrollArea className="h-96">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {data?.heatMapData.map((item) => (
                      <div
                        key={item.stateCode}
                        className="p-3 rounded-lg border border-border/50 cursor-pointer hover:border-primary/50 transition-all"
                        style={{ backgroundColor: getDensityColor(item.density) + "20" }}
                        onClick={() => handleStateClick(item.stateCode)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-muted-foreground">{item.stateCode}</span>
                          {item.status !== "healthy" && (
                            <span className={`text-xs ${getStatusColor(item.status)}`}>
                              {item.load}x
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{item.stateName}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">{item.tournaments} tourn.</span>
                          <span className="text-xs text-muted-foreground">{item.admins} admins</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bar Chart Tab */}
          <TabsContent value="barchart">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Tournaments per Admin by State
                </CardTitle>
                <CardDescription>
                  Comparing load distribution across states
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.barChartData || []}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        type="number"
                        tickFormatter={(value) => `${value}x`}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        dataKey="stateName"
                        type="category"
                        width={75}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === "avgPerAdmin") return [`${value}x`, "Avg Load"];
                          return [value, name];
                        }}
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px"
                        }}
                      />
                      <Legend />
                      <Bar dataKey="avgPerAdmin" name="Avg Tournaments/Admin" radius={[0, 4, 4, 0]}>
                        {data?.barChartData?.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.avgPerAdmin > 15 ? "#ef4444" :
                              entry.avgPerAdmin > 10 ? "#fb923c" :
                              entry.avgPerAdmin > 5 ? "#fde047" :
                              "#22c55e"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trend Line Tab */}
          <TabsContent value="trend">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Load Changes Over Time
                </CardTitle>
                <CardDescription>
                  Tracking load trends and tournament growth
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={data?.trendData || []}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        yAxisId="left"
                        tickFormatter={(value) => `${value}x`}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px"
                        }}
                      />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="load"
                        name="Load Ratio"
                        stroke={primaryColor}
                        strokeWidth={2}
                        dot={{ fill: primaryColor }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="tournaments"
                        name="Tournaments"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ fill: "#f59e0b" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* State Details Table */}
        <Card className="bg-gradient-card border-border/50 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              All Regions
            </CardTitle>
            <CardDescription>
              Complete list of states with load metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-2">
                {data?.heatMapData.map((item) => (
                  <div
                    key={item.stateCode}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleStateClick(item.stateCode)}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getDensityColor(item.density) }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.stateName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.stateType} • {item.tournaments} tournaments • {item.admins} admins
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${getStatusColor(item.status)}`}>
                        {item.load}x
                      </span>
                      <Badge className={`${getStatusBgColor(item.status)} border`} variant="outline">
                        {item.status}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* State Detail Dialog */}
      <Dialog open={!!selectedState} onOpenChange={(open) => !open && setSelectedState(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {stateDetailLoading ? "Loading..." : stateDetail?.state.name || "State Details"}
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of tournaments and admins
            </DialogDescription>
          </DialogHeader>

          {stateDetailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : stateDetail ? (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold">{stateDetail.summary.totalTournaments}</p>
                    <p className="text-sm text-muted-foreground">Tournaments</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold">{stateDetail.summary.totalAdmins}</p>
                    <p className="text-sm text-muted-foreground">Admins</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold">{stateDetail.summary.avgLoad}x</p>
                    <p className="text-sm text-muted-foreground">Avg Load</p>
                  </div>
                </div>

                {/* Admins */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Admins ({stateDetail.admins.length})</h3>
                  <div className="space-y-2">
                    {stateDetail.admins.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No admins assigned</p>
                    ) : (
                      stateDetail.admins.map((admin) => (
                        <div
                          key={admin.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                        >
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{admin.name}</p>
                            <p className="text-xs text-muted-foreground">{admin.email}</p>
                          </div>
                          <Badge variant="outline">{admin.role.replace(/_/g, " ")}</Badge>
                          <span className="text-sm font-medium">{admin.tournamentCount} tourn.</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Tournaments */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Recent Tournaments ({stateDetail.tournaments.length})</h3>
                  <div className="space-y-2">
                    {stateDetail.tournaments.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No tournaments</p>
                    ) : (
                      stateDetail.tournaments.slice(0, 10).map((tournament) => (
                        <Link
                          key={tournament.id}
                          href={`/${sport}/admin/tournaments/${tournament.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <Trophy className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{tournament.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tournament.city || "No city"} • {tournament.participants} participants
                            </p>
                          </div>
                          <Badge variant="outline">{tournament.status.replace(/_/g, " ")}</Badge>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
