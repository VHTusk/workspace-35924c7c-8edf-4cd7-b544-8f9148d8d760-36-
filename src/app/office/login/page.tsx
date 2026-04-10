"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Shield, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OfficeLoginResponse = {
  success?: boolean;
  error?: string;
  requireMfa?: boolean;
  message?: string;
  office?: {
    role?: string;
    redirectPath?: string;
  };
  mfaStatus?: {
    required?: boolean;
    enabled?: boolean;
    setup?: boolean;
  };
};

export default function OfficeLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (withMfa: boolean) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          mfaCode: withMfa ? mfaCode : undefined,
        }),
      });

      const data = (await response.json()) as OfficeLoginResponse;

      if (!response.ok) {
        setError(data.error || "We could not sign you in right now.");
        return;
      }

      if (data.requireMfa && !withMfa) {
        setStep("mfa");
        return;
      }

      if (!data.success) {
        setError(data.error || data.message || "We could not sign you in right now.");
        return;
      }

      if (data.mfaStatus?.required && data.mfaStatus.setup === false) {
        router.push("/office/mfa-setup");
        return;
      }

      router.push(data.office?.redirectPath || "/office");
    } catch (requestError) {
      console.error(requestError);
      setError("We could not sign you in right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background px-4 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/logo.png" alt="VALORHIVE" width={56} height={56} className="h-14 w-auto" priority />
            <span className="text-xl font-semibold text-foreground">VALORHIVE</span>
          </Link>
        </div>

        <Card className="border-border/60 shadow-xl">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <CardTitle>Office Login</CardTitle>
              <CardDescription>For super admin, sport admin, state admin, and district admin access.</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === "credentials" ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit(false);
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="office-email">Email</Label>
                  <Input
                    id="office-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="office@valorhive.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="office-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="office-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit(true);
                }}
              >
                <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 text-center">
                  <Smartphone className="mx-auto mb-3 h-6 w-6 text-primary" />
                  <p className="font-medium text-foreground">Two-factor authentication</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter the 6-digit code from your authenticator app to continue.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="office-mfa">Verification code</Label>
                  <Input
                    id="office-mfa"
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="text-center text-lg tracking-[0.4em]"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("credentials")}>
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
