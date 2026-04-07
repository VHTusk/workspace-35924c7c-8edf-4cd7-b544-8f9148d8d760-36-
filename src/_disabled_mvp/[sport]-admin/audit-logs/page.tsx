"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Search,
  Loader2,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Settings,
  Trophy,
  Shield,
  DollarSign,
  AlertCircle,
} from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor?: { id: string; name: string; email: string } | null;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminAuditLogsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

  useEffect(() => { checkAuth(); }, [sport]);
  useEffect(() => { fetchLogs(); }, [sport, page, actionFilter]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth/check");
      if (!response.ok) router.push(`/${sport}/admin/login`);
    } catch { router.push(`/${sport}/admin/login`); }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        ...(actionFilter !== "all" && { action: actionFilter }),
        ...(search && { search }),
      });
      const response = await fetch(`/api/admin/audit-logs?${params}`);
      if (response.ok) {
        const data: AuditLogsResponse = await response.json();
        setLogs(data.logs);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getActionIcon = (action: string) => {
    if (action.includes("LOGIN") || action.includes("LOGOUT")) return <User className="w-4 h-4" />;
    if (action.includes("TOURNAMENT")) return <Trophy className="w-4 h-4" />;
    if (action.includes("PLAYER") || action.includes("USER")) return <User className="w-4 h-4" />;
    if (action.includes("PAYMENT") || action.includes("REFUND")) return <DollarSign className="w-4 h-4" />;
    if (action.includes("BAN") || action.includes("SUSPEND")) return <Shield className="w-4 h-4" />;
    if (action.includes("SETTING")) return <Settings className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const getActionBadge = (action: string) => {
    if (action.includes("CREATE") || action.includes("APPROVE")) {
      return <Badge className="bg-green-500/10 text-green-400">{action}</Badge>;
    }
    if (action.includes("DELETE") || action.includes("BAN") || action.includes("SUSPEND")) {
      return <Badge className="bg-red-500/10 text-red-400">{action}</Badge>;
    }
    if (action.includes("UPDATE") || action.includes("EDIT")) {
      return <Badge className="bg-amber-500/10 text-amber-400">{action}</Badge>;
    }
    if (action.includes("LOGIN") || action.includes("LOGOUT")) {
      return <Badge className="bg-blue-500/10 text-blue-400">{action}</Badge>;
    }
    return <Badge variant="outline">{action}</Badge>;
  };

  if (loading && logs.length === 0) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
            <p className="text-muted-foreground mt-1">Track all administrative actions</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <FileText className="w-4 h-4 mr-1" />
              {pagination.total.toLocaleString()} total logs
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Search by action, actor, or target..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch}><Search className="w-4 h-4" /></Button>
              </div>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                <SelectTrigger className="w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="LOGIN">Login/Logout</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="BAN">Ban/Suspend</SelectItem>
                  <SelectItem value="APPROVE">Approve</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        {getActionBadge(log.action)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.actor ? (
                        <div>
                          <p className="font-medium text-sm">{log.actor.name}</p>
                          <p className="text-xs text-muted-foreground">{log.actor.email}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{log.targetType || "-"}</p>
                        {log.targetId && (
                          <p className="text-xs text-muted-foreground font-mono">{log.targetId.slice(0, 8)}...</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground max-w-xs truncate">
                        {log.details || "-"}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.ipAddress || "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No audit logs found
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
      </div>
    </div>
  );
}
