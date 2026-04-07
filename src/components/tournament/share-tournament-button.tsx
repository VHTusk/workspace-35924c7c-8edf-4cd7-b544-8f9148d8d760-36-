'use client';

/**
 * VALORHIVE v3.42.0 - Share Tournament Button
 * Enhanced share functionality with social platforms and short URLs
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Share2, Copy, Check, MessageCircle, Twitter, Facebook, Linkedin } from 'lucide-react';

interface ShareTournamentButtonProps {
  tournamentId: string;
  tournamentName: string;
  sport: string;
  location: string;
  startDate: string;
}

export function ShareTournamentButton({
  tournamentId,
  tournamentName,
  sport,
  location,
  startDate,
}: ShareTournamentButtonProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Generate share URL
  const getShareUrl = async () => {
    if (shareUrl) return shareUrl;
    
    try {
      // Try to get or create short URL
      const res = await fetch(`/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'tournament',
          entityId: tournamentId,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        const url = `${window.location.origin}/s/${data.shortCode}`;
        setShareUrl(url);
        return url;
      }
    } catch {
      // Fallback to direct URL
    }
    
    const fallbackUrl = `${window.location.origin}/tournaments/${tournamentId}`;
    setShareUrl(fallbackUrl);
    return fallbackUrl;
  };

  const shareText = `🏆 ${tournamentName}\n📍 ${location}\n📅 ${new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}\n\nJoin the ${sport.toLowerCase()} tournament on VALORHIVE!`;

  const handleCopyLink = async () => {
    const url = await getShareUrl();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = async () => {
    const url = await getShareUrl();
    const text = encodeURIComponent(`${shareText}\n\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleShareTwitter = async () => {
    const url = await getShareUrl();
    const text = encodeURIComponent(`Check out ${tournamentName} - ${sport} tournament in ${location}!`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`, '_blank');
  };

  const handleShareFacebook = async () => {
    const url = await getShareUrl();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  };

  const handleShareLinkedIn = async () => {
    const url = await getShareUrl();
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
  };

  const handleNativeShare = async () => {
    const url = await getShareUrl();
    
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: tournamentName,
          text: `Check out ${tournamentName} - ${sport} tournament in ${location}!`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  // Use native share on mobile if available
  if (typeof window !== 'undefined' && typeof navigator.share === 'function' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    return (
      <Button variant="outline" size="sm" onClick={handleNativeShare}>
        <Share2 className="w-4 h-4 mr-2" />
        Share
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleShareWhatsApp}>
          <MessageCircle className="w-4 h-4 mr-2 text-green-600" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareTwitter}>
          <Twitter className="w-4 h-4 mr-2 text-blue-400" />
          Twitter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareFacebook}>
          <Facebook className="w-4 h-4 mr-2 text-blue-600" />
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareLinkedIn}>
          <Linkedin className="w-4 h-4 mr-2 text-blue-700" />
          LinkedIn
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2 text-green-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
