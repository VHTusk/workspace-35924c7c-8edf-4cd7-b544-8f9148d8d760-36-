"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Trophy,
  Calendar,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  FileText,
  DollarSign,
  Loader2,
  LogOut,
  Building2,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  AlertCircle,
  ArrowRight,
  IndianRupee,
  PieChart,
  Activity,
  Zap,
} from "lucide-react";

interface AdminStats {
  totalPlayers: number;
  totalOrgs: number;
  activeTournaments: number;
  completedTournaments: number;
  pendingRegistrations: number;
  openDisputes: number;
  totalMatches: number;
  todayMatches: number;
  activeToday: number;
  registrationsToday: number;
  recentUsers: number;
  totalPrizePool: number;
}

interface PendingMatch {
  id: string;
  playerA: { firstName: string; lastName: string };
  playerB: { firstName: string; lastName: string } | null;
  tournament: { name: string } | null;
  round: string | null;
  status: string;
  scheduledTime: string | null;
}

interface Dispute {
  id: string;
  matchId: string;
  reason: string;
  status: string;
  createdAt: string;
  raisedBy: { firstName: string; lastName: string };
}

interface AuditLog {
  id: string;
  action: string;
  actor: { name: string } | null;
  targetType: string;
  createdAt: string;
}

interface PendingTournament {
  id: string;
  name: string;
  type: string;
  hostOrg: { name: string } | null;
  createdAt: string;
  entryFee: number;
  maxPlayers: number;
}

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

