"use client";

import { useRouter, usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Building2, Shield } from "lucide-react";

export type CorporateMode = "intra" | "inter";

interface CorporateModeToggleProps {
  currentMode: CorporateMode;
  onModeChange?: (mode: CorporateMode) => void;
  className?: string;
}

export function CorporateModeToggle({ currentMode, onModeChange, className }: CorporateModeToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryClass = isCornhole ? "bg-green-600" : "bg-teal-600";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";

  const handleModeChange = (mode: CorporateMode) => {
    if (onModeChange) {
      onModeChange(mode);
    } else {
      // Navigate to the appropriate route
      const basePath = `/${sport}/org/corporate/${mode}`;
      router.push(basePath);
    }
  };

  return (
    <div className={cn("inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1", className)}>
      <button
        onClick={() => handleModeChange("intra")}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
          currentMode === "intra"
            ? cn(primaryBgClass, primaryTextClass, "shadow-sm")
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        )}
        aria-pressed={currentMode === "intra"}
        aria-label="Switch to Internal mode"
      >
        <Building2 className="w-4 h-4" />
        <span>Internal</span>
      </button>
      <button
        onClick={() => handleModeChange("inter")}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
          currentMode === "inter"
            ? cn(primaryBgClass, primaryTextClass, "shadow-sm")
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        )}
        aria-pressed={currentMode === "inter"}
        aria-label="Switch to External mode"
      >
        <Shield className="w-4 h-4" />
        <span>External</span>
      </button>
    </div>
  );
}

// Compact version for use in headers/nav
export function CorporateModeToggleCompact({ currentMode, onModeChange }: { currentMode: CorporateMode; onModeChange?: (mode: CorporateMode) => void }) {
  const router = useRouter();
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";

  const handleModeChange = (mode: CorporateMode) => {
    if (onModeChange) {
      onModeChange(mode);
    } else {
      router.push(`/${sport}/org/corporate/${mode}`);
    }
  };

  return (
    <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5 text-xs">
      <button
        onClick={() => handleModeChange("intra")}
        className={cn(
          "px-2.5 py-1 rounded-sm font-medium transition-all",
          currentMode === "intra"
            ? cn(primaryBgClass, primaryTextClass)
            : "text-gray-500 hover:text-gray-700"
        )}
      >
        Internal
      </button>
      <button
        onClick={() => handleModeChange("inter")}
        className={cn(
          "px-2.5 py-1 rounded-sm font-medium transition-all",
          currentMode === "inter"
            ? cn(primaryBgClass, primaryTextClass)
            : "text-gray-500 hover:text-gray-700"
        )}
      >
        External
      </button>
    </div>
  );
}
