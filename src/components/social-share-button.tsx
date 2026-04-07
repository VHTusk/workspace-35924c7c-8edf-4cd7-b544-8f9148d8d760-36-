"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Share2,
  Copy,
  Facebook,
  Twitter,
  Linkedin,
  MessageCircle,
  Mail,
  Link as LinkIcon,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SocialShareButtonProps {
  tournamentId: string;
  tournamentName: string;
  description?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
}

export function SocialShareButton({
  tournamentId,
  tournamentName,
  description,
  variant = "outline",
  size = "default",
  className,
  showLabel = true,
}: SocialShareButtonProps) {
  const params = useParams();
  const sport = params?.sport as string || "cornhole";
  const isCornhole = sport === "cornhole";
  const primaryClass = isCornhole
    ? "text-green-600 hover:text-green-700"
    : "text-teal-600 hover:text-teal-700";

  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  // Get the share URL
  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/${sport}/tournaments/${tournamentId}`
    : '';
  
  const shareText = `Check out ${tournamentName} on VALORHIVE! 🏆`;
  const shareTitle = tournamentName;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      setOpen(true);
    }
  };

  const shareLinks = [
    {
      name: "WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
      color: "text-green-600 hover:bg-green-50",
    },
    {
      name: "Facebook",
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      color: "text-blue-600 hover:bg-blue-50",
    },
    {
      name: "Twitter/X",
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      color: "text-sky-500 hover:bg-sky-50",
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      color: "text-blue-700 hover:bg-blue-50",
    },
    {
      name: "Email",
      icon: Mail,
      href: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
      color: "text-gray-600 hover:bg-gray-50",
    },
  ];

  // If Web Share API is available, use it directly
  const canNativeShare = typeof navigator !== 'undefined' && navigator.share;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={cn(primaryClass, className)}
          >
            <Share2 className="h-4 w-4" />
            {showLabel && <span className="ml-2">Share</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-1">Share Tournament</h4>
              <p className="text-sm text-muted-foreground">
                Share {tournamentName} with others
              </p>
            </div>

            {/* Copy Link */}
            <div className="flex items-center gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Social Links */}
            <div className="grid grid-cols-5 gap-2">
              {shareLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                    link.color
                  )}
                >
                  <link.icon className="h-5 w-5" />
                  <span className="text-xs">{link.name}</span>
                </a>
              ))}
            </div>

            {/* Native Share (if available on mobile) */}
            {canNativeShare && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleNativeShare}
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                More Options
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

/**
 * Quick share button that uses native share API on mobile
 */
export function QuickShareButton({
  tournamentId,
  tournamentName,
  className,
}: {
  tournamentId: string;
  tournamentName: string;
  className?: string;
}) {
  const params = useParams();
  const sport = params?.sport as string || "cornhole";
  const isCornhole = sport === "cornhole";

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/${sport}/tournaments/${tournamentId}`;
    const shareText = `Check out ${tournamentName} on VALORHIVE! 🏆`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: tournamentName,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleShare}
      className={cn(
        isCornhole ? "text-green-600 hover:bg-green-50" : "text-teal-600 hover:bg-teal-50",
        className
      )}
    >
      <Share2 className="h-4 w-4" />
    </Button>
  );
}
