"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Trophy,
  DollarSign,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Plus,
  Trash2,
  Search,
  Filter,
  Banknote,
  CreditCard,
  Wallet,
  Building2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PrizeDistribution {
  id: string;
  position: number;
  percentage: number;
  amount: number;
  description: string | null;
  isMonetary: boolean;
}

interface Payout {
  id: string;
  tournamentId: string;
  userId: string | null;
  teamId: string | null;
  position: number;
  amount: number;
  status: string;
  payoutMethod: string | null;
  transactionRef: string | null;
  paidAt: string | null;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  } | null;
  team?: {
    name: string;
  } | null;
  tournament?: {
    name: string;
    sport: string;
    prizePool: number;
  };
}

interface Tournament {
  id: string;
  name: string;
  prizePool: number;
  status: string;
}

interface PayoutSummary {
  totalAmount: number;
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  PROCESSING: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  FAILED: "bg-red-500/10 text-red-400 border-red-500/30",
  CANCELLED: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="w-3 h-3" />,
  PROCESSING: <RefreshCw className="w-3 h-3" />,
  COMPLETED: <CheckCircle className="w-3 h-3" />,
  FAILED: <XCircle className="w-3 h-3" />,
  CANCELLED: <AlertCircle className="w-3 h-3" />,
};

const PAYOUT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank Transfer", icon: <Building2 className="w-4 h-4" /> },
  { value: "UPI", label: "UPI", icon: <Wallet className="w-4 h-4" /> },
  { value: "CHEQUE", label: "Cheque", icon: <CreditCard className="w-4 h-4" /> },
  { value: "CASH", label: "Cash", icon: <Banknote className="w-4 h-4" /> },
];

