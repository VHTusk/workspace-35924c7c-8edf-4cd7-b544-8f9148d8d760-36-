"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Sidebar from "@/components/layout/sidebar";
import {
  Shield,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Crown,
  User,
  ArrowRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface AdminData {
  id: string;
  userId: string;
  name: string;
  email?: string;
  role: string;
  isActive: boolean;
}

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

export default function EditAdminRolePage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const adminId = params.id as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchAdmin();
  }, [adminId]);

  const fetchAdmin = async () => {
    try {
      const response = await fetch("/api/org/admins");
      if (response.ok) {
        const data = await response.json();
        const foundAdmin = data.admins?.find((a: AdminData) => a.id === adminId);
        if (foundAdmin) {
          setAdmin(foundAdmin);
          setSelectedRole(foundAdmin.role);
        } else {
          setError("Admin not found");
        }
      }
    } catch (error) {
      console.error("Failed to fetch admin:", error);
      setError("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!admin || selectedRole === admin.role) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/org/admins/${adminId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update role");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/${sport}/org/admins`);
      }, 2000);
    } catch (error) {
      setError("Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!admin && !loading) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Sidebar />
        <main className="ml-0 md:ml-72">
          <div className="p-6">
            <Card className="bg-white border-gray-100 shadow-sm max-w-lg mx-auto">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Admin Not Found</h2>
                <p className="text-gray-500 mb-4">{error}</p>
                <Button variant="outline" onClick={() => router.push(`/${sport}/org/admins`)}>
                  Back to Admins
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Sidebar />
        <main className="ml-0 md:ml-72">
          <div className="p-6">
            <Card className="bg-white border-gray-100 shadow-sm max-w-lg mx-auto">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Role Updated!</h2>
                <p className="text-gray-500">
                  {admin?.name}'s role has been changed to{" "}
                  <Badge className="ml-1">{selectedRole}</Badge>
                </p>
                <p className="text-sm text-gray-400 mt-2">Redirecting...</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const currentRole = ROLES.find((r) => r.id === admin?.role);
  const newRole = ROLES.find((r) => r.id === selectedRole);
  const hasChanges = selectedRole !== admin?.role;

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
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
            <h1 className="text-2xl font-bold text-gray-900">Edit Admin Role</h1>
            <p className="text-gray-500">Change the role and permissions for {admin?.name}</p>
          </div>

          {/* Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Admin Info & Role Selection */}
            <div className="lg:col-span-2">
              <Card className="bg-white border-gray-100 shadow-sm mb-6">
                <CardHeader>
                  <CardTitle className="text-gray-900">Current Admin</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-lg font-medium text-gray-600">
                        {admin?.name.split(" ").map(n => n[0]).join("")}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{admin?.name}</p>
                      <p className="text-sm text-gray-500">{admin?.email}</p>
                    </div>
                    {currentRole && (
                      <Badge className={cn("ml-auto", currentRole.bgColor, currentRole.color)}>
                        {currentRole.label}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Select New Role
                  </CardTitle>
                  <CardDescription>
                    Choose a new role for this admin. This will change their permissions immediately.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={selectedRole}
                    onValueChange={setSelectedRole}
                    className="space-y-4"
                  >
                    {ROLES.map((role) => {
                      const Icon = role.icon;
                      return (
                        <div
                          key={role.id}
                          className={cn(
                            "flex items-start p-4 rounded-lg border cursor-pointer transition-all",
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
                            <div className="mt-2 flex flex-wrap gap-2">
                              {role.permissions.map((perm, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600"
                                >
                                  {perm}
                                </span>
                              ))}
                            </div>
                          </div>
                          {selectedRole === role.id && (
                            <CheckCircle className={cn("w-5 h-5", role.color)} />
                          )}
                        </div>
                      );
                    })}
                  </RadioGroup>

                  {/* Note about PRIMARY role */}
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Crown className="w-4 h-4" />
                      <span className="text-sm font-medium">Cannot Assign PRIMARY Role</span>
                    </div>
                    <p className="text-xs text-amber-600 mt-1">
                      The PRIMARY role can only be transferred by the current primary admin through account settings.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Change Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-white border-gray-100 shadow-sm sticky top-6">
                <CardHeader>
                  <CardTitle className="text-gray-900">Role Change Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Current Role */}
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Current Role</p>
                      {currentRole && (
                        <div className={cn("p-3 rounded-lg", currentRole.bgColor)}>
                          <div className="flex items-center gap-2">
                            <currentRole.icon className={cn("w-4 h-4", currentRole.color)} />
                            <span className="font-medium text-gray-900">{currentRole.label}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center">
                      <ArrowRight className="w-6 h-6 text-gray-400" />
                    </div>

                    {/* New Role */}
                    <div>
                      <p className="text-sm text-gray-500 mb-1">New Role</p>
                      {newRole && (
                        <div className={cn("p-3 rounded-lg border-2", newRole.bgColor, newRole.borderColor)}>
                          <div className="flex items-center gap-2">
                            <newRole.icon className={cn("w-4 h-4", newRole.color)} />
                            <span className="font-medium text-gray-900">{newRole.label}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Change Status */}
                    {hasChanges ? (
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                        <p className="text-sm text-blue-700">
                          Role will be changed from <strong>{currentRole?.label}</strong> to{" "}
                          <strong>{newRole?.label}</strong>
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <p className="text-sm text-gray-500">No changes made</p>
                      </div>
                    )}

                    {/* Confirm Button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          disabled={!hasChanges || saving}
                          className={cn("w-full text-white", primaryBtnClass)}
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Update Role"
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to change {admin?.name}&apos;s role from{" "}
                            <strong>{currentRole?.label}</strong> to <strong>{newRole?.label}</strong>?
                            This will immediately update their permissions.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleUpdateRole}
                            className={cn("text-white", primaryBtnClass)}
                          >
                            Confirm Change
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
