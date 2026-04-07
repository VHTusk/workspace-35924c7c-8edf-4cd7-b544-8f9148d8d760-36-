"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dispatchFollowChange } from "@/hooks/use-follow-count";

interface FollowButtonProps {
  targetType: 'user' | 'org';
  targetId: string;
  sport: string;
  showText?: boolean;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
}

export default function FollowButton({
  targetType,
  targetId,
  sport,
  showText = true,
  size = 'default',
  variant = 'outline'
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    checkFollowStatus();
  }, [targetId, targetType, sport]);

  const checkFollowStatus = async () => {
    try {
      // Check if current user is following this target
      const response = await fetch(`/api/follow/check?targetType=${targetType}&targetId=${targetId}&sport=${sport}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsFollowing(data.isFollowing);
      }
    } catch (error) {
      console.error('Failed to check follow status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    setActionLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const response = await fetch(
          `/api/follow?targetType=${targetType}&targetId=${targetId}&sport=${sport}`,
          {
            method: 'DELETE',
            credentials: 'include',
          }
        );
        if (response.ok) {
          setIsFollowing(false);
          // Dispatch event to refresh sidebar counts
          dispatchFollowChange({ type: 'unfollow', targetType: targetType === 'user' ? 'user' : 'org', targetId });
        }
      } else {
        // Follow
        const response = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            targetType,
            targetId,
            sport
          })
        });
        if (response.ok) {
          setIsFollowing(true);
          // Dispatch event to refresh sidebar counts
          dispatchFollowChange({ type: 'follow', targetType: targetType === 'user' ? 'user' : 'org', targetId });
        }
      }
    } catch (error) {
      console.error('Failed to follow/unfollow:', error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant={isFollowing ? 'default' : variant}
      size={size}
      onClick={handleFollow}
      disabled={actionLoading}
      className={cn(
        "gap-2",
        isFollowing && "bg-emerald-600 hover:bg-emerald-700"
      )}
    >
      {actionLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        <UserCheck className="w-4 h-4" />
      ) : (
        <UserPlus className="w-4 h-4" />
      )}
      {showText && (isFollowing ? 'Following' : 'Follow')}
    </Button>
  );
}
