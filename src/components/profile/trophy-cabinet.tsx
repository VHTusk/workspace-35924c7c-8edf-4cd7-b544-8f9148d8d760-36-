"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Trophy,
  Medal,
  Star,
  Share2,
  Pin,
  ExternalLink,
  Loader2,
  MoreVertical,
  Filter,
  SortAsc,
  SortDesc,
  TrophyIcon,
  Sparkles,
  Calendar,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Trophy colors
const TROPHY_COLORS = {
  GOLD: "#FFD700",
  SILVER: "#C0C0C0",
  BRONZE: "#CD7F32",
};

interface Trophy {
  id: string;
  title: string;
  description: string | null;
  trophyType: string;
  position: number | null;
  isFeatured: boolean;
  displayOrder: number;
  shareCount: number;
  iconUrl: string | null;
  imageUrl: string | null;
  earnedAt: string;
  tournamentId: string | null;
}

interface TrophyStats {
  total: number;
  gold: number;
  silver: number;
  bronze: number;
  featured: number;
}

interface TrophyCabinetProps {
  userId?: string;
  compact?: boolean;
  showFilters?: boolean;
  className?: string;
}

type TrophyFilter = "all" | "GOLD" | "SILVER" | "BRONZE";
type SortOrder = "newest" | "oldest" | "position";

