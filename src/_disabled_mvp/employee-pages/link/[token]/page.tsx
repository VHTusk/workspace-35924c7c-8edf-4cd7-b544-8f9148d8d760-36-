"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  UserCheck,
  Mail,
  Loader2,
  CheckCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  User,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InviteData {
  valid: boolean;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    designation: string | null;
    department: string | null;
  };
  organization: {
    id: string;
    name: string;
    type: string;
  };
  sport: string;
  existingUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    hasStats: boolean;
  } | null;
  error?: string;
}

export default function EmployeeLinkPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = params;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState<"choose" | "create" | "link">("choose");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isCornhole = data?.sport === "CORNHOLE";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/employee/link/${token}`);
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Invalid invite link");
        return;
      }

      setData(result);
      setFormData((prev) => ({
        ...prev,
        firstName: result.employee.firstName,
        lastName: result.employee.lastName,
        phone: result.employee.phone || "",
      }));

      // Auto-select action based on existing user
      if (result.existingUser) {
        setAction("link");
      }
    } catch (err) {
      setError("Failed to validate invite link");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (action === "create") {
      // Validate form
      if (!formData.firstName || !formData.lastName) {
        setError("Please fill in all required fields");
        return;
      }
      if (formData.password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/employee/link/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "link" ? "link_existing" : "create_new",
          userId: data?.existingUser?.id,
          userData:
            action === "create"
              ? {
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                  password: formData.password,
                  phone: formData.phone,
                }
              : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to process invitation");
        return;
      }

      setSuccess(true);

      // Redirect to dashboard after a2 seconds
      setTimeout(() => {
        router.push(result.redirectUrl || `/${data?.sport.toLowerCase()}/dashboard`);
      }, 2000);
    } catch (err) {
      setError("Failed to process invitation");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Invalid Invite
            </h2>
            <p className="text-gray-500">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Account Linked!
              </h2>
              <p className="text-gray-500">
                Your account has been successfully linked. Redirecting to your dashboard...
              </p>
              <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto mt-4" />
            </CardContent>
        </Card>
      </div>
    );
  }

  // Main content
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Building2 className={cn("w-12 h-12 mx-auto mb-4", primaryTextClass)} />
          <h1 className="text-2xl font-bold text-gray-900">
            You're Invited!
          </h1>
          <p className="text-gray-500">
            {data?.organization.name} has invited you to join their sports program
          </p>
        </div>

        {/* Organization Info */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center",
                  isCornhole ? "bg-green-100" : "bg-teal-100"
                )}
              >
                <Building2 className={cn("w-7 h-7", primaryTextClass)} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {data?.organization.name}
                </h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{data?.organization.type}</Badge>
                  <Badge variant="outline">{data?.sport}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee Info */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Your Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    isCornhole ? "bg-green-50" : "bg-teal-50"
                  )}
                >
                  <span className={cn("font-semibold", primaryTextClass)}>
                    {data?.employee.firstName[0]}
                    {data?.employee.lastName[0]}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {data?.employee.firstName} {data?.employee.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{data?.employee.email}</p>
                </div>
              </div>
              {data?.employee.department && (
                <div className="text-sm text-gray-500">
                  <span className="font-medium">Department:</span> {data?.employee.department}
                </div>
              )}
              {data?.employee.designation && (
                <div className="text-sm text-gray-500">
                  <span className="font-medium">Designation:</span> {data?.employee.designation}
                </div>
              )}
          </CardContent>
        </Card>

        {/* Existing User Warning */}
        {data?.existingUser && (
          <Alert className="mb-6">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>
              An account with email {data?.existingUser.email} already exists. You can link this account directly.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Selection */}
        {!data?.existingUser && (
          <div className="mb-6">
            <Label className="text-sm font-medium text-gray-700 mb-3">Choose an option</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setAction("link")}
                className={cn(
                  "p-4 rounded-lg border-2 text-center transition-all",
                  action === "link"
                    ? isCornhole
                      ? "border-green-500 bg-green-50"
                      : "border-teal-500 bg-teal-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <UserCheck className={cn("w-8 h-8 mx-auto mb-2", action === "link" ? primaryTextClass : "text-gray-400")} />
                <p className="font-medium text-gray-900">I have an account</p>
                <p className="text-sm text-gray-500">Sign in with your existing account</p>
              </button>
              <button
                type="button"
                onClick={() => setAction("create")}
                className={cn(
                  "p-4 rounded-lg border-2 text-center transition-all",
                  action === "create"
                    ? isCornhole
                      ? "border-green-500 bg-green-50"
                      : "border-teal-500 bg-teal-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <User className={cn("w-8 h-8 mx-auto mb-2", action === "create" ? primaryTextClass : "text-gray-400")} />
                <p className="font-medium text-gray-900">Create new account</p>
                <p className="text-sm text-gray-500">Register a new player account</p>
              </button>
            </div>
          </div>
        )}

        {/* Link Existing Account */}
        {(action === "link" || data?.existingUser) && (
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Link Existing Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-600">
                  Click the button below to link your existing account. You&apos;ll be able to
                  participate in tournaments as {data?.organization.name}.
                </p>
                {data?.existingUser && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <User className="w-4 h-4 text-blue-600" />
                    <AlertDescription>
                      <span className="font-medium text-blue-800">
                        {data?.existingUser.firstName} {data?.existingUser.lastName}
                      </span>
                      <span className="text-blue-600 ml-2">
                        ({data?.existingUser.email})
                      </span>
                      {data?.existingUser.hasStats && (
                        <span className="text-blue-600 ml-2">
                          - Has existing stats
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create New Account Form */}
        {action === "create" && !data?.existingUser && (
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Create New Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, firstName: e.target.value }))
                      }
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, lastName: e.target.value }))
                      }
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="+91 9876543210"
                  />
                </div>
                <Separator className="my-2" />
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, password: e.target.value }))
                      }
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5 text-gray-400" />
                      ) : (
                        <Eye className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    placeholder="Confirm your password"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        <Button
          size="lg"
          className={cn("w-full text-white", primaryBtnClass)}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              Accept & {action === "link" ? "Link Account" : "Create Account"}
            </>
          )}
        </Button>

        {/* Google OAuth Option */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500 mb-3">Or continue with</p>
          <Button variant="outline" size="lg" className="w-full">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>
        </div>

        {/* Security note */}
        <div className="mt-6 text-center text-sm text-gray-400">
          <Lock className="w-4 h-4 inline mr-1" />
          Your information is secure and encrypted
        </div>
      </div>
    </div>
  );
}
