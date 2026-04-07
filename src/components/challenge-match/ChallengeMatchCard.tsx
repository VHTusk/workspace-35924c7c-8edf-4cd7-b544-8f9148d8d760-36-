'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar, MapPin, Users, Clock, Trophy, IndianRupee,
  CheckCircle, AlertCircle, Timer, UserPlus, ExternalLink,
  Building2, Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ChallengeMatchCardProps {
  match: {
    id: string;
    title: string;
    description: string | null;
    matchDate: string;
    registrationDeadline: string;
    venueName: string;
    venueAddress: string | null;
    venueMapsUrl: string | null;
    format: string;
    minPlayers: number;
    maxPlayers: number;
    entryFee: number;
    joinedCount: number;
    confirmedCount: number;
    totalPrizePool: number;
    daysRemaining: number;
    progress: number;
    remainingSlots: number;
    needsMore: number;
    status: string;
    sponsorName: string | null;
    sponsorLogo: string | null;
    sponsorAmount: number;
    sport: string;
  };
  userId?: string;
  currentSport?: string;
  onJoin?: (matchId: string) => void;
  onPay?: (matchId: string) => void;
  hasJoined?: boolean;
  hasPaid?: boolean;
}

export function ChallengeMatchCard({
  match,
  userId,
  currentSport,
  onJoin,
  onPay,
  hasJoined = false,
  hasPaid = false,
}: ChallengeMatchCardProps) {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0 });
  const [isJoining, setIsJoining] = useState(false);

  // Countdown timer
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date().getTime();
      const deadline = new Date(match.registrationDeadline).getTime();
      const diff = Math.max(0, deadline - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setCountdown({ days, hours, mins });
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [match.registrationDeadline]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = () => {
    switch (match.status) {
      case 'OPEN':
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">Open</Badge>;
      case 'THRESHOLD_REACHED':
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">Threshold Reached</Badge>;
      case 'PAYMENT_PENDING':
        return <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">Payment Pending</Badge>;
      case 'CONFIRMED':
        return <Badge variant="secondary" className="bg-green-500/10 text-green-600">Confirmed</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary" className="bg-red-500/10 text-red-600">Cancelled</Badge>;
      case 'EXPIRED':
        return <Badge variant="secondary" className="bg-gray-500/10 text-gray-600">Expired</Badge>;
      default:
        return <Badge variant="secondary">{match.status}</Badge>;
    }
  };

  const handleJoin = async () => {
    if (!userId || !onJoin) return;
    setIsJoining(true);
    try {
      await onJoin(match.id);
    } finally {
      setIsJoining(false);
    }
  };

  const isExpired = countdown.days === 0 && countdown.hours === 0 && countdown.mins === 0;
  const canJoin = !hasJoined && !isExpired && match.status === 'OPEN' && match.remainingSlots > 0;
  const needsPayment = hasJoined && !hasPaid && ['THRESHOLD_REACHED', 'PAYMENT_PENDING', 'CONFIRMED'].includes(match.status);

  return (
    <Card className="bg-card border-border/50 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Countdown Banner */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between",
        isExpired ? "bg-red-500/10" : 
        countdown.days <= 1 ? "bg-orange-500/10" : 
        "bg-teal-500/10"
      )}>
        <div className="flex items-center gap-2">
          <Timer className={cn(
            "h-5 w-5",
            isExpired ? "text-red-500" : 
            countdown.days <= 1 ? "text-orange-500" : 
            "text-teal-500"
          )} />
          <span className="text-sm font-medium">
            {isExpired ? (
              <span className="text-red-600">Registration Closed</span>
            ) : (
              <>
                <span className="text-muted-foreground">Registration closes in</span>
                <span className={cn(
                  "ml-2 font-bold",
                  countdown.days <= 1 ? "text-orange-600" : "text-foreground"
                )}>
                  {countdown.days > 0 && `${countdown.days}d `}
                  {countdown.hours}h {countdown.mins}m
                </span>
              </>
            )}
          </span>
        </div>
        {getStatusBadge()}
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-start justify-between gap-2">
          <span>{match.title}</span>
          {match.sponsorName && (
            <Badge variant="outline" className="flex items-center gap-1 shrink-0">
              <Star className="h-3 w-3 text-yellow-500" />
              Sponsored
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Match Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 text-purple-500" />
            <span>{formatDate(match.matchDate)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span>{match.format}</span>
          </div>
        </div>

        {/* Venue */}
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">{match.venueName}</p>
            {match.venueAddress && (
              <p className="text-muted-foreground text-xs">{match.venueAddress}</p>
            )}
            {match.venueMapsUrl && (
              <a 
                href={match.venueMapsUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-teal-500 hover:underline text-xs flex items-center gap-1 mt-1"
              >
                <ExternalLink className="h-3 w-3" />
                View on Maps
              </a>
            )}
          </div>
        </div>

        {/* Sponsor Section */}
        {match.sponsorName && (
          <div className="flex items-center gap-3 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
            {match.sponsorLogo ? (
              <img src={match.sponsorLogo} alt={match.sponsorName} className="h-8 w-8 rounded object-contain" />
            ) : (
              <Building2 className="h-8 w-8 text-yellow-500" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">Sponsored by {match.sponsorName}</p>
              <p className="text-xs text-muted-foreground">
                Contributing {formatCurrency(match.sponsorAmount)} to prize pool
              </p>
            </div>
          </div>
        )}

        {/* Player Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4 text-blue-500" />
              {match.joinedCount}/{match.minPlayers} joined
            </span>
            <span className="font-medium">{match.progress}%</span>
          </div>
          <Progress value={match.progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Min: {match.minPlayers} | Max: {match.maxPlayers}</span>
            <span>{match.needsMore > 0 ? `${match.needsMore} more needed` : 'Threshold reached!'}</span>
          </div>
        </div>

        {/* Prize Pool */}
        <div className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Prize Pool</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(match.totalPrizePool)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Entry Fee</p>
            <p className="text-sm font-semibold">{formatCurrency(match.entryFee)}</p>
          </div>
        </div>

        {/* User Status */}
        {hasJoined && (
          <div className={cn(
            "flex items-center gap-2 p-2 rounded-lg text-sm",
            hasPaid ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"
          )}>
            {hasPaid ? (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>You&apos;re confirmed! Payment complete.</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                <span>You&apos;ve joined! Payment required to confirm your spot.</span>
              </>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {canJoin && (
            <Button 
              className="flex-1 bg-teal-500 hover:bg-teal-600"
              onClick={handleJoin}
              disabled={isJoining || !userId}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {isJoining ? 'Joining...' : 'Join Challenge'}
            </Button>
          )}
          {needsPayment && (
            <Button 
              className="flex-1 bg-green-500 hover:bg-green-600"
              onClick={() => onPay?.(match.id)}
            >
              <IndianRupee className="h-4 w-4 mr-2" />
              Pay {formatCurrency(match.entryFee)}
            </Button>
          )}
          {hasPaid && (
            <Button variant="outline" className="flex-1" asChild>
              <Link href={`/tournaments/${match.id}`}>
                <Trophy className="h-4 w-4 mr-2" />
                View Details
              </Link>
            </Button>
          )}
          {!userId && match.status === 'OPEN' && !isExpired && (
            <Button variant="outline" className="flex-1" asChild>
              <Link href={`/${currentSport || 'darts'}/login`}>
                Login to Join
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
