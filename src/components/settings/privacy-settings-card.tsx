"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Users,
  MessageSquare,
  MapPin,
  Phone,
  Mail,
  User,
  Trophy,
  Loader2,
  Check,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PrivacySettings {
  showPhone: boolean;
  showEmail: boolean;
  showRealName: boolean;
  showLocation: boolean;
  showTournamentHistory: boolean;
  allowFriendRequestsFrom: string;
  allowMessagesFrom: string;
}

interface PrivacySettingsCardProps {
  sport: string;
}

export function PrivacySettingsCard({ sport }: PrivacySettingsCardProps) {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/player/privacy");
      if (response.ok) {
        const data = await response.json();
        setSettings({
          showPhone: data.showPhone ?? false,
          showEmail: data.showEmail ?? false,
          showRealName: data.showRealName ?? true,
          showLocation: data.showLocation ?? true,
          showTournamentHistory: data.showTournamentHistory ?? true,
          allowFriendRequestsFrom: data.allowFriendRequestsFrom || "EVERYONE",
          allowMessagesFrom: data.allowMessagesFrom || "EVERYONE",
        });
      }
    } catch (error) {
      console.error("Failed to fetch privacy settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch("/api/player/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setSaved(true);
        toast.success("Privacy settings saved");
        setTimeout(() => setSaved(false), 2000);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof PrivacySettings, value: boolean | string) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardContent className="py-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Failed to load privacy settings</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className={cn("w-5 h-5", primaryTextClass)} />
              Privacy Controls
            </CardTitle>
            <CardDescription>
              Control who can see your personal information
            </CardDescription>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : null}
            {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Public Platform Notice */}
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border/50">
          <Info className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Public Competitive Platform</p>
            <p>
              Profile rankings, ELO ratings, and leaderboard positions are always visible to maintain fair competition.
              You can control what personal contact information others can see.
            </p>
          </div>
        </div>

        <Separator />

        {/* Personal Information Visibility */}
        <div className="space-y-4">
          <h4 className="font-medium">Personal Information</h4>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Show Real Name</p>
                  <p className="text-xs text-muted-foreground">
                    Display your full name on profile
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.showRealName}
                onCheckedChange={(checked) => updateSetting("showRealName", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Show Location</p>
                  <p className="text-xs text-muted-foreground">
                    Display your city and state
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.showLocation}
                onCheckedChange={(checked) => updateSetting("showLocation", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Show Tournament History</p>
                  <p className="text-xs text-muted-foreground">
                    Display your past tournaments
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.showTournamentHistory}
                onCheckedChange={(checked) => updateSetting("showTournamentHistory", checked)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Contact Information */}
        <div className="space-y-4">
          <h4 className="font-medium">Contact Information</h4>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Show Phone Number</p>
                  <p className="text-xs text-muted-foreground">
                    Allow others to see your phone
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.showPhone}
                onCheckedChange={(checked) => updateSetting("showPhone", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Show Email</p>
                  <p className="text-xs text-muted-foreground">
                    Allow others to see your email
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.showEmail}
                onCheckedChange={(checked) => updateSetting("showEmail", checked)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Interaction Settings */}
        <div className="space-y-4">
          <h4 className="font-medium">Interaction Settings</h4>

          <div className="space-y-3">
            <Label>Allow Friend Requests From</Label>
            <Select
              value={settings.allowFriendRequestsFrom}
              onValueChange={(value) => updateSetting("allowFriendRequestsFrom", value)}
            >
              <SelectTrigger className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EVERYONE">Everyone</SelectItem>
                <SelectItem value="NO_ONE">No One</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Allow Messages From</Label>
            <Select
              value={settings.allowMessagesFrom}
              onValueChange={(value) => updateSetting("allowMessagesFrom", value)}
            >
              <SelectTrigger className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EVERYONE">Everyone</SelectItem>
                <SelectItem value="FRIENDS">Friends Only</SelectItem>
                <SelectItem value="NO_ONE">No One</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
