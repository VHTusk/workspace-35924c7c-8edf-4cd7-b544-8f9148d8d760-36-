"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Inbox, 
  Trophy, 
  Users, 
  Calendar, 
  FileText, 
  Search, 
  MapPin, 
  Medal,
  Target,
  Gamepad2,
  LucideIcon
} from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({ 
  icon: Icon = Inbox, 
  title, 
  description, 
  action,
  className,
  size = "md"
}: EmptyStateProps) {
  const sizes = {
    sm: "py-6",
    md: "py-12",
    lg: "py-20",
  };

  return (
    <div className={cn("text-center", sizes[size], className)}>
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">{description}</p>
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Pre-configured empty states for common scenarios
export function NoTournaments({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Trophy}
      title="No Tournaments Found"
      description="There are no tournaments available at the moment. Check back later or create one if you're an organizer."
      action={onAction ? { label: "Browse Tournaments", onClick: onAction } : undefined}
    />
  );
}

export function NoRegistrations({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Calendar}
      title="No Registrations Yet"
      description="You haven't registered for any tournaments. Find tournaments that match your skill level and start competing!"
      action={onAction ? { label: "Find Tournaments", onClick: onAction } : undefined}
    />
  );
}

export function NoMatches({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Gamepad2}
      title="No Match History"
      description="You haven't played any matches yet. Register for a tournament to start your competitive journey!"
      action={onAction ? { label: "View Tournaments", onClick: onAction } : undefined}
    />
  );
}

export function NoFollowers({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No Followers Yet"
      description="You don't have any followers yet. Keep playing and engaging with the community to grow your network!"
      action={onAction ? { label: "Explore Players", onClick: onAction } : undefined}
    />
  );
}

export function NoFollowing({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="Not Following Anyone"
      description="You're not following any players yet. Discover talented players and stay updated on their performance."
      action={onAction ? { label: "Discover Players", onClick: onAction } : undefined}
    />
  );
}

export function NoNotifications({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Inbox}
      title="No Notifications"
      description="You're all caught up! New notifications about tournaments, matches, and activity will appear here."
      action={onAction ? { label: "Refresh", onClick: onAction } : undefined}
      size="sm"
    />
  );
}

export function NoSearchResults({ query, onAction }: { query?: string; onAction?: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No Results Found"
      description={query 
        ? `We couldn't find any results for "${query}". Try different keywords or check your spelling.`
        : "Try adjusting your search or filters to find what you're looking for."
      }
      action={onAction ? { label: "Clear Filters", onClick: onAction } : undefined}
    />
  );
}

export function NoAchievements({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Medal}
      title="No Achievements Yet"
      description="Start participating in tournaments to earn badges and achievements. Your first win is waiting!"
      action={onAction ? { label: "View Badges", onClick: onAction } : undefined}
    />
  );
}

export function NoDisputes({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="No Disputes"
      description="You have no active disputes. If you have a concern about a match result, you can raise a dispute."
      action={onAction ? { label: "View History", onClick: onAction } : undefined}
    />
  );
}

export function NoTeams({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No Teams Yet"
      description="You haven't created or joined any teams. Create a team to participate in doubles or team tournaments."
      action={onAction ? { label: "Create Team", onClick: onAction } : undefined}
    />
  );
}

export function NoVenues({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={MapPin}
      title="No Venues Available"
      description="There are no venues configured for this area. Contact support if you're a tournament organizer."
      action={onAction ? { label: "Contact Support", onClick: onAction } : undefined}
    />
  );
}

export function NoStats({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Target}
      title="No Stats Available"
      description="Your performance statistics will appear here after you've played a few matches."
      action={onAction ? { label: "View Matches", onClick: onAction } : undefined}
    />
  );
}

// Loading skeleton wrapper
export function EmptyStateSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("text-center py-12", className)}>
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted animate-pulse mb-4" />
      <div className="h-5 w-48 bg-muted rounded animate-pulse mx-auto mb-2" />
      <div className="h-4 w-64 bg-muted rounded animate-pulse mx-auto" />
    </div>
  );
}
