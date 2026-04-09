"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LogIn,
  UserPlus,
  Loader2,
  ChevronDown,
  LayoutDashboard,
  User,
  Settings,
  Crown,
  LogOut,
  Building2,
} from "lucide-react";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { GlobalSearch, SearchButton } from "@/components/search/global-search";
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/hooks/use-translation";
import LanguageSelector from "@/components/ui/language-selector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserData {
  id: string;
  playerId?: string;
  firstName: string;
  lastName: string;
  name: string;
  email?: string;
  phone?: string;
  photoUrl: string | null;
  score: number;
  wins: number;
  followersCount: number;
  followingCount: number;
  isSubscribed?: boolean;
  subscriptionPlan?: string | null;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
  email?: string;
  photoUrl?: string;
  totalPoints?: number;
  rank?: number | null;
  isSubscribed?: boolean;
  subscriptionPlan?: string | null;
}

interface SportHeaderProps {
  sport: string;
  sportName: string;
  primaryBtnClass: string;
  sportBadgeClass: string;
}

export default function SportHeader({
  sport,
  sportName,
  primaryBtnClass,
  sportBadgeClass,
}: SportHeaderProps) {
  const { language } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [userType, setUserType] = useState<"player" | "org" | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const copy = language === "hi"
    ? {
        dashboard: "डैशबोर्ड",
        profile: "मेरी प्रोफाइल",
        orgProfile: "संगठन प्रोफाइल",
        settings: "सेटिंग्स",
        subscription: "सब्सक्रिप्शन",
        logout: "लॉग आउट",
        login: "लॉग इन",
        register: "रजिस्टर",
      }
    : {
        dashboard: "Dashboard",
        profile: "My Profile",
        orgProfile: "Org Profile",
        settings: "Settings",
        subscription: "Subscription",
        logout: "Logout",
        login: "Login",
        register: "Register",
      };

  // Check if we're on org pages
  const isOrgPage = pathname?.includes("/org/");

  const checkAuth = useCallback(async () => {
    try {
      const sportUpper = sport.toUpperCase();
      
      // If on org pages, check org auth first
      if (isOrgPage) {
        const orgResponse = await fetch(`/api/auth/check-org`, {
          credentials: "include",
        });
        
        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          if (orgData.authenticated) {
            setAuthenticated(true);
            setUserType("org");
            
            // Fetch org details
            const orgDetailsRes = await fetch("/api/org/me", {
              credentials: "include",
            });
            if (orgDetailsRes.ok) {
              const orgDetails = await orgDetailsRes.json();
              setOrg({
                id: orgDetails.id,
                name: orgDetails.name,
                type: orgDetails.type,
                email: orgDetails.email,
                totalPoints: orgDetails.totalPoints,
                rank: orgDetails.rank,
                isSubscribed: orgDetails.isSubscribed,
              });
            }
            setLoading(false);
            return;
          }
        }
      }
      
      // Check player auth
      const response = await fetch(`/api/auth/check?sport=${sportUpper}`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setAuthenticated(data.authenticated === true);
        
        if (data.authenticated) {
          setUserType("player");
          const userRes = await fetch(`/api/player/me?sport=${sportUpper}`, {
            credentials: "include",
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            setUser(userData);
          }
        } else {
          // If player auth failed, try org auth as fallback
          const orgResponse = await fetch(`/api/auth/check-org`, {
            credentials: "include",
          });
          
          if (orgResponse.ok) {
            const orgData = await orgResponse.json();
            if (orgData.authenticated) {
              setAuthenticated(true);
              setUserType("org");
              
              const orgDetailsRes = await fetch("/api/org/me", {
                credentials: "include",
              });
              if (orgDetailsRes.ok) {
                const orgDetails = await orgDetailsRes.json();
                setOrg({
                  id: orgDetails.id,
                  name: orgDetails.name,
                  type: orgDetails.type,
                  email: orgDetails.email,
                  totalPoints: orgDetails.totalPoints,
                  rank: orgDetails.rank,
                  isSubscribed: orgDetails.isSubscribed,
                });
              }
            } else {
              setUser(null);
              setOrg(null);
              setUserType(null);
            }
          } else {
            setUser(null);
            setOrg(null);
            setUserType(null);
          }
        }
      } else {
        // Try org auth as fallback
        const orgResponse = await fetch(`/api/auth/check-org`, {
          credentials: "include",
        });
        
        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          if (orgData.authenticated) {
            setAuthenticated(true);
            setUserType("org");
            
            const orgDetailsRes = await fetch("/api/org/me", {
              credentials: "include",
            });
            if (orgDetailsRes.ok) {
              const orgDetails = await orgDetailsRes.json();
              setOrg({
                id: orgDetails.id,
                name: orgDetails.name,
                type: orgDetails.type,
                email: orgDetails.email,
                totalPoints: orgDetails.totalPoints,
                rank: orgDetails.rank,
                isSubscribed: orgDetails.isSubscribed,
              });
            }
          } else {
            setAuthenticated(false);
            setUser(null);
            setOrg(null);
            setUserType(null);
          }
        } else {
          setAuthenticated(false);
          setUser(null);
          setOrg(null);
          setUserType(null);
        }
      }
    } catch (error) {
      setAuthenticated(false);
      setUser(null);
      setOrg(null);
      setUserType(null);
    } finally {
      setLoading(false);
    }
  }, [sport, isOrgPage]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Re-check auth when navigating away from auth pages
  useEffect(() => {
    const isAuthPage = pathname?.includes('/login') || pathname?.includes('/register');

    if (!isAuthPage) {
      checkAuth();
    }
  }, [pathname, checkAuth]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      // ignore
    }
    setAuthenticated(false);
    setUser(null);
    setOrg(null);
    setUserType(null);
    router.push(`/${sport}`);
  };

  // Get display name and initials based on user type
  const getDisplayName = () => {
    if (userType === "org" && org) {
      return org.name;
    }
    if (userType === "player" && user) {
      return user.name || user.firstName || "Player";
    }
    return "User";
  };

  const getInitials = () => {
    if (userType === "org" && org) {
      return org.name?.substring(0, 2).toUpperCase() || "OR";
    }
    if (userType === "player" && user) {
      return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`;
    }
    return "P";
  };

  const getSubscriptionStatus = () => {
    if (userType === "org" && org) {
      return org.isSubscribed ? org.subscriptionPlan || "Pro" : "Free";
    }
    if (userType === "player" && user) {
      return user.isSubscribed ? user.subscriptionPlan : "Rookie";
    }
    return "Free";
  };

  const getLoginIdentifier = () => {
    if (userType === "org" && org) {
      return org.email || "";
    }
    if (userType === "player" && user) {
      return user.email || user.phone || "";
    }
    return "";
  };

  // Check if on login or register page
  const isAuthPage = pathname?.includes('/login') || pathname?.includes('/register');

  // Get profile URL based on user type
  const getProfileUrl = () => {
    if (userType === "org") {
      return `/${sport}/org/profile`;
    }
    return `/${sport}/profile`;
  };

  // Render auth buttons
  const renderAuthButtons = () => {
    if (loading || authenticated === null) {
      return (
        <Button variant="ghost" size="sm" disabled>
          <Loader2 className="w-4 h-4 animate-spin" />
        </Button>
      );
    }

    if (authenticated === true) {
      // Show notification bell + user dropdown when logged in
      return (
        <div className="flex items-center gap-2">
          {userType === "player" && (
            <Link href={`/${sport}/dashboard`}>
              <Button variant="outline" size="sm" className="gap-2 px-2.5 sm:px-3">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden md:inline">{copy.dashboard}</span>
              </Button>
            </Link>
          )}

          {/* Notification Bell */}
          {userType === "player" && <NotificationDropdown sport={sport} />}

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-1.5 pl-1.5 pr-2 sm:gap-2 sm:pl-2 sm:pr-3">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.photoUrl || org?.photoUrl || undefined} />
                  <AvatarFallback className={cn("text-white text-xs", primaryBtnClass)}>
                    {userType === "org" ? <Building2 className="w-4 h-4" /> : getInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:inline text-sm font-medium">{getDisplayName()}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{getDisplayName()}</span>
                  {getLoginIdentifier() && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {getLoginIdentifier()}
                    </span>
                  )}
                  <span className="text-xs font-normal text-muted-foreground">
                    {getSubscriptionStatus()}
                    {userType === "org" && org?.type && (
                      <span className="ml-1">• {org.type.toLowerCase()}</span>
                    )}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={getProfileUrl()} className="cursor-pointer">
                  {userType === "org" ? (
                    <Building2 className="mr-2 h-4 w-4" />
                  ) : (
                    <User className="mr-2 h-4 w-4" />
                  )}
                  {userType === "org" ? copy.orgProfile : copy.profile}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${sport}/settings`} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  {copy.settings}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${sport}/${userType === "org" ? "org/" : ""}subscription`} className="cursor-pointer">
                  <Crown className="mr-2 h-4 w-4" />
                  {copy.subscription}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {copy.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    // Show Login/Register when not logged in (hide if already on auth pages)
    if (isAuthPage) {
      return null;
    }

    // On org pages, show org login/register
    if (isOrgPage) {
      return (
        <>
          <Link href={`/${sport}/org/login`}>
            <Button variant="ghost" size="sm" className="px-2 text-muted-foreground sm:px-3">
              <LogIn className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{copy.login}</span>
            </Button>
          </Link>
          <Link href={`/${sport}/org/register`}>
            <Button size="sm" className={cn("px-2.5 shadow-sm sm:px-3", primaryBtnClass)}>
              <Building2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{copy.register} Org</span>
              <span className="sm:hidden">Org</span>
            </Button>
          </Link>
        </>
      );
    }

    return (
      <>
        <Link href={`/${sport}/login`}>
            <Button variant="ghost" size="sm" className="px-2 text-muted-foreground sm:px-3">
              <LogIn className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{copy.login}</span>
            </Button>
          </Link>
        <Link href={`/${sport}/register`}>
          <Button size="sm" className={cn("px-2.5 shadow-sm sm:px-3", primaryBtnClass)}>
            <UserPlus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{copy.register}</span>
            <span className="sm:hidden">Join</span>
          </Button>
        </Link>
      </>
    );
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-3">
            <Link href={`/${sport}`} className="flex items-center gap-2 min-w-0 max-w-[55%] sm:max-w-none">
              <Image src="/logo.png" alt="VALORHIVE" width={32} height={32} className="h-8 w-auto" priority />
              <span className="hidden truncate text-lg font-bold text-foreground min-[380px]:inline">VALORHIVE</span>
              <Badge variant="outline" className={cn("hidden border-current/30 sm:inline-flex", sportBadgeClass)}>
                {sportName}
              </Badge>
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <LanguageSelector variant="icon" className="sm:hidden" />
              <LanguageSelector variant="compact" className="hidden sm:inline-flex" />
              <SearchButton onClick={() => setSearchOpen(true)} />
              {renderAuthButtons()}
            </div>
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearch sport={sport} isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
