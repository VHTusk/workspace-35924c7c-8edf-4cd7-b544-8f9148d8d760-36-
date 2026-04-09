"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { getTierFromPoints } from "@/lib/tier";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Zap, Calendar } from "lucide-react";

interface PlayerCardProps {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    age?: number | null;
    gender?: string | null;
    photoUrl?: string | null;
    visiblePoints: number;
    hiddenElo?: number;
    sport: string;
    district?: string | null;
    state?: string | null;
    organization?: {
      name: string;
    } | null;
  };
  stats?: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    tournamentsPlayed: number;
    tournamentsWon: number;
  };
  qrCodeUrl?: string;
  className?: string;
  sport: "cornhole" | "darts";
}

export const PlayerCard = forwardRef<HTMLDivElement, PlayerCardProps>(
  ({ player, stats, qrCodeUrl, className, sport }, ref) => {
    const tier = getTierFromPoints(player.visiblePoints);
    const isCornhole = sport === "cornhole";
    const primaryColor = isCornhole ? "#16a34a" : "#0d9488";
    const secondaryColor = isCornhole ? "#15803d" : "#0f766e";
    const accentColor = tier.color;

    const winRate =
      stats && stats.matchesPlayed > 0
        ? Math.round((stats.wins / stats.matchesPlayed) * 100)
        : 0;

    return (
      <div
        ref={ref}
        className={cn(
          "w-full max-w-[400px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl overflow-hidden shadow-2xl print:shadow-none",
          className
        )}
        style={{ minHeight: "500px" }}
      >
        {/* Top Accent Bar */}
        <div
          className="h-2"
          style={{
            background: `linear-gradient(90deg, ${accentColor} 0%, ${primaryColor} 100%)`,
          }}
        />

        {/* Content */}
        <div className="p-6">
          {/* Header - Tier Badge & Sport */}
          <div className="flex items-center justify-between mb-6">
            <Badge
              className="px-4 py-1.5 text-sm font-bold uppercase tracking-wide"
              style={{
                backgroundColor: accentColor,
                color: tier.name === "Diamond" ? "#000" : "#fff",
              }}
            >
              {tier.name}
            </Badge>
            <div className="flex items-center gap-1.5 text-slate-400 text-sm">
              <Target className="w-4 h-4" />
              <span className="uppercase font-semibold tracking-wide">
                {sport}
              </span>
            </div>
          </div>

          {/* Player Info */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <Avatar className="w-20 h-20 border-4 border-slate-700">
                <AvatarImage src={player.photoUrl || ""} />
                <AvatarFallback
                  className="text-2xl font-bold"
                  style={{
                    backgroundColor: `${accentColor}30`,
                    color: accentColor,
                  }}
                >
                  {player.firstName.charAt(0)}
                  {player.lastName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {/* Tier ring */}
              <div
                className="absolute inset-0 rounded-full border-2 opacity-50"
                style={{ borderColor: accentColor }}
              />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">
                {player.firstName} {player.lastName}
              </h2>
              {player.organization && (
                <p className="text-slate-400 text-sm mt-0.5">
                  {player.organization.name}
                </p>
              )}
              {player.district && player.state && (
                <p className="text-slate-500 text-xs mt-1">
                  {player.district}, {player.state}
                </p>
              )}
              {(player.age || player.gender) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {player.age ? (
                    <Badge className="border-0 bg-white/10 text-slate-100">
                      {player.age} yrs
                    </Badge>
                  ) : null}
                  {player.gender ? (
                    <Badge className="border-0 bg-white/10 text-slate-100">
                      {player.gender.charAt(0) + player.gender.slice(1).toLowerCase()}
                    </Badge>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {/* Points */}
            <div className="bg-slate-800/50 rounded-xl p-3 text-center border border-slate-700/50">
              <div
                className="text-2xl font-bold"
                style={{ color: accentColor }}
              >
                {player.visiblePoints.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mt-1">
                Points
              </div>
            </div>

            {/* Matches */}
            <div className="bg-slate-800/50 rounded-xl p-3 text-center border border-slate-700/50">
              <div className="text-2xl font-bold text-blue-400">
                {stats?.matchesPlayed || 0}
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mt-1">
                Matches
              </div>
            </div>

            {/* Win Rate */}
            <div className="bg-slate-800/50 rounded-xl p-3 text-center border border-slate-700/50">
              <div className="text-2xl font-bold text-green-400">{winRate}%</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mt-1">
                Win Rate
              </div>
            </div>
          </div>

          {/* Wins/Losses */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-green-900/20 rounded-xl p-3 flex items-center justify-center gap-2 border border-green-800/30">
              <Trophy className="w-5 h-5 text-green-400" />
              <div>
                <div className="text-xl font-bold text-green-400">
                  {stats?.wins || 0}
                </div>
                <div className="text-xs text-slate-400">Wins</div>
              </div>
            </div>
            <div className="bg-red-900/20 rounded-xl p-3 flex items-center justify-center gap-2 border border-red-800/30">
              <Zap className="w-5 h-5 text-red-400" />
              <div>
                <div className="text-xl font-bold text-red-400">
                  {stats?.losses || 0}
                </div>
                <div className="text-xs text-slate-400">Losses</div>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex items-center justify-center gap-4">
            {qrCodeUrl ? (
              <div className="bg-white rounded-lg p-2">
                {/* QR Code placeholder - in production, use actual QR */}
                <div className="w-24 h-24 bg-slate-100 flex items-center justify-center">
                  <div className="grid grid-cols-5 gap-0.5">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-4 h-4 rounded-sm",
                          Math.random() > 0.5 ? "bg-slate-800" : "bg-white"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-3 w-24 h-24 flex items-center justify-center border border-slate-700">
                <div className="text-center">
                  <div className="text-xs text-slate-400">Scan to</div>
                  <div className="text-xs text-slate-300 font-medium">Verify</div>
                </div>
              </div>
            )}
            <div className="text-center">
              <p className="text-slate-300 text-sm font-medium">Player ID</p>
              <p className="text-slate-500 text-xs font-mono">
                {player.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 text-center"
          style={{
            background: `linear-gradient(90deg, ${primaryColor}20, ${secondaryColor}20)`,
          }}
        >
          <p className="text-slate-400 text-xs flex items-center justify-center gap-1">
            <Calendar className="w-3 h-3" />
            Issued: {new Date().toLocaleDateString()} • VALORHIVE
          </p>
        </div>
      </div>
    );
  }
);

PlayerCard.displayName = "PlayerCard";
