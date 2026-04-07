"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, UserPlus, MapPin, Trophy, Building2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface OrgFollowersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  sport: string;
  isCornhole: boolean;
}

interface Follower {
  id: string;
  name: string;
  city?: string;
  points?: number;
  followedAt: string;
}

interface Following {
  id: string;
  name: string;
  city?: string;
  points?: number;
  followedAt: string;
}

export function OrgFollowersModal({
  open,
  onOpenChange,
  orgId,
  sport,
  isCornhole,
}: OrgFollowersModalProps) {
  const [activeTab, setActiveTab] = useState("followers");
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Following[]>([]);
  const [loading, setLoading] = useState(false);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  useEffect(() => {
    if (open && orgId) {
      fetchFollowData();
    }
  }, [open, orgId, sport]);

  const fetchFollowData = async () => {
    setLoading(true);
    try {
      // Fetch followers (users following this org)
      const followersRes = await fetch(
        `/api/follow?type=followersOrg&orgId=${orgId}&sport=${sport.toUpperCase()}`,
        { credentials: "include" }
      );
      if (followersRes.ok) {
        const data = await followersRes.json();
        setFollowers(data.followers || []);
      }

      // Fetch following (users this org is following)
      const followingRes = await fetch(
        `/api/follow?type=followingOrg&orgId=${orgId}&sport=${sport.toUpperCase()}`,
        { credentials: "include" }
      );
      if (followingRes.ok) {
        const data = await followingRes.json();
        setFollowing(data.following || []);
      }
    } catch (error) {
      console.error("Failed to fetch follow data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  };

  const renderUserList = (users: (Follower | Following)[], emptyMessage: string) => {
    if (users.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Users className="w-12 h-12 mb-3 opacity-30" />
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/${sport}/players/${user.id}`}
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className={cn("text-white font-medium", isCornhole ? "bg-green-500" : "bg-teal-500")}>
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-gray-900">{user.name}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {user.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {user.city}
                    </span>
                  )}
                  {user.points !== undefined && (
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      {user.points} pts
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className="text-xs text-gray-400">{formatDate(user.followedAt)}</span>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Organization Connections
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="followers" className="gap-2">
              <Users className="w-4 h-4" />
              Followers
              <span className={cn("ml-1 px-2 py-0.5 rounded-full text-xs", primaryBgClass, primaryTextClass)}>
                {followers.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="following" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Following
              <span className={cn("ml-1 px-2 py-0.5 rounded-full text-xs", primaryBgClass, primaryTextClass)}>
                {following.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <TabsContent value="followers" className="mt-4">
                {renderUserList(followers, "No followers yet")}
              </TabsContent>
              <TabsContent value="following" className="mt-4">
                {renderUserList(following, "Not following anyone yet")}
              </TabsContent>
            </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
