"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  AlertTriangle,
  User,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  MoreVertical,
  Eye,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Monitor,
  MapPin,
  FileJson,
  History,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Types
interface AbuseEvent {
  id: string;
  pattern: string;
  severity: string;
  status: string;
  detectedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  resolution: string | null;
  actionTaken: string | null;
  reviewedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    sport: string;
    isActive: boolean;
  } | null;
  reviewer: {
    id: string;
    name: string;
  } | null;
}

interface Stats {
  byPattern: { pattern: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  totalPending: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Pattern labels
const PATTERN_LABELS: Record<string, string> = {
  MULTIPLE_ACCOUNTS_SAME_DEVICE: "Multiple Accounts (Same Device)",
  RAPID_REGISTRATIONS: "Rapid Registrations",
  SUSPICIOUS_TOURNAMENT_REGISTRATIONS: "Suspicious Tournament Registrations",
  BOT_REGISTRATION_PATTERN: "Bot Registration Pattern",
  SUSPICIOUS_PAYMENT_PATTERN: "Suspicious Payment Pattern",
  IMPOSSIBLE_TRAVEL: "Impossible Travel",
  CREDENTIAL_STUFFING: "Credential Stuffing",
};

// Severity colors
const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// Status colors
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  REVIEWED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  RESOLVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  FALSE_POSITIVE: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function AdminAbuseEventsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  // State
  const [events, setEvents] = useState<AbuseEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [patternFilter, setPatternFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");

  // Dialogs
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AbuseEvent | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  // Auth check
  useEffect(() => {
    checkAuth();
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

  // Fetch events
  const fetchEvents = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const queryParams = new URLSearchParams();
      queryParams.append("page", pagination.page.toString());
      queryParams.append("limit", pagination.limit.toString());

      if (patternFilter !== "all") queryParams.append("pattern", patternFilter);
      if (severityFilter !== "all") queryParams.append("severity", severityFilter);
      if (statusFilter !== "all") queryParams.append("status", statusFilter);
      if (userIdFilter) queryParams.append("userId", userIdFilter);
      if (startDateFilter) queryParams.append("startDate", startDateFilter);
      if (endDateFilter) queryParams.append("endDate", endDateFilter);

      const response = await fetch(`/api/admin/abuse-events?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
        setStats(data.stats || null);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch abuse events:", error);
      toast.error("Failed to load abuse events");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pagination.page, pagination.limit, patternFilter, severityFilter, statusFilter, userIdFilter, startDateFilter, endDateFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Handle action
  const handleAction = async () => {
    if (!selectedEvent || !currentAction) return;

    setProcessing(true);
    try {
      const response = await fetch("/api/admin/abuse-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          action: currentAction,
          resolution: resolutionNotes,
        }),
      });

      if (response.ok) {
        toast.success(`Event ${currentAction.toLowerCase().replace("_", " ")} successfully`);
        setActionDialogOpen(false);
        setDetailDialogOpen(false);
        setSelectedEvent(null);
        setCurrentAction("");
        setResolutionNotes("");
        fetchEvents(true);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to process action");
      }
    } catch (error) {
      toast.error("Failed to process action");
    } finally {
      setProcessing(false);
    }
  };

  // Open detail dialog
  const openDetailDialog = (event: AbuseEvent) => {
    setSelectedEvent(event);
    setDetailDialogOpen(true);
  };

  // Open action dialog
  const openActionDialog = (action: string) => {
    setCurrentAction(action);
    setActionDialogOpen(true);
  };

  // Reset filters
  const resetFilters = () => {
    setPatternFilter("all");
    setSeverityFilter("all");
    setStatusFilter("all");
    setUserIdFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get severity badge
  const getSeverityBadge = (severity: string) => {
    return (
      <Badge className={cn("text-[10px] font-medium", SEVERITY_COLORS[severity] || SEVERITY_COLORS.LOW)}>
        {severity}
      </Badge>
    );
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    return (
      <Badge className={cn("text-[10px] font-medium", STATUS_COLORS[status] || STATUS_COLORS.PENDING)}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  // Get pattern badge
  const getPatternBadge = (pattern: string) => {
    return (
      <Badge variant="outline" className="text-[10px] font-medium max-w-[200px] truncate">
        {PATTERN_LABELS[pattern] || pattern}
      </Badge>
    );
  };

  // Calculate critical/high counts from stats
  const criticalCount = stats?.bySeverity.find(s => s.severity === "CRITICAL")?.count || 0;
  const highCount = stats?.bySeverity.find(s => s.severity === "HIGH")?.count || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Shield className="w-7 h-7 text-primary" />
              Abuse Events Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor and manage detected abuse patterns
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEvents(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Total Pending */}
          <Card className="bg-card border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats?.totalPending || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Critical Severity */}
          <Card className="bg-card border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
                  <p className="text-xs text-muted-foreground">Critical Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* High Severity */}
          <Card className="bg-card border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-500">{highCount}</p>
                  <p className="text-xs text-muted-foreground">High Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Events by Pattern */}
          <Card className="bg-card border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stats?.byPattern?.length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Pattern Types</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pattern Distribution */}
        {stats?.byPattern && stats.byPattern.length > 0 && (
          <Card className="bg-card border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Events by Pattern (Pending)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {stats.byPattern.map((item) => (
                  <div
                    key={item.pattern}
                    className="p-3 rounded-lg bg-muted/50 text-center"
                  >
                    <p className="text-lg font-bold text-foreground">{item.count}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {PATTERN_LABELS[item.pattern] || item.pattern}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Pattern Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Pattern</Label>
                <Select value={patternFilter} onValueChange={setPatternFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All patterns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Patterns</SelectItem>
                    {Object.keys(PATTERN_LABELS).map((pattern) => (
                      <SelectItem key={pattern} value={pattern}>
                        {PATTERN_LABELS[pattern]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Severity Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Severity</Label>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="REVIEWED">Reviewed</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="FALSE_POSITIVE">False Positive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* User ID Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">User ID</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="h-9 pl-7"
                    placeholder="Search..."
                    value={userIdFilter}
                    onChange={(e) => setUserIdFilter(e.target.value)}
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    className="h-9"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="h-9 px-2"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events Table */}
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="w-4 h-4" />
              Abuse Events
              <Badge variant="outline" className="ml-2">
                {pagination.total} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500/50 mb-3" />
                <p className="text-muted-foreground">No abuse events found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {Object.values({
                    patternFilter,
                    severityFilter,
                    statusFilter,
                    userIdFilter,
                    startDateFilter,
                    endDateFilter,
                  }).some((v) => v && v !== "all")
                    ? "Try adjusting your filters"
                    : "All clear! No suspicious activity detected."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[180px]">Pattern</TableHead>
                      <TableHead className="w-[80px]">Severity</TableHead>
                      <TableHead className="w-[200px]">User</TableHead>
                      <TableHead className="w-[120px]">IP Address</TableHead>
                      <TableHead className="w-[140px]">Detected</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id} className="group">
                        <TableCell>
                          {getPatternBadge(event.pattern)}
                        </TableCell>
                        <TableCell>
                          {getSeverityBadge(event.severity)}
                        </TableCell>
                        <TableCell>
                          {event.user ? (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <User className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {event.user.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {event.user.email || event.user.phone || "No contact"}
                                </p>
                              </div>
                              {!event.user.isActive && (
                                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[9px]">
                                  Banned
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Anonymous</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono text-muted-foreground">
                            {event.ipAddress || "N/A"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(event.detectedAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(event.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => openDetailDialog(event)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {event.status === "PENDING" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedEvent(event);
                                    openActionDialog("REVIEW");
                                  }}>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Mark as Reviewed
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedEvent(event);
                                    openActionDialog("RESOLVE");
                                  }}>
                                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                    Resolve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedEvent(event);
                                    openActionDialog("FALSE_POSITIVE");
                                  }}>
                                    <XCircle className="w-4 h-4 mr-2" />
                                    False Positive
                                  </DropdownMenuItem>
                                  {event.user && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedEvent(event);
                                        openActionDialog("BLOCK_USER");
                                      }}
                                      className="text-red-600 dark:text-red-400"
                                    >
                                      <Ban className="w-4 h-4 mr-2" />
                                      Block User
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {!loading && events.length > 0 && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} events
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-3">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Event Details
            </DialogTitle>
            <DialogDescription>
              View complete information about this abuse event
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-6 py-4">
              {/* Event Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pattern</p>
                  {getPatternBadge(selectedEvent.pattern)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Severity</p>
                  {getSeverityBadge(selectedEvent.severity)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  {getStatusBadge(selectedEvent.status)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Detected</p>
                  <p className="text-sm font-medium">{formatDate(selectedEvent.detectedAt)}</p>
                </div>
              </div>

              <Separator />

              {/* User Info */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  User Information
                </h4>
                {selectedEvent.user ? (
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="text-sm font-medium">{selectedEvent.user.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{selectedEvent.user.email || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium">{selectedEvent.user.phone || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge className={selectedEvent.user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                        {selectedEvent.user.isActive ? "Active" : "Banned"}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No user associated</p>
                )}
              </div>

              <Separator />

              {/* Technical Info */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Technical Information
                </h4>
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      IP Address
                    </p>
                    <p className="text-sm font-mono">{selectedEvent.ipAddress || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">User Agent</p>
                    <p className="text-sm truncate" title={selectedEvent.userAgent || ""}>
                      {selectedEvent.userAgent || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <FileJson className="w-4 h-4" />
                      Metadata
                    </h4>
                    <ScrollArea className="h-40 w-full rounded-lg bg-muted/50 p-4">
                      <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                        {JSON.stringify(selectedEvent.metadata, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                </>
              )}

              {/* Resolution Info */}
              {selectedEvent.status !== "PENDING" && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Resolution
                    </h4>
                    <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                      {selectedEvent.resolution && (
                        <div>
                          <p className="text-xs text-muted-foreground">Resolution Notes</p>
                          <p className="text-sm">{selectedEvent.resolution}</p>
                        </div>
                      )}
                      {selectedEvent.actionTaken && (
                        <div>
                          <p className="text-xs text-muted-foreground">Action Taken</p>
                          <p className="text-sm">{selectedEvent.actionTaken}</p>
                        </div>
                      )}
                      {selectedEvent.reviewer && (
                        <div>
                          <p className="text-xs text-muted-foreground">Reviewed By</p>
                          <p className="text-sm">{selectedEvent.reviewer.name}</p>
                        </div>
                      )}
                      {selectedEvent.reviewedAt && (
                        <div>
                          <p className="text-xs text-muted-foreground">Reviewed At</p>
                          <p className="text-sm">{formatDate(selectedEvent.reviewedAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Actions */}
              {selectedEvent.status === "PENDING" && (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => openActionDialog("REVIEW")}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark as Reviewed
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openActionDialog("RESOLVE")}
                      className="text-green-600 dark:text-green-400"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Resolve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openActionDialog("FALSE_POSITIVE")}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      False Positive
                    </Button>
                    {selectedEvent.user && (
                      <Button
                        variant="outline"
                        onClick={() => openActionDialog("BLOCK_USER")}
                        className="text-red-600 dark:text-red-400"
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        Block User
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {currentAction === "REVIEW" && "Mark as Reviewed"}
              {currentAction === "RESOLVE" && "Resolve Event"}
              {currentAction === "FALSE_POSITIVE" && "Mark as False Positive"}
              {currentAction === "BLOCK_USER" && "Block User"}
              {currentAction === "BLOCK_DEVICE" && "Block Device"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {currentAction === "REVIEW" && "Mark this event as reviewed. This acknowledges the event has been seen."}
              {currentAction === "RESOLVE" && "Mark this event as resolved. The appropriate action has been taken."}
              {currentAction === "FALSE_POSITIVE" && "Mark this event as a false positive. No action is needed."}
              {currentAction === "BLOCK_USER" && "This will permanently ban the user associated with this event. They will not be able to log in or participate."}
              {currentAction === "BLOCK_DEVICE" && "This will block the device associated with this event. No new accounts can be created from this device."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {(currentAction === "RESOLVE" || currentAction === "BLOCK_USER" || currentAction === "BLOCK_DEVICE") && (
            <div className="py-4">
              <Label className="text-sm">Resolution Notes (Optional)</Label>
              <Textarea
                className="mt-2"
                placeholder="Add notes about this action..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={processing}
              className={cn(
                currentAction === "BLOCK_USER" || currentAction === "BLOCK_DEVICE"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-primary hover:bg-primary/90"
              )}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
