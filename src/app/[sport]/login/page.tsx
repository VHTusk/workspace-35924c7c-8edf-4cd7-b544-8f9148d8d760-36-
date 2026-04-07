"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Lock,
  Phone,
  ArrowRight,
  Loader2,
  ArrowLeft,
  AlertCircle,
  UserX,
  KeyRound,
  MessageCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { WhatsAppLogin } from "@/components/auth/whatsapp-login";
import { AUTH_CODES, type AuthFieldErrors } from "@/lib/auth-contract";
import { parseAuthResponse } from "@/lib/auth-client";

function LoginForm() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryBgClass = isCornhole
    ? "bg-green-500/10 dark:bg-green-500/20"
    : "bg-teal-500/10 dark:bg-teal-500/20";
  const primaryTextClass = isCornhole
    ? "text-green-500 dark:text-green-400"
    : "text-teal-500 dark:text-teal-400";
  const primaryBorderClass = isCornhole
    ? "border-green-500/30"
    : "border-teal-500/30";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
    : "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600";

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionEmail, setActionEmail] = useState<string | null>(null);
  const [emailOrPhone, setEmailOrPhone] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [useWhatsApp, setUseWhatsApp] = useState(false);

  const sportLabel = isCornhole ? "Cornhole" : "Darts";

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const messageParam = searchParams.get("message");
    const verifiedParam = searchParams.get("verified");
    const emailParam = searchParams.get("email");

    if (emailParam) {
      setEmailOrPhone(emailParam);
      setActionEmail(emailParam);
    }

    if (verifiedParam === "true") {
      setSuccessMessage(
        messageParam || "Your email has been verified successfully. You can now log in.",
      );
      return;
    }

    if (errorParam === "sport_mismatch") {
      setInfoMessage(
        `You are logged in for a different sport. Please log in with your ${sportLabel} account.`,
      );
      return;
    }

    if (messageParam) {
      setInfoMessage(messageParam);
    }
  }, [searchParams, sportLabel]);

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

  const handleWhatsAppSuccess = () => {
    window.location.href = `/${sport}/dashboard`;
  };

  const applyErrorState = (code: string | null, message: string, nextFieldErrors: AuthFieldErrors = {}, email?: string) => {
    setErrorCode(code);
    setError(message);
    setFieldErrors(nextFieldErrors);
    if (email) {
      setActionEmail(email);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setErrorCode(null);
    setFieldErrors({});
    setSuccessMessage(null);
    setInfoMessage(null);
    setActionEmail(null);

    const trimmedIdentifier = emailOrPhone.trim();
    const email = isEmail(trimmedIdentifier) ? trimmedIdentifier : undefined;
    const phone = !email && isPhone(trimmedIdentifier) ? trimmedIdentifier : undefined;

    if (!trimmedIdentifier) {
      applyErrorState(AUTH_CODES.REQUIRED_FIELD_MISSING, "Please enter your email address or mobile number.", {
        emailOrPhone: "Please enter your email address or mobile number.",
      });
      setLoading(false);
      return;
    }

    if (!email && !phone) {
      applyErrorState(AUTH_CODES.INVALID_IDENTIFIER_FORMAT, "Please enter a valid email address or mobile number.", {
        emailOrPhone: "Please enter a valid email address or mobile number.",
      });
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      applyErrorState(AUTH_CODES.PASSWORD_REQUIRED, "Password is required.", {
        password: "Password is required.",
      });
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
          sport: sport.toUpperCase(),
        }),
      });

      const { data: playerData, error: playerError } = await parseAuthResponse(
        playerResponse,
        "We could not sign you in right now. Please try again.",
      );

      if (!playerError) {
        window.location.href = `/${sport}/dashboard`;
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
            sport: sport.toUpperCase(),
          }),
        });

        const { data: orgData, error: orgError } = await parseAuthResponse(
          orgResponse,
          "We could not sign you in right now. Please try again.",
        );

        if (!orgError) {
          window.location.href = `/${sport}/org/dashboard`;
          return;
        }

        applyErrorState(
          orgError.code ?? playerError.code,
          orgError.code === AUTH_CODES.USER_NOT_FOUND
            ? playerError.message
            : orgError.message,
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
    } catch (err) {
      applyErrorState(
        AUTH_CODES.NETWORK_ERROR,
        "We could not sign you in right now. Please check your connection and try again.",
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    window.location.href = `/api/auth/google?sport=${sport}&type=player`;
  };

  const identifierError =
    fieldErrors.emailOrPhone || fieldErrors.identifier || fieldErrors.email || fieldErrors.phone;

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        <Link
          href={`/${sport}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {sportLabel}
        </Link>

        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <img src="/logo.png" alt="VALORHIVE" className="h-10 w-auto" />
            <span className="text-xl font-bold text-foreground">VALORHIVE</span>
          </Link>
          <Badge variant="outline" className={`${primaryBorderClass} ${primaryTextClass} ${primaryBgClass}`}>
            {sportLabel}
          </Badge>
        </div>

        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-foreground">Welcome Back</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sign in to your account
            </CardDescription>
          </CardHeader>

          <CardContent>
            {infoMessage && (
              <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <AlertDescription className="text-amber-600 dark:text-amber-400">
                  {infoMessage}
                </AlertDescription>
              </Alert>
            )}

            {successMessage && (
              <Alert className="mb-4 border-green-500/50 bg-green-500/10">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  {successMessage}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="mb-4">
                <div className="flex items-start gap-3">
                  {errorCode === AUTH_CODES.USER_NOT_FOUND ? (
                    <UserX className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  ) : errorCode === AUTH_CODES.WRONG_PASSWORD ? (
                    <KeyRound className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  ) : errorCode === AUTH_CODES.TOO_MANY_ATTEMPTS ? (
                    <Lock className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  ) : errorCode === AUTH_CODES.SOCIAL_LOGIN_REQUIRED ? (
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  ) : (
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className="font-medium">{error}</AlertDescription>
                    {errorCode === AUTH_CODES.USER_NOT_FOUND && (
                      <div className="mt-2">
                        <Link href={`/${sport}/register`} className={`text-sm font-medium ${primaryTextClass} hover:underline`}>
                          Register now →
                        </Link>
                      </div>
                    )}
                    {errorCode === AUTH_CODES.WRONG_PASSWORD && (
                      <div className="mt-2">
                        <Link href={`/${sport}/forgot-password`} className={`text-sm font-medium ${primaryTextClass} hover:underline`}>
                          Reset password →
                        </Link>
                      </div>
                    )}
                    {errorCode === AUTH_CODES.SOCIAL_LOGIN_REQUIRED && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={handleGoogleLogin}
                          className={`text-sm font-medium ${primaryTextClass} hover:underline`}
                        >
                          Continue with Google →
                        </button>
                      </div>
                    )}
                    {errorCode === AUTH_CODES.EMAIL_NOT_VERIFIED && actionEmail && (
                      <div className="mt-2">
                        <Link
                          href={`/${sport}/verify-email?pending=true&email=${encodeURIComponent(actionEmail)}`}
                          className={`text-sm font-medium ${primaryTextClass} hover:underline`}
                        >
                          Verify email →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </Alert>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full mb-3 gap-2 h-11 text-foreground"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full mb-4 gap-2 h-11 bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-500 dark:text-green-400"
              onClick={() => setUseWhatsApp(true)}
            >
              <MessageCircle className="w-5 h-5" />
              Login with WhatsApp
            </Button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or use email/password</span>
              </div>
            </div>

            {useWhatsApp ? (
              <div className="mb-4">
                <WhatsAppLogin
                  sport={sport}
                  onSuccess={handleWhatsAppSuccess}
                  primaryBtnClass={primaryBtnClass}
                  primaryTextClass={primaryTextClass}
                />
                <button
                  type="button"
                  onClick={() => setUseWhatsApp(false)}
                  className={`w-full text-center text-sm ${primaryTextClass} hover:underline mt-4`}
                >
                  Use email/password instead
                </button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emailOrPhone" className="text-foreground">
                    Email or Phone
                  </Label>
                  <div className="relative">
                    {identifierIcon}
                    <Input
                      id="emailOrPhone"
                      type="text"
                      placeholder="you@example.com or +91 98765 43210"
                      value={emailOrPhone}
                      onChange={(e) => {
                        setEmailOrPhone(e.target.value);
                        clearIdentifierErrors();
                        setError("");
                        setErrorCode(null);
                      }}
                      className="pl-10"
                      aria-invalid={Boolean(identifierError)}
                      required
                    />
                  </div>
                  {identifierError && <p className="text-xs text-red-500">{identifierError}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground">
                      Password
                    </Label>
                    <Link href={`/${sport}/forgot-password`} className={`text-xs ${primaryTextClass} hover:underline`}>
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors((current) => ({ ...current, password: undefined }));
                        setError("");
                        setErrorCode(null);
                      }}
                      className="pl-10 pr-10"
                      aria-invalid={Boolean(fieldErrors.password)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}
                </div>

                <Button type="submit" className={`w-full ${primaryBtnClass} text-white gap-2 h-11`} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href={`/${sport}/register`} className={`${primaryTextClass} hover:underline`}>
                Register now
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
