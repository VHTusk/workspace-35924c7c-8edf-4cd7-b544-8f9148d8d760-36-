"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shield,
  Download,
  Trash2,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Calendar,
} from "lucide-react";

interface GDPRStatus {
  hasConsent: boolean;
  consentedAt: string | null;
  marketingConsent: boolean;
  analyticsConsent: boolean;
  dataExportRequested: boolean;
  dataExportDate: string | null;
  deletionRequested: boolean;
  deletionDate: string | null;
}

export default function GDPRSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gdprStatus, setGdprStatus] = useState<GDPRStatus | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchGDPRStatus();
  }, [sport]);

  const fetchGDPRStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/player/gdpr/consent?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setGdprStatus(data);
        setMarketingConsent(data.marketingConsent || false);
        setAnalyticsConsent(data.analyticsConsent || false);
      }
    } catch (err) {
      setError("Failed to load GDPR settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConsent = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/player/gdpr/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: sport.toUpperCase(),
          marketingConsent,
          analyticsConsent,
        }),
      });
      if (response.ok) {
        setSuccess("Consent preferences saved successfully");
        fetchGDPRStatus();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Failed to save consent preferences");
      }
    } catch (err) {
      setError("Failed to save consent preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    setError("");
    try {
      const response = await fetch("/api/player/gdpr/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport: sport.toUpperCase() }),
      });
      if (response.ok) {
        const data = await response.json();
        // Download the file
        if (data.downloadUrl) {
          window.open(data.downloadUrl, "_blank");
        }
        setSuccess("Data export initiated. You will receive an email when ready.");
        setExportDialog(false);
        fetchGDPRStatus();
        setTimeout(() => setSuccess(""), 5000);
      } else {
        setError("Failed to request data export");
      }
    } catch (err) {
      setError("Failed to request data export");
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") return;
    setDeleteLoading(true);
    setError("");
    try {
      const response = await fetch("/api/player/gdpr/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport: sport.toUpperCase() }),
      });
      if (response.ok) {
        setSuccess("Account deletion requested. Your data will be removed within 30 days.");
        setDeleteDialog(false);
        // Redirect to home after a delay
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to request account deletion");
      }
    } catch (err) {
      setError("Failed to request account deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            GDPR & Data Privacy
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your data privacy settings and rights under GDPR
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 bg-green-500/10 border-green-500/30 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Consent Preferences */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle>Consent Preferences</CardTitle>
            <CardDescription>
              Choose how your data is used. You can update these preferences at any time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id="marketing"
                checked={marketingConsent}
                onCheckedChange={(checked) => setMarketingConsent(checked as boolean)}
              />
              <div className="space-y-1">
                <Label htmlFor="marketing" className="font-medium">Marketing Communications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive promotional emails about tournaments, offers, and platform updates
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="analytics"
                checked={analyticsConsent}
                onCheckedChange={(checked) => setAnalyticsConsent(checked as boolean)}
              />
              <div className="space-y-1">
                <Label htmlFor="analytics" className="font-medium">Analytics & Improvements</Label>
                <p className="text-sm text-muted-foreground">
                  Allow us to collect anonymous usage data to improve the platform
                </p>
              </div>
            </div>

            {gdprStatus?.consentedAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Consent last updated: {new Date(gdprStatus.consentedAt).toLocaleDateString("en-IN")}
              </div>
            )}

            <Button onClick={handleSaveConsent} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Preferences
            </Button>
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export Your Data
            </CardTitle>
            <CardDescription>
              Download a copy of all your personal data stored on our platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  You have the right to receive a copy of your personal data in a machine-readable format.
                </p>
                {gdprStatus?.dataExportDate && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last export: {new Date(gdprStatus.dataExportDate).toLocaleDateString("en-IN")}
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={() => setExportDialog(true)}>
                <FileText className="w-4 h-4 mr-2" />
                Request Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Deletion */}
        <Card className="bg-gradient-card border-border/50 border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              Delete Your Account
            </CardTitle>
            <CardDescription>
              Request permanent deletion of your account and all associated data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                This action is irreversible. All your data, including tournament history, statistics, 
                and profile information will be permanently deleted within 30 days.
              </AlertDescription>
            </Alert>
            <div className="flex items-center justify-between">
              <div>
                {gdprStatus?.deletionRequested ? (
                  <Badge className="bg-red-500/10 text-red-400">
                    Deletion requested on {new Date(gdprStatus.deletionDate!).toLocaleDateString("en-IN")}
                  </Badge>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Your account and data will be deleted within 30 days of request.
                  </p>
                )}
              </div>
              {!gdprStatus?.deletionRequested && (
                <Button variant="destructive" onClick={() => setDeleteDialog(true)}>
                  Request Deletion
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Legal Links */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            For more information, see our{" "}
            <a href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</a>
            {" "}and{" "}
            <a href="/legal/terms" className="text-primary hover:underline">Terms of Service</a>
          </p>
        </div>

        {/* Export Dialog */}
        <Dialog open={exportDialog} onOpenChange={setExportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Data Export</DialogTitle>
              <DialogDescription>
                We will prepare a comprehensive export of all your personal data including:
              </DialogDescription>
            </DialogHeader>
            <ul className="text-sm text-muted-foreground space-y-1 py-4">
              <li>• Profile information</li>
              <li>• Tournament registrations and results</li>
              <li>• Match history</li>
              <li>• Payment records</li>
              <li>• Messages and conversations</li>
              <li>• Activity logs</li>
            </ul>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExportDialog(false)}>Cancel</Button>
              <Button onClick={handleExportData} disabled={exportLoading}>
                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Export Data
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-400">Delete Your Account</DialogTitle>
              <DialogDescription>
                This action cannot be undone. Please type <span className="font-bold">DELETE</span> to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full p-3 rounded-lg border border-red-500/30 bg-red-500/5 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeleteDialog(false); setDeleteConfirmation(""); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmation !== "DELETE"}
              >
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete My Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
