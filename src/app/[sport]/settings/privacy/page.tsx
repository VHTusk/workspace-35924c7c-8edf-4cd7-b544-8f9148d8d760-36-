"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Lock,
  Eye,
  EyeOff,
  Users,
  Shield,
  UserX,
  Loader2,
  CheckCircle,
  Trash2,
  AlertTriangle,
} from "lucide-react";

interface BlockedPlayer {
  id: string;
  blockedPlayer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  blockedAt: string;
}

interface PrivacySettings {
  profileVisibility: "public" | "registered" | "private";
  showEmail: boolean;
  showPhone: boolean;
  showLocation: boolean;
  showStats: boolean;
  allowMessages: "everyone" | "followers" | "none";
  showOnlineStatus: boolean;
  searchableByEmail: boolean;
  searchableByPhone: boolean;
}

export default function PrivacySettingsPage() {
  const params = useParams();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>({
    profileVisibility: "registered",
    showEmail: false,
    showPhone: false,
    showLocation: true,
    showStats: true,
    allowMessages: "followers",
    showOnlineStatus: true,
    searchableByEmail: true,
    searchableByPhone: true,
  });
  const [blockedPlayers, setBlockedPlayers] = useState<BlockedPlayer[]>([]);
  const [unblockDialog, setUnblockDialog] = useState<string | null>(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchData();
  }, [sport]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [privacyRes, blockedRes] = await Promise.all([
        fetch(`/api/player/privacy?sport=${sport.toUpperCase()}`),
        fetch("/api/blocked-players"),
      ]);
      
      if (privacyRes.ok) {
        const data = await privacyRes.json();
        setSettings({ ...settings, ...data });
      }
      if (blockedRes.ok) {
        const data = await blockedRes.json();
        setBlockedPlayers(data.blockedPlayers || []);
      }
    } catch (error) {
      console.error("Failed to fetch privacy settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/player/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport: sport.toUpperCase(), ...settings }),
      });
      if (response.ok) {
        setSuccess("Privacy settings saved successfully");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (error) {
      console.error("Failed to save privacy settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (blockId: string) => {
    try {
      const response = await fetch(`/api/blocked-players/${blockId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setBlockedPlayers((prev) => prev.filter((b) => b.id !== blockId));
        setUnblockDialog(null);
      }
    } catch (error) {
      console.error("Failed to unblock player:", error);
    }
  };

  const updateSetting = (key: keyof PrivacySettings, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
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
            <Lock className="w-8 h-8 text-primary" />
            Privacy Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Control who can see your information and contact you
          </p>
        </div>

        {success && (
          <Alert className="mb-6 bg-green-500/10 border-green-500/30 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Profile Visibility */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-400" />
              Profile Visibility
            </CardTitle>
            <CardDescription>Control who can see your profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Profile Visibility</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Who can view your profile
                </p>
              </div>
              <div className="flex gap-2">
                {[
                  { value: "public", label: "Public" },
                  { value: "registered", label: "Registered" },
                  { value: "private", label: "Private" },
                ].map((option) => (
                  <Badge
                    key={option.value}
                    variant={settings.profileVisibility === option.value ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => updateSetting("profileVisibility", option.value as "public" | "registered" | "private")}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Information Visibility */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-amber-400" />
              Information Visibility
            </CardTitle>
            <CardDescription>Control what information is shown on your profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Show Email Address</Label>
              <Switch checked={settings.showEmail} onCheckedChange={(v) => updateSetting("showEmail", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Phone Number</Label>
              <Switch checked={settings.showPhone} onCheckedChange={(v) => updateSetting("showPhone", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Location</Label>
              <Switch checked={settings.showLocation} onCheckedChange={(v) => updateSetting("showLocation", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Statistics</Label>
              <Switch checked={settings.showStats} onCheckedChange={(v) => updateSetting("showStats", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Online Status</Label>
              <Switch checked={settings.showOnlineStatus} onCheckedChange={(v) => updateSetting("showOnlineStatus", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Messaging */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-400" />
              Messaging
            </CardTitle>
            <CardDescription>Control who can send you messages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>Who can message you</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Control who can send you direct messages
                </p>
              </div>
              <div className="flex gap-2">
                {[
                  { value: "everyone", label: "Everyone" },
                  { value: "followers", label: "Followers" },
                  { value: "none", label: "No one" },
                ].map((option) => (
                  <Badge
                    key={option.value}
                    variant={settings.allowMessages === option.value ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => updateSetting("allowMessages", option.value as "everyone" | "followers" | "none")}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Searchability */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              Search & Discovery
            </CardTitle>
            <CardDescription>Control how others can find you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Searchable by Email</Label>
                <p className="text-xs text-muted-foreground">Allow others to find you by your email</p>
              </div>
              <Switch checked={settings.searchableByEmail} onCheckedChange={(v) => updateSetting("searchableByEmail", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Searchable by Phone</Label>
                <p className="text-xs text-muted-foreground">Allow others to find you by your phone number</p>
              </div>
              <Switch checked={settings.searchableByPhone} onCheckedChange={(v) => updateSetting("searchableByPhone", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Blocked Players */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-400" />
              Blocked Players
            </CardTitle>
            <CardDescription>Manage players you have blocked</CardDescription>
          </CardHeader>
          <CardContent>
            {blockedPlayers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Blocked On</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedPlayers.map((bp) => (
                    <TableRow key={bp.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{bp.blockedPlayer.firstName} {bp.blockedPlayer.lastName}</p>
                          <p className="text-xs text-muted-foreground">{bp.blockedPlayer.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(bp.blockedAt).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setUnblockDialog(bp.id)}>
                          <UserX className="w-4 h-4 mr-1" /> Unblock
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-4">No blocked players</p>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
            Save Settings
          </Button>
        </div>

        {/* Unblock Dialog */}
        <Dialog open={!!unblockDialog} onOpenChange={() => setUnblockDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unblock Player</DialogTitle>
              <DialogDescription>
                Are you sure you want to unblock this player? They will be able to see your profile and send you messages.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUnblockDialog(null)}>Cancel</Button>
              <Button onClick={() => unblockDialog && handleUnblock(unblockDialog)}>
                Unblock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
