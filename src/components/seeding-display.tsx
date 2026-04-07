"use client";

import { Badge } from "@/components/ui/badge";
import { Trophy, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface SeedingDisplayProps {
  seedNumber: number;
  seedingMethod: string;
  totalPlayers?: number;
  sport: string;
  showMethod?: boolean;
  size?: "sm" | "default" | "lg";
}

export function SeedingDisplay({
  seedNumber,
  seedingMethod,
  totalPlayers,
  sport,
  showMethod = false,
  size = "default",
}: SeedingDisplayProps) {
  const isCornhole = sport === "cornhole";
  const primaryColor = isCornhole ? "bg-green-100 text-green-700" : "bg-teal-100 text-teal-700";

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    default: "text-sm px-2 py-0.5",
    lg: "text-base px-3 py-1",
  };

  const getSeedColor = () => {
    if (seedNumber === 1) return "bg-amber-100 text-amber-700 border-amber-300";
    if (seedNumber === 2) return "bg-gray-100 text-gray-600 border-gray-300";
    if (seedNumber === 3) return "bg-orange-100 text-orange-700 border-orange-300";
    if (seedNumber === 4) return "bg-stone-100 text-stone-600 border-stone-300";
    if (seedNumber <= 8) return "bg-slate-100 text-slate-600 border-slate-300";
    return "bg-gray-50 text-gray-500 border-gray-200";
  };

  const getMethodLabel = () => {
    switch (seedingMethod) {
      case "ELO":
        return "Seeded by Rating";
      case "RANDOM":
        return "Random Draw";
      case "MANUAL":
        return "Custom Seeding";
      default:
        return seedingMethod;
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Seed Number */}
      <Badge
        variant="outline"
        className={cn("font-bold gap-1", sizeClasses[size], getSeedColor())}
      >
        <Hash className="w-3 h-3" />
        {seedNumber}
      </Badge>

      {/* Method Badge */}
      {showMethod && (
        <Badge
          variant="outline"
          className={cn("text-xs", primaryColor)}
        >
          <Trophy className="w-3 h-3 mr-1" />
          {getMethodLabel()}
        </Badge>
      )}

      {/* Position indicator for top seeds */}
      {seedNumber <= 4 && (
        <span className="text-xs text-gray-500">
          {seedNumber === 1 ? "Top Seed" : `#${seedNumber} Seed`}
        </span>
      )}
    </div>
  );
}

// Bracket seed list component
export function SeedList({
  players,
  seedingMethod,
  sport,
}: {
  players: Array<{
    id: string;
    firstName: string;
    lastName: string;
    hiddenElo: number;
    visiblePoints: number;
    seedNumber: number;
  }>;
  seedingMethod: string;
  sport: string;
}) {
  return (
    <div className="space-y-2">
      {/* Seeding Method Header */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">Bracket Seeds</span>
        <Badge variant="outline" className="text-xs">
          {seedingMethod === "ELO" ? "Elo-based seeding" : seedingMethod}
        </Badge>
      </div>

      {/* Seeds List */}
      <div className="max-h-64 overflow-y-auto space-y-1">
        {players
          .sort((a, b) => a.seedNumber - b.seedNumber)
          .map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
            >
              <div className="flex items-center gap-3">
                <SeedingDisplay
                  seedNumber={player.seedNumber}
                  seedingMethod={seedingMethod}
                  sport={sport}
                  size="sm"
                />
                <span className="font-medium text-gray-900">
                  {player.firstName} {player.lastName}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{player.visiblePoints.toLocaleString()} pts</span>
                {seedingMethod === "ELO" && (
                  <span title="Hidden Elo">Elo: {Math.round(player.hiddenElo)}</span>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Seeding Explanation */}
      <div className="bg-gray-50 rounded p-3 text-xs text-gray-600">
        {seedingMethod === "ELO" ? (
          <>
            <p className="font-medium mb-1">Elo-Based Seeding</p>
            <p>Players are seeded by their hidden Elo rating (descending). Higher seeds play lower seeds in early rounds.</p>
          </>
        ) : seedingMethod === "RANDOM" ? (
          <>
            <p className="font-medium mb-1">Random Draw</p>
            <p>Seeds were assigned randomly for this tournament.</p>
          </>
        ) : (
          <>
            <p className="font-medium mb-1">Custom Seeding</p>
            <p>Seeds were manually assigned by tournament organizers.</p>
          </>
        )}
      </div>
    </div>
  );
}
