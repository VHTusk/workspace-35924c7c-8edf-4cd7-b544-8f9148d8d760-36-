"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Users,
  UserCheck,
  Loader2,
  Trophy,
  Play,
  UserPlus,
  ChevronLeft,
} from "lucide-react";

interface ActivityUser {
  id: string;
  user: { id: string; firstName: string; lastName: string };
  status: string;
  tournamentName?: string;
}

interface LiveMatch {
  id: string;
  tournamentName?: string;
  playerA: { firstName: string; lastName: string };
  playerB: { firstName: string; lastName: string };
}

export default function FriendsActivityPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [friendsPlaying, setFriendsPlaying] = useState<ActivityUser[]>([]);
  const [friendsAvailable, setFriendsAvailable] = useState<ActivityUser[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [myStatus, setMyStatus] = useState("OFFLINE");

  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  useEffect(() => {
    fetchActivity();
  }, [sport]);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/player/friends-activity", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setFriendsPlaying(data.friendsPlaying || []);
        setFriendsAvailable(data.friendsAvailable || []);
        setLiveMatches(data.liveMatches || []);
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      if (status === "OFFLINE") {
        await fetch("/api/player/friends-activity", { method: "DELETE", credentials: "include" });
      } else {
        await fetch("/api/player/friends-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status }),
        });
      }
      setMyStatus(status);
    } catch (err) {
      console.error("Failed:", err);
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/${sport}`} className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-2xl font-bold">Friends Activity</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Your status:</span>
              <select
                value={myStatus}
                onChange={(e) => updateStatus(e.target.value)}
                className="h-9 rounded-md border bg-background"
              >
                <option value="OFFLINE">Offline</option>
                <option value="AVAILABLE">Available</option>
                <option value="PLAYING">Playing</option>
              </select>
            </div>
          </div>

          {/* Live Matches */}
          {liveMatches.length > 0 && (
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <Play className="w-5 h-5" />
                  Live Matches ({liveMatches.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {liveMatches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between p-2 rounded bg-green-50">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-green-600" />
                      <div>
                        <p className="font-medium text-sm">{match.tournamentName}</p>
                        <p className="text-xs text-muted-foreground">
                          {match.playerA.firstName} vs {match.playerB.firstName}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700">LIVE</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Friends Playing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-green-600" />
                Playing ({friendsPlaying.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {friendsPlaying.length === 0 ? (
                <p className="text-muted-foreground text-sm">No friends currently playing</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {friendsPlaying.map((friend) => (
                    <Link
                      key={friend.id}
                      href={`/${sport}/players/${friend.user.id}`}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{friend.user.firstName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{friend.user.firstName} {friend.user.lastName}</p>
                        <p className="text-xs text-muted-foreground">{friend.tournamentName}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Friends Available */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                Available ({friendsAvailable.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {friendsAvailable.length === 1 ? (
                <p className="text-muted-foreground text-sm">No friends currently available</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {friendsAvailable.map((friend) => (
                    <Link
                      key={friend.id}
                      href={`/${sport}/players/${friend.user.id}`}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{friend.user.firstName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <p className="font-medium text-sm">{friend.user.firstName} {friend.user.lastName}</p>
                      <Badge className="bg-blue-100 text-blue-700">Available</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
