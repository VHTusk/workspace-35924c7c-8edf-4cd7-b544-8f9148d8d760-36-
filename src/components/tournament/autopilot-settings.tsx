"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Zap,
  Loader2,
  Settings,
  Clock,
  Trophy,
  Users,
  Calendar,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Info,
} from "lucide-react";

interface AutopilotLog {
  id: string;
  action: string;
  status: string;
  details: Record<string, unknown> | null;
  errorMessage: string | null;
  executedAt: string;
}

interface AutopilotData {
  autopilot: {
    enabled: boolean;
    autoCloseRegistration: boolean;
    autoGenerateBracket: boolean;
    autoStartTournament: boolean;
    autoAdvanceWinner: boolean;
    autoPromoteWaitlist: boolean;
  };
  status: {
    current: string;
    registrationClosedAt: string | null;
    bracketGeneratedAt: string | null;
    tournamentStartedAt: string | null;
    registrationCount: number;
    waitlistCount: number;
  };
  timeline: {
    regDeadline: string;
    startDate: string;
  };
  recentLogs: AutopilotLog[];
}

interface AutopilotSettingsProps {
  tournamentId: string;
  sport: string;
}

export function AutopilotSettings({ tournamentId, sport }: AutopilotSettingsProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<AutopilotData | null>(null);
  const [error, setError] = useState("");

  const [settings, setSettings] = useState({
    autopilotEnabled: false,
    autoCloseRegistration: true,
    autoGenerateBracket: true,
    autoStartTournament: true,
    autoAdvanceWinner: false,
    autoPromoteWaitlist: true,
  });

  const isCornhole = sport === "cornhole";
  const primaryBgClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/autopilot`);
      const result = await response.json();

      if (response.ok) {
        setData(result);
        setSettings({
          autopilotEnabled: result.autopilot.enabled,
          autoCloseRegistration: result.autopilot.autoCloseRegistration,
          autoGenerateBracket: result.autopilot.autoGenerateBracket,
          autoStartTournament: result.autopilot.autoStartTournament,
          autoAdvanceWinner: result.autopilot.autoAdvanceWinner,
          autoPromoteWaitlist: result.autopilot.autoPromoteWaitlist,
        });
      } else {
        setError(result.error || "Failed to load autopilot settings");
      }
    } catch (err) {
      setError("Failed to load autopilot settings");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setShowDialog(true);
    fetchData();
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/autopilot`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const result = await response.json();

      if (response.ok) {
        setData((prev) => prev ? { ...prev, autopilot: result.autopilot } : null);
        setShowDialog(false);
      } else {
        setError(result.error || "Failed to save settings");
      }
    } catch (err) {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "bg-gray-500/10 text-gray-400 border-gray-500/30",
      REGISTRATION_OPEN: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      REGISTRATION_CLOSED: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      BRACKET_GENERATED: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      IN_PROGRESS: "bg-green-500/10 text-green-400 border-green-500/30",
      COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    };
    return colors[status] || "bg-gray-500/10 text-gray-400 border-gray-500/30";
  };

  const getLogStatusIcon = (status: string) => {
    if (status === "SUCCESS") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "FAILED") return <AlertTriangle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-amber-500" />;
  };

  return (
    <>
      <Button variant="outline" onClick={handleOpenDialog} className="gap-2">
        <Zap className="w-4 h-4" />
        Autopilot Settings
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Tournament Autopilot
            </DialogTitle>
            <DialogDescription>
              Configure automatic actions for this tournament
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : data && (
            <div className="space-y-6">
              {/* Current Status */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    Current Status
                    <Badge className={getStatusBadge(data.status.current)} variant="outline">
                      {data.status.current.replace(/_/g, " ")}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{data.status.registrationCount}</p>
                      <p className="text-xs text-muted-foreground">Registrations</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{data.status.waitlistCount}</p>
                      <p className="text-xs text-muted-foreground">Waitlist</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {new Date(data.timeline.startDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Start Date</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Autopilot Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Zap className={`w-5 h-5 ${settings.autopilotEnabled ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <Label htmlFor="autopilot-enabled" className="font-medium">
                        Enable Autopilot
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically execute tournament actions
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="autopilot-enabled"
                    checked={settings.autopilotEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, autopilotEnabled: checked })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pl-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm">Auto-close Registration</Label>
                    </div>
                    <Switch
                      checked={settings.autoCloseRegistration}
                      onCheckedChange={(checked) => setSettings({ ...settings, autoCloseRegistration: checked })}
                      disabled={!settings.autopilotEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm">Auto-generate Bracket</Label>
                    </div>
                    <Switch
                      checked={settings.autoGenerateBracket}
                      onCheckedChange={(checked) => setSettings({ ...settings, autoGenerateBracket: checked })}
                      disabled={!settings.autopilotEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm">Auto-start Tournament</Label>
                    </div>
                    <Switch
                      checked={settings.autoStartTournament}
                      onCheckedChange={(checked) => setSettings({ ...settings, autoStartTournament: checked })}
                      disabled={!settings.autopilotEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm">Auto-promote Waitlist</Label>
                    </div>
                    <Switch
                      checked={settings.autoPromoteWaitlist}
                      onCheckedChange={(checked) => setSettings({ ...settings, autoPromoteWaitlist: checked })}
                      disabled={!settings.autopilotEnabled}
                    />
                  </div>

                  <div className="col-span-2 flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm">Auto-advance Winners</Label>
                    </div>
                    <Switch
                      checked={settings.autoAdvanceWinner}
                      onCheckedChange={(checked) => setSettings({ ...settings, autoAdvanceWinner: checked })}
                      disabled={!settings.autopilotEnabled}
                    />
                  </div>
                </div>
              </div>

              {/* Recent Logs */}
              {data.recentLogs.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Recent Autopilot Actions</h4>
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-2">
                      {data.recentLogs.map((log) => (
                        <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                          {getLogStatusIcon(log.status)}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{log.action.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(log.executedAt).toLocaleString()}
                            </p>
                          </div>
                          {log.errorMessage && (
                            <p className="text-xs text-red-400">{log.errorMessage}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Autopilot actions run automatically based on your tournament timeline.
                  You can manually override any action from the tournament management page.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button className={`${primaryBgClass} text-white`} onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
