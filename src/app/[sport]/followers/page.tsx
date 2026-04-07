"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Users,
  ChevronLeft,
  MapPin,
  Loader2,
  UserPlus,
} from "lucide-react";

interface FollowUser {
  id: string;
  name: string;
  city: string | null;
  points: number;
  followedAt: string;
}

export default function FollowersPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);

  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";

  useEffect(() => {
    fetchFollowData();
  }, [sport]);

  const fetchFollowData = async () => {
    try {
      setLoading(true);
      
      // Fetch followers (users who follow me)
      const followersRes = await fetch(
        `/api/follow?type=followers&userId=current&sport=${sport.toUpperCase()}`
      );
      if (followersRes.ok) {
        const data = await followersRes.json();
        setFollowers(data.followers || []);
      }

      // Fetch following (users I follow)
      const followingRes = await fetch(
        `/api/follow?type=following&userId=current&sport=${sport.toUpperCase()}`
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar userType="player" />
        <main className="ml-0 md:ml-72 min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72 min-h-screen">
        <div className="p-6 max-w-4xl space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Link href={`/${sport}/profile`} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-bold">Connections</h1>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{followers.length}</p>
                <p className="text-sm text-muted-foreground">Followers</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <UserPlus className="w-6 h-6 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold">{following.length}</p>
                <p className="text-sm text-muted-foreground">Following</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="followers">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="followers" className="gap-2">
                <Users className="w-4 h-4" />
                Followers ({followers.length})
              </TabsTrigger>
              <TabsTrigger value="following" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Following ({following.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="followers">
              {followers.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No followers yet</p>
                    <p className="text-sm text-muted-foreground">
                      Start participating in tournaments to gain followers!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {followers.map((user) => (
                    <Link
                      key={user.id}
                      href={`/${sport}/players/${user.id}`}
                      className="block"
                    >
                      <Card className="hover:bg-muted/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                {user.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium">{user.name}</p>
                              {user.city && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {user.city}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{user.points} pts</p>
                              <p className="text-xs text-muted-foreground">
                                Since {new Date(user.followedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="following">
              {following.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <UserPlus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Not following anyone yet</p>
                    <p className="text-sm text-muted-foreground">
                      Find players to follow and see their activity!
                    </p>
                    <Link href={`/${sport}/leaderboard`}>
                      <Button className={cn("mt-4 text-white", primaryBtnClass)}>
                        Browse Players
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {following.map((user) => (
                    <Link
                      key={user.id}
                      href={`/${sport}/players/${user.id}`}
                      className="block"
                    >
                      <Card className="hover:bg-muted/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                {user.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium">{user.name}</p>
                              {user.city && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {user.city}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{user.points} pts</p>
                              <p className="text-xs text-muted-foreground">
                                Followed {new Date(user.followedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
