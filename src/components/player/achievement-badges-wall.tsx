'use client';

/**
 * Player Achievement Badges Wall Component
 * Displays all earned badges, titles, and trophies with polished UI
 * Supports tier-based styling, categories, and animations
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Medal,
  Star,
  Target,
  Flame,
  Crown,
  Zap,
  Award,
  Lock,
  ChevronDown,
  Filter,
  Share2,
  Grid,
  List,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

// Badge Tier styling
const TIER_STYLES = {
  BRONZE: {
    bg: 'bg-gradient-to-br from-orange-400 to-amber-600',
    border: 'border-orange-300',
    text: 'text-orange-100',
    shadow: 'shadow-orange-500/30',
    icon: '🥉',
  },
  SILVER: {
    bg: 'bg-gradient-to-br from-gray-300 to-slate-500',
    border: 'border-gray-200',
    text: 'text-gray-100',
    shadow: 'shadow-gray-400/30',
    icon: '🥈',
  },
  GOLD: {
    bg: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    border: 'border-yellow-200',
    text: 'text-yellow-100',
    shadow: 'shadow-yellow-500/30',
    icon: '🥇',
  },
  PLATINUM: {
    bg: 'bg-gradient-to-br from-cyan-400 to-blue-600',
    border: 'border-cyan-200',
    text: 'text-cyan-100',
    shadow: 'shadow-cyan-500/30',
    icon: '💎',
  },
};

// Category icons
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  PARTICIPATION: Medal,
  PERFORMANCE: Trophy,
  MILESTONE: Star,
  WIN_STREAK: Flame,
  RANKING: Crown,
  SPECIAL: Zap,
  TOURNAMENT: Award,
  SKILL: Target,
};

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  PARTICIPATION: 'bg-blue-100 text-blue-700 border-blue-200',
  PERFORMANCE: 'bg-green-100 text-green-700 border-green-200',
  MILESTONE: 'bg-purple-100 text-purple-700 border-purple-200',
  WIN_STREAK: 'bg-orange-100 text-orange-700 border-orange-200',
  RANKING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  SPECIAL: 'bg-pink-100 text-pink-700 border-pink-200',
  TOURNAMENT: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  SKILL: 'bg-teal-100 text-teal-700 border-teal-200',
};

interface BadgeItem {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  category: string;
  iconUrl?: string;
  earned: boolean;
  earnedAt?: string;
  progress?: number;
  maxProgress?: number;
}

interface BadgesWallProps {
  userId: string;
  sport?: 'CORNHOLE' | 'DARTS';
  onShare?: (badgeId: string) => void;
}

export function AchievementBadgesWall({ sport, onShare }: BadgesWallProps) {
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterEarned, setFilterEarned] = useState<'all' | 'earned' | 'locked'>('all');
  const [stats, setStats] = useState({ total: 0, earned: 0, percentage: 0 });

  // Fetch badges
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const params = new URLSearchParams();
        if (sport) params.set('sport', sport);

        const response = await fetch(`/api/player/achievements?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setBadges(data.achievements);
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch badges:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBadges();
  }, [sport]);

  // Filter badges
  const filteredBadges = badges.filter(badge => {
    if (filterCategory && badge.category !== filterCategory) return false;
    if (filterEarned === 'earned' && !badge.earned) return false;
    if (filterEarned === 'locked' && badge.earned) return false;
    return true;
  });

  // Get unique categories
  const categories = [...new Set(badges.map(b => b.category))];

  // Handle share
  const handleShare = useCallback((badgeId: string) => {
    onShare?.(badgeId);
    toast.success('Share link copied!');
  }, [onShare]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-2xl font-bold">Achievement Badges</h3>
              <p className="text-muted-foreground">
                Collect badges by participating in tournaments and achieving milestones
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{stats.earned}</div>
                <div className="text-sm text-muted-foreground">Earned</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.percentage}%</div>
                <div className="text-sm text-muted-foreground">Complete</div>
              </div>
            </div>
          </div>
          <Progress value={stats.percentage} className="mt-4 h-2" />
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              {filterCategory || 'All Categories'}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilterCategory(null)}>
              All Categories
            </DropdownMenuItem>
            {categories.map(cat => (
              <DropdownMenuItem key={cat} onClick={() => setFilterCategory(cat)}>
                {cat.replace('_', ' ')}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tabs value={filterEarned} onValueChange={(v) => setFilterEarned(v as typeof filterEarned)}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
            <TabsTrigger value="earned" className="text-xs px-3">Earned</TabsTrigger>
            <TabsTrigger value="locked" className="text-xs px-3">Locked</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Badges Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          <AnimatePresence>
            {filteredBadges.map((badge, index) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: index * 0.02 }}
              >
                <BadgeCard badge={badge} onShare={handleShare} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBadges.map((badge, index) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <BadgeListItem badge={badge} onShare={handleShare} />
            </motion.div>
          ))}
        </div>
      )}

      {filteredBadges.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No badges match your filters</p>
        </div>
      )}
    </div>
  );
}

// Grid Card Component
function BadgeCard({ badge, onShare }: { badge: BadgeItem; onShare: (id: string) => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const tierStyle = TIER_STYLES[badge.tier];
  const CategoryIcon = CATEGORY_ICONS[badge.category] || Award;

  return (
    <motion.div
      className="relative group"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.05 }}
    >
      <div
        className={`
          relative aspect-square rounded-xl overflow-hidden
          ${badge.earned ? 'cursor-pointer' : 'opacity-50 grayscale'}
          border-2 ${tierStyle.border}
          shadow-lg ${tierStyle.shadow}
          transition-all duration-300
        `}
      >
        {/* Background */}
        <div className={`absolute inset-0 ${tierStyle.bg}`} />

        {/* Content */}
        <div className="relative h-full flex flex-col items-center justify-center p-3 text-center">
          {/* Badge Icon */}
          <div className="text-4xl mb-2">
            {badge.earned ? (
              badge.iconUrl ? (
                <img src={badge.iconUrl} alt={badge.name} className="w-12 h-12" />
              ) : (
                <CategoryIcon className="w-12 h-12 text-white" />
              )
            ) : (
              <Lock className="w-10 h-10 text-white/60" />
            )}
          </div>

          {/* Tier Badge */}
          <div className="absolute top-2 right-2 text-lg">{tierStyle.icon}</div>

          {/* Badge Name */}
          <p className={`font-semibold text-sm ${tierStyle.text} line-clamp-2`}>
            {badge.name}
          </p>

          {/* Category */}
          <Badge
            variant="outline"
            className={`
              mt-2 text-xs px-2 py-0 h-5
              ${CATEGORY_COLORS[badge.category] || 'bg-gray-100 text-gray-700'}
            `}
          >
            {badge.category.replace('_', ' ')}
          </Badge>
        </div>

        {/* Hover Overlay */}
        <AnimatePresence>
          {isHovered && badge.earned && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-3"
            >
              <p className="text-white text-xs text-center mb-2 line-clamp-3">
                {badge.description}
              </p>
              {badge.earnedAt && (
                <p className="text-white/70 text-xs">
                  Earned {new Date(badge.earnedAt).toLocaleDateString()}
                </p>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(badge.id);
                }}
              >
                <Share2 className="h-3 w-3 mr-1" />
                Share
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar for locked badges */}
      {!badge.earned && badge.progress !== undefined && badge.maxProgress && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(badge.progress / badge.maxProgress) * 100}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}

