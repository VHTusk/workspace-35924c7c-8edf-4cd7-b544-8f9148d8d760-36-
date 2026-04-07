"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  User,
  Trophy,
  MessageSquare,
  FileText,
  Loader2,
  Filter,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import SiteFooter from "@/components/layout/site-footer";

interface ContentReport {
  id: string;
  contentType: string;
  contentId: string;
  contentSnapshot?: string;
  reason: string;
  description?: string;
  status: "PENDING" | "REVIEWING" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  reviewedAt?: string;
  action?: string;
  reviewNotes?: string;
  reporter?: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl?: string;
  };
  reportedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl?: string;
  };
}

interface ModerationStats {
  total: number;
  pending: number;
  reviewing: number;
  resolved: number;
  dismissed: number;
}

export default function ModerationQueuePage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [reports, setReports] = useState<ContentReport[]>([]);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [actionNotes, setActionNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
    : "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600";

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [sport, statusFilter, contentTypeFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: statusFilter,
        limit: "50",
      });
      if (contentTypeFilter !== "all") {
        params.append("contentType", contentTypeFilter);
      }
      
      const response = await fetch(`/api/admin/content-reports?${params}`);
      if (response.ok) {
        const data = await response.json();
        setReports(data.data?.reports || []);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/content-reports?action=stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data.data || null);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const handleReviewReport = async () => {
    if (!selectedReport || !selectedAction) return;

    setProcessing(true);
    try {
      const response = await fetch("/api/admin/content-reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: selectedReport.id,
          // reviewerId is determined by API from auth - never trust client
          action: selectedAction,
          notes: actionNotes,
        }),
      });

      if (response.ok) {
        toast.success(`Report ${selectedAction === "dismiss" ? "dismissed" : "resolved"}`);
        setReports((prev) => prev.filter((r) => r.id !== selectedReport.id));
        setSelectedReport(null);
        setActionDialogOpen(false);
        setSelectedAction("");
        setActionNotes("");
        fetchStats();
      } else {
        toast.error("Failed to process report");
      }
    } catch (error) {
      toast.error("Failed to process report");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      REVIEWING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      RESOLVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      DISMISSED: "bg-muted text-muted-foreground",
    };
    return styles[status] || styles.PENDING;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Clock className="w-3 h-3" />;
      case "REVIEWING":
        return <Eye className="w-3 h-3" />;
      case "RESOLVED":
        return <CheckCircle className="w-3 h-3" />;
      case "DISMISSED":
        return <XCircle className="w-3 h-3" />;
      default:
        return <AlertTriangle className="w-3 h-3" />;
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case "user":
        return <User className="w-4 h-4" />;
      case "tournament":
        return <Trophy className="w-4 h-4" />;
      case "message":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <main className="flex-1 md:ml-72 p-4 md:p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header */}
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                  <Shield className={cn("w-7 h-7", primaryTextClass)} />
                  Moderation Queue
                </h1>
                <p className="text-muted-foreground">
                  Review and manage user reports
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <Card className="bg-card border-border/50 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Reports</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border/50 shadow-sm cursor-pointer hover:border-amber-500/50"
                      onClick={() => setStatusFilter("PENDING")}>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-amber-500">{stats?.pending || 0}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border/50 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-500">{stats?.reviewing || 0}</p>
                    <p className="text-xs text-muted-foreground">Reviewing</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border/50 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-500">{stats?.resolved || 0}</p>
                    <p className="text-xs text-muted-foreground">Resolved</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border/50 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{stats?.dismissed || 0}</p>
                    <p className="text-xs text-muted-foreground">Dismissed</p>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="REVIEWING">Reviewing</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="DISMISSED">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Content Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="user">User Reports</SelectItem>
                    <SelectItem value="tournament">Tournaments</SelectItem>
                    <SelectItem value="message">Messages</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reports List */}
              <Card className="bg-card border-border/50 shadow-sm">
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-12 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 mx-auto text-green-500/50 mb-3" />
                      <p className="text-muted-foreground">No reports to review</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        All caught up! Great job keeping the community safe.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {reports.map((report) => (
                        <div
                          key={report.id}
                          className="p-4 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              {/* Content Type Icon */}
                              <div className={cn(
                                "p-2 rounded-lg",
                                isCornhole ? "bg-green-100 dark:bg-green-900/30" : "bg-teal-100 dark:bg-teal-900/30"
                              )}>
                                {getContentTypeIcon(report.contentType)}
                              </div>

                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={cn("text-[10px]", getStatusBadge(report.status))}>
                                    <span className="flex items-center gap-1">
                                      {getStatusIcon(report.status)}
                                      {report.status}
                                    </span>
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] capitalize">
                                    {report.contentType}
                                  </Badge>
                                </div>

                                <p className="font-medium text-foreground mb-1">
                                  {report.reason}
                                </p>

                                <p className="text-sm text-muted-foreground">
                                  {report.description || "No additional details provided"}
                                </p>

                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span>
                                    Reported by: {report.reporter?.firstName} {report.reporter?.lastName}
                                  </span>
                                  <span>
                                    {formatDate(report.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedReport(report);
                                setActionDialogOpen(true);
                              }}
                              className="shrink-0"
                            >
                              Review
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Action Dialog */}
            <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Review Report</DialogTitle>
                  <DialogDescription>
                    Take action on this report
                  </DialogDescription>
                </DialogHeader>

                {selectedReport && (
                  <div className="space-y-4 py-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium">{selectedReport.reason}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedReport.description}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Action</label>
                      <Select value={selectedAction} onValueChange={setSelectedAction}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dismiss">Dismiss - No action needed</SelectItem>
                          <SelectItem value="warning">Warning - Send warning to user</SelectItem>
                          <SelectItem value="content_removed">Remove Content - Delete reported content</SelectItem>
                          <SelectItem value="account_suspended">Suspend Account - Temporarily ban user</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Notes (optional)</label>
                      <Textarea
                        placeholder="Add notes about this decision..."
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActionDialogOpen(false);
                      setSelectedReport(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReviewReport}
                    disabled={!selectedAction || processing}
                    className={cn("text-white", selectedAction === "dismiss" ? "bg-gray-600" : primaryBtnClass)}
                  >
                    {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {selectedAction === "dismiss" ? "Dismiss Report" : "Take Action"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <SiteFooter />
          </main>
        </div>
  );
}
