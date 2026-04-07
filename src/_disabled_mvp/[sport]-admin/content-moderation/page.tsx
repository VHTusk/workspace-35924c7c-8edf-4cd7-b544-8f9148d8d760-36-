"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  AlertTriangle,
  Loader2,
  Eye,
  CheckCircle,
  XCircle,
  Ban,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Flag,
} from "lucide-react";

interface ContentReport {
  id: string;
  reporterId: string;
  reporter?: { firstName: string; lastName: string; email: string };
  reportedUserId?: string;
  reportedUser?: { firstName: string; lastName: string; email: string };
  reportedOrgId?: string;
  reportedOrg?: { name: string; email: string };
  contentType: string;
  contentId: string;
  contentSnapshot: string | null;
  reason: string;
  description: string | null;
  status: string;
  reviewedById?: string;
  reviewedBy?: { name: string };
  reviewedAt?: string;
  action?: string;
  createdAt: string;
}

interface ReportsResponse {
  reports: ContentReport[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminContentModerationPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [actionDialog, setActionDialog] = useState<"resolve" | "dismiss" | null>(null);
  const [resolution, setResolution] = useState("");
  const [actionType, setActionType] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { checkAuth(); }, [sport]);
  useEffect(() => { fetchReports(); }, [sport, page, statusFilter, typeFilter]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth/check");
      if (!response.ok) router.push(`/${sport}/admin/login`);
    } catch { router.push(`/${sport}/admin/login`); }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        status: statusFilter,
        ...(typeFilter !== "all" && { type: typeFilter }),
      });
      const response = await fetch(`/api/admin/content-reports?${params}`);
      if (response.ok) {
        const data: ReportsResponse = await response.json();
        setReports(data.reports);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedReport || !resolution || !actionType) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/content-reports/${selectedReport.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionType, notes: resolution }),
      });
      if (response.ok) {
        fetchReports();
        setActionDialog(null);
        setSelectedReport(null);
        setResolution("");
        setActionType("");
      }
    } catch (error) {
      console.error("Failed to resolve report:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (!selectedReport) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/content-reports/${selectedReport.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismissed", notes: "Report dismissed" }),
      });
      if (response.ok) {
        fetchReports();
        setActionDialog(null);
        setSelectedReport(null);
      }
    } catch (error) {
      console.error("Failed to dismiss report:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString("en-IN");

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-amber-500/10 text-amber-400",
      REVIEWING: "bg-blue-500/10 text-blue-400",
      RESOLVED: "bg-green-500/10 text-green-400",
      DISMISSED: "bg-gray-500/10 text-gray-400",
    };
    return <Badge className={colors[status] || "bg-gray-500/10 text-gray-400"}>{status}</Badge>;
  };

  const getContentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      message: "bg-blue-500/10 text-blue-400",
      profile_image: "bg-purple-500/10 text-purple-400",
      tournament_media: "bg-amber-500/10 text-amber-400",
      username: "bg-green-500/10 text-green-400",
      other: "bg-gray-500/10 text-gray-400",
    };
    return <Badge variant="outline" className={colors[type] || "bg-gray-500/10 text-gray-400"}>{type}</Badge>;
  };

  if (loading && reports.length === 0) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Content Moderation</h1>
            <p className="text-muted-foreground mt-1">Review and manage reported content</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm bg-amber-500/10 text-amber-400">
              <Flag className="w-4 h-4 mr-1" />
              {pagination.total.toLocaleString()} reports
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="REVIEWING">Reviewing</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="DISMISSED">Dismissed</SelectItem>
                  <SelectItem value="all">All Status</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Content Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="message">Message</SelectItem>
                  <SelectItem value="profile_image">Profile Image</SelectItem>
                  <SelectItem value="tournament_media">Tournament Media</SelectItem>
                  <SelectItem value="username">Username</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reported</TableHead>
                  <TableHead>Content Type</TableHead>
                  <TableHead>Reported User/Org</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="text-sm">{formatDate(report.createdAt)}</TableCell>
                    <TableCell>{getContentTypeBadge(report.contentType)}</TableCell>
                    <TableCell>
                      {report.reportedUser ? (
                        <div>
                          <p className="font-medium text-sm">{report.reportedUser.firstName} {report.reportedUser.lastName}</p>
                          <p className="text-xs text-muted-foreground">{report.reportedUser.email}</p>
                        </div>
                      ) : report.reportedOrg ? (
                        <div>
                          <p className="font-medium text-sm">{report.reportedOrg.name}</p>
                          <p className="text-xs text-muted-foreground">{report.reportedOrg.email}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="text-sm font-medium">{report.reason}</p>
                        {report.description && (
                          <p className="text-xs text-muted-foreground truncate">{report.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {report.reporter ? (
                        <p className="text-sm">{report.reporter.firstName} {report.reporter.lastName}</p>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {report.status === "PENDING" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => { setSelectedReport(report); setActionDialog("resolve"); }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-green-600" onClick={() => { setSelectedReport(report); setActionDialog("dismiss"); }}>
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {report.status === "RESOLVED" && (
                          <Badge variant="outline" className="text-xs">{report.action}</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {reports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {statusFilter === "PENDING" ? "No pending reports" : "No reports found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">Page {page} of {pagination.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Resolve Dialog */}
        <Dialog open={actionDialog === "resolve"} onOpenChange={() => setActionDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Resolve Report
              </DialogTitle>
              <DialogDescription>
                Review the report and take appropriate action.
              </DialogDescription>
            </DialogHeader>
            
            {selectedReport && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-2">Content Snapshot:</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedReport.contentSnapshot || "No snapshot available"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Action</label>
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warning">Issue Warning</SelectItem>
                      <SelectItem value="content_removed">Remove Content</SelectItem>
                      <SelectItem value="account_suspended">Suspend Account</SelectItem>
                      <SelectItem value="account_banned">Ban Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Resolution Notes</label>
                  <Textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Enter resolution details..."
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
              <Button onClick={handleResolve} disabled={actionLoading || !resolution || !actionType}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Resolve"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dismiss Dialog */}
        <Dialog open={actionDialog === "dismiss"} onOpenChange={() => setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Dismiss Report
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to dismiss this report? No action will be taken.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
              <Button variant="secondary" onClick={handleDismiss} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Dismiss Report"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
