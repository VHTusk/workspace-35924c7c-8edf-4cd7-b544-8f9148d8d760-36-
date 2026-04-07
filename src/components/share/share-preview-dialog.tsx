"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Copy,
  Check,
  MessageCircle,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SharePreviewDialogProps {
  playerId: string;
  sport: string;
  cardData: CardData | null;
  cardType: string;
  triggerClassName?: string;
}

interface CardData {
  player: {
    id: string;
    name: string;
    city?: string;
    state?: string;
    sport: string;
    tier: string;
    tierColor: string;
    visiblePoints: number;
    hiddenElo: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    tournamentsWon: number;
    currentStreak: number;
    bestStreak: number;
    highestElo: number;
    organization?: string;
  };
  theme: {
    primaryColor: string;
    gradientFrom: string;
    gradientTo: string;
    accentColor: string;
  };
  h2h?: {
    opponent: {
      id: string;
      name: string;
      tier: string;
      tierColor: string;
      points: number;
    };
    record: {
      playerWins: number;
      opponentWins: number;
      totalMatches: number;
    };
  } | null;
  tournament?: {
    tournamentName: string;
    scope: string;
    finishPosition: number;
    bonusPoints: number;
    date: string;
  } | null;
  achievements: Array<{
    title: string;
    description: string;
    earnedAt: string;
  }>;
}

// WhatsApp Icon Component
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export function SharePreviewDialog({
  playerId,
  sport,
  cardData,
  cardType,
  triggerClassName,
}: SharePreviewDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isCornhole = sport.toLowerCase() === 'cornhole';

  // Generate the share message
  const getShareMessage = () => {
    if (!cardData) return '';
    
    const cardUrl = `${window.location.origin}/${sport}/players/${playerId}`;
    const sportName = isCornhole ? 'Cornhole' : 'Darts';
    
    if (cardType === 'h2h' && cardData.h2h) {
      return `⚔️ *H2H Battle on VALORHIVE*

👤 *${cardData.player.name}* vs ${cardData.h2h.opponent.name}

*Record:* ${cardData.h2h.record.playerWins}W - ${cardData.h2h.record.opponentWins}L
*Total Matches:* ${cardData.h2h.record.totalMatches}

🔗 ${cardUrl}

#VALORHIVE #${sportName}H2H`;
    }
    
    if (cardType === 'tournament' && cardData.tournament) {
      const position = cardData.tournament.finishPosition;
      const suffix = position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th';
      
      return `🏆 *Tournament Result on VALORHIVE*

🏅 *${position}${suffix} Place*
📋 *${cardData.tournament.tournamentName}*

👤 *${cardData.player.name}*
🎖️ *${cardData.player.tier} Tier*

${cardData.tournament.bonusPoints > 0 ? `✨ *+${cardData.tournament.bonusPoints} Bonus Points*\n` : ''}🔗 ${cardUrl}

#VALORHIVE #${sportName}Tournament`;
    }
    
    // Default profile/stats message
    return `🏆 *My ${sportName} Stats on VALORHIVE*

👤 *${cardData.player.name}*
🎖️ *${cardData.player.tier} Tier*
📈 *Win Rate:* ${cardData.player.winRate}%
🎮 *Matches:* ${cardData.player.matchesPlayed}
📊 *Points:* ${cardData.player.visiblePoints.toLocaleString()}

*View my full profile:*
🔗 ${cardUrl}

Download the app and join the competition!

#VALORHIVE #${sportName}Player #${cardData.player.tier}Tier`;
  };

  const shareMessage = getShareMessage();

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Share message copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy error:', error);
      toast({
        title: "Error",
        description: "Failed to copy text",
        variant: "destructive",
      });
    }
  };

  const handleShareWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(whatsappUrl, '_blank');
    
    // Track share analytics
    trackShare('whatsapp_preview');
    
    toast({
      title: "Opening WhatsApp",
      description: "Share your player card with your contacts",
    });
  };

  const trackShare = async (platform: string) => {
    try {
      await fetch('/api/share/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          cardType,
          platform,
          sport,
        }),
      });
    } catch (error) {
      console.error('Failed to track share:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", triggerClassName)}
        >
          <Eye className="w-4 h-4" />
          Preview Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Preview Your Share
          </DialogTitle>
          <DialogDescription>
            See how your player card will appear when shared
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Card Image Preview */}
          {cardData && (
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xl font-bold border-2 border-emerald-400">
                {cardData.player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
            </div>
          )}

          {/* Share Message Preview */}
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
                <span className="text-sm font-medium text-gray-700">WhatsApp Preview</span>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200 text-sm whitespace-pre-wrap font-mono text-gray-800 max-h-64 overflow-y-auto">
                {shareMessage}
              </div>
            </CardContent>
          </Card>

          {/* Player Stats Summary */}
          {cardData && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-gray-50">
                <p className="text-lg font-bold text-gray-900">{cardData.player.visiblePoints.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Points</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-50">
                <p className="text-lg font-bold text-gray-900">{cardData.player.winRate}%</p>
                <p className="text-xs text-gray-500">Win Rate</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-50">
                <p className="text-lg font-bold text-gray-900">{cardData.player.tier}</p>
                <p className="text-xs text-gray-500">Tier</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              className="w-full gap-2 bg-[#25D366] hover:bg-[#22c55e] text-white"
              onClick={handleShareWhatsApp}
            >
              <WhatsAppIcon className="w-5 h-5" />
              Share to WhatsApp
            </Button>
            
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleCopyText}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Text
                </>
              )}
            </Button>
          </div>

          {/* Tip */}
          <p className="text-xs text-gray-500 text-center">
            Tip: After opening WhatsApp, you can post this to your Status or send to specific contacts
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SharePreviewDialog;
