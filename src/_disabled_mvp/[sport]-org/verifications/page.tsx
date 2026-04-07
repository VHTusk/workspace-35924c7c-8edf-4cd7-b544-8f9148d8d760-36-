"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/layout/sidebar-org";
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
  UserCheck,
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
  city?: string;
  state?: string;
}

interface Verification {
  id: string;
  player: PlayerInfo;
  documentUrl: string;
  documentType: string;
  status: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  createdAt: string;
}

interface Stats {
  pending: number;
  verified: number;
  rejected: number;
}

export default function OrgVerificationsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, verified: 0, rejected: 0 });
  const [statusFilter, setStatusFilter] = useState("PENDING");

  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchVerifications();
  }, [statusFilter]);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const url = statusFilter 
        ? `/api/org/verifications?status=${statusFilter}`
        : "/api/org/verifications";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setVerifications(data.verifications || []);
        setStats(data.stats || { pending: 0, verified: 0, rejected: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch verifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (action: "verify" | "reject") => {
    if (!selectedVerification) return;
    
    if (action === "reject" && !rejectionReason.trim()) {
      setError("Please provide a rejection reason");
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/org/verifications/${selectedVerification.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectionReason: action === "reject" ? rejectionReason : undefined,
          notes: action === "verify" ? notes : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to process verification");
        return;
      }

      setSuccess(action === "verify" 
        ? `${selectedVerification.player.name} has been verified successfully!` 
        : `Verification for ${selectedVerification.player.name} has been rejected.`);
      setShowDialog(false);
      setSelectedVerification(null);
      setRejectionReason("");
      setNotes("");
      fetchVerifications();
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setProcessing(false);
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

  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6 max-w-6xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Player Verifications</h1>
            <p className="text-gray-500">Review and verify player ID documents</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
            <Card className="bg-white border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("VERIFIED")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Verified</p>
                    <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("REJECTED")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Rejected</p>
                    <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
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
                    <SelectItem value="VERIFIED">Verified</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="ALL">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Verifications List */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Verification Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : verifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No verification requests found
                </div>
              ) : (
                <div className="space-y-4">
                  {verifications.map((verification) => (
                    <div
                      key={verification.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <UserCheck className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{verification.player.name}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{verification.player.email}</span>
                            <span>•</span>
                            <span>{verification.documentType}</span>
                            <span>•</span>
                            <span>ELO: {Math.round(verification.player.elo)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(verification.status)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedVerification(verification);
                            setShowDialog(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Review
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review Dialog */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Review Verification</DialogTitle>
                <DialogDescription>
                  Review the player&apos;s ID document and verify or reject the request
                </DialogDescription>
              </DialogHeader>
              
              {selectedVerification && (
                <div className="space-y-4">
                  {/* Player Info */}
                  <div className="p-4 rounded-lg bg-gray-50">
                    <p className="font-medium text-gray-900">{selectedVerification.player.name}</p>
                    <p className="text-sm text-gray-500">{selectedVerification.player.email}</p>
                    <p className="text-sm text-gray-500">{selectedVerification.player.phone}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline">{selectedVerification.player.playerOrgType}</Badge>
                      <span className="text-sm text-gray-500">{selectedVerification.player.city}, {selectedVerification.player.state}</span>
                    </div>
                  </div>

                  {/* Document */}
                  <div className="space-y-2">
                    <Label className="text-gray-700">ID Document ({selectedVerification.documentType})</Label>
                    <a
                      href={selectedVerification.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors text-blue-600 hover:text-blue-700"
                    >
                      <FileText className="w-5 h-5" />
                      View Document
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Notes (for verify) */}
                  <div className="space-y-2">
                    <Label className="text-gray-700">Notes (Optional)</Label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this verification"
                      className="border-gray-200"
                    />
                  </div>

                  {/* Rejection Reason (for reject) */}
                  <div className="space-y-2">
                    <Label className="text-gray-700">Rejection Reason (Required if rejecting)</Label>
                    <Input
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Why is this verification being rejected?"
                      className="border-gray-200"
                    />
                  </div>
                </div>
              )}

              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
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
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Verify
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
