"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "@/components/layout/sidebar";
import {
  Building2,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  MapPin,
  Crown,
  User,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RosterRequest {
  id: string;
  status: string;
  message?: string;
  requestedAt: string;
  expiresAt: string;
  organization: {
    id: string;
    name: string;
    type: string;
    city?: string;
    state?: string;
  };
}

interface OrgAdminInvite {
  id: string;
  orgId: string;
  orgName: string;
  orgType: string;
  role: string;
  status: string;
  invitedAt: string;
  invitedBy?: string;
}

interface CurrentRoster {
  orgId: string;
  orgName: string;
}

const ROLE_INFO: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  PRIMARY: { label: "Primary Admin", color: "bg-amber-100 text-amber-700", icon: Crown },
  ADMIN: { label: "Admin", color: "bg-blue-100 text-blue-700", icon: ShieldCheck },
  STAFF: { label: "Staff", color: "bg-gray-100 text-gray-600", icon: User },
};

export default function PlayerInvitationsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [rosterRequests, setRosterRequests] = useState<RosterRequest[]>([]);
  const [orgAdminInvites, setOrgAdminInvites] = useState<OrgAdminInvite[]>([]);
  const [currentRoster, setCurrentRoster] = useState<CurrentRoster | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchRequests();
  }, [sport]);

  const fetchRequests = async () => {
    try {
      // Fetch roster requests
      const rosterResponse = await fetch("/api/player/roster-requests");
      if (rosterResponse.ok) {
        const data = await rosterResponse.json();
        setRosterRequests(data.requests);
        setCurrentRoster(data.currentRoster);
      }

      // Fetch org admin invites - need to create this endpoint or use existing
      // For now, we'll fetch from the notifications or a dedicated endpoint
      const adminInvitesResponse = await fetch("/api/player/org-admin-invites");
      if (adminInvitesResponse.ok) {
        const data = await adminInvitesResponse.json();
        setOrgAdminInvites(data.invites || []);
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRosterResponse = async (requestId: string, action: "accept" | "decline") => {
    setActionLoading(requestId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/player/roster-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || `Failed to ${action} request`);
        return;
      }

      if (action === "accept") {
        setSuccess(`You have joined ${data.organization.name}!`);
      } else {
        setSuccess("Invitation declined");
      }

      fetchRequests();
    } catch (error) {
      setError(`Failed to ${action} request`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdminInviteResponse = async (inviteId: string, action: "accept" | "decline") => {
    setActionLoading(inviteId);
    setError("");
    setSuccess("");

    try {
      if (action === "accept") {
        const response = await fetch("/api/org/admins/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteId }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to accept invitation");
          return;
        }

        setSuccess(`You are now an admin for ${data.admin.orgName}!`);
      } else {
        // Decline - delete the invite
        const response = await fetch(`/api/player/org-admin-invites/${inviteId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          setError("Failed to decline invitation");
          return;
        }

        setSuccess("Admin invitation declined");
      }

      fetchRequests();
    } catch (error) {
      setError(`Failed to ${action} invitation`);
    } finally {
      setActionLoading(null);
    }
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
      case "ACCEPTED":
        return <Badge className="bg-emerald-100 text-emerald-700">Accepted</Badge>;
      case "DECLINED":
        return <Badge className="bg-red-100 text-red-700">Declined</Badge>;
      case "EXPIRED":
        return <Badge className="bg-gray-100 text-gray-500">Expired</Badge>;
      case "CANCELLED":
        return <Badge className="bg-gray-100 text-gray-500">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleInfo = ROLE_INFO[role] || ROLE_INFO.STAFF;
    const Icon = roleInfo.icon;
    return (
      <Badge className={cn("gap-1", roleInfo.color)}>
        <Icon className="w-3 h-3" />
        {roleInfo.label}
      </Badge>
    );
  };

  const getTimeLeft = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Expired";
    if (days === 1) return "1 day left";
    return `${days} days left`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const pendingRosterRequests = rosterRequests.filter((r) => r.status === "PENDING");
  const pendingAdminInvites = orgAdminInvites.filter((r) => r.status !== "DECLINED");

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Invitations</h1>
            <p className="text-gray-500">Manage roster and admin invitations from organizations</p>
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

          {/* Current Roster */}
          {currentRoster && (
            <Card className="bg-emerald-50 border-emerald-200 shadow-sm mb-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-emerald-600 font-medium">You are currently part of</p>
                    <p className="text-xl font-bold text-gray-900">{currentRoster.orgName}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs for Roster vs Admin Invitations */}
          <Tabs defaultValue="roster" className="space-y-4">
            <TabsList className="bg-white border border-gray-200">
              <TabsTrigger value="roster" className="gap-2">
                <Building2 className="w-4 h-4" />
                Roster Invitations
                {pendingRosterRequests.length > 0 && (
                  <Badge className="ml-1 bg-amber-100 text-amber-700">
                    {pendingRosterRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="admin" className="gap-2">
                <Shield className="w-4 h-4" />
                Admin Invitations
                {pendingAdminInvites.length > 0 && (
                  <Badge className="ml-1 bg-blue-100 text-blue-700">
                    {pendingAdminInvites.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Roster Invitations Tab */}
            <TabsContent value="roster">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Roster Invitations</CardTitle>
                  <CardDescription>
                    You can only join one organization per sport. Invitations expire after 7 days.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingRosterRequests.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No pending roster invitations</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingRosterRequests.map((request) => (
                        <div
                          key={request.id}
                          className="p-4 rounded-lg border border-amber-200 bg-amber-50"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-amber-600" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{request.organization.name}</p>
                                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                  <Badge variant="outline">{request.organization.type}</Badge>
                                  {request.organization.city && request.organization.state && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {request.organization.city}, {request.organization.state}
                                    </span>
                                  )}
                                </div>
                                {request.message && (
                                  <p className="text-sm text-gray-600 mt-2 italic">
                                    &quot;{request.message}&quot;
                                  </p>
                                )}
                                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {getTimeLeft(request.expiresAt)}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRosterResponse(request.id, "decline")}
                                disabled={actionLoading === request.id || !!currentRoster}
                                className="border-red-200 text-red-600 hover:bg-red-50"
                              >
                                {actionLoading === request.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <XCircle className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleRosterResponse(request.id, "accept")}
                                disabled={actionLoading === request.id || !!currentRoster}
                                className={cn("text-white", primaryBtnClass)}
                              >
                                {actionLoading === request.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          {currentRoster && (
                            <p className="text-xs text-amber-600 mt-2">
                              You are already in an organization roster. Leave your current organization first to accept this invitation.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Past Roster Invitations */}
              {rosterRequests.filter((r) => r.status !== "PENDING").length > 0 && (
                <Card className="bg-white border-gray-100 shadow-sm mt-4">
                  <CardHeader>
                    <CardTitle className="text-gray-900">Past Invitations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {rosterRequests
                        .filter((r) => r.status !== "PENDING")
                        .map((request) => (
                          <div
                            key={request.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                          >
                            <div className="flex items-center gap-3">
                              <Building2 className="w-8 h-8 text-gray-400" />
                              <div>
                                <p className="font-medium text-gray-700">{request.organization.name}</p>
                                <p className="text-xs text-gray-500">
                                  Invited {new Date(request.requestedAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(request.status)}
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Admin Invitations Tab */}
            <TabsContent value="admin">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Organization Admin Invitations</CardTitle>
                  <CardDescription>
                    Accept to become an admin for an organization. Each role has different permissions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingAdminInvites.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No pending admin invitations</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingAdminInvites.map((invite) => (
                        <div
                          key={invite.id}
                          className="p-4 rounded-lg border border-blue-200 bg-blue-50"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Shield className="w-6 h-6 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{invite.orgName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline">{invite.orgType}</Badge>
                                  {getRoleBadge(invite.role)}
                                </div>
                                {invite.invitedBy && (
                                  <p className="text-xs text-gray-500 mt-2">
                                    Invited by {invite.invitedBy}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  Invited {new Date(invite.invitedAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAdminInviteResponse(invite.id, "decline")}
                                disabled={actionLoading === invite.id}
                                className="border-red-200 text-red-600 hover:bg-red-50"
                              >
                                {actionLoading === invite.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <XCircle className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleAdminInviteResponse(invite.id, "accept")}
                                disabled={actionLoading === invite.id}
                                className={cn("text-white", primaryBtnClass)}
                              >
                                {actionLoading === invite.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
