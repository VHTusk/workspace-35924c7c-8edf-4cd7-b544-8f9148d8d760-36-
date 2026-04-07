"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy,
  Home,
  TrendingUp,
  LogIn,
  UserPlus,
  ShoppingBag,
  BookOpen,
  Loader2,
  LucideIcon,
  ChevronDown,
  User,
  Settings,
  Crown,
  LogOut,
  Menu,
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  BarChart3,
} from "lucide-react";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { GlobalSearch, SearchButton } from "@/components/search/global-search";
import { cn } from "@/lib/utils";
import { ThemeToggleCompact } from "@/components/theme-toggle";
import { useEffect, useState, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  Home,
  Trophy,
  TrendingUp,
  ShoppingBag,
  BookOpen,
  LayoutDashboard,
};

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
  navigation: Array<{
    icon: string;
    label: string;
    href: string;
  }>;
}

export default function SportHeader({
  sport,
  sportName,
  primaryBtnClass,
  sportBadgeClass,
  navigation,
}: SportHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [userType, setUserType] = useState<"player" | "org" | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  // Check if on login or register page
  const isAuthPage = pathname?.includes('/login') || pathname?.includes('/register');

  // Get dashboard URL based on user type
  const getDashboardUrl = () => {
    if (userType === "org" && org) {
      // Route based on org type - all go to org home for sport selection
      return "/org/home";
    }
    return `/${sport}/dashboard`;
  };

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
                <Link href={getDashboardUrl()} className="cursor-pointer">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </DropdownMenuItem>
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
              
              {/* Org-specific menu items */}
              {userType === "org" && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/${sport}/org/participants`} className="cursor-pointer">
                      <Users className="mr-2 h-4 w-4" />
                      Participants
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/${sport}/org/analytics`} className="cursor-pointer">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Analytics
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/${sport}/org/contracts`} className="cursor-pointer">
                      <Briefcase className="mr-2 h-4 w-4" />
                      Contracts
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              
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
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="VALORHIVE" width={32} height={32} className="h-8 w-auto" priority />
            <span className="text-lg font-bold text-foreground">VALORHIVE</span>
            <Badge variant="outline" className={cn("border-current/30", sportBadgeClass)}>
              {sportName}
            </Badge>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {/* Search Button */}
            <SearchButton onClick={() => setSearchOpen(true)} />
            
            {/* Dashboard Tab - Show when logged in */}
            {authenticated === true && (
              <Link href={getDashboardUrl()}>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            )}
            
            {/* Hide main navigation on org pages when org is logged in */}
            {!(authenticated === true && userType === "org") && navigation.map((item) => {
              const IconComponent = iconMap[item.icon] || Home;
              return (
                <Link key={item.href} href={item.href}>
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                    <IconComponent className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Desktop Auth Buttons & Theme Toggle */}
          <div className="hidden md:flex items-center gap-2">
            {renderAuthButtons()}
            <ThemeToggleCompact />
          </div>

          {/* Mobile Menu */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggleCompact />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <div className="flex flex-col h-full">
                  {/* Navigation */}
                  <nav className="flex-1 p-4">
                    <ul className="space-y-1">
                      {/* Dashboard Tab - Show when logged in */}
                      {authenticated === true && (
                        <li>
                          <Link
                            href={getDashboardUrl()}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted"
                          >
                            <LayoutDashboard className="h-5 w-5" />
                            Dashboard
                          </Link>
                        </li>
                      )}
                      
                      {/* Hide main navigation on org pages when org is logged in */}
                      {!(authenticated === true && userType === "org") && navigation.map((item) => {
                        const IconComponent = iconMap[item.icon] || Home;
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted"
                            >
                              <IconComponent className="h-5 w-5" />
                              {item.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>

                  {/* Auth Section */}
                  <div className="p-4 border-t">
                    {loading ? (
                      <div className="flex justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : authenticated ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user?.photoUrl || org?.photoUrl || undefined} />
                            <AvatarFallback className={cn("text-white", primaryBtnClass)}>
                              {userType === "org" ? <Building2 className="w-5 h-5" /> : getInitials()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{getDisplayName()}</p>
                            <p className="text-xs text-muted-foreground">
                              {getSubscriptionStatus()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Link href={getDashboardUrl()} onClick={() => setMobileMenuOpen(false)} className="flex-1">
                            <Button className={cn("w-full", primaryBtnClass)}>
                              Dashboard
                            </Button>
                          </Link>
                          <Button variant="outline" onClick={handleLogout}>
                            <LogOut className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : !isAuthPage ? (
                      <div className="flex gap-2">
                        <Link 
                          href={isOrgPage ? `/${sport}/org/login` : `/${sport}/login`} 
                          onClick={() => setMobileMenuOpen(false)} 
                          className="flex-1"
                        >
                          <Button variant="outline" className="w-full">Login</Button>
                        </Link>
                        <Link 
                          href={isOrgPage ? `/${sport}/org/register` : `/${sport}/register`} 
                          onClick={() => setMobileMenuOpen(false)} 
                          className="flex-1"
                        >
                          <Button className={cn("w-full", primaryBtnClass)}>
                            {isOrgPage ? "Register Org" : "Register"}
                          </Button>
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>

    {/* Global Search Modal */}
    <GlobalSearch sport={sport} isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
