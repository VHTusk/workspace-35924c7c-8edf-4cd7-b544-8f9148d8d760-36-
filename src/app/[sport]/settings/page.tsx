"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
  Lock,
  Bell,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  ScrollText,
  CheckCircle2,
  XCircle,
  Shield,
  Target,
  Users,
  Clock,
  Handshake,
  Medal,
  UserX,
  Trash2,
  Key,
  Smartphone,
  Monitor,
  MapPin,
  LogOut,
  Chrome,
  User,
  Phone,
  Mail,
  Trophy,
  Info,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface NotificationPrefs {
  emailNotifications: boolean;
  pushNotifications: boolean;
  matchResultNotifs: boolean;
  tournamentNotifs: boolean;
  pointsNotifs: boolean;
}

interface BlockedPlayer {
  id: string;
  blockedId: string;
  reason: string | null;
  isMute: boolean;
  blocked: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

interface Session {
  id: string;
  deviceName: string;
  deviceFingerprint: string;
  ipAddress: string;
  createdAt: string;
  lastActivityAt: string;
  isCurrent: boolean;
}

interface SecurityData {
  hasPassword: boolean;
  googleLinked: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  sessions: Session[];
}

interface PrivacySettings {
  showPhone: boolean;
  showEmail: boolean;
  showRealName: boolean;
  showLocation: boolean;
  showTournamentHistory: boolean;
  allowFriendRequestsFrom: string;
  allowMessagesFrom: string;
}

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  // Get initial tab from URL
  const initialTab = searchParams.get('tab') || 'account';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    emailNotifications: true,
    pushNotifications: true,
    matchResultNotifs: true,
    tournamentNotifs: true,
    pointsNotifs: true,
  });

  // Blocked players
  const [blockedPlayers, setBlockedPlayers] = useState<BlockedPlayer[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Security data
  const [securityData, setSecurityData] = useState<SecurityData | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    showPhone: false,
    showEmail: false,
    showRealName: true,
    showLocation: true,
    showTournamentHistory: true,
    allowFriendRequestsFrom: "EVERYONE",
    allowMessagesFrom: "EVERYONE",
  });
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Fetch notification preferences
        const notifRes = await fetch("/api/player/notification-preferences");
        if (notifRes.ok) {
          const data = await notifRes.json();
          setNotifPrefs({
            emailNotifications: data.emailNotifications ?? true,
            pushNotifications: data.pushNotifications ?? true,
            matchResultNotifs: data.matchResultNotifs ?? true,
            tournamentNotifs: data.tournamentNotifs ?? true,
            pointsNotifs: data.pointsNotifs ?? true,
          });
        }

        // Fetch blocked players
        const blockedRes = await fetch("/api/blocked-players");
        if (blockedRes.ok) {
          const data = await blockedRes.json();
          setBlockedPlayers(data.blockedPlayers);
        }

        // Fetch security data
        const securityRes = await fetch("/api/player/security");
        if (securityRes.ok) {
          const data = await securityRes.json();
          setSecurityData(data);
        }

        // Fetch privacy settings
        const privacyRes = await fetch("/api/player/privacy");
        if (privacyRes.ok) {
          const data = await privacyRes.json();
          setPrivacySettings({
            showPhone: data.showPhone ?? false,
            showEmail: data.showEmail ?? false,
            showRealName: data.showRealName ?? true,
            showLocation: data.showLocation ?? true,
            showTournamentHistory: data.showTournamentHistory ?? true,
            allowFriendRequestsFrom: data.allowFriendRequestsFrom || "EVERYONE",
            allowMessagesFrom: data.allowMessagesFrom || "EVERYONE",
          });
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      setSaving(false);
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/player/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to change password");
        return;
      }

      setSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleNotifChange = async (key: keyof NotificationPrefs, value: boolean) => {
    const newPrefs = { ...notifPrefs, [key]: value };
    setNotifPrefs(newPrefs);
    
    // Auto-save
    try {
      await fetch("/api/player/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      });
    } catch (err) {
      console.error("Failed to save notification preferences:", err);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    try {
      const res = await fetch(`/api/blocked-players?blockedId=${blockedId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBlockedPlayers((prev) => prev.filter((p) => p.blockedId !== blockedId));
        setSuccess("Player unblocked successfully");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err) {
      console.error("Failed to unblock player:", err);
      setError("Failed to unblock player");
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/player/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Session revoked successfully");
        fetchSecurityData();
      } else {
        toast.error("Failed to revoke session");
      }
    } catch (error) {
      toast.error("Failed to revoke session");
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      const response = await fetch("/api/player/sessions", {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("All other sessions revoked");
        fetchSecurityData();
      } else {
        toast.error("Failed to revoke sessions");
      }
    } catch (error) {
      toast.error("Failed to revoke sessions");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE MY ACCOUNT") {
      toast.error("Please type DELETE MY ACCOUNT to confirm");
      return;
    }

    try {
      const response = await fetch("/api/player/gdpr/delete", {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Account deletion initiated. You will be logged out.");
        router.push(`/${sport}`);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete account");
      }
    } catch (error) {
      toast.error("Failed to delete account");
    }
  };

  const fetchSecurityData = async () => {
    try {
      const response = await fetch("/api/player/security");
      if (response.ok) {
        const data = await response.json();
        setSecurityData(data);
      }
    } catch (error) {
      console.error("Failed to fetch security data:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handlePrivacyChange = async (key: keyof PrivacySettings, value: boolean | string) => {
    const newSettings = { ...privacySettings, [key]: value };
    setPrivacySettings(newSettings);
  };

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      const response = await fetch("/api/player/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(privacySettings),
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

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  // Sport-specific rules
  const sportRules = isCornhole ? [
    "Each team consists of 2 players (doubles format)",
    "Games are played to 21 points (cancellation scoring)",
    "Both teams stand on the same side and alternate throws",
    "A cornhole (bag in the hole) = 3 points",
    "A bag on the board = 1 point",
    "Bags that hit the ground first do not count",
    "Teams switch sides after each inning",
  ] : [
    "Standard matches consist of 501 or 301 points",
    "Each player throws 3 darts per turn",
    "Must finish on a double (or bullseye)",
    "A bust occurs if you score more than needed",
    "Bullseye (outer) = 25 points, Bullseye (inner) = 50 points",
    "Triple ring multiplies segment score by 3",
    "Double ring multiplies segment score by 2",
  ];

  const dosList = [
    "Arrive at least 15 minutes before your scheduled match",
    "Shake hands with your opponent before and after the match",
    "Report match results honestly and promptly",
    "Respect the decisions of tournament officials",
    "Maintain good sportsmanship at all times",
    "Keep the playing area clean",
    "Encourage fair play among all participants",
    "Follow the dress code if specified by the tournament",
  ];

  const dontsList = [
    "Do not argue with officials or opponents",
    "Do not use foul or abusive language",
    "Do not intentionally delay the game",
    "Do not distract opponents during their turn",
    "Do not consume alcohol before or during matches",
    "Do not share your account credentials with others",
    "Do not attempt to manipulate match results",
    "Do not harass or intimidate other players",
  ];

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72 min-h-screen">
        <div className="p-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">Manage your account preferences</p>
          </div>

          {/* Success Message */}
          {success && (
            <Alert className="mb-6 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700 dark:text-emerald-400">{success}</AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Settings Tabs */}
          <Tabs defaultValue={initialTab} className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="account" className="gap-2">
                <Lock className="w-4 h-4" />
                Account
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Shield className="w-4 h-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="w-4 h-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="privacy" className="gap-2">
                <Eye className="w-4 h-4" />
                Privacy
              </TabsTrigger>
              <TabsTrigger value="blocked" className="gap-2">
                <UserX className="w-4 h-4" />
                Blocked
              </TabsTrigger>
              <TabsTrigger value="rules" className="gap-2">
                <ScrollText className="w-4 h-4" />
                Rules
              </TabsTrigger>
            </TabsList>

            {/* Security Tab */}
            <TabsContent value="security">
              {/* Security Status */}
              <Card className="bg-card border-border shadow-sm mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Security Status</CardTitle>
                  <CardDescription>Overview of your account security</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Key className={cn("w-5 h-5", securityData?.hasPassword ? "text-green-500" : "text-amber-500")} />
                      <div>
                        <p className="text-xs text-muted-foreground">Password</p>
                        <p className="text-sm font-medium">
                          {securityData?.hasPassword ? "Set" : "Not Set"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Chrome className={cn("w-5 h-5", securityData?.googleLinked ? "text-green-500" : "text-muted-foreground")} />
                      <div>
                        <p className="text-xs text-muted-foreground">Google</p>
                        <p className="text-sm font-medium">
                          {securityData?.googleLinked ? "Linked" : "Not Linked"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Smartphone className={cn("w-5 h-5", securityData?.phoneVerified ? "text-green-500" : "text-amber-500")} />
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-sm font-medium">
                          {securityData?.phoneVerified ? "Verified" : "Unverified"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Shield className={cn("w-5 h-5", securityData?.emailVerified ? "text-green-500" : "text-amber-500")} />
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-medium">
                          {securityData?.emailVerified ? "Verified" : "Unverified"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Password Section */}
              <Card className="bg-card border-border shadow-sm mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    Password
                  </CardTitle>
                  <CardDescription>Change your password regularly for better security</CardDescription>
                </CardHeader>
                <CardContent>
                  {!showPasswordForm ? (
                    <Button
                      onClick={() => setShowPasswordForm(true)}
                      variant="outline"
                      className="gap-2"
                    >
                      <Key className="w-4 h-4" />
                      Change Password
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="secCurrentPassword">Current Password</Label>
                        <div className="relative">
                          <Input
                            id="secCurrentPassword"
                            type={showPasswords ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(!showPasswords)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secNewPassword">New Password</Label>
                        <Input
                          id="secNewPassword"
                          type={showPasswords ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secConfirmPassword">Confirm New Password</Label>
                        <Input
                          id="secConfirmPassword"
                          type={showPasswords ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={handlePasswordChange}
                          disabled={saving}
                          className={cn("text-white", primaryBtnClass)}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            "Update Password"
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => setShowPasswordForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Active Sessions */}
              <Card className="bg-card border-border shadow-sm mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Monitor className="w-5 h-5" />
                        Active Sessions
                      </CardTitle>
                      <CardDescription>Devices where you&apos;re currently logged in</CardDescription>
                    </div>
                    {securityData?.sessions && securityData.sessions.length > 1 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600">
                            <LogOut className="w-4 h-4 mr-2" />
                            Log out other devices
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Log out other devices?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will log you out of all other devices. You&apos;ll stay logged in on this device.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRevokeAllSessions} className="bg-red-600 hover:bg-red-700">
                              Log out other devices
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {securityData?.sessions?.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border",
                          session.isCurrent ? "border-primary/30 bg-primary/5" : "border-border/50"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-2 rounded-lg",
                            session.isCurrent ? primaryBgClass : "bg-muted/50"
                          )}>
                            <Monitor className={cn("w-5 h-5", session.isCurrent ? primaryTextClass : "text-muted-foreground")} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">
                                {session.deviceName || "Unknown Device"}
                              </p>
                              {session.isCurrent && (
                                <Badge variant="outline" className={cn(primaryTextClass)}>
                                  Current
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {session.ipAddress || "Unknown IP"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Last active: {formatDate(session.lastActivityAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {!session.isCurrent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeSession(session.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="bg-card border-red-200 dark:border-red-900/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-red-500 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription>Irreversible actions for your account</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
                    <div>
                      <p className="font-medium text-foreground">Delete Account</p>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete your account and all associated data
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="gap-2">
                          <Trash2 className="w-4 h-4" />
                          Delete Account
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-red-500">Delete Your Account?</AlertDialogTitle>
                          <AlertDialogDescription className="space-y-2">
                            <p>This action cannot be undone. This will permanently delete your:</p>
                            <ul className="list-disc list-inside text-sm space-y-1">
                              <li>Profile and personal information</li>
                              <li>Tournament history and statistics</li>
                              <li>Ratings and rankings</li>
                              <li>Messages and connections</li>
                            </ul>
                            <div className="mt-4 pt-4 border-t">
                              <Label htmlFor="deleteConfirm" className="text-foreground font-medium">
                                Type &quot;DELETE MY ACCOUNT&quot; to confirm:
                              </Label>
                              <Input
                                id="deleteConfirm"
                                value={deleteConfirmation}
                                onChange={(e) => setDeleteConfirmation(e.target.value)}
                                placeholder="DELETE MY ACCOUNT"
                                className="mt-2"
                              />
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirmation !== "DELETE MY ACCOUNT"}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete My Account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Account Tab */}
            <TabsContent value="account">
              <Card className="bg-card border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Change Password
                  </CardTitle>
                  <CardDescription>Update your account password</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword" className="text-foreground">Current Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="currentPassword"
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          className="pl-10 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                          tabIndex={-1}
                          aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="text-foreground">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min 8 characters"
                          className="pl-10 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                          tabIndex={-1}
                          aria-label={showNewPassword ? "Hide password" : "Show password"}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-foreground">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="pl-10 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                          tabIndex={-1}
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className={cn("text-white gap-2", primaryBtnClass)}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <Card className="bg-card border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>Choose how you want to be notified</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Email Notifications */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-foreground">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={notifPrefs.emailNotifications}
                      onCheckedChange={(checked) => handleNotifChange("emailNotifications", checked)}
                    />
                  </div>

                  {/* Push Notifications */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-foreground">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive push notifications on your device</p>
                    </div>
                    <Switch
                      checked={notifPrefs.pushNotifications}
                      onCheckedChange={(checked) => handleNotifChange("pushNotifications", checked)}
                    />
                  </div>

                  <div className="border-t border-border pt-4">
                    <h4 className="font-medium text-foreground mb-4">What to notify</h4>
                    
                    {/* Match Results */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 mb-3">
                      <div>
                        <p className="font-medium text-foreground">Match Results</p>
                        <p className="text-sm text-muted-foreground">When a match result is submitted</p>
                      </div>
                      <Switch
                        checked={notifPrefs.matchResultNotifs}
                        onCheckedChange={(checked) => handleNotifChange("matchResultNotifs", checked)}
                      />
                    </div>

                    {/* Tournament Updates */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 mb-3">
                      <div>
                        <p className="font-medium text-foreground">Tournament Updates</p>
                        <p className="text-sm text-muted-foreground">Reminders, schedule changes, and announcements</p>
                      </div>
                      <Switch
                        checked={notifPrefs.tournamentNotifs}
                        onCheckedChange={(checked) => handleNotifChange("tournamentNotifs", checked)}
                      />
                    </div>

                    {/* Points Updates */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                      <div>
                        <p className="font-medium text-foreground">Points & Ranking</p>
                        <p className="text-sm text-muted-foreground">When you earn points or change tier</p>
                      </div>
                      <Switch
                        checked={notifPrefs.pointsNotifs}
                        onCheckedChange={(checked) => handleNotifChange("pointsNotifs", checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Tab */}
            <TabsContent value="privacy">
              <Card className="bg-card border-border shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground flex items-center gap-2">
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
                          checked={privacySettings.showRealName}
                          onCheckedChange={(checked) => handlePrivacyChange("showRealName", checked)}
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
                          checked={privacySettings.showLocation}
                          onCheckedChange={(checked) => handlePrivacyChange("showLocation", checked)}
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
                          checked={privacySettings.showTournamentHistory}
                          onCheckedChange={(checked) => handlePrivacyChange("showTournamentHistory", checked)}
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
                          checked={privacySettings.showPhone}
                          onCheckedChange={(checked) => handlePrivacyChange("showPhone", checked)}
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
                          checked={privacySettings.showEmail}
                          onCheckedChange={(checked) => handlePrivacyChange("showEmail", checked)}
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
                        value={privacySettings.allowFriendRequestsFrom}
                        onValueChange={(value) => handlePrivacyChange("allowFriendRequestsFrom", value)}
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
                        value={privacySettings.allowMessagesFrom}
                        onValueChange={(value) => handlePrivacyChange("allowMessagesFrom", value)}
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

            {/* Blocked Players Tab */}
            <TabsContent value="blocked">
              <Card className="bg-card border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <UserX className="w-5 h-5" />
                    Blocked Players
                  </CardTitle>
                  <CardDescription>Manage players you&apos;ve blocked or muted</CardDescription>
                </CardHeader>
                <CardContent>
                  {blockedPlayers.length === 0 ? (
                    <div className="text-center py-12">
                      <div className={cn("w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center", primaryBgClass)}>
                        <Users className={cn("w-8 h-8", primaryTextClass)} />
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">No blocked players</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        You haven&apos;t blocked any players. Blocking prevents a player from messaging you or matching with you in tournaments.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {blockedPlayers.map((bp) => (
                        <div
                          key={bp.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", primaryBgClass)}>
                              <span className={cn("text-sm font-medium", primaryTextClass)}>
                                {bp.blocked.firstName.charAt(0)}{bp.blocked.lastName.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {bp.blocked.firstName} {bp.blocked.lastName}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn("text-xs px-2 py-0.5 rounded-full", bp.isMute ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                                  {bp.isMute ? "Muted" : "Blocked"}
                                </span>
                                {bp.reason && (
                                  <span className="text-xs text-muted-foreground">
                                    Reason: {bp.reason}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnblock(bp.blockedId)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Unblock
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rules & Conduct Tab */}
            <TabsContent value="rules">
              <div className="space-y-6">
                {/* Sport Rules */}
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Target className={cn("w-5 h-5", primaryTextClass)} />
                      {isCornhole ? "Cornhole" : "Darts"} Rules
                    </CardTitle>
                    <CardDescription>Official game rules for {isCornhole ? "Cornhole" : "Darts"} tournaments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {sportRules.map((rule, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <span className={cn("flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium text-white", primaryBtnClass)}>
                            {index + 1}
                          </span>
                          <span className="text-foreground">{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Do's */}
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      Do&apos;s - Best Practices
                    </CardTitle>
                    <CardDescription>Follow these guidelines for a great tournament experience</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {dosList.map((item, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span className="text-foreground">{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Don'ts */}
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-500" />
                      Don&apos;ts - Prohibited Actions
                    </CardTitle>
                    <CardDescription>Avoid these actions to maintain fair play</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {dontsList.map((item, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <span className="text-foreground">{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Fair Play Notice */}
                <Card className={cn("border-l-4", isCornhole ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/20" : "border-l-teal-500 bg-teal-50/50 dark:bg-teal-950/20")}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Handshake className={cn("w-6 h-6 flex-shrink-0", primaryTextClass)} />
                      <div>
                        <h4 className="font-medium text-foreground mb-1">Fair Play Commitment</h4>
                        <p className="text-sm text-muted-foreground">
                          VALORHIVE is committed to maintaining a fair and enjoyable competitive environment. 
                          Violations of the code of conduct may result in warnings, point deductions, or account suspension. 
                          Report any misconduct to tournament officials or through our support channels.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
