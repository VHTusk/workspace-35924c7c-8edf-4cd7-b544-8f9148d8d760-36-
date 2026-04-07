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
  Users,
  Trophy,
  AlertTriangle,
  Shield,
  MapPin,
  Activity,
  Loader2,
  ArrowRight,
  IndianRupee,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Zap,
  PieChart,
} from "lucide-react";

interface AdminByRole {
  role: string;
  count: number;
  label: string;
}

interface InactiveAdmin {
  id: string;
  user: { id: string; firstName: string; lastName: string; email: string };
  role: string;
  sport: string | null;
  assignedAt: string;
  actionsCount: number;
  trustLevel: number;
  stateCode: string | null;
  districtName: string | null;
}

interface ActiveEmergency {
  id: string;
  triggerType: string;
  triggerDescription: string;
  createdAt: string;
  admin?: { firstName: string; lastName: string; email: string };
  adminRole?: string;
}

interface LoadMetric {
  state: string;
  tournaments: number;
  admins: number;
  load: number;
  status: string;
}

interface PendingRefund {
  id: string;
  amount: number;
  position: number;
  status: string;
  tournament?: { name: string; sport: string };
  user?: { firstName: string; lastName: string; email: string };
  createdAt: string;
}

interface PendingDispute {
  id: string;
  matchId: string;
  reason: string;
  status: string;
  createdAt: string;
  raisedBy?: { firstName: string; lastName: string; email: string };
}

interface FinancialSnapshot {
  thisMonthRevenue: { amount: number; currency: string; changePercent: number; trend: string };
  pendingPayouts: { amount: number; count: number; currency: string };
  refundsProcessed: { amount: number; count: number; currency: string };
}

interface GovernanceData {
  adminsByRole: AdminByRole[];
  inactiveAdmins: InactiveAdmin[];
  activeEmergencies: ActiveEmergency[];
  loadMetrics: LoadMetric[];
}

interface PendingActions {
  pendingRefunds: PendingRefund[];
  pendingDisputes: PendingDispute[];
  inactiveAdminsCount: number;
  activeEmergenciesCount: number;
}

interface AdminInfo {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  isSuperAdmin: boolean;
  canViewRevenue: boolean;
  canAssignAdmins: boolean;
}

export default function GovernanceDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [governance, setGovernance] = useState<GovernanceData | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActions | null>(null);
  const [financial, setFinancial] = useState<FinancialSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, [sport]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/governance-dashboard?sport=${sport.toUpperCase()}`);
      
      if (response.status === 401) {
        router.push(`/${sport}/admin/login`);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAdmin(data.admin);
          setGovernance(data.governance);
          setPendingActions(data.pendingActions);
          setFinancial(data.financial);
        } else {
          setError("Failed to load governance data");
        }
      } else {
        setError("Failed to load governance data");
      }
    } catch (err) {
      setError("Failed to load governance data");
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: "bg-red-500/10 text-red-400 border-red-500/30",
      SPORT_ADMIN: "bg-orange-500/10 text-orange-400 border-orange-500/30",
      STATE_ADMIN: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      DISTRICT_ADMIN: "bg-teal-500/10 text-teal-400 border-teal-500/30",
      TOURNAMENT_DIRECTOR: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    };
    return colors[role] || "bg-gray-500/10 text-gray-400 border-gray-500/30";
  };

  const getLoadStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      healthy: "text-emerald-400",
      moderate: "text-yellow-400",
      high: "text-orange-400",
      critical: "text-red-400",
    };
    return colors[status] || "text-gray-400";
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (trend === "down") return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
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
          <Button onClick={fetchData}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!admin?.isSuperAdmin && !admin?.canViewRevenue) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-amber-400" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
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
            <h1 className="text-2xl font-bold text-foreground">Governance Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Admin hierarchy, load metrics, and system alerts
            </p>
          </div>
          <Badge className={`${getRoleBadgeColor(admin.role)} border`}>
            <Shield className="w-3 h-3 mr-1" />
            {admin.role.replace(/_/g, " ")}
          </Badge>
        </div>

        {/* Admin Hierarchy */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary" />
            Admin Hierarchy
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {governance?.adminsByRole.map((item) => (
              <Card key={item.role} className="bg-gradient-card border-border/50">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-2xl font-bold text-foreground">{item.count}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Pending Actions */}
        {pendingActions && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Pending Actions
              {(pendingActions.inactiveAdminsCount + pendingActions.activeEmergenciesCount + pendingActions.pendingRefunds.length + pendingActions.pendingDisputes.length) > 0 && (
                <Badge className="bg-red-500 text-white ml-2">
                  {pendingActions.inactiveAdminsCount + pendingActions.activeEmergenciesCount + pendingActions.pendingRefunds.length + pendingActions.pendingDisputes.length}
                </Badge>
              )}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-orange-400" />
                    Pending Payouts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {pendingActions.pendingRefunds.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Awaiting processing
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    Open Disputes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {pendingActions.pendingDisputes.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Need resolution
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    Inactive Admins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {pendingActions.inactiveAdminsCount}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Flagged for review
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-red-400" />
                    Active Emergencies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {pendingActions.activeEmergenciesCount}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Critical situations
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Financial Snapshot */}
        {admin?.canViewRevenue && financial && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-emerald-400" />
              Financial Snapshot
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    This Month Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-foreground">
                      ₹{(financial.thisMonthRevenue.amount / 100000).toFixed(1)}L
                    </span>
                    {getTrendIcon(financial.thisMonthRevenue.trend)}
                  </div>
                  <p className={`text-xs ${financial.thisMonthRevenue.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {financial.thisMonthRevenue.changePercent >= 0 ? '+' : ''}{financial.thisMonthRevenue.changePercent}% vs last month
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pending Payouts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    ₹{(financial.pendingPayouts.amount / 100000).toFixed(1)}L
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {financial.pendingPayouts.count} payouts pending
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Refunds This Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    ₹{(financial.refundsProcessed.amount / 1000).toFixed(1)}K
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {financial.refundsProcessed.count} refunds processed
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Load Metrics & Emergencies */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Load by Region */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Load by Region
              </CardTitle>
              <CardDescription>Tournaments per admin ratio</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {governance?.loadMetrics.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{m.state}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.tournaments} tournaments, {m.admins} admins
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${getLoadStatusColor(m.status)}`}>
                          {m.load}x
                        </span>
                        <Badge className={`${getLoadStatusColor(m.status)} bg-transparent border-current`} variant="outline">
                          {m.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Active Emergencies */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Active Emergencies
              </CardTitle>
              <CardDescription>Requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {governance?.activeEmergencies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No active emergencies</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {governance?.activeEmergencies.map((e) => (
                      <div key={e.id} className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 mb-2">
                              {e.triggerType}
                            </Badge>
                            <p className="text-sm text-foreground">{e.triggerDescription}</p>
                            {e.admin && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Admin: {e.admin.firstName} {e.admin.lastName} ({e.adminRole})
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(e.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Inactive Admins */}
        {governance && governance.inactiveAdmins.length > 0 && (
          <div className="mt-6">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  Inactive Admins
                </CardTitle>
                <CardDescription>No activity in 30+ days</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {governance.inactiveAdmins.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {a.user.firstName} {a.user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{a.user.email}</p>
                        </div>
                        <Badge className={getRoleBadgeColor(a.role)} variant="outline">
                          {a.role.replace(/_/g, " ")}
                        </Badge>
                        <div className="text-right">
                          <p className="text-sm font-medium">{a.actionsCount}</p>
                          <p className="text-xs text-muted-foreground">actions</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
