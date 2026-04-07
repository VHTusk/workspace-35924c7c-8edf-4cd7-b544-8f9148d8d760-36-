"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Webhook,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

interface WebhookStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  deadLetter: number;
  avgProcessingTime: number;
}

interface WebhookEvent {
  id: string;
  provider: string;
  eventType: string;
  eventId: string;
  status: string;
  attemptCount: number;
  nextRetryAt: string | null;
  lastError: string | null;
  processedAt: string | null;
  createdAt: string;
}

interface WebhookResponse {
  stats: WebhookStats;
  events: WebhookEvent[];
}

export default function AdminWebhooksPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => { checkAuth(); }, [sport]);
  useEffect(() => { fetchStats(); }, [sport, statusFilter]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth/check");
      if (!response.ok) router.push(`/${sport}/admin/login`);
    } catch { router.push(`/${sport}/admin/login`); }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(statusFilter !== "all" && { status: statusFilter }),
      });
      const response = await fetch(`/api/admin/webhook-stats?${params}`);
      if (response.ok) {
        const data: WebhookResponse = await response.json();
        setStats(data.stats);
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error("Failed to fetch webhook stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "FAILED": return <XCircle className="w-4 h-4 text-red-500" />;
      case "DEAD_LETTER": return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "RETRYING": return <RotateCcw className="w-4 h-4 text-amber-500" />;
      case "PROCESSING": return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-gray-500/10 text-gray-400",
      PROCESSING: "bg-blue-500/10 text-blue-400",
      COMPLETED: "bg-green-500/10 text-green-400",
      FAILED: "bg-red-500/10 text-red-400",
      RETRYING: "bg-amber-500/10 text-amber-400",
      DEAD_LETTER: "bg-red-600/10 text-red-500",
    };
    return <Badge className={colors[status] || "bg-gray-500/10 text-gray-400"}>{status}</Badge>;
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  if (loading && !stats) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Webhook Monitoring</h1>
            <p className="text-muted-foreground mt-1">Track webhook processing and retry status</p>
          </div>
          <Button variant="outline" onClick={fetchStats}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Pending", value: stats.pending, color: "text-gray-400" },
              { label: "Processing", value: stats.processing, color: "text-blue-400" },
              { label: "Completed", value: stats.completed, color: "text-green-400" },
              { label: "Failed", value: stats.failed, color: "text-red-400" },
              { label: "Retrying", value: stats.retrying, color: "text-amber-400" },
              { label: "Dead Letter", value: stats.deadLetter, color: "text-red-500" },
            ].map((stat) => (
              <Card key={stat.label} className="bg-gradient-card border-border/50">
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Average Processing Time */}
        {stats && (
          <Card className="bg-gradient-card border-border/50 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Average Processing Time</span>
                </div>
                <span className="text-lg font-bold">{stats.avgProcessingTime.toFixed(0)}ms</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm font-medium">Filter by Status:</span>
          <div className="flex flex-wrap gap-2">
            {["all", "PENDING", "PROCESSING", "COMPLETED", "FAILED", "RETRYING", "DEAD_LETTER"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? "All" : status}
              </Button>
            ))}
          </div>
        </div>

        {/* Events Table */}
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Event ID</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Next Retry</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(event.status)}
                        {getStatusBadge(event.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{event.provider}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{event.eventType}</TableCell>
                    <TableCell className="font-mono text-xs">{event.eventId.slice(0, 16)}...</TableCell>
                    <TableCell className="text-center">{event.attemptCount}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(event.nextRetryAt)}</TableCell>
                    <TableCell className="text-xs text-red-400 max-w-xs truncate">
                      {event.lastError || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{formatDateTime(event.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No webhook events found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
