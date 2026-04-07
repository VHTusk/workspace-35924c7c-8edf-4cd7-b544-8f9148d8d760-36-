"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
  ArrowLeft,
  Clock,
  XCircle,
  UserCheck,
  Briefcase,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrganizationData {
  id: string;
  name: string;
  type: string;
  city?: string;
  state?: string;
}

interface ContractData {
  id: string;
  contractTitle: string;
  contractType: string;
  startDate: string;
  endDate: string;
  status: string;
  organization: OrganizationData;
}

interface VerificationData {
  id: string;
  status: string;
  documentType: string;
  createdAt: string;
  organization: OrganizationData;
}

interface PlayerOrgData {
  playerOrgType: string;
  verificationStatus: string;
  organization: OrganizationData | null;
  affiliatedOrgId: string | null;
  idDocumentUrl: string | null;
  idDocumentType: string | null;
  orgVerifiedAt: string | null;
  verificationNotes: string | null;
  pendingVerification: VerificationData | null;
  activeContract: ContractData | null;
}

export default function PlayerOrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [orgData, setOrgData] = useState<PlayerOrgData | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationData[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedOrgType, setSelectedOrgType] = useState("EMPLOYEE");
  const [idDocumentUrl, setIdDocumentUrl] = useState("");
  const [idDocumentType, setIdDocumentType] = useState("");

  useEffect(() => {
    fetchOrgData();
    fetchOrganizations();
  }, []);

  const fetchOrgData = async () => {
    try {
      const response = await fetch("/api/player/organization");
      if (response.ok) {
        const data = await response.json();
        setOrgData(data);
        if (data.affiliatedOrgId) {
          setSelectedOrgId(data.affiliatedOrgId);
        }
      }
    } catch (err) {
      console.error("Failed to fetch organization data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await fetch("/api/search/orgs");
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
    }
  };

  const handleSubmitVerification = async () => {
    if (!selectedOrgId) {
      setError("Please select an organization");
      return;
    }
    if (!idDocumentUrl) {
      setError("Please upload an ID document");
      return;
    }
    if (!idDocumentType) {
      setError("Please select a document type");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/player/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          idDocumentUrl,
          idDocumentType,
          playerOrgType: selectedOrgType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit verification request");
        return;
      }

      setSuccess("Verification request submitted successfully! An organization admin will review your request.");
      fetchOrgData();
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveOrg = async () => {
    if (!confirm("Are you sure you want to leave this organization? This action cannot be undone.")) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/player/organization", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to leave organization");
        return;
      }

      setSuccess("You have successfully left the organization.");
      fetchOrgData();
      setSelectedOrgId("");
      setIdDocumentUrl("");
      setIdDocumentType("");
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "EXPIRED":
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
      case "NONE":
      default:
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Not Verified</Badge>;
    }
  };

  const getOrgTypeBadge = (type: string) => {
    switch (type) {
      case "EMPLOYEE":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><UserCheck className="w-3 h-3 mr-1" />Employee</Badge>;
      case "CONTRACTED":
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200"><Briefcase className="w-3 h-3 mr-1" />Contracted</Badge>;
      case "INDEPENDENT":
      default:
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200"><User className="w-3 h-3 mr-1" />Independent</Badge>;
    }
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72">
        <div className="p-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              className="mb-4 text-gray-600 hover:text-gray-900"
              onClick={() => router.push(`/${sport}/profile`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Profile
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
            <p className="text-gray-500">Manage your organization membership and verification</p>
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

          {/* Current Status */}
          {orgData && (
            <Card className="mb-6 bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Current Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-gray-50">
                    <p className="text-sm text-gray-500 mb-1">Player Type</p>
                    {getOrgTypeBadge(orgData.playerOrgType)}
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50">
                    <p className="text-sm text-gray-500 mb-1">Verification Status</p>
                    {getStatusBadge(orgData.verificationStatus)}
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 col-span-2">
                    <p className="text-sm text-gray-500 mb-1">Organization</p>
                    {orgData.organization ? (
                      <div>
                        <p className="font-medium text-gray-900">{orgData.organization.name}</p>
                        <p className="text-sm text-gray-500">{orgData.organization.city}, {orgData.organization.state}</p>
                      </div>
                    ) : (
                      <p className="text-gray-500">Not associated with any organization</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Contract */}
          {orgData?.activeContract && (
            <Card className="mb-6 bg-white border-purple-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-purple-600" />
                  Active Contract
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{orgData.activeContract.contractTitle}</p>
                      <p className="text-sm text-gray-500">{orgData.activeContract.organization.name}</p>
                    </div>
                    {getStatusBadge(orgData.activeContract.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(orgData.activeContract.startDate).toLocaleDateString()} - {new Date(orgData.activeContract.endDate).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {orgData.activeContract.contractType}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Verification */}
          {orgData?.pendingVerification && (
            <Card className="mb-6 bg-white border-amber-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  Pending Verification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{orgData.pendingVerification.organization.name}</p>
                      <p className="text-sm text-gray-500">Document: {orgData.pendingVerification.documentType}</p>
                    </div>
                    {getStatusBadge(orgData.pendingVerification.status)}
                  </div>
                  <p className="text-sm text-gray-500">
                    Submitted on {new Date(orgData.pendingVerification.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Join Organization Form */}
          {(!orgData?.organization || orgData.verificationStatus === "REJECTED") && !orgData?.pendingVerification && (
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Join Organization
                </CardTitle>
                <CardDescription>
                  Select your organization and upload your ID for verification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Organization Selection */}
                <div className="space-y-2">
                  <Label className="text-gray-700">Organization</Label>
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                    <SelectTrigger className="border-gray-200">
                      <SelectValue placeholder="Select your organization" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name} ({org.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Don&apos;t see your organization? Contact your organization admin.
                  </p>
                </div>

                {/* Player Type */}
                <div className="space-y-2">
                  <Label className="text-gray-700">I am an</Label>
                  <Select value={selectedOrgType} onValueChange={setSelectedOrgType}>
                    <SelectTrigger className="border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Employee of this organization</SelectItem>
                      <SelectItem value="CONTRACTED">Contracted player (for inter-org tournaments)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Document Type */}
                <div className="space-y-2">
                  <Label className="text-gray-700">ID Document Type</Label>
                  <Select value={idDocumentType} onValueChange={setIdDocumentType}>
                    <SelectTrigger className="border-gray-200">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee_id">Employee ID Card</SelectItem>
                      <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="pan">PAN Card</SelectItem>
                      <SelectItem value="driving_license">Driving License</SelectItem>
                      <SelectItem value="other">Other Government ID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Document Upload */}
                <div className="space-y-2">
                  <Label className="text-gray-700">ID Document URL</Label>
                  <div className="relative">
                    <Upload className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="url"
                      value={idDocumentUrl}
                      onChange={(e) => setIdDocumentUrl(e.target.value)}
                      placeholder="Paste the URL of your uploaded ID document"
                      className="pl-10 border-gray-200"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Upload your ID document to a cloud storage service and paste the URL here
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmitVerification}
                  className={cn("text-white w-full", primaryBtnClass)}
                  disabled={saving || !selectedOrgId || !idDocumentUrl || !idDocumentType}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Submit Verification Request
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Leave Organization */}
          {orgData?.organization && orgData.verificationStatus === "VERIFIED" && !orgData.activeContract && (
            <Card className="bg-white border-red-100 shadow-sm mt-6">
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Leave Organization
                </CardTitle>
                <CardDescription>
                  This will remove you from the organization roster
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onClick={handleLeaveOrg}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Leaving...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Leave Organization
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Verification Notes */}
          {orgData?.verificationNotes && (
            <Card className="bg-white border-gray-100 shadow-sm mt-6">
              <CardHeader>
                <CardTitle className="text-gray-900">Verification Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{orgData.verificationNotes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
