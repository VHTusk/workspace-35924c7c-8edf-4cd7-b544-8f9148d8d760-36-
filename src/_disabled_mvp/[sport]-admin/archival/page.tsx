"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Archive,
  Loader2,
  RefreshCw,
  Eye,
  Trash2,
  Calendar,
  Filter,
} from "lucide-react";

interface ArchivedTournament {
  id: string;
  originalId: string;
  name: string;
  type: string;
  scope: string | null;
  location: string;
  startDate: string;
  endDate: string;
  summary: string;
  archivedAt: string;
}

interface ArchivedMatch {
  id: string;
  originalId: string;
  archivedAt: string;
}

interface ArchivalResponse {
  tournaments: ArchivedTournament[];
  matches: ArchivedMatch[];
  stats: {
    totalTournaments: number;
    totalMatches: number;
    oldestArchive: string | null;
  };
}

export default function AdminArchivalPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ArchivalResponse | null>(null);
  const [sportFilter, setSportFilter] = useState("all");
  const [viewType, setViewType] = useState<"tournaments" | "matches">("tournaments");

  useEffect(() => { checkAuth(); }, [sport]);
  useEffect(() => { fetchData(); }, [sport, sportFilter]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth/check");
      if (!response.ok) router.push(`/${sport}/admin/login`);
    } catch { router.push(`/${sport}/admin/login`); }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(sportFilter !== "all" && { sport: sportFilter }),
      });
      const response = await fetch(`/api/admin/archival?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch archival data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString("en-IN");
  const formatDateTime = (date: string) => new Date(date).toLocaleString("en-IN");

  if (loading && !data) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Data Archival</h1>
            <p className="text-muted-foreground mt-1">View and manage archived tournaments and matches</p>
          </div>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Stats */}
        {data?.stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Archived Tournaments</p>
                    <p className="text-2xl font-bold">{data.stats.totalTournaments}</p>
                  </div>
                  <Archive className="w-8 h-8 text-muted-foreground/30" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Archived Matches</p>
                    <p className="text-2xl font-bold">{data.stats.totalMatches}</p>
                  </div>
                  <Archive className="w-8 h-8 text-muted-foreground/30" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Oldest Archive</p>
                    <p className="text-lg font-bold">
                      {data.stats.oldestArchive ? formatDate(data.stats.oldestArchive) : "N/A"}
                    </p>
                  </div>
                  <Calendar className="w-8 h-8 text-muted-foreground/30" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <Select value={viewType} onValueChange={(v) => setViewType(v as "tournaments" | "matches")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tournaments">Tournaments</SelectItem>
              <SelectItem value="matches">Matches</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger className="w-32">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              <SelectItem value="CORNHOLE">Cornhole</SelectItem>
              <SelectItem value="DARTS">Darts</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tournaments Table */}
        {viewType === "tournaments" && data?.tournaments && (
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tournament Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Archived On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tournaments.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{t.originalId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.type}</Badge>
                      </TableCell>
                      <TableCell>{t.scope || "-"}</TableCell>
                      <TableCell className="text-sm">{t.location}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(t.startDate)} - {formatDate(t.endDate)}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(t.archivedAt)}</TableCell>
                    </TableRow>
                  ))}
                  {data.tournaments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No archived tournaments
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Matches Table */}
        {viewType === "matches" && data?.matches && (
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match ID</TableHead>
                    <TableHead>Original ID</TableHead>
                    <TableHead>Archived On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.matches.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-sm">{m.id}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{m.originalId}</TableCell>
                      <TableCell className="text-sm">{formatDateTime(m.archivedAt)}</TableCell>
                    </TableRow>
                  ))}
                  {data.matches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No archived matches
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="bg-gradient-card border-border/50 mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Data Retention Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>• Completed tournaments are archived after 1 year</p>
              <p>• Match data is archived after 2 years</p>
              <p>• User data is retained for 7 years for legal compliance</p>
              <p>• Archived data can be restored upon request</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
