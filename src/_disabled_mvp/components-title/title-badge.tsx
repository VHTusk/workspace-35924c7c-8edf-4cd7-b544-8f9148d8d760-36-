"use client";

import { cn } from "@/lib/utils";
import { TitleType } from "@prisma/client";
import { TITLE_CONFIG } from "@/lib/titles";
import { Crown, Trophy, Star, Medal, Award, Shield } from "lucide-react";

interface TitleBadgeProps {
  titleType: TitleType;
  location?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  showIcon?: boolean;
  showLocation?: boolean;
  className?: string;
  variant?: "default" | "minimal" | "glow";
}

const ICON_MAP: Record<string, React.ElementType> = {
  "👑": Crown,
  "🏆": Trophy,
  "⭐": Star,
  "🥉": Medal,
  "🎖️": Shield,
  "🏅": Award,
};

export function TitleBadge({
  titleType,
  location,
  size = "md",
  showIcon = true,
  showLocation = true,
  className,
  variant = "default",
}: TitleBadgeProps) {
  const config = TITLE_CONFIG[titleType];
  
  if (!config) return null;

  const IconComponent = ICON_MAP[config.icon] || Trophy;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-sm gap-1.5",
    lg: "px-4 py-1.5 text-base gap-2",
    xl: "px-5 py-2 text-lg gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
    xl: "w-6 h-6",
  };

  const displayLocation = showLocation && location;
  const displayText = displayLocation 
    ? `${config.shortName} - ${location}`
    : config.shortName;

  if (variant === "minimal") {
    return (
      <span
        className={cn(
          "inline-flex items-center font-semibold rounded-full",
          sizeClasses[size],
          config.color,
          className
        )}
      >
        {showIcon && (
          <span className="text-base">{config.icon}</span>
        )}
        <span>{displayText}</span>
      </span>
    );
  }

  if (variant === "glow") {
    return (
      <div
        className={cn(
          "relative inline-flex items-center rounded-full font-bold shadow-lg",
          sizeClasses[size],
          className
        )}
        style={{
          background: `linear-gradient(135deg, ${config.bgColor} 0%, ${config.bgColor}dd 100%)`,
          boxShadow: `0 0 20px ${config.borderColor.replace('border-', '').replace('/30', '')}40`,
        }}
      >
        {showIcon && (
          <span className="text-lg animate-pulse">{config.icon}</span>
        )}
        <span className={config.color}>{displayText}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-semibold border",
        sizeClasses[size],
        config.bgColor,
        config.color,
        config.borderColor,
        className
      )}
    >
      {showIcon && <IconComponent className={iconSizes[size]} />}
      <span>{displayText}</span>
    </div>
  );
}

// Display multiple titles in a row
interface TitleListProps {
  titles: Array<{
    titleType: TitleType;
    city?: string | null;
    district?: string | null;
    state?: string | null;
    isPrimary?: boolean;
  }>;
  maxDisplay?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TitleList({
  titles,
  maxDisplay = 3,
  size = "md",
  className,
}: TitleListProps) {
  if (!titles || titles.length === 0) return null;

  const displayTitles = titles.slice(0, maxDisplay);
  const remainingCount = titles.length - maxDisplay;

  // Sort by priority
  const sortedTitles = displayTitles.sort((a, b) => {
    const priorityA = TITLE_CONFIG[a.titleType]?.priority || 0;
    const priorityB = TITLE_CONFIG[b.titleType]?.priority || 0;
    return priorityB - priorityA;
  });

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {sortedTitles.map((title, index) => {
        const location = title.city || title.district || title.state;
        return (
          <TitleBadge
            key={`${title.titleType}-${index}`}
            titleType={title.titleType}
            location={location}
            size={size}
            variant={title.isPrimary ? "glow" : "default"}
          />
        );
      })}
      {remainingCount > 0 && (
        <span className="text-xs text-muted-foreground font-medium">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}

// Large title display for profile hero
interface HeroTitleProps {
  titleType: TitleType;
  location?: string | null;
  playerName?: string;
  className?: string;
}

export function HeroTitle({
  titleType,
  location,
  playerName,
  className,
}: HeroTitleProps) {
  const config = TITLE_CONFIG[titleType];
  
  if (!config) return null;

  return (
    <div className={cn("text-center", className)}>
      <div
        className={cn(
          "inline-flex items-center gap-3 px-6 py-3 rounded-2xl",
          "bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20",
          "border border-amber-500/30 shadow-xl"
        )}
      >
        <span className="text-4xl animate-bounce">{config.icon}</span>
        <div className="text-left">
          <p className="text-lg font-bold text-amber-400">{config.name}</p>
          {location && (
            <p className="text-sm text-amber-300/80">{location}</p>
          )}
        </div>
      </div>
      {playerName && (
        <p className="mt-3 text-lg text-muted-foreground">
          {playerName} is the current {config.name.toLowerCase()}
          {location && ` of ${location}`}
        </p>
      )}
    </div>
  );
}

// Title card for title selection/manage
interface TitleCardProps {
  title: {
    id: string;
    titleType: TitleType;
    scope: string;
    city?: string | null;
    district?: string | null;
    state?: string | null;
    rank?: number | null;
    points?: number | null;
    awardedAt: Date | string;
    isPrimary?: boolean;
    isActive?: boolean;
  };
  onSelect?: () => void;
  isSelected?: boolean;
  className?: string;
}

export function TitleCard({
  title,
  onSelect,
  isSelected,
  className,
}: TitleCardProps) {
  const config = TITLE_CONFIG[title.titleType];
  
  if (!config) return null;

  const location = title.city || title.district || title.state;
  const awardedDate = new Date(title.awardedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className={cn(
        "relative p-4 rounded-xl border transition-all cursor-pointer",
        "hover:shadow-lg hover:scale-[1.02]",
        isSelected
          ? "border-amber-500/50 bg-amber-500/5 shadow-md"
          : "border-border/50 bg-card/50 hover:border-border",
        className
      )}
      onClick={onSelect}
    >
      {title.isPrimary && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
          PRIMARY
        </div>
      )}
      
      <div className="flex items-start gap-3">
        <span className="text-3xl">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={cn("font-bold", config.color)}>{config.name}</p>
          {location && (
            <p className="text-sm text-muted-foreground">{location}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {title.rank && (
              <span className="px-2 py-0.5 bg-muted rounded-full">
                Rank #{title.rank}
              </span>
            )}
            {title.points && (
              <span className="px-2 py-0.5 bg-muted rounded-full">
                {title.points.toLocaleString()} pts
              </span>
            )}
            <span className="px-2 py-0.5 bg-muted rounded-full">
              Earned {awardedDate}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
