"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Trophy,
  BarChart3,
  Users,
  Settings,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Building2,
  LogOut,
  Briefcase,
  Image as ImageIcon,
  Activity,
  UserPlus,
  PieChart,
  Map,
  CalendarCheck,
  Copy,
  Calendar,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

interface SidebarContentProps {
  adminData: { name: string; email: string } | null;
  primaryClass: string;
  primaryTextClass: string;
  primaryBgClass: string;
  menuItems: MenuItem[];
  governanceItems: MenuItem[];
  settingsItems: MenuItem[];
  pathname: string;
  onLogout: () => void;
  onLinkClick?: () => void;
}

function SidebarContent({
  adminData,
  primaryClass,
  primaryTextClass,
  primaryBgClass,
  menuItems,
  governanceItems,
  settingsItems,
  pathname,
  onLogout,
  onLinkClick,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Admin Card */}
      <div className="p-4 pt-5">
        <div className={cn("rounded-xl p-4 text-white relative overflow-hidden", primaryClass)}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-12 w-12 border-2 border-white/30">
                <AvatarFallback className={cn("text-white font-bold", primaryClass)}>
                  <ShieldCheck className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{adminData?.name || "Admin"}</p>
                <p className="text-xs text-white/70 truncate">{adminData?.email || "admin@valorhive.com"}</p>
              </div>
            </div>

            <div className="bg-white/20 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs text-white/80">Role</span>
              </div>
              <p className="text-lg font-bold">Administrator</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
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
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Governance Section */}
        <div className="mt-4 pt-4 border-t border-border">
          <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Governance
          </p>
          <ul className="space-y-1">
            {governanceItems.map((item) => {
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
        </div>

        {/* Settings Section */}
        <div className="mt-4 pt-4 border-t border-border">
          <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Settings
          </p>
          <ul className="space-y-1">
            {settingsItems.map((item) => {
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
        </div>
      </nav>

      {/* Bottom Section with Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
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

export default function SidebarAdmin() {
  const pathname = usePathname();
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const [adminData, setAdminData] = useState<{
    name: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const response = await fetch("/api/admin/me", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setAdminData({
            name: data.name || "Admin",
            email: data.email || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch admin data:", error);
      }
    };

    fetchAdminData();
  }, []);

  const primaryClass = isCornhole ? "bg-green-600" : "bg-teal-600";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";

  const menuItems: MenuItem[] = [
    { icon: Trophy, label: "Tournaments", href: `/${sport}/admin/tournaments` },
    { icon: BarChart3, label: "Matches", href: `/${sport}/admin/matches` },
    { icon: AlertTriangle, label: "Disputes", href: `/${sport}/admin/disputes` },
    { icon: ShieldCheck, label: "Badges", href: `/${sport}/admin/badges` },
    { icon: Users, label: "Players", href: `/${sport}/admin/players` },
    { icon: Building2, label: "Organizations", href: `/${sport}/admin/organizations` },
    { icon: Briefcase, label: "Contracts", href: `/${sport}/admin/contracts` },
    { icon: FileText, label: "Verifications", href: `/${sport}/admin/verifications` },
    { icon: ImageIcon, label: "Media", href: `/${sport}/admin/media` },
  ];

  const settingsItems: MenuItem[] = [
    { icon: Copy, label: "Templates", href: `/${sport}/admin/templates` },
    { icon: Calendar, label: "Series", href: `/${sport}/admin/series` },
    { icon: Settings, label: "Settings", href: `/${sport}/admin/settings` },
  ];

  const governanceItems: MenuItem[] = [
    { icon: Activity, label: "Mission Control", href: `/${sport}/admin/mission-control` },
    { icon: PieChart, label: "Governance", href: `/${sport}/admin/governance` },
    { icon: Map, label: "Region Load", href: `/${sport}/admin/region-load` },
    { icon: UserPlus, label: "Assignments", href: `/${sport}/admin/assignments` },
    { icon: CalendarCheck, label: "Availability", href: `/${sport}/admin/availability` },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      window.location.href = `/${sport}/admin/login`;
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const sidebarContentProps: SidebarContentProps = {
    adminData,
    primaryClass,
    primaryTextClass,
    primaryBgClass,
    menuItems,
    governanceItems,
    settingsItems,
    pathname,
    onLogout: handleLogout,
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
