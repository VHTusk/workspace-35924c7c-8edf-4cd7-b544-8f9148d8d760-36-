"use client";

import { useRouter, useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Lock,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

interface SportInfo {
  id: string;
  name: string;
  status: "ACTIVE" | "TRIAL" | "INACTIVE" | "EXPIRED";
  planType?: string;
  expiresAt?: string;
}

// Available sports in the system
const AVAILABLE_SPORTS = [
  { id: "cornhole", name: "Cornhole", icon: "🎯" },
  { id: "darts", name: "Darts", icon: "🎯" },
  { id: "badminton", name: "Badminton", icon: "🏸" },
  { id: "cricket", name: "Cricket", icon: "🏏" },
  { id: "football", name: "Football", icon: "⚽" },
  { id: "table-tennis", name: "Table Tennis", icon: "🏓" },
];

interface SportSwitcherProps {
  className?: string;
  compact?: boolean;
}

export function SportSwitcher({ className, compact }: SportSwitcherProps) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const currentSport = params.sport as string;
  
  const [loading, setLoading] = useState(true);
  const [sports, setSports] = useState<SportInfo[]>([]);
  
  useEffect(() => {
    fetchSports();
  }, []);

  const fetchSports = async () => {
    setLoading(true);
    try {
      const orgResponse = await fetch("/api/org/me");
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        const sportsResponse = await fetch(`/api/orgs/${orgData.id}/sports`);
        if (sportsResponse.ok) {
          const sportsData = await sportsResponse.json();
          setSports(sportsData.sports || []);
        } else {
          // Default to current sport as active for demo
          setSports([
            { id: currentSport, name: currentSport.charAt(0).toUpperCase() + currentSport.slice(1), status: "ACTIVE" }
          ]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch sports:", error);
      // Fallback for demo
      setSports([
        { id: currentSport, name: currentSport.charAt(0).toUpperCase() + currentSport.slice(1), status: "ACTIVE" }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getSportStatus = (sportId: string): SportInfo["status"] => {
    const sport = sports.find(s => s.id === sportId);
    return sport?.status || "INACTIVE";
  };

  const handleSportChange = (sportId: string) => {
    const status = getSportStatus(sportId);
    
    if (status === "INACTIVE" || status === "EXPIRED") {
      // Redirect to subscription page
      router.push(`/${sportId}/org/subscription?activate=true`);
      return;
    }
    
    // Navigate to the same relative path but in the new sport
    const pathWithoutSport = pathname.replace(`/${currentSport}`, "");
    router.push(`/${sportId}${pathWithoutSport}`);
  };

  const currentSportInfo = AVAILABLE_SPORTS.find(s => s.id === currentSport);
  const currentStatus = getSportStatus(currentSport);

  if (loading) {
    return (
      <Button variant="outline" size="sm" className={cn("gap-2", className)} disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
        {currentSportInfo?.name || currentSport}
      </Button>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Select Sport
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {AVAILABLE_SPORTS.map((sport) => {
          const status = getSportStatus(sport.id);
          const isActive = sport.id === currentSport;
          const isLocked = status === "INACTIVE" || status === "EXPIRED";
          const isTrial = status === "TRIAL";

          return (
            <button
              key={sport.id}
              onClick={() => handleSportChange(sport.id)}
              disabled={loading}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                "hover:shadow-md",
                isActive && status === "ACTIVE" && "border-primary bg-primary/5 shadow-sm",
                isActive && isTrial && "border-amber-400 bg-amber-50 dark:bg-amber-950/20 shadow-sm",
                !isActive && !isLocked && "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
                isLocked && "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-60 cursor-pointer"
              )}
            >
              {isLocked && (
                <div className="absolute top-2 right-2">
                  <Lock className="w-4 h-4 text-gray-400" />
                </div>
              )}
              {isTrial && !isLocked && (
                <Badge className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[10px]">
                  Trial
                </Badge>
              )}
              {isActive && status === "ACTIVE" && (
                <div className="absolute top-2 right-2">
                  <Check className="w-4 h-4 text-primary" />
                </div>
              )}
              <span className="text-2xl">{sport.icon}</span>
              <span className={cn(
                "text-sm font-medium",
                isActive ? "text-primary" : "text-gray-700 dark:text-gray-300"
              )}>
                {sport.name}
              </span>
              {isLocked && (
                <span className="text-[10px] text-gray-400">Click to activate</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Compact inline version for header/nav use
export function SportSwitcherInline({ className }: { className?: string }) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const currentSport = params.sport as string;
  
  const [sports, setSports] = useState<SportInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSports = async () => {
      try {
        const orgResponse = await fetch("/api/org/me");
        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          const sportsResponse = await fetch(`/api/orgs/${orgData.id}/sports`);
          if (sportsResponse.ok) {
            const sportsData = await sportsResponse.json();
            setSports(sportsData.sports || []);
          }
        }
      } catch (error) {
        console.error("Failed to fetch sports:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSports();
  }, []);

  const getSportStatus = (sportId: string): SportInfo["status"] => {
    const sport = sports.find(s => s.id === sportId);
    return sport?.status || "INACTIVE";
  };

  const handleSportChange = (sportId: string) => {
    const status = getSportStatus(sportId);
    
    if (status === "INACTIVE" || status === "EXPIRED") {
      router.push(`/${sportId}/org/subscription?activate=true`);
      return;
    }
    
    const pathWithoutSport = pathname.replace(`/${currentSport}`, "");
    router.push(`/${sportId}${pathWithoutSport}`);
  };

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto pb-1", className)}>
      {AVAILABLE_SPORTS.map((sport) => {
        const status = getSportStatus(sport.id);
        const isActive = sport.id === currentSport;
        const isLocked = status === "INACTIVE" || status === "EXPIRED";

        return (
          <button
            key={sport.id}
            onClick={() => handleSportChange(sport.id)}
            title={isLocked ? `${sport.name} (Locked - Click to activate)` : sport.name}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              isActive && status === "ACTIVE" && "bg-primary text-primary-foreground",
              isActive && status === "TRIAL" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
              !isActive && !isLocked && "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
              isLocked && "text-gray-400 cursor-pointer opacity-50 hover:opacity-75"
            )}
          >
            <span>{sport.icon}</span>
            <span className="hidden sm:inline">{sport.name}</span>
            {isLocked && <Lock className="w-3 h-3" />}
          </button>
        );
      })}
    </div>
  );
}
