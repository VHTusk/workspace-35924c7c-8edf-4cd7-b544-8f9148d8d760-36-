"use client";

import { useRouter, usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { BookOpen, Shield } from "lucide-react";

export type SchoolMode = "internal" | "external";

interface SchoolModeToggleProps {
  currentMode: SchoolMode;
  onModeChange?: (mode: SchoolMode) => void;
  className?: string;
}

export function SchoolModeToggle({ currentMode, onModeChange, className }: SchoolModeToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryClass = isCornhole ? "bg-green-600" : "bg-teal-600";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";

  const handleModeChange = (mode: SchoolMode) => {
    if (onModeChange) {
      onModeChange(mode);
    } else {
      // Navigate to the appropriate route
      // "external" mode uses "inter" path, "internal" mode uses "internal" path
      const basePath = `/${sport}/org/school/${mode === "internal" ? "internal" : "inter"}`;
      router.push(basePath);
    }
  };

  return (
    <div className={cn("inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1", className)}>
      <button
        onClick={() => handleModeChange("internal")}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
          currentMode === "internal"
            ? cn(primaryBgClass, primaryTextClass, "shadow-sm")
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        )}
        aria-pressed={currentMode === "internal"}
        aria-label="Switch to Internal mode"
      >
        <BookOpen className="w-4 h-4" />
        <span>Internal</span>
      </button>
      <button
        onClick={() => handleModeChange("external")}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
          currentMode === "external"
            ? cn(primaryBgClass, primaryTextClass, "shadow-sm")
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        )}
        aria-pressed={currentMode === "external"}
        aria-label="Switch to External mode"
      >
        <Shield className="w-4 h-4" />
        <span>External</span>
      </button>
    </div>
  );
}

// Compact version for use in headers/nav
export function SchoolModeToggleCompact({ currentMode, onModeChange }: { currentMode: SchoolMode; onModeChange?: (mode: SchoolMode) => void }) {
  const router = useRouter();
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";

  const handleModeChange = (mode: SchoolMode) => {
    if (onModeChange) {
      onModeChange(mode);
    } else {
      // "external" mode uses "inter" path, "internal" mode uses "internal" path
      router.push(`/${sport}/org/school/${mode === "internal" ? "internal" : "inter"}`);
    }
  };

  return (
    <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5 text-xs">
      <button
        onClick={() => handleModeChange("internal")}
        className={cn(
          "px-2.5 py-1 rounded-sm font-medium transition-all",
          currentMode === "internal"
            ? cn(primaryBgClass, primaryTextClass)
            : "text-gray-500 hover:text-gray-700"
        )}
      >
        Internal
      </button>
      <button
        onClick={() => handleModeChange("external")}
        className={cn(
          "px-2.5 py-1 rounded-sm font-medium transition-all",
          currentMode === "external"
            ? cn(primaryBgClass, primaryTextClass)
            : "text-gray-500 hover:text-gray-700"
        )}
      >
        External
      </button>
    </div>
  );
}
