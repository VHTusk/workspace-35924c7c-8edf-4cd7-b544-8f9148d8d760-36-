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
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [userType, setUserType] = useState<"player" | "org" | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

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
              <Button variant="outline" size="sm" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
          )}

          {/* Notification Bell */}
          {userType === "player" && <NotificationDropdown sport={sport} />}

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 pl-2 pr-3">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.photoUrl || org?.photoUrl || undefined} />
                  <AvatarFallback className={cn("text-white text-xs", primaryBtnClass)}>
                    {userType === "org" ? <Building2 className="w-4 h-4" /> : getInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium">{getDisplayName()}</span>
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
                  {userType === "org" ? "Org Profile" : "My Profile"}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${sport}/settings`} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${sport}/${userType === "org" ? "org/" : ""}subscription`} className="cursor-pointer">
                  <Crown className="mr-2 h-4 w-4" />
                  Subscription
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
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
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <LogIn className="w-4 h-4 mr-2" />
              Login
            </Button>
          </Link>
          <Link href={`/${sport}/org/register`}>
            <Button size="sm" className={cn("shadow-sm", primaryBtnClass)}>
              <Building2 className="w-4 h-4 mr-2" />
              Register Org
            </Button>
          </Link>
        </>
      );
    }

    return (
      <>
        <Link href={`/${sport}/login`}>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <LogIn className="w-4 h-4 mr-2" />
            Login
          </Button>
        </Link>
        <Link href={`/${sport}/register`}>
          <Button size="sm" className={cn("shadow-sm", primaryBtnClass)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Register
          </Button>
        </Link>
      </>
    );
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-3">
            <Link href={`/${sport}`} className="flex items-center gap-2 min-w-0">
              <Image src="/logo.png" alt="VALORHIVE" width={32} height={32} className="h-8 w-auto" priority />
              <span className="truncate text-lg font-bold text-foreground">VALORHIVE</span>
              <Badge variant="outline" className={cn("border-current/30", sportBadgeClass)}>
                {sportName}
              </Badge>
            </Link>

            <div className="flex items-center gap-2">
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
