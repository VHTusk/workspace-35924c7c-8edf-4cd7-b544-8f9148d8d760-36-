"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface WaitlistStatusProps {
  tournamentId: string;
  sport: string;
}

interface WaitlistEntry {
  id: string;
  position: number;
  status: string;
  promotionExpiresAt: string | null;
}

export function WaitlistStatus({ tournamentId, sport }: WaitlistStatusProps) {
  const [entry, setEntry] = useState<WaitlistEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  useEffect(() => {
    fetchWaitlistStatus();
  }, [tournamentId]);

  const fetchWaitlistStatus = async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/waitlist`);
      if (response.ok) {
        const data = await response.json();
        setEntry(data.userEntry);
      }
    } catch (err) {
      console.error("Failed to fetch waitlist status:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !entry) {
    return null;
  }

  // Promoted - show urgent action
  if (entry.status === "PROMOTED" && entry.promotionExpiresAt) {
    const expires = new Date(entry.promotionExpiresAt);
    const now = new Date();
    const hoursLeft = Math.max(0, (expires.getTime() - now.getTime()) / (1000 * 60 * 60));

    return (
      <Link href={`/${sport}/tournaments/${tournamentId}/waitlist`}>
        <div className={cn(
          "p-3 rounded-lg border-2 animate-pulse",
          "bg-emerald-50 border-emerald-300"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              <span className="font-medium text-emerald-700">
                Spot Available!
              </span>
            </div>
            <Badge className="bg-emerald-600 text-white">
              {hoursLeft < 1 ? "< 1hr" : `${Math.ceil(hoursLeft)}hrs`} left
            </Badge>
          </div>
          <p className="text-sm text-emerald-600 mt-1">
            Click to confirm your registration
          </p>
        </div>
      </Link>
    );
  }

  // Regular waitlist status
  return (
    <Link href={`/${sport}/tournaments/${tournamentId}/waitlist`}>
      <div className={cn("p-3 rounded-lg border", primaryBgClass, "border-gray-200")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className={cn("w-4 h-4", primaryTextClass)} />
            <span className="text-sm text-gray-600">
              Position <strong className={primaryTextClass}>#{entry.position}</strong> on waitlist
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            View
          </Badge>
        </div>
      </div>
    </Link>
  );
}
