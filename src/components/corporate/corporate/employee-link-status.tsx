"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Mail,
  RefreshCw,
  Link2,
  Unlink2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type EmployeeLinkStatus = "PENDING" | "INVITED" | "LINKED" | "DECLINED" | "EXPIRED" | "UNLINKED";

interface EmployeeLinkStatusProps {
  status: EmployeeLinkStatus;
  inviteSentAt?: string | null;
  inviteTokenExpires?: string | null;
  linkedAt?: string | null;
  employeeId: string;
  orgId: string;
  onSendInvite?: () => void;
  onResendInvite?: () => void;
  onUnlink?: () => void;
  isLinked?: boolean;
}

const statusConfig: Record<
  EmployeeLinkStatus,
  {
    label: string;
    icon: typeof Clock;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
  }
> = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    description: "Employee has not been invited yet",
  },
  INVITED: {
    label: "Invited",
    icon: Mail,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "Invitation sent, awaiting response",
  },
  LINKED: {
    label: "Linked",
    icon: CheckCircle,
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    description: "Successfully linked to player account",
  },
  DECLINED: {
    label: "Declined",
    icon: XCircle,
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    description: "Employee declined the invitation",
  },
  EXPIRED: {
    label: "Expired",
    icon: AlertCircle,
    color: "text-gray-700",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    description: "Invitation expired without response",
  },
  UNLINKED: {
    label: "Unlinked",
    icon: Unlink2,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    description: "Previously linked, now disconnected",
  },
};

export function EmployeeLinkStatus({
  status,
  inviteSentAt,
  inviteTokenExpires,
  linkedAt,
  employeeId,
  orgId,
  onSendInvite,
  onResendInvite,
  onUnlink,
  isLinked = false,
}: EmployeeLinkStatusProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = statusConfig[status];
  const Icon = config.icon;

  const handleSendInvite = async () => {
    if (!onSendInvite) return;
    setIsLoading(true);
    setError(null);
    try {
      await onSendInvite();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendInvite = async () => {
    if (!onResendInvite) return;
    setIsLoading(true);
    setError(null);
    try {
      await onResendInvite();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend invite");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!onUnlink) return;
    setIsLoading(true);
    setError(null);
    try {
      await onUnlink();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink employee");
    } finally {
      setIsLoading(false);
    }
  };

  const isExpired = inviteTokenExpires && new Date() > new Date(inviteTokenExpires);

  return (
    <div className="space-y-3">
      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "px-3 py-1.5 font-medium",
            config.color,
            config.bgColor,
            config.borderColor
          )}
        >
          <Icon className="w-3.5 h-3.5 mr-1.5" />
          {config.label}
        </Badge>
        {isLinked && (
          <Badge variant="secondary" className="text-xs">
            <Link2 className="w-3 h-3 mr-1" />
            Has Player Account
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500">{config.description}</p>

      {/* Status-specific info */}
      {status === "INVITED" && inviteSentAt && (
        <div className="text-xs text-gray-500 space-y-1">
          <p>
            Sent: {new Date(inviteSentAt).toLocaleDateString()} at{" "}
            {new Date(inviteSentAt).toLocaleTimeString()}
          </p>
          {inviteTokenExpires && (
            <p className={cn(isExpired && "text-red-600 font-medium")}>
              {isExpired
                ? "Expired"
                : `Expires: ${new Date(inviteTokenExpires).toLocaleDateString()}`}
            </p>
          )}
        </div>
      )}

      {status === "LINKED" && linkedAt && (
        <p className="text-xs text-gray-500">
          Linked: {new Date(linkedAt).toLocaleDateString()} at{" "}
          {new Date(linkedAt).toLocaleTimeString()}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>
      )}

      {/* Action buttons based on status */}
      <div className="flex flex-wrap gap-2 pt-2">
        {status === "PENDING" && onSendInvite && (
          <Button
            size="sm"
            onClick={handleSendInvite}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Mail className="w-4 h-4 mr-1" />
            )}
            Send Invite
          </Button>
        )}

        {(status === "INVITED" || status === "EXPIRED" || status === "DECLINED") && onResendInvite && (
          <Button size="sm" variant="outline" onClick={handleResendInvite} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            {status === "INVITED" ? "Resend Invite" : "Send New Invite"}
          </Button>
        )}

        {status === "LINKED" && onUnlink && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleUnlink}
            disabled={isLoading}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Unlink2 className="w-4 h-4 mr-1" />
            )}
            Unlink Account
          </Button>
        )}
      </div>
    </div>
  );
}
