"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, Calendar, Share2, ExternalLink, AlertTriangle, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface NotificationActionsProps {
  notificationId: string;
  type: string;
  actionTaken: boolean;
  actionResult?: string | null;
  actionData?: Record<string, unknown>;
  onActionComplete?: () => void;
  isCornhole?: boolean;
}

interface ActionButton {
  action: string;
  label: string;
  variant: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  icon?: React.ReactNode;
}

export default function NotificationActions({
  notificationId,
  type,
  actionTaken,
  actionResult,
  onActionComplete,
  isCornhole = true,
}: NotificationActionsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [localActionTaken, setLocalActionTaken] = useState(actionTaken);
  const [localActionResult, setLocalActionResult] = useState(actionResult);

  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";

  const getActions = (): ActionButton[] => {
    switch (type) {
      case "ROSTER_INVITE":
        return [
          { action: "ACCEPT", label: "Accept", variant: "default", icon: <Check className="w-4 h-4" /> },
          { action: "DECLINE", label: "Decline", variant: "outline", icon: <X className="w-4 h-4" /> },
        ];

      case "MATCH_SCHEDULED":
        return [
          { action: "CONFIRM", label: "Confirm Availability", variant: "default", icon: <Check className="w-4 h-4" /> },
          { action: "RESCHEDULE", label: "Request Reschedule", variant: "outline", icon: <Calendar className="w-4 h-4" /> },
        ];

      case "TOURNAMENT_REMINDER":
        return [
          { action: "VIEW", label: "View Tournament", variant: "default", icon: <ExternalLink className="w-4 h-4" /> },
          { action: "SET_REMINDER", label: "Set Reminder", variant: "outline", icon: <Calendar className="w-4 h-4" /> },
        ];

      case "PAYMENT_RECEIVED":
        return [
          { action: "VIEW_RECEIPT", label: "View Receipt", variant: "default", icon: <ExternalLink className="w-4 h-4" /> },
          { action: "DOWNLOAD_INVOICE", label: "Download Invoice", variant: "outline", icon: <ExternalLink className="w-4 h-4" /> },
        ];

      case "MATCH_RESULT_ENTERED":
        return [
          { action: "CONFIRM", label: "Confirm Result", variant: "default", icon: <Check className="w-4 h-4" /> },
          { action: "DISPUTE", label: "Dispute Result", variant: "destructive", icon: <AlertTriangle className="w-4 h-4" /> },
        ];

      case "FOLLOW_NEW":
        return [
          { action: "FOLLOW_BACK", label: "Follow Back", variant: "default", icon: <UserPlus className="w-4 h-4" /> },
        ];

      case "ACHIEVEMENT_EARNED":
        return [
          { action: "SHARE", label: "Share", variant: "default", icon: <Share2 className="w-4 h-4" /> },
          { action: "VIEW_BADGE", label: "View Badge", variant: "outline", icon: <ExternalLink className="w-4 h-4" /> },
        ];

      case "DISPUTE_RESOLVED":
        return [
          { action: "VIEW_DETAILS", label: "View Details", variant: "default", icon: <ExternalLink className="w-4 h-4" /> },
          { action: "ACCEPT", label: "Accept", variant: "outline", icon: <Check className="w-4 h-4" /> },
        ];

      case "TOURNAMENT_INVITE":
        return [
          { action: "REGISTER", label: "Register", variant: "default", icon: <Check className="w-4 h-4" /> },
          { action: "DECLINE", label: "Decline", variant: "outline", icon: <X className="w-4 h-4" /> },
        ];

      case "ORG_ADMIN_INVITE":
        return [
          { action: "ACCEPT", label: "Accept", variant: "default", icon: <Check className="w-4 h-4" /> },
          { action: "DECLINE", label: "Decline", variant: "outline", icon: <X className="w-4 h-4" /> },
        ];

      default:
        return [];
    }
  };

  const handleAction = async (action: string) => {
    setLoading(action);

    try {
      const response = await fetch(`/api/notifications/${notificationId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: data.message,
          variant: "default",
        });

        setLocalActionTaken(true);
        setLocalActionResult(action);
        onActionComplete?.();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to perform action",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Action error:", error);
      toast({
        title: "Error",
        description: "Failed to perform action. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const actions = getActions();

  // If action was already taken, show the result
  if (localActionTaken && localActionResult) {
    const resultLabel = localActionResult.replace(/_/g, " ").toLowerCase();
    return (
      <div className="flex items-center gap-2 mt-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          <Check className="w-3 h-3" />
          {resultLabel}
        </span>
      </div>
    );
  }

  // If no actions available for this type
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {actions.map((actionBtn) => {
        const isLoading = loading === actionBtn.action;
        const isPrimary = actionBtn.variant === "default";

        return (
          <Button
            key={actionBtn.action}
            size="sm"
            variant={actionBtn.variant}
            onClick={() => handleAction(actionBtn.action)}
            disabled={loading !== null}
            className={cn(
              "h-8 text-xs gap-1.5",
              isPrimary && primaryBtnClass
            )}
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              actionBtn.icon
            )}
            {actionBtn.label}
          </Button>
        );
      })}
    </div>
  );
}
