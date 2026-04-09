"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [contactMethod, setContactMethod] = useState<ContactMethod>("email");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    orgType: "CORPORATE",
    tosAccepted: false,
    privacyAccepted: false,
  });
  const [showPassword, setShowPassword] = useState(false);

  const passwordRules = {
    minLength: formData.password.length >= 8,
    hasUppercase: /[A-Z]/.test(formData.password),
    hasLowercase: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password),
  };
  
  const allPasswordRulesMet = Object.values(passwordRules).every(Boolean);

  const orgTypes = [
    { value: "CORPORATE", label: "Corporate" },
    { value: "SCHOOL", label: "School" },
    { value: "COLLEGE", label: "College" },
    { value: "CLUB", label: "Club" },
    { value: "ASSOCIATION", label: "Association" },
    { value: "GOVT_ORGANISATION", label: "Govt Organisation" },
    { value: "ACADEMY", label: "Academy" },
    { value: "OTHER", label: "Other" },
  ];

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field as keyof FormErrors]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setError("");
  };

  const validateForm = (): boolean => {
    setError("");
    const errors: FormErrors = {};
    let isValid = true;

    if (!formData.name.trim()) {
      errors.name = "Organization name is required";
      isValid = false;
    }

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

    if (!formData.password) {
      errors.password = "Password is required";
      isValid = false;
    } else if (!allPasswordRulesMet) {
      errors.password = "Password does not meet all requirements";
      isValid = false;
    }

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
          sport: "CORNHOLE",
          tosAccepted: formData.tosAccepted,
          privacyAccepted: formData.privacyAccepted,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      router.push("/org/home");
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <Building2 className="w-10 h-10 text-purple-600" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">VALORHIVE</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Register Organization</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Create your organization account
          </p>
        </div>

        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Get Started</CardTitle>
            <CardDescription className="text-gray-500 dark:text-gray-400">
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

            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="name"
                  placeholder="e.g., Acme Corporation"
                  value={formData.name}
                  onChange={(e) => updateFormData("name", e.target.value)}
                  className={cn(
                    "pl-10 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700",
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

            <div className="space-y-2">
              <Label htmlFor="orgType" className="text-gray-700 dark:text-gray-300">
                Organization Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.orgType}
                onValueChange={(value) => updateFormData("orgType", value)}
              >
                <SelectTrigger id="orgType" className="w-full border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700">
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

            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Contact Method</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContactMethod("email")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 transition-all",
                    contactMethod === "email"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  )}
                >
                  <Mail className="w-4 h-4" />
                  <span className="font-medium text-gray-900 dark:text-white">Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContactMethod("phone")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 transition-all",
                    contactMethod === "phone"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  )}
                >
                  <Phone className="w-4 h-4" />
                  <span className="font-medium text-gray-900 dark:text-white">Phone</span>
                </button>
              </div>
            </div>

            {contactMethod === "email" ? (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">
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
                      "pl-10 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700",
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
                <Label htmlFor="phone" className="text-gray-700 dark:text-gray-300">
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
                      "pl-10 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700",
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

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">
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
                    "pl-10 pr-10 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700",
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
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.password}
                </p>
              )}
              
              <div className="mt-2 space-y-1.5 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Password must contain:</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { rule: passwordRules.minLength, text: "Minimum 8 characters" },
                    { rule: passwordRules.hasUppercase, text: "At least 1 uppercase letter" },
                    { rule: passwordRules.hasLowercase, text: "At least 1 lowercase letter" },
                    { rule: passwordRules.hasNumber, text: "At least 1 number" },
                    { rule: passwordRules.hasSpecial, text: "At least 1 special character (!@#$%^&*...)" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={item.rule ? "text-green-500" : "text-red-500"}>
                        {item.rule ? "✅" : "❌"}
                      </span>
                      <span className={item.rule ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="tos"
                  checked={formData.tosAccepted}
                  onCheckedChange={(checked) => updateFormData("tosAccepted", checked as boolean)}
                  className={fieldErrors.tosAccepted ? "border-red-500 data-[state=checked]:bg-red-500" : ""}
                />
                <div className="space-y-1">
                  <Label htmlFor="tos" className="text-sm leading-tight text-gray-700 dark:text-gray-300">
                    I accept the{" "}
                    <Link href="/terms" className="text-purple-600 dark:text-purple-400 hover:underline">
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
                  <Label htmlFor="privacy" className="text-sm leading-tight text-gray-700 dark:text-gray-300">
                    I accept the{" "}
                    <Link href="/privacy" className="text-purple-600 dark:text-purple-400 hover:underline">
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

            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <strong>Quick Start:</strong> After registration, subscribe to sports and set up your organization profile from your dashboard.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2"
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

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an organization account?{" "}
          <Link href="/org/login" className="text-purple-600 dark:text-purple-400 hover:underline">
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
