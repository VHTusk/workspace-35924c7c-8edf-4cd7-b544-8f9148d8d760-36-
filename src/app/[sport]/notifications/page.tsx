"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "@/components/layout/sidebar";
import {
  Bell,
  Trophy,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Check,
  Trash2,
  Mail,
  MailOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  link: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState("all");
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);
      const response = await fetch("/api/notifications", { signal });
      if (response.ok && !signal.aborted) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error("Failed to fetch notifications:", error);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [sport, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "TOURNAMENT_REGISTERED":
        return <Trophy className="w-5 h-5 text-emerald-500" />;
      case "MATCH_RESULT":
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case "POINTS_EARNED":
        return <Trophy className="w-5 h-5 text-amber-500" />;
      case "WAITLIST_PROMOTED":
        return <AlertCircle className="w-5 h-5 text-purple-500" />;
      case "TOURNAMENT_CANCELLED":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
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

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "unread") return !n.isRead;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                onClick={markAllAsRead}
                className="gap-2"
              >
                <Check className="w-4 h-4" />
                Mark all as read
              </Button>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-white border border-gray-200">
              <TabsTrigger value="all" className="gap-2">
                <Mail className="w-4 h-4" />
                All
                <Badge variant="secondary" className="ml-1">
                  {notifications.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="unread" className="gap-2">
                <MailOpen className="w-4 h-4" />
                Unread
                {unreadCount > 0 && (
                  <Badge className={cn("ml-1 text-white", primaryBtnClass)}>
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3">
              {renderNotifications(filteredNotifications)}
            </TabsContent>

            <TabsContent value="unread" className="space-y-3">
              {renderNotifications(filteredNotifications)}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );

  function renderNotifications(notifs: Notification[]) {
    if (notifs.length === 0) {
      return (
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="py-12 text-center">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {activeTab === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {activeTab === "unread"
                ? "You've read all your notifications"
                : "When you get notifications, they'll show up here"}
            </p>
          </CardContent>
        </Card>
      );
    }

    return notifs.map((notification) => (
      <Card
        key={notification.id}
        className={cn(
          "bg-white border-gray-100 shadow-sm transition-all",
          !notification.isRead && "border-l-4 border-l-blue-500 bg-blue-50/30"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              {getNotificationIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={cn("font-medium", !notification.isRead && "text-gray-900")}>
                    {notification.title}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-gray-400">{getTimeAgo(notification.createdAt)}</p>
                  {!notification.isRead && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markAsRead(notification.id)}
                      className="mt-2 h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      Mark as read
                    </Button>
                  )}
                </div>
              </div>
              {notification.link && (
                <Link
                  href={notification.link}
                  className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
                >
                  View details →
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    ));
  }
}
