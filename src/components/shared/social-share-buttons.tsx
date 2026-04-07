'use client';

/**
 * Social Share Buttons Component for VALORHIVE
 * Enables sharing match results, achievements, tournament wins on social media
 */

import { useState, useCallback } from 'react';
import { Share2, Copy, Check, Twitter, MessageCircle, Facebook, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface SocialShareButtonsProps {
  shareUrl: string;
  title: string;
  description?: string;
  imageUrl?: string;
  onShare?: (platform: string) => void;
  variant?: 'default' | 'compact' | 'icons';
}

export function SocialShareButtons({
  shareUrl,
  title,
  description = '',
  imageUrl,
  onShare,
  variant = 'default',
}: SocialShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description);

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodedTitle}%0A%0A${encodedDesc}%0A%0A${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
  };

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
      onShare?.('clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  }, [shareUrl, onShare]);

  const handleShare = useCallback((platform: string) => {
    const url = shareLinks[platform as keyof typeof shareLinks];
    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
      onShare?.(platform);
    }
  }, [shareLinks, onShare]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
        onShare?.('native');
      } catch {
        // User cancelled or error
      }
    }
  }, [title, description, shareUrl, onShare]);

  // Check if native share is available (mobile)
  const hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  if (variant === 'icons') {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleShare('whatsapp')}
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleShare('twitter')}
          className="text-sky-500 hover:text-sky-600 hover:bg-sky-50"
        >
          <Twitter className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopyLink}
          className="text-gray-600 hover:text-gray-700"
        >
          {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
        </Button>
        {hasNativeShare && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNativeShare}
            className="text-gray-600 hover:text-gray-700"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
            <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
            WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('twitter')}>
            <Twitter className="mr-2 h-4 w-4 text-sky-500" />
            Twitter
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('facebook')}>
            <Facebook className="mr-2 h-4 w-4 text-blue-600" />
            Facebook
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('linkedin')}>
            <Linkedin className="mr-2 h-4 w-4 text-blue-700" />
            LinkedIn
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink}>
            {copied ? (
              <Check className="mr-2 h-4 w-4 text-green-500" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copy Link
          </DropdownMenuItem>
          {hasNativeShare && (
            <DropdownMenuItem onClick={handleNativeShare}>
              <Share2 className="mr-2 h-4 w-4" />
              More Options
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('whatsapp')}
        className="gap-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('twitter')}
        className="gap-2 bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
      >
        <Twitter className="h-4 w-4" />
        Twitter
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('facebook')}
        className="gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
      >
        <Facebook className="h-4 w-4" />
        Facebook
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyLink}
        className="gap-2"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy Link
          </>
        )}
      </Button>
      {hasNativeShare && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleNativeShare}
          className="gap-2"
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      )}
    </div>
  );
}

/**
 * Match Result Share Card
 */
interface MatchResultShareProps {
  sport: 'CORNHOLE' | 'DARTS';
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
  tournamentName?: string;
  pointsEarned: number;
  shareUrl: string;
  onShare?: (platform: string) => void;
}

export function MatchResultShareCard({
  sport,
  winnerName,
  loserName,
  winnerScore,
  loserScore,
  tournamentName,
  pointsEarned,
  shareUrl,
  onShare,
}: MatchResultShareProps) {
  const title = `🏆 Victory! ${winnerName} def. ${loserName} ${winnerScore}-${loserScore}`;
  const description = tournamentName
    ? `${sport} match result from ${tournamentName}. +${pointsEarned} points earned!`
    : `${sport} match result. +${pointsEarned} points earned!`;

  return (
    <div className="rounded-lg border bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:from-amber-950/20 dark:to-orange-950/20">
      <div className="mb-4 text-center">
        <div className="text-2xl font-bold text-amber-600">🏆 Victory!</div>
        <div className="mt-2 text-lg">
          <span className="font-semibold">{winnerName}</span>
          <span className="mx-2 text-muted-foreground">def.</span>
          <span>{loserName}</span>
        </div>
        <div className="mt-2 text-3xl font-bold text-amber-500">
          {winnerScore} - {loserScore}
        </div>
        {tournamentName && (
          <div className="mt-2 text-sm text-muted-foreground">
            📍 {tournamentName}
          </div>
        )}
        <div className="mt-2 text-sm font-medium text-green-600">
          +{pointsEarned} points earned
        </div>
      </div>
      <SocialShareButtons
        shareUrl={shareUrl}
        title={title}
        description={description}
        onShare={onShare}
        variant="default"
      />
    </div>
  );
}

