"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Menu, 
  LogIn, 
  UserPlus, 
  Home, 
  Trophy, 
  TrendingUp, 
  ShoppingBag, 
  BookOpen,
  User,
  LogOut,
  Settings,
  Bell,
  LayoutDashboard,
  LucideIcon,
  Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// Icon mapping - use string identifiers from server, map to components here
const iconMap: Record<string, LucideIcon> = {
  Home,
  Trophy,
  TrendingUp,
  ShoppingBag,
  BookOpen,
};

interface NavigationItem {
  name: string;
  href: string;
  icon: string; // String identifier instead of component
}

interface MobileMenuProps {
  sport: string;
  navigation: NavigationItem[];
  primaryBtnClass: string;
  isLoggedIn?: boolean;
}

interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  photoUrl: string | null;
}

export function MobileMenu({ 
  sport, 
  navigation, 
  primaryBtnClass,
  isLoggedIn = false
}: MobileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      fetchUserInfo();
    }
  }, [isLoggedIn]);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch("/api/player/me");
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        setUser(null);
        setOpen(false);
        window.location.href = `/${sport}`;
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 p-0">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-border">
            <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
              <img src="/logo.png" alt="VALORHIVE" className="h-8 w-auto" />
              <span className="text-lg font-bold text-foreground">VALORHIVE</span>
            </Link>
          </div>
          
          {/* User Info Section when logged in */}
          {isLoggedIn && user && (
            <div className="p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-border">
                  {user.photoUrl ? (
                    <AvatarImage src={user.photoUrl} alt={user.name || "User"} />
                  ) : null}
                  <AvatarFallback className="text-sm font-medium">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{user.name || "Player"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
            </div>
          )}
          
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const IconComponent = iconMap[item.icon];
              return (
                <Link 
                  key={item.name} 
                  href={`/${sport}${item.href}`}
                  onClick={() => setOpen(false)}
                >
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    {IconComponent && <IconComponent className="w-4 h-4" />}
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </nav>
          
          <div className="p-4 border-t border-border space-y-2">
            {isLoggedIn ? (
              <>
                <Link href={`/${sport}/dashboard`} onClick={() => setOpen(false)} className="block">
                  <Button variant="outline" className="w-full gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Button>
                </Link>
                <Link href={`/${sport}/profile`} onClick={() => setOpen(false)} className="block">
                  <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
                    <User className="w-4 h-4" />
                    Profile
                  </Button>
                </Link>
                <Link href={`/${sport}/notifications`} onClick={() => setOpen(false)} className="block">
                  <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
                    <Bell className="w-4 h-4" />
                    Notifications
                  </Button>
                </Link>
                <Link href={`/${sport}/settings`} onClick={() => setOpen(false)} className="block">
                  <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
                    <Settings className="w-4 h-4" />
                    Settings
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  {loggingOut ? "Logging out..." : "Logout"}
                </Button>
              </>
            ) : (
              <>
                <Link href={`/${sport}/login`} onClick={() => setOpen(false)} className="block">
                  <Button variant="outline" className="w-full gap-2">
                    <LogIn className="w-4 h-4" />
                    Login
                  </Button>
                </Link>
                <Link href={`/${sport}/register`} onClick={() => setOpen(false)} className="block">
                  <Button className={cn("w-full text-white gap-2", primaryBtnClass)}>
                    <UserPlus className="w-4 h-4" />
                    Register
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
