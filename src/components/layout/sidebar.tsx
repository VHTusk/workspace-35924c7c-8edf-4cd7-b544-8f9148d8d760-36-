"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Trophy,
  BarChart3,
  Award,
  User,
  Settings,
  FileText,
  PlusCircle,
  Users,
  Building2,
  LogOut,
  CreditCard,
  Gift,
  Menu,
  Heart,
  UserCheck,
  Crown,
  Zap,
  LayoutDashboard,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFollowCountRefresh } from "@/hooks/use-follow-count";

interface SidebarProps {
  userType?: "player" | "org" | "admin";
}

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  category?: string;
  hasIndicator?: boolean;
}

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  photoUrl: string | null;
  score: number;
  wins: number;
  followersCount: number;
  followingCount: number;
  profileCompletion?: number;
  isSubscribed?: boolean;
  subscriptionPlan?: string | null;
}

// Sidebar content component
interface SidebarContentProps {
  userType: "player" | "org" | "admin";
  menuItems: MenuItem[];
  user: UserData | null;
  primaryClass: string;
  primaryTextClass: string;
  primaryBgClass: string;
  onLogout: () => void;
  onLinkClick?: () => void;
  sport: string;
  isCornhole: boolean;
  pathname: string;
}

function SidebarContent({
  userType,
  menuItems,
  user,
  primaryClass,
  primaryTextClass,
  primaryBgClass,
  onLogout,
  onLinkClick,
  sport,
  pathname,
}: SidebarContentProps) {
  const displayName = user?.name || user?.firstName || (userType === "player" ? "Player" : userType === "admin" ? "Admin" : "Organization");
  const initials = user 
    ? `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`
    : userType === "player" ? "P" : userType === "admin" ? "A" : "O";
  const isSubscribed = user?.isSubscribed || false;
  const subscriptionPlan = user?.subscriptionPlan || null;
  const profileCompletion =
    userType === "player" && typeof user?.profileCompletion === "number"
      ? Math.max(0, Math.min(100, user.profileCompletion))
      : null;
  const rookieBadgeClass = "bg-amber-300 text-amber-950 border-0 shadow-sm";
  const subscriptionBadgeClass = "bg-cyan-200 text-cyan-950 border-0 shadow-sm";
  const socialPillClass = "rounded-md bg-black/20 px-2 py-1 text-white/95 backdrop-blur-sm";
  const upgradeLinkClass = "rounded-md bg-white text-slate-900 hover:bg-slate-100 px-3 py-1 font-semibold shadow-sm transition-colors";
  const manageLinkClass = "rounded-md bg-cyan-200 text-cyan-950 hover:bg-cyan-100 px-3 py-1 font-semibold shadow-sm transition-colors";

  return (
    <div className="flex flex-col h-full">
      {/* User Card */}
      <div className="p-4 pt-5">
        <div className={cn("rounded-xl p-4 text-white relative overflow-hidden", primaryClass)}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-12 w-12 border-2 border-white/30">
                <AvatarImage src={user?.photoUrl || undefined} />
                <AvatarFallback className={cn("text-white font-bold", primaryClass)}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{displayName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {isSubscribed ? (
                    <Badge className={cn("text-[10px] px-2 py-0.5", subscriptionBadgeClass)}>
                      <Crown className="w-3 h-3 mr-1" />
                      {subscriptionPlan}
                    </Badge>
                  ) : (
                    <Badge className={cn("text-[10px] px-2 py-0.5", rookieBadgeClass)}>
                      Rookie
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {userType === "player" && (
              <div className="flex items-center justify-between text-sm mt-2">
                <div className="flex items-center gap-3">
                  <div className={cn("flex items-center gap-1.5", socialPillClass)}>
                    <Heart className="w-4 h-4 text-rose-200" />
                    <span className="font-medium">{user?.followersCount || 0}</span>
                  </div>
                  <div className={cn("flex items-center gap-1.5", socialPillClass)}>
                    <UserCheck className="w-4 h-4 text-cyan-200" />
                    <span className="font-medium">{user?.followingCount || 0}</span>
                  </div>
                </div>
                <Link
                  href={`/${sport}/subscription`}
                  onClick={onLinkClick}
                  className={cn(
                    "text-xs",
                    isSubscribed ? manageLinkClass : upgradeLinkClass,
                  )}
                >
                  {isSubscribed ? 'Manage' : 'Upgrade'}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {/* Back to Org Dashboard for org users in sport workspace */}
        {userType === "org" && (
          <Link
            href="/org/home"
            onClick={onLinkClick}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all mb-2"
          >
            <LayoutDashboard className="w-5 h-5" />
            Back to Dashboard
          </Link>
        )}
        <ul className="space-y-1">
          {menuItems.map((item, index) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const showCategory = item.category && (index === 0 || menuItems[index - 1]?.category !== item.category);
            
            return (
              <li key={item.href}>
                {showCategory && (
                  <div className="px-3 py-2 mt-2 mb-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {item.category}
                    </span>
                  </div>
                )}
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
                  {item.label === "My Profile" && profileCompletion !== null && profileCompletion < 100 && (
                    <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      {profileCompletion}%
                    </span>
                  )}
                  {item.hasIndicator && (
                    <span
                      className={cn(
                        item.label === "My Profile" && profileCompletion !== null && profileCompletion < 100
                          ? "ml-2"
                          : "ml-auto",
                        "w-2.5 h-2.5 rounded-full",
                        isSubscribed ? "bg-green-500 animate-pulse" : "bg-amber-400"
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

export default function Sidebar({ userType = "player" }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  
  // Listen for follow changes to refresh counts
  const followRefreshKey = useFollowCountRefresh();

  const primaryClass = isCornhole ? "bg-green-600" : "bg-teal-600";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";

  // Player menu items - cleaned and reordered by importance
  const playerMenuItems: MenuItem[] = [
    { icon: Trophy, label: "My Tournaments", href: `/${sport}/my-tournaments` },
    { icon: Users, label: "My Teams", href: `/${sport}/teams` },
    { icon: BarChart3, label: "My Stats", href: `/${sport}/stats` },
    { icon: Award, label: "Leaderboard", href: `/${sport}/leaderboard` },
    { icon: Zap, label: "Challenger Mode", href: `/${sport}/dashboard/cities` },
    { icon: User, label: "My Profile", href: `/${sport}/profile` },
    { icon: CreditCard, label: "Subscription", href: `/${sport}/subscription`, hasIndicator: true },
    { icon: Gift, label: "Referrals", href: `/${sport}/referrals` },
    { icon: Settings, label: "Settings", href: `/${sport}/settings` },
  ];

  // Org menu items - cleaned and reordered by importance
  const orgMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: `/${sport}/org/dashboard` },
    { icon: Trophy, label: "My Tournaments", href: `/${sport}/org/requests` },
    { icon: PlusCircle, label: "Request Tournament", href: `/${sport}/org/request-tournament` },
    { icon: Users, label: "Participants", href: `/${sport}/org/participants` },
    { icon: Award, label: "Leaderboard", href: `/${sport}/org/leaderboard` },
    { icon: BarChart3, label: "Analytics", href: `/${sport}/org/analytics` },
    { icon: Building2, label: "Org Profile", href: `/${sport}/org/profile` },
    { icon: CreditCard, label: "Subscription", href: `/${sport}/org/subscription`, hasIndicator: true },
    { icon: Settings, label: "Settings", href: `/${sport}/org/settings` },
  ];

  // Admin menu items
  const adminMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Mission Control", href: `/${sport}/admin/mission-control` },
    { icon: Calendar, label: "Availability", href: `/${sport}/admin/availability` },
    { icon: Trophy, label: "Assignments", href: `/${sport}/admin/assignments` },
    { icon: Users, label: "Matches", href: `/${sport}/admin/matches` },
    { icon: Award, label: "Disputes", href: `/${sport}/admin/disputes` },
    { icon: BarChart3, label: "Activity", href: `/${sport}/admin/activity` },
    { icon: Settings, label: "Settings", href: `/${sport}/admin/settings` },
  ];

  const menuItems = userType === "player" ? playerMenuItems : userType === "admin" ? adminMenuItems : orgMenuItems;

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (userType === "player") {
          const sportUpper = sport.toUpperCase();
          const response = await fetch(`/api/player/me?sport=${sportUpper}`);
          if (response.ok) {
            const data = await response.json();
            setUser(data);
          }
        } else {
          const response = await fetch("/api/org/me", { credentials: "include" });
          if (response.ok) {
            const data = await response.json();
            setUser({
              id: data.id,
              firstName: data.name?.split(' ')[0] || '',
              lastName: data.name?.split(' ').slice(1).join(' ') || '',
              name: data.name,
              photoUrl: null,
              score: data.totalPoints || 0,
              wins: 0,
              followersCount: 0,
              followingCount: 0,
              isSubscribed: data.isSubscribed || false,
              subscriptionPlan: data.isSubscribed ? "Pro" : null,
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      }
    };

    fetchUserData();
  }, [userType, followRefreshKey, sport]); // Re-fetch when follow status changes

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
    router.push(`/${sport}`);
  };

  const sidebarContentProps = {
    userType,
    menuItems,
    user,
    primaryClass,
    primaryTextClass,
    primaryBgClass,
    onLogout: handleLogout,
    sport,
    isCornhole,
    pathname,
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
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 bg-sidebar border-r border-sidebar-border flex flex-col z-40">
      <SidebarContent {...sidebarContentProps} />
    </aside>
  );
}
