"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  Settings,
  LogOut,
  Bell,
  Loader2,
  CheckCircle,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserInfo {
  id: string;
  playerId?: string;
  firstName: string;
  lastName: string;
  name: string;
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  photoUrl: string | null;
}

interface UserMenuProps {
  sport: string;
  primaryTextClass: string;
  isLoggedIn: boolean;
}

export function UserMenu({ sport, primaryTextClass, isLoggedIn }: UserMenuProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      fetchUserInfo();
    }
  }, [isLoggedIn]);

  const fetchUserInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/player/me?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        // Clear any client-side state
        setUser(null);
        // Redirect to home page
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

  const loginIdentifier = user?.email || user?.phone || "";
  const identifierVerified = user?.email
    ? user.emailVerified
    : user?.phone
      ? user.phoneVerified
      : false;

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => router.push(`/${sport}/notifications`)}
      >
        <Bell className="w-5 h-5" />
        {/* Notification badge - can be dynamic later */}
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          0
        </span>
      </Button>

      {/* User Avatar Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9 border-2 border-border">
              {user?.photoUrl ? (
                <AvatarImage src={user.photoUrl} alt={user.name || "User"} />
              ) : null}
              <AvatarFallback className={cn("text-sm font-medium", primaryTextClass)}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  getInitials()
                )}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {user?.name || "Player"}
              </p>
              {loginIdentifier && (
                <div className="flex items-center gap-1 text-xs leading-none text-muted-foreground">
                  <p className="truncate">{loginIdentifier}</p>
                  {identifierVerified ? (
                    <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                  ) : null}
                </div>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={`/${sport}/profile`} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>My Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/${sport}/subscription`} className="cursor-pointer">
                <Crown className="mr-2 h-4 w-4" />
                <span>Subscription</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/${sport}/settings`} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            <span>{loggingOut ? "Logging out..." : "Logout"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
