"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, MessageCircle, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GoogleOneTap from "@/components/auth/google-one-tap";
import { WhatsAppLogin } from "@/components/auth/whatsapp-login";
import { AUTH_SPORTS, getAuthSportOption, normalizeAuthSport, type AuthSportSlug } from "@/components/auth/auth-sport-config";
import { AUTH_CODES, type AuthFieldErrors } from "@/lib/auth-contract";
import { parseAuthResponse } from "@/lib/auth-client";
import { toast } from "sonner";

type UniversalLoginPanelProps = {
  initialSport?: string;
  hideSportSelection?: boolean;
  successRedirect?: string;
  onSwitchToRegister?: () => void;
  onSuccess?: () => void;
};

const LANDING_AUTH_NOTICE_KEY = "valorhive:landing-auth-notice";

export function UniversalLoginPanel({
  initialSport,
  hideSportSelection = false,
  successRedirect,
  onSwitchToRegister,
  onSuccess,
}: UniversalLoginPanelProps) {
  const searchParams = useSearchParams();
  const [selectedSport, setSelectedSport] = useState<AuthSportSlug>(normalizeAuthSport(initialSport));
  const [loading, setLoading] = useState(false);
  const [useWhatsApp, setUseWhatsApp] = useState(false);
  const [emailOrPhone, setEmailOrPhone] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionEmail, setActionEmail] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSport(normalizeAuthSport(initialSport));
  }, [initialSport]);

  useEffect(() => {
    if (error) {
      toast.error(error, { id: "auth-login-error" });
    }
  }, [error]);

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage, { id: "auth-login-success" });
    }
  }, [successMessage]);

  const sport = getAuthSportOption(selectedSport);

  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const isPhone = (value: string) =>
    /^[\+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(value.replace(/\s/g, ""));

  const identifierIcon = useMemo(() => {
    return isEmail(emailOrPhone) ? (
      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
    ) : (
      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
    );
  }, [emailOrPhone]);

  const clearIdentifierErrors = () => {
    setFieldErrors((current) => ({
      ...current,
      email: undefined,
      phone: undefined,
      identifier: undefined,
      emailOrPhone: undefined,
    }));
  };

  const finishLogin = (destination?: string) => {
    if (successRedirect === "/" && (!destination || destination === "/") && typeof window !== "undefined") {
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
    const finalDestination =
      successRedirect === "/" && destination && destination !== "/" ? destination : successRedirect || destination || `/${selectedSport}/dashboard`;
    window.location.href = finalDestination;
  };

  const applyErrorState = (
    code: string | null,
    message: string,
    nextFieldErrors: AuthFieldErrors = {},
    email?: string,
  ) => {
    setErrorCode(code);
    setError(message);
    setFieldErrors(nextFieldErrors);
    if (email) {
      setActionEmail(email);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setErrorCode(null);
    setFieldErrors({});
    setSuccessMessage(null);
    setActionEmail(null);

    const trimmedIdentifier = emailOrPhone.trim();
    const email = isEmail(trimmedIdentifier) ? trimmedIdentifier : undefined;
    const phone = !email && isPhone(trimmedIdentifier) ? trimmedIdentifier : undefined;

    if (!trimmedIdentifier) {
      applyErrorState(
        AUTH_CODES.REQUIRED_FIELD_MISSING,
        "Please enter your email address or mobile number.",
        { emailOrPhone: "Please enter your email address or mobile number." },
      );
      setLoading(false);
      return;
    }

    if (!email && !phone) {
      applyErrorState(
        AUTH_CODES.INVALID_IDENTIFIER_FORMAT,
        "Please enter a valid email address or mobile number.",
        { emailOrPhone: "Please enter a valid email address or mobile number." },
      );
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      applyErrorState(
        AUTH_CODES.PASSWORD_REQUIRED,
        "Password is required.",
        { password: "Password is required." },
      );
      setLoading(false);
      return;
    }

    try {
      const playerResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          password,
          sport: selectedSport.toUpperCase(),
        }),
      });

      const { data: playerData, error: playerError } = await parseAuthResponse(
        playerResponse,
        "We could not sign you in right now. Please try again.",
      );

      if (!playerError) {
        finishLogin(searchParams.get("redirect") || undefined);
        return;
      }

      if (playerError.code === AUTH_CODES.USER_NOT_FOUND) {
        const orgResponse = await fetch("/api/auth/org/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            phone,
            password,
            sport: selectedSport.toUpperCase(),
          }),
        });

        const { data: orgData, error: orgError } = await parseAuthResponse(
          orgResponse,
          "We could not sign you in right now. Please try again.",
        );

          if (!orgError) {
            finishLogin("/org/home");
            return;
          }

        applyErrorState(
          orgError.code ?? playerError.code,
          orgError.code === AUTH_CODES.USER_NOT_FOUND ? playerError.message : orgError.message,
          orgError.fieldErrors,
        );
        return;
      }

      applyErrorState(
        playerError.code,
        playerError.message,
        playerError.fieldErrors,
        typeof playerData.email === "string" ? playerData.email : undefined,
      );
    } catch (requestError) {
      console.error(requestError);
      applyErrorState(
        AUTH_CODES.NETWORK_ERROR,
        "We could not sign you in right now. Please check your connection and try again.",
      );
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
          <CardTitle className="text-2xl">Log in to VALORHIVE</CardTitle>
          <CardDescription>
            Access your tournaments, rankings, and account settings.
          </CardDescription>
        </div>

        {!hideSportSelection && (
          <div className="grid gap-3 sm:grid-cols-2">
            {AUTH_SPORTS.map((option) => {
              const Icon = option.icon;
              const selected = option.slug === selectedSport;

              return (
                <button
                  key={option.slug}
                  type="button"
                  onClick={() => setSelectedSport(option.slug)}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    selected
                      ? `${option.accentBorder} ${option.accentBackground} shadow-sm`
                      : `border-border/60 bg-background ${option.hoverBorder}`
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{option.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{option.tagline}</p>
                    </div>
                    <div className={`rounded-full p-2 ${selected ? option.accentBackground : "bg-muted"}`}>
                      <Icon className={`h-4 w-4 ${selected ? option.accentText : "text-muted-foreground"}`} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4 px-4 pb-5 sm:px-6 sm:pb-6">
        {(errorCode === AUTH_CODES.USER_NOT_FOUND || errorCode === AUTH_CODES.EMAIL_NOT_VERIFIED) && (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
            {errorCode === AUTH_CODES.USER_NOT_FOUND && onSwitchToRegister && (
              <button
                type="button"
                onClick={onSwitchToRegister}
                className={`font-medium ${sport.accentText} hover:underline`}
              >
                Create your account {"->"}
              </button>
            )}
            {errorCode === AUTH_CODES.EMAIL_NOT_VERIFIED && actionEmail && (
              <Link
                href={`/${selectedSport}/verify-email?pending=true&email=${encodeURIComponent(actionEmail)}`}
                className={`font-medium ${sport.accentText} hover:underline`}
              >
                Verify your email {"->"}
              </Link>
            )}
          </div>
        )}

        <GoogleOneTap
          sport={selectedSport}
          autoPrompt={false}
          anchorId="universal-login-google"
          onLoginSuccess={(data) => finishLogin(data.redirectTo)}
        />

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-2 border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400"
          onClick={() => setUseWhatsApp(true)}
        >
          <MessageCircle className="h-5 w-5" />
          Continue with WhatsApp
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or use email or phone</span>
          </div>
        </div>

        {useWhatsApp ? (
          <div className="space-y-4">
            <WhatsAppLogin
              sport={selectedSport}
              onSuccess={() => finishLogin(searchParams.get("redirect") || undefined)}
              primaryBtnClass={sport.accentButton}
              primaryTextClass={sport.accentText}
            />
            <button
              type="button"
              onClick={() => setUseWhatsApp(false)}
              className={`w-full text-sm ${sport.accentText} hover:underline`}
            >
              Use email or password instead
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="universal-login-identifier">Email or phone</Label>
              <div className="relative">
                {identifierIcon}
                <Input
                  id="universal-login-identifier"
                  type="text"
                  placeholder="you@example.com or +91 98765 43210"
                  value={emailOrPhone}
                  onChange={(event) => {
                    setEmailOrPhone(event.target.value);
                    clearIdentifierErrors();
                    setError("");
                    setErrorCode(null);
                  }}
                  className="pl-10"
                  aria-invalid={Boolean(identifierError)}
                />
              </div>
              {identifierError && <p className="text-xs text-red-500">{identifierError}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="universal-login-password">Password</Label>
                <Link href={`/${selectedSport}/forgot-password`} className={`text-xs ${sport.accentText} hover:underline`}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="universal-login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                    setError("");
                    setErrorCode(null);
                  }}
                  className="pl-10 pr-10"
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
            </div>

            <Button type="submit" className={`h-11 w-full gap-2 text-white ${sport.accentButton}`} disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}

        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          {onSwitchToRegister ? (
            <button type="button" onClick={onSwitchToRegister} className={`${sport.accentText} font-medium hover:underline`}>
              Create account
            </button>
          ) : (
            <Link href="/?auth=register" className={`${sport.accentText} font-medium hover:underline`}>
              Create account
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
