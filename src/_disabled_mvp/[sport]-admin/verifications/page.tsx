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
  Building2,
  Clock,
  XCircle,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Filter,
  Users,
  FileText,
  ExternalLink,
  Search,
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
  firstName: string;
  lastName: string;
  name: string;
  email?: string;
  phone?: string;
}

interface Verification {
  id: string;
  player: PlayerInfo;
  organization: OrganizationInfo;
  documentUrl: string;
  documentType: string;
  status: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  createdAt: string;
}

interface Stats {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
}

export default function AdminVerificationsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, verified: 0, rejected: 0 });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    fetchVerifications();
  }, [statusFilter]);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      
      const response = await fetch(`/api/admin/verifications?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setVerifications(data.verifications || []);
        setStats(data.stats || { total: 0, pending: 0, verified: 0, rejected: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch verifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredVerifications = verifications.filter(v => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      v.player.name.toLowerCase().includes(query) ||
      v.organization.name.toLowerCase().includes(query) ||
      v.player.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="bg-muted min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6 max-w-6xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">ID Verification Tracking</h1>
            <p className="text-muted-foreground">Track all player ID verifications across organizations</p>
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
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  </div>
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("PENDING")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                  </div>
                  <Clock className="w-8 h-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("VERIFIED")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Verified</p>
                    <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("REJECTED")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                    <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-card border-border shadow-sm mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by player name, organization, or email..."
                    className="pl-10 border-border"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="VERIFIED">Verified</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verifications Table */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Users className="w-5 h-5" />
                Verification Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredVerifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No verification requests found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Player</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Organization</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Document</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVerifications.map((verification) => (
                        <tr key={verification.id} className="border-b border-border/50 hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-foreground">{verification.player.name}</p>
                              <p className="text-sm text-muted-foreground">{verification.player.email}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-foreground">{verification.organization.name}</p>
                                <p className="text-sm text-muted-foreground">{verification.organization.city}, {verification.organization.state}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="capitalize">{verification.documentType.replace("_", " ")}</span>
                          </td>
                          <td className="py-3 px-4">
                            {getStatusBadge(verification.status)}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {new Date(verification.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedVerification(verification);
                                setShowDialog(true);
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

          {/* View Dialog */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Verification Details</DialogTitle>
              </DialogHeader>
              
              {selectedVerification && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground mb-1">Player</p>
                      <p className="font-medium text-foreground">{selectedVerification.player.name}</p>
                      <p className="text-sm text-muted-foreground">{selectedVerification.player.email}</p>
                      <p className="text-sm text-muted-foreground">{selectedVerification.player.phone}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground mb-1">Organization</p>
                      <p className="font-medium text-foreground">{selectedVerification.organization.name}</p>
                      <p className="text-sm text-muted-foreground">{selectedVerification.organization.type}</p>
                      <p className="text-sm text-muted-foreground">{selectedVerification.organization.city}, {selectedVerification.organization.state}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-muted">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Document Type</p>
                        <p className="font-medium capitalize">{selectedVerification.documentType.replace("_", " ")}</p>
                      </div>
                      {getStatusBadge(selectedVerification.status)}
                    </div>
                  </div>

                  <div>
                    <Label className="text-foreground">ID Document</Label>
                    <a
                      href={selectedVerification.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors text-primary hover:text-primary/80"
                    >
                      <FileText className="w-5 h-5" />
                      View Document
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  {selectedVerification.verifiedAt && (
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">
                        <strong>Processed:</strong> {new Date(selectedVerification.verifiedAt).toLocaleString()}
                      </p>
                      {selectedVerification.verifiedBy && (
                        <p className="text-sm text-gray-600">
                          <strong>By:</strong> {selectedVerification.verifiedBy}
                        </p>
                      )}
                    </div>
                  )}

                  {selectedVerification.rejectionReason && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-sm text-red-700">
                        <strong>Rejection Reason:</strong> {selectedVerification.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
