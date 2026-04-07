"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, Swords, Share2, Copy, Check, Twitter, Facebook
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface H2HShareCardProps {
  playerA: {
    id: string;
    name: string;
    points: number;
    elo: number;
    tier: string;
  };
  playerB: {
    id: string;
    name: string;
    points: number;
    elo: number;
    tier: string;
  };
  record: {
    playerAWins: number;
    playerBWins: number;
    totalMatches: number;
  };
  sport: string;
  className?: string;
}

export function H2HShareCard({
  playerA,
  playerB,
  record,
  sport,
  className
}: H2HShareCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/h2h?player1=${playerA.id}&player2=${playerB.id}&sport=${sport}`
    : '';

  const shareText = `Check out this head-to-head matchup: ${playerA.name} vs ${playerB.name}!\n\n${playerA.name}: ${record.playerAWins} wins\n${playerB.name}: ${record.playerBWins} wins\n\nTotal matches: ${record.totalMatches}`;

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      DIAMOND: "text-cyan-500 bg-cyan-50",
      PLATINUM: "text-slate-500 bg-slate-50",
      GOLD: "text-amber-500 bg-amber-50",
      SILVER: "text-gray-400 bg-gray-50",
      BRONZE: "text-orange-600 bg-orange-50",
    };
    return colors[tier] || "text-gray-500 bg-gray-50";
  };

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share this link to compare these players",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy error:", error);
    }
  };

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}&hashtags=${sport === 'CORNHOLE' ? 'Cornhole,VALORHIVE' : 'Darts,VALORHIVE'}`;
    window.open(twitterUrl, '_blank');
  };

  const shareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank');
  };

  return (
    <Card className={cn("bg-gradient-to-br from-gray-900 to-gray-800 text-white overflow-hidden", className)}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-medium text-gray-300">VALORHIVE H2H</span>
        </div>

        {/* Players */}
        <div className="grid grid-cols-3 items-center text-center gap-4 mb-6">
          {/* Player A */}
          <div className="space-y-2">
            <Avatar className="w-16 h-16 mx-auto border-2 border-emerald-400">
              <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-lg">
                {playerA.name.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <p className="font-bold text-sm truncate">{playerA.name}</p>
            <Badge className={cn("text-xs", getTierColor(playerA.tier))}>
              {playerA.tier}
            </Badge>
            <p className="text-4xl font-bold text-emerald-400">{record.playerAWins}</p>
            <p className="text-xs text-gray-400">wins</p>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <Swords className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-lg font-bold mt-2">VS</p>
            <p className="text-xs text-gray-400 mt-1">{record.totalMatches} matches</p>
          </div>

          {/* Player B */}
          <div className="space-y-2">
            <Avatar className="w-16 h-16 mx-auto border-2 border-red-400">
              <AvatarFallback className="bg-gradient-to-br from-rose-400 to-red-500 text-white text-lg">
                {playerB.name.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <p className="font-bold text-sm truncate">{playerB.name}</p>
            <Badge className={cn("text-xs", getTierColor(playerB.tier))}>
              {playerB.tier}
            </Badge>
            <p className="text-4xl font-bold text-red-400">{record.playerBWins}</p>
            <p className="text-xs text-gray-400">wins</p>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={copyShareUrl}
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Copied" : "Copy Link"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={shareToTwitter}
          >
            <Twitter className="w-4 h-4 mr-2" />
            Tweet
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={shareToFacebook}
          >
            <Facebook className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>

        {/* Sport Badge */}
        <div className="mt-4 text-center">
          <Badge variant="outline" className="border-white/20 text-gray-400">
            {sport}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
