"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MfaSetup } from "@/components/auth/mfa-setup";
import { Shield, AlertCircle, Loader2 } from "lucide-react";

export default function AdminMfaSetupPage() {
  const router = useRouter();
  const params = useParams();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    try {
      const response = await fetch('/api/admin/mfa/status');
      const data = await response.json();

      if (data.success) {
        setMfaRequired(data.data.required);
        setMfaEnabled(data.data.enabled);

        // If MFA is already enabled, redirect to admin
        if (data.data.enabled) {
          router.push(`/${sport}/admin`);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to check MFA status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    // Redirect to admin dashboard after MFA setup
    router.push(`/${sport}/admin`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4 py-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Secure Your Admin Account
            </h1>
            <p className="text-muted-foreground mt-2">
              Two-Factor Authentication is required for admin accounts
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            Security Requirement
          </Badge>
        </div>

        {/* Why MFA Alert */}
        <Alert className="border-primary/50 bg-primary/5">
          <Shield className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            <strong>Why is MFA required?</strong>
            <br />
            Admin accounts have elevated privileges that can affect the entire platform.
            Two-Factor Authentication adds an extra layer of security to protect against
            unauthorized access, even if your password is compromised.
          </AlertDescription>
        </Alert>

        {/* MFA Setup Component */}
        <MfaSetup onComplete={handleComplete} />

        {/* Security Tips */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Security Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Store your recovery codes in a secure location (password manager, safe, etc.)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Never share your authenticator codes or recovery codes with anyone
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Each recovery code can only be used once
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                If you lose your device and recovery codes, contact super admin for account recovery
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
