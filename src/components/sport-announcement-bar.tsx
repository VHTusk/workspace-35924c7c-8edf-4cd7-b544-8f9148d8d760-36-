"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AnnouncementType = "LIVE" | "TOURNAMENT" | "RANKING";

export type SportAnnouncement = {
  id: string;
  type: AnnouncementType;
  message: string;
  href?: string;
};

type Props = {
  items?: SportAnnouncement[];
  loading?: boolean;
  intervalMs?: number;
  className?: string;
};

const TYPE_STYLES: Record<AnnouncementType, string> = {
  LIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  TOURNAMENT: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  RANKING: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300",
};

export function SportAnnouncementBar({
  items,
  loading = false,
  intervalMs = 3800,
  className,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const safeItems = items?.length ? items : [];

  useEffect(() => {
    if (paused || safeItems.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % safeItems.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, paused, safeItems.length]);

  useEffect(() => {
    if (activeIndex >= safeItems.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, safeItems.length]);

  const visibleItems = useMemo(() => {
    if (safeItems.length === 0) return [];
    if (safeItems.length === 1) return [safeItems[0]];

    return [
      safeItems[activeIndex],
      safeItems[(activeIndex + 1) % safeItems.length],
    ];
  }, [activeIndex, safeItems]);

  if (loading) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border/60 bg-background/90 px-4 py-3 shadow-sm backdrop-blur-sm",
          className,
        )}
      >
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Skeleton className="h-6 w-20 rounded-full" />
          <span className="text-xs font-medium uppercase tracking-[0.16em]">
            Loading updates...
          </span>
        </div>
      </div>
    );
  }

  if (safeItems.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-background/90 shadow-sm backdrop-blur-sm",
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex min-h-[48px] items-center overflow-hidden px-3 sm:px-4">
        <div className="grid w-full gap-2 md:grid-cols-2">
          {visibleItems.map((item, index) => (
            <AnnouncementItem
              key={`${item.id}-${activeIndex}-${index}`}
              item={item}
              className={cn(
                "transition-all duration-500 ease-out motion-reduce:transition-none",
                "translate-x-0 opacity-100",
              )}
              hideOnMobile={index === 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AnnouncementItem({
  item,
  className,
  hideOnMobile = false,
}: {
  item: SportAnnouncement;
  className?: string;
  hideOnMobile?: boolean;
}) {
  const content = (
    <div
      className={cn(
        "flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm",
        "border border-transparent hover:bg-muted/40",
        item.href &&
          "cursor-pointer transition-colors duration-200 hover:border-border/60",
        hideOnMobile && "hidden md:flex",
        className,
      )}
    >
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em]",
          TYPE_STYLES[item.type],
        )}
      >
        {item.type}
      </Badge>
      <p className="truncate text-foreground">
        <span className="mx-1 text-muted-foreground">•</span>
        {item.message}
      </p>
    </div>
  );

  if (!item.href) {
    return content;
  }

  return (
    <Link href={item.href} className="block">
      {content}
    </Link>
  );
}
