"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/layout/sidebar-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Building2,
  Calendar,
  FileText,
  ExternalLink,
  Search,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrganizationInfo {
  id: string;
  name: string;
  type: string;
  city?: string;
  state?: string;
}

interface PlayerInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  elo: number;
  playerOrgType: string;
}

interface Contract {
  id: string;
  player: PlayerInfo;
  organization: OrganizationInfo;
  contractTitle: string;
  contractType: string;
  startDate: string;
  endDate: string;
  status: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

interface Stats {
  total: number;
  pending: number;
  active: number;
  expired: number;
  terminated: number;
  rejected: number;
}

export default function AdminContractsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<Stats>({ 
    total: 0, pending: 0, active: 0, expired: 0, terminated: 0, rejected: 0 
  });
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchContracts();
  }, [statusFilter, page]);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      params.append("page", page.toString());
      
      const response = await fetch(`/api/admin/contracts?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
        setStats(data.stats || { total: 0, pending: 0, active: 0, expired: 0, terminated: 0, rejected: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch contracts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (action: "verify" | "reject") => {
    if (!selectedContract) return;
    
    if (action === "reject" && !rejectionReason.trim()) {
      setError("Please provide a rejection reason");
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/contracts/${selectedContract.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectionReason: action === "reject" ? rejectionReason : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to process contract");
        return;
      }

      setSuccess(action === "verify" 
        ? `Contract verified! ${selectedContract.player.name} is now a contracted player.` 
        : `Contract for ${selectedContract.player.name} has been rejected.`);
      setShowViewDialog(false);
      setSelectedContract(null);
      setRejectionReason("");
      fetchContracts();
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
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

  const filteredContracts = contracts.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.player.name.toLowerCase().includes(query) ||
      c.organization.name.toLowerCase().includes(query) ||
      c.contractTitle.toLowerCase().includes(query)
    );
  });

  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6 max-w-6xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Contract Management</h1>
            <p className="text-gray-500">Verify and manage player contracts for inter-organization tournaments</p>
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
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("PENDING")}>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                  <p className="text-xs text-gray-500">Pending</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("ACTIVE")}>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                  <p className="text-xs text-gray-500">Active</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("EXPIRED")}>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-600">{stats.expired}</p>
                  <p className="text-xs text-gray-500">Expired</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("TERMINATED")}>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{stats.terminated}</p>
                  <p className="text-xs text-gray-500">Terminated</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("REJECTED")}>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{stats.rejected}</p>
                  <p className="text-xs text-gray-500">Rejected</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm" onClick={() => setStatusFilter("ALL")}>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-white border-gray-100 shadow-sm mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by player, organization, or contract title..."
                    className="pl-10 border-gray-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="EXPIRED">Expired</SelectItem>
                      <SelectItem value="TERMINATED">Terminated</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contracts Table */}
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
              ) : filteredContracts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No contracts found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Contract</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Player</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Organization</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Duration</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContracts.map((contract) => (
                        <tr key={contract.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{contract.contractTitle}</p>
                              <p className="text-sm text-gray-500 capitalize">{contract.contractType}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{contract.player.name}</p>
                              <p className="text-sm text-gray-500">{contract.player.email}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="font-medium text-gray-900">{contract.organization.name}</p>
                                <p className="text-sm text-gray-500">{contract.organization.city}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Calendar className="w-3 h-3" />
                              {new Date(contract.startDate).toLocaleDateString()} - {new Date(contract.endDate).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {getStatusBadge(contract.status)}
                          </td>
                          <td className="py-3 px-4">
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* View/Process Dialog */}
          <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Contract Details</DialogTitle>
                <DialogDescription>
                  {selectedContract?.status === "PENDING" 
                    ? "Review and verify or reject this contract" 
                    : "View contract details"}
                </DialogDescription>
              </DialogHeader>
              
              {selectedContract && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gray-50">
                    <h3 className="font-semibold text-gray-900 mb-2">{selectedContract.contractTitle}</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Player</p>
                        <p className="font-medium">{selectedContract.player.name}</p>
                        <p className="text-gray-500">{selectedContract.player.email}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Organization</p>
                        <p className="font-medium">{selectedContract.organization.name}</p>
                        <p className="text-gray-500">{selectedContract.organization.type}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Type</p>
                        <p className="font-medium capitalize">{selectedContract.contractType}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Status</p>
                        {getStatusBadge(selectedContract.status)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">
                      {new Date(selectedContract.startDate).toLocaleDateString()} - {new Date(selectedContract.endDate).toLocaleDateString()}
                    </span>
                  </div>

                  {selectedContract.verifiedAt && (
                    <div className="p-3 rounded-lg bg-gray-50">
                      <p className="text-sm text-gray-600">
                        <strong>Verified:</strong> {new Date(selectedContract.verifiedAt).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {selectedContract.rejectionReason && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-sm text-red-700">
                        <strong>Rejection Reason:</strong> {selectedContract.rejectionReason}
                      </p>
                    </div>
                  )}

                  {selectedContract.status === "PENDING" && (
                    <div className="space-y-2">
                      <Label className="text-gray-700">Rejection Reason (Required if rejecting)</Label>
                      <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Why is this contract being rejected?"
                        className="border-gray-200"
                      />
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setShowViewDialog(false);
                  setSelectedContract(null);
                  setRejectionReason("");
                }}>
                  Close
                </Button>
                {selectedContract?.status === "PENDING" && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => handleProcess("reject")}
                      disabled={processing || !rejectionReason.trim()}
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                      Reject
                    </Button>
                    <Button
                      className={cn("text-white", primaryBtnClass)}
                      onClick={() => handleProcess("verify")}
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
                      Verify Contract
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
