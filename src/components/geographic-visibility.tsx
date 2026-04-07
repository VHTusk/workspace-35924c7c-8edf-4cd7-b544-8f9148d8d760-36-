"use client";

import { Badge } from "@/components/ui/badge";
import { MapPin, Globe, Building2, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface GeographicVisibilityProps {
  scope: string;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  playerCity?: string | null;
  playerDistrict?: string | null;
  playerState?: string | null;
  compact?: boolean;
}

export function GeographicVisibility({
  scope,
  city,
  district,
  state,
  playerCity,
  playerDistrict,
  playerState,
  compact = false,
}: GeographicVisibilityProps) {
  const scopeColors: Record<string, string> = {
    CITY: "bg-blue-100 text-blue-700 border-blue-300",
    DISTRICT: "bg-purple-100 text-purple-700 border-purple-300",
    STATE: "bg-amber-100 text-amber-700 border-amber-300",
    NATIONAL: "bg-red-100 text-red-700 border-red-300",
  };

  const scopeIcons: Record<string, React.ReactNode> = {
    CITY: <Building2 className="w-3 h-3" />,
    DISTRICT: <MapPin className="w-3 h-3" />,
    STATE: <Landmark className="w-3 h-3" />,
    NATIONAL: <Globe className="w-3 h-3" />,
  };

  // Determine who can see this tournament
  const getVisibilityText = () => {
    switch (scope) {
      case "CITY":
        return `Players in ${city || "this city"}`;
      case "DISTRICT":
        return `Players in ${district || "this district"}`;
      case "STATE":
        return `Players in ${state || "this state"}`;
      case "NATIONAL":
        return "All players across India";
      default:
        return "All players";
    }
  };

  // Check if player can see this tournament
  const canPlayerSee = () => {
    if (scope === "NATIONAL") return true;
    if (scope === "STATE" && playerState === state) return true;
    if (scope === "DISTRICT" && playerDistrict === district) return true;
    if (scope === "CITY" && playerCity === city) return true;
    return false;
  };

  if (compact) {
    return (
      <Badge className={cn("text-xs", scopeColors[scope] || scopeColors.NATIONAL)}>
        {scopeIcons[scope]}
        <span className="ml-1">{scope}</span>
      </Badge>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge className={cn(scopeColors[scope] || scopeColors.NATIONAL)}>
          {scopeIcons[scope]}
          <span className="ml-1">{scope}</span>
        </Badge>
      </div>
      
      <p className="text-xs text-gray-500">
        <strong>Visible to:</strong> {getVisibilityText()}
      </p>

      {/* Hierarchy explanation */}
      <div className="bg-gray-50 rounded p-2 text-xs text-gray-600">
        <p>Players see tournaments at their level and above:</p>
        <p className="mt-1">
          {playerCity && <span>{playerCity} → </span>}
          {playerDistrict && <span>{playerDistrict} → </span>}
          {playerState && <span>{playerState} → </span>}
          National
        </p>
      </div>
    </div>
  );
}

// Component showing what a player can see
export function PlayerVisibilityScope({
  city,
  district,
  state,
}: {
  city?: string | null;
  district?: string | null;
  state?: string | null;
}) {
  const scopes = [];

  if (city) {
    scopes.push({
      level: "CITY",
      label: city,
      icon: <Building2 className="w-4 h-4" />,
    });
  }

  if (district) {
    scopes.push({
      level: "DISTRICT",
      label: district,
      icon: <MapPin className="w-4 h-4" />,
    });
  }

  if (state) {
    scopes.push({
      level: "STATE",
      label: state,
      icon: <Landmark className="w-4 h-4" />,
    });
  }

  scopes.push({
    level: "NATIONAL",
    label: "All India",
    icon: <Globe className="w-4 h-4" />,
  });

  const scopeColors: Record<string, string> = {
    CITY: "bg-blue-100 text-blue-700 border-blue-300",
    DISTRICT: "bg-purple-100 text-purple-700 border-purple-300",
    STATE: "bg-amber-100 text-amber-700 border-amber-300",
    NATIONAL: "bg-red-100 text-red-700 border-red-300",
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Your Tournament Visibility</p>
      <div className="flex flex-wrap gap-2">
        {scopes.map((scope, index) => (
          <div key={scope.level} className="flex items-center gap-1">
            <Badge
              variant="outline"
              className={cn("gap-1", scopeColors[scope.level])}
            >
              {scope.icon}
              {scope.label}
            </Badge>
            {index < scopes.length - 1 && (
              <span className="text-gray-300">→</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        You can see tournaments at all these levels
      </p>
    </div>
  );
}