export default function AdminPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pendingTournaments, setPendingTournaments] = useState<PendingTournament[]>([]);
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Governance state
  const [governance, setGovernance] = useState<GovernanceData | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActions | null>(null);
  const [financial, setFinancial] = useState<FinancialSnapshot | null>(null);

  // Role assignment form state
  const [assignForm, setAssignForm] = useState({
    email: "",
    role: "",
    assignSport: "",
    stateCode: "",
    districtName: "",
  });
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [assignSuccess, setAssignSuccess] = useState("");

  useEffect(() => {
    checkAuth();
    fetchData();
  }, [sport]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth/check");
      if (!response.ok) {
        router.push(`/${sport}/admin/login`);
        return;
      }
      const data = await response.json();
      setAdmin(data.admin);
    } catch {
      router.push(`/${sport}/admin/login`);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch stats
      const statsRes = await fetch(`/api/admin/stats?sport=${sport.toUpperCase()}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
        setAuditLogs(statsData.recentActivity || []);
      }

      // Fetch pending matches
      const matchesRes = await fetch(`/api/admin/matches/pending?sport=${sport.toUpperCase()}`);
      if (matchesRes.ok) {
        const matchesData = await matchesRes.json();
        setPendingMatches(matchesData.matches?.slice(0, 5) || []);
      }

      // Fetch disputes
      const disputesRes = await fetch(`/api/admin/disputes?sport=${sport.toUpperCase()}&status=OPEN`);
      if (disputesRes.ok) {
        const disputesData = await disputesRes.json();
        setDisputes(disputesData.disputes?.slice(0, 5) || []);
      }

      // Fetch pending INTRA_ORG tournaments (DRAFT status)
      const tournamentsRes = await fetch(`/api/admin/tournaments?sport=${sport.toUpperCase()}&status=DRAFT&type=INTRA_ORG`);
      if (tournamentsRes.ok) {
        const tournamentsData = await tournamentsRes.json();
        setPendingTournaments(tournamentsData.tournaments || []);
      }

      // Fetch governance dashboard data
      const governanceRes = await fetch(`/api/admin/governance-dashboard?sport=${sport.toUpperCase()}`);
      if (governanceRes.ok) {
        const governanceData = await governanceRes.json();
        if (governanceData.success) {
          setGovernance(governanceData.governance);
          setPendingActions(governanceData.pendingActions);
          setFinancial(governanceData.financial);
          // Update admin info from governance endpoint
          if (governanceData.admin) {
            setAdmin(governanceData.admin);
          }
        }
      }
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTournament = async (tournamentId: string, approved: boolean, reason?: string) => {
    setActionLoading(tournamentId);
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, reason }),
      });

      if (response.ok) {
        // Remove from pending list
        setPendingTournaments((prev) => prev.filter((t) => t.id !== tournamentId));
      }
    } catch (err) {
      setError("Failed to process approval");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignLoading(true);
    setAssignError("");
    setAssignSuccess("");

    try {
      // First find user by email
      const searchRes = await fetch(`/api/search/players?q=${encodeURIComponent(assignForm.email)}&sport=${sport.toUpperCase()}`);
      if (!searchRes.ok) {
        setAssignError("User not found");
        setAssignLoading(false);
        return;
      }

      const searchData = await searchRes.json();
      const user = searchData.data?.results?.[0];
      
      if (!user) {
        setAssignError("User not found with this email");
        setAssignLoading(false);
        return;
      }

      // Create assignment
      const response = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          adminRole: assignForm.role,
          sport: assignForm.assignSport || sport.toUpperCase(),
          stateCode: assignForm.stateCode || undefined,
          districtName: assignForm.districtName || undefined,
          reason: "Role assignment from admin dashboard",
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setAssignSuccess(`Successfully assigned ${user.fullName || user.firstName} as ${assignForm.role}`);
        setAssignForm({ email: "", role: "", assignSport: "", stateCode: "", districtName: "" });
        // Refresh governance data
        fetchData();
      } else {
        setAssignError(data.error || "Failed to assign role");
      }
    } catch (err) {
      setAssignError("Failed to assign role");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push(`/${sport}/admin/login`);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Console</h1>
            <p className="text-muted-foreground mt-1">
              {admin ? `Welcome, ${admin.firstName} ${admin.lastName}` : "Manage tournaments, matches, and players"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={`${getRoleBadgeColor(admin?.role || "ADMIN")} border`}>
              <Shield className="w-3 h-3 mr-1" />
              {admin?.role?.replace(/_/g, " ") || "ADMIN"}
            </Badge>
            {admin?.isSuperAdmin && (
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 border">
                <Zap className="w-3 h-3 mr-1" />
                Full Access
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Governance Metrics Section - Super Admin / Sport Admin only */}
        {admin?.isSuperAdmin && governance && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary" />
              Governance Overview
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Admins by Role */}
              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Admins by Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-40">
                    <div className="space-y-2">
                      {governance.adminsByRole.map((item) => (
                        <div key={item.role} className="flex items-center justify-between">
                          <span className="text-sm text-foreground">{item.label}</span>
                          <Badge className={getRoleBadgeColor(item.role)} variant="outline">
                            {item.count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Inactive Admins */}
              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    Inactive Admins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground mb-2">
                    {governance.inactiveAdmins.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No activity in 30+ days
                  </p>
                  {governance.inactiveAdmins.length > 0 && (
                    <ScrollArea className="h-24 mt-3">
                      <div className="space-y-1">
                        {governance.inactiveAdmins.slice(0, 5).map((a) => (
                          <div key={a.id} className="text-xs text-muted-foreground">
                            {a.user.firstName} {a.user.lastName} ({a.role.replace(/_/g, " ")})
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Active Emergencies */}
              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    Active Emergencies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground mb-2">
                    {governance.activeEmergencies.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requiring immediate attention
                  </p>
                  {governance.activeEmergencies.length > 0 && (
                    <ScrollArea className="h-24 mt-3">
                      <div className="space-y-1">
                        {governance.activeEmergencies.slice(0, 3).map((e) => (
                          <div key={e.id} className="text-xs text-muted-foreground">
                            {e.triggerType}: {e.triggerDescription?.slice(0, 30)}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Load Metrics */}
              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Load by Region
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-40">
                    <div className="space-y-2">
                      {governance.loadMetrics.slice(0, 5).map((m, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm text-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            {m.state}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${getLoadStatusColor(m.status)}`}>
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
            </div>
          </div>
        )}

        {/* Pending Actions Widget */}
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
              {/* Pending Refunds */}
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
                  {pendingActions.pendingRefunds.length > 0 && (
                    <Link href={`/${sport}/admin/prizes/payouts`} className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1">
                      View all <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </CardContent>
              </Card>

              {/* Pending Disputes */}
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
                  {pendingActions.pendingDisputes.length > 0 && (
                    <Link href={`/${sport}/admin/disputes`} className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1">
                      View all <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </CardContent>
              </Card>

              {/* Inactive Admins */}
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

              {/* Active Emergencies */}
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

        {/* Financial Snapshot - Super Admin / Sport Admin only */}
        {admin?.canViewRevenue && financial && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Financial Snapshot
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* This Month Revenue */}
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

              {/* Pending Payouts */}
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

              {/* Refunds Processed */}
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

        {/* Role Assignment Section - Super Admin / Sport Admin only */}
        {admin?.canAssignAdmins && (
          <div className="mb-8">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Assign Admin Role
                </CardTitle>
                <CardDescription>
                  Assign administrative privileges to users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRoleAssignment} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* User Email */}
                    <div className="space-y-2">
                      <Label htmlFor="email">User Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={assignForm.email}
                        onChange={(e) => setAssignForm({ ...assignForm, email: e.target.value })}
                        required
                      />
                    </div>

                    {/* Role Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={assignForm.role}
                        onValueChange={(value) => setAssignForm({ ...assignForm, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                          <SelectItem value="SPORT_ADMIN">Sport Admin</SelectItem>

                          <SelectItem value="STATE_ADMIN">State Admin</SelectItem>
                          <SelectItem value="DISTRICT_ADMIN">District Admin</SelectItem>
                          <SelectItem value="TOURNAMENT_DIRECTOR">Tournament Director</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sport Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="sport">Sport</Label>
                      <Select
                        value={assignForm.assignSport}
                        onValueChange={(value) => setAssignForm({ ...assignForm, assignSport: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={sport.toUpperCase()} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CORNHOLE">Cornhole</SelectItem>
                          <SelectItem value="DARTS">Darts</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* State Code */}
                    {(assignForm.role === "STATE_ADMIN" || assignForm.role === "DISTRICT_ADMIN") && (
                      <div className="space-y-2">
                        <Label htmlFor="stateCode">State Code</Label>
                        <Input
                          id="stateCode"
                          placeholder="e.g., RJ, MH, DL"
                          value={assignForm.stateCode}
                          onChange={(e) => setAssignForm({ ...assignForm, stateCode: e.target.value })}
                        />
                      </div>
                    )}

                    {/* District Name */}
                    {assignForm.role === "DISTRICT_ADMIN" && (
                      <div className="space-y-2">
                        <Label htmlFor="districtName">District Name</Label>
                        <Input
                          id="districtName"
                          placeholder="e.g., Jaipur, Mumbai"
                          value={assignForm.districtName}
                          onChange={(e) => setAssignForm({ ...assignForm, districtName: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  {assignError && (
                    <p className="text-sm text-red-400">{assignError}</p>
                  )}
                  {assignSuccess && (
                    <p className="text-sm text-emerald-400">{assignSuccess}</p>
                  )}

                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={assignLoading || !assignForm.role || !assignForm.email}
                  >
                    {assignLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Assign Role
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">
                {stats?.totalPlayers?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-muted-foreground">Total Players</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <Building2 className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">
                {stats?.totalOrgs?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-muted-foreground">Organizations</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <Trophy className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">
                {stats?.activeTournaments || 0}
              </p>
              <p className="text-xs text-muted-foreground">Active Tournaments</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">
                {stats?.openDisputes || 0}
              </p>
              <p className="text-xs text-muted-foreground">Open Disputes</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">
                ₹{((stats?.totalPrizePool || 0) / 100000).toFixed(1)}L
              </p>
              <p className="text-xs text-muted-foreground">Prize Pool</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <BarChart3 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">
                {stats?.activeToday || 0}
              </p>
              <p className="text-xs text-muted-foreground">Active Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="approvals" className="space-y-6">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="approvals" className="gap-2">
              <Clock className="w-4 h-4" />
              Pending Approvals
              {pendingTournaments.length > 0 && (
                <Badge className="bg-red-500 text-white ml-1">{pendingTournaments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="matches">Match Management</TabsTrigger>
            <TabsTrigger value="disputes">Disputes</TabsTrigger>
            <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="approvals">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Pending Tournament Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingTournaments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-400" />
                    <p>No pending approvals</p>
                    <p className="text-sm">All intra-org tournaments have been reviewed</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingTournaments.map((tournament) => (
                      <div key={tournament.id} className="p-4 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-purple-500/10 text-purple-400">Intra-Org</Badge>
                              <Badge className="bg-amber-500/10 text-amber-400">Pending</Badge>
                            </div>
                            <h4 className="font-medium text-foreground">{tournament.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Hosted by: {tournament.hostOrg?.name || "Unknown Organization"}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                              <span>Entry Fee: ₹{tournament.entryFee}</span>
                              <span>Max Players: {tournament.maxPlayers}</span>
                              <span>Created: {new Date(tournament.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                              onClick={() => {
                                const reason = prompt("Reason for rejection (optional):");
                                handleApproveTournament(tournament.id, false, reason || undefined);
                              }}
                              disabled={actionLoading === tournament.id}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="bg-emerald-500 hover:bg-emerald-600 text-white"
                              onClick={() => handleApproveTournament(tournament.id, true)}
                              disabled={actionLoading === tournament.id}
                            >
                              {actionLoading === tournament.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Approve"
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matches">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pending Match Results</CardTitle>
                <Link href={`/${sport}/admin/matches`}>
                  <Button variant="outline" size="sm">View All Matches</Button>
                </Link>
              </CardHeader>
              <CardContent>
                {pendingMatches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending matches
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingMatches.map((match) => (
                      <div key={match.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            match.status === "LIVE" ? "bg-red-500/20" : "bg-amber-500/20"
                          }`}>
                            {match.status === "LIVE" ? (
                              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            ) : (
                              <Clock className="w-5 h-5 text-amber-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {match.playerA?.firstName} {match.playerA?.lastName}
                              {match.playerB ? ` vs ${match.playerB.firstName} ${match.playerB.lastName}` : " (Bye)"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {match.tournament?.name || "Friendly"} {match.round ? `• ${match.round}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={match.status === "LIVE" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}>
                            {match.status}
                          </Badge>
                          <Link href={`/${sport}/admin/matches/${match.id}`}>
                            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                              Enter Result
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="disputes">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Active Disputes
                </CardTitle>
                <Link href={`/${sport}/admin/disputes`}>
                  <Button variant="outline" size="sm">View All Disputes</Button>
                </Link>
              </CardHeader>
              <CardContent>
                {disputes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No active disputes
                  </div>
                ) : (
                  <div className="space-y-3">
                    {disputes.map((dispute) => (
                      <div key={dispute.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border-l-4 border-red-500">
                        <div>
                          <p className="font-medium text-foreground">Match: {dispute.matchId.slice(-8)}</p>
                          <p className="text-sm text-muted-foreground">
                            Raised by: {dispute.raisedBy?.firstName} {dispute.raisedBy?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Reason: {dispute.reason}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-red-500/10 text-red-400">
                            {dispute.status}
                          </Badge>
                          <Link href={`/${sport}/admin/disputes/${dispute.id}`}>
                            <Button size="sm" variant="outline">
                              Review
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tournaments">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Tournament Management</CardTitle>
                <Link href={`/${sport}/admin/tournaments/create`}>
                  <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                    Create Tournament
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <Input placeholder="Search tournaments..." className="flex-1" />
                  <Select defaultValue="all">
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="REGISTRATION_OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-center py-8 text-muted-foreground">
                  <Link href={`/${sport}/admin/tournaments`}>
                    <Button variant="outline">View All Tournaments</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Recent Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent activity
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {log.action.replace(/_/g, " ")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {log.targetType} • by {log.actor?.name || "System"}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
