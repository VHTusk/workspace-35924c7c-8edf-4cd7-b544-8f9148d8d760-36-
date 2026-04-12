"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Trophy,
  BarChart3,
  Award,
  PlusCircle,
  Users,
  Building2,
  Gift,
  Menu,
  Heart,
  UserCheck,
  Crown,
  Zap,
  LayoutDashboard,
  Calendar,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFollowCountRefresh } from "@/hooks/use-follow-count";
import { useTranslation } from "@/hooks/use-translation";

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
  age?: number | null;
  gender?: string | null;
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
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
  const loginIdentifier = user?.email || user?.phone || null;
  const compactGender = user?.gender === "MALE"
    ? "M"
    : user?.gender === "FEMALE"
      ? "F"
      : user?.gender === "MIXED"
        ? "X"
        : user?.gender === "OTHER"
          ? "O"
          : null;
  const nameMeta =
    compactGender && user?.age
      ? `(${compactGender}/${user.age})`
      : compactGender
        ? `(${compactGender})`
        : user?.age
          ? `(${user.age})`
          : null;
  const identifierVerified = user?.email
    ? user.emailVerified
    : user?.phone
      ? user.phoneVerified
      : false;
  const profileCompletion =
    userType === "player" && typeof user?.profileCompletion === "number"
      ? Math.max(0, Math.min(100, user.profileCompletion))
      : null;
  const rookieBadgeClass = "bg-amber-300 text-amber-950 border-0 shadow-sm";
  const subscriptionBadgeClass = "bg-cyan-200 text-cyan-950 border-0 shadow-sm";
  const socialPillClass = "rounded-md bg-black/20 px-2 py-1 text-white/95 backdrop-blur-sm";
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
                <p className="font-semibold truncate">
                  {displayName} {nameMeta ? <span className="text-white/75">{nameMeta}</span> : null}
                </p>
                {loginIdentifier && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-white/80">
                    <p className="truncate">{loginIdentifier}</p>
                    {identifierVerified ? (
                      <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-emerald-300" />
                    ) : null}
                  </div>
                )}
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
                  {item.href === `/${sport}/profile` && profileCompletion !== null && profileCompletion < 100 && (
                    <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      {profileCompletion}%
                    </span>
                  )}
                  {item.hasIndicator && (
                    <span
                      className={cn(
                        item.href === `/${sport}/profile` && profileCompletion !== null && profileCompletion < 100
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

    </div>
  );
}

export default function Sidebar({ userType = "player" }: SidebarProps) {
  const { language } = useTranslation();
  const pathname = usePathname();
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  
  // Listen for follow changes to refresh counts
  const followRefreshKey = useFollowCountRefresh();

  const primaryClass = isCornhole
    ? "bg-[linear-gradient(135deg,#0d8f5d_0%,#16c47f_100%)]"
    : "bg-[linear-gradient(135deg,#0f7b92_0%,#18afce_100%)]";
  const primaryTextClass = isCornhole ? "text-[#d6ff3f]" : "text-[#7de8ff]";
  const primaryBgClass = isCornhole
    ? "border border-[rgba(214,255,63,0.16)] bg-[rgba(214,255,63,0.08)]"
    : "border border-[rgba(125,232,255,0.16)] bg-[rgba(125,232,255,0.08)]";
  const common = language === "hi"
    ? {
        dashboard: "डैशबोर्ड",
        tournaments: "टूर्नामेंट",
        leaderboard: "लीडरबोर्ड",
        profile: "प्रोफाइल",
        settings: "सेटिंग्स",
        subscription: "सब्सक्रिप्शन",
        logout: "लॉग आउट",
      }
    : {
        dashboard: "Dashboard",
        tournaments: "Tournaments",
        leaderboard: "Leaderboard",
        profile: "Profile",
        settings: "Settings",
        subscription: "Subscription",
        logout: "Logout",
      };
  const categories = {
    play: language === "hi" ? "खेलें" : "Play",
    performance: language === "hi" ? "प्रदर्शन" : "Performance",
    growth: language === "hi" ? "विकास" : "Growth",
    account: language === "hi" ? "खाता" : "Account",
  };

  // Player menu items grouped by intent
  const playerMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: common.dashboard, href: `/${sport}/dashboard`, category: categories.play },
    { icon: Trophy, label: common.tournaments, href: `/${sport}/tournaments`, category: categories.play },
    { icon: Users, label: language === "hi" ? "टीम्स" : "Teams", href: `/${sport}/teams`, category: categories.play },
    { icon: Zap, label: "Play Duel", href: `/${sport}/dashboard/cities`, category: categories.play },
    { icon: BarChart3, label: language === "hi" ? "मेरे आँकड़े" : "My Stats", href: `/${sport}/stats`, category: categories.performance },
    { icon: Award, label: common.leaderboard, href: `/${sport}/leaderboard`, category: categories.performance },
    { icon: Gift, label: language === "hi" ? "रेफरल्स" : "Referrals", href: `/${sport}/referrals`, category: categories.growth },
  ];

  // Org menu items - cleaned and reordered by importance
  const orgMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: common.dashboard, href: `/${sport}/org/dashboard` },
    { icon: Trophy, label: language === "hi" ? "मेरे टूर्नामेंट" : "My Tournaments", href: `/${sport}/org/requests` },
    { icon: PlusCircle, label: language === "hi" ? "टूर्नामेंट अनुरोध" : "Request Tournament", href: `/${sport}/org/request-tournament` },
    { icon: Users, label: language === "hi" ? "प्रतिभागी" : "Participants", href: `/${sport}/org/participants` },
    { icon: Award, label: common.leaderboard, href: `/${sport}/org/leaderboard` },
    { icon: BarChart3, label: language === "hi" ? "एनालिटिक्स" : "Analytics", href: `/${sport}/org/analytics` },
    { icon: Building2, label: language === "hi" ? "संगठन प्रोफाइल" : "Org Profile", href: `/${sport}/org/profile` },
  ];

  // Admin menu items
  const adminMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: language === "hi" ? "मिशन कंट्रोल" : "Mission Control", href: `/${sport}/admin/mission-control` },
    { icon: Calendar, label: language === "hi" ? "उपलब्धता" : "Availability", href: `/${sport}/admin/availability` },
    { icon: Trophy, label: language === "hi" ? "असाइनमेंट्स" : "Assignments", href: `/${sport}/admin/assignments` },
    { icon: Users, label: language === "hi" ? "मैच" : "Matches", href: `/${sport}/admin/matches` },
    { icon: Award, label: language === "hi" ? "विवाद" : "Disputes", href: `/${sport}/admin/disputes` },
    { icon: BarChart3, label: language === "hi" ? "गतिविधि" : "Activity", href: `/${sport}/admin/activity` },
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
                email: data.email,
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

  const sidebarContentProps = {
    userType,
    menuItems,
    user,
    primaryClass,
    primaryTextClass,
    primaryBgClass,
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
            className="fixed top-[4.4rem] left-3 z-50 h-10 w-10 rounded-xl border border-white/10 bg-[#08141c]/92 text-white shadow-[0_12px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl supports-[backdrop-filter]:bg-[#08141c]/76 md:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="mobile-safe-bottom w-[min(88vw,20rem)] border-white/10 bg-[linear-gradient(180deg,rgba(7,20,28,0.98),rgba(4,10,14,0.98))] p-0 text-white flex flex-col">
          <SidebarContent {...sidebarContentProps} onLinkClick={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <aside className="fixed left-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-72 flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(7,20,28,0.98),rgba(4,10,14,0.98))] text-white shadow-[0_20px_48px_rgba(0,0,0,0.24)]">
      <SidebarContent {...sidebarContentProps} />
    </aside>
  );
}

