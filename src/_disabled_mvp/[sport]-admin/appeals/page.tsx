"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  AlertCircle, CheckCircle, Clock, FileText, RefreshCw, ArrowLeft, Eye,
  AlertTriangle, XCircle, Loader2, Search, Filter
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AppealStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ESCALATED';
type AppealType = 'ACCOUNT_SUSPENSION' | 'TOURNAMENT_DISPUTE' | 'MATCH_RESULT' | 'RANKING_DISPUTE' | 'BAN_APPEAL' | 'OTHER';

interface Appeal {
  id: string;
  type: AppealType;
  status: AppealStatus;
  reason: string;
  evidence?: string;
  relatedId?: string;
  priority: number;
  submittedAt: string;
  reviewedAt?: string;
  resolution?: string;
  resolutionType?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
}

const STATUS_CONFIG: Record<AppealStatus, { label: string; color: string; bgClass: string }> = {
  PENDING: { label: "Pending", color: "text-amber-600", bgClass: "bg-amber-100 dark:bg-amber-900/30" },
  UNDER_REVIEW: { label: "Under Review", color: "text-blue-600", bgClass: "bg-blue-100 dark:bg-blue-900/30" },
  APPROVED: { label: "Approved", color: "text-green-600", bgClass: "bg-green-100 dark:bg-green-900/30" },
  REJECTED: { label: "Rejected", color: "text-red-600", bgClass: "bg-red-100 dark:bg-red-900/30" },
  ESCALATED: { label: "Escalated", color: "text-purple-600", bgClass: "bg-purple-100 dark:bg-purple-900/30" },
};

const TYPE_CONFIG: Record<AppealType, string> = {
  ACCOUNT_SUSPENSION: "Account Suspension",
  TOURNAMENT_DISPUTE: "Tournament Dispute",
  MATCH_RESULT: "Match Result",
  RANKING_DISPUTE: "Ranking Dispute",
  BAN_APPEAL: "Ban Appeal",
  OTHER: "Other",
};

