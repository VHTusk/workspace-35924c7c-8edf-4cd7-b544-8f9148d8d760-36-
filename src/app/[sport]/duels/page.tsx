'use client';

/**
 * Open Duels Feed - City-scoped public duels with full transparency
 * 
 * Features:
 * - City geo-lock (only shows duels in user's city)
 * - Full match details visible before joining
 * - Real-time availability updates
 * - Filters by sport, fee range, time
 * 
 * @version 3.73.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Trophy,
  MapPin,
  Clock,
  IndianRupee,
  Users,
  Filter,
  Calendar,
  ChevronRight,
  AlertCircle,
  Loader2,
  Swords,
  Target,
  ExternalLink,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

// Types
interface Duel {
  id: string;
  sport: 'CORNHOLE' | 'DARTS';
  city: string;
  format: string;
  
  host: {
    id: string;
    name: string;
    city: string;
    verified: boolean;
    rating: number;
  };
  
  venue: {
    name: string;
    address: string;
    googleMapsUrl?: string;
  } | null;
  
  scheduledStart: string;
  durationMinutes: number;
  
  entryFee: number;
  prizePool: number;
  platformFeePercent: number;
  
  currentParticipants: number;
  maxParticipants: number;
  availableSlots: number;
  
  isEscalatable: boolean;
  escalationThreshold: number;
  
  status: string;
  expiresAt: string;
  
  matchRules: Record<string, unknown> | null;
  customTerms: string | null;
  
  viewCount: number;
  createdAt: string;
}

interface DuelDetail extends Duel {
  host: {
    id: string;
    name: string;
    city: string;
    district?: string;
    state?: string;
    verified: boolean;
    rating: number;
    memberSince: string;
    stats: {
      duelsHosted: number;
      duelsWon: number;
    };
  };
  
  venue: {
    name: string;
    address: string;
    city: string;
    googleMapsUrl?: string;
    contactPhone?: string;
    amenities?: string[];
    slot?: {
      date: Date;
      time: string;
      slotFee: number;
    };
  } | null;
  
  financials: {
    entryFee: number;
    entryFeeFormatted: string;
    currentParticipants: number;
    totalEntryFeesCollected: number;
    platformFeeAmount: number;
    platformFeePercent: number;
    netPrizePool: number;
    potentialParticipants: number;
    potentialTotalEntryFees: number;
    potentialPlatformFee: number;
    potentialNetPrizePool: number;
    winnerTakesAll: boolean;
  };
  
  participants: Array<{
    id: string;
    userId: string;
    name: string;
    city: string;
    rating: number;
    verified: boolean;
    joinedAt: string;
    checkedIn: boolean;
    paymentStatus: string;
    isHost: boolean;
  }>;
  
  slots: {
    current: number;
    max: number;
    available: number;
  };
  
  escalation: {
    isEscalatable: boolean;
    threshold: number;
    currentCount: number;
    willEscalate: boolean;
  };
  
  canJoin: boolean;
}

export default function DuelsFeedPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  
  // Get user context from URL or localStorage
  const sport = searchParams.get('sport') || 'CORNHOLE';
  const [userCity, setUserCity] = useState<string>('Mumbai');
  const [userId, setUserId] = useState<string>('');
  
  // State
  const [duels, setDuels] = useState<Duel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    sport: sport as 'CORNHOLE' | 'DARTS',
    format: '',
    minFee: 0,
    maxFee: 50000,
    dateFrom: '',
    dateTo: '',
  });
  
  // Selected duel for detail view
  const [selectedDuel, setSelectedDuel] = useState<DuelDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  // Pagination
  const [offset, setOffset] = useState(0);
  const limit = 20;
  
  // Load user city from profile
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const sportUpper = sport.toUpperCase();
        const response = await fetch(`/api/player/me?sport=${sportUpper}`);
        if (response.ok) {
          const data = await response.json();
          if (data.district) {
            setUserCity(data.district);
            setUserId(data.id);
          } else if (data.city) {
            setUserCity(data.city);
            setUserId(data.id);
          }
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
      }
    };
    loadUserProfile();
  }, [sport]);
  
  // Fetch duels
  const fetchDuels = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        city: userCity,
        sport: filters.sport,
        limit: limit.toString(),
        offset: reset ? '0' : offset.toString(),
      });
      
      if (filters.format) params.set('format', filters.format);
      if (filters.minFee > 0) params.set('minFee', filters.minFee.toString());
      if (filters.maxFee < 50000) params.set('maxFee', filters.maxFee.toString());
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      
      const response = await fetch(`/api/duels?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        if (reset) {
          setDuels(data.data.duels);
          setOffset(0);
        } else {
          setDuels(prev => [...prev, ...data.data.duels]);
        }
        setTotal(data.data.pagination.total);
        setHasMore(data.data.pagination.hasMore);
      }
    } catch (error) {
      console.error('Failed to fetch duels:', error);
      toast({
        title: 'Error',
        description: 'Failed to load duels',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [userCity, filters, offset, toast]);
  
  useEffect(() => {
    if (userCity) {
      fetchDuels(true);
    }
  }, [userCity, filters.sport]);
  
  // Load more duels
  const loadMore = () => {
    if (!isLoading && hasMore) {
      setOffset(prev => prev + limit);
      fetchDuels(false);
    }
  };
  
  // Fetch duel detail
  const fetchDuelDetail = async (duelId: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`/api/duels/${duelId}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedDuel(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch duel detail:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };
  
  // Join duel
  const handleJoinDuel = async () => {
    if (!selectedDuel || !userId) return;
    
    setIsJoining(true);
    try {
      const response = await fetch(`/api/duels/${selectedDuel.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Joined Duel! ⚔️',
          description: data.data.willEscalate 
            ? 'This duel will become a tournament!'
            : 'You have successfully joined the duel.',
        });
        setShowJoinDialog(false);
        setSelectedDuel(null);
        fetchDuels(true); // Refresh list
      } else {
        toast({
          title: 'Failed to Join',
          description: data.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to join duel:', error);
      toast({
        title: 'Error',
        description: 'Failed to join duel',
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };
  
  // Format currency
  const formatCurrency = (paise: number) => `₹${(paise / 100).toFixed(0)}`;
  
  // Format date
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const isToday = new Date().toDateString() === date.toDateString();
    const isTomorrow = new Date(Date.now() + 86400000).toDateString() === date.toDateString();
    
    if (isToday) return `Today, ${format(date, 'h:mm a')}`;
    if (isTomorrow) return `Tomorrow, ${format(date, 'h:mm a')}`;
    return format(date, 'MMM d, h:mm a');
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-6xl py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Swords className="h-6 w-6 text-primary" />
                Open Duels
              </h1>
              <p className="text-muted-foreground flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {userCity}
              </p>
            </div>
            
            {/* Sport Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={filters.sport === 'CORNHOLE' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, sport: 'CORNHOLE' }))}
              >
                🎯 Cornhole
              </Button>
              <Button
                variant={filters.sport === 'DARTS' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, sport: 'DARTS' }))}
              >
                🎯 Darts
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container max-w-6xl py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{total}</div>
              <div className="text-sm text-muted-foreground">Active Duels</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{userCity}</div>
              <div className="text-sm text-muted-foreground">Your City</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold flex items-center justify-center gap-1">
                <IndianRupee className="h-4 w-4" />
                {formatCurrency(duels.reduce((sum, d) => sum + d.prizePool, 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total Prize Pool</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2 mb-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Duels</SheetTitle>
                <SheetDescription>
                  Narrow down duels by your preferences
                </SheetDescription>
              </SheetHeader>
              
              <div className="space-y-6 mt-6">
                {/* Format */}
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select
                    value={filters.format || 'ALL'}
                    onValueChange={(value) => setFilters(prev => ({
                      ...prev,
                      format: value === 'ALL' ? '' : value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Formats</SelectItem>
                      <SelectItem value="INDIVIDUAL">1v1 Individual</SelectItem>
                      <SelectItem value="TEAM">2v2 Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Entry Fee Range */}
                <div className="space-y-2">
                  <Label>Entry Fee Range</Label>
                  <div className="pt-4 px-2">
                    <Slider
                      value={[filters.minFee, filters.maxFee]}
                      min={0}
                      max={50000}
                      step={500}
                      onValueChange={([min, max]) => setFilters(prev => ({
                        ...prev,
                        minFee: min,
                        maxFee: max
                      }))}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>₹{filters.minFee / 100}</span>
                    <span>₹{filters.maxFee / 100}</span>
                  </div>
                </div>
                
                {/* Date Range */}
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    />
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    />
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={() => fetchDuels(true)}
                >
                  Apply Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchDuels(true)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Duels Grid */}
        {isLoading && duels.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading duels in {userCity}...</p>
          </div>
        ) : duels.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Duels Available</h3>
            <p className="text-muted-foreground mb-4">
              There are no open duels in {userCity} right now.
            </p>
            <Button onClick={() => router.push(`/${filters.sport.toLowerCase()}/dashboard`)}>
              Create a Duel
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {duels.map((duel) => (
              <Card
                key={duel.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fetchDuelDetail(duel.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {duel.format === 'INDIVIDUAL' ? '1v1' : '2v2'} {duel.sport} Duel
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span>by {duel.host.name}</span>
                        {duel.host.verified && (
                          <Badge variant="secondary" className="text-xs">Verified</Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant={duel.availableSlots > 0 ? 'default' : 'secondary'}>
                      {duel.availableSlots} slots left
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="pb-3">
                  {/* Venue */}
                  {duel.venue && (
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{duel.venue.name}</span>
                    </div>
                  )}
                  
                  {/* Time */}
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDateTime(duel.scheduledStart)}</span>
                    <span className="text-muted-foreground">({duel.durationMinutes} min)</span>
                  </div>
                  
                  {/* Financials */}
                  <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">Entry Fee</div>
                      <div className="text-xl font-bold">{formatCurrency(duel.entryFee)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Prize Pool</div>
                      <div className="text-xl font-bold text-green-600">
                        {formatCurrency(duel.prizePool)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Escalation Notice */}
                  {duel.isEscalatable && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-blue-600">
                      <Users className="h-4 w-4" />
                      <span>
                        Becomes tournament at {duel.escalationThreshold} players
                        ({duel.currentParticipants}/{duel.escalationThreshold})
                      </span>
                    </div>
                  )}
                </CardContent>
                
                <CardFooter className="pt-0">
                  <Button variant="ghost" className="w-full" size="sm">
                    View Details
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
        
        {/* Load More */}
        {hasMore && (
          <div className="text-center mt-6">
            <Button variant="outline" onClick={loadMore} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Load More Duels
            </Button>
          </div>
        )}
      </main>
      
      {/* Duel Detail Dialog */}
      <Dialog open={!!selectedDuel && !showJoinDialog} onOpenChange={() => setSelectedDuel(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          {selectedDuel && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Swords className="h-5 w-5 text-primary" />
                  {selectedDuel.format === 'INDIVIDUAL' ? '1v1' : '2v2'} {selectedDuel.sport} Duel
                </DialogTitle>
                <DialogDescription>
                  Complete match details - fully transparent
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Host Info */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">Host</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{selectedDuel.host.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedDuel.host.city}
                        {selectedDuel.host.district && `, ${selectedDuel.host.district}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        <span className="font-medium">{selectedDuel.host.rating}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {selectedDuel.host.stats.duelsWon} wins
                      </div>
                    </div>
                  </div>
                  {selectedDuel.host.verified && (
                    <Badge variant="secondary" className="mt-2">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified Host
                    </Badge>
                  )}
                </div>
                
                {/* Venue */}
                {selectedDuel.venue && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-2">Venue</div>
                    <div className="font-medium">{selectedDuel.venue.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedDuel.venue.address}
                    </div>
                    {selectedDuel.venue.googleMapsUrl && (
                      <a
                        href={selectedDuel.venue.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary mt-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open in Google Maps
                      </a>
                    )}
                  </div>
                )}
                
                {/* Timing */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Scheduled</div>
                    <div className="font-medium">{formatDateTime(selectedDuel.scheduledStart)}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Duration</div>
                    <div className="font-medium">{selectedDuel.durationMinutes} minutes</div>
                  </div>
                </div>
                
                {/* Financials */}
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <div className="text-sm font-medium mb-3">Financial Breakdown</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entry Fee (per player)</span>
                      <span className="font-medium">{selectedDuel.financials.entryFeeFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform Fee ({selectedDuel.financials.platformFeePercent}%)</span>
                      <span>₹{selectedDuel.financials.platformFeeAmount / 100}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between text-lg">
                      <span className="font-medium">Prize Pool</span>
                      <span className="font-bold text-green-600">
                        ₹{selectedDuel.financials.netPrizePool / 100}
                      </span>
                    </div>
                    {selectedDuel.financials.winnerTakesAll && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Winner takes all
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Participants */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Participants</span>
                    <Badge>
                      {selectedDuel.slots.current}/{selectedDuel.slots.max}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {selectedDuel.participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 bg-muted rounded"
                      >
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.isHost && <Badge variant="outline">Host</Badge>}
                          {p.verified && <CheckCircle className="h-4 w-4 text-green-500" />}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {p.rating} rating
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Escalation Notice */}
                {selectedDuel.escalation.isEscalatable && (
                  <div className="p-3 bg-blue-500/10 rounded-lg text-blue-600 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <div>
                      <div className="font-medium">Tournament Eligible</div>
                      <div className="text-sm">
                        {selectedDuel.escalation.currentCount}/{selectedDuel.escalation.threshold} players
                        - will become knockout at threshold
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Rules */}
                {selectedDuel.matchRules && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm font-medium mb-2">Match Rules</div>
                    <div className="text-sm text-muted-foreground">
                      {Object.entries(selectedDuel.matchRules).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span>{key}:</span>
                          <span>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Custom Terms */}
                {selectedDuel.customTerms && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm font-medium mb-2">Additional Terms</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedDuel.customTerms}
                    </div>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                {selectedDuel.canJoin ? (
                  <Button onClick={() => setShowJoinDialog(true)}>
                    <Trophy className="h-4 w-4 mr-2" />
                    Join Duel - {formatCurrency(selectedDuel.entryFee)}
                  </Button>
                ) : (
                  <Button disabled>
                    {selectedDuel.status === 'FULL' ? 'Duel Full' : 'Registration Closed'}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Join Confirmation Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join This Duel?</DialogTitle>
            <DialogDescription>
              You will be charged {selectedDuel && formatCurrency(selectedDuel.entryFee)} to join this duel.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Entry Fee</span>
                <span className="font-medium">
                  {selectedDuel && formatCurrency(selectedDuel.entryFee)}
                </span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Potential Prize</span>
                <span className="font-medium">
                  {selectedDuel && formatCurrency(selectedDuel.financials.netPrizePool)}
                </span>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mt-4">
              By joining, you agree to arrive on time and play by the match rules.
              No-show will result in automatic forfeit.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleJoinDuel} disabled={isJoining}>
              {isJoining ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trophy className="h-4 w-4 mr-2" />
              )}
              Confirm & Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
