"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Trophy,
  Award,
  Shield,
  Medal,
  Target,
} from "lucide-react";
import type { CorporateMode } from "./corporate-mode-toggle";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface CorporateModeNavProps {
  mode: CorporateMode;
  orgId?: string;
}

export function CorporateModeNav({ mode, orgId }: CorporateModeNavProps) {
  const pathname = usePathname();
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";

  const intraNavItems: NavItem[] = [
    {
      label: "Dashboard",
      href: `/${sport}/org/corporate/intra`,
      icon: LayoutDashboard,
    },
    {
      label: "Employees",
      href: `/${sport}/org/corporate/intra/employees`,
      icon: Users,
    },
    {
      label: "Internal Tournaments",
      href: `/${sport}/org/corporate/intra/tournaments`,
      icon: Trophy,
    },
    {
      label: "Leaderboard",
      href: `/${sport}/org/corporate/intra/leaderboard`,
      icon: Award,
    },
  ];

  const interNavItems: NavItem[] = [
    {
      label: "Dashboard",
      href: `/${sport}/org/corporate/inter`,
      icon: LayoutDashboard,
    },
    {
      label: "Rep Squads",
      href: `/${sport}/org/corporate/inter/squads`,
      icon: Shield,
    },
    {
      label: "External Tournaments",
      href: `/${sport}/org/corporate/inter/tournaments`,
      icon: Trophy,
    },
    {
      label: "Results",
      href: `/${sport}/org/corporate/inter/results`,
      icon: Medal,
    },
  ];

  const navItems = mode === "intra" ? intraNavItems : interNavItems;

  return (
    <nav className="flex items-center gap-1 overflow-x-auto" aria-label={`${mode === "intra" ? "Internal" : "External"} navigation`}>
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== `/${sport}/org/corporate/${mode}` && pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href}>
            <span
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                isActive
                  ? cn(primaryBgClass, primaryTextClass, "shadow-sm")
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

// Vertical nav variant for sidebar use
export function CorporateModeNavVertical({ mode }: CorporateModeNavProps) {
  const pathname = usePathname();
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";

  const intraNavItems: NavItem[] = [
    {
      label: "Dashboard",
      href: `/${sport}/org/corporate/intra`,
      icon: LayoutDashboard,
    },
    {
      label: "Employees",
      href: `/${sport}/org/corporate/intra/employees`,
      icon: Users,
    },
    {
      label: "Internal Tournaments",
      href: `/${sport}/org/corporate/intra/tournaments`,
      icon: Trophy,
    },
    {
      label: "Leaderboard",
      href: `/${sport}/org/corporate/intra/leaderboard`,
      icon: Award,
    },
  ];

  const interNavItems: NavItem[] = [
    {
      label: "Dashboard",
      href: `/${sport}/org/corporate/inter`,
      icon: LayoutDashboard,
    },
    {
      label: "Rep Squads",
      href: `/${sport}/org/corporate/inter/squads`,
      icon: Shield,
    },
    {
      label: "External Tournaments",
      href: `/${sport}/org/corporate/inter/tournaments`,
      icon: Trophy,
    },
    {
      label: "Results",
      href: `/${sport}/org/corporate/inter/results`,
      icon: Medal,
    },
  ];

  const navItems = mode === "intra" ? intraNavItems : interNavItems;

  return (
    <nav className="flex flex-col gap-1" aria-label={`${mode === "intra" ? "Internal" : "External"} navigation`}>
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== `/${sport}/org/corporate/${mode}` && pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href}>
            <span
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? cn(primaryBgClass, primaryTextClass, "shadow-sm")
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
