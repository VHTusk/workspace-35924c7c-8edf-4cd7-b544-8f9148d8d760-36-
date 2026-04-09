"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle,
  XCircle,
  Clock,
  Send,
  RefreshCw,
  Unlink2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type EmployeeLinkStatus = 
  | "NOT_LINKED"
  | "INVITE_PENDING"
  | "INVITE_EXPIRED"
  | "LINKED"
  | "UNLINKED";

interface EmployeeLinkStatusProps {
  status: EmployeeLinkStatus;
  inviteSentAt: string | null;
  inviteTokenExpires: string | null;
  linkedAt: string | null;
  employeeId: string;
  orgId: string;
  onSendInvite: () => void;
  onResendInvite: () => void;
  onUnlink: () => void;
  isLinked: boolean;
  loading?: string | null;
}

export function EmployeeLinkStatus({
  status,
  inviteSentAt,
  inviteTokenExpires,
  linkedAt,
  onSendInvite,
  onResendInvite,
  onUnlink,
  isLinked,
  loading,
}: EmployeeLinkStatusProps) {
  const getStatusBadge = () => {
    switch (status) {
      case "LINKED":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Linked
          </Badge>
        );
      case "INVITE_PENDING":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Invite Pending
          </Badge>
        );
      case "INVITE_EXPIRED":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Invite Expired
          </Badge>
        );
      case "UNLINKED":
        return (
          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            <Unlink2 className="w-3 h-3 mr-1" />
            Unlinked
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <XCircle className="w-3 h-3 mr-1" />
            Not Linked
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isInviteExpired = () => {
    if (!inviteTokenExpires) return false;
    return new Date(inviteTokenExpires) < new Date();
  };

  return (
    <Card className="border-gray-200">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Link Status:</span>
            {getStatusBadge()}
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-600 mb-4">
          {status === "LINKED" && linkedAt && (
            <p>
              <span className="font-medium">Linked on:</span> {formatDate(linkedAt)}
            </p>
          )}
          {status === "INVITE_PENDING" && inviteSentAt && (
            <>
              <p>
                <span className="font-medium">Invite sent:</span> {formatDate(inviteSentAt)}
              </p>
              {inviteTokenExpires && (
                <p className={cn(isInviteExpired() && "text-red-600")}>
                  <span className="font-medium">Expires:</span> {formatDate(inviteTokenExpires)}
                </p>
              )}
            </>
          )}
          {status === "INVITE_EXPIRED" && inviteSentAt && (
            <p>
              <span className="font-medium">Invite sent:</span> {formatDate(inviteSentAt)}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {status === "NOT_LINKED" && (
            <Button
              size="sm"
              onClick={onSendInvite}
              disabled={loading === "send"}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading === "send" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Invite
            </Button>
          )}

          {(status === "INVITE_PENDING" || status === "INVITE_EXPIRED") && (
            <Button
              size="sm"
              variant="outline"
              onClick={onResendInvite}
              disabled={loading === "resend"}
            >
              {loading === "resend" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Resend Invite
            </Button>
          )}

          {isLinked && (
            <Button
              size="sm"
              variant="destructive"
              onClick={onUnlink}
              disabled={loading === "unlink"}
            >
              {loading === "unlink" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Unlink2 className="w-4 h-4 mr-2" />
              )}
              Unlink
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default EmployeeLinkStatus;
