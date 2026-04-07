"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Mail,
  UserCheck,
  Calendar,
  Building2,
  Trophy,
  Target,
  MoreHorizontal,
  Loader2,
  CheckCircle,
  XCircle,
  Link2,
  Unlink2,
} from "lucide-react";
import { EmployeeLinkStatus } from "@/components/corporate/employee-link-status";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  employeeId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  department: string | null;
  departmentId: string | null;
  designation: string | null;
  isVerified: boolean;
  isActive: boolean;
  tournamentsPlayed: number;
  totalPoints: number;
  wins: number;
  losses: number;
  joinedAt: string;
  linkStatus: EmployeeLinkStatus;
  inviteSentAt: string | null;
  inviteTokenExpires: string | null;
  linkedAt: string | null;
  userId?: string | null;
}

interface LinkedPlayer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hiddenElo: number;
  visiblePoints: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const employeeId = params.employeeId as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [linkedPlayer, setLinkedPlayer] = useState<LinkedPlayer | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchOrg();
  }, [sport]);

  useEffect(() => {
    if (orgId) {
      fetchEmployee();
    }
  }, [orgId, employeeId]);
  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrgId(data.id);
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };
  const fetchEmployee = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/org/${orgId}/employees/${employeeId}?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setEmployee(data.employee);
        if (data.employee?.userId) {
          fetchLinkedPlayer(data.employee.userId);
        }
      } else {
        setError("Employee not found");
      }
    } catch (err) {
      console.error("Failed to fetch employee:", err);
      setError("Failed to load employee details");
    } finally {
      setLoading(false);
    }
  };
  const fetchLinkedPlayer = async (userId: string) => {
    try {
      const response = await fetch(`/api/players/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setLinkedPlayer(data.player);
      }
    } catch (err) {
      console.error("Failed to fetch linked player:", err);
    }
  };
  const handleSendInvite = async () => {
    if (!orgId || !employee) return;
    setActionLoading("send");
    setError(null);
    try {
      const response = await fetch(
        `/api/org/${orgId}/employees/${employee!.id}/send-invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentBy: orgId }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        setEmployee((prev) => prev ? { ...prev, ...data.employee } : null);
        setSuccess("Invite sent successfully!");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to send invite");
      }
    } catch (err) {
      setError("Failed to send invite");
    } finally {
      setActionLoading(null);
    }
  };
  const handleResendInvite = async () => {
    if (!orgId || !employee) return;
    setActionLoading("resend");
    setError(null);
    try {
      const response = await fetch(
        `/api/org/${orgId}/employees/${employee!.id}/resend-invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentBy: orgId }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        setEmployee((prev) => prev ? { ...prev, ...data.employee } : null);
        setSuccess("Invite resent successfully!");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to resend invite");
      }
    } catch (err) {
      setError("Failed to resend invite");
    } finally {
      setActionLoading(null);
    }
  };
  const handleUnlink = async () => {
    if (!orgId || !employee) return;
    setActionLoading("unlink");
    setError(null);
    try {
      const response = await fetch(
        `/api/org/${orgId}/employees/${employee!.id}/unlink`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unlinkedBy: orgId }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        setEmployee((prev) => prev ? { ...prev, ...data.employee } : null);
        setLinkedPlayer(null);
        setSuccess("Employee unlinked successfully!");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to unlink employee");
      }
    } catch (err) {
      setError("Failed to unlink employee");
    } finally {
      setActionLoading(null);
    }
  };
  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!employee) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Sidebar userType="org" />
        <main className="ml-72 p-6">
          <Alert variant="destructive">
            <AlertDescription>Employee not found</AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }
  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
      <main className="ml-72 p-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/${sport}/org/employer-sports/employees`)}
            className="mb-2 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Employees
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employee Details</h1>
              <p className="text-gray-500">
                Manage employee linking and tournament participation
              </p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4 border-green-200 bg-green-50">
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee Info Card */}
          <Card className="bg-white border-gray-100 shadow-sm lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Employee Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center",
                    primaryBgClass
                  )}
                >
                  <span className={cn("text-xl font-medium", primaryTextClass)}>
                    {employee.firstName[0]}
                    {employee.lastName[0]}
                  </span>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {employee.firstName} {employee.lastName}
                  </h2>
                  <p className="text-gray-500">{employee.email}</p>
                  {employee.employeeId && (
                    <p className="text-sm text-gray-400">ID: {employee.employeeId}</p>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500 text-xs">Department</Label>
                  <p className="font-medium">{employee.department || "-"}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Designation</Label>
                  <p className="font-medium">{employee.designation || "-"}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Phone</Label>
                  <p className="font-medium">{employee.phone || "-"}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Joined</Label>
                  <p className="font-medium">
                    {new Date(employee.joinedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Link Status Component */}
              <EmployeeLinkStatus
                status={employee.linkStatus}
                inviteSentAt={employee.inviteSentAt}
                inviteTokenExpires={employee.inviteTokenExpires}
                linkedAt={employee.linkedAt}
                employeeId={employee.id}
                orgId={orgId || ""}
                onSendInvite={handleSendInvite}
                onResendInvite={handleResendInvite}
                onUnlink={handleUnlink}
                isLinked={!!employee.userId}
              />
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Tournaments</span>
                  <span className="font-semibold">{employee.tournamentsPlayed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Wins / Losses</span>
                  <span className="font-semibold">
                    {employee.wins}W - {employee.losses}L
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Total Points</span>
                  <span className={cn("font-semibold", primaryTextClass)}>
                    {employee.totalPoints}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Linked Player Card */}
          {linkedPlayer && (
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  Linked Player Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        primaryBgClass
                      )}
                    >
                      <span className={cn("font-medium", primaryTextClass)}>
                        {linkedPlayer.firstName[0]}
                        {linkedPlayer.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">
                        {linkedPlayer.firstName} {linkedPlayer.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{linkedPlayer.email}</p>
                    </div>
                  </div>
                  <Separator className="my-2" />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">ELO Rating</span>
                      <p className="font-semibold">{linkedPlayer.hiddenElo.toFixed(0)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Points</span>
                      <p className="font-semibold">{linkedPlayer.visiblePoints}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push(`/${sport}/players/${linkedPlayer.id}`)}
                  >
                    View Player Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
