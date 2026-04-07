"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  ShieldAlert,
  User,
  XCircle,
  ArrowUpDown,
  Calendar,
  MapPin,
} from "lucide-react";

interface AppealDetails {
  id: string;
  type: string;
  status: string;
  reason: string;
  evidence?: string;
  relatedId?: string;
  priority: number;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  resolution?: string;
  resolutionType?: string;
  adminNotes?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    sport: string;
    photoUrl?: string;
    city?: string;
    district?: string;
    state?: string;
  };
  reviewer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface AuditEntry {
  action: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  details: string;
}

interface ApiResponse {
  appeal: AppealDetails;
  auditTrail: AuditEntry[];
}

const APPEAL_TYPES: Record<string, string> = {
  BAN: 'Account Ban',
  WARNING: 'Warning',
  SUSPENSION: 'Tournament Suspension',
  POINT_DEDUCTION: 'Point Deduction',
  CONTENT_REMOVAL: 'Content Removal',
  OTHER: 'Other',
};

const APPEAL_STATUSES = [
  { value: 'PENDING', label: 'Pending', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { value: 'UNDER_REVIEW', label: 'Under Review', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { value: 'APPROVED', label: 'Approved', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { value: 'REJECTED', label: 'Rejected', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  { value: 'ESCALATED', label: 'Escalated', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
];

const RESOLUTION_TYPES = [
  { value: 'APPROVED', label: 'Approved - Action Reversed' },
  { value: 'REJECTED', label: 'Rejected - Original Action Stands' },
  { value: 'PARTIAL', label: 'Partial - Modified Resolution' },
];

export default function AppealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const appealId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [status, setStatus] = useState<string>("");
  const [resolution, setResolution] = useState<string>("");
  const [resolutionType, setResolutionType] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [userMessage, setUserMessage] = useState<string>("");
  const [priority, setPriority] = useState<string>("0");

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | "escalate" | null>(null);

  useEffect(() => {
    fetchAppeal();
  }, [appealId]);

  const fetchAppeal = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/appeals/${appealId}`);
      
      if (response.ok) {
        const result = await response.json();
        setData(result);
        // Pre-fill form
        setStatus(result.appeal.status);
        setResolution(result.appeal.resolution || "");
        setResolutionType(result.appeal.resolutionType || "");
        setAdminNotes(result.appeal.adminNotes || "");
        setPriority(result.appeal.priority.toString());
      } else {
        setError("Appeal not found");
      }
    } catch (err) {
      setError("Failed to load appeal");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!confirmAction) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const newStatus = confirmAction === "approve" ? "APPROVED" 
        : confirmAction === "reject" ? "REJECTED" 
        : "ESCALATED";

      const response = await fetch(`/api/admin/appeals/${appealId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          resolution,
          resolutionType: confirmAction === "approve" ? "APPROVED" : confirmAction === "reject" ? "REJECTED" : undefined,
          adminNotes,
          userMessage,
          priority: parseInt(priority),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(`Appeal ${confirmAction}d successfully`);
        setConfirmAction(null);
        // Refresh data
        fetchAppeal();
      } else {
        setError(result.error || "Failed to update appeal");
      }
    } catch (err) {
      setError("Failed to update appeal");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveNotes = async () => {
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/appeals/${appealId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminNotes,
          priority: parseInt(priority),
          status: status === "PENDING" ? "UNDER_REVIEW" : status,
        }),
      });

      if (response.ok) {
        setSuccess("Notes saved successfully");
        fetchAppeal();
      } else {
        setError("Failed to save notes");
      }
    } catch (err) {
      setError("Failed to save notes");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (statusValue: string) => {
    const statusConfig = APPEAL_STATUSES.find(s => s.value === statusValue);
    return (
      <Badge className={statusConfig?.color || 'bg-gray-500/10 text-gray-400 border-gray-500/30'} variant="outline">
        {statusConfig?.label || statusValue}
      </Badge>
    );
  };

  const getPriorityIndicator = (priorityValue: number) => {
    if (priorityValue >= 7) {
      return (
        <div className="flex items-center gap-1 text-red-400">
          <ArrowUp className="w-4 h-4" />
          <span className="text-sm font-medium">High ({priorityValue})</span>
        </div>
      );
    } else if (priorityValue >= 4) {
      return (
        <div className="flex items-center gap-1 text-amber-400">
          <ArrowUpDown className="w-4 h-4" />
          <span className="text-sm font-medium">Medium ({priorityValue})</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-gray-400">
          <ArrowDown className="w-4 h-4" />
          <span className="text-sm font-medium">Low ({priorityValue})</span>
        </div>
      );
    }
  };

  const parseEvidence = (evidence?: string) => {
    if (!evidence) return [];
    try {
      const parsed = JSON.parse(evidence);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return evidence.split(',').map(e => e.trim());
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{error || "Appeal not found"}</AlertDescription>
          </Alert>
          <Link href={`/${sport}/admin/appeals`} className="mt-4 inline-block">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Appeals
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { appeal, auditTrail } = data;

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Back Button */}
        <Link href={`/${sport}/admin/appeals`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Appeals
        </Link>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4 bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Appeal: {APPEAL_TYPES[appeal.type] || appeal.type.replace(/_/g, ' ')}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                ID: {appeal.id.slice(-8)} • Submitted {new Date(appeal.submittedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(appeal.status)}
            {getPriorityIndicator(appeal.priority)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* User Information */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  User Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{appeal.user.firstName} {appeal.user.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <a href={`mailto:${appeal.user.email}`} className="flex items-center gap-1 text-primary hover:underline">
                      <Mail className="w-4 h-4" />
                      {appeal.user.email}
                    </a>
                  </div>
                  {appeal.user.phone && (
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <a href={`tel:${appeal.user.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Phone className="w-4 h-4" />
                        {appeal.user.phone}
                      </a>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Sport</p>
                    <p className="font-medium">{appeal.user.sport}</p>
                  </div>
                  {appeal.user.city && (
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        {[appeal.user.city, appeal.user.district, appeal.user.state].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">User ID</p>
                    <Link href={`/${sport}/players/${appeal.user.id}`} className="text-primary hover:underline text-sm">
                      View Profile
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Appeal Details */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Appeal Reason
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Appeal Type</p>
                    <Badge className="bg-primary/10 text-primary border-primary/30" variant="outline">
                      {APPEAL_TYPES[appeal.type] || appeal.type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Reason</p>
                    <p className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg">{appeal.reason}</p>
                  </div>
                  {appeal.evidence && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Evidence</p>
                      <div className="flex flex-wrap gap-2">
                        {parseEvidence(appeal.evidence).map((item: string, index: number) => (
                          item.startsWith('http') ? (
                            <a
                              key={index}
                              href={item}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-md hover:bg-primary/20 text-sm"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Link {index + 1}
                            </a>
                          ) : (
                            <Badge key={index} variant="outline" className="text-xs">
                              {item}
                            </Badge>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                  {appeal.relatedId && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Related Entity ID</p>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{appeal.relatedId}</code>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Resolution Form */}
            {appeal.status !== 'APPROVED' && appeal.status !== 'REJECTED' && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    Resolution Form
                  </CardTitle>
                  <CardDescription>
                    Provide resolution details and take action on this appeal
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="resolutionType">Resolution Type</Label>
                    <Select value={resolutionType} onValueChange={setResolutionType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select resolution type" />
                      </SelectTrigger>
                      <SelectContent>
                        {RESOLUTION_TYPES.map((rt) => (
                          <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resolution">Resolution Notes (Internal)</Label>
                    <Textarea
                      id="resolution"
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder="Document the resolution decision..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="userMessage">Message to User (Optional)</Label>
                    <Textarea
                      id="userMessage"
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      placeholder="Optional message to send to the user..."
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Low (0-3)</SelectItem>
                          <SelectItem value="4">Medium (4-6)</SelectItem>
                          <SelectItem value="7">High (7-10)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {APPEAL_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-wrap gap-3">
                    {/* Approve Button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve Appeal
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Approve Appeal?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will approve the appeal and reverse the original action. The user will be notified of the decision.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-emerald-500 hover:bg-emerald-600"
                            onClick={() => {
                              setConfirmAction("approve");
                              setTimeout(handleSubmit, 0);
                            }}
                          >
                            Confirm Approval
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* Reject Button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="text-red-400 border-red-400/30 hover:bg-red-500/10">
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject Appeal
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reject Appeal?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will reject the appeal and the original action will stand. The user will be notified of the decision.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => {
                              setConfirmAction("reject");
                              setTimeout(handleSubmit, 0);
                            }}
                          >
                            Confirm Rejection
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* Request More Info Button */}
                    <Button
                      variant="outline"
                      onClick={() => setStatus("UNDER_REVIEW")}
                      disabled={status === "UNDER_REVIEW"}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Request More Info
                    </Button>

                    {/* Escalate Button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="text-purple-400 border-purple-400/30 hover:bg-purple-500/10">
                          <ShieldAlert className="w-4 h-4 mr-2" />
                          Escalate
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Escalate Appeal?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will escalate the appeal to a higher-level administrator for review.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-purple-500 hover:bg-purple-600"
                            onClick={() => {
                              setConfirmAction("escalate");
                              setTimeout(handleSubmit, 0);
                            }}
                          >
                            Confirm Escalation
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* Save Notes Button */}
                    <Button
                      variant="secondary"
                      onClick={handleSaveNotes}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Save Notes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Previous Resolution */}
            {appeal.resolution && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Resolution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {appeal.resolutionType && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Resolution Type</p>
                        <Badge className={appeal.resolutionType === 'APPROVED' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : appeal.resolutionType === 'REJECTED'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        } variant="outline">
                          {appeal.resolutionType}
                        </Badge>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Resolution Notes</p>
                      <p className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg">{appeal.resolution}</p>
                    </div>
                    {appeal.reviewedAt && (
                      <div className="text-sm text-muted-foreground">
                        Resolved on {new Date(appeal.reviewedAt).toLocaleString()}
                        {appeal.reviewer && ` by ${appeal.reviewer.firstName} ${appeal.reviewer.lastName}`}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Admin Notes */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Admin Notes
                </CardTitle>
                <CardDescription>Internal notes (not visible to user)</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes here..."
                  rows={6}
                  className="resize-none"
                />
              </CardContent>
            </Card>

            {/* Audit Trail */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Audit Trail
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    {auditTrail.map((entry, index) => (
                      <div key={index} className="flex gap-3">
                        <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{entry.action.replace(/_/g, ' ')}</p>
                            <Badge variant="outline" className="text-xs">{entry.actorRole}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{entry.details}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            by {entry.actor}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Submitted</span>
                    <span>{new Date(appeal.submittedAt).toLocaleDateString()}</span>
                  </div>
                  {appeal.reviewedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reviewed</span>
                      <span>{new Date(appeal.reviewedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {appeal.reviewer && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reviewed By</span>
                      <span>{appeal.reviewer.firstName} {appeal.reviewer.lastName}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
