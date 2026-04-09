"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/layout/sidebar-org";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  Clock,
  XCircle,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Filter,
  Users,
  Calendar,
  Plus,
  FileText,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerInfo {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email?: string;
  phone?: string;
  elo: number;
  points: number;
  playerOrgType: string;
  verificationStatus: string;
  city?: string;
  state?: string;
}

interface Contract {
  id: string;
  player: PlayerInfo;
  contractTitle: string;
  contractType: string;
  contractTerms: string;
  startDate: string;
  endDate: string;
  status: string;
  contractDocumentUrl?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  daysRemaining?: number | null;
}

interface Stats {
  pending: number;
  active: number;
  expired: number;
  terminated: number;
}

interface RosterPlayer {
  id: string;
  name: string;
  email: string;
  elo: number;
  playerOrgType: string;
  verificationStatus: string;
}

export default function OrgContractsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, active: 0, expired: 0, terminated: 0 });
  const [statusFilter, setStatusFilter] = useState("PENDING");

  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Create contract form
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayer[]>([]);
  const [formData, setFormData] = useState({
    playerId: "",
    contractTitle: "",
    contractType: "tournament",
    contractTerms: "",
    startDate: "",
    endDate: "",
    contractDocumentUrl: "",
  });

  useEffect(() => {
    fetchContracts();
  }, [statusFilter]);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const url = statusFilter && statusFilter !== "ALL"
        ? `/api/org/contracts?status=${statusFilter}`
        : "/api/org/contracts";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
        setStats(data.stats || { pending: 0, active: 0, expired: 0, terminated: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch contracts:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRosterPlayers = async () => {
    try {
      const response = await fetch("/api/org/roster");
      if (response.ok) {
        const data = await response.json();
        // Filter to only verified employees (not already contracted)
        const eligiblePlayers = (data.roster || []).filter(
          (p: RosterPlayer) => p.verificationStatus === "VERIFIED" && p.playerOrgType === "EMPLOYEE"
        );
        setRosterPlayers(eligiblePlayers);
      }
    } catch (err) {
      console.error("Failed to fetch roster:", err);
    }
  };

  const handleCreateContract = async () => {
    if (!formData.playerId || !formData.contractTitle || !formData.contractType || 
        !formData.contractTerms || !formData.startDate || !formData.endDate) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/org/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create contract");
        return;
      }

      setSuccess("Contract created successfully! It will be reviewed by platform admin.");
      setShowCreateDialog(false);
      setFormData({
        playerId: "",
        contractTitle: "",
        contractType: "tournament",
        contractTerms: "",
        startDate: "",
        endDate: "",
        contractDocumentUrl: "",
      });
      fetchContracts();
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />Pending Admin Review</Badge>;
      case "EXPIRED":
        return <Badge className="bg-gray-100 text-gray-700"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
      case "TERMINATED":
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Terminated</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6 max-w-6xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Player Contracts</h1>
              <p className="text-gray-500">Manage contracts for inter-organization tournaments</p>
            </div>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={() => {
                fetchRosterPlayers();
                setShowCreateDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Contract
            </Button>
          </div>

          {/* Messages */}
          {success && (
            <Alert className="mb-6 bg-emerald-50 border-emerald-200">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">{success}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("PENDING")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                  </div>
                  <Clock className="w-8 h-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("ACTIVE")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Active</p>
                    <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("EXPIRED")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Expired</p>
                    <p className="text-2xl font-bold text-gray-600">{stats.expired}</p>
                  </div>
                  <Clock className="w-8 h-8 text-gray-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("TERMINATED")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Terminated</p>
                    <p className="text-2xl font-bold text-red-600">{stats.terminated}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter */}
          <Card className="bg-white border-gray-100 shadow-sm mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Filter className="w-4 h-4 text-gray-400" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48 border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="TERMINATED">Terminated</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="ALL">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Contracts List */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Contracts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : contracts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No contracts found
                </div>
              ) : (
                <div className="space-y-4">
                  {contracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                          <Briefcase className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{contract.contractTitle}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{contract.player.name}</span>
                            <span>•</span>
                            <span>{contract.contractType}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(contract.startDate).toLocaleDateString()} - {new Date(contract.endDate).toLocaleDateString()}
                            </span>
                            {contract.daysRemaining !== null && contract.daysRemaining !== undefined && (
                              <>
                                <span>•</span>
                                <span className="text-amber-600">{contract.daysRemaining} days remaining</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(contract.status)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedContract(contract);
                            setShowViewDialog(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* View Contract Dialog */}
          <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Contract Details</DialogTitle>
              </DialogHeader>
              
              {selectedContract && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gray-50">
                    <h3 className="font-semibold text-gray-900 mb-2">{selectedContract.contractTitle}</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Player</p>
                        <p className="font-medium">{selectedContract.player.name}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Status</p>
                        {getStatusBadge(selectedContract.status)}
                      </div>
                      <div>
                        <p className="text-gray-500">Type</p>
                        <p className="font-medium capitalize">{selectedContract.contractType}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Duration</p>
                        <p className="font-medium">
                          {new Date(selectedContract.startDate).toLocaleDateString()} - {new Date(selectedContract.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-700">Terms & Conditions</Label>
                    <p className="mt-1 text-gray-600 whitespace-pre-wrap">{selectedContract.contractTerms}</p>
                  </div>

                  {selectedContract.contractDocumentUrl && (
                    <div>
                      <Label className="text-gray-700">Contract Document</Label>
                      <a
                        href={selectedContract.contractDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-2 text-blue-600 hover:text-blue-700"
                      >
                        <FileText className="w-4 h-4" />
                        View Document
                      </a>
                    </div>
                  )}

                  {selectedContract.rejectionReason && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-sm text-red-700">
                        <strong>Rejection Reason:</strong> {selectedContract.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Contract Dialog */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Contract</DialogTitle>
                <DialogDescription>
                  Create a contract for a player to participate in inter-organization tournaments
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-700">Player *</Label>
                  <Select value={formData.playerId} onValueChange={(value) => setFormData(prev => ({ ...prev, playerId: value }))}>
                    <SelectTrigger className="border-gray-200">
                      <SelectValue placeholder="Select a verified employee" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {rosterPlayers.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.name} (ELO: {Math.round(player.elo)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">Contract Title *</Label>
                  <Input
                    value={formData.contractTitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractTitle: e.target.value }))}
                    placeholder="e.g., Inter-Org Tournament Contract 2024"
                    className="border-gray-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">Contract Type *</Label>
                  <Select value={formData.contractType} onValueChange={(value) => setFormData(prev => ({ ...prev, contractType: value }))}>
                    <SelectTrigger className="border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tournament">Tournament</SelectItem>
                      <SelectItem value="seasonal">Seasonal</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700">Start Date *</Label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="border-gray-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">End Date *</Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      className="border-gray-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">Terms & Conditions *</Label>
                  <Textarea
                    value={formData.contractTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractTerms: e.target.value }))}
                    placeholder="Enter the contract terms and conditions..."
                    className="border-gray-200 min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">Contract Document URL (Optional)</Label>
                  <Input
                    type="url"
                    value={formData.contractDocumentUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractDocumentUrl: e.target.value }))}
                    placeholder="URL to signed contract document"
                    className="border-gray-200"
                  />
                </div>
              </div>

              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button
                  className={cn("text-white", primaryBtnClass)}
                  onClick={handleCreateContract}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 mr-2" />
                      Create Contract
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
