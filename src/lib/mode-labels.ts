/**
 * Centralized label mapping for INTRA_ORG / INTER_ORG modes
 * 
 * This utility provides consistent UI labels across the platform.
 * Backend enums (INTRA_ORG, INTER_ORG) remain unchanged.
 * 
 * Mapping:
 * - INTRA_ORG → "Internal" (within organization)
 * - INTER_ORG → "External" (competing with other organizations)
 */

/**
 * Get the display label for tournament/mode type
 * @param type - The tournament type enum value
 * @returns User-friendly display label
 */
export function getModeLabel(type: string | undefined | null): string {
  if (type === "INTRA_ORG" || type === "intra") return "Internal";
  if (type === "INTER_ORG" || type === "inter") return "External";
  return type || "";
}

/**
 * Get the full mode name for titles and headings
 * @param type - The tournament type enum value
 * @returns Full mode name for display
 */
export function getModeFullName(type: string | undefined | null): string {
  if (type === "INTRA_ORG" || type === "intra") return "Internal";
  if (type === "INTER_ORG" || type === "inter") return "External";
  return type || "";
}

/**
 * Get mode description for helper text
 * @param type - The tournament type enum value
 * @returns Description of the mode
 */
export function getModeDescription(type: string | undefined | null): string {
  if (type === "INTRA_ORG" || type === "intra") {
    return "Within your organization";
  }
  if (type === "INTER_ORG" || type === "inter") {
    return "Competing with other organizations";
  }
  return "";
}

/**
 * Get dashboard title based on mode
 * @param type - The tournament type enum value
 * @returns Dashboard title
 */
export function getDashboardTitle(type: string | undefined | null): string {
  if (type === "INTRA_ORG" || type === "intra") return "Internal Dashboard";
  if (type === "INTER_ORG" || type === "inter") return "External Dashboard";
  return "Dashboard";
}

/**
 * Get tournament label based on mode
 * @param type - The tournament type enum value
 * @returns Tournament section label
 */
export function getTournamentLabel(type: string | undefined | null): string {
  if (type === "INTRA_ORG" || type === "intra") return "Internal Tournaments";
  if (type === "INTER_ORG" || type === "inter") return "External Tournaments";
  return "Tournaments";
}

/**
 * Get leaderboard label based on mode
 * @param type - The tournament type enum value
 * @returns Leaderboard section label
 */
export function getLeaderboardLabel(type: string | undefined | null): string {
  if (type === "INTRA_ORG" || type === "intra") return "Leaderboard";
  if (type === "INTER_ORG" || type === "inter") return "Leaderboard";
  return "Leaderboard";
}

/**
 * Get analytics label based on mode
 * @param type - The tournament type enum value
 * @returns Analytics section label
 */
export function getAnalyticsLabel(type: string | undefined | null): string {
  if (type === "INTRA_ORG" || type === "intra") return "Internal Analytics";
  if (type === "INTER_ORG" || type === "inter") return "External Analytics";
  return "Analytics";
}

/**
 * Convert mode string to standard format
 * @param mode - Mode string (could be "intra", "inter", "INTRA_ORG", "INTER_ORG")
 * @returns Standardized mode string for comparison
 */
export function normalizeMode(mode: string | undefined | null): "intra" | "inter" | null {
  if (!mode) return null;
  const lower = mode.toLowerCase();
  if (lower === "intra" || lower === "intra_org") return "intra";
  if (lower === "inter" || lower === "inter_org") return "inter";
  return null;
}
