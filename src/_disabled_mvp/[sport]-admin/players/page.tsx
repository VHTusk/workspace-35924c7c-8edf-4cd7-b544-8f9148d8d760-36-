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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Search,
  Loader2,
  MoreHorizontal,
  UserX,
  ShieldAlert,
  TrendingUp,
  Eye,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  elo: number;
  visiblePoints: number;
  matchesPlayed: number;
  isActive: boolean;
  verified: boolean;
  createdAt: string;
  organization?: { name: string } | null;
  subscription?: { status: string; endDate: string } | null;
}

interface PlayersResponse {
  players: Player[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminPlayersPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [actionDialog, setActionDialog] = useState<"ban" | "adjust-elo" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [eloAdjustment, setEloAdjustment] = useState("");
  const [banReason, setBanReason] = useState("");

  useEffect(() => { checkAuth(); }, [sport]);
  useEffect(() => { fetchPlayers(); }, [sport, page, statusFilter]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth/check");
      if (!response.ok) router.push(`/${sport}/admin/login`);
    } catch { router.push(`/${sport}/admin/login`); }
  };

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sport: sport.toUpperCase(),
        page: page.toString(),
        limit: "20",
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(search && { search }),
      });
      const response = await fetch(`/api/admin/players?${params}`);
      if (response.ok) {
        const data: PlayersResponse = await response.json();
        setPlayers(data.players);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch players:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchPlayers();
  };

  const handleBan = async () => {
    if (!selectedPlayer) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/players/${selectedPlayer.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: banReason, banned: !selectedPlayer.isActive }),
      });
      if (response.ok) {
        fetchPlayers();
        setActionDialog(null);
        setSelectedPlayer(null);
        setBanReason("");
      }
    } catch (error) {
      console.error("Failed to ban player:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustElo = async () => {
    if (!selectedPlayer || !eloAdjustment) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/players/${selectedPlayer.id}/adjust-elo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustment: parseInt(eloAdjustment) }),
      });
      if (response.ok) {
        fetchPlayers();
        setActionDialog(null);
        setSelectedPlayer(null);
        setEloAdjustment("");
      }
    } catch (error) {
      console.error("Failed to adjust ELO:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString("en-IN");

  if (loading && players.length === 0) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Player Management</h1>
            <p className="text-muted-foreground mt-1">Manage all registered players</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Users className="w-4 h-4 mr-1" />
              {pagination.total.toLocaleString()} total
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch}><Search className="w-4 h-4" /></Button>
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="banned">Banned</SelectItem>
                  <SelectItem value="subscribed">Subscribed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Players Table */}
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>ELO</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{player.firstName} {player.lastName}</p>
                        <p className="text-xs text-muted-foreground">{player.email}</p>
                        {player.organization && (
                          <Badge variant="outline" className="text-xs mt-1">{player.organization.name}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{player.city || "-"}, {player.state || "-"}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono">{player.elo}</span>
                        <Badge variant="outline" className="text-xs">{player.visiblePoints} pts</Badge>
                      </div>
                    </TableCell>
                    <TableCell>{player.matchesPlayed}</TableCell>
                    <TableCell>
                      <Badge className={player.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}>
                        {player.isActive ? "Active" : "Banned"}
                      </Badge>
                      {player.verified && (
                        <Badge className="bg-blue-500/10 text-blue-400 ml-1">Verified</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {player.subscription ? (
                        <Badge className={player.subscription.status === "ACTIVE" ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}>
                          {player.subscription.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(player.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/${sport}/players/${player.id}`)}>
                            <Eye className="w-4 h-4 mr-2" /> View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedPlayer(player); setActionDialog("adjust-elo"); }}>
                            <TrendingUp className="w-4 h-4 mr-2" /> Adjust ELO
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedPlayer(player); setActionDialog("ban"); }} className="text-red-600">
                            <UserX className="w-4 h-4 mr-2" /> {player.isActive ? "Ban Player" : "Unban Player"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {players.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No players found
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

        {/* Ban Dialog */}
        <Dialog open={actionDialog === "ban"} onOpenChange={() => setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                {selectedPlayer?.isActive ? "Ban Player" : "Unban Player"}
              </DialogTitle>
              <DialogDescription>
                {selectedPlayer?.isActive
                  ? `Are you sure you want to ban ${selectedPlayer.firstName} ${selectedPlayer.lastName}? They will not be able to access the platform.`
                  : `Are you sure you want to unban ${selectedPlayer?.firstName} ${selectedPlayer?.lastName}?`}
              </DialogDescription>
            </DialogHeader>
            {selectedPlayer?.isActive && (
              <div className="py-4">
                <label className="text-sm font-medium">Reason for ban</label>
                <Input
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Enter reason..."
                  className="mt-2"
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleBan} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : selectedPlayer?.isActive ? "Ban" : "Unban"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ELO Adjustment Dialog */}
        <Dialog open={actionDialog === "adjust-elo"} onOpenChange={() => setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Adjust ELO Rating
              </DialogTitle>
              <DialogDescription>
                Current ELO: <span className="font-mono font-bold">{selectedPlayer?.elo}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium">ELO Adjustment (+/-)</label>
              <Input
                type="number"
                value={eloAdjustment}
                onChange={(e) => setEloAdjustment(e.target.value)}
                placeholder="e.g., 50 or -50"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                New ELO will be: <span className="font-mono">{(selectedPlayer?.elo || 0) + (parseInt(eloAdjustment) || 0)}</span>
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
              <Button onClick={handleAdjustElo} disabled={actionLoading || !eloAdjustment}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply Adjustment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
