"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Medal,
  Target,
  Flame,
  TrendingUp,
  Users,
  Clock,
  Share2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Crown,
  Star,
  ArrowUp,
  ArrowDown,
  Twitter,
  MessageCircle,
} from "lucide-react";
import type { SeasonRecapData } from "@/lib/season-recap-generator";

interface RecapViewerProps {
  recap: SeasonRecapData;
  playerName: string;
  availableYears: number[];
  currentYear: number;
  onYearChange: (year: number) => void;
  onRegenerate?: () => void;
  shareableText?: string;
}

interface Slide {
  id: string;
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  bgGradient: string;
}

// Share Modal Component - defined outside to avoid render issues
function ShareModal({ 
  showShare, 
  onClose, 
  shareableText 
}: { 
  showShare: boolean; 
  onClose: () => void; 
  shareableText?: string;
}) {
  return (
    <AnimatePresence>
      {showShare && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4">Share Your Recap</h3>
            <div className="space-y-3">
              <Button
                onClick={() => {
                  if (shareableText) {
                    window.open(`https://wa.me/?text=${encodeURIComponent(shareableText)}`, '_blank');
                  }
                }}
                className="w-full bg-green-500 hover:bg-green-600 text-white"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Share on WhatsApp
              </Button>
              <Button
                onClick={() => {
                  if (shareableText) {
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareableText)}`, '_blank');
                  }
                }}
                className="w-full bg-blue-400 hover:bg-blue-500 text-white"
              >
                <Twitter className="w-4 h-4 mr-2" />
                Share on Twitter
              </Button>
              <Button
                onClick={() => {
                  if (shareableText) {
                    navigator.clipboard.writeText(shareableText);
                  }
                }}
                variant="outline"
                className="w-full"
              >
                Copy to Clipboard
              </Button>
            </div>
            {shareableText && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 whitespace-pre-line max-h-40 overflow-y-auto">
                {shareableText}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function RecapViewer({
  recap,
  playerName,
  availableYears,
  currentYear,
  onYearChange,
  onRegenerate,
  shareableText,
}: RecapViewerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const isCornhole = recap.sport === "CORNHOLE";
  const winRate = recap.totalMatchesPlayed > 0 
    ? Math.round((recap.wins / recap.totalMatchesPlayed) * 100) 
    : 0;
  const eloChange = recap.endingElo - recap.startingElo;
  const eloChangeStr = eloChange >= 0 ? `+${Math.round(eloChange)}` : `${Math.round(eloChange)}`;

  // Generate slides based on recap data
  const slides: Slide[] = [];

  // Welcome slide
  slides.push({
    id: "welcome",
    title: `Your ${recap.seasonYear} Season`,
    subtitle: `${isCornhole ? 'Cornhole' : 'Darts'} Recap`,
    content: (
      <div className="text-center space-y-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
        >
          <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Trophy className="w-16 h-16 text-white" />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-white mb-2">{playerName}</h2>
          <p className="text-white/80 text-lg">Let&apos;s look back at your season</p>
        </motion.div>
      </div>
    ),
    bgGradient: "from-purple-600 via-purple-700 to-indigo-800",
  });

  // Tournaments slide
  slides.push({
    id: "tournaments",
    title: "Tournaments",
    content: (
      <div className="text-center space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="text-8xl font-bold text-white"
        >
          {recap.tournamentsPlayed}
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-white/80 text-xl"
        >
          Tournaments played
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center gap-8 mt-6"
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400">{recap.wins}</div>
            <div className="text-white/60 text-sm">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400">{recap.losses}</div>
            <div className="text-white/60 text-sm">Losses</div>
          </div>
        </motion.div>
      </div>
    ),
    bgGradient: "from-blue-600 via-blue-700 to-indigo-800",
  });

  // Win Rate slide
  slides.push({
    id: "winrate",
    title: "Win Rate",
    content: (
      <div className="text-center space-y-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="relative w-48 h-48 mx-auto">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="12"
              />
              <motion.circle
                cx="96"
                cy="96"
                r="88"
                fill="none"
                stroke={winRate >= 50 ? "#22c55e" : "#ef4444"}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 88}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 88 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 88 * (1 - winRate / 100) }}
                transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-5xl font-bold text-white">{winRate}%</span>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-white/80 text-lg">
            {recap.wins} wins out of {recap.totalMatchesPlayed} matches
          </p>
        </motion.div>
      </div>
    ),
    bgGradient: winRate >= 50 ? "from-green-600 via-green-700 to-emerald-800" : "from-orange-600 via-red-600 to-red-800",
  });

  // Elo Progress slide
  slides.push({
    id: "elo",
    title: "Rating Progress",
    content: (
      <div className="text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center items-center gap-4"
        >
          <div className="text-center">
            <Badge className="bg-white/20 text-white text-lg px-4 py-2">
              {recap.startingTier}
            </Badge>
            <div className="text-white/60 text-sm mt-2">Started</div>
            <div className="text-white font-bold mt-1">{Math.round(recap.startingElo)}</div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {eloChange >= 0 ? (
              <ArrowUp className="w-8 h-8 text-green-400" />
            ) : (
              <ArrowDown className="w-8 h-8 text-red-400" />
            )}
          </motion.div>
          <div className="text-center">
            <Badge className="bg-white/20 text-white text-lg px-4 py-2">
              {recap.endingTier}
            </Badge>
            <div className="text-white/60 text-sm mt-2">Ended</div>
            <div className="text-white font-bold mt-1">{Math.round(recap.endingElo)}</div>
          </div>
        </motion.div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          className={cn(
            "text-5xl font-bold",
            eloChange >= 0 ? "text-green-400" : "text-red-400"
          )}
        >
          {eloChangeStr} Elo
        </motion.div>
      </div>
    ),
    bgGradient: "from-indigo-600 via-purple-600 to-purple-800",
  });

  // Points slide
  slides.push({
    id: "points",
    title: "Points Earned",
    content: (
      <div className="text-center space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
        >
          <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
            <Star className="w-16 h-16 text-white" />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-7xl font-bold text-white"
        >
          {recap.totalPointsEarned.toLocaleString()}
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-white/80 text-xl"
        >
          Points earned this season
        </motion.p>
      </div>
    ),
    bgGradient: "from-amber-500 via-yellow-500 to-orange-600",
  });

  // Best Finish slide (if exists)
  if (recap.bestFinish) {
    slides.push({
      id: "bestfinish",
      title: "Best Tournament Finish",
      content: (
        <div className="text-center space-y-6">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center shadow-lg">
              {recap.bestFinish === 1 ? (
                <Crown className="w-16 h-16 text-yellow-800" />
              ) : recap.bestFinish === 2 ? (
                <Medal className="w-16 h-16 text-gray-300" />
              ) : recap.bestFinish === 3 ? (
                <Medal className="w-16 h-16 text-amber-600" />
              ) : (
                <Trophy className="w-16 h-16 text-yellow-800" />
              )}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-6xl font-bold text-white"
          >
            {recap.bestFinish === 1 ? "🥇 1st" : 
             recap.bestFinish === 2 ? "🥈 2nd" : 
             recap.bestFinish === 3 ? "🥉 3rd" : 
             `#${recap.bestFinish}`}
          </motion.div>
          {recap.bestTournamentName && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-white/80 text-lg"
            >
              at {recap.bestTournamentName}
            </motion.p>
          )}
        </div>
      ),
      bgGradient: recap.bestFinish === 1 
        ? "from-yellow-500 via-amber-500 to-orange-600" 
        : recap.bestFinish === 2 
          ? "from-slate-400 via-gray-500 to-gray-600"
          : "from-amber-600 via-amber-700 to-orange-700",
    });
  }

  // Signature Scoreline slide (if exists)
  if (recap.signatureScoreline) {
    slides.push({
      id: "scoreline",
      title: "Your Signature Win",
      content: (
        <div className="text-center space-y-6">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-white/80 text-xl"
          >
            Your most common winning score was
          </motion.p>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring" }}
            className="text-7xl font-bold text-white"
          >
            {recap.signatureScoreline}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex justify-center gap-4"
          >
            <Badge className="bg-white/20 text-white text-lg px-4 py-2">
              <Target className="w-4 h-4 mr-2" />
              Signature Win
            </Badge>
          </motion.div>
        </div>
      ),
      bgGradient: "from-cyan-600 via-blue-600 to-indigo-700",
    });
  }

  // Rival slide (if exists)
  if (recap.mostPlayedRivalName) {
    slides.push({
      id: "rival",
      title: "Your Biggest Rival",
      content: (
        <div className="text-center space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-lg">
              <Users className="w-16 h-16 text-white" />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-4xl font-bold text-white"
          >
            {recap.mostPlayedRivalName}
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="space-y-2"
          >
            <p className="text-white/80 text-lg">
              You played {recap.rivalMatchCount} times
            </p>
            <div className="text-3xl font-bold">
              <span className="text-green-400">{recap.rivalWinCount}</span>
              <span className="text-white/40"> - </span>
              <span className="text-red-400">{(recap.rivalMatchCount ?? 0) - (recap.rivalWinCount ?? 0)}</span>
            </div>
          </motion.div>
        </div>
      ),
      bgGradient: "from-red-600 via-rose-600 to-pink-700",
    });
  }

  // Longest Streak slide (if exists)
  if (recap.longestWinStreak > 0) {
    slides.push({
      id: "streak",
      title: "Longest Win Streak",
      content: (
        <div className="text-center space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
              <Flame className="w-16 h-16 text-white" />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-7xl font-bold text-white"
          >
            {recap.longestWinStreak}
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-white/80 text-xl"
          >
            consecutive wins
          </motion.p>
        </div>
      ),
      bgGradient: "from-orange-500 via-red-500 to-rose-600",
    });
  }

  // Hours Played slide (if exists)
  if (recap.estimatedHours) {
    slides.push({
      id: "hours",
      title: "Time on Court",
      content: (
        <div className="text-center space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Clock className="w-16 h-16 text-white" />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <span className="text-7xl font-bold text-white">{recap.estimatedHours}</span>
            <span className="text-3xl text-white/80 ml-2">hours</span>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-white/80 text-lg"
          >
            spent playing {isCornhole ? 'Cornhole' : 'Darts'}
          </motion.p>
        </div>
      ),
      bgGradient: "from-violet-600 via-purple-600 to-indigo-700",
    });
  }

  // Summary slide
  slides.push({
    id: "summary",
    title: "Your Season Summary",
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/10 backdrop-blur rounded-xl p-4 text-center"
          >
            <Trophy className="w-8 h-8 mx-auto text-yellow-400 mb-2" />
            <div className="text-2xl font-bold text-white">{recap.tournamentsPlayed}</div>
            <div className="text-white/60 text-sm">Tournaments</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur rounded-xl p-4 text-center"
          >
            <Target className="w-8 h-8 mx-auto text-green-400 mb-2" />
            <div className="text-2xl font-bold text-white">{recap.wins}W-{recap.losses}L</div>
            <div className="text-white/60 text-sm">Record</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/10 backdrop-blur rounded-xl p-4 text-center"
          >
            <Star className="w-8 h-8 mx-auto text-amber-400 mb-2" />
            <div className="text-2xl font-bold text-white">{recap.totalPointsEarned}</div>
            <div className="text-white/60 text-sm">Points</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/10 backdrop-blur rounded-xl p-4 text-center"
          >
            <TrendingUp className="w-8 h-8 mx-auto text-blue-400 mb-2" />
            <div className="text-2xl font-bold text-white">{eloChangeStr}</div>
            <div className="text-white/60 text-sm">Elo Change</div>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="pt-4"
        >
          <Button
            onClick={() => setShowShare(true)}
            className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Your Recap
          </Button>
        </motion.div>
      </div>
    ),
    bgGradient: "from-slate-700 via-slate-800 to-gray-900",
  });

  const totalSlides = slides.length;

  const goToNextSlide = () => {
    if (currentSlide < totalSlides - 1 && !isAnimating) {
      setIsAnimating(true);
      setCurrentSlide(currentSlide + 1);
      setTimeout(() => setIsAnimating(false), 500);
    }
  };

  const goToPrevSlide = () => {
    if (currentSlide > 0 && !isAnimating) {
      setIsAnimating(true);
      setCurrentSlide(currentSlide - 1);
      setTimeout(() => setIsAnimating(false), 500);
    }
  };

  const goToSlide = (index: number) => {
    if (!isAnimating && index >= 0 && index < totalSlides) {
      setIsAnimating(true);
      setCurrentSlide(index);
      setTimeout(() => setIsAnimating(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Year Selector */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex items-center gap-2">
          <select
            value={currentYear}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-4 py-2 text-sm backdrop-blur"
          >
            {availableYears.map(year => (
              <option key={year} value={year} className="bg-gray-800">
                {year} Season
              </option>
            ))}
          </select>
          {onRegenerate && (
            <Button
              onClick={onRegenerate}
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Gradient */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br transition-colors duration-700",
          slides[currentSlide].bgGradient
        )} />

        {/* Content */}
        <div className="relative z-10 w-full max-w-lg mx-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
            >
              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">
                  {slides[currentSlide].title}
                </h1>
                {slides[currentSlide].subtitle && (
                  <p className="text-white/60">{slides[currentSlide].subtitle}</p>
                )}
              </div>

              {/* Content */}
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="p-8">
                  {slides[currentSlide].content}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <Button
              onClick={goToPrevSlide}
              disabled={currentSlide === 0}
              variant="ghost"
              className="text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>

            {/* Slide Indicators */}
            <div className="flex gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    index === currentSlide 
                      ? "bg-white w-6" 
                      : "bg-white/30 hover:bg-white/50"
                  )}
                />
              ))}
            </div>

            <Button
              onClick={goToNextSlide}
              disabled={currentSlide === totalSlides - 1}
              variant="ghost"
              className="text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal 
        showShare={showShare} 
        onClose={() => setShowShare(false)} 
        shareableText={shareableText}
      />
    </div>
  );
}
