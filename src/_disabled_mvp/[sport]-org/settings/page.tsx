"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import OrganizationLayoutWrapper from "@/components/org/organization-layout-wrapper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Settings,
  Save,
  Loader2,
  Trophy,
  Bell,
  Users,
  Clock,
  Target,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SPORT_CONFIGS: Record<string, { name: string; icon: string; color: string }> = {
  cornhole: { name: "Cornhole", icon: "🎯", color: "bg-green-500" },
  darts: { name: "Darts", icon: "🎯", color: "bg-teal-500" },
  badminton: { name: "Badminton", icon: "🏸", color: "bg-blue-500" },
  cricket: { name: "Cricket", icon: "🏏", color: "bg-orange-500" },
  football: { name: "Football", icon: "⚽", color: "bg-emerald-500" },
  "table-tennis": { name: "Table Tennis", icon: "🏓", color: "bg-purple-500" },
};

export default function SportSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const sportConfig = SPORT_CONFIGS[sport] || { name: sport, icon: "🏆", color: "bg-gray-500" };
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Sport-specific settings
  const [settings, setSettings] = useState({
    // Tournament defaults
    defaultMatchFormat: "SINGLES",
    defaultScoringType: "STANDARD",
    defaultMaxPlayers: 32,
    
    // Notifications
    notifyOnTournamentStart: true,
    notifyOnMatchComplete: true,
    notifyOnNewEmployee: false,
    
    // Display preferences
    showLeaderboardPublicly: true,
    showTournamentHistory: true,
    allowEmployeeRegistration: true,
    
    // Scoring preferences
    autoAdvanceWinners: true,
    requirePhotoVerification: false,
    allowSelfScoring: false,
  });

  useEffect(() => {
    fetchSettings();
  }, [sport]);

  const fetchSettings = async () => {
    setFetching(true);
    try {
      // In production, fetch from API
      // For now, use defaults
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setFetching(false);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      // In production, save to API
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(`${sportConfig.name} settings saved`);
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const primaryClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  if (fetching) {
    return (
      <OrganizationLayoutWrapper>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </OrganizationLayoutWrapper>
    );
  }

  return (
    <OrganizationLayoutWrapper>
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl", sportConfig.color)}>
          {sportConfig.icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{sportConfig.name} Settings</h1>
          <p className="text-gray-500 dark:text-gray-400">Configure preferences for this sport</p>
        </div>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Tournament Defaults */}
        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className={cn("w-5 h-5", primaryTextClass)} />
              Tournament Defaults
            </CardTitle>
            <CardDescription>Default settings for new tournaments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="matchFormat">Default Match Format</Label>
                <Select 
                  value={settings.defaultMatchFormat} 
                  onValueChange={(v) => setSettings({ ...settings, defaultMatchFormat: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLES">Singles (1v1)</SelectItem>
                    <SelectItem value="DOUBLES">Doubles (2v2)</SelectItem>
                    <SelectItem value="TEAM">Team (3-4 players)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scoringType">Default Scoring Type</Label>
                <Select 
                  value={settings.defaultScoringType} 
                  onValueChange={(v) => setSettings({ ...settings, defaultScoringType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">Standard</SelectItem>
                    <SelectItem value="RALLY">Rally Point</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPlayers">Default Max Participants</Label>
              <Input
                id="maxPlayers"
                type="number"
                value={settings.defaultMaxPlayers}
                onChange={(e) => setSettings({ ...settings, defaultMaxPlayers: parseInt(e.target.value) || 32 })}
                placeholder="32"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className={cn("w-5 h-5", primaryTextClass)} />
              Notifications
            </CardTitle>
            <CardDescription>Notification preferences for {sportConfig.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Tournament Start</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when tournaments begin</p>
              </div>
              <Switch
                checked={settings.notifyOnTournamentStart}
                onCheckedChange={(checked) => setSettings({ ...settings, notifyOnTournamentStart: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Match Complete</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when matches finish</p>
              </div>
              <Switch
                checked={settings.notifyOnMatchComplete}
                onCheckedChange={(checked) => setSettings({ ...settings, notifyOnMatchComplete: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">New Employee</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when employees register</p>
              </div>
              <Switch
                checked={settings.notifyOnNewEmployee}
                onCheckedChange={(checked) => setSettings({ ...settings, notifyOnNewEmployee: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Scoring Preferences */}
        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className={cn("w-5 h-5", primaryTextClass)} />
              Scoring Preferences
            </CardTitle>
            <CardDescription>How scoring works in {sportConfig.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Auto-Advance Winners</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Automatically advance winners to next round</p>
              </div>
              <Switch
                checked={settings.autoAdvanceWinners}
                onCheckedChange={(checked) => setSettings({ ...settings, autoAdvanceWinners: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Photo Verification</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Require photo proof for score submission</p>
              </div>
              <Switch
                checked={settings.requirePhotoVerification}
                onCheckedChange={(checked) => setSettings({ ...settings, requirePhotoVerification: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Allow Self-Scoring</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Let employees submit their own match scores</p>
              </div>
              <Switch
                checked={settings.allowSelfScoring}
                onCheckedChange={(checked) => setSettings({ ...settings, allowSelfScoring: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Display & Privacy */}
        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className={cn("w-5 h-5", primaryTextClass)} />
              Display & Privacy
            </CardTitle>
            <CardDescription>Visibility settings for {sportConfig.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Public Leaderboard</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Show leaderboard publicly</p>
              </div>
              <Switch
                checked={settings.showLeaderboardPublicly}
                onCheckedChange={(checked) => setSettings({ ...settings, showLeaderboardPublicly: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Tournament History</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Show past tournaments</p>
              </div>
              <Switch
                checked={settings.showTournamentHistory}
                onCheckedChange={(checked) => setSettings({ ...settings, showTournamentHistory: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Employee Registration</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Allow employees to self-register</p>
              </div>
              <Switch
                checked={settings.allowEmployeeRegistration}
                onCheckedChange={(checked) => setSettings({ ...settings, allowEmployeeRegistration: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Org-Level Settings Link */}
        <Card className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">Organization-Level Settings</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Password, security, billing, and profile settings</p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push("/org/settings")}
              >
                Go to Org Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button className={cn("text-white", primaryClass)} onClick={saveSettings} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </OrganizationLayoutWrapper>
  );
}
