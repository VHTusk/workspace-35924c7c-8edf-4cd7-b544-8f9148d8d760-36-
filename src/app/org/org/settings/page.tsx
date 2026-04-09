"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OrgSidebar from "@/components/layout/org-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Settings,
  Bell,
  Shield,
  Globe,
  Loader2,
  AlertCircle,
  CheckCircle,
  Save,
  ArrowLeft,
} from "lucide-react";

interface OrgData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  type: string;
  city?: string;
  state?: string;
}

export default function OrgSettingsPage() {
  const router = useRouter();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [tournamentReminders, setTournamentReminders] = useState(true);
  const [resultAlerts, setResultAlerts] = useState(true);

  useEffect(() => {
    fetchOrgData();
  }, []);

  const fetchOrgData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/org/me", {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/org/login");
          return;
        }
        throw new Error("Failed to fetch organization data");
      }

      const data = await response.json();
      setOrg(data);
    } catch (err) {
      console.error("Failed to fetch org data:", err);
      setError("Failed to load organization data");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/org/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          emailNotifications,
          smsNotifications,
          tournamentReminders,
          resultAlerts,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save notification settings");
      }

      setSuccess("Notification settings saved successfully");
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError("Failed to save notification settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <OrgSidebar />
        <main className="ml-0 md:ml-72">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading settings...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <OrgSidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6 space-y-6 max-w-4xl">
          {/* Header */}
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push("/org/home")}
              className="mb-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Organization Settings
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage your organization preferences and configurations
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="bg-green-50 border-green-200 text-green-700">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Settings Tabs */}
          <Tabs defaultValue="notifications" className="space-y-4">
            <TabsList className="bg-white dark:bg-gray-800">
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="w-4 h-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Shield className="w-4 h-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="preferences" className="gap-2">
                <Globe className="w-4 h-4" />
                Preferences
              </TabsTrigger>
            </TabsList>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <Card className="bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Control how and when you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Receive notifications via email
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="sms-notifications">SMS Notifications</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Receive important updates via SMS
                      </p>
                    </div>
                    <Switch
                      id="sms-notifications"
                      checked={smsNotifications}
                      onCheckedChange={setSmsNotifications}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="tournament-reminders">Tournament Reminders</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Get reminders about upcoming tournaments
                      </p>
                    </div>
                    <Switch
                      id="tournament-reminders"
                      checked={tournamentReminders}
                      onCheckedChange={setTournamentReminders}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="result-alerts">Result Alerts</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Get notified when match results are published
                      </p>
                    </div>
                    <Switch
                      id="result-alerts"
                      checked={resultAlerts}
                      onCheckedChange={setResultAlerts}
                    />
                  </div>

                  <Button
                    onClick={handleSaveNotifications}
                    disabled={saving}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security">
              <Card className="bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Manage your organization's security preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Password and security settings can be managed in the sport workspace settings.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => router.push("/cornhole/org/settings")}
                    >
                      Go to Security Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences">
              <Card className="bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle>Organization Preferences</CardTitle>
                  <CardDescription>
                    Configure organization-wide preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Additional preferences can be configured in your sport workspace settings.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
