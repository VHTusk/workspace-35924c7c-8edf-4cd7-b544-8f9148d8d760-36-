/**
 * Tournament Colors Utility
 * 
 * Shared color mappings for tournament scope and status badges.
 * Uses CSS variables from globals.css for theme consistency.
 */

/**
 * Tournament scope color classes
 * Uses theme-aware colors that work in both light and dark mode
 */
export const scopeColors: Record<string, string> = {
  CITY: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
  DISTRICT: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800",
  STATE: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  NATIONAL: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
};

/**
 * Tournament status color classes (for database statuses)
 * Uses theme-aware colors that work in both light and dark mode
 */
export const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  REGISTRATION_OPEN: "bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400",
  REGISTRATION_CLOSED: "bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
  BRACKET_GENERATED: "bg-teal-100 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400",
  IN_PROGRESS: "bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
  COMPLETED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  CANCELLED: "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400",
};

/**
 * Get scope color classes with fallback
 */
export function getScopeColor(scope: string): string {
  return scopeColors[scope] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

/**
 * Get status color classes with fallback
 */
export function getStatusColor(status: string): string {
  return statusColors[status] || "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
}

/**
 * Sport-specific primary colors
 * Returns Tailwind classes for sport-themed elements
 */
export const sportColors = {
  cornhole: {
    primary: "text-green-600 dark:text-green-400",
    primaryBg: "bg-green-100 dark:bg-green-950/30",
    primaryBtn: "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600",
    primaryBorder: "border-green-500 dark:border-green-600",
    gradient: "from-green-500 to-emerald-600",
    ring: "ring-green-500",
  },
  darts: {
    primary: "text-teal-600 dark:text-teal-400",
    primaryBg: "bg-teal-100 dark:bg-teal-950/30",
    primaryBtn: "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600",
    primaryBorder: "border-teal-500 dark:border-teal-600",
    gradient: "from-teal-500 to-cyan-600",
    ring: "ring-teal-500",
  },
} as const;

type SportColorSet = (typeof sportColors)[keyof typeof sportColors];

/**
 * Get sport-specific colors
 */
export function getSportColors(sport: string): SportColorSet {
  return sportColors[sport as keyof typeof sportColors] || sportColors.cornhole;
}

/**
 * Match status colors for bracket display
 */
export const matchStatusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-600 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  LIVE: "bg-red-100 text-red-600 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
  COMPLETED: "bg-emerald-100 text-emerald-600 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  BYE: "bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
};

/**
 * Get match status color
 */
export function getMatchStatusColor(status: string): string {
  return matchStatusColors[status] || matchStatusColors.PENDING;
}
