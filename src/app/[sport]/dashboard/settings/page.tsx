"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, User, Bell, Shield, Palette, Loader2, Check, AlertCircle, Info, MapPin, Phone, Mail, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UserSettings {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    tournaments: boolean;
    matches: boolean;
    news: boolean;
  };
  privacy: {
    showPhone: boolean;
    showEmail: boolean;
    showRealName: boolean;
    showLocation: boolean;
    showTournamentHistory: boolean;
    allowFriendRequestsFrom: string;
    allowMessagesFrom: string;
  };
  preferences: {
    language: string;
    theme: string;
  };
}

export default function DashboardSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const primaryClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  useEffect(() => {
    fetchSettings();
  }, [sport]);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/player/settings", {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        // Ensure privacy settings have defaults
        const settingsWithDefaults = {
          ...data,
          privacy: {
            showPhone: data.privacy?.showPhone ?? false,
            showEmail: data.privacy?.showEmail ?? false,
            showRealName: data.privacy?.showRealName ?? true,
            showLocation: data.privacy?.showLocation ?? true,
            showTournamentHistory: data.privacy?.showTournamentHistory ?? true,
            allowFriendRequestsFrom: data.privacy?.allowFriendRequestsFrom || "EVERYONE",
            allowMessagesFrom: data.privacy?.allowMessagesFrom || "EVERYONE",
          }
        };
        setSettings(settingsWithDefaults);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch("/api/player/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to save settings");
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    if (!settings?.privacy) return;
    
    setSavingPrivacy(true);
    try {
      const response = await fetch("/api/player/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings.privacy),
      });

      if (response.ok) {
        toast.success("Privacy settings saved");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSavingPrivacy(false);
    }
  };

  const updateSettings = (path: string, value: boolean | string) => {
    if (!settings) return;
    
    const keys = path.split(".");
    const newSettings = { ...settings };
    let current: Record<string, unknown> = newSettings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]] as Record<string, unknown>;
    }
    
    current[keys[keys.length - 1]] = value;
    setSettings(newSettings);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
        <p className="text-muted-foreground">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Privacy</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>Update your personal information</CardDescription>
                </div>
                <Button onClick={handleSave} disabled={saving} className={cn("text-white", primaryClass)}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : saved ? <Check className="w-4 h-4 mr-2" /> : null}
                  {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={settings.firstName}
                    onChange={(e) => updateSettings("firstName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={settings.lastName}
                    onChange={(e) => updateSettings("lastName", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={settings.email} disabled />
                  <Badge variant="outline" className="text-xs">Verified</Badge>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={settings.phone}
                    onChange={(e) => updateSettings("phone", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={settings.city}
                    onChange={(e) => updateSettings("city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={settings.state}
                    onChange={(e) => updateSettings("state", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notifications
                  </CardTitle>
                  <CardDescription>Manage how you receive notifications</CardDescription>
                </div>
                <Button onClick={handleSave} disabled={saving} className={cn("text-white", primaryClass)}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : saved ? <Check className="w-4 h-4 mr-2" /> : null}
                  {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch
                  checked={settings.notifications.email}
                  onCheckedChange={(checked) => updateSettings("notifications.email", checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive push notifications in browser</p>
                </div>
                <Switch
                  checked={settings.notifications.push}
                  onCheckedChange={(checked) => updateSettings("notifications.push", checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Tournament Reminders</p>
                  <p className="text-sm text-muted-foreground">Get notified about upcoming tournaments</p>
                </div>
                <Switch
                  checked={settings.notifications.tournaments}
                  onCheckedChange={(checked) => updateSettings("notifications.tournaments", checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Match Results</p>
                  <p className="text-sm text-muted-foreground">Get notified about match results</p>
                </div>
                <Switch
                  checked={settings.notifications.matches}
                  onCheckedChange={(checked) => updateSettings("notifications.matches", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className={cn("w-5 h-5", primaryTextClass)} />
                    Privacy Controls
                  </CardTitle>
                  <CardDescription>Control who can see your personal information</CardDescription>
                </div>
                <Button onClick={handleSavePrivacy} disabled={savingPrivacy} size="sm" className="gap-2">
                  {savingPrivacy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  {savingPrivacy ? "Saving..." : "Save Changes"}
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
                      checked={settings.privacy.showRealName}
                      onCheckedChange={(checked) => updateSettings("privacy.showRealName", checked)}
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
                      checked={settings.privacy.showLocation}
                      onCheckedChange={(checked) => updateSettings("privacy.showLocation", checked)}
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
                      checked={settings.privacy.showTournamentHistory}
                      onCheckedChange={(checked) => updateSettings("privacy.showTournamentHistory", checked)}
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
                      checked={settings.privacy.showPhone}
                      onCheckedChange={(checked) => updateSettings("privacy.showPhone", checked)}
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
                      checked={settings.privacy.showEmail}
                      onCheckedChange={(checked) => updateSettings("privacy.showEmail", checked)}
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
                    value={settings.privacy.allowFriendRequestsFrom}
                    onValueChange={(value) => updateSettings("privacy.allowFriendRequestsFrom", value)}
                  >
                    <SelectTrigger className="w-full md:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EVERYONE">Everyone</SelectItem>
                      <SelectItem value="FRIENDS_OF_FRIENDS">Friends of Friends</SelectItem>
                      <SelectItem value="NO_ONE">No One</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Allow Messages From</Label>
                  <Select
                    value={settings.privacy.allowMessagesFrom}
                    onValueChange={(value) => updateSettings("privacy.allowMessagesFrom", value)}
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
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Preferences
                  </CardTitle>
                  <CardDescription>Customize your experience</CardDescription>
                </div>
                <Button onClick={handleSave} disabled={saving} className={cn("text-white", primaryClass)}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : saved ? <Check className="w-4 h-4 mr-2" /> : null}
                  {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={settings.preferences.language}
                    onValueChange={(value) => updateSettings("preferences.language", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    value={settings.preferences.theme}
                    onValueChange={(value) => updateSettings("preferences.theme", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
