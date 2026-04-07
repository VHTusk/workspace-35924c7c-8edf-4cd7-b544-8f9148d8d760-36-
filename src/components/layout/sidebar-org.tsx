"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Trophy,
  BarChart3,
  Award,
  Users,
  Building2,
  LogOut,
  CreditCard,
  FileText,
  PlusCircle,
  Briefcase,
  Settings,
  UserCheck,
  Menu,
  Shield,
  LayoutDashboard,
  ArrowLeft,
  BookOpen,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { CorporateModeToggleCompact } from "@/components/corporate/corporate-mode-toggle";
import type { CorporateMode } from "@/components/corporate/corporate-mode-toggle";
import { SchoolModeToggleCompact } from "@/components/school/school-mode-toggle";
import type { SchoolMode } from "@/components/school/school-mode-toggle";

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  hasIndicator?: boolean;
}

interface SidebarContentProps {
  orgData: {
    id: string;
    name: string;
    email?: string;
    totalPoints: number;
    rank: number | null;
    totalMembers: number;
    tournamentsHosted: number;
    isSubscribed: boolean;
    type?: string;
  } | null;
  primaryClass: string;
  primaryTextClass: string;
  primaryBgClass: string;
  menuItems: MenuItem[];
  pathname: string;
  sport: string;
  onLogout: () => void;
  onLinkClick?: () => void;
  isCorporateSection?: boolean;
  corporateMode?: CorporateMode;
  onCorporateModeChange?: (mode: CorporateMode) => void;
  isSchoolSection?: boolean;
  schoolMode?: SchoolMode;
  onSchoolModeChange?: (mode: SchoolMode) => void;
}

