'use client';

/**
 * VALORHIVE v3.42.0 - Tournament Countdown Component
 * Live countdown to registration deadline or tournament start
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, Hourglass, Play } from 'lucide-react';

interface TournamentCountdownProps {
  regDeadline: string;
  startDate: string;
  status: string;
  variant?: 'full' | 'compact';
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

// Helper function defined outside the hook
function calculateTimeRemaining(targetDate: Date): TimeRemaining {
  const now = Date.now();
  const total = Math.max(0, targetDate.getTime() - now);

  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((total % (1000 * 60)) / 1000),
    total,
  };
}

function useCountdown(targetDate: Date | null): TimeRemaining {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: 0,
  });

  useEffect(() => {
    if (!targetDate) return;

    const tick = () => {
      setTimeRemaining(calculateTimeRemaining(targetDate));
    };

    // Initial tick after first render
    tick();

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeRemaining;
}

export function TournamentCountdown({
  regDeadline,
  startDate,
  status,
  variant = 'full',
}: TournamentCountdownProps) {
  const now = new Date();
  const regDeadlineDate = new Date(regDeadline);
  const startDateDate = new Date(startDate);

  // Determine what we're counting down to
  const isRegOpen = status === 'REGISTRATION_OPEN';
  const isRegistrationPhase = now < regDeadlineDate && isRegOpen;
  const isPreTournament = now >= regDeadlineDate && now < startDateDate && 
    ['REGISTRATION_CLOSED', 'BRACKET_GENERATED'].includes(status);
  const isLive = status === 'IN_PROGRESS';
  const isEnded = ['COMPLETED', 'CANCELLED'].includes(status);

  // Choose target date
  const targetDate = isRegistrationPhase ? regDeadlineDate : 
    isPreTournament ? startDateDate : null;

  const time = useCountdown(targetDate || new Date(0));

  // Format helpers
  const formatNumber = (n: number) => n.toString().padStart(2, '0');

  // Get urgency level
  const getUrgency = () => {
    if (!targetDate) return 'normal';
    const hoursRemaining = time.total / (1000 * 60 * 60);
    if (hoursRemaining < 2) return 'critical';
    if (hoursRemaining < 24) return 'urgent';
    if (hoursRemaining < 72) return 'warning';
    return 'normal';
  };

  const urgency = getUrgency();

  // Compact variant for cards
  if (variant === 'compact') {
    if (isEnded) return null;

    if (isLive) {
      return (
        <Badge className="bg-blue-500 animate-pulse">
          <Play className="w-3 h-3 mr-1" />
          Live
        </Badge>
      );
    }

    if (!targetDate) return null;

    const label = isRegistrationPhase ? 'Reg closes' : 'Starts';
    const timeStr = time.days > 0 
      ? `${time.days}d ${time.hours}h`
      : time.hours > 0
        ? `${time.hours}h ${time.minutes}m`
        : `${time.minutes}m`;

    return (
      <Badge 
        variant="outline"
        className={`
          ${urgency === 'critical' ? 'bg-red-50 text-red-700 border-red-300' : ''}
          ${urgency === 'urgent' ? 'bg-amber-50 text-amber-700 border-amber-300' : ''}
        `}
      >
        <Clock className="w-3 h-3 mr-1" />
        {label} in {timeStr}
      </Badge>
    );
  }

  // Full variant for detail page
  if (isEnded) {
    return (
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Clock className="w-5 h-5" />
            <span>Tournament has ended</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLive) {
    return (
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-blue-700 font-semibold text-lg">
              Tournament Live Now!
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!targetDate) return null;

  // Get labels and colors
  const getPhaseInfo = () => {
    if (isRegistrationPhase) {
      return {
        icon: Clock,
        label: 'Registration Closes In',
        sublabel: `Tournament starts ${startDateDate.toLocaleDateString('en-IN', { 
          day: 'numeric', 
          month: 'short' 
        })}`,
        bgClass: urgency === 'critical' ? 'bg-red-50 border-red-200' :
          urgency === 'urgent' ? 'bg-amber-50 border-amber-200' :
          'bg-green-50 border-green-200',
        textClass: urgency === 'critical' ? 'text-red-700' :
          urgency === 'urgent' ? 'text-amber-700' :
          'text-green-700',
      };
    }

    if (isPreTournament) {
      return {
        icon: Hourglass,
        label: 'Tournament Starts In',
        sublabel: 'Registration is closed',
        bgClass: 'bg-purple-50 border-purple-200',
        textClass: 'text-purple-700',
      };
    }

    return null;
  };

  const phaseInfo = getPhaseInfo();
  if (!phaseInfo) return null;

  const IconComponent = phaseInfo.icon;

  return (
    <Card className={`${phaseInfo.bgClass} border`}>
      <CardContent className="py-4">
        <div className="text-center">
          <div className={`flex items-center justify-center gap-2 mb-2 ${phaseInfo.textClass}`}>
            <IconComponent className="w-5 h-5" />
            <span className="font-medium">{phaseInfo.label}</span>
          </div>

          {/* Countdown Display */}
          <div className="flex items-center justify-center gap-2 md:gap-4">
            {time.days > 0 && (
              <TimeBlock value={time.days} label="Days" urgency={urgency} />
            )}
            <TimeBlock value={time.hours} label="Hrs" urgency={urgency} />
            <TimeBlock value={time.minutes} label="Min" urgency={urgency} />
            {urgency === 'critical' && (
              <TimeBlock value={time.seconds} label="Sec" urgency={urgency} showSeconds />
            )}
          </div>

          <p className={`text-sm mt-2 ${phaseInfo.textClass} opacity-75`}>
            {phaseInfo.sublabel}
          </p>

          {urgency === 'critical' && isRegistrationPhase && (
            <div className="flex items-center justify-center gap-1 mt-2 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Register now!</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Time block component
function TimeBlock({ 
  value, 
  label, 
  urgency,
  showSeconds = false 
}: { 
  value: number; 
  label: string; 
  urgency: string;
  showSeconds?: boolean;
}) {
  const bgClass = urgency === 'critical' ? 'bg-red-100' :
    urgency === 'urgent' ? 'bg-amber-100' :
    'bg-white';

  return (
    <div className={`rounded-lg ${bgClass} shadow-sm ${showSeconds ? 'p-2' : 'p-3'} min-w-[50px] md:min-w-[60px]`}>
      <div className={`font-bold ${showSeconds ? 'text-xl' : 'text-2xl md:text-3xl'}`}>
        {value.toString().padStart(2, '0')}
      </div>
      <div className={`text-xs ${showSeconds ? 'text-xs' : 'text-xs md:text-sm'} text-gray-500`}>
        {label}
      </div>
    </div>
  );
}
