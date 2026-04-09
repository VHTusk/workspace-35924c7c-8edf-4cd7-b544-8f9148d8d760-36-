"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Sidebar from "@/components/layout/sidebar";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  Edit,
  Mail,
  Calendar,
  MoreVertical,
  Crown,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Admin {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  role: string;
  isActive: boolean;
  invitedAt: string;
  acceptedAt?: string;
  invitedBy?: string;
}

interface PendingInvite {
  id: string;
  userId: string;
  name: string;
  email?: string;
  role: string;
  invitedAt: string;
  invitedBy?: string;
}

const ROLE_PERMISSIONS: Record<string, { label: string; color: string; permissions: string[] }> = {
  PRIMARY: {
    label: "Primary Admin",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    permissions: [
      "Full access to all organization features",
      "Manage all admins and staff",
      "Create and manage tournaments",
      "Manage roster and players",
      "View analytics and reports",
      "Manage subscription and payments",
      "Edit organization profile",
    ],
  },
  ADMIN: {
    label: "Admin",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    permissions: [
      "Create and manage tournaments",
      "Manage roster and players",
      "View analytics and reports",
      "Invite staff members",
      "Edit organization profile",
    ],
  },
  STAFF: {
    label: "Staff",
    color: "bg-gray-100 text-gray-600 border-gray-200",
    permissions: [
      "View roster and players",
      "View tournaments",
      "Limited profile editing",
    ],
  },
};

export default function OrgAdminsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchAdmins();
  }, [sport]);

  const fetchAdmins = async () => {
    try {
      const response = await fetch("/api/org/admins");
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.admins || []);
        setPendingInvites(data.pendingInvitations || []);
        
        // Find current user's role
        if (data.admins?.length > 0) {
          const primaryAdmin = data.admins.find((a: Admin) => a.role === "PRIMARY");
          if (primaryAdmin) {
            setCurrentUserId(primaryAdmin.userId);
            setCurrentUserRole("PRIMARY");
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch admins:", error);
    } finally {
      setLoading(false);
    }
  };

  const deactivateAdmin = async (adminId: string, userId: string) => {
    if (!confirm("Are you sure you want to deactivate this admin?")) return;

    setActionLoading(adminId);
    setError("");

    try {
      const response = await fetch(`/api/org/admins/${adminId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to deactivate admin");
        return;
      }

      setSuccess("Admin deactivated successfully");
      fetchAdmins();
    } catch (error) {
      setError("Failed to deactivate admin");
    } finally {
      setActionLoading(null);
    }
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const getRoleBadge = (role: string) => {
    const roleInfo = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.STAFF;
    return (
      <Badge className={cn("gap-1", roleInfo.color)}>
        {role === "PRIMARY" && <Crown className="w-3 h-3" />}
        {role === "ADMIN" && <ShieldCheck className="w-3 h-3" />}
        {role === "STAFF" && <User className="w-3 h-3" />}
        {roleInfo.label}
      </Badge>
    );
  };

  const getStatusBadge = (admin: Admin) => {
    if (!admin.acceptedAt) {
      return (
        <Badge variant="outline" className="gap-1 border-amber-200 text-amber-700 bg-amber-50">
          <Clock className="w-3 h-3" />
          Pending
        </Badge>
      );
    }
    if (!admin.isActive) {
      return (
        <Badge variant="outline" className="gap-1 border-red-200 text-red-700 bg-red-50">
          Inactive
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 border-emerald-200 text-emerald-700 bg-emerald-50">
        <CheckCircle className="w-3 h-3" />
        Active
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Organization Admins</h1>
              <p className="text-gray-500">Manage admin roles and permissions</p>
            </div>
            <Link href={`/${sport}/org/admins/invite`}>
              <Button className={cn("text-white gap-2", primaryBtnClass)}>
                <UserPlus className="w-4 h-4" />
                Invite Admin
              </Button>
            </Link>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4 bg-emerald-50 border-emerald-200 text-emerald-700">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Permission Matrix */}
          <Card className="bg-white border-gray-100 shadow-sm mb-6">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Permission Matrix
              </CardTitle>
              <CardDescription>
                Each role has different levels of access to organization features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(ROLE_PERMISSIONS).map(([role, info]) => (
                  <div
                    key={role}
                    className={cn(
                      "p-4 rounded-lg border",
                      role === "PRIMARY" ? "border-amber-200 bg-amber-50" :
                      role === "ADMIN" ? "border-blue-200 bg-blue-50" :
                      "border-gray-200 bg-gray-50"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {role === "PRIMARY" && <Crown className="w-5 h-5 text-amber-600" />}
                      {role === "ADMIN" && <ShieldCheck className="w-5 h-5 text-blue-600" />}
                      {role === "STAFF" && <User className="w-5 h-5 text-gray-600" />}
                      <span className="font-semibold text-gray-900">{info.label}</span>
                    </div>
                    <ul className="space-y-1">
                      {info.permissions.map((perm, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <CheckCircle className="w-3 h-3 mt-1 text-emerald-500 flex-shrink-0" />
                          {perm}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {pendingInvites.length > 0 && (
            <Card className="bg-white border-gray-100 shadow-sm mb-6">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-amber-500" />
                  Pending Invitations ({pendingInvites.length})
                </CardTitle>
                <CardDescription>
                  Invitations waiting for acceptance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-amber-50 border border-amber-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-amber-700">
                            {invite.name.split(" ").map(n => n[0]).join("")}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{invite.name}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            {invite.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {invite.email}
                              </span>
                            )}
                            {getRoleBadge(invite.role)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <Clock className="w-4 h-4" />
                        Invited {formatDate(invite.invitedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Admins */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                All Admins ({admins.length})
              </CardTitle>
              <CardDescription>
                Active and inactive admins for this organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {admins.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No admins found</p>
                </div>
              ) : (
                <div className="border rounded-lg divide-y">
                  {admins.map((admin) => (
                    <div
                      key={admin.id}
                      className={cn(
                        "flex items-center justify-between p-4 hover:bg-gray-50",
                        !admin.isActive && "bg-gray-50 opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {admin.name.split(" ").map(n => n[0]).join("")}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{admin.name}</p>
                            {getRoleBadge(admin.role)}
                            {getStatusBadge(admin)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            {admin.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {admin.email}
                              </span>
                            )}
                            {admin.city && (
                              <span>{admin.city}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Invited {formatDate(admin.invitedAt)}
                              {admin.invitedBy && ` by ${admin.invitedBy}`}
                            </span>
                            {admin.acceptedAt && (
                              <span>Accepted {formatDate(admin.acceptedAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {admin.role !== "PRIMARY" && admin.isActive && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={actionLoading === admin.id}>
                                {actionLoading === admin.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="w-4 h-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/${sport}/org/admins/${admin.id}/edit`)}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Role
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => deactivateAdmin(admin.id, admin.userId)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {admin.role === "PRIMARY" && (
                          <Badge variant="outline" className="text-xs">
                            Cannot modify
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
