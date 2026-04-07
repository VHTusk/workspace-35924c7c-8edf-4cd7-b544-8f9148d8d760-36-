"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { MfaSetup, MfaSettings } from "@/components/auth/mfa-setup";
import { Shield, KeyRound, Bell, Moon, Globe, ChevronRight } from "lucide-react";

export default function AdminSettingsPage() {
  const params = useParams();
  const sport = params.sport as string;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your admin account settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Security Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security
          </h2>
          
          {/* MFA Settings */}
          <MfaSettings />

          {/* Password */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">Password</CardTitle>
                  <CardDescription>
                    Change your admin password
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Change Password
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Preferences Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Preferences
          </h2>

          {/* Notifications */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">Notifications</CardTitle>
                  <CardDescription>
                    Configure notification preferences
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Manage Notifications
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Moon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">Appearance</CardTitle>
                  <CardDescription>
                    Light or dark mode settings
                  </CardDescription>
                </div>
                <Badge variant="secondary">System</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Change Theme
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>

          {/* Language */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">Language</CardTitle>
                  <CardDescription>
                    Select your preferred language
                  </CardDescription>
                </div>
                <Badge variant="secondary">English</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Change Language
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Session Info */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Session Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <span className="text-muted-foreground">Session Type:</span>
              <p className="font-medium">Administrator</p>
            </div>
            <div>
              <span className="text-muted-foreground">Session Timeout:</span>
              <p className="font-medium">8 hours</p>
            </div>
            <div>
              <span className="text-muted-foreground">Sport Context:</span>
              <p className="font-medium">{sport.toUpperCase()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
