"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail,
  Lock,
  Phone,
  ArrowRight,
  Loader2,
  ArrowLeft,
  User,
  Building2,
  MessageCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ChevronDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WhatsAppRegister } from "@/components/auth/whatsapp-register";

type AccountType = "player" | "org";

function RegisterForm() {
  const params = useParams();
  const router = useRouter();
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
  const [acceptedLegal, setAcceptedLegal] = useState(false); // Combined: Terms + Privacy + Tournament + Liability
  const [acceptedMarketing, setAcceptedMarketing] = useState(false); // Optional

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("player");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<string>("CLUB");

  // Password validation state
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  // Password validation rules
  const passwordRules = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
  
  const allPasswordRulesMet = Object.values(passwordRules).every(Boolean);

  // Organization type options
  const orgTypes = [
    { value: "SCHOOL", label: "School" },
    { value: "COLLEGE", label: "College" },
    { value: "CLUB", label: "Club" },
    { value: "ASSOCIATION", label: "Association" },
    { value: "CORPORATE", label: "Corporate" },
    { value: "GOVT_ORGANISATION", label: "Govt Organisation" },
    { value: "ACADEMY", label: "Academy" },
    { value: "OTHER", label: "Other" },
  ];

  // WhatsApp verification state
  const [useWhatsApp, setUseWhatsApp] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);

  // Get phone from URL params
  const initialPhone = searchParams.get("phone") || "";

  // Detect if input is email or phone
  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isPhone = (value: string) => /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(value.replace(/\s/g, ''));

  // Handle WhatsApp verification success
  const handleWhatsAppSuccess = (data: { phone: string }) => {
    setPhoneVerified(true);
    setVerifiedPhone(data.phone);
    setUseWhatsApp(false);
    setEmailOrPhone(data.phone);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate password requirements
    if (!allPasswordRulesMet) {
      setError("Password does not meet all requirements");
      setLoading(false);
      return;
    }

    const email = isEmail(emailOrPhone) ? emailOrPhone : undefined;
    const phone = isPhone(emailOrPhone) ? emailOrPhone : undefined;

    if (!email && !phone) {
      setError("Please enter a valid email or phone number");
      setLoading(false);
      return;
    }

    try {
      const endpoint = accountType === "player" 
        ? "/api/auth/register" 
        : "/api/auth/org/register";

      const body = accountType === "player"
        ? {
            firstName,
            lastName,
            email,
            phone,
            password,
            sport: sport.toUpperCase(),
            phoneVerified: phoneVerified && verifiedPhone === phone,
            tosAccepted: acceptedLegal,
            privacyAccepted: acceptedLegal,
            tournamentAccepted: acceptedLegal,
            marketingAccepted: acceptedMarketing,
          }
        : {
            name: orgName,
            type: orgType,
            email,
            phone,
            password,
            sport: sport.toUpperCase(),
            tosAccepted: acceptedLegal,
            privacyAccepted: acceptedLegal,
            marketingAccepted: acceptedMarketing,
            phoneVerified: phoneVerified && verifiedPhone === phone,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // Redirect to dashboard (session is created immediately)
      // Email verification can be done within 24 hours
      if (accountType === "player") {
        router.push(`/${sport}/dashboard`);
      } else {
        // Redirect all org types to org home for sport subscription selection
        router.push("/org/home");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    window.location.href = `/api/auth/google?sport=${sport}&type=player`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        {/* Back Link */}
        <Link href={`/${sport}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to {isCornhole ? "Cornhole" : "Darts"}
        </Link>

        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <img src="/logo.png" alt="VALORHIVE" className="h-10 w-auto" />
            <span className="text-xl font-bold text-foreground">VALORHIVE</span>
          </Link>
          <Badge variant="outline" className={`${primaryBorderClass} ${primaryTextClass} ${primaryBgClass}`}>
            {isCornhole ? "Cornhole" : "Darts"}
          </Badge>
        </div>

        {/* Registration Card */}
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-foreground">Create Account</CardTitle>
            <CardDescription className="text-muted-foreground">
              Join the community and start your journey
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Account Type Toggle */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setAccountType("player")}
                className={`p-3 rounded-lg border-2 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                  accountType === "player"
                    ? `${primaryBtnClass} text-white border-transparent shadow-lg`
                    : "border-border hover:bg-muted/50 text-muted-foreground bg-card"
                }`}
              >
                <User className="w-4 h-4" />
                Player
              </button>
              <button
                type="button"
                onClick={() => setAccountType("org")}
                className={`p-3 rounded-lg border-2 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                  accountType === "org"
                    ? `${primaryBtnClass} text-white border-transparent shadow-lg`
                    : "border-border hover:bg-muted/50 text-muted-foreground bg-card"
                }`}
              >
                <Building2 className="w-4 h-4" />
                Organization
              </button>
            </div>

            {/* Google Sign Up */}
            <Button
              type="button"
              variant="outline"
              className="w-full mb-3 gap-2 h-11 text-foreground"
              onClick={handleGoogleRegister}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </Button>

            {/* WhatsApp Sign Up */}
            <Button
              type="button"
              variant="outline"
              className="w-full mb-4 gap-2 h-11 bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-500 dark:text-green-400"
              onClick={() => setUseWhatsApp(true)}
            >
              <MessageCircle className="w-5 h-5" />
              Register with WhatsApp
            </Button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or register with</span>
              </div>
            </div>

            {/* WhatsApp Verification Section */}
            {useWhatsApp ? (
              <div className="mb-4">
                <WhatsAppRegister
                  sport={sport}
                  initialPhone={initialPhone}
                  onSuccess={handleWhatsAppSuccess}
                  primaryBtnClass={primaryBtnClass}
                  primaryTextClass={primaryTextClass}
                />
                {!phoneVerified && (
                  <button
                    type="button"
                    onClick={() => setUseWhatsApp(false)}
                    className={`w-full text-center text-sm ${primaryTextClass} hover:underline mt-4`}
                  >
                    Use email/password instead
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Organization Name (only for org) */}
                {accountType === "org" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="orgName" className="text-foreground">Organization Name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="orgName"
                          placeholder="e.g., Jaipur Sports Club"
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    {/* Organization Type Dropdown */}
                    <div className="space-y-2">
                      <Label htmlFor="orgType" className="text-foreground">Organization Type</Label>
                      <Select value={orgType} onValueChange={setOrgType}>
                        <SelectTrigger id="orgType" className="w-full">
                          <SelectValue placeholder="Select organization type" />
                        </SelectTrigger>
                        <SelectContent>
                          {orgTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Name Fields (only for player) */}
                {accountType === "player" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-foreground">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="Rahul"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-foreground">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Sharma"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Email or Phone */}
                <div className="space-y-2">
                  <Label htmlFor="emailOrPhone" className="text-foreground">Email or Phone</Label>
                  <div className="relative">
                    {isEmail(emailOrPhone) ? (
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    )}
                    <Input
                      id="emailOrPhone"
                      type="text"
                      placeholder="you@example.com or +91 98765 43210"
                      value={emailOrPhone}
                      onChange={(e) => {
                        setEmailOrPhone(e.target.value);
                        setPhoneVerified(false);
                      }}
                      className="pl-10"
                      required
                    />
                    {phoneVerified && (
                      <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                    )}
                  </div>
                  {phoneVerified && (
                    <p className="text-xs text-green-500 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Phone verified via WhatsApp
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      className={`pl-10 pr-10 ${!allPasswordRulesMet && password ? "border-red-500 focus-visible:ring-red-500" : allPasswordRulesMet ? "border-green-500 focus-visible:ring-green-500" : ""}`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  
                  {/* Password Requirements - Always visible */}
                  <div className="mt-2 space-y-1.5 p-3 bg-muted/30 rounded-lg border border-border/50">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Password must contain:</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={passwordRules.minLength ? "text-green-500" : "text-red-500"}>
                          {passwordRules.minLength ? "✅" : "❌"}
                        </span>
                        <span className={passwordRules.minLength ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          Minimum 8 characters
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={passwordRules.hasUppercase ? "text-green-500" : "text-red-500"}>
                          {passwordRules.hasUppercase ? "✅" : "❌"}
                        </span>
                        <span className={passwordRules.hasUppercase ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          At least 1 uppercase letter
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={passwordRules.hasLowercase ? "text-green-500" : "text-red-500"}>
                          {passwordRules.hasLowercase ? "✅" : "❌"}
                        </span>
                        <span className={passwordRules.hasLowercase ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          At least 1 lowercase letter
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={passwordRules.hasNumber ? "text-green-500" : "text-red-500"}>
                          {passwordRules.hasNumber ? "✅" : "❌"}
                        </span>
                        <span className={passwordRules.hasNumber ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          At least 1 number
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={passwordRules.hasSpecial ? "text-green-500" : "text-red-500"}>
                          {passwordRules.hasSpecial ? "✅" : "❌"}
                        </span>
                        <span className={passwordRules.hasSpecial ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          At least 1 special character (!@#$%^&*...)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Terms & Consent Section */}
                <div className="space-y-3 pt-2">
                  {/* Required: Combined Legal Agreements */}
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="legal"
                      checked={acceptedLegal}
                      onCheckedChange={(checked) => setAcceptedLegal(checked as boolean)}
                    />
                    <Label htmlFor="legal" className="text-xs text-muted-foreground leading-snug">
                      I agree to the{" "}
                      <Link href="/legal/terms" className={`${primaryTextClass} hover:underline`}>Terms of Service</Link>
                      {", "}
                      <Link href="/legal/privacy" className={`${primaryTextClass} hover:underline`}>Privacy Policy</Link>
                      {accountType === "player" && (
                        <>
                          {", "}
                          <Link href="/legal/tournament-agreement" className={`${primaryTextClass} hover:underline`}>
                            Tournament Agreement
                          </Link>
                          {" and "}
                          <Link href="/legal/liability-waiver" className={`${primaryTextClass} hover:underline`}>
                            Liability Waiver
                          </Link>
                        </>
                      )}
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                  </div>

                  {/* Optional: Marketing Consent */}
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="marketing"
                      checked={acceptedMarketing}
                      onCheckedChange={(checked) => setAcceptedMarketing(checked as boolean)}
                    />
                    <Label htmlFor="marketing" className="text-xs text-muted-foreground leading-snug">
                      <span className="text-xs text-muted-foreground/60">(Optional)</span>{" "}
                      Send me updates about tournaments, promotions, and community news
                    </Label>
                  </div>
                </div>

                <Button
                  type="submit"
                  className={`w-full ${primaryBtnClass} text-white gap-2 h-11`}
                  disabled={loading || !acceptedLegal}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href={`/${sport}/login`} className={`${primaryTextClass} hover:underline`}>
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
