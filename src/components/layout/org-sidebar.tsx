"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  Home,
  CreditCard,
  Building2,
  Settings,
  LogOut,
  Menu,
  Users,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

type OrgType = "CORPORATE" | "SCHOOL" | "COLLEGE" | "CLUB" | "ASSOCIATION" | "ACADEMY";

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  hasIndicator?: boolean;
}

interface OrgData {
  id: string;
  name: string;
  type: OrgType;
  totalMembers?: number;
  activeSports?: number;
  isSubscribed?: boolean;
}

// Get org type badge color
const getOrgTypeBadge = (type: OrgType) => {
  const colors: Record<OrgType, string> = {
    CORPORATE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    SCHOOL: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    COLLEGE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    CLUB: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    ASSOCIATION: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    ACADEMY: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  };
  return colors[type] || colors.CLUB;
};

// Organization-level navigation items
const ORG_MENU_ITEMS: MenuItem[] = [
  { icon: Home, label: "Organization Home", href: "/org/home" },
  { icon: CreditCard, label: "Billing & Subscriptions", href: "/org/subscription", hasIndicator: true },
  { icon: Building2, label: "Profile", href: "/org/profile" },
  { icon: Settings, label: "Settings", href: "/org/settings" },
];

function OrgSidebarContent({
  org,
  onLogout,
  onLinkClick,
  pathname,
}: {
  org: OrgData | null;
  onLogout: () => void;
  onLinkClick?: () => void;
  pathname: string;
}) {
  const orgType = org?.type || "CORPORATE";
  const displayName = org?.name || "Organization";

  return (
    <div className="flex flex-col h-full">
      {/* Org Card */}
      <div className="p-4 pt-5">
        <div className="rounded-xl p-4 text-white relative overflow-hidden bg-purple-600">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-12 w-12 border-2 border-white/30">
                <AvatarFallback className="text-white font-bold bg-purple-600">
                  <Building2 className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{displayName}</p>
                <Badge className={cn("text-[10px] px-1.5 py-0", getOrgTypeBadge(orgType))}>
                  {orgType}
                </Badge>
              </div>
            </div>

            {/* Org-specific metrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/20 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Home className="w-4 h-4" />
                  <span className="text-xs text-white/80">Sports</span>
                </div>
                <p className="text-xl font-bold">{org?.activeSports || 0}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs text-white/80">Members</span>
                </div>
                <p className="text-xl font-bold">{org?.totalMembers || 0}</p>
              </div>
            </div>
            
            {/* Subscription Status */}
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                org?.isSubscribed 
                  ? "bg-green-500/30 text-white" 
                  : "bg-amber-500/30 text-white"
              )}>
                {org?.isSubscribed ? (
                  <>
                    <Check className="w-3 h-3" />
                    Active
                  </>
                ) : (
                  "Not Subscribed"
                )}
              </span>
              <Link
                href="/org/subscription"
                onClick={onLinkClick}
                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-md transition-colors"
              >
                Manage
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Workspace
        </p>
        <ul className="space-y-1">
          {ORG_MENU_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onLinkClick}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-purple-600" : "text-muted-foreground")} />
                  <span className="flex-1">{item.label}</span>
                  {item.hasIndicator && (
                    <span
                      className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        org?.isSubscribed ? "bg-green-500 animate-pulse" : "bg-amber-400"
                      )}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
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

export default function OrgSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [org, setOrg] = useState<OrgData | null>(null);

  // Fetch org data
  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        const response = await fetch("/api/org/me", { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          setOrg({
            id: data.id,
            name: data.name || "Organization",
            type: data.type || "CORPORATE",
            totalMembers: data.totalMembers || 0,
            activeSports: data.activeSports || 0,
            isSubscribed: data.isSubscribed || false,
          });
        }
      } catch (error) {
        console.error("Failed to fetch org data:", error);
      }
    };

    fetchOrgData();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
    router.push("/");
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
          <OrgSidebarContent
            org={org}
            onLogout={handleLogout}
            onLinkClick={() => setSheetOpen(false)}
            pathname={pathname}
          />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 bg-sidebar border-r border-sidebar-border flex flex-col z-40 hidden md:flex">
      <OrgSidebarContent
        org={org}
        onLogout={handleLogout}
        pathname={pathname}
      />
    </aside>
  );
}
