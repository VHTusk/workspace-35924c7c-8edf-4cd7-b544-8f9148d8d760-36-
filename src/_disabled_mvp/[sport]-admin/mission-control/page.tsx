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
import {
  Activity,
  Trophy,
  AlertTriangle,
  Shield,
  MapPin,
  Loader2,
  ArrowRight,
  IndianRupee,
  Zap,
  Users,
  BarChart3,
  Globe,
  Clock,
  AlertCircle,
  Building2,
} from "lucide-react";

interface SportPanel {
  sport: string;
  activeTournaments: number;
  playersToday: number;
  revenue: number;
  openDisputes: number;
}

interface TournamentMarker {
  id: string;
  name: string;
  sport: string;
  status: string;
  state: string | null;
  city: string | null;
  startDate: string;
  registrations: number;
  color: string;
}

interface Alert {
  id: string;
  type: string;
  requestedAction: string;
  status: string;
  level: string;
  autoEscalateAt: string | null;
  createdAt: string;
  requester: string;
}

interface Zone {
  id: string;
  name: string;
  code: string;
  states: string[];
  isActive: boolean;
  adminCount: number;
}

interface Sector {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  adminCount: number;
  zones: Zone[];
}

interface MissionControlData {
  sportPanels: SportPanel[];
  tournamentMarkers: TournamentMarker[];
  alerts: Alert[];
  sectors: Sector[];
  adminsByRole: { role: string; sport: string; count: number }[];
  pendingEscalations: number;
  generatedAt: string;
}

