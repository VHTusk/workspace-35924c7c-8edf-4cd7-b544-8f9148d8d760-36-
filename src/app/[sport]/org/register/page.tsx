"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2,
  Mail,
  Lock,
  Phone,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ContactMethod = "email" | "phone";

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  tosAccepted?: string;
  privacyAccepted?: string;
}

export default function OrgRegisterPage() {
  const router = useRouter();
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [contactMethod, setContactMethod] = useState<ContactMethod>("email");

  // Form data - simplified to just 3 fields
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    orgType: "CLUB",
    tosAccepted: false,
    privacyAccepted: false,
  });
  const [showPassword, setShowPassword] = useState(false);

  // Password validation rules
  const passwordRules = {
    minLength: formData.password.length >= 8,
    hasUppercase: /[A-Z]/.test(formData.password),
    hasLowercase: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password),
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

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[field as keyof FormErrors]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setError("");
  };

  const validateForm = (): boolean => {
    setError("");
    const errors: FormErrors = {};
    let isValid = true;

    // Organization name is required
    if (!formData.name.trim()) {
      errors.name = "Organization name is required";
      isValid = false;
    }

    // Email OR Phone is required based on selected method
    if (contactMethod === "email") {
      if (!formData.email.trim()) {
        errors.email = "Email is required";
        isValid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = "Please enter a valid email address";
        isValid = false;
      }
    } else {
      if (!formData.phone.trim()) {
        errors.phone = "Phone number is required";
        isValid = false;
      } else if (formData.phone.replace(/\D/g, '').length < 10) {
        errors.phone = "Please enter a valid phone number";
        isValid = false;
      }
    }

    // Password validation
    if (!formData.password) {
      errors.password = "Password is required";
      isValid = false;
    } else if (!allPasswordRulesMet) {
      errors.password = "Password does not meet all requirements";
      isValid = false;
    }

    // Terms acceptance
    if (!formData.tosAccepted) {
      errors.tosAccepted = "You must accept the terms of service";
      isValid = false;
    }
    if (!formData.privacyAccepted) {
      errors.privacyAccepted = "You must accept the privacy policy";
      isValid = false;
    }

    setFieldErrors(errors);
    
    if (!isValid) {
      setError("Please fill in all required fields");
    }
    
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/org/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          type: formData.orgType,
          email: contactMethod === "email" ? formData.email : undefined,
          phone: contactMethod === "phone" ? formData.phone : undefined,
          password: formData.password,
          sport: sport.toUpperCase(),
          tosAccepted: formData.tosAccepted,
          privacyAccepted: formData.privacyAccepted,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // Redirect to org-level home page (shows all sports)
      // All organization types land on the central dashboard
      window.location.href = "/org/home";
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBorderClass = isCornhole ? "border-green-500" : "border-teal-500";

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="VALORHIVE" className="h-12 w-auto" />
            <span className="text-2xl font-bold text-gray-900">VALORHIVE</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Register Organization</h1>
          <p className="text-gray-500 mt-2">
            Create your {isCornhole ? "Cornhole" : "Darts"} organization account
          </p>
        </div>

        {/* Form Card */}
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900">Get Started</CardTitle>
            <CardDescription>
              Quick registration - complete your profile later
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-700">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="name"
                  placeholder="e.g., Jaipur Cornhole Club"
                  value={formData.name}
                  onChange={(e) => updateFormData("name", e.target.value)}
                  className={cn(
                    "pl-10 border-gray-200",
                    fieldErrors.name && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
              </div>
              {fieldErrors.name && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Organization Type */}
            <div className="space-y-2">
              <Label htmlFor="orgType" className="text-gray-700">
                Organization Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.orgType}
                onValueChange={(value) => updateFormData("orgType", value)}
              >
                <SelectTrigger id="orgType" className="w-full border-gray-200">
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

            {/* Contact Method Toggle */}
            <div className="space-y-2">
              <Label className="text-gray-700">Contact Method</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContactMethod("email")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 transition-all",
                    contactMethod === "email"
                      ? cn(primaryBorderClass, primaryBgClass)
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <Mail className="w-4 h-4" />
                  <span className="font-medium">Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContactMethod("phone")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 transition-all",
                    contactMethod === "phone"
                      ? cn(primaryBorderClass, primaryBgClass)
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <Phone className="w-4 h-4" />
                  <span className="font-medium">Phone</span>
                </button>
              </div>
            </div>

            {/* Email or Phone Input */}
            {contactMethod === "email" ? (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="contact@organization.com"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                    className={cn(
                      "pl-10 border-gray-200",
                      fieldErrors.email && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-gray-700">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => updateFormData("phone", e.target.value)}
                    className={cn(
                      "pl-10 border-gray-200",
                      fieldErrors.phone && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                </div>
                {fieldErrors.phone && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.phone}
                  </p>
                )}
              </div>
            )}

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">
                Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => updateFormData("password", e.target.value)}
                  className={cn(
                    "pl-10 pr-10 border-gray-200",
                    fieldErrors.password && "border-red-500 focus-visible:ring-red-500",
                    !allPasswordRulesMet && formData.password && "border-red-500 focus-visible:ring-red-500",
                    allPasswordRulesMet && formData.password && "border-green-500 focus-visible:ring-green-500"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
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
              {fieldErrors.password && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.password}
                </p>
              )}
              
              {/* Password Requirements - Always visible */}
              <div className="mt-2 space-y-1.5 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-2">Password must contain:</p>
                <div className="grid grid-cols-1 gap-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={passwordRules.minLength ? "text-green-500" : "text-red-500"}>
                      {passwordRules.minLength ? "✅" : "❌"}
                    </span>
                    <span className={passwordRules.minLength ? "text-green-600" : "text-red-600"}>
                      Minimum 8 characters
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={passwordRules.hasUppercase ? "text-green-500" : "text-red-500"}>
                      {passwordRules.hasUppercase ? "✅" : "❌"}
                    </span>
                    <span className={passwordRules.hasUppercase ? "text-green-600" : "text-red-600"}>
                      At least 1 uppercase letter
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={passwordRules.hasLowercase ? "text-green-500" : "text-red-500"}>
                      {passwordRules.hasLowercase ? "✅" : "❌"}
                    </span>
                    <span className={passwordRules.hasLowercase ? "text-green-600" : "text-red-600"}>
                      At least 1 lowercase letter
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={passwordRules.hasNumber ? "text-green-500" : "text-red-500"}>
                      {passwordRules.hasNumber ? "✅" : "❌"}
                    </span>
                    <span className={passwordRules.hasNumber ? "text-green-600" : "text-red-600"}>
                      At least 1 number
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={passwordRules.hasSpecial ? "text-green-500" : "text-red-500"}>
                      {passwordRules.hasSpecial ? "✅" : "❌"}
                    </span>
                    <span className={passwordRules.hasSpecial ? "text-green-600" : "text-red-600"}>
                      At least 1 special character (!@#$%^&*...)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms Acceptance */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="tos"
                  checked={formData.tosAccepted}
                  onCheckedChange={(checked) => updateFormData("tosAccepted", checked as boolean)}
                  className={fieldErrors.tosAccepted ? "border-red-500 data-[state=checked]:bg-red-500" : ""}
                />
                <div className="space-y-1">
                  <Label htmlFor="tos" className="text-sm leading-tight text-gray-700">
                    I accept the{" "}
                    <Link href="/terms" className={cn("hover:underline", primaryTextClass)}>
                      Terms of Service
                    </Link>
                    <span className="text-red-500"> *</span>
                  </Label>
                  {fieldErrors.tosAccepted && (
                    <p className="text-xs text-red-500">{fieldErrors.tosAccepted}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="privacy"
                  checked={formData.privacyAccepted}
                  onCheckedChange={(checked) => updateFormData("privacyAccepted", checked as boolean)}
                  className={fieldErrors.privacyAccepted ? "border-red-500 data-[state=checked]:bg-red-500" : ""}
                />
                <div className="space-y-1">
                  <Label htmlFor="privacy" className="text-sm leading-tight text-gray-700">
                    I accept the{" "}
                    <Link href="/privacy" className={cn("hover:underline", primaryTextClass)}>
                      Privacy Policy
                    </Link>
                    <span className="text-red-500"> *</span>
                  </Label>
                  {fieldErrors.privacyAccepted && (
                    <p className="text-xs text-red-500">{fieldErrors.privacyAccepted}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className={cn("p-4 rounded-lg", primaryBgClass)}>
              <p className="text-sm text-gray-600">
                <strong>Quick Start:</strong> Complete your organization profile (type, location, etc.) after registration from your dashboard.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className={cn("w-full text-white gap-2", primaryBtnClass)}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Organization
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          Already have an organization account?{" "}
          <Link href={`/${sport}/org/login`} className={cn("hover:underline", primaryTextClass)}>
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
