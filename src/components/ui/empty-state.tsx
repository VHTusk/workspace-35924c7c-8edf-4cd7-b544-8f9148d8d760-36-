"use client";

import { Button } from "@/components/ui/button";
import { 
  Trophy, 
  Calendar, 
  BarChart3, 
  Users, 
  MessageCircle, 
  Bell, 
  FileText,
  Medal,
  Target,
  Sparkles,
  LucideIcon
} from "lucide-react";
import Link from "next/link";

// ============================================
// Types
// ============================================

interface EmptyStateProps {
  icon?: LucideIcon;
  type?: "tournaments" | "matches" | "stats" | "messages" | "notifications" | "documents" | "leaderboard" | "achievements" | "generic";
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  sport?: string;
}

// ============================================
// Icon Mapping
// ============================================

const typeIconMap: Record<string, LucideIcon> = {
  tournaments: Trophy,
  matches: Target,
  stats: BarChart3,
  messages: MessageCircle,
  notifications: Bell,
  documents: FileText,
  leaderboard: Medal,
  achievements: Sparkles,
  generic: FileText,
};

const typeColorMap: Record<string, string> = {
  tournaments: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  matches: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  stats: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  messages: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  notifications: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  documents: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  leaderboard: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  achievements: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
  generic: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// ============================================
// Component
// ============================================

export function EmptyState({
  icon,
  type = "generic",
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  sport,
}: EmptyStateProps) {
  const IconComponent = icon || typeIconMap[type] || FileText;
  const iconColorClass = typeColorMap[type] || typeColorMap.generic;
  
  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBgLight = isCornhole ? "bg-green-50 dark:bg-green-900/20" : "bg-teal-50 dark:bg-teal-900/20";

  return (
    <div className="empty-state">
      {/* Icon with decorative background */}
      <div className="relative mb-6">
        <div className={`absolute inset-0 rounded-full blur-xl ${primaryBgLight} opacity-50`} />
        <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center ${iconColorClass} bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-lg border border-gray-100 dark:border-gray-700`}>
          <IconComponent className="w-8 h-8" />
        </div>
      </div>

      {/* Content */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        {description}
      </p>

      {/* Optional Action */}
      {(actionLabel && (actionHref || onAction)) && (
        actionHref ? (
          <Button asChild className={`${primaryBgClass} text-white gap-2`}>
            <Link href={actionHref}>
              {type === "tournaments" && <Trophy className="w-4 h-4" />}
              {type === "matches" && <Target className="w-4 h-4" />}
              {type === "achievements" && <Sparkles className="w-4 h-4" />}
              {actionLabel}
            </Link>
          </Button>
        ) : (
          <Button 
            onClick={onAction} 
            className={`${primaryBgClass} text-white gap-2`}
          >
            {type === "tournaments" && <Trophy className="w-4 h-4" />}
            {type === "matches" && <Target className="w-4 h-4" />}
            {type === "achievements" && <Sparkles className="w-4 h-4" />}
            {actionLabel}
          </Button>
        )
      )}
    </div>
  );
}

// ============================================
// Preset Components
// ============================================

export function NoTournaments({ sport }: { sport: string }) {
  return (
    <EmptyState
      type="tournaments"
      sport={sport}
      title="No tournaments found"
      description="There are no tournaments available right now. Check back soon for new competitions!"
      actionLabel="Browse Tournaments"
      actionHref={`/${sport}/tournaments`}
    />
  );
}

export function NoUpcomingMatches({ sport }: { sport: string }) {
  return (
    <EmptyState
      type="matches"
      sport={sport}
      title="No upcoming matches"
      description="You don't have any scheduled matches. Register for a tournament to get started!"
      actionLabel="Find Tournaments"
      actionHref={`/${sport}/tournaments`}
    />
  );
}

export function NoStats({ sport }: { sport: string }) {
  return (
    <EmptyState
      type="stats"
      sport={sport}
      title="No stats yet"
      description="Play some matches to see your statistics and performance analytics here."
    />
  );
}

export function NoMessages({ sport }: { sport: string }) {
  return (
    <EmptyState
      type="messages"
      sport={sport}
      title="No messages"
      description="Your inbox is empty. Start a conversation by messaging another player!"
    />
  );
}

export function NoNotifications({ sport }: { sport: string }) {
  return (
    <EmptyState
      type="notifications"
      sport={sport}
      title="All caught up!"
      description="You have no new notifications. We'll let you know when something important happens."
    />
  );
}

export function NoAchievements({ sport }: { sport: string }) {
  return (
    <EmptyState
      type="achievements"
      sport={sport}
      title="No achievements yet"
      description="Complete challenges and participate in tournaments to earn badges and achievements!"
      actionLabel="View Challenges"
      actionHref={`/${sport}/milestones`}
    />
  );
}

export function NoSearchResults({ 
  sport, 
  query 
}: { 
  sport: string; 
  query?: string;
}) {
  return (
    <EmptyState
      type="generic"
      sport={sport}
      icon={Users}
      title="No results found"
      description={query 
        ? `We couldn't find anything matching "${query}". Try a different search term.`
        : "We couldn't find any results. Try adjusting your filters or search terms."
      }
    />
  );
}

export default EmptyState;