export default function MissionControlPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MissionControlData | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [sport]);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const response = await fetch(`/api/admin/mission-control?sport=${sport.toUpperCase()}`);

      if (response.status === 401) {
        router.push(`/${sport}/admin/login`);
        return;
      }

      if (response.status === 403) {
        setError("Mission Control requires Super Admin access");
        return;
      }

      if (response.ok) {
        const result = await response.json();
        setData(result.missionControl);
      } else {
        setError("Failed to load mission control data");
      }
    } catch (err) {
      setError("Failed to load mission control data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      REGISTRATION_OPEN: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      REGISTRATION_CLOSED: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      BRACKET_GENERATED: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      IN_PROGRESS: "bg-green-500/10 text-green-400 border-green-500/30",
      COMPLETED: "bg-gray-500/10 text-gray-400 border-gray-500/30",
    };
    return colors[status] || "bg-gray-500/10 text-gray-400 border-gray-500/30";
  };

  const getAlertLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      LOW: "text-blue-400",
      MEDIUM: "text-yellow-400",
      HIGH: "text-orange-400",
      CRITICAL: "text-red-400",
    };
    return colors[level] || "text-gray-400";
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  if (loading) {
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
          <Button onClick={() => fetchData()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              Mission Control
            </h1>
            <p className="text-muted-foreground mt-1">
              Real-time overview across all sports and regions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              Last updated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "Never"}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>
        </div>

        {/* Sport Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {data?.sportPanels.map((panel) => (
            <Card key={panel.sport} className="bg-gradient-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className={`w-5 h-5 ${panel.sport === "CORNHOLE" ? "text-green-500" : "text-teal-500"}`} />
                  {panel.sport}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{panel.activeTournaments}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{panel.playersToday}</p>
                    <p className="text-xs text-muted-foreground">Players Today</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">
                      ₹{(panel.revenue / 100000).toFixed(1)}L
                    </p>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${panel.openDisputes > 0 ? "text-red-400" : "text-foreground"}`}>
                      {panel.openDisputes}
                    </p>
                    <p className="text-xs text-muted-foreground">Disputes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending Escalations Alert */}
        {data && data.pendingEscalations > 0 && (
          <Card className="bg-red-500/10 border-red-500/30 mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-400" />
                <div>
                  <p className="font-medium text-red-400">
                    {data.pendingEscalations} pending escalation{data.pendingEscalations !== 1 ? "s" : ""} require attention
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Some issues have been escalated and need immediate action
                  </p>
                </div>
                <Button variant="outline" size="sm" className="ml-auto border-red-500/30 text-red-400">
                  View All
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="tournaments" className="space-y-6">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="tournaments" className="gap-2">
              <Trophy className="w-4 h-4" />
              Active Tournaments
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alerts
              {data && data.alerts.length > 0 && (
                <Badge className="bg-red-500 text-white ml-1">{data.alerts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="structure" className="gap-2">
              <Building2 className="w-4 h-4" />
              Sector Structure
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tournaments">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Active Tournament Map
                </CardTitle>
                <CardDescription>
                  All tournaments currently in progress or accepting registrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data && data.tournamentMarkers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No active tournaments</p>
                  </div>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {data?.tournamentMarkers.map((t) => (
                        <Link
                          key={t.id}
                          href={`/${sport}/admin/tournaments/${t.id}`}
                          className="block"
                        >
                          <div className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`w-3 h-3 rounded-full ${
                                    t.color === "green" ? "bg-green-500" :
                                    t.color === "blue" ? "bg-blue-500" :
                                    "bg-amber-500"
                                  }`} />
                                  <h4 className="font-medium text-foreground">{t.name}</h4>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  {t.city && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {t.city}{t.state && `, ${t.state}`}
                                    </span>
                                  )}
                                  <span>{t.registrations} players</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusBadge(t.status)} variant="outline">
                                  {t.status.replace(/_/g, " ")}
                                </Badge>
                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Real-time Alerts
                </CardTitle>
                <CardDescription>
                  Escalations and issues requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data && data.alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No active alerts</p>
                    <p className="text-sm">All systems are operating normally</p>
                  </div>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {data?.alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                  {alert.type}
                                </Badge>
                                <span className={`text-sm font-medium ${getAlertLevelColor(alert.level)}`}>
                                  {alert.level} priority
                                </span>
                              </div>
                              <p className="text-sm text-foreground">{alert.requestedAction}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Requested by: {alert.requester}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="mb-2">
                                {alert.status}
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {new Date(alert.createdAt).toLocaleString()}
                              </p>
                              {alert.autoEscalateAt && (
                                <p className="text-xs text-amber-400 mt-1">
                                  Auto-escalates: {new Date(alert.autoEscalateAt).toLocaleTimeString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structure">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Sector & Zone Structure
                </CardTitle>
                <CardDescription>
                  Geographic organization and admin assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {data?.sectors.map((sector) => (
                      <div key={sector.id} className="p-4 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-foreground">{sector.name}</h4>
                            <p className="text-xs text-muted-foreground">Code: {sector.code}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-muted/50">
                              <Users className="w-3 h-3 mr-1" />
                              {sector.adminCount} admins
                            </Badge>
                            {!sector.isActive && (
                              <Badge className="bg-red-500/10 text-red-400">Inactive</Badge>
                            )}
                          </div>
                        </div>

                        {sector.zones.length > 0 && (
                          <div className="pl-4 border-l-2 border-border/50 space-y-2">
                            {sector.zones.map((zone) => (
                              <div key={zone.id} className="py-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{zone.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      States: {zone.states.join(", ")}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {zone.adminCount} admins
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href={`/${sport}/admin/tournaments/create`}>
              <Card className="bg-gradient-card border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="py-4 text-center">
                  <Trophy className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Create Tournament</p>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/${sport}/admin/disputes`}>
              <Card className="bg-gradient-card border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="py-4 text-center">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-400" />
                  <p className="text-sm font-medium">View Disputes</p>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/${sport}/admin/assignments`}>
              <Card className="bg-gradient-card border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="py-4 text-center">
                  <Users className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                  <p className="text-sm font-medium">Assign Admin</p>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/${sport}/admin/health`}>
              <Card className="bg-gradient-card border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="py-4 text-center">
                  <Activity className="w-6 h-6 mx-auto mb-2 text-green-400" />
                  <p className="text-sm font-medium">System Health</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
