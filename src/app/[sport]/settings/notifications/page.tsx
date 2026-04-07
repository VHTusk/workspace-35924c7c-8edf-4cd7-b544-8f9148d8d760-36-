"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Trophy,
  Users,
  TrendingUp,
  Megaphone,
  Moon,
  Loader2,
  CheckCircle,
  Save,
} from "lucide-react";

interface NotificationSettings {
  // Match & Tournament
  matchResults: boolean;
  tournamentUpdates: boolean;
  registrationConfirmations: boolean;
  
  // Social
  newFollowers: boolean;
  newMessages: boolean;
  teamInvites: boolean;
  
  // Performance
  rankChanges: boolean;
  achievements: boolean;
  milestones: boolean;
  
  // Marketing
  promotional: boolean;
  newsletter: boolean;
  announcements: boolean;
  
  // Quiet Hours
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  quietHoursTimezone: string;
  
  // Digest
  digestMode: boolean;
  digestFrequency: string;
}

export default function NotificationSettingsPage() {
  const params = useParams();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    matchResults: true,
    tournamentUpdates: true,
    registrationConfirmations: true,
    newFollowers: true,
    newMessages: true,
    teamInvites: true,
    rankChanges: true,
    achievements: true,
    milestones: true,
    promotional: false,
    newsletter: true,
    announcements: true,
    quietHoursEnabled: false,
    quietHoursStart: 22,
    quietHoursEnd: 8,
    quietHoursTimezone: "Asia/Kolkata",
    digestMode: false,
    digestFrequency: "daily",
  });
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchSettings();
  }, [sport]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/player/notification-preferences?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setSettings({ ...settings, ...data });
      }
    } catch (error) {
      console.error("Failed to fetch notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/player/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport: sport.toUpperCase(), ...settings }),
      });
      if (response.ok) {
        setSuccess("Notification settings saved successfully");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (error) {
      console.error("Failed to save notification settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof NotificationSettings, value: boolean | string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

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
            <Bell className="w-8 h-8 text-primary" />
            Notification Preferences
          </h1>
          <p className="text-muted-foreground mt-2">
            Customize how and when you receive notifications
          </p>
        </div>

        {success && (
          <Alert className="mb-6 bg-green-500/10 border-green-500/30 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Match & Tournament */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Match & Tournament
            </CardTitle>
            <CardDescription>Notifications about your matches and tournaments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <Label>Match Results</Label>
              </div>
              <Switch checked={settings.matchResults} onCheckedChange={(v) => updateSetting("matchResults", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="w-4 h-4 text-muted-foreground" />
                <Label>Tournament Updates</Label>
              </div>
              <Switch checked={settings.tournamentUpdates} onCheckedChange={(v) => updateSetting("tournamentUpdates", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <Label>Registration Confirmations</Label>
              </div>
              <Switch checked={settings.registrationConfirmations} onCheckedChange={(v) => updateSetting("registrationConfirmations", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Social */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Social
            </CardTitle>
            <CardDescription>Notifications about your social interactions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Label>New Followers</Label>
              </div>
              <Switch checked={settings.newFollowers} onCheckedChange={(v) => updateSetting("newFollowers", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <Label>New Messages</Label>
              </div>
              <Switch checked={settings.newMessages} onCheckedChange={(v) => updateSetting("newMessages", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Label>Team Invites</Label>
              </div>
              <Switch checked={settings.teamInvites} onCheckedChange={(v) => updateSetting("teamInvites", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Performance */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Performance
            </CardTitle>
            <CardDescription>Notifications about your performance and achievements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <Label>Rank Changes</Label>
              </div>
              <Switch checked={settings.rankChanges} onCheckedChange={(v) => updateSetting("rankChanges", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="w-4 h-4 text-muted-foreground" />
                <Label>Achievements</Label>
              </div>
              <Switch checked={settings.achievements} onCheckedChange={(v) => updateSetting("achievements", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <Label>Milestones</Label>
              </div>
              <Switch checked={settings.milestones} onCheckedChange={(v) => updateSetting("milestones", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Marketing */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-purple-400" />
              Marketing
            </CardTitle>
            <CardDescription>Promotional and marketing communications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Megaphone className="w-4 h-4 text-muted-foreground" />
                <Label>Promotional Offers</Label>
              </div>
              <Switch checked={settings.promotional} onCheckedChange={(v) => updateSetting("promotional", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <Label>Newsletter</Label>
              </div>
              <Switch checked={settings.newsletter} onCheckedChange={(v) => updateSetting("newsletter", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <Label>Announcements</Label>
              </div>
              <Switch checked={settings.announcements} onCheckedChange={(v) => updateSetting("announcements", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="w-5 h-5 text-indigo-400" />
              Quiet Hours
            </CardTitle>
            <CardDescription>Set times when you don&apos;t want to be disturbed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Quiet Hours</Label>
              <Switch checked={settings.quietHoursEnabled} onCheckedChange={(v) => updateSetting("quietHoursEnabled", v)} />
            </div>
            {settings.quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <Label className="text-sm text-muted-foreground">Start Time</Label>
                  <Select
                    value={settings.quietHoursStart.toString()}
                    onValueChange={(v) => updateSetting("quietHoursStart", parseInt(v))}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hours.map((h) => (
                        <SelectItem key={h} value={h.toString()}>
                          {h.toString().padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">End Time</Label>
                  <Select
                    value={settings.quietHoursEnd.toString()}
                    onValueChange={(v) => updateSetting("quietHoursEnd", parseInt(v))}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hours.map((h) => (
                        <SelectItem key={h} value={h.toString()}>
                          {h.toString().padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Digest Mode */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-teal-400" />
              Digest Mode
            </CardTitle>
            <CardDescription>Bundle notifications into periodic summaries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Digest Mode</Label>
              <Switch checked={settings.digestMode} onCheckedChange={(v) => updateSetting("digestMode", v)} />
            </div>
            {settings.digestMode && (
              <div className="pt-2">
                <Label className="text-sm text-muted-foreground">Digest Frequency</Label>
                <Select
                  value={settings.digestFrequency}
                  onValueChange={(v) => updateSetting("digestFrequency", v)}
                >
                  <SelectTrigger className="mt-1.5 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