// List Item Component
function BadgeListItem({ badge, onShare }: { badge: BadgeItem; onShare: (id: string) => void }) {
  const tierStyle = TIER_STYLES[badge.tier];

  return (
    <div
      className={`
        flex items-center gap-4 p-4 rounded-lg border
        ${badge.earned ? 'bg-card' : 'bg-muted/50 opacity-60'}
      `}
    >
      {/* Icon */}
      <div
        className={`
          w-14 h-14 rounded-lg flex items-center justify-center
          ${badge.earned ? tierStyle.bg : 'bg-gray-200'}
        `}
      >
        {badge.earned ? (
          <span className="text-2xl">{tierStyle.icon}</span>
        ) : (
          <Lock className="w-6 h-6 text-gray-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold truncate">{badge.name}</h4>
          <Badge
            variant="outline"
            className={CATEGORY_COLORS[badge.category] || ''}
          >
            {badge.category.replace('_', ' ')}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate">{badge.description}</p>
        {badge.earnedAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Earned {new Date(badge.earnedAt).toLocaleDateString()}
          </p>
        )}
        {/* Progress */}
        {!badge.earned && badge.progress !== undefined && badge.maxProgress && (
          <div className="mt-2">
            <Progress
              value={(badge.progress / badge.maxProgress) * 100}
              className="h-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {badge.progress}/{badge.maxProgress} progress
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      {badge.earned && (
        <Button size="sm" variant="ghost" onClick={() => onShare(badge.id)}>
          <Share2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// Compact Badge Display for Profile Header
interface CompactBadgesProps {
  badges: BadgeItem[];
  maxDisplay?: number;
  onViewAll?: () => void;
}

export function CompactBadgesDisplay({ badges, maxDisplay = 5, onViewAll }: CompactBadgesProps) {
  const earnedBadges = badges.filter(b => b.earned);
  const displayBadges = earnedBadges.slice(0, maxDisplay);
  const remaining = earnedBadges.length - maxDisplay;

  if (earnedBadges.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {displayBadges.map((badge, i) => (
        <motion.div
          key={badge.id}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.1 }}
          className="relative"
        >
          <div
            className={`
              w-10 h-10 rounded-full flex items-center justify-center
              ${TIER_STYLES[badge.tier].bg}
              border-2 ${TIER_STYLES[badge.tier].border}
            `}
            title={badge.name}
          >
            <span className="text-lg">{TIER_STYLES[badge.tier].icon}</span>
          </div>
        </motion.div>
      ))}
      {remaining > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-10 px-2 text-xs"
          onClick={onViewAll}
        >
          +{remaining} more
        </Button>
      )}
    </div>
  );
}
