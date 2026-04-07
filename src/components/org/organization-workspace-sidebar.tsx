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
  Settings,
  Menu,
  Shield,
  LayoutDashboard,
  UserCheck,
  Home,
  Crown,
  UserPlus,
  PlusCircle,
  Medal,
  Target,
  Calendar,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CorporateMode } from "@/components/corporate/corporate-mode-toggle";

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  hasIndicator?: boolean;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
  email?: string;
  city?: string;
  state?: string;
  totalMembers?: number;
  activeSports?: number;
  activeSquads?: number;
  subscriptionStatus?: string;
  isSubscribed?: boolean;
}

// ============================================
// SIDEBAR CONTENT COMPONENT
// ============================================

interface SidebarContentProps {
  orgData: OrgData | null;
  primaryClass: string;
  primaryTextClass: string;
  primaryBgClass: string;
  pathname: string;
  sport: string;
  onLogout: () => void;
  onLinkClick?: () => void;
  corporateMode?: CorporateMode;
  isCorporate: boolean;
}

function OrganizationWorkspaceSidebarContent({
  orgData,
  primaryClass,
  primaryTextClass,
  primaryBgClass,
  pathname,
  sport,
  onLogout,
  onLinkClick,
  corporateMode,
  isCorporate,
}: SidebarContentProps) {
  // Get org type styling
  const getOrgTypeStyle = (type: string) => {
    switch (type) {
      case "CORPORATE":
        return { color: "bg-purple-600", label: "Corporate" };
      case "SCHOOL":
        return { color: "bg-blue-600", label: "School" };
      case "COLLEGE":
        return { color: "bg-indigo-600", label: "College" };
      case "CLUB":
        return { color: "bg-emerald-600", label: "Club" };
      default:
        return { color: primaryClass, label: type };
    }
  };

  const orgTypeStyle = orgData?.type ? getOrgTypeStyle(orgData.type) : { color: primaryClass, label: "Organization" };

  // ============================================
  // WORKSPACE SECTION (Static org-level pages)
  // ============================================
  const workspaceItems: MenuItem[] = [
    { icon: Home, label: "Organization Home", href: `/${sport}/org/home` },
    { icon: CreditCard, label: "Billing & Sports", href: `/${sport}/org/subscription`, hasIndicator: true },
    { icon: UserCheck, label: "Team Access", href: `/${sport}/org/admins` },
    { icon: Building2, label: "Organization Profile", href: `/${sport}/org/profile` },
    { icon: Settings, label: "Settings", href: `/${sport}/org/settings` },
  ];

  // ============================================
  // INTRA CORPORATE MODE ITEMS
  // ============================================
  const intraCorporateItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: `/${sport}/org/corporate/intra` },
    { icon: Users, label: "Employees", href: `/${sport}/org/corporate/intra/employees` },
    { icon: Trophy, label: "Intra Tournaments", href: `/${sport}/org/corporate/intra/tournaments` },
    { icon: Award, label: "Intra Leaderboard", href: `/${sport}/org/corporate/intra/leaderboard` },
    { icon: BarChart3, label: "Intra Analytics", href: `/${sport}/org/corporate/intra/analytics` },
  ];

  // ============================================
  // INTER CORPORATE MODE ITEMS
  // ============================================
  const interCorporateItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: `/${sport}/org/corporate/inter` },
    { icon: Shield, label: "Rep Squads", href: `/${sport}/org/corporate/inter/squads` },
    { icon: Users, label: "Players", href: `/${sport}/org/corporate/inter/players` },
    { icon: Trophy, label: "Inter Tournaments", href: `/${sport}/org/corporate/inter/tournaments` },
    { icon: Medal, label: "Results", href: `/${sport}/org/corporate/inter/results` },
    { icon: BarChart3, label: "Inter Analytics", href: `/${sport}/org/corporate/inter/analytics` },
  ];

  // ============================================
  // QUICK ACTIONS (Mode-specific)
  // ============================================
  const intraQuickActions = [
    { icon: UserPlus, label: "Add Employee", href: `/${sport}/org/corporate/intra/employees?action=add` },
    { icon: PlusCircle, label: "Create Intra Tournament", href: `/${sport}/org/corporate/intra/tournaments?action=create` },
  ];

  const interQuickActions = [
    { icon: Shield, label: "Create Squad", href: `/${sport}/org/corporate/inter/squads?action=create` },
    { icon: Calendar, label: "Register Tournament", href: `/${sport}/org/corporate/inter/tournaments?action=register` },
  ];

  // Get current mode items
  const currentModeItems = corporateMode === "intra" 
    ? intraCorporateItems 
    : corporateMode === "inter" 
      ? interCorporateItems 
      : [];

  const quickActions = corporateMode === "intra" 
    ? intraQuickActions 
    : corporateMode === "inter" 
      ? interQuickActions 
      : [];

  const renderMenuItem = (item: MenuItem) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
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
              orgData?.isSubscribed ? "bg-green-500 animate-pulse" : "bg-amber-400"
            )}
          />
        )}
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Org Summary Card */}
      <div className="p-4 pt-5">
        <div className={cn("rounded-xl p-4 text-white relative overflow-hidden", orgTypeStyle.color)}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-12 w-12 border-2 border-white/30">
                <AvatarFallback className={cn("text-white font-bold", orgTypeStyle.color)}>
                  <Building2 className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{orgData?.name || "Organization"}</p>
                <p className="text-xs text-white/70">{orgTypeStyle.label}</p>
              </div>
            </div>

            {/* Org-level indicators */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/20 rounded-lg p-2 text-center">
                <p className="text-xl font-bold">{orgData?.activeSports || 1}</p>
                <p className="text-xs text-white/80">Active Sports</p>
              </div>
              <div className="bg-white/20 rounded-lg p-2 text-center">
                <p className="text-xl font-bold">{orgData?.totalMembers || 0}</p>
                <p className="text-xs text-white/80">Members</p>
              </div>
            </div>

            {/* Subscription status */}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-white/80 flex items-center gap-1">
                {orgData?.isSubscribed ? (
                  <>
                    <Crown className="w-3 h-3" />
                    Subscribed
                  </>
                ) : (
                  "Free Plan"
                )}
              </span>
              {orgData?.activeSquads && orgData.activeSquads > 0 && (
                <span className="text-xs text-white/80 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {orgData.activeSquads} Squads
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {/* ============================================
            WORKSPACE SECTION (Always visible)
        ============================================ */}
        <div className="mb-4">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">
            Workspace
          </span>
          <ul className="mt-2 space-y-1">
            {workspaceItems.map((item) => (
              <li key={item.href}>{renderMenuItem(item)}</li>
            ))}
          </ul>
        </div>

        {/* ============================================
            CURRENT MODE SECTION (Dynamic)
        ============================================ */}
        {isCorporate && corporateMode && currentModeItems.length > 0 && (
          <>
            <div className="border-t border-sidebar-border my-3" />
            <div className="mb-4">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 flex items-center gap-2">
                {corporateMode === "intra" ? (
                  <>
                    <Building2 className="w-3 h-3" />
                    Intra Corporate
                  </>
                ) : (
                  <>
                    <Shield className="w-3 h-3" />
                    Inter Corporate
                  </>
                )}
              </span>
              <ul className="mt-2 space-y-1">
                {currentModeItems.map((item) => (
                  <li key={item.href}>{renderMenuItem(item)}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* ============================================
            QUICK ACTIONS SECTION
        ============================================ */}
        {isCorporate && corporateMode && quickActions.length > 0 && (
          <>
            <div className="border-t border-sidebar-border my-3" />
            <div className="mb-4">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">
                Quick Actions
              </span>
              <ul className="mt-2 space-y-1">
                {quickActions.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onLinkClick}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-all"
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
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

// ============================================
// MAIN SIDEBAR COMPONENT
// ============================================

export default function OrganizationWorkspaceSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [orgData, setOrgData] = useState<OrgData | null>(null);

  // Detect if we're in corporate section and which mode
  const isCorporate = pathname.includes("/org/corporate/");
  const getCorporateMode = (): CorporateMode | undefined => {
    if (pathname.includes("/org/corporate/intra")) return "intra";
    if (pathname.includes("/org/corporate/inter")) return "inter";
    return undefined;
  };
  const corporateMode = getCorporateMode();

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
            type: data.type,
            email: data.email,
            city: data.city,
            state: data.state,
            totalMembers: data.totalMembers || 0,
            activeSports: data.activeSports || 1,
            activeSquads: data.activeSquads || 0,
            subscriptionStatus: data.subscriptionStatus,
            isSubscribed: data.isSubscribed || false,
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

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      window.location.href = `/${sport}`;
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const sidebarContentProps: SidebarContentProps = {
    orgData,
    primaryClass,
    primaryTextClass,
    primaryBgClass,
    pathname,
    sport,
    onLogout: handleLogout,
    corporateMode,
    isCorporate,
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
          <OrganizationWorkspaceSidebarContent {...sidebarContentProps} onLinkClick={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 bg-sidebar border-r border-sidebar-border flex flex-col z-40 hidden md:flex">
      <OrganizationWorkspaceSidebarContent {...sidebarContentProps} />
    </aside>
  );
}
