'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Trophy, Medal, Share2, X, ChevronLeft, ChevronRight, 
  Crown, Star, Target, Sparkles, Loader2, Twitter, MessageCircle, Facebook
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface AchievementShowcase {
  id: string;
  slotIndex: number;
  title: string;
  description: string;
  iconUrl?: string;
  earnedAt: Date;
  shareCount: number;
  isFeatured: boolean;
}

interface Title {
  id: string;
  title: string;
  description?: string;
  scope: string;
  scopeValue?: string;
  createdAt: Date;
}

interface TournamentWin {
  id: string;
  rank: number;
  tournament: {
    name: string;
    scope: string;
    createdAt: Date;
  };
}

interface ShowcaseData {
  showcase: AchievementShowcase[];
  allAchievements: any[];
  titles: Title[];
  tournamentWins: TournamentWin[];
  stats: {
    totalAchievements: number;
    totalWins: number;
    totalPodiums: number;
    titlesHeld: number;
  };
}

const SCOPE_ICONS: Record<string, string> = {
  CITY: '🏙️',
  DISTRICT: '🗺️',
  STATE: '🏛️',
  NATIONAL: '🇮🇳',
};

const SCOPE_COLORS: Record<string, string> = {
  CITY: 'from-blue-400 to-blue-600',
  DISTRICT: 'from-purple-400 to-purple-600',
  STATE: 'from-orange-400 to-orange-600',
  NATIONAL: 'from-yellow-400 to-yellow-600',
};

export function TrophyCabinet({ userId }: { userId?: string }) {
  const params = useParams();
  const sport = params.sport as string;
  const theme = sport === 'cornhole' ? 'green' : 'teal';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementShowcase | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  useEffect(() => {
    fetchShowcase();
  }, [sport, userId]);

  const fetchShowcase = async () => {
    setLoading(true);
    try {
      const url = userId
        ? `/api/player/achievements/showcase?userId=${userId}`
        : '/api/player/achievements/showcase';
      const res = await fetch(url);
      const result = await res.json();
      if (res.ok && result.success) {
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch showcase:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (platform: 'twitter' | 'whatsapp' | 'facebook') => {
    if (!selectedAchievement) return;
    
    setSharing(true);
    try {
      const res = await fetch('/api/player/achievements/showcase', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showcaseId: selectedAchievement.id, platform }),
      });

      if (res.ok) {
        const result = await res.json();
        window.open(result.shareUrl, '_blank');
        fetchShowcase();
      }
    } catch (error) {
      console.error('Failed to share:', error);
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Trophy Cabinet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50">
          <CardContent className="p-4 text-center">
            <Crown className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
            <div className="text-2xl font-bold">{data.stats.totalWins}</div>
            <div className="text-xs text-gray-500">Tournament Wins</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
          <CardContent className="p-4 text-center">
            <Medal className="h-6 w-6 mx-auto mb-2 text-purple-500" />
            <div className="text-2xl font-bold">{data.stats.totalPodiums}</div>
            <div className="text-xs text-gray-500">Podium Finishes</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardContent className="p-4 text-center">
            <Star className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <div className="text-2xl font-bold">{data.stats.totalAchievements}</div>
            <div className="text-xs text-gray-500">Achievements</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-4 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold">{data.stats.titlesHeld}</div>
            <div className="text-xs text-gray-500">Titles Held</div>
          </CardContent>
        </Card>
      </div>

      {/* Showcase Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Featured Achievements
            </span>
            <span className="text-sm font-normal text-gray-500">
              {data.showcase.length}/6 slots
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map(slotIndex => {
              const achievement = data.showcase.find(a => a.slotIndex === slotIndex);
              
              if (!achievement) {
                return (
                  <div
                    key={slotIndex}
                    className="aspect-square rounded-xl border-2 border-dashed border-gray-200 
                               flex flex-col items-center justify-center text-gray-400 
                               hover:border-gray-300 cursor-pointer transition-colors"
                  >
                    <Trophy className="h-8 w-8 mb-2 opacity-30" />
                    <span className="text-xs">Empty Slot</span>
                  </div>
                );
              }

              return (
                <Dialog key={achievement.id}>
                  <DialogTrigger asChild>
                    <div
                      className="aspect-square rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 
                                 flex flex-col items-center justify-center cursor-pointer 
                                 hover:shadow-lg transition-all relative group overflow-hidden"
                      onClick={() => setSelectedAchievement(achievement)}
                    >
                      {/* Achievement icon */}
                      <div className="text-4xl mb-2">
                        {achievement.iconUrl || '🏆'}
                      </div>
                      <p className="text-xs font-medium text-center px-2 line-clamp-2">
                        {achievement.title}
                      </p>
                      
                      {/* Share indicator */}
                      {achievement.shareCount > 0 && (
                        <div className="absolute top-2 right-2 bg-white/80 rounded-full px-2 py-0.5 
                                        flex items-center gap-1 text-xs">
                          <Share2 className="h-3 w-3" />
                          {achievement.shareCount}
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 
                                      transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-medium">View Details</span>
                      </div>
                    </div>
                  </DialogTrigger>
                  
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-yellow-500" />
                        Achievement Details
                      </DialogTitle>
                    </DialogHeader>
                    
                    <div className="text-center py-4">
                      <div className="text-6xl mb-4">
                        {achievement.iconUrl || '🏆'}
                      </div>
                      <h3 className="text-xl font-bold mb-2">{achievement.title}</h3>
                      <p className="text-gray-600 mb-4">{achievement.description}</p>
                      
                      <p className="text-sm text-gray-500">
                        Earned on {new Date(achievement.earnedAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Share buttons */}
                    <div className="border-t pt-4">
                      <p className="text-sm text-gray-500 text-center mb-3">Share this achievement</p>
                      <div className="flex justify-center gap-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleShare('twitter')}
                          disabled={sharing}
                          className="flex items-center gap-2"
                        >
                          <Twitter className="h-4 w-4 text-blue-400" />
                          Twitter
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleShare('whatsapp')}
                          disabled={sharing}
                          className="flex items-center gap-2"
                        >
                          <MessageCircle className="h-4 w-4 text-green-500" />
                          WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleShare('facebook')}
                          disabled={sharing}
                          className="flex items-center gap-2"
                        >
                          <Facebook className="h-4 w-4 text-blue-600" />
                          Facebook
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Titles Held */}
      {data.titles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Titles Held
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.titles.map(title => (
                <div
                  key={title.id}
                  className="flex items-center gap-3 p-3 bg-gradient-to-r rounded-lg"
                  style={{
                    background: `linear-gradient(to right, var(--tw-gradient-stops))`,
                  }}
                >
                  <div className="text-2xl">
                    {SCOPE_ICONS[title.scope] || '🏆'}
                  </div>
                  <div>
                    <p className="font-bold">{title.title}</p>
                    <p className="text-sm text-gray-500">
                      {title.scopeValue && `${title.scopeValue} • `}
                      Since {new Date(title.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className="ml-auto bg-yellow-500">
                    Current
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Tournament Wins */}
      {data.tournamentWins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Tournament Wins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.tournamentWins.slice(0, 5).map(win => (
                <div
                  key={win.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🥇</div>
                    <div>
                      <p className="font-medium">{win.tournament.name}</p>
                      <p className="text-sm text-gray-500">
                        {win.tournament.scope.charAt(0) + win.tournament.scope.slice(1).toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(win.tournament.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
