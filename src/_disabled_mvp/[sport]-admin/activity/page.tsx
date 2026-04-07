"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  Shield,
  UserX,
  Loader2,
  Send,
  ArrowUpRight,
  Ban,
  Users,
  BarChart3,
  MapPin,
  Calendar,
  Filter,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown
} from "lucide-react";

// Types
interface AuditLogEntry {
  id: string;
  sport: string;
  action: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  actorRole: string | null;
  targetType: string;
  targetId: string;
  tournamentId: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface InactiveAdmin {
  adminId: string;
  userId: string;
  role: string;
  lastLoginAt?: string;
  lastActionAt?: string;
  daysInactive: number;
  pendingEscalations: number;
  unrespondedActions: number;
  currentStatus: string;
  needsAction: boolean;
  recommendedAction: string;
}

interface AdminLoadInfo {
  adminId: string;
  userId: string;
  role: string;
  activeTournaments: number;
  pendingActions: number;
  openEscalations: number;
  scheduledToday: number;
  scheduledThisWeek: number;
  maxCapacity: number;
  currentLoadPercent: number;
  availableSlots: number;
  isOverloaded: boolean;
  availabilityStatus: string;
}

interface EmergencyControlStatus {
  id: string;
  status: string;
  originalAdmin: {
    id: string;
    role: string;
    stateCode?: string;
    districtName?: string;
  };
  assumingAdmin: {
    id: string;
    userId: string;
    role: string;
  };
  triggerType: string;
  triggeredAt: string;
  duration: string;
  affectedResources: number;
}

// Status colors
const statusColors: Record<string, string> = {
  MONITORING: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  WARNING: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  FLAGGED: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  ESCALATED: "bg-red-500/10 text-red-400 border-red-500/30",
  DISABLED: "bg-muted text-muted-foreground border-border",
  RESOLVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  ACTIVE: "bg-red-500/10 text-red-400 border-red-500/30",
  AVAILABLE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  BUSY: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  EMERGENCY_ONLY: "bg-red-500/10 text-red-400 border-red-500/30",
};

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  SPORT_ADMIN: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  STATE_ADMIN: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  DISTRICT_ADMIN: "bg-green-500/10 text-green-400 border-green-500/30",
  TOURNAMENT_DIRECTOR: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const loadColors: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

export default function AdminActivityPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  // State
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Activity Feed
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditPagination, setAuditPagination] = useState<Pagination | null>(null);

  // Inactive Admins
  const [inactiveAdmins, setInactiveAdmins] = useState<InactiveAdmin[]>([]);

  // Load Metrics
  const [loadMetrics, setLoadMetrics] = useState<AdminLoadInfo[]>([]);
  const [overloadedAdmins, setOverloadedAdmins] = useState<AdminLoadInfo[]>([]);
  const [underutilizedAdmins, setUnderutilizedAdmins] = useState<AdminLoadInfo[]>([]);

  // Emergencies
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyControlStatus[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Check auth and fetch data
  useEffect(() => {
    checkAuth();
    fetchAllData();
  }, [sport]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth/check");
      if (!response.ok) {
        router.push(`/${sport}/admin/login`);
      }
    } catch {
      router.push(`/${sport}/admin/login`);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([
        fetchAuditLogs(),
        fetchInactiveAdmins(),
        fetchLoadMetrics(),
        fetchActiveEmergencies(),
      ]);
    } catch (err) {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async (page = 1) => {
    try {
      const queryParams = new URLSearchParams({
        sport: sport.toUpperCase(),
        page: page.toString(),
        limit: "20",
      });
      if (dateFrom) queryParams.append("startDate", dateFrom);
      if (dateTo) queryParams.append("endDate", dateTo);
      if (actionFilter) queryParams.append("action", actionFilter);

      const response = await fetch(`/api/admin/audit-logs?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs || []);
        setAuditPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    }
  };

  const fetchInactiveAdmins = async () => {
    try {
      const queryParams = new URLSearchParams({
        action: "inactive-admins",
        sport: sport.toUpperCase(),
      });

      const response = await fetch(`/api/admin/governance?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        const admins = data.admins || [];
        
        // Apply filters
        let filtered = admins;
        if (roleFilter) {
          filtered = filtered.filter((a: InactiveAdmin) => a.role === roleFilter);
        }
        if (statusFilter) {
          filtered = filtered.filter((a: InactiveAdmin) => a.currentStatus === statusFilter);
        }
        
        setInactiveAdmins(filtered);
      }
    } catch (err) {
      console.error("Failed to fetch inactive admins:", err);
    }
  };

  const fetchLoadMetrics = async () => {
    try {
      const queryParams = new URLSearchParams({
        action: "load-metrics",
        sport: sport.toUpperCase(),
      });

      const response = await fetch(`/api/admin/governance?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        const metrics = data.metrics || [];
        setLoadMetrics(metrics);
        
        // Categorize
        setOverloadedAdmins(metrics.filter((m: AdminLoadInfo) => m.currentLoadPercent > 85));
        setUnderutilizedAdmins(metrics.filter((m: AdminLoadInfo) => m.currentLoadPercent < 50));
      }
    } catch (err) {
      console.error("Failed to fetch load metrics:", err);
    }
  };

  const fetchActiveEmergencies = async () => {
    try {
      const queryParams = new URLSearchParams({
        action: "active-emergencies",
        sport: sport.toUpperCase(),
      });

      const response = await fetch(`/api/admin/governance?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        setActiveEmergencies(data.emergencies || []);
      }
    } catch (err) {
      console.error("Failed to fetch emergencies:", err);
    }
  };

  // Actions
  const handleSendReminder = async (adminId: string) => {
    setActionLoading(adminId);
    try {
      // In a real implementation, this would call an API to send reminder
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Refresh data
      await fetchInactiveAdmins();
    } finally {
      setActionLoading(null);
    }
  };

  const handleEscalate = async (adminId: string) => {
    setActionLoading(adminId);
    try {
      const response = await fetch("/api/admin/governance?action=resolve-inactivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId,
          resolvedById: "current-admin", // Would be actual admin ID
          notes: "Escalated from activity dashboard",
        }),
      });
      if (response.ok) {
        await fetchInactiveAdmins();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisable = async (adminId: string) => {
    if (!confirm("Are you sure you want to disable this admin?")) return;
    
    setActionLoading(adminId);
    try {
      // In a real implementation, this would call an API to disable the admin
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await fetchInactiveAdmins();
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveEmergency = async (emergencyId: string) => {
    setActionLoading(emergencyId);
    try {
      const response = await fetch("/api/admin/governance?action=resolve-emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emergencyId,
          resolvedById: "current-admin",
          restoreOriginal: false,
          notes: "Resolved from activity dashboard",
        }),
      });
      if (response.ok) {
        await fetchActiveEmergencies();
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Apply filters when they change
  useEffect(() => {
    fetchAuditLogs();
  }, [dateFrom, dateTo, actionFilter]);

  useEffect(() => {
    fetchInactiveAdmins();
  }, [roleFilter, statusFilter]);

  // Helper functions
  const getLoadColor = (percent: number): string => {
    if (percent < 50) return loadColors.low;
    if (percent < 70) return loadColors.medium;
    if (percent < 85) return loadColors.high;
    return loadColors.critical;
  };

  const getLoadLabel = (percent: number): string => {
    if (percent < 50) return "Underutilized";
    if (percent < 70) return "Normal";
    if (percent < 85) return "High";
    return "Critical";
  };

  const formatDate = (date: string | undefined): string => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Activity className="w-8 h-8 text-primary" />
              Admin Activity Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor admin activity, inactivity flags, and load metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={fetchAllData} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Badge className="bg-red-500/10 text-red-400 border-red-500/30">
              <Shield className="w-3 h-3 mr-1" />
              {sport.toUpperCase()}
            </Badge>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">{inactiveAdmins.length}</p>
              <p className="text-xs text-muted-foreground">Flagged Admins</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">{overloadedAdmins.length}</p>
              <p className="text-xs text-muted-foreground">Overloaded (&gt;85%)</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <TrendingDown className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">{underutilizedAdmins.length}</p>
              <p className="text-xs text-muted-foreground">Underutilized (&lt;50%)</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <Zap className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">{activeEmergencies.length}</p>
              <p className="text-xs text-muted-foreground">Active Emergencies</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="activity" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="w-4 h-4" />
              Activity Feed
            </TabsTrigger>
            <TabsTrigger value="inactive" className="gap-2">
              <UserX className="w-4 h-4" />
              Inactive Admins
              {inactiveAdmins.length > 0 && (
                <Badge className="bg-amber-500 text-white ml-1">{inactiveAdmins.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="load" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Load Metrics
            </TabsTrigger>
            <TabsTrigger value="emergencies" className="gap-2">
              <AlertCircle className="w-4 h-4" />
              Emergencies
              {activeEmergencies.length > 0 && (
                <Badge className="bg-red-500 text-white ml-1">{activeEmergencies.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Activity Feed Tab */}
          <TabsContent value="activity">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Admin Activity
                </CardTitle>
                <CardDescription>
                  Real-time feed of all admin actions across the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-wrap gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="date"
                      placeholder="From"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-40"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="date"
                      placeholder="To"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-48">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="All Actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Actions</SelectItem>
                      <SelectItem value="LOGIN">Login</SelectItem>
                      <SelectItem value="LOGOUT">Logout</SelectItem>
                      <SelectItem value="TOURNAMENT_CREATE">Tournament Create</SelectItem>
                      <SelectItem value="TOURNAMENT_UPDATE">Tournament Update</SelectItem>
                      <SelectItem value="MATCH_RESULT">Match Result</SelectItem>
                      <SelectItem value="PLAYER_BAN">Player Ban</SelectItem>
                      <SelectItem value="DISPUTE_RESOLVE">Dispute Resolve</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setActionFilter("");
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>

                {/* Activity Table */}
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Action</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-400" />
                            No activity logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log) => (
                          <TableRow key={log.id} className="hover:bg-muted/30">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-primary/10 text-primary">
                                  {log.action.replace(/_/g, " ")}
                                </Badge>
                                {log.reason && (
                                  <span className="text-xs text-muted-foreground truncate max-w-32">
                                    {log.reason}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">
                                  {log.actor?.name || "System"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {log.actor?.role || log.actorRole || "N/A"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm text-foreground">{log.targetType}</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {log.targetId?.slice(-8)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {formatDate(log.createdAt)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground font-mono">
                                {log.ipAddress || "N/A"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {auditPagination && auditPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(auditPagination.page - 1) * auditPagination.limit + 1} to{" "}
                      {Math.min(auditPagination.page * auditPagination.limit, auditPagination.total)} of{" "}
                      {auditPagination.total} entries
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditPagination.page === 1}
                        onClick={() => fetchAuditLogs(auditPagination.page - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditPagination.page === auditPagination.totalPages}
                        onClick={() => fetchAuditLogs(auditPagination.page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inactive Admins Tab */}
          <TabsContent value="inactive">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="w-5 h-5 text-amber-400" />
                  Inactive Admins
                </CardTitle>
                <CardDescription>
                  Admins flagged for inactivity requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-wrap gap-4 mb-6">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Roles</SelectItem>
                      <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      <SelectItem value="SPORT_ADMIN">Sport Admin</SelectItem>
                      <SelectItem value="STATE_ADMIN">State Admin</SelectItem>
                      <SelectItem value="DISTRICT_ADMIN">District Admin</SelectItem>
                      <SelectItem value="TOURNAMENT_DIRECTOR">Tournament Director</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Status</SelectItem>
                      <SelectItem value="MONITORING">Monitoring</SelectItem>
                      <SelectItem value="WARNING">Warning</SelectItem>
                      <SelectItem value="FLAGGED">Flagged</SelectItem>
                      <SelectItem value="ESCALATED">Escalated</SelectItem>
                      <SelectItem value="DISABLED">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Table */}
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Admin</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Last Action</TableHead>
                        <TableHead>Days Inactive</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pending</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveAdmins.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-400" />
                            All admins are active
                          </TableCell>
                        </TableRow>
                      ) : (
                        inactiveAdmins.map((admin) => (
                          <TableRow key={admin.adminId} className="hover:bg-muted/30">
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{admin.userId.slice(-8)}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={roleColors[admin.role] || "bg-muted text-muted-foreground border-border"}>
                                {admin.role.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {formatDate(admin.lastActionAt)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${
                                  admin.daysInactive > 14 ? "text-red-400" :
                                  admin.daysInactive > 7 ? "text-amber-400" : "text-foreground"
                                }`}>
                                  {admin.daysInactive}
                                </span>
                                <span className="text-xs text-muted-foreground">days</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[admin.currentStatus] || "bg-muted text-muted-foreground border-border"}>
                                {admin.currentStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {admin.pendingEscalations > 0 && (
                                  <span className="text-xs text-amber-400">
                                    {admin.pendingEscalations} escalations
                                  </span>
                                )}
                                {admin.unrespondedActions > 0 && (
                                  <span className="text-xs text-orange-400">
                                    {admin.unrespondedActions} actions
                                  </span>
                                )}
                                {admin.pendingEscalations === 0 && admin.unrespondedActions === 0 && (
                                  <span className="text-xs text-muted-foreground">None</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSendReminder(admin.adminId)}
                                  disabled={actionLoading === admin.adminId}
                                  title="Send Reminder"
                                >
                                  {actionLoading === admin.adminId ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-amber-400 border-amber-400/30 hover:bg-amber-500/10"
                                  onClick={() => handleEscalate(admin.adminId)}
                                  disabled={actionLoading === admin.adminId}
                                  title="Escalate"
                                >
                                  <ArrowUpRight className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                                  onClick={() => handleDisable(admin.adminId)}
                                  disabled={actionLoading === admin.adminId}
                                  title="Disable"
                                >
                                  <Ban className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Load Metrics Tab */}
          <TabsContent value="load">
            <div className="space-y-6">
              {/* Load Heatmap Card */}
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Admin Load Distribution
                  </CardTitle>
                  <CardDescription>
                    Visual representation of admin workload across regions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Heatmap Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 mb-6">
                    {loadMetrics.map((admin) => (
                      <div
                        key={admin.adminId}
                        className="relative group"
                        title={`${admin.role}: ${admin.currentLoadPercent}%`}
                      >
                        <div
                          className={`h-16 rounded-lg ${getLoadColor(admin.currentLoadPercent)} opacity-80 hover:opacity-100 transition-opacity cursor-pointer`}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {Math.round(admin.currentLoadPercent)}%
                          </span>
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                          <div className="bg-popover text-popover-foreground p-2 rounded shadow-lg text-xs whitespace-nowrap">
                            <p className="font-medium">{admin.role.replace(/_/g, " ")}</p>
                            <p>Active Tournaments: {admin.activeTournaments}</p>
                            <p>Max Capacity: {admin.maxCapacity}</p>
                            <p>Status: {getLoadLabel(admin.currentLoadPercent)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-6 justify-center">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded ${loadColors.low}`} />
                      <span className="text-xs text-muted-foreground">&lt;50% Underutilized</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded ${loadColors.medium}`} />
                      <span className="text-xs text-muted-foreground">50-70% Normal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded ${loadColors.high}`} />
                      <span className="text-xs text-muted-foreground">70-85% High</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded ${loadColors.critical}`} />
                      <span className="text-xs text-muted-foreground">&gt;85% Critical</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Two column layout */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Overloaded Admins */}
                <Card className="bg-gradient-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-400">
                      <TrendingUp className="w-5 h-5" />
                      Overloaded Admins (&gt;85%)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {overloadedAdmins.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                        No overloaded admins
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-64 overflow-y-auto">
                        {overloadedAdmins.map((admin) => (
                          <div key={admin.adminId} className="p-3 rounded-lg bg-muted/50 border border-red-500/30">
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={roleColors[admin.role]}>
                                {admin.role.replace(/_/g, " ")}
                              </Badge>
                              <span className="text-red-400 font-bold">{admin.currentLoadPercent}%</span>
                            </div>
                            <Progress value={admin.currentLoadPercent} className="h-2 mb-2" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{admin.activeTournaments}/{admin.maxCapacity} tournaments</span>
                              <span>{admin.pendingActions} pending actions</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Underutilized Admins */}
                <Card className="bg-gradient-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-emerald-400">
                      <TrendingDown className="w-5 h-5" />
                      Underutilized Admins (&lt;50%)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {underutilizedAdmins.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        All admins are optimally utilized
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-64 overflow-y-auto">
                        {underutilizedAdmins.map((admin) => (
                          <div key={admin.adminId} className="p-3 rounded-lg bg-muted/50 border border-emerald-500/30">
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={roleColors[admin.role]}>
                                {admin.role.replace(/_/g, " ")}
                              </Badge>
                              <span className="text-emerald-400 font-bold">{admin.currentLoadPercent}%</span>
                            </div>
                            <Progress value={admin.currentLoadPercent} className="h-2 mb-2" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{admin.activeTournaments}/{admin.maxCapacity} tournaments</span>
                              <span>{admin.availableSlots} available slots</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Full Load Table */}
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle>Complete Load Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Role</TableHead>
                          <TableHead>Active Tournaments</TableHead>
                          <TableHead>Pending Actions</TableHead>
                          <TableHead>Scheduled Today</TableHead>
                          <TableHead>Capacity</TableHead>
                          <TableHead>Load</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadMetrics.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No load metrics available
                            </TableCell>
                          </TableRow>
                        ) : (
                          loadMetrics.map((admin) => (
                            <TableRow key={admin.adminId} className="hover:bg-muted/30">
                              <TableCell>
                                <Badge className={roleColors[admin.role]}>
                                  {admin.role.replace(/_/g, " ")}
                                </Badge>
                              </TableCell>
                              <TableCell>{admin.activeTournaments}</TableCell>
                              <TableCell>{admin.pendingActions}</TableCell>
                              <TableCell>{admin.scheduledToday}</TableCell>
                              <TableCell>
                                {admin.activeTournaments}/{admin.maxCapacity}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={admin.currentLoadPercent} className="w-20 h-2" />
                                  <span className={`font-medium ${
                                    admin.currentLoadPercent > 85 ? "text-red-400" :
                                    admin.currentLoadPercent > 70 ? "text-amber-400" :
                                    "text-foreground"
                                  }`}>
                                    {admin.currentLoadPercent}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={statusColors[admin.availabilityStatus] || "bg-gray-500/10 text-gray-400"}>
                                  {admin.availabilityStatus}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Emergencies Tab */}
          <TabsContent value="emergencies">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  Active Emergencies
                </CardTitle>
                <CardDescription>
                  Emergency control situations requiring immediate attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeEmergencies.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
                    <p className="text-lg font-medium">No Active Emergencies</p>
                    <p className="text-sm">All systems operating normally</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeEmergencies.map((emergency) => (
                      <div
                        key={emergency.id}
                        className="p-4 rounded-lg bg-red-500/10 border border-red-500/30"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-red-500 text-white">
                                <Zap className="w-3 h-3 mr-1" />
                                {emergency.triggerType.replace(/_/g, " ")}
                              </Badge>
                              <Badge className={statusColors[emergency.status]}>
                                {emergency.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Original Admin</p>
                                <p className="font-medium text-foreground">
                                  {emergency.originalAdmin.role.replace(/_/g, " ")}
                                </p>
                                {emergency.originalAdmin.stateCode && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {emergency.originalAdmin.stateCode}
                                    {emergency.originalAdmin.districtName && ` - ${emergency.originalAdmin.districtName}`}
                                  </p>
                                )}
                              </div>
                              <div>
                                <p className="text-muted-foreground">Assuming Admin</p>
                                <p className="font-medium text-foreground">
                                  {emergency.assumingAdmin.role.replace(/_/g, " ")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Duration: {emergency.duration}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {emergency.affectedResources} affected resources
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                            onClick={() => handleResolveEmergency(emergency.id)}
                            disabled={actionLoading === emergency.id}
                          >
                            {actionLoading === emergency.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Resolve
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Escalation Queue Info */}
            <Card className="bg-gradient-card border-border/50 mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5" />
                  Escalation Queue
                </CardTitle>
                <CardDescription>
                  Pending escalations waiting for admin response
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-2" />
                  <p>Escalation queue data available in the Inactive Admins tab</p>
                  <p className="text-sm mt-1">
                    Total pending escalations: {inactiveAdmins.reduce((sum, a) => sum + a.pendingEscalations, 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
