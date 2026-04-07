'use client';

import { useEffect, useState, useRef } from 'react';
import { Flame, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface WinStreakCounterProps {
  currentStreak: number;
  longestStreak: number;
  currentLossStreak?: number;
  recentResults?: string[];
  theme?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function WinStreakCounter({
  currentStreak,
  longestStreak,
  currentLossStreak = 0,
  recentResults = [],
  theme = 'teal',
  size = 'md',
}: WinStreakCounterProps) {
  const [displayStreak, setDisplayStreak] = useState(currentStreak);
  const prevStreakRef = useRef(currentStreak);

  useEffect(() => {
    const startValue = prevStreakRef.current;
    
    // Skip animation if same value
    if (startValue === currentStreak) {
      return;
    }

    const interval = setInterval(() => {
      setDisplayStreak(prev => {
        if (prev < currentStreak) return prev + 1;
        if (prev > currentStreak) return prev - 1;
        clearInterval(interval);
        return prev;
      });
    }, 50);

    prevStreakRef.current = currentStreak;

    return () => clearInterval(interval);
  }, [currentStreak]);

  const isWinStreak = currentStreak > 0;
  const isLossStreak = currentLossStreak > 0 && currentStreak === 0;

  const sizeClasses = {
    sm: { container: 'p-3', streak: 'text-2xl', label: 'text-xs' },
    md: { container: 'p-4', streak: 'text-4xl', label: 'text-sm' },
    lg: { container: 'p-6', streak: 'text-6xl', label: 'text-base' },
  };

  return (
    <div className={`${sizeClasses[size].container} rounded-xl ${isWinStreak ? 'bg-gradient-to-br from-orange-50 to-yellow-50' : isLossStreak ? 'bg-gray-50' : 'bg-gray-50'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`${sizeClasses[size].label} text-gray-500 font-medium`}>
          Current Streak
        </span>
        {isWinStreak && (
          <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
        )}
      </div>

      <div className="flex items-end gap-2">
        <span className={`${sizeClasses[size].streak} font-bold ${isWinStreak ? 'text-orange-500' : isLossStreak ? 'text-gray-400' : 'text-gray-600'}`}>
          {isWinStreak ? displayStreak : isLossStreak ? `-${currentLossStreak}` : '0'}
        </span>
        <span className={`${sizeClasses[size].label} text-gray-400 mb-1`}>
          {isWinStreak ? 'wins' : isLossStreak ? 'losses' : 'games'}
        </span>
      </div>

      {longestStreak > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
          <Trophy className="h-3 w-3" />
          <span>Best: {longestStreak}</span>
        </div>
      )}

      {/* Recent results indicator */}
      {recentResults.length > 0 && (
        <div className="mt-3 flex items-center gap-1">
          {recentResults.slice(0, 5).map((result, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                result === 'W'
                  ? 'bg-green-100 text-green-600'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              {result}
            </div>
          ))}
          {recentResults.length > 5 && (
            <span className="text-xs text-gray-400 ml-1">
              +{recentResults.length - 5}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Mini streak badge for headers/cards
export function StreakBadge({ streak, theme = 'teal' }: { streak: number; theme?: string }) {
  if (streak === 0) return null;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      streak > 0
        ? 'bg-orange-100 text-orange-700'
        : 'bg-gray-100 text-gray-600'
    }`}>
      {streak > 0 ? (
        <>
          <Flame className="h-3 w-3" />
          <span>{streak}</span>
        </>
      ) : (
        <span>0</span>
      )}
    </div>
  );
}

// Form indicator component
export function FormIndicator({ 
  recentResults, 
  theme = 'teal' 
}: { 
  recentResults: string[];
  theme?: string;
}) {
  if (recentResults.length === 0) return null;

  const wins = recentResults.filter(r => r === 'W').length;
  const losses = recentResults.filter(r => r === 'L').length;
  const winRate = (wins / recentResults.length) * 100;

  const getFormLevel = () => {
    if (winRate >= 70) return { label: 'Hot', color: 'text-red-500', bg: 'bg-red-50', icon: TrendingUp };
    if (winRate >= 50) return { label: 'Good', color: 'text-green-500', bg: 'bg-green-50', icon: TrendingUp };
    if (winRate >= 30) return { label: 'Neutral', color: 'text-gray-500', bg: 'bg-gray-50', icon: Minus };
    return { label: 'Cold', color: 'text-blue-500', bg: 'bg-blue-50', icon: TrendingDown };
  };

  const form = getFormLevel();
  const Icon = form.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${form.bg}`}>
      <Icon className={`h-4 w-4 ${form.color}`} />
      <span className={`text-sm font-medium ${form.color}`}>{form.label}</span>
      <span className="text-xs text-gray-500">
        {wins}W - {losses}L
      </span>
    </div>
  );
}
