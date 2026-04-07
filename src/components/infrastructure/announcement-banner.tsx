"use client";

import { useState } from "react";
import { X, Megaphone, Gift, AlertTriangle, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Announcement {
  id: string;
  type: "info" | "promo" | "warning" | "feature";
  message: string;
  link?: string;
  linkText?: string;
  dismissible?: boolean;
}

interface AnnouncementBannerProps {
  sport: string;
  className?: string;
}

export function AnnouncementBanner({ sport, className }: AnnouncementBannerProps) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  // In production, this would come from an API
  const announcements: Announcement[] = [
    {
      id: "welcome",
      type: "info",
      message: "Welcome to VALORHIVE! Join tournaments and start competing.",
      link: `/${sport}/tournaments`,
      linkText: "Browse Tournaments",
      dismissible: true,
    },
  ];

  const activeAnnouncement = announcements.find((a) => !dismissed.includes(a.id) && isVisible);

  if (!activeAnnouncement) return null;

  const getStyles = (type: string) => {
    switch (type) {
      case "promo":
        return {
          bg: "bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20",
          border: "border-purple-500/30",
          text: "text-purple-700 dark:text-purple-300",
          icon: Gift,
        };
      case "warning":
        return {
          bg: "bg-amber-500/10",
          border: "border-amber-500/30",
          text: "text-amber-700 dark:text-amber-300",
          icon: AlertTriangle,
        };
      case "feature":
        return {
          bg: sport === "cornhole" 
            ? "bg-green-500/10" 
            : "bg-teal-500/10",
          border: sport === "cornhole"
            ? "border-green-500/30"
            : "border-teal-500/30",
          text: sport === "cornhole"
            ? "text-green-700 dark:text-green-300"
            : "text-teal-700 dark:text-teal-300",
          icon: Sparkles,
        };
      default:
        return {
          bg: "bg-blue-500/10",
          border: "border-blue-500/30",
          text: "text-blue-700 dark:text-blue-300",
          icon: Info,
        };
    }
  };

  const styles = getStyles(activeAnnouncement.type);
  const Icon = activeAnnouncement.type === "info" ? Megaphone : styles.icon;

  const handleDismiss = () => {
    setDismissed((prev) => [...prev, activeAnnouncement.id]);
    setIsVisible(false);
  };

  return (
    <div
      className={cn(
        "w-full py-2 px-4",
        styles.bg,
        "border-b",
        styles.border,
        className
      )}
    >
      <div className="container mx-auto flex items-center justify-center gap-3">
        <Icon className={cn("w-4 h-4 shrink-0", styles.text)} />
        <p className={cn("text-sm font-medium", styles.text)}>
          {activeAnnouncement.message}
        </p>
        {activeAnnouncement.link && activeAnnouncement.linkText && (
          <a
            href={activeAnnouncement.link}
            className={cn(
              "text-xs font-semibold underline underline-offset-2",
              styles.text
            )}
          >
            {activeAnnouncement.linkText}
          </a>
        )}
        {activeAnnouncement.dismissible && (
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-5 w-5 p-0", styles.text)}
            onClick={handleDismiss}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Admin announcement management component
export function AnnouncementManager() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Create and manage platform-wide announcements
      </p>
      {/* Add announcement form would go here */}
    </div>
  );
}