export function TrophyCabinet({
  userId,
  compact = false,
  showFilters = false,
  className,
}: TrophyCabinetProps) {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [stats, setStats] = useState<TrophyStats | null>(null);
  const [filter, setFilter] = useState<TrophyFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [shareDialog, setShareDialog] = useState<Trophy | null>(null);
  const [updatingTrophy, setUpdatingTrophy] = useState<string | null>(null);

  // Primary colors based on sport
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";

  const fetchTrophies = useCallback(async () => {
    setLoading(true);
    try {
      const url = userId
        ? `/api/player/trophies?userId=${userId}`
        : "/api/player/trophies";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTrophies(data.trophies || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error("Failed to fetch trophies:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTrophies();
  }, [fetchTrophies]);

  const handleFeature = async (trophyId: string, isFeatured: boolean) => {
    if (userId) return; // Don't allow editing if viewing another user's trophies
    
    setUpdatingTrophy(trophyId);
    try {
      const response = await fetch("/api/player/trophies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trophyId, isFeatured: !isFeatured }),
      });
      
      if (response.ok) {
        await fetchTrophies();
        toast.success(isFeatured ? "Trophy removed from featured" : "Trophy featured successfully");
      } else {
        toast.error("Failed to update trophy");
      }
    } catch (error) {
      console.error("Failed to update trophy:", error);
      toast.error("Failed to update trophy");
    } finally {
      setUpdatingTrophy(null);
    }
  };

  const handleShare = async (trophy: Trophy) => {
    if (userId) return; // Don't allow sharing if viewing another user's trophies
    
    try {
      const response = await fetch("/api/player/trophies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trophyId: trophy.id }),
      });
      
      if (response.ok) {
        // Update local state to reflect the share
        setTrophies(prev =>
          prev.map(t =>
            t.id === trophy.id
              ? { ...t, shareCount: t.shareCount + 1 }
              : t
          )
        );
        setShareDialog(trophy);
      }
    } catch (error) {
      console.error("Failed to share trophy:", error);
    }
  };

  const copyShareLink = () => {
    if (!shareDialog) return;
    const shareUrl = `${window.location.origin}/${sport}/profile/trophies?t=${shareDialog.id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard!");
    setShareDialog(null);
  };

  const getTrophyIcon = (type: string, size: "sm" | "md" | "lg" = "md") => {
    const sizeClass = size === "sm" ? "w-4 h-4" : size === "md" ? "w-6 h-6" : "w-8 h-8";
    
    switch (type) {
      case "GOLD":
        return <Trophy className={cn(sizeClass, "text-amber-500")} style={{ color: TROPHY_COLORS.GOLD }} />;
      case "SILVER":
        return <Medal className={cn(sizeClass, "text-slate-400 dark:text-slate-300")} style={{ color: TROPHY_COLORS.SILVER }} />;
      case "BRONZE":
        return <Medal className={cn(sizeClass, "text-orange-700")} style={{ color: TROPHY_COLORS.BRONZE }} />;
      default:
        return <Star className={cn(sizeClass, "text-muted-foreground")} />;
    }
  };

  const getTrophyBg = (type: string) => {
    switch (type) {
      case "GOLD":
        return "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800";
      case "SILVER":
        return "bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-700";
      case "BRONZE":
        return "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800";
      default:
        return "bg-muted/50 border-border";
    }
  };

  const getTrophyLabel = (type: string) => {
    switch (type) {
      case "GOLD":
        return "Gold";
      case "SILVER":
        return "Silver";
      case "BRONZE":
        return "Bronze";
      default:
        return "Special";
    }
  };

  const getPositionBadge = (position: number | null) => {
    if (!position) return null;
    
    const badges: Record<number, { label: string; color: string }> = {
      1: { label: "1st", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
      2: { label: "2nd", color: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300" },
      3: { label: "3rd", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" },
    };
    
    return badges[position] || { label: `${position}th`, color: "bg-blue-100 text-blue-700" };
  };

  // Filter and sort trophies
  const filteredTrophies = trophies
    .filter((t) => filter === "all" || t.trophyType === filter)
    .sort((a, b) => {
      // Featured first
      if (a.isFeatured !== b.isFeatured) {
        return a.isFeatured ? -1 : 1;
      }
      
      // Then by sort order
      switch (sortOrder) {
        case "newest":
          return new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime();
        case "oldest":
          return new Date(a.earnedAt).getTime() - new Date(b.earnedAt).getTime();
        case "position":
          return (a.position || 999) - (b.position || 999);
        default:
          return 0;
      }
    });

  const featuredTrophies = filteredTrophies.filter((t) => t.isFeatured);
  const otherTrophies = filteredTrophies.filter((t) => !t.isFeatured);

  if (loading) {
    return (
      <Card className={cn("bg-card border-border/50 shadow-sm", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Trophy className="w-5 h-5" />
            Trophy Cabinet
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!stats || stats.total === 0) {
    return (
      <Card className={cn("bg-card border-border/50 shadow-sm", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Trophy className="w-5 h-5" />
            Trophy Cabinet
          </CardTitle>
          <CardDescription>Your achievements will appear here</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
            <TrophyIcon className="w-10 h-10 opacity-50" />
          </div>
          <p className="font-medium mb-1">No trophies yet</p>
          <p className="text-sm mb-4">Win tournaments to earn trophies!</p>
          <p className="text-xs mb-4">
            Top 3 finishes are automatically added to your cabinet
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/${sport}/tournaments`)}
            className={cn("text-white", isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700")}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Find Tournaments
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn("bg-card border-border/50 shadow-sm", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Trophy className="w-5 h-5" />
              Trophy Cabinet
              <Badge className={cn(primaryBgClass, primaryTextClass, "border-transparent")}>
                {stats.total} total
              </Badge>
            </CardTitle>
            {!compact && !userId && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-muted-foreground"
              >
                <Link href={`/${sport}/profile/trophies`}>
                  View All
                  <ExternalLink className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>
          
          {/* Stats Row */}
          <div className="flex flex-wrap gap-4 mt-2">
            <button
              onClick={() => setFilter(filter === "GOLD" ? "all" : "GOLD")}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors",
                filter === "GOLD"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                  : "hover:bg-muted"
              )}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: TROPHY_COLORS.GOLD }}
              />
              <span className="text-muted-foreground">{stats.gold} Gold</span>
            </button>
            <button
              onClick={() => setFilter(filter === "SILVER" ? "all" : "SILVER")}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors",
                filter === "SILVER"
                  ? "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
                  : "hover:bg-muted"
              )}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: TROPHY_COLORS.SILVER }}
              />
              <span className="text-muted-foreground">{stats.silver} Silver</span>
            </button>
            <button
              onClick={() => setFilter(filter === "BRONZE" ? "all" : "BRONZE")}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors",
                filter === "BRONZE"
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                  : "hover:bg-muted"
              )}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: TROPHY_COLORS.BRONZE }}
              />
              <span className="text-muted-foreground">{stats.bronze} Bronze</span>
            </button>
          </div>

          {/* Filters and Sort (for full page view) */}
          {showFilters && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    {filter === "all" ? "All Types" : getTrophyLabel(filter)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setFilter("all")}>
                    All Types
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter("GOLD")}>
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: TROPHY_COLORS.GOLD }}
                    />
                    Gold Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter("SILVER")}>
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: TROPHY_COLORS.SILVER }}
                    />
                    Silver Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter("BRONZE")}>
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: TROPHY_COLORS.BRONZE }}
                    />
                    Bronze Only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {sortOrder === "newest" ? (
                      <SortDesc className="w-4 h-4 mr-2" />
                    ) : sortOrder === "oldest" ? (
                      <SortAsc className="w-4 h-4 mr-2" />
                    ) : (
                      <Trophy className="w-4 h-4 mr-2" />
                    )}
                    {sortOrder === "newest"
                      ? "Newest First"
                      : sortOrder === "oldest"
                      ? "Oldest First"
                      : "By Position"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setSortOrder("newest")}>
                    <SortDesc className="w-4 h-4 mr-2" />
                    Newest First
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder("oldest")}>
                    <SortAsc className="w-4 h-4 mr-2" />
                    Oldest First
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder("position")}>
                    <Trophy className="w-4 h-4 mr-2" />
                    By Position
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Featured Trophies */}
          {featuredTrophies.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Pin className="w-3 h-3" />
                Featured ({featuredTrophies.length})
              </h4>
              <div
                className={cn(
                  "grid gap-3",
                  compact
                    ? "grid-cols-1"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                )}
              >
                {featuredTrophies.slice(0, compact ? 2 : undefined).map((trophy) => (
                  <TrophyCard
                    key={trophy.id}
                    trophy={trophy}
                    isUpdating={updatingTrophy === trophy.id}
                    isOwner={!userId}
                    onFeature={() => handleFeature(trophy.id, true)}
                    onShare={() => handleShare(trophy)}
                    getTrophyIcon={getTrophyIcon}
                    getTrophyBg={getTrophyBg}
                    getPositionBadge={getPositionBadge}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Trophies */}
          {otherTrophies.length > 0 && (
            <div>
              {featuredTrophies.length > 0 && (
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  All Trophies ({otherTrophies.length})
                </h4>
              )}
              <div
                className={cn(
                  "grid gap-3",
                  compact
                    ? "grid-cols-1"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                )}
              >
                {otherTrophies.slice(0, compact ? 3 : undefined).map((trophy) => (
                  <TrophyCard
                    key={trophy.id}
                    trophy={trophy}
                    isUpdating={updatingTrophy === trophy.id}
                    isOwner={!userId}
                    onFeature={() => handleFeature(trophy.id, false)}
                    onShare={() => handleShare(trophy)}
                    getTrophyIcon={getTrophyIcon}
                    getTrophyBg={getTrophyBg}
                    getPositionBadge={getPositionBadge}
                  />
                ))}
              </div>
            </div>
          )}

          {/* View More Button (for compact view) */}
          {compact && trophies.length > 5 && (
            <Button
              variant="ghost"
              className="w-full mt-3 text-muted-foreground"
              asChild
            >
              <Link href={`/${sport}/profile/trophies`}>
                View all {trophies.length} trophies
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Share Dialog */}
      <Dialog open={!!shareDialog} onOpenChange={() => setShareDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Share Trophy
            </DialogTitle>
            <DialogDescription>
              Share your achievement with friends and on social media
            </DialogDescription>
          </DialogHeader>
          
          {shareDialog && (
            <div className="space-y-4">
              <div
                className={cn(
                  "p-4 rounded-lg border",
                  getTrophyBg(shareDialog.trophyType)
                )}
              >
                <div className="flex items-center gap-3">
                  {getTrophyIcon(shareDialog.trophyType, "lg")}
                  <div>
                    <p className="font-medium">{shareDialog.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {shareDialog.description}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Share2 className="w-4 h-4" />
                <span>Shared {shareDialog.shareCount} times</span>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialog(null)}>
              Cancel
            </Button>
            <Button onClick={copyShareLink} className={cn("text-white", isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700")}>
              Copy Share Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Individual Trophy Card Component
interface TrophyCardProps {
  trophy: Trophy;
  isUpdating: boolean;
  isOwner: boolean;
  onFeature: () => void;
  onShare: () => void;
  getTrophyIcon: (type: string, size?: "sm" | "md" | "lg") => React.ReactNode;
  getTrophyBg: (type: string) => string;
  getPositionBadge: (position: number | null) => { label: string; color: string } | null;
}

function TrophyCard({
  trophy,
  isUpdating,
  isOwner,
  onFeature,
  onShare,
  getTrophyIcon,
  getTrophyBg,
  getPositionBadge,
}: TrophyCardProps) {
  const positionBadge = getPositionBadge(trophy.position);

  return (
    <div
      className={cn(
        "relative flex flex-col p-4 rounded-xl border transition-all",
        getTrophyBg(trophy.trophyType),
        trophy.isFeatured && "ring-2 ring-primary/20"
      )}
    >
      {/* Action Menu */}
      {isOwner && (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-60 hover:opacity-100"
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MoreVertical className="w-4 h-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onFeature}>
                <Pin className="w-4 h-4 mr-2" />
                {trophy.isFeatured ? "Unfeature" : "Feature"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Trophy Icon */}
      <div className="flex items-start gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-white/50 dark:bg-black/20 flex items-center justify-center flex-shrink-0">
          {getTrophyIcon(trophy.trophyType, "lg")}
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <p className="font-semibold text-foreground truncate">{trophy.title}</p>
          {trophy.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {trophy.description}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2">
          {positionBadge && (
            <Badge className={cn("text-xs", positionBadge.color)}>
              {positionBadge.label}
            </Badge>
          )}
          {trophy.isFeatured && (
            <Pin className="w-3 h-3 text-primary" />
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {new Date(trophy.earnedAt).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
          })}
        </div>
      </div>

      {/* Share Count */}
      {trophy.shareCount > 0 && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Share2 className="w-3 h-3" />
          {trophy.shareCount}
        </div>
      )}
    </div>
  );
}

// Missing import
import { ChevronRight } from "lucide-react";

export default TrophyCabinet;