function SidebarContent({
  orgData,
  primaryClass,
  primaryTextClass,
  primaryBgClass,
  menuItems,
  pathname,
  sport,
  onLogout,
  onLinkClick,
  isCorporateSection,
  corporateMode,
  onCorporateModeChange,
  isSchoolSection,
  schoolMode,
  onSchoolModeChange,
}: SidebarContentProps) {
  // Get corporate-specific menu items based on mode
  const getCorporateMenuItems = (mode: CorporateMode): MenuItem[] => {
    if (mode === "intra") {
      return [
        { icon: LayoutDashboard, label: "Internal Dashboard", href: `/${sport}/org/corporate/intra` },
        { icon: Users, label: "Employees", href: `/${sport}/org/corporate/intra/employees` },
        { icon: Trophy, label: "Internal Tournaments", href: `/${sport}/org/corporate/intra/tournaments` },
        { icon: Award, label: "Leaderboard", href: `/${sport}/org/corporate/intra/leaderboard` },
      ];
    } else {
      return [
        { icon: LayoutDashboard, label: "External Dashboard", href: `/${sport}/org/corporate/inter` },
        { icon: Shield, label: "Rep Squads", href: `/${sport}/org/corporate/inter/squads` },
        { icon: Trophy, label: "External Tournaments", href: `/${sport}/org/corporate/inter/tournaments` },
        { icon: BarChart3, label: "Results", href: `/${sport}/org/corporate/inter/results` },
      ];
    }
  };

  const corporateMenuItems = corporateMode ? getCorporateMenuItems(corporateMode) : [];

  // Get school-specific menu items based on mode
  const getSchoolMenuItems = (mode: SchoolMode): MenuItem[] => {
    if (mode === "internal") {
      return [
        { icon: LayoutDashboard, label: "Internal Dashboard", href: `/${sport}/org/school/internal` },
        { icon: Users, label: "Students", href: `/${sport}/org/school/internal/students` },
        { icon: BookOpen, label: "Classes", href: `/${sport}/org/school/internal/classes` },
        { icon: Home, label: "Houses", href: `/${sport}/org/school/internal/houses` },
        { icon: Trophy, label: "Internal Tournaments", href: `/${sport}/org/school/internal/tournaments` },
        { icon: Award, label: "Leaderboard", href: `/${sport}/org/school/internal/leaderboard` },
      ];
    } else {
      return [
        { icon: LayoutDashboard, label: "External Dashboard", href: `/${sport}/org/school/inter` },
        { icon: Shield, label: "School Teams", href: `/${sport}/org/school/inter/teams` },
        { icon: Trophy, label: "External Tournaments", href: `/${sport}/org/school/inter/tournaments` },
        { icon: BarChart3, label: "Results", href: `/${sport}/org/school/inter/results` },
        { icon: Award, label: "Leaderboard", href: `/${sport}/org/school/inter/leaderboard` },
      ];
    }
  };

  const schoolMenuItems = schoolMode ? getSchoolMenuItems(schoolMode) : [];

  return (
    <div className="flex flex-col h-full">
      {/* Org Card */}
      <div className="p-4 pt-5">
        <div className={cn("rounded-xl p-4 text-white relative overflow-hidden", primaryClass)}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-12 w-12 border-2 border-white/30">
                <AvatarFallback className={cn("text-white font-bold", primaryClass)}>
                  <Building2 className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{orgData?.name || "Organization"}</p>
                <p className="text-xs text-white/70 truncate">{orgData?.email || ""}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/20 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Trophy className="w-4 h-4" />
                  <span className="text-xs text-white/80">Points</span>
                </div>
                <p className="text-xl font-bold">{orgData?.totalPoints?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Award className="w-4 h-4" />
                  <span className="text-xs text-white/80">Rank</span>
                </div>
                <p className="text-xl font-bold">
                  {orgData?.rank ? `#${orgData.rank}` : "--"}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-white/80 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {orgData?.totalMembers || 0} Members
              </span>
              <span className="text-white/80 flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                {orgData?.tournamentsHosted || 0} Events
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Corporate Mode Toggle (if in corporate section) */}
      {isCorporateSection && corporateMode && onCorporateModeChange && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mode</span>
          </div>
          <CorporateModeToggleCompact 
            currentMode={corporateMode} 
            onModeChange={onCorporateModeChange} 
          />
        </div>
      )}

      {/* School Mode Toggle (if in school section) */}
      {isSchoolSection && schoolMode && onSchoolModeChange && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mode</span>
          </div>
          <SchoolModeToggleCompact 
            currentMode={schoolMode} 
            onModeChange={onSchoolModeChange} 
          />
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {/* Back to Dashboard Link - Always at top */}
        <Link
          href="/org/home"
          onClick={onLinkClick}
          className="flex items-center gap-2 px-3 py-2.5 mb-3 rounded-lg text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        
        {/* Corporate-specific menu items */}
        {isCorporateSection && corporateMenuItems.length > 0 && (
          <>
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">
                {corporateMode === "intra" ? "Internal" : "External"}
              </span>
            </div>
            <ul className="space-y-1 mb-4">
              {corporateMenuItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onLinkClick}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        isActive
                          ? cn(primaryBgClass, primaryTextClass, "shadow-sm")
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5", isActive ? primaryTextClass : "text-muted-foreground")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-sidebar-border my-3" />
          </>
        )}

        {/* School-specific menu items */}
        {isSchoolSection && schoolMenuItems.length > 0 && (
          <>
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">
                {schoolMode === "internal" ? "Internal" : "External"}
              </span>
            </div>
            <ul className="space-y-1 mb-4">
              {schoolMenuItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onLinkClick}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        isActive
                          ? cn(primaryBgClass, primaryTextClass, "shadow-sm")
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5", isActive ? primaryTextClass : "text-muted-foreground")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-sidebar-border my-3" />
          </>
        )}

        {/* Workspace section (always visible) */}
        <div className="mb-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">
            Workspace
          </span>
        </div>
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onLinkClick}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? cn(primaryBgClass, primaryTextClass, "shadow-sm")
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? primaryTextClass : "text-muted-foreground")} />
                  {item.label}
                  {item.hasIndicator && (
                    <span
                      className={cn(
                        "ml-auto w-2.5 h-2.5 rounded-full",
                        orgData?.isSubscribed
                          ? "bg-green-500 animate-pulse"
                          : "bg-amber-400"
                      )}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Section with Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={() => {
            onLogout();
            onLinkClick?.();
          }}
        >
          <LogOut className="w-5 h-5" />
          Logout
        </Button>
      </div>
    </div>
  );
}