export default function AdminPrizesPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  // State
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [totalPayouts, setTotalPayouts] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;

  // Distribution config state
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [distributions, setDistributions] = useState<PrizeDistribution[]>([]);
  const [showDistributionDialog, setShowDistributionDialog] = useState(false);

  // Update payout dialog
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [updateMethod, setUpdateMethod] = useState<string>("");
  const [updateRef, setUpdateRef] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // New distribution form
  const [newPosition, setNewPosition] = useState(1);
  const [newPercentage, setNewPercentage] = useState(0);
  const [newDescription, setNewDescription] = useState("");
  const [newIsMonetary, setNewIsMonetary] = useState(true);

  useEffect(() => {
    checkAuth();
    fetchPayouts();
    fetchTournaments();
  }, [sport]);

  useEffect(() => {
    fetchPayouts();
  }, [statusFilter, currentPage]);

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

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("limit", String(pageSize));
      params.append("offset", String(currentPage * pageSize));
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (sport) {
        params.append("sport", sport.toUpperCase());
      }

      const response = await fetch(`/api/admin/prizes/payouts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPayouts(data.data || []);
        setTotalPayouts(data.pagination?.total || 0);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error("Failed to fetch payouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTournaments = async () => {
    try {
      const response = await fetch(`/api/admin/tournaments?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setTournaments(data.tournaments || []);
      }
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
    }
  };

  const fetchDistribution = async (tournamentId: string) => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/prizes?include=distribution`);
      if (response.ok) {
        const data = await response.json();
        setDistributions(data.distribution || []);
      }
    } catch (error) {
      console.error("Failed to fetch distribution:", error);
    }
  };

  const handleTournamentSelect = (tournamentId: string) => {
    setSelectedTournament(tournamentId);
    if (tournamentId) {
      fetchDistribution(tournamentId);
    } else {
      setDistributions([]);
    }
  };

  const handleAddDistribution = () => {
    const totalPercentage = distributions.reduce((sum, d) => sum + d.percentage, 0) + newPercentage;
    if (totalPercentage > 100) {
      alert("Total percentage cannot exceed 100%");
      return;
    }

    setDistributions([
      ...distributions,
      {
        id: `temp-${Date.now()}`,
        position: newPosition,
        percentage: newPercentage,
        amount: 0,
        description: newDescription,
        isMonetary: newIsMonetary,
      },
    ]);

    // Reset form
    setNewPosition(distributions.length + 2);
    setNewPercentage(0);
    setNewDescription("");
    setNewIsMonetary(true);
  };

  const handleRemoveDistribution = (position: number) => {
    setDistributions(distributions.filter((d) => d.position !== position));
  };

  const handleSaveDistribution = async () => {
    if (!selectedTournament) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/tournaments/${selectedTournament}/prizes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distributions }),
      });

      if (response.ok) {
        setShowDistributionDialog(false);
        fetchDistribution(selectedTournament);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save distribution");
      }
    } catch (error) {
      console.error("Failed to save distribution:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyTemplate = (template: string) => {
    let templateDistributions: { position: number; percentage: number; description: string }[] = [];

    switch (template) {
      case "default":
        templateDistributions = [
          { position: 1, percentage: 50, description: "Winner" },
          { position: 2, percentage: 30, description: "Runner-up" },
          { position: 3, percentage: 20, description: "Third Place" },
        ];
        break;
      case "NATIONAL":
        templateDistributions = [
          { position: 1, percentage: 35, description: "National Champion" },
          { position: 2, percentage: 25, description: "Runner-up" },
          { position: 3, percentage: 15, description: "Third Place" },
          { position: 4, percentage: 10, description: "Fourth Place" },
          { position: 5, percentage: 5, description: "Quarter-finalist" },
          { position: 6, percentage: 5, description: "Quarter-finalist" },
          { position: 7, percentage: 3, description: "Quarter-finalist" },
          { position: 8, percentage: 2, description: "Quarter-finalist" },
        ];
        break;
      case "STATE":
        templateDistributions = [
          { position: 1, percentage: 45, description: "State Champion" },
          { position: 2, percentage: 30, description: "Runner-up" },
          { position: 3, percentage: 15, description: "Third Place" },
          { position: 4, percentage: 10, description: "Fourth Place" },
        ];
        break;
      default:
        return;
    }

    setDistributions(
      templateDistributions.map((d) => ({
        id: `temp-${d.position}`,
        ...d,
        amount: 0,
        isMonetary: true,
      }))
    );
  };

  const handleUpdatePayout = async () => {
    if (!selectedPayout || !updateStatus) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/prizes/payouts/${selectedPayout.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: updateStatus,
          payoutMethod: updateMethod,
          transactionRef: updateRef,
        }),
      });

      if (response.ok) {
        setShowUpdateDialog(false);
        fetchPayouts();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update payout");
      }
    } catch (error) {
      console.error("Failed to update payout:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCsv = async (tournamentId: string) => {
    try {
      const response = await fetch(`/api/admin/prizes/payouts?export=csv&tournamentId=${tournamentId}`);
      if (response.ok) {
        const csv = await response.text();
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payouts-${tournamentId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to export CSV:", error);
    }
  };

  const openUpdateDialog = (payout: Payout) => {
    setSelectedPayout(payout);
    setUpdateStatus(payout.status);
    setUpdateMethod(payout.payoutMethod || "");
    setUpdateRef(payout.transactionRef || "");
    setShowUpdateDialog(true);
  };

  const filteredPayouts = payouts.filter((payout) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const name = payout.user
      ? `${payout.user.firstName} ${payout.user.lastName}`.toLowerCase()
      : payout.team?.name?.toLowerCase() || "";
    const tournamentName = payout.tournament?.name?.toLowerCase() || "";
    return name.includes(searchLower) || tournamentName.includes(searchLower);
  });

  const totalPages = Math.ceil(totalPayouts / pageSize);

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-400" />
              Prize Pool Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure prize distributions and track payouts
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-4 text-center">
                <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-xl font-bold text-foreground">
                  ₹{(summary.totalAmount / 1000).toFixed(1)}K
                </p>
                <p className="text-xs text-muted-foreground">Total Amount</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-4 text-center">
                <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <p className="text-xl font-bold text-foreground">{summary.pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-4 text-center">
                <RefreshCw className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                <p className="text-xl font-bold text-foreground">{summary.processingCount}</p>
                <p className="text-xs text-muted-foreground">Processing</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <p className="text-xl font-bold text-foreground">{summary.completedCount}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-4 text-center">
                <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-xl font-bold text-foreground">{summary.failedCount}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-4 text-center">
                <AlertCircle className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-xl font-bold text-foreground">{summary.cancelledCount}</p>
                <p className="text-xs text-muted-foreground">Cancelled</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="payouts" className="space-y-6">
          <TabsList>
            <TabsTrigger value="payouts" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Payout Tracking
            </TabsTrigger>
            <TabsTrigger value="distribution" className="gap-2">
              <Trophy className="w-4 h-4" />
              Distribution Config
            </TabsTrigger>
          </TabsList>

          {/* Payouts Tab */}
          <TabsContent value="payouts">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle>Payout Records</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-48"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="PROCESSING">Processing</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="FAILED">Failed</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : filteredPayouts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No payouts found</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border border-border/50 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Position</TableHead>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Tournament</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Paid At</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPayouts.map((payout) => (
                            <TableRow key={payout.id}>
                              <TableCell>
                                <Badge variant="outline" className="font-mono">
                                  #{payout.position}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">
                                    {payout.user
                                      ? `${payout.user.firstName} ${payout.user.lastName}`
                                      : payout.team?.name || "Unknown"}
                                  </p>
                                  {payout.user?.email && (
                                    <p className="text-xs text-muted-foreground">{payout.user.email}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{payout.tournament?.name || "N/A"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Pool: ₹{payout.tournament?.prizePool?.toLocaleString() || 0}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                ₹{payout.amount.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge className={STATUS_COLORS[payout.status]}>
                                  {STATUS_ICONS[payout.status]}
                                  <span className="ml-1">{payout.status}</span>
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {payout.payoutMethod ? (
                                  <span className="text-sm">{payout.payoutMethod}</span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">Not set</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {payout.paidAt ? new Date(payout.paidAt).toLocaleDateString() : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openUpdateDialog(payout)}
                                  disabled={payout.status === "COMPLETED"}
                                >
                                  Update
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                          Showing {currentPage * pageSize + 1} -{" "}
                          {Math.min((currentPage + 1) * pageSize, totalPayouts)} of {totalPayouts}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                            disabled={currentPage === 0}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={currentPage >= totalPages - 1}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Distribution Config Tab */}
          <TabsContent value="distribution">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Prize Distribution Configuration</CardTitle>
                <CardDescription>
                  Configure how prize pools are distributed for tournaments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Tournament Selector */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <Label>Select Tournament</Label>
                      <Select value={selectedTournament} onValueChange={handleTournamentSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a tournament..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tournaments
                            .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
                            .map((tournament) => (
                              <SelectItem key={tournament.id} value={tournament.id}>
                                {tournament.name} (₹{tournament.prizePool.toLocaleString()})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedTournament && (
                      <div className="flex items-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowDistributionDialog(true)}
                          className="gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Configure Distribution
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleExportCsv(selectedTournament)}
                          className="gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Export CSV
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Distribution Display */}
                  {selectedTournament && distributions.length > 0 && (
                    <div className="rounded-lg border border-border/50 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Position</TableHead>
                            <TableHead>Percentage</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {distributions.map((d) => (
                            <TableRow key={d.id}>
                              <TableCell>
                                <Badge variant="outline">#{d.position}</Badge>
                              </TableCell>
                              <TableCell>{d.percentage}%</TableCell>
                              <TableCell>{d.description || "-"}</TableCell>
                              <TableCell>
                                <Badge className={d.isMonetary ? "bg-green-500/10 text-green-400" : "bg-purple-500/10 text-purple-400"}>
                                  {d.isMonetary ? "Monetary" : "Non-monetary"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {selectedTournament && distributions.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-lg">
                      <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No distribution configured</p>
                      <p className="text-sm">Click "Configure Distribution" to set up prize distribution</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Distribution Dialog */}
        <Dialog open={showDistributionDialog} onOpenChange={setShowDistributionDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Configure Prize Distribution</DialogTitle>
              <DialogDescription>
                Set up how the prize pool will be distributed among winners
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Quick Templates */}
              <div>
                <Label className="text-sm font-medium">Quick Templates</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={() => handleApplyTemplate("default")}>
                    Default (50/30/20)
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleApplyTemplate("NATIONAL")}>
                    National (8 positions)
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleApplyTemplate("STATE")}>
                    State (4 positions)
                  </Button>
                </div>
              </div>

              {/* Add New Distribution */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Position</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newPosition}
                    onChange={(e) => setNewPosition(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Percentage (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={newPercentage}
                    onChange={(e) => setNewPercentage(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="e.g., Winner"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddDistribution} size="sm" className="w-full">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Current Distributions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Current Distribution</Label>
                  <span className="text-sm text-muted-foreground">
                    Total: {distributions.reduce((sum, d) => sum + d.percentage, 0)}%
                  </span>
                </div>
                <ScrollArea className="h-48 rounded-lg border border-border/50">
                  <div className="p-4 space-y-2">
                    {distributions.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No distributions added</p>
                    ) : (
                      distributions.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between p-2 rounded bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">#{d.position}</Badge>
                            <span>{d.percentage}%</span>
                            <span className="text-muted-foreground text-sm">
                              {d.description || "No description"}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveDistribution(d.position)}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDistributionDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveDistribution} disabled={actionLoading}>
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Save Distribution"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Update Payout Dialog */}
        <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Payout Status</DialogTitle>
              <DialogDescription>
                Update the status and payment details for this payout
              </DialogDescription>
            </DialogHeader>

            {selectedPayout && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Recipient:</span>{" "}
                    {selectedPayout.user
                      ? `${selectedPayout.user.firstName} ${selectedPayout.user.lastName}`
                      : selectedPayout.team?.name}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Amount:</span> ₹
                    {selectedPayout.amount.toLocaleString()}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Position:</span> #{selectedPayout.position}
                  </p>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={updateStatus} onValueChange={setUpdateStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="PROCESSING">Processing</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Payout Method</Label>
                  <Select value={updateMethod} onValueChange={setUpdateMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYOUT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          <span className="flex items-center gap-2">
                            {method.icon}
                            {method.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Transaction Reference</Label>
                  <Input
                    value={updateRef}
                    onChange={(e) => setUpdateRef(e.target.value)}
                    placeholder="e.g., UTR123456789"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePayout} disabled={actionLoading}>
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Update Payout"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
