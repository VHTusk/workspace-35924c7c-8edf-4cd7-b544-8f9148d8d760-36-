"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, Lock, ArrowLeft, CheckCircle, Loader2, Eye, EyeOff, 
  KeyRound, ArrowRight, ShieldCheck 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

type Step = "request" | "verify" | "success";

function ForgotPasswordForm() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  // Get token from URL if coming from email link
  const urlToken = searchParams.get("token");
  const urlEmail = searchParams.get("email");

  const primaryTextClass = isCornhole 
    ? "text-green-500 dark:text-green-400" 
    : "text-teal-500 dark:text-teal-400";
  const primaryBorderClass = isCornhole 
    ? "border-green-500/30" 
    : "border-teal-500/30";
  const primaryBgClass = isCornhole 
    ? "bg-green-500/10 dark:bg-green-500/20" 
    : "bg-teal-500/10 dark:bg-teal-500/20";
  const primaryBtnClass = isCornhole 
    ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600" 
    : "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600";

  const [step, setStep] = useState<Step>(urlToken ? "verify" : "request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Step 1: Request
  const [email, setEmail] = useState(urlEmail || "");
  
  // Step 2: Verify
  const [token, setToken] = useState(urlToken || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Password validation
  const passwordRules = {
    minLength: newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasLowercase: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
  };
  const allPasswordRulesMet = Object.values(passwordRules).every(Boolean);

  // Step 1: Request reset token
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          sport: sport.toUpperCase(),
          action: "request"
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to request reset");
        return;
      }

      // In development, token is returned - auto-fill it
      if (data.devToken) {
        setToken(data.devToken);
      }

      setStep("verify");
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Reset password with token
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!allPasswordRulesMet) {
      setError("Password does not meet all requirements");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          sport: sport.toUpperCase(),
          action: "reset",
          token,
          newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }

      setStep("success");
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        {/* Back Link */}
        <Link 
          href={`/${sport}/login`} 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>

        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <img src="/logo.png" alt="VALORHIVE" className="h-10 w-auto" />
            <span className="text-xl font-bold text-foreground">VALORHIVE</span>
          </Link>
          <Badge variant="outline" className={cn(primaryBorderClass, primaryTextClass, primaryBgClass)}>
            {isCornhole ? "Cornhole" : "Darts"}
          </Badge>
        </div>

        {/* Card */}
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className={cn(
              "w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center",
              primaryBgClass
            )}>
              {step === "request" && <Mail className={cn("w-6 h-6", primaryTextClass)} />}
              {step === "verify" && <KeyRound className={cn("w-6 h-6", primaryTextClass)} />}
              {step === "success" && <ShieldCheck className={cn("w-6 h-6", primaryTextClass)} />}
            </div>
            <CardTitle className="text-foreground">
              {step === "request" && "Forgot Password?"}
              {step === "verify" && "Reset Your Password"}
              {step === "success" && "Password Reset!"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {step === "request" && "Enter your email to receive a reset link"}
              {step === "verify" && "Enter the code from your email and your new password"}
              {step === "success" && "Your password has been updated successfully"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Step 1: Request Reset */}
            {step === "request" && (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className={cn("w-full text-white gap-2 h-11", primaryBtnClass)}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Step 2: Verify & Reset */}
            {step === "verify" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {/* Token Input */}
                <div className="space-y-2">
                  <Label htmlFor="token" className="text-foreground">Reset Code</Label>
                  <Input
                    id="token"
                    type="text"
                    placeholder="Enter code from email"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="font-mono text-center tracking-widest"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Check your email for the reset code
                  </p>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-foreground">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  
                  {/* Password Requirements */}
                  {newPassword && (
                    <div className="mt-2 space-y-1.5 p-3 bg-muted/30 rounded-lg border border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Password must contain:</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {[
                          { rule: passwordRules.minLength, text: "Minimum 8 characters" },
                          { rule: passwordRules.hasUppercase, text: "At least 1 uppercase letter" },
                          { rule: passwordRules.hasLowercase, text: "At least 1 lowercase letter" },
                          { rule: passwordRules.hasNumber, text: "At least 1 number" },
                          { rule: passwordRules.hasSpecial, text: "At least 1 special character" },
                        ].map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className={item.rule ? "text-green-500" : "text-red-500"}>
                              {item.rule ? "✓" : "✗"}
                            </span>
                            <span className={item.rule ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                  {confirmPassword && newPassword === confirmPassword && allPasswordRulesMet && (
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Passwords match
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className={cn("w-full text-white gap-2 h-11", primaryBtnClass)}
                  disabled={loading || !allPasswordRulesMet || newPassword !== confirmPassword}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      Reset Password
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep("request")}
                >
                  Didn't receive the code? Request again
                </Button>
              </form>
            )}

            {/* Step 3: Success */}
            {step === "success" && (
              <div className="text-center py-4">
                <div className={cn(
                  "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
                  "bg-green-500/10 dark:bg-green-500/20"
                )}>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-foreground font-medium mb-2">Password Reset Successfully!</p>
                <p className="text-sm text-muted-foreground mb-4">
                  You've been logged out of all devices. Please login with your new password.
                </p>
                <Link href={`/${sport}/login`}>
                  <Button className={cn("text-white", primaryBtnClass)}>
                    Go to Login
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ForgotPasswordForm />
    </Suspense>
  );
}
