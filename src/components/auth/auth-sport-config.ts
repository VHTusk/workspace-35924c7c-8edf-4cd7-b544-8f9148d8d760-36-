import type { LucideIcon } from "lucide-react";
import { Target, Trophy } from "lucide-react";

export type AuthSportSlug = "cornhole" | "darts";

export type AuthSportOption = {
  slug: AuthSportSlug;
  label: string;
  tagline: string;
  icon: LucideIcon;
  accentText: string;
  accentBorder: string;
  accentBackground: string;
  accentButton: string;
  hoverBorder: string;
  tournamentsHref: string;
  leaderboardHref: string;
};

export const AUTH_SPORTS: AuthSportOption[] = [
  {
    slug: "cornhole",
    label: "Cornhole",
    tagline: "Throw. Score. Win.",
    icon: Trophy,
    accentText: "text-green-600 dark:text-green-400",
    accentBorder: "border-green-500/40",
    accentBackground: "bg-green-500/10 dark:bg-green-500/20",
    accentButton: "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600",
    hoverBorder: "hover:border-green-500/50",
    tournamentsHref: "/cornhole",
    leaderboardHref: "/cornhole/leaderboard",
  },
  {
    slug: "darts",
    label: "Darts",
    tagline: "Precision Meets Passion.",
    icon: Target,
    accentText: "text-teal-600 dark:text-teal-400",
    accentBorder: "border-teal-500/40",
    accentBackground: "bg-teal-500/10 dark:bg-teal-500/20",
    accentButton: "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600",
    hoverBorder: "hover:border-teal-500/50",
    tournamentsHref: "/darts",
    leaderboardHref: "/darts/leaderboard",
  },
];

export function normalizeAuthSport(input?: string | null): AuthSportSlug {
  if (!input) {
    return "cornhole";
  }

  const lowered = input.trim().toLowerCase();
  return lowered === "darts" ? "darts" : "cornhole";
}

export function getAuthSportOption(input?: string | null): AuthSportOption {
  const normalized = normalizeAuthSport(input);
  return AUTH_SPORTS.find((sport) => sport.slug === normalized) ?? AUTH_SPORTS[0];
}
