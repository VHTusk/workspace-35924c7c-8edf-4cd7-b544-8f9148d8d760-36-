"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Ban,
  VolumeX,
  UserX,
  MoreVertical,
  Loader2,
  Shield,
  Users,
  AlertTriangle,
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
    city?: string;
    state?: string;
    photoUrl?: string;
  };
}

interface BlockPlayerButtonProps {
  targetUserId: string;
  targetUserName: string;
  targetUserPhoto?: string;
  sport?: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  showIcon?: boolean;
  className?: string;
}

export function BlockPlayerButton({
  targetUserId,
  targetUserName,
  targetUserPhoto,
  sport = "cornhole",
  variant = "outline",
  size = "sm",
  showIcon = true,
  className,
}: BlockPlayerButtonProps) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockAsMute, setBlockAsMute] = useState(false);

  const isCornhole = sport === "cornhole";

  useEffect(() => {
    checkBlockStatus();
  }, [targetUserId]);

  const checkBlockStatus = async () => {
    try {
      const response = await fetch("/api/blocked-players");
      if (response.ok) {
        const data = await response.json();
        const block = data.blockedPlayers?.find(
          (b: BlockedPlayer) => b.blockedId === targetUserId
        );
        if (block) {
          setIsBlocked(true);
          setIsMuted(block.isMute);
        }
      }
    } catch (error) {
      console.error("Failed to check block status:", error);
    }
  };

  const handleBlock = async () => {
    if (!blockReason.trim()) {
      toast.error("Please provide a reason for blocking");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/blocked-players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockedId: targetUserId,
          reason: blockReason,
          isMute: blockAsMute,
        }),
      });

      if (response.ok) {
        setIsBlocked(true);
        setIsMuted(blockAsMute);
        setShowBlockDialog(false);
        toast.success(blockAsMute ? "Player muted successfully" : "Player blocked successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to block player");
      }
    } catch (error) {
      toast.error("Failed to block player");
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/blocked-players?blockedId=${targetUserId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setIsBlocked(false);
        setIsMuted(false);
        setShowUnblockDialog(false);
        toast.success("Player unblocked successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to unblock player");
      }
    } catch (error) {
      toast.error("Failed to unblock player");
    } finally {
      setLoading(false);
    }
  };

  if (isBlocked) {
    return (
      <>
        <Button
          variant="outline"
          size={size}
          className={cn("gap-2 text-amber-600 hover:text-amber-700", className)}
          onClick={() => setShowUnblockDialog(true)}
        >
          {showIcon && (isMuted ? <VolumeX className="w-4 h-4" /> : <Ban className="w-4 h-4" />)}
          {isMuted ? "Unmute" : "Unblock"}
        </Button>

        <Dialog open={showUnblockDialog} onOpenChange={setShowUnblockDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserX className="w-5 h-5" />
                {isMuted ? "Unmute" : "Unblock"} Player
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to {isMuted ? "unmute" : "unblock"} {targetUserName}?
                They will be able to interact with you again.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUnblockDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUnblock}
                disabled={loading}
                className="gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn("gap-2", className)}
        onClick={() => setShowBlockDialog(true)}
      >
        {showIcon && <Ban className="w-4 h-4" />}
        Block
      </Button>

      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Block Player
            </DialogTitle>
            <DialogDescription>
              Block {targetUserName} from interacting with you. They won&apos;t be able to:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* What happens when blocked */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4" />
                <span>Send you messages or friend requests</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>See your online status or profile</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Match with you in tournaments</span>
              </div>
            </div>

            {/* Mute option */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <VolumeX className="w-4 h-4" />
                  Mute Instead
                </Label>
                <p className="text-xs text-muted-foreground">
                  They can still see you but won&apos;t disturb you
                </p>
              </div>
              <Switch
                checked={blockAsMute}
                onCheckedChange={setBlockAsMute}
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (required)</Label>
              <Textarea
                id="reason"
                placeholder="Why are you blocking this player?"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlock}
              disabled={loading || !blockReason.trim()}
              className="gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {blockAsMute ? "Mute Player" : "Block Player"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
