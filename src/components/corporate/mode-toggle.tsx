"use client";

import { useRouter, useParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Briefcase, Shield, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ModeToggleProps {
  currentMode: "internal" | "external";
  orgType?: string;
  className?: string;
}

export function ModeToggle({ currentMode, orgType, className }: ModeToggleProps) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  // Only show for CORPORATE organizations
  if (orgType !== "CORPORATE") {
    return null;
  }

  const primaryClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";

  const toggleMode = () => {
    // Determine the target URL based on current mode
    if (currentMode === "internal") {
      // Switch to External mode
      router.push(`/${sport}/org/rep-squads`);
    } else {
      // Switch to Internal mode
      router.push(`/${sport}/org/employees`);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleMode}
            className={cn(
              "gap-2 font-medium transition-all",
              currentMode === "internal"
                ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                : "border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-950/30 dark:text-purple-300",
              className
            )}
          >
            {currentMode === "internal" ? (
              <>
                <Briefcase className="w-4 h-4" />
                <span className="hidden sm:inline">Internal</span>
                <ArrowRightLeft className="w-3 h-3 ml-1 opacity-60" />
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">External</span>
                <ArrowRightLeft className="w-3 h-3 ml-1 opacity-60" />
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {currentMode === "internal"
              ? "Switch to External Mode (Corporate Leagues)"
              : "Switch to Internal Mode (Employee Sports)"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Hook to detect current mode from pathname
export function useCorporateMode(): "internal" | "external" {
  const pathname = usePathname();
  
  // Internal mode paths
  const internalPaths = [
    "/employees",
    "/employer-sports",
    "/intra",
  ];
  
  // External mode paths
  const externalPaths = [
    "/rep-squads",
    "/competitive-rep",
    "/inter",
    "/contract-players",
    "/contracts",
  ];
  
  for (const path of externalPaths) {
    if (pathname.includes(path)) {
      return "external";
    }
  }
  
  for (const path of internalPaths) {
    if (pathname.includes(path)) {
      return "internal";
    }
  }
  
  // Default to internal
  return "internal";
}