/**
 * Tournament Win Share Card
 */
interface TournamentWinShareProps {
  sport: 'CORNHOLE' | 'DARTS';
  playerName: string;
  tournamentName: string;
  rank: number;
  prizePool?: number;
  shareUrl: string;
  onShare?: (platform: string) => void;
}

export function TournamentWinShareCard({
  sport,
  playerName,
  tournamentName,
  rank,
  prizePool,
  shareUrl,
  onShare,
}: TournamentWinShareProps) {
  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🎖️';
  const title = rank === 1
    ? `🏆 Champion! ${playerName} won ${tournamentName}!`
    : `${rankEmoji} #${rank} Place! ${playerName} at ${tournamentName}`;

  const description = prizePool
    ? `${sport} tournament result. Prize: ₹${prizePool.toLocaleString()}`
    : `${sport} tournament result.`;

  return (
    <div className="rounded-lg border bg-gradient-to-br from-yellow-50 to-amber-50 p-4 dark:from-yellow-950/20 dark:to-amber-950/20">
      <div className="mb-4 text-center">
        <div className="text-4xl">{rankEmoji}</div>
        <div className="mt-2 text-xl font-bold text-amber-600">
          {rank === 1 ? 'Champion!' : rank <= 3 ? 'Podium Finish!' : `#${rank} Place`}
        </div>
        <div className="mt-2 text-lg font-semibold">{playerName}</div>
        <div className="text-sm text-muted-foreground">{tournamentName}</div>
        {prizePool && (
          <div className="mt-2 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
            💰 ₹{prizePool.toLocaleString()} Prize
          </div>
        )}
      </div>
      <SocialShareButtons
        shareUrl={shareUrl}
        title={title}
        description={description}
        onShare={onShare}
        variant="default"
      />
    </div>
  );
}

/**
 * Achievement Share Card
 */
interface AchievementShareProps {
  sport: 'CORNHOLE' | 'DARTS';
  playerName: string;
  achievementName: string;
  achievementDescription: string;
  tier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  shareUrl: string;
  onShare?: (platform: string) => void;
}

export function AchievementShareCard({
  playerName,
  achievementName,
  achievementDescription,
  tier,
  shareUrl,
  onShare,
}: AchievementShareProps) {
  const tierColors = {
    BRONZE: 'from-orange-100 to-amber-100 text-orange-700 border-orange-200',
    SILVER: 'from-gray-100 to-slate-100 text-gray-700 border-gray-200',
    GOLD: 'from-yellow-100 to-amber-100 text-yellow-700 border-yellow-200',
    PLATINUM: 'from-slate-100 to-cyan-100 text-cyan-700 border-cyan-200',
  };

  const tierStyle = tier ? tierColors[tier] : tierColors.GOLD;

  const title = `🏅 Achievement Unlocked: ${achievementName}`;
  const description = `${playerName} earned "${achievementName}" badge on VALORHIVE!`;

  return (
    <div className={`rounded-lg border bg-gradient-to-br p-4 ${tierStyle}`}>
      <div className="mb-4 text-center">
        <div className="text-4xl">🏅</div>
        <div className="mt-2 text-lg font-bold">Achievement Unlocked!</div>
        <div className="mt-2 text-xl font-semibold">{achievementName}</div>
        {tier && (
          <div className="mt-1 text-xs font-medium uppercase opacity-75">
            {tier} Tier
          </div>
        )}
        <div className="mt-2 text-sm opacity-80">{achievementDescription}</div>
        <div className="mt-2 text-sm font-medium">{playerName}</div>
      </div>
      <SocialShareButtons
        shareUrl={shareUrl}
        title={title}
        description={description}
        onShare={onShare}
        variant="compact"
      />
    </div>
  );
}