export default function SidebarOrg() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Detect if we're in the corporate section and which mode
  const isCorporateSection = pathname.includes("/org/corporate/");
  const getCorporateMode = (): CorporateMode => {
    if (pathname.includes("/org/corporate/intra")) return "intra";
    if (pathname.includes("/org/corporate/inter")) return "inter";
    return "intra"; // default
  };
  const corporateMode = isCorporateSection ? getCorporateMode() : undefined;

  const handleCorporateModeChange = (mode: CorporateMode) => {
    // Navigate to the appropriate corporate dashboard
    router.push(`/${sport}/org/corporate/${mode === "intra" ? "intra" : "inter"}`);
  };

  // Detect if we're in the school section and which mode
  const isSchoolSection = pathname.includes("/org/school/");
  const getSchoolMode = (): SchoolMode => {
    if (pathname.includes("/org/school/internal")) return "internal";
    if (pathname.includes("/org/school/inter")) return "external";
    return "internal"; // default
  };
  const schoolMode = isSchoolSection ? getSchoolMode() : undefined;

  const handleSchoolModeChange = (mode: SchoolMode) => {
    // Navigate to the appropriate school dashboard
    // "external" mode uses "inter" path
    router.push(`/${sport}/org/school/${mode === "internal" ? "internal" : "inter"}`);
  };

  const [orgData, setOrgData] = useState<{
    id: string;
    name: string;
    email?: string;
    totalPoints: number;
    rank: number | null;
    totalMembers: number;
    tournamentsHosted: number;
    winRate: number;
    isSubscribed: boolean;
    totalOrganizations: number;
    type?: string;
  } | null>(null);

  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        const response = await fetch("/api/org/me", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setOrgData({
            id: data.id,
            name: data.name,
            email: data.email,
            totalPoints: data.totalPoints || 0,
            rank: data.rank || null,
            totalMembers: data.totalMembers || 0,
            tournamentsHosted: data.tournamentsHosted || 0,
            winRate: data.winRate || 0,
            isSubscribed: data.isSubscribed || false,
            totalOrganizations: data.totalOrganizations || 0,
            type: data.type,
          });
        }
      } catch (error) {
        console.error("Failed to fetch org data:", error);
      }
    };

    fetchOrgData();
  }, []);

  const primaryClass = isCornhole ? "bg-green-600" : "bg-teal-600";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";

  const menuItems: MenuItem[] = [
    // Workspace section (always visible, org-level settings)
    { icon: Building2, label: "Organization Home", href: "/org/home" },
    { icon: CreditCard, label: "Billing & Subscriptions", href: "/org/subscription", hasIndicator: true },
    { icon: UserCheck, label: "Team Access", href: "/org/admins" },
    { icon: Settings, label: "Settings", href: "/org/settings" },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      router.push(`/${sport}`);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const sidebarContentProps: SidebarContentProps = {
    orgData,
    primaryClass,
    primaryTextClass,
    primaryBgClass,
    menuItems,
    pathname,
    sport,
    onLogout: handleLogout,
    isCorporateSection,
    corporateMode,
    onCorporateModeChange: handleCorporateModeChange,
    isSchoolSection,
    schoolMode,
    onSchoolModeChange: handleSchoolModeChange,
  };

  // Mobile: Sheet with trigger button
  if (isMobile) {
    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-[68px] left-3 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border shadow-sm md:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 flex flex-col bg-sidebar">
          <SidebarContent {...sidebarContentProps} onLinkClick={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 bg-sidebar border-r border-sidebar-border flex flex-col z-40 hidden md:flex">
      <SidebarContent {...sidebarContentProps} />
    </aside>
  );
}
