"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Share2,
  Download,
  Copy,
  Check,
  Twitter,
  Facebook,
  Loader2,
  Trophy,
  Target,
  Flame,
  Zap,
  User,
  BarChart3,
  Swords,
  MessageCircle,
  Linkedin,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { SharePreviewDialog } from "@/components/share/share-preview-dialog";

interface PlayerCardShareProps {
  playerId: string;
  sport: string;
  className?: string;
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

type CardType = 'profile' | 'stats' | 'h2h' | 'tournament';

export function PlayerCardShare({
  playerId,
  sport,
  className,
  triggerClassName,
}: PlayerCardShareProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [activeCardType, setActiveCardType] = useState<CardType>('profile');
  const [copied, setCopied] = useState(false);

  const isCornhole = sport.toLowerCase() === 'cornhole';
  const primaryColorClass = isCornhole ? 'text-green-600' : 'text-teal-600';
  const primaryBgClass = isCornhole ? 'bg-green-50' : 'bg-teal-50';
  const primaryBorderClass = isCornhole ? 'border-green-200' : 'border-teal-200';

  // Fetch card data when dialog opens or card type changes
  useEffect(() => {
    if (open && playerId) {
      fetchCardData(activeCardType);
    }
  }, [open, activeCardType, playerId]);

  const fetchCardData = async (cardType: CardType) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: cardType });
      const response = await fetch(`/api/players/${playerId}/card?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setCardData(data.data);
      } else {
        toast({
          title: "Error",
          description: "Failed to load card data",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching card data:', error);
      toast({
        title: "Error",
        description: "Failed to load card data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCardUrl = (format: 'svg' | 'json' = 'svg') => {
    const params = new URLSearchParams({
      type: activeCardType,
      format,
    });
    return `/api/players/${playerId}/card?${params}`;
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(getCardUrl('svg'));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cardData?.player.name.replace(/\s+/g, '-')}-${activeCardType}-card.svg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Downloaded!",
        description: "Your player card has been downloaded",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Error",
        description: "Failed to download card",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}/api/players/${playerId}/card?type=${activeCardType}&format=svg`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share this link to show your player card",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy error:', error);
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleShareTwitter = () => {
    const shareUrl = `${window.location.origin}/api/players/${playerId}/card?type=${activeCardType}&format=svg`;
    const text = `Check out my ${isCornhole ? 'Cornhole' : 'Darts'} stats on VALORHIVE!\n\nTier: ${cardData?.player.tier}\nPoints: ${cardData?.player.visiblePoints}\nWin Rate: ${cardData?.player.winRate}%`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}&hashtags=${isCornhole ? 'Cornhole,VALORHIVE' : 'Darts,VALORHIVE'}`;
    window.open(twitterUrl, '_blank');
  };

  const handleShareFacebook = () => {
    const shareUrl = `${window.location.origin}/api/players/${playerId}/card?type=${activeCardType}&format=svg`;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank');
  };

  // WhatsApp Status sharing - primary option
  const handleShareWhatsAppStatus = () => {
    const shareUrl = `${window.location.origin}/api/players/${playerId}/card?type=${activeCardType}&format=svg`;
    const cardUrl = `${window.location.origin}/${sport}/players/${playerId}`;
    
    // Use the backend function format for consistent messaging
    const text = `🏆 *My ${isCornhole ? 'Cornhole' : 'Darts'} Stats on VALORHIVE*

👤 *${cardData?.player.name}*
🎖️ *${cardData?.player.tier} Tier*
📈 *Win Rate:* ${cardData?.player.winRate}%
🎮 *Tournaments:* ${cardData?.player.matchesPlayed}

*View my full profile:*
🔗 ${cardUrl}

Download the app and join the competition!

#VALORHIVE #${isCornhole ? 'Cornhole' : 'Darts'}Player #${cardData?.player.tier}Tier`;
    
    // WhatsApp share URL - works for both Status and direct message
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
    
    // Track share analytics
    trackShare('whatsapp_status');
  };

  // WhatsApp Direct Message sharing
  const handleShareWhatsApp = () => {
    const shareUrl = `${window.location.origin}/api/players/${playerId}/card?type=${activeCardType}&format=svg`;
    const text = `Check out my ${isCornhole ? 'Cornhole' : 'Darts'} stats on VALORHIVE!\n\nTier: ${cardData?.player.tier}\nPoints: ${cardData?.player.visiblePoints}\nWin Rate: ${cardData?.player.winRate}%\n\n${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
    
    // Track share analytics
    trackShare('whatsapp');
  };

  // Track share analytics
  const trackShare = async (platform: string) => {
    try {
      await fetch('/api/share/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          cardType: activeCardType,
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
          className={cn("gap-2", triggerClassName)}
        >
          <Share2 className="w-4 h-4" />
          Share My Card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Your Player Card
          </DialogTitle>
          <DialogDescription>
            Generate and share your stats card on social media
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Card Type Tabs */}
          <Tabs value={activeCardType} onValueChange={(v) => setActiveCardType(v as CardType)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="profile" className="gap-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="stats" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Stats</span>
              </TabsTrigger>
              <TabsTrigger value="h2h" className="gap-2">
                <Swords className="w-4 h-4" />
                <span className="hidden sm:inline">H2H</span>
              </TabsTrigger>
              <TabsTrigger value="tournament" className="gap-2">
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Tournament</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Card Preview */}
          <div className="flex justify-center">
            {loading ? (
              <div className="w-full max-w-md h-64 flex items-center justify-center bg-gray-100 rounded-xl">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : cardData ? (
              <CardPreview 
                data={cardData} 
                cardType={activeCardType}
                isCornhole={isCornhole}
              />
            ) : (
              <div className="w-full max-w-md h-64 flex items-center justify-center bg-gray-100 rounded-xl text-gray-500">
                No data available
              </div>
            )}
          </div>

          {/* Quick Stats */}
          {cardData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={cn("p-3 rounded-lg border", primaryBgClass, primaryBorderClass)}>
                <div className="flex items-center gap-2 mb-1">
                  <Target className={cn("w-4 h-4", primaryColorClass)} />
                  <span className="text-xs text-gray-600">Points</span>
                </div>
                <p className="text-xl font-bold">{cardData.player.visiblePoints.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg border bg-gray-50 border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-gray-600">Win Rate</span>
                </div>
                <p className="text-xl font-bold">{cardData.player.winRate}%</p>
              </div>
              <div className="p-3 rounded-lg border bg-gray-50 border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-gray-600">Matches</span>
                </div>
                <p className="text-xl font-bold">{cardData.player.matchesPlayed}</p>
              </div>
              <div className="p-3 rounded-lg border bg-gray-50 border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-gray-600">Wins</span>
                </div>
                <p className="text-xl font-bold">{cardData.player.wins}</p>
              </div>
            </div>
          )}

          {/* Share Actions */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-gray-700">Share Options</h4>
            
            {/* WhatsApp Status - Primary Option */}
            <div className="p-4 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
                  <WhatsAppIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Share to WhatsApp Status</p>
                  <p className="text-xs text-gray-500">Share your card as a status update</p>
                </div>
              </div>
              <Button
                className="w-full gap-2 bg-[#25D366] hover:bg-[#22c55e] text-white"
                onClick={handleShareWhatsAppStatus}
              >
                <Eye className="w-4 h-4" />
                Share to WhatsApp Status
              </Button>
            </div>
            
            {/* Social Media Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-[#25D366]/5 border-[#25D366]/30 hover:bg-[#25D366]/10"
                onClick={handleShareWhatsApp}
              >
                <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleShareTwitter}
              >
                <Twitter className="w-4 h-4" />
                Twitter
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleShareFacebook}
              >
                <Facebook className="w-4 h-4" />
                Facebook
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const shareUrl = `${window.location.origin}/api/players/${playerId}/card?type=${activeCardType}&format=svg`;
                  const text = `Check out my ${isCornhole ? 'Cornhole' : 'Darts'} stats on VALORHIVE!`;
                  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
                  window.open(linkedinUrl, '_blank');
                  trackShare('linkedin');
                }}
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </Button>
            </div>

            {/* Preview Dialog */}
            <SharePreviewDialog
              playerId={playerId}
              sport={sport}
              cardData={cardData}
              cardType={activeCardType}
            />

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                className={cn("gap-2", isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700")}
                onClick={handleDownload}
              >
                <Download className="w-4 h-4" />
                Download Card
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleCopyLink}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Card Preview Component
function CardPreview({ 
  data, 
  cardType,
  isCornhole 
}: { 
  data: CardData; 
  cardType: CardType;
  isCornhole: boolean;
}) {
  const player = data.player;
  const theme = data.theme;
  const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  // H2H Card Preview
  if (cardType === 'h2h' && data.h2h) {
    return (
      <Card className="w-full max-w-md bg-gradient-to-br from-gray-900 to-gray-800 text-white overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Swords className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">VALORHIVE H2H</span>
          </div>

          <div className="grid grid-cols-3 items-center text-center gap-4">
            {/* Player A */}
            <div className="space-y-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-lg font-bold border-2 border-emerald-400">
                {initials}
              </div>
              <p className="font-bold text-sm truncate">{player.name}</p>
              <Badge className="text-xs" style={{ backgroundColor: player.tierColor }}>
                {player.tier}
              </Badge>
              <p className="text-3xl font-bold text-emerald-400">{data.h2h.record.playerWins}</p>
              <p className="text-xs text-gray-400">wins</p>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-lg font-bold">VS</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">{data.h2h.record.totalMatches} matches</p>
            </div>

            {/* Player B */}
            <div className="space-y-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center text-white text-lg font-bold border-2 border-red-400">
                {data.h2h.opponent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <p className="font-bold text-sm truncate">{data.h2h.opponent.name}</p>
              <Badge className="text-xs" style={{ backgroundColor: data.h2h.opponent.tierColor }}>
                {data.h2h.opponent.tier}
              </Badge>
              <p className="text-3xl font-bold text-red-400">{data.h2h.record.opponentWins}</p>
              <p className="text-xs text-gray-400">wins</p>
            </div>
          </div>

          <div className="mt-4 text-center">
            <Badge variant="outline" className="border-white/20 text-gray-400">
              {player.sport}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Tournament Card Preview
  if (cardType === 'tournament' && data.tournament) {
    const position = data.tournament.finishPosition;
    const suffix = position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th';
    
    return (
      <Card 
        className="w-full max-w-md text-white overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
      >
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-white/70">TOURNAMENT RESULT</p>
            <p className="text-xl font-bold">{data.tournament.tournamentName}</p>
            <p className="text-sm text-white/60">{data.tournament.scope}</p>
            
            <div className="py-6">
              <div 
                className="w-24 h-24 mx-auto rounded-full flex items-center justify-center border-4"
                style={{ 
                  borderColor: position === 1 ? '#FFD700' : position === 2 ? '#C0C0C0' : position === 3 ? '#CD7F32' : '#ffffff'
                }}
              >
                <div className="text-center">
                  <p className="text-3xl font-bold">{position}{suffix}</p>
                  <p className="text-xs text-white/60">place</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                {initials}
              </div>
              <div className="text-left">
                <p className="font-bold">{player.name}</p>
                <Badge className="text-xs" style={{ backgroundColor: player.tierColor }}>
                  {player.tier}
                </Badge>
              </div>
            </div>

            {data.tournament.bonusPoints > 0 && (
              <p className="text-lg font-bold" style={{ color: theme.accentColor }}>
                +{data.tournament.bonusPoints} Bonus Points
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Profile / Stats Card Preview
  return (
    <Card 
      className="w-full max-w-md text-white overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-lg font-bold">VALORHIVE</p>
            <p className="text-sm text-white/70">{player.sport}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-2"
            style={{ borderColor: theme.accentColor, backgroundColor: 'rgba(255,255,255,0.2)' }}
          >
            {initials}
          </div>
          <div>
            <p className="text-xl font-bold">{player.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge style={{ backgroundColor: player.tierColor }}>
                {player.tier}
              </Badge>
              {player.city && player.state && (
                <span className="text-sm text-white/70">{player.city}, {player.state}</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{player.visiblePoints.toLocaleString()}</p>
            <p className="text-xs text-white/70">POINTS</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{player.winRate}%</p>
            <p className="text-xs text-white/70">WIN RATE</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{player.matchesPlayed}</p>
            <p className="text-xs text-white/70">MATCHES</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/20">
          <div>
            <p className="text-lg font-bold text-emerald-300">{player.wins}W</p>
            <p className="text-xs text-white/70">Wins</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-300">{player.losses}L</p>
            <p className="text-xs text-white/70">Losses</p>
          </div>
        </div>

        {player.currentStreak > 0 && (
          <div className="mt-4 p-2 bg-orange-500/20 rounded-lg text-center">
            <p className="text-sm font-bold text-orange-300">🔥 {player.currentStreak} Win Streak!</p>
          </div>
        )}

        <p className="text-center text-xs text-white/50 mt-4">valorhive.com</p>
      </CardContent>
    </Card>
  );
}

// WhatsApp Icon Component
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export default PlayerCardShare;