export default function AdminAppealsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0, underReview: 0, approved: 0, rejected: 0, escalated: 0
  });
  const [filters, setFilters] = useState({ status: "", type: "", search: "" });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchAppeals();
  }, [page, filters.status, filters.type]);

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.set("status", filters.status);
      if (filters.type) queryParams.set("type", filters.type);
      queryParams.set("page", page.toString());
      queryParams.set("limit", "15");

      const response = await fetch(`/api/admin/appeals?${queryParams.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setAppeals(data.appeals);
        setTotalPages(data.pagination.totalPages);
        setStats(data.stats);
      } else {
        toast.error("Failed to fetch appeals");
      }
    } catch (error) {
      console.error("Error fetching appeals:", error);
      toast.error("Failed to fetch appeals");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAppeals();
    setRefreshing(false);
    toast.success("Appeals refreshed");
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleViewAppeal = (appeal: Appeal) => {
    setSelectedAppeal(appeal);
    setShowDetailDialog(true);
  };

  const handleUpdateStatus = async (newStatus: AppealStatus) => {
    if (!selectedAppeal) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/appeals/${selectedAppeal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success(`Appeal marked as ${newStatus}`);
        setShowDetailDialog(false);
        fetchAppeals();
      } else {
        toast.error("Failed to update appeal");
      }
    } catch (error) {
      toast.error("Failed to update appeal");
    } finally {
      setSaving(false);
    }
  };

  const handleResolveAppeal = async (resolutionType: "APPROVED" | "REJECTED") => {
    if (!selectedAppeal) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/appeals/${selectedAppeal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: resolutionType === "APPROVED" ? "APPROVED" : "REJECTED",
          resolution: resolutionNotes,
          resolutionType,
        }),
      });

      if (response.ok) {
        toast.success(`Appeal ${resolutionType.toLowerCase()}`);
        setShowResolveDialog(false);
        setShowDetailDialog(false);
        setResolutionNotes("");
        fetchAppeals();
      } else {
        toast.error("Failed to resolve appeal");
      }
    } catch (error) {
      toast.error("Failed to resolve appeal");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: AppealStatus) => {
    const config = STATUS_CONFIG[status];
    return (
      <Badge className={cn("text-xs", config.bgClass, config.color)}>
        {config.label}
      </Badge>
    );
  };

  const getTypeBadge = (type: AppealType) => {
    return <Badge variant="outline" className="text-xs">{TYPE_CONFIG[type]}</Badge>;
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) return <Badge className="bg-red-100 text-red-700 text-xs">Critical</Badge>;
    if (priority >= 5) return <Badge className="bg-amber-100 text-amber-700 text-xs">High</Badge>;
    if (priority >= 3) return <Badge className="bg-blue-100 text-blue-700 text-xs">Medium</Badge>;
    return <Badge className="bg-gray-100 text-gray-700 text-xs">Low</Badge>;
  };

  return (
    <div className="bg-background min-h-screen">
      <Sidebar userType="admin" />
      <main className="ml-0 md:ml-72 min-h-screen">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Appeals Management</h1>
              <p className="text-muted-foreground">Review and resolve user appeals</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                Refresh
              </Button>
              <Button className={cn("text-white", primaryBtnClass)} onClick={() => router.push(`/${sport}/admin`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
                    <p className="text-xs text-amber-600">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{stats.underReview}</p>
                    <p className="text-xs text-blue-600">Under Review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
                    <p className="text-xs text-green-600">Approved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
                    <p className="text-xs text-red-600">Rejected</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold text-purple-700">{stats.escalated}</p>
                    <p className="text-xs text-purple-600">Escalated</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-card border-border mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={filters.status} onValueChange={(v) => handleFilterChange("status", v)}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All statuses</SelectItem>
                      {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Select value={filters.type} onValueChange={(v) => handleFilterChange("type", v)}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All types</SelectItem>
                      {Object.entries(TYPE_CONFIG).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={() => { setFilters({ status: "", type: "", search: "" }); setPage(1); }}>
                  <Filter className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Appeals List */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle>Appeals ({appeals.length})</CardTitle>
              <CardDescription>Click on an appeal to view details</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : appeals.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No appeals found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {appeals.map((appeal) => (
                    <div
                      key={appeal.id}
                      className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleViewAppeal(appeal)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {getTypeBadge(appeal.type)}
                            {getPriorityBadge(appeal.priority)}
                            {getStatusBadge(appeal.status)}
                          </div>
                          <p className="font-medium text-foreground mb-1">
                            {appeal.user.firstName} {appeal.user.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {appeal.reason.slice(0, 100)}{appeal.reason.length > 100 ? "..." : ""}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {appeal.user.email}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(appeal.submittedAt), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Appeal Details
            </DialogTitle>
            <DialogDescription>Review and resolve this appeal</DialogDescription>
          </DialogHeader>
          {selectedAppeal && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Submitted By</Label>
                  <p className="font-medium mt-1">{selectedAppeal.user.firstName} {selectedAppeal.user.lastName}</p>
                  <p className="text-sm text-muted-foreground">{selectedAppeal.user.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Type / Priority</Label>
                  <div className="flex gap-2 mt-1">
                    {getTypeBadge(selectedAppeal.type)}
                    {getPriorityBadge(selectedAppeal.priority)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Label className="text-xs text-muted-foreground">Status</Label>
                {getStatusBadge(selectedAppeal.status)}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Reason</Label>
                <p className="text-sm mt-1 bg-muted/30 p-3 rounded-lg">{selectedAppeal.reason}</p>
              </div>
              {selectedAppeal.evidence && (
                <div>
                  <Label className="text-xs text-muted-foreground">Evidence</Label>
                  <a href={selectedAppeal.evidence} target="_blank" rel="noopener noreferrer" className={cn("text-sm underline mt-1 block", primaryTextClass)}>
                    View Evidence
                  </a>
                </div>
              )}
              {selectedAppeal.relatedId && (
                <div>
                  <Label className="text-xs text-muted-foreground">Related Entity ID</Label>
                  <p className="text-sm mt-1 font-mono">{selectedAppeal.relatedId}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Submitted</Label>
                <p className="text-sm mt-1">{format(new Date(selectedAppeal.submittedAt), "PPP")}</p>
              </div>
              
              {selectedAppeal.status !== "PENDING" && selectedAppeal.resolution && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Resolution</h4>
                  <p className="text-sm">{selectedAppeal.resolution}</p>
                  {selectedAppeal.resolutionType && (
                    <Badge className="mt-2">{selectedAppeal.resolutionType}</Badge>
                  )}
                </div>
              )}

              {selectedAppeal.status === "PENDING" && (
                <div className="border-t pt-4 flex flex-wrap justify-end gap-3">
                  <Button variant="outline" onClick={() => handleUpdateStatus("UNDER_REVIEW")} disabled={saving}>
                    <Eye className="h-4 w-4 mr-2" />
                    Start Review
                  </Button>
                  <Button variant="outline" onClick={() => handleUpdateStatus("ESCALATED")} disabled={saving}>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Escalate
                  </Button>
                  <Button className={cn("text-white", primaryBtnClass)} onClick={() => setShowResolveDialog(true)} disabled={saving}>
                    Resolve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Appeal</DialogTitle>
            <DialogDescription>Choose resolution type and provide notes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-3">
              <Button className={cn("flex-1", primaryBtnClass, "text-white")} onClick={() => setSelectedAppeal(prev => prev ? { ...prev, resolutionType: "APPROVED" } : null)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => setSelectedAppeal(prev => prev ? { ...prev, resolutionType: "REJECTED" } : null)}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
            <div>
              <Label>Resolution Notes</Label>
              <Textarea
                placeholder="Enter resolution notes..."
                className="min-h-[100px] mt-1"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(false)}>Cancel</Button>
            <Button className={cn("text-white", primaryBtnClass)} onClick={() => handleResolveAppeal(selectedAppeal?.resolutionType as "APPROVED" | "REJECTED" || "APPROVED")} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirm Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
