"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Briefcase,
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Eye,
  EyeOff,
  ChevronRight,
  Loader2,
  Info,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ProfessionVerificationStatus = 'NONE' | 'SELF_DECLARED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

interface ProfessionInfo {
  profession: string | null;
  professionLabel: string | null;
  membershipNumber: string | null;
  governingBody: string | null;
  verificationStatus: ProfessionVerificationStatus;
  verifiedAt: string | null;
  showPublicly: boolean;
  canClaimRewards: boolean;
  documentUrl: string | null;
  rejectionReason: string | null;
  availableProfessions: Array<{
    value: string;
    label: string;
    governingBody: string;
  }>;
}

interface ProfessionVerificationProps {
  sport: string;
  compact?: boolean;
}

const STATUS_CONFIG: Record<ProfessionVerificationStatus, {
  label: string;
  color: string;
  icon: React.ElementType;
  bgClass: string;
}> = {
  NONE: {
    label: "Not Declared",
    color: "text-gray-600",
    icon: AlertCircle,
    bgClass: "bg-gray-100 dark:bg-gray-800",
  },
  SELF_DECLARED: {
    label: "Self Declared",
    color: "text-blue-600",
    icon: Info,
    bgClass: "bg-blue-100 dark:bg-blue-900/30",
  },
  PENDING: {
    label: "Pending Verification",
    color: "text-amber-600",
    icon: Clock,
    bgClass: "bg-amber-100 dark:bg-amber-900/30",
  },
  VERIFIED: {
    label: "Verified",
    color: "text-green-600",
    icon: CheckCircle,
    bgClass: "bg-green-100 dark:bg-green-900/30",
  },
  REJECTED: {
    label: "Rejected",
    color: "text-red-600",
    icon: XCircle,
    bgClass: "bg-red-100 dark:bg-red-900/30",
  },
};

