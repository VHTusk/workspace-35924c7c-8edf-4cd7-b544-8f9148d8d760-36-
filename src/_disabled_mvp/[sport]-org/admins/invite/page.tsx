"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Sidebar from "@/components/layout/sidebar";
import {
  UserPlus,
  Mail,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Shield,
  ShieldCheck,
  Crown,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = [
  {
    id: "ADMIN",
    label: "Admin",
    description: "Can manage tournaments, roster, and invite staff",
    icon: ShieldCheck,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    permissions: [
      "Create and manage tournaments",
      "Manage roster and players",
      "View analytics and reports",
      "Invite staff members",
      "Edit organization profile",
    ],
  },
  {
    id: "STAFF",
    label: "Staff",
    description: "Limited access to view and manage basic information",
    icon: User,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    permissions: [
      "View roster and players",
      "View tournaments",
      "Limited profile editing",
    ],
  },
];

export default function InviteAdminPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("STAFF");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [invitedAdmin, setInvitedAdmin] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);

  const handleInvite = async () => {
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/org/admins/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role: selectedRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send invitation");
        return;
      }

      setInvitedAdmin({
        name: data.admin.name,
        email: data.admin.email,
        role: data.admin.role,
      });
      setSuccess(true);
    } catch (error) {
      setError("Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  if (success && invitedAdmin) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Sidebar userType="org" />
        <main className="ml-0 md:ml-72">
          <div className="p-6">
            <Card className="bg-white border-gray-100 shadow-sm max-w-lg mx-auto">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Invitation Sent!</h2>
                <p className="text-gray-500 mb-4">
                  {invitedAdmin.name} has been added as{" "}
                  <Badge className="ml-1">
                    {invitedAdmin.role}
                  </Badge>
                </p>
                <p className="text-sm text-gray-400 mb-6">
                  An email has been sent to {invitedAdmin.email}
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => router.push(`/${sport}/org/admins`)}>
                    View All Admins
                  </Button>
                  <Button
                    onClick={() => {
                      setSuccess(false);
                      setEmail("");
                      setInvitedAdmin(null);
                    }}
                    className={cn("text-white", primaryBtnClass)}
                  >
                    Invite Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <Link
              href={`/${sport}/org/admins`}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Admins
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Invite Admin</h1>
            <p className="text-gray-500">Add a new admin to your organization</p>
          </div>

          {/* Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Invite Form */}
            <div className="lg:col-span-2">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    New Admin Details
                  </CardTitle>
                  <CardDescription>
                    The user must already have a {sport} account. Enter their email to invite them.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Email Input */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      The user must be registered for {sport} with this email
                    </p>
                  </div>

                  {/* Role Selection */}
                  <div className="space-y-3">
                    <Label>Select Role</Label>
                    <RadioGroup
                      value={selectedRole}
                      onValueChange={setSelectedRole}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {ROLES.map((role) => {
                        const Icon = role.icon;
                        return (
                          <div
                            key={role.id}
                            className={cn(
                              "relative flex items-start p-4 rounded-lg border cursor-pointer transition-all",
                              selectedRole === role.id
                                ? `${role.borderColor} ${role.bgColor}`
                                : "border-gray-200 hover:border-gray-300"
                            )}
                            onClick={() => setSelectedRole(role.id)}
                          >
                            <RadioGroupItem value={role.id} id={role.id} className="sr-only" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Icon className={cn("w-5 h-5", role.color)} />
                                <span className="font-medium text-gray-900">{role.label}</span>
                              </div>
                              <p className="text-sm text-gray-500">{role.description}</p>
                            </div>
                            {selectedRole === role.id && (
                              <CheckCircle className={cn("w-5 h-5", role.color)} />
                            )}
                          </div>
                        );
                      })}
                    </RadioGroup>

                    {/* Note about PRIMARY role */}
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-700">
                        <Crown className="w-4 h-4" />
                        <span className="text-sm font-medium">Note about Primary Admin</span>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">
                        The PRIMARY role can only be transferred by the current primary admin through account settings.
                      </p>
                    </div>
                  </div>

                  {/* Invite Button */}
                  <Button
                    onClick={handleInvite}
                    disabled={loading || !email.trim()}
                    className={cn("w-full text-white gap-2", primaryBtnClass)}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    Send Invitation
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Permission Preview */}
            <div className="lg:col-span-1">
              <Card className="bg-white border-gray-100 shadow-sm sticky top-6">
                <CardHeader>
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Permission Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const role = ROLES.find((r) => r.id === selectedRole);
                    if (!role) return null;
                    const Icon = role.icon;
                    return (
                      <>
                        <div className={cn("p-4 rounded-lg mb-4", role.bgColor)}>
                          <div className="flex items-center gap-2">
                            <Icon className={cn("w-5 h-5", role.color)} />
                            <span className="font-medium text-gray-900">{role.label}</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700">Permissions:</p>
                          {role.permissions.map((perm, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-gray-600">{perm}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
