"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Trophy,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Check,
  Mail,
  Users,
  CreditCard,
  Star,
  Shield,
  UserPlus,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  link: string | null;
  createdAt: string;
  actionType?: string | null;
  actionData?: Record<string, unknown> | null;
  actionTaken: boolean;
  actionResult?: string | null;
}

interface NotificationCardProps {
  notification: NotificationData;
  sport: string;
  onMarkAsRead?: (id: string) => void;
  onActionComplete?: () => void;
  showActions?: boolean;
}

export default function NotificationCard({
  notification,
  sport,
  onMarkAsRead,
  onActionComplete,
  showActions = false,
}: NotificationCardProps) {
  const [isRead, setIsRead] = useState(notification.isRead);
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  const getNotificationIcon = () => {
    const iconClass = "w-5 h-5";
    switch (notification.type) {
      case "TOURNAMENT_REGISTERED":
        return <Trophy className={`${iconClass} text-emerald-500`} />;
      case "MATCH_RESULT":
      case "MATCH_RESULT_ENTERED":
        return <CheckCircle className={`${iconClass} text-blue-500`} />;
      case "POINTS_EARNED":
        return <Star className={`${iconClass} text-amber-500`} />;
      case "WAITLIST_PROMOTED":
        return <AlertCircle className={`${iconClass} text-purple-500`} />;
      case "TOURNAMENT_CANCELLED":
        return <AlertCircle className={`${iconClass} text-red-500`} />;
      case "ROSTER_INVITE":
        return <Users className={`${iconClass} text-indigo-500`} />;
      case "MATCH_SCHEDULED":
        return <Calendar className={`${iconClass} text-blue-500`} />;
      case "TOURNAMENT_REMINDER":
        return <Clock className={`${iconClass} text-orange-500`} />;
      case "PAYMENT_RECEIVED":
        return <CreditCard className={`${iconClass} text-green-500`} />;
      case "FOLLOW_NEW":
        return <UserPlus className={`${iconClass} text-pink-500`} />;
      case "ACHIEVEMENT_EARNED":
        return <Trophy className={`${iconClass} text-amber-500`} />;
      case "DISPUTE_RESOLVED":
        return <Shield className={`${iconClass} text-emerald-500`} />;
      case "TOURNAMENT_INVITE":
        return <Calendar className={`${iconClass} text-violet-500`} />;
      case "ORG_ADMIN_INVITE":
        return <Building2 className={`${iconClass} text-slate-500`} />;
      default:
        return <Bell className={`${iconClass} text-gray-500`} />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleMarkAsRead = async () => {
    if (isRead) return;

    try {
      const response = await fetch(`/api/notifications/${notification.id}/read`, {
        method: "POST",
      });

      if (response.ok) {
        setIsRead(true);
        onMarkAsRead?.(notification.id);
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const isActionable = false;

  return (
    <Card
      className={cn(
        "bg-white border-gray-100 shadow-sm transition-all",
        !isRead && "border-l-4 border-l-blue-500 bg-blue-50/30",
        isActionable && !notification.actionTaken && !isRead && "ring-1 ring-blue-100"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 mt-1">{getNotificationIcon()}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "font-medium",
                      !isRead ? "text-gray-900" : "text-gray-700"
                    )}
                  >
                    {notification.title}
                  </p>
                  {isActionable && !notification.actionTaken && (
                    <Badge
                      variant="outline"
                      className="text-xs border-blue-200 text-blue-600"
                    >
                      Action Required
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {notification.message}
                </p>
              </div>

              {/* Time and mark read */}
              <div className="flex-shrink-0 text-right">
                <p className="text-xs text-gray-400">
                  {getTimeAgo(notification.createdAt)}
                </p>
                {!isRead && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleMarkAsRead}
                    className="mt-2 h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Mail className="w-3 h-3 mr-1" />
                    Mark as read
                  </Button>
                )}
              </div>
            </div>

            {/* Link */}
            {notification.link && (
              <Link
                href={`/${sport}${notification.link}`}
                className={cn(
                  "text-sm mt-2 inline-block",
                  primaryTextClass
                )}
              >
                View details →
              </Link>
            )}

            {/* Notification actions are disabled in the MVP deployment path. */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
