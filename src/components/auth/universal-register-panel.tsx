"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, Eye, EyeOff, Lock, Mail, MessageCircle, Phone, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GoogleOneTap from "@/components/auth/google-one-tap";
import { WhatsAppRegister } from "@/components/auth/whatsapp-register";
import { getAuthSportOption, normalizeAuthSport, type AuthSportSlug } from "@/components/auth/auth-sport-config";
import { AUTH_CODES, type AuthFieldErrors } from "@/lib/auth-contract";
import { parseAuthResponse } from "@/lib/auth-client";
import { toast } from "sonner";

type AccountType = "player" | "org";

type UniversalRegisterPanelProps = {
  initialSport?: string;
  successRedirect?: string;
  onSwitchToLogin?: () => void;
  onSuccess?: () => void;
};

const LANDING_AUTH_NOTICE_KEY = "valorhive:landing-auth-notice";

export function UniversalRegisterPanel({
  initialSport,
  successRedirect,
  onSwitchToLogin,
  onSuccess,
}: UniversalRegisterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSport, setSelectedSport] = useState<AuthSportSlug>(normalizeAuthSport(initialSport));
  const [accountType, setAccountType] = useState<AccountType>("player");
  const [loading, setLoading] = useState(false);
  const [useWhatsApp, setUseWhatsApp] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [acceptedMarketing, setAcceptedMarketing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [emailOrPhone, setEmailOrPhone] = useState(searchParams.get("phone") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSport(normalizeAuthSport(initialSport));
  }, [initialSport]);

  useEffect(() => {
    if (error) {
      toast.error(error, { id: "auth-register-error" });
    }
  }, [error]);

  const sport = getAuthSportOption(selectedSport);

  const passwordRules = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };

  const allPasswordRulesMet = Object.values(passwordRules).every(Boolean);

  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const isPhone = (value: string) =>
    /^[\+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(value.replace(/\s/g, ""));

  const clearIdentifierErrors = () => {
    setFieldErrors((current) => ({
      ...current,
      email: undefined,
      phone: undefined,
      identifier: undefined,
      emailOrPhone: undefined,
    }));
  };

  const handleWhatsAppSuccess = (data: { phone: string }) => {
    setPhoneVerified(true);
    setVerifiedPhone(data.phone);
    setUseWhatsApp(false);
    setEmailOrPhone(data.phone);
    clearIdentifierErrors();
  };

  const finishRegister = (destination: string, preserveDestination = false) => {
    if (!preserveDestination && successRedirect === "/" && typeof window !== "undefined") {
      window.sessionStorage.setItem(
        LANDING_AUTH_NOTICE_KEY,
        JSON.stringify({
          type: "register",
          title: accountType === "player" ? "Profile created" : "Account created",
          description: "Choose a sport from the Sports menu to get started.",
        }),
      );
    }
    onSuccess?.();
    router.push(preserveDestination ? destination : successRedirect || destination);
  };

  const finishGoogleAuth = (data: { code?: string; redirectTo?: string }) => {
    const destination = data.redirectTo || `/${selectedSport}/dashboard`;

    if (data.code === AUTH_CODES.LOGIN_SUCCESS) {
      if (successRedirect === "/" && typeof window !== "undefined") {
        window.sessionStorage.setItem(
          LANDING_AUTH_NOTICE_KEY,
          JSON.stringify({
            type: "login",
            title: "Logged in",
            description: "Choose a sport from the Sports menu to continue.",
          }),
        );
      }

      onSuccess?.();
      router.push(successRedirect || destination);
      return;
    }

    finishRegister(destination);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});

    const trimmedIdentifier = emailOrPhone.trim();
    const email = isEmail(trimmedIdentifier) ? trimmedIdentifier : undefined;
    const phone = !email && isPhone(trimmedIdentifier) ? trimmedIdentifier : undefined;

    if (accountType === "player" && !firstName.trim()) {
      setFieldErrors({ firstName: "First name is required." });
      setError("First name is required.");
      setLoading(false);
      return;
    }

    if (accountType === "player" && !lastName.trim()) {
      setFieldErrors({ lastName: "Last name is required." });
      setError("Last name is required.");
      setLoading(false);
      return;
    }

    if (accountType === "org" && !orgName.trim()) {
      setFieldErrors({ name: "Organization name is required." });
      setError("Organization name is required.");
      setLoading(false);
      return;
    }

    if (!trimmedIdentifier) {
      setFieldErrors({ emailOrPhone: "Please enter your email address or mobile number." });
      setError("Please enter your email address or mobile number.");
      setLoading(false);
      return;
    }

    if (!email && !phone) {
      setFieldErrors({ emailOrPhone: "Please enter a valid email address or mobile number." });
      setError("Please enter a valid email address or mobile number.");
      setLoading(false);
      return;
    }

    if (!password) {
      setFieldErrors({ password: "Password is required." });
      setError("Password is required.");
      setLoading(false);
      return;
    }

    if (!allPasswordRulesMet) {
      setFieldErrors({ password: "Password does not meet the requirements." });
      setError("Password does not meet the requirements.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Password and confirm password do not match." });
      setError("Password and confirm password do not match.");
      setLoading(false);
      return;
    }

    if (!acceptedLegal) {
      setError("Please accept the terms and policies to continue.");
      setLoading(false);
      return;
    }

    try {
      const endpoint = accountType === "player" ? "/api/auth/register" : "/api/auth/org/register";
      const body =
        accountType === "player"
          ? {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email,
              phone,
              password,
              confirmPassword,
              sport: selectedSport.toUpperCase(),
              phoneVerified: phoneVerified && verifiedPhone === phone,
              tosAccepted: acceptedLegal,
              privacyAccepted: acceptedLegal,
              tournamentAccepted: acceptedLegal,
              marketingAccepted: acceptedMarketing,
            }
            : {
                name: orgName.trim(),
                email,
                phone,
                password,
              confirmPassword,
              sport: selectedSport.toUpperCase(),
              phoneVerified: phoneVerified && verifiedPhone === phone,
              tosAccepted: acceptedLegal,
              privacyAccepted: acceptedLegal,
              marketingAccepted: acceptedMarketing,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const { data, error: authError } = await parseAuthResponse(
        response,
        "We could not complete your registration right now. Please try again.",
      );

      if (authError) {
        setError(authError.message);
        setFieldErrors(authError.fieldErrors);
        return;
      }

      if (accountType === "player") {
        if (data.emailVerificationPending && typeof data.user?.email === "string") {
          finishRegister(
            `/${selectedSport}/verify-email?pending=true&email=${encodeURIComponent(String(data.user.email))}`,
            true,
          );
          return;
        }

        finishRegister(`/${selectedSport}/dashboard`);
        return;
      }

      finishRegister(`/${selectedSport}/org/dashboard`);
    } catch (requestError) {
      console.error(requestError);
      setError("We could not complete your registration right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const identifierError =
    fieldErrors.emailOrPhone || fieldErrors.identifier || fieldErrors.email || fieldErrors.phone;

  return (
    <Card className="border-border/60 shadow-xl">
      <CardHeader className="space-y-4 px-4 pt-5 sm:px-6 sm:pt-6">
        <div className="space-y-2 text-center">
          <CardTitle className="text-2xl">Create your VALORHIVE account</CardTitle>
          <CardDescription>
            Set up your account to start joining tournaments and tracking results.
          </CardDescription>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setAccountType("player");
              setError("");
              setFieldErrors({});
            }}
            className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${
              accountType === "player"
                ? `${sport.accentButton} border-transparent text-white shadow-sm`
                : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <User className="h-4 w-4" />
            Player
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountType("org");
              setError("");
              setFieldErrors({});
            }}
            className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${
              accountType === "org"
                ? `${sport.accentButton} border-transparent text-white shadow-sm`
                : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Organization
          </button>
        </div>

      </CardHeader>

        <CardContent className="space-y-4 px-4 pb-5 sm:px-6 sm:pb-6">
          {accountType === "player" && (
            <GoogleOneTap
              sport={selectedSport}
              autoPrompt={false}
              anchorId="universal-register-google"
              onLoginSuccess={finishGoogleAuth}
            />
          )}

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-2 border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400"
          onClick={() => setUseWhatsApp(true)}
        >
          <MessageCircle className="h-5 w-5" />
          Register with WhatsApp
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or register with email or phone</span>
          </div>
        </div>

        {useWhatsApp ? (
          <div className="space-y-4">
            <WhatsAppRegister
              sport={selectedSport}
              initialPhone={searchParams.get("phone") || ""}
              onSuccess={handleWhatsAppSuccess}
              primaryBtnClass={sport.accentButton}
              primaryTextClass={sport.accentText}
            />
            {!phoneVerified && (
              <button
                type="button"
                onClick={() => setUseWhatsApp(false)}
                className={`w-full text-sm ${sport.accentText} hover:underline`}
              >
                Use email or password instead
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {accountType === "player" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="universal-register-first-name">First name</Label>
                  <Input
                    id="universal-register-first-name"
                    placeholder="Rahul"
                    value={firstName}
                    onChange={(event) => {
                      setFirstName(event.target.value);
                      setFieldErrors((current) => ({ ...current, firstName: undefined }));
                      setError("");
                    }}
                    aria-invalid={Boolean(fieldErrors.firstName)}
                  />
                  {fieldErrors.firstName && <p className="text-xs text-red-500">{fieldErrors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="universal-register-last-name">Last name</Label>
                  <Input
                    id="universal-register-last-name"
                    placeholder="Sharma"
                    value={lastName}
                    onChange={(event) => {
                      setLastName(event.target.value);
                      setFieldErrors((current) => ({ ...current, lastName: undefined }));
                      setError("");
                    }}
                    aria-invalid={Boolean(fieldErrors.lastName)}
                  />
                  {fieldErrors.lastName && <p className="text-xs text-red-500">{fieldErrors.lastName}</p>}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="universal-register-org-name">Organization name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="universal-register-org-name"
                      placeholder="Jaipur Sports Club"
                      value={orgName}
                      onChange={(event) => {
                        setOrgName(event.target.value);
                        setFieldErrors((current) => ({ ...current, name: undefined }));
                        setError("");
                      }}
                      className="pl-10"
                      aria-invalid={Boolean(fieldErrors.name)}
                    />
                  </div>
                  {fieldErrors.name && <p className="text-xs text-red-500">{fieldErrors.name}</p>}
                </div>

              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="universal-register-identifier">Email or phone</Label>
              <div className="relative">
                {isEmail(emailOrPhone) ? (
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                ) : (
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                )}
                <Input
                  id="universal-register-identifier"
                  type="text"
                  placeholder="you@example.com or +91 98765 43210"
                  value={emailOrPhone}
                  onChange={(event) => {
                    setEmailOrPhone(event.target.value);
                    setPhoneVerified(false);
                    clearIdentifierErrors();
                    setError("");
                  }}
                  className="pl-10"
                  aria-invalid={Boolean(identifierError)}
                />
                {phoneVerified && <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-600" />}
              </div>
              {identifierError && <p className="text-xs text-red-500">{identifierError}</p>}
              {phoneVerified && (
                <p className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Phone verified via WhatsApp
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="universal-register-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="universal-register-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                    setError("");
                  }}
                  className={`pl-10 pr-10 ${
                    !allPasswordRulesMet && password
                      ? "border-red-500 focus-visible:ring-red-500"
                      : allPasswordRulesMet
                        ? "border-green-500 focus-visible:ring-green-500"
                        : ""
                  }`}
                  aria-invalid={Boolean(fieldErrors.password)}
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
              {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}

              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Password must contain:</p>
                <div className="space-y-1.5 text-xs">
                  <PasswordRule passed={passwordRules.minLength} label="Minimum 8 characters" />
                  <PasswordRule passed={passwordRules.hasUppercase} label="At least 1 uppercase letter" />
                  <PasswordRule passed={passwordRules.hasLowercase} label="At least 1 lowercase letter" />
                  <PasswordRule passed={passwordRules.hasNumber} label="At least 1 number" />
                  <PasswordRule passed={passwordRules.hasSpecial} label="At least 1 special character (!@#$%^&*...)" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="universal-register-confirm-password">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="universal-register-confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
                    setError("");
                  }}
                  className="pl-10"
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                />
              </div>
              {fieldErrors.confirmPassword && <p className="text-xs text-red-500">{fieldErrors.confirmPassword}</p>}
              {!fieldErrors.confirmPassword && confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500">Password and confirm password do not match.</p>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="flex items-start gap-2">
                <Checkbox id="universal-legal" checked={acceptedLegal} onCheckedChange={(checked) => setAcceptedLegal(checked === true)} />
                <Label htmlFor="universal-legal" className="text-xs leading-snug text-muted-foreground">
                  I agree to the{" "}
                  <Link href="/legal/terms" className={`${sport.accentText} hover:underline`}>
                    Terms of Service
                  </Link>
                  ,{" "}
                  <Link href="/legal/privacy" className={`${sport.accentText} hover:underline`}>
                    Privacy Policy
                  </Link>
                  {accountType === "player" && (
                    <>
                      ,{" "}
                      <Link href="/legal/tournament-agreement" className={`${sport.accentText} hover:underline`}>
                        Tournament Agreement
                      </Link>{" "}
                      and{" "}
                      <Link href="/legal/liability-waiver" className={`${sport.accentText} hover:underline`}>
                        Liability Waiver
                      </Link>
                    </>
                  )}
                  <span className="ml-1 text-red-500">*</span>
                </Label>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="universal-marketing"
                  checked={acceptedMarketing}
                  onCheckedChange={(checked) => setAcceptedMarketing(checked === true)}
                />
                <Label htmlFor="universal-marketing" className="text-xs leading-snug text-muted-foreground">
                  <span className="text-muted-foreground/60">(Optional)</span> Send me updates about tournaments, promotions, and community news.
                </Label>
              </div>
            </div>

            <Button type="submit" className={`h-11 w-full gap-2 text-white ${sport.accentButton}`} disabled={loading || !acceptedLegal}>
              {loading ? "Creating account..." : "Create account"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          {onSwitchToLogin ? (
            <button type="button" onClick={onSwitchToLogin} className={`${sport.accentText} font-medium hover:underline`}>
              Sign in
            </button>
          ) : (
            <Link href="/?auth=login" className={`${sport.accentText} font-medium hover:underline`}>
              Sign in
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordRule({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={passed ? "text-green-600 dark:text-green-400" : "text-red-500"}>
        {passed ? "OK" : "NO"}
      </span>
      <span className={passed ? "text-green-700 dark:text-green-300" : "text-red-600 dark:text-red-400"}>
        {label}
      </span>
    </div>
  );
}
