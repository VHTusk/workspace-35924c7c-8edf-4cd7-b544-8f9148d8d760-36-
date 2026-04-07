"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { BlockPlayerDialog } from "@/components/block-player-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UserX,
  Plus,
  Search,
  Trash2,
  VolumeX,
  Ban,
  CheckCircle,
  AlertCircle,
  Users,
  Clock,
  Calendar,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BlockedPlayer {
  id: string;
  blockedId: string;
  reason: string | null;
  isMute: boolean;
  blocked: {
    id: string;
    firstName: string;
    lastName: string;
    city?: string | null;
    state?: string | null;
    visiblePoints?: number;
  };
  createdAt: string;
}

export default function BlockedPlayersPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [blockedPlayers, setBlockedPlayers] = useState<BlockedPlayer[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<BlockedPlayer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBlockedPlayers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredPlayers(blockedPlayers);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredPlayers(
        blockedPlayers.filter(
          (bp) =>
            bp.blocked.firstName.toLowerCase().includes(query) ||
            bp.blocked.lastName.toLowerCase().includes(query) ||
            bp.reason?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, blockedPlayers]);

  const fetchBlockedPlayers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/blocked-players");
      if (response.ok) {
        const data = await response.json();
        setBlockedPlayers(data.blockedPlayers || []);
        setFilteredPlayers(data.blockedPlayers || []);
      }
    } catch (err) {
      console.error("Failed to fetch blocked players:", err);
      setError("Failed to load blocked players");
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedId: string, name: string) => {
    setUnblockingId(blockedId);
    setError("");

    try {
      const response = await fetch(
        `/api/blocked-players?blockedId=${blockedId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to unblock player");
      }

      setBlockedPlayers((prev) =>
        prev.filter((bp) => bp.blockedId !== blockedId)
      );
      setSuccess(`${name} has been unblocked`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Failed to unblock player:", err);
      setError("Failed to unblock player");
    } finally {
      setUnblockingId(null);
    }
  };

  const handleBlocked = () => {
    fetchBlockedPlayers();
    setSuccess("Player has been blocked");
    setTimeout(() => setSuccess(""), 3000);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`;
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";

  // Stats
  const blockedCount = blockedPlayers.filter((bp) => !bp.isMute).length;
  const mutedCount = blockedPlayers.filter((bp) => bp.isMute).length;

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72">
        <div className="p-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/${sport}/settings`}
                className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Settings
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <UserX className="w-6 h-6" />
                  Blocked Players
                </h1>
                <p className="text-gray-500">
                  Manage players you&apos;ve blocked or muted
                </p>
              </div>
              <Button
                onClick={() => setShowBlockDialog(true)}
                className={cn("text-white gap-2", primaryBtnClass)}
              >
                <Plus className="w-4 h-4" />
                Block Player
              </Button>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <Alert className="mb-6 bg-emerald-50 border-emerald-200">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                    <Ban className={cn("w-5 h-5", primaryTextClass)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {blockedCount}
                    </p>
                    <p className="text-sm text-gray-500">Blocked</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50">
                    <VolumeX className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {mutedCount}
                    </p>
                    <p className="text-sm text-gray-500">Muted</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {blockedPlayers.length}
                    </p>
                    <p className="text-sm text-gray-500">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search blocked players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Blocked Players List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="py-12">
                <div className="text-center">
                  <div
                    className={cn(
                      "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
                      primaryBgClass
                    )}
                  >
                    <Users className={cn("w-8 h-8", primaryTextClass)} />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchQuery
                      ? "No matching players found"
                      : "No blocked players"}
                  </h3>
                  <p className="text-gray-500 max-w-md mx-auto mb-4">
                    {searchQuery
                      ? "Try a different search term"
                      : "You haven't blocked any players. Blocking prevents a player from messaging you or matching with you in tournaments."}
                  </p>
                  {!searchQuery && (
                    <Button
                      onClick={() => setShowBlockDialog(true)}
                      className={cn("text-white gap-2", primaryBtnClass)}
                    >
                      <Plus className="w-4 h-4" />
                      Block a Player
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-gray-900 text-base">
                  {filteredPlayers.length} player
                  {filteredPlayers.length !== 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-96">
                  <div className="divide-y divide-gray-100">
                    {filteredPlayers.map((bp) => (
                      <div
                        key={bp.id}
                        className="p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div
                              className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center",
                                bp.isMute ? "bg-amber-100" : primaryBgClass
                              )}
                            >
                              <span
                                className={cn(
                                  "text-sm font-medium",
                                  bp.isMute
                                    ? "text-amber-700"
                                    : primaryTextClass
                                )}
                              >
                                {getInitials(
                                  bp.blocked.firstName,
                                  bp.blocked.lastName
                                )}
                              </span>
                            </div>

                            {/* Player Info */}
                            <div>
                              <p className="font-medium text-gray-900">
                                {bp.blocked.firstName} {bp.blocked.lastName}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {/* Type Badge */}
                                <Badge
                                  className={cn(
                                    "text-xs",
                                    bp.isMute
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-red-100 text-red-700"
                                  )}
                                >
                                  {bp.isMute ? (
                                    <>
                                      <VolumeX className="w-3 h-3 mr-1" />
                                      Muted
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-3 h-3 mr-1" />
                                      Blocked
                                    </>
                                  )}
                                </Badge>

                                {/* Reason */}
                                {bp.reason && (
                                  <span className="text-xs text-gray-500">
                                    Reason: {bp.reason}
                                  </span>
                                )}

                                {/* Date */}
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(bp.createdAt)}
                                </span>
                              </div>

                              {/* Location */}
                              {bp.blocked.city && bp.blocked.state && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {bp.blocked.city}, {bp.blocked.state}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Unblock Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleUnblock(
                                bp.blockedId,
                                `${bp.blocked.firstName} ${bp.blocked.lastName}`
                              )
                            }
                            disabled={unblockingId === bp.blockedId}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            {unblockingId === bp.blockedId ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Unblock
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="bg-blue-50 border-blue-200 mt-6">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">
                    How Blocking Works
                  </h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>
                      • <strong>Blocked</strong> players cannot message you or
                      be matched with you in tournaments
                    </li>
                    <li>
                      • <strong>Muted</strong> players can still interact, but
                      their messages won&apos;t show in your inbox
                    </li>
                    <li>
                      • Blocked players are not notified when you block them
                    </li>
                    <li>• You can unblock players at any time</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Block Player Dialog */}
      <BlockPlayerDialog
        open={showBlockDialog}
        onOpenChange={setShowBlockDialog}
        sport={sport}
        onBlocked={handleBlocked}
      />
    </div>
  );
}
