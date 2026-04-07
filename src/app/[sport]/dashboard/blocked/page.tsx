"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Ban,
  VolumeX,
  Search,
  Loader2,
  UserX,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BlockedPlayer {
  id: string;
  blockedId: string;
  reason: string | null;
  isMute: boolean;
  createdAt: string;
  blocked: {
    id: string;
    firstName: string;
    lastName: string;
    city?: string | null;
    state?: string | null;
    photoUrl?: string | null;
    visiblePoints?: number;
  };
}

export default function BlockedPlayersPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [blockedPlayers, setBlockedPlayers] = useState<BlockedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
    : "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600";

  useEffect(() => {
    fetchBlockedPlayers();
  }, [sport]);

  const fetchBlockedPlayers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/blocked-players");
      if (response.ok) {
        const data = await response.json();
        setBlockedPlayers(data.blockedPlayers || []);
      }
    } catch (error) {
      console.error("Failed to fetch blocked players:", error);
      toast.error("Failed to load blocked players");
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    try {
      setUnblockingId(blockedId);
      const response = await fetch(`/api/blocked-players?blockedId=${blockedId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Player unblocked");
        setBlockedPlayers((prev) => prev.filter((p) => p.blockedId !== blockedId));
      } else {
        toast.error("Failed to unblock player");
      }
    } catch (error) {
      toast.error("Failed to unblock player");
    } finally {
      setUnblockingId(null);
    }
  };

  const filteredPlayers = blockedPlayers.filter((p) => {
    if (!searchQuery) return true;
    const name = `${p.blocked.firstName} ${p.blocked.lastName}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="p-6 max-w-6xl space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Shield className={cn("w-7 h-7", primaryTextClass)} />
              Blocked Players
            </h1>
            <p className="text-muted-foreground">
              Manage players you&apos;ve blocked or muted
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Ban className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {blockedPlayers.filter((p) => !p.isMute).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Blocked</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <VolumeX className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {blockedPlayers.filter((p) => p.isMute).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Muted</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search blocked players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Blocked Players List */}
          <Card className="bg-card border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Blocked & Muted Players</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-12 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="text-center py-12">
                  <UserX className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">
                    {searchQuery ? "No players found" : "No blocked players yet"}
                  </p>
                  {!searchQuery && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Block players from their profile page
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={player.blocked.photoUrl || undefined} />
                          <AvatarFallback>
                            {player.blocked.firstName?.[0]}
                            {player.blocked.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">
                              {player.blocked.firstName} {player.blocked.lastName}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                player.isMute
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              )}
                            >
                              {player.isMute ? "Muted" : "Blocked"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {player.blocked.city && (
                              <span>
                                {player.blocked.city}
                                {player.blocked.state && `, ${player.blocked.state}`}
                              </span>
                            )}
                            <span>Blocked {formatDate(player.createdAt)}</span>
                          </div>
                          {player.reason && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Reason: {player.reason}
                            </p>
                          )}
                        </div>
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600">
                            {unblockingId === player.blockedId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Ban className="w-4 h-4 mr-2" />
                            )}
                            Unblock
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Unblock Player?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {player.blocked.firstName} will be able to interact with you again.
                              This will allow them to:
                              - Send you messages
                              - See your online status
                              - Match with you in tournaments
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleUnblock(player.blockedId)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Unblock
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Safety Tips */}
          <Card className="bg-muted/30 border-border/50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Shield className={cn("w-4 h-4", primaryTextClass)} />
                Safety Tips
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Blocked players won&apos;t be notified that you blocked them</li>
                <li>You won&apos;t see blocked players in tournament listings</li>
                <li>Muted players can still interact but won&apos;t disturb you</li>
                <li>
                  <Link href={`/${sport}/safety`} className={primaryTextClass}>
                    Learn more about safety features →
                  </Link>
                </li>
              </ul>
            </CardContent>
          </Card>
    </div>
  );
}