export function ProfessionVerification({ sport, compact = false }: ProfessionVerificationProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<ProfessionInfo | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  
  // Form state
  const [selectedProfession, setSelectedProfession] = useState("");
  const [membershipNumber, setMembershipNumber] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [showPublicly, setShowPublicly] = useState(false);

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchProfessionInfo();
  }, []);

  const fetchProfessionInfo = async () => {
    try {
      const response = await fetch("/api/users/me/profession");
      if (response.ok) {
        const data = await response.json();
        setInfo(data);
        if (data.profession) {
          setSelectedProfession(data.profession);
          setMembershipNumber(data.membershipNumber || "");
          setShowPublicly(data.showPublicly || false);
        }
      }
    } catch (err) {
      console.error("Failed to fetch profession info:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProfession) {
      toast.error("Please select a profession");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/users/me/profession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profession: selectedProfession,
          membershipNumber,
          showPublicly,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Profession updated successfully");
        setInfo(prev => prev ? {
          ...prev,
          profession: selectedProfession,
          professionLabel: data.professionLabel,
          membershipNumber,
          governingBody: data.governingBody,
          verificationStatus: data.verificationStatus,
          showPublicly,
        } : null);
        setShowDialog(false);
      } else {
        toast.error(data.error || "Failed to update profession");
      }
    } catch (err) {
      toast.error("Failed to update profession");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!documentUrl) {
      toast.error("Please enter a document URL");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/users/me/profession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "uploadDocument",
          documentUrl,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Document uploaded successfully");
        setInfo(prev => prev ? {
          ...prev,
          verificationStatus: "PENDING",
          documentUrl,
        } : null);
        setShowDocumentDialog(false);
        setDocumentUrl("");
      } else {
        toast.error(data.error || "Failed to upload document");
      }
    } catch (err) {
      toast.error("Failed to upload document");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async () => {
    try {
      const response = await fetch("/api/users/me/profession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setVisibility",
          showPublicly: !showPublicly,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setShowPublicly(!showPublicly);
        setInfo(prev => prev ? { ...prev, showPublicly: !showPublicly } : null);
        toast.success(showPublicly ? "Profession hidden from profile" : "Profession visible on profile");
      } else {
        toast.error(data.error || "Failed to update visibility");
      }
    } catch (err) {
      toast.error("Failed to update visibility");
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const statusConfig = info ? STATUS_CONFIG[info.verificationStatus] : STATUS_CONFIG.NONE;
  const StatusIcon = statusConfig.icon;

  // Compact mode for profile page sidebar
  if (compact) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Profession
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {info?.profession ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium">{info.professionLabel}</span>
                <Badge className={cn("text-xs", statusConfig.bgClass, statusConfig.color)}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
              {info.governingBody && (
                <p className="text-sm text-muted-foreground">{info.governingBody}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => router.push(`/${sport}/profile/profession`)}
              >
                Manage Profession
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Declare your profession to access exclusive tournaments
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => router.push(`/${sport}/profile/profession`)}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Declare Profession
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Profession Verification
          </CardTitle>
          <CardDescription>
            Declare your profession to access profession-exclusive tournaments and rewards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Status */}
          <div className={cn("p-4 rounded-lg", statusConfig.bgClass)}>
            <div className="flex items-center gap-3">
              <StatusIcon className={cn("h-6 w-6", statusConfig.color)} />
              <div>
                <p className={cn("font-medium", statusConfig.color)}>{statusConfig.label}</p>
                {info?.profession && (
                  <p className="text-sm text-muted-foreground">{info.professionLabel}</p>
                )}
              </div>
            </div>
          </div>

          {/* Rejection Reason */}
          {info?.verificationStatus === "REJECTED" && info.rejectionReason && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Rejection Reason:</strong> {info.rejectionReason}
              </AlertDescription>
            </Alert>
          )}

          {/* Profession Details */}
          {info?.profession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Profession</Label>
                  <p className="font-medium">{info.professionLabel}</p>
                </div>
                {info.membershipNumber && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Membership Number</Label>
                    <p className="font-medium">{info.membershipNumber}</p>
                  </div>
                )}
                {info.governingBody && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">Governing Body</Label>
                    <p className="font-medium">{info.governingBody}</p>
                  </div>
                )}
              </div>

              {/* Visibility Toggle */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {showPublicly ? (
                    <Eye className="h-4 w-4 text-green-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">
                    {showPublicly ? "Visible on profile" : "Hidden from profile"}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={handleToggleVisibility}>
                  {showPublicly ? "Hide" : "Show"}
                </Button>
              </div>

              {/* Document Upload for Verification */}
              {(info.verificationStatus === "SELF_DECLARED" || info.verificationStatus === "REJECTED") && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>Upload proof document to get verified</span>
                    <Button
                      size="sm"
                      onClick={() => setShowDocumentDialog(true)}
                      className={cn("text-white", primaryBtnClass)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Document Info */}
              {info.documentUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Document uploaded</span>
                  <a
                    href={info.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("underline", primaryTextClass)}
                  >
                    View
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => setShowDialog(true)}
              className={cn("text-white", primaryBtnClass)}
            >
              {info?.profession ? "Update Profession" : "Declare Profession"}
            </Button>
            {info?.profession && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedProfession("");
                  setMembershipNumber("");
                  setShowPublicly(false);
                  setShowDialog(true);
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Info Box */}
          <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
            <p className="font-medium mb-1">Why verify your profession?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Access profession-exclusive tournaments</li>
              <li>Claim special rewards and prizes</li>
              <li>Compete with peers in your profession</li>
              <li>Build your professional network</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Profession Selection Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Declare Your Profession</DialogTitle>
            <DialogDescription>
              Select your profession from the list. Some may require verification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Profession</Label>
              <Select value={selectedProfession} onValueChange={setSelectedProfession}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your profession" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {info?.availableProfessions?.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProfession && (
              <>
                <div className="space-y-2">
                  <Label>Membership/Registration Number (Optional)</Label>
                  <Input
                    value={membershipNumber}
                    onChange={(e) => setMembershipNumber(e.target.value)}
                    placeholder="e.g., MCI-123456"
                  />
                  {selectedProfession && info?.availableProfessions && (
                    <p className="text-xs text-muted-foreground">
                      Governing Body: {info.availableProfessions.find(p => p.value === selectedProfession)?.governingBody || "N/A"}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showPublicly"
                    checked={showPublicly}
                    onChange={(e) => setShowPublicly(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="showPublicly" className="text-sm font-normal">
                    Show profession on public profile
                  </Label>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !selectedProfession}
              className={cn("text-white", primaryBtnClass)}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Profession"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Upload Dialog */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Verification Document</DialogTitle>
            <DialogDescription>
              Upload a proof document to verify your profession. This could be:
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>Professional ID card</li>
                <li>Membership certificate</li>
                <li>Registration document</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document URL</Label>
              <Input
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                placeholder="https://example.com/your-document.pdf"
              />
              <p className="text-xs text-muted-foreground">
                Upload your document to a cloud service and paste the link here
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocumentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadDocument}
              disabled={saving || !documentUrl}
              className={cn("text-white", primaryBtnClass)}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Submit for Verification
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
