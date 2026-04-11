/**
 * Sport Theme Utilities for VALORHIVE
 *
 * This module provides centralized sport-specific theming utilities
 * for the multi-sport tournament platform. It encapsulates all sport-specific
 * styling logic that was previously duplicated across 80+ files.
 *
 * @module sport-theme
 */

// ============================================
// TYPES
// ============================================

export type SportType = "cornhole" | "darts";

/**
 * Complete sport theme configuration
 */
export interface SportTheme {
  /** Sport identifier */
  sport: SportType;
  /** Display name */
  name: string;
  /** Primary color hex (light mode) */
  primaryColor: string;
  /** Primary color hex (dark mode) */
  primaryColorDark: string;
  /** Secondary color hex */
  secondaryColor: string;
  /** Accent color hex (light mode) */
  accentColor: string;
  /** Accent color hex (dark mode) */
  accentColorDark: string;

  // CSS Custom Property references
  /** CSS variable for sport primary color */
  cssPrimary: string;
  /** CSS variable for sport secondary color */
  cssSecondary: string;
  /** CSS variable for sport accent color */
  cssAccent: string;

  // Tailwind color references
  /** Tailwind color name (e.g., 'green', 'teal') */
  tailwindColor: string;
  /** Tailwind numeric shade for primary */
  tailwindShade: number;

  // Images
  /** Hero image path */
  heroImage: string;
  /** Tournament scene image path */
  tournamentImage: string;
  /** Action shot image path */
  actionImage: string;
  /** Trophy/presentation image path */
  trophyImage: string;

  // Semantic colors
  /** Status live color */
  statusLiveColor: string;
  /** Status live background */
  statusLiveBg: string;
}

/**
 * Pre-computed Tailwind CSS classes for sport styling
 */
export interface SportStylingClasses {
  // Text colors
  primaryText: string;
  primaryTextLight: string;
  primaryTextMuted: string;

  // Background colors
  primaryBg: string;
  primaryBgHover: string;
  primaryBgLight: string;
  primaryBgMuted: string;
  primaryBgSubtle: string;

  // Button styles
  primaryBtn: string;
  primaryBtnOutline: string;
  primaryBtnGhost: string;

  // Border colors
  primaryBorder: string;
  primaryBorderLight: string;
  primaryBorderMuted: string;

  // Ring/focus colors
  primaryRing: string;
  focusRing: string;

  // Gradients
  gradientPrimary: string;
  gradientHero: string;

  // Glow shadows
  glowPrimary: string;
  glowPrimarySm: string;
  glowPrimaryLg: string;

  // Accent colors
  accentText: string;
  accentBg: string;
  accentBorder: string;
}

// ============================================
// THEME CONFIGURATIONS
// ============================================

/**
 * Cornhole theme configuration
 * Green + Amber palette - Outdoor, grass, sunshine
 */
const CORNHOLE_THEME: SportTheme = {
  sport: "cornhole",
  name: "Cornhole",

  // Colors
  primaryColor: "#059669", // Emerald 600
  primaryColorDark: "#10B981", // Emerald 500
  secondaryColor: "#065F46", // Emerald 800
  accentColor: "#F59E0B", // Amber 500
  accentColorDark: "#FBBF24", // Amber 400

  // CSS Variables
  cssPrimary: "var(--sport-primary)",
  cssSecondary: "var(--sport-secondary)",
  cssAccent: "var(--sport-accent)",

  // Tailwind references
  tailwindColor: "green",
  tailwindShade: 600,

  // Images
  heroImage: "/images/hero/cornhole/focused-shot.png",
  tournamentImage: "/images/hero/cornhole/tournament-progress.png",
  actionImage: "/images/hero/cornhole/action-panels.png",
  trophyImage: "/images/hero/cornhole/league-court-setup.png",

  // Semantic
  statusLiveColor: "#22C55E", // Green 500
  statusLiveBg: "#DCFCE7", // Green 100
};

/**
 * Darts theme configuration
 * Teal + Orange palette - Indoor, pub, precision
 */
const DARTS_THEME: SportTheme = {
  sport: "darts",
  name: "Darts",

  // Colors
  primaryColor: "#0D9488", // Teal 600
  primaryColorDark: "#14B8A6", // Teal 500
  secondaryColor: "#115E59", // Teal 800
  accentColor: "#EA580C", // Orange 600
  accentColorDark: "#FB923C", // Orange 400

  // CSS Variables
  cssPrimary: "var(--sport-primary)",
  cssSecondary: "var(--sport-secondary)",
  cssAccent: "var(--sport-accent)",

  // Tailwind references
  tailwindColor: "teal",
  tailwindShade: 600,

  // Images
  heroImage: "/images/hero/darts/champions-collage.png",
  tournamentImage: "/images/hero/darts/match-in-progress.png",
  actionImage: "/images/hero/darts/target-alignment.png",
  trophyImage: "/images/hero/darts/champion-stage.png",

  // Semantic
  statusLiveColor: "#14B8A6", // Teal 500
  statusLiveBg: "#CCFBF1", // Teal 100
};

// ============================================
// THEME MAP
// ============================================

const SPORT_THEMES: Record<SportType, SportTheme> = {
  cornhole: CORNHOLE_THEME,
  darts: DARTS_THEME,
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get the complete theme configuration for a sport
 *
 * @param sport - The sport type
 * @returns The sport theme configuration
 *
 * @example
 * ```tsx
 * const theme = getSportTheme('cornhole');
 * console.log(theme.primaryColor); // '#059669'
 * ```
 */
export function getSportTheme(sport: SportType): SportTheme {
  return SPORT_THEMES[sport];
}

/**
 * Check if a sport string is valid
 *
 * @param sport - The sport string to validate
 * @returns True if valid sport type
 */
export function isValidSport(sport: string | undefined): sport is SportType {
  return sport === "cornhole" || sport === "darts";
}

/**
 * Normalize a sport string to a valid SportType
 * Defaults to 'darts' if invalid
 *
 * @param sport - The sport string to normalize
 * @returns A valid SportType
 */
export function normalizeSport(sport: string | undefined): SportType {
  return isValidSport(sport) ? sport : "darts";
}

/**
 * Get the opposite sport (useful for switching contexts)
 *
 * @param sport - Current sport
 * @returns The other sport
 */
export function getOppositeSport(sport: SportType): SportType {
  return sport === "cornhole" ? "darts" : "cornhole";
}

/**
 * Get pre-computed styling classes for a sport
 * This is the primary function to use in components
 *
 * @param sport - The sport type
 * @returns Pre-computed Tailwind CSS classes
 *
 * @example
 * ```tsx
 * const classes = getSportClasses('cornhole');
 * <Button className={classes.primaryBtn}>Click me</Button>
 * ```
 */
export function getSportClasses(sport: SportType): SportStylingClasses {
  const isCornhole = sport === "cornhole";

  return {
    // Text colors
    primaryText: isCornhole
      ? "text-green-600 dark:text-green-400"
      : "text-teal-600 dark:text-teal-400",
    primaryTextLight: isCornhole
      ? "text-green-500 dark:text-green-300"
      : "text-teal-500 dark:text-teal-300",
    primaryTextMuted: isCornhole
      ? "text-green-700 dark:text-green-300"
      : "text-teal-700 dark:text-teal-300",

    // Background colors
    primaryBg: isCornhole
      ? "bg-green-600 dark:bg-green-500"
      : "bg-teal-600 dark:bg-teal-500",
    primaryBgHover: isCornhole
      ? "hover:bg-green-700 dark:hover:bg-green-600"
      : "hover:bg-teal-700 dark:hover:bg-teal-600",
    primaryBgLight: isCornhole
      ? "bg-green-50 dark:bg-green-950/30"
      : "bg-teal-50 dark:bg-teal-950/30",
    primaryBgMuted: isCornhole
      ? "bg-green-100 dark:bg-green-900/30"
      : "bg-teal-100 dark:bg-teal-900/30",
    primaryBgSubtle: isCornhole
      ? "bg-green-500/10 dark:bg-green-500/20"
      : "bg-teal-500/10 dark:bg-teal-500/20",

    // Button styles
    primaryBtn: isCornhole
      ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white"
      : "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white",
    primaryBtnOutline: isCornhole
      ? "border-green-600 text-green-600 hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-green-950/30"
      : "border-teal-600 text-teal-600 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/30",
    primaryBtnGhost: isCornhole
      ? "text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
      : "text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/30",

    // Border colors
    primaryBorder: isCornhole
      ? "border-green-500 dark:border-green-400"
      : "border-teal-500 dark:border-teal-400",
    primaryBorderLight: isCornhole
      ? "border-green-500/30 dark:border-green-400/30"
      : "border-teal-500/30 dark:border-teal-400/30",
    primaryBorderMuted: isCornhole
      ? "border-green-200 dark:border-green-800"
      : "border-teal-200 dark:border-teal-800",

    // Ring/focus colors
    primaryRing: isCornhole
      ? "ring-green-500 dark:ring-green-400"
      : "ring-teal-500 dark:ring-teal-400",
    focusRing: isCornhole
      ? "focus-visible:ring-green-500 dark:focus-visible:ring-green-400"
      : "focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400",

    // Gradients
    gradientPrimary: isCornhole
      ? "from-green-500 to-emerald-600"
      : "from-teal-500 to-cyan-600",
    gradientHero: isCornhole
      ? "bg-gradient-to-r from-green-600 to-emerald-500"
      : "bg-gradient-to-r from-teal-600 to-cyan-500",

    // Glow shadows
    glowPrimary: isCornhole
      ? "shadow-[0_0_30px_rgba(16,185,129,0.3)]"
      : "shadow-[0_0_30px_rgba(20,184,166,0.3)]",
    glowPrimarySm: isCornhole
      ? "shadow-[0_0_15px_rgba(16,185,129,0.2)]"
      : "shadow-[0_0_15px_rgba(20,184,166,0.2)]",
    glowPrimaryLg: isCornhole
      ? "shadow-[0_0_45px_rgba(16,185,129,0.4)]"
      : "shadow-[0_0_45px_rgba(20,184,166,0.4)]",

    // Accent colors
    accentText: isCornhole
      ? "text-amber-600 dark:text-amber-400"
      : "text-orange-600 dark:text-orange-400",
    accentBg: isCornhole
      ? "bg-amber-50 dark:bg-amber-950/30"
      : "bg-orange-50 dark:bg-orange-950/30",
    accentBorder: isCornhole
      ? "border-amber-500 dark:border-amber-400"
      : "border-orange-500 dark:border-orange-400",
  };
}

/**
 * Get inline styles for sport-specific colors
 * Useful when Tailwind classes aren't sufficient
 *
 * @param sport - The sport type
 * @returns Object with CSS properties for inline styles
 *
 * @example
 * ```tsx
 * const styles = getSportInlineStyles('cornhole');
 * <div style={{ color: styles.primaryColor }}>Custom styled</div>
 * ```
 */
export function getSportInlineStyles(sport: SportType): {
  primaryColor: string;
  primaryColorDark: string;
  secondaryColor: string;
  accentColor: string;
} {
  const theme = getSportTheme(sport);
  return {
    primaryColor: theme.primaryColor,
    primaryColorDark: theme.primaryColorDark,
    secondaryColor: theme.secondaryColor,
    accentColor: theme.accentColor,
  };
}

/**
 * Generate CSS custom property overrides for a sport theme
 * Useful for dynamic theme application
 *
 * @param sport - The sport type
 * @returns CSS custom property string
 */
export function getSportCSSProperties(sport: SportType): string {
  const theme = getSportTheme(sport);
  return `
    --sport-primary: ${theme.primaryColor};
    --sport-secondary: ${theme.secondaryColor};
    --sport-accent: ${theme.accentColor};
  `.trim();
}

/**
 * Get sport-specific hero image paths
 *
 * @param sport - The sport type
 * @returns Object with image paths
 */
export function getSportImages(sport: SportType): {
  hero: string;
  tournament: string;
  action: string;
  trophy: string;
} {
  const theme = getSportTheme(sport);
  return {
    hero: theme.heroImage,
    tournament: theme.tournamentImage,
    action: theme.actionImage,
    trophy: theme.trophyImage,
  };
}

/**
 * Create a sport-specific gradient class string
 *
 * @param sport - The sport type
 * @param variant - Gradient variant
 * @returns Tailwind gradient class
 */
export function getSportGradient(
  sport: SportType,
  variant: "primary" | "hero" | "accent" = "primary"
): string {
  const isCornhole = sport === "cornhole";

  switch (variant) {
    case "hero":
      return isCornhole
        ? "bg-gradient-to-r from-green-600 to-emerald-500"
        : "bg-gradient-to-r from-teal-600 to-cyan-500";
    case "accent":
      return isCornhole
        ? "bg-gradient-to-r from-amber-500 to-yellow-500"
        : "bg-gradient-to-r from-orange-500 to-amber-500";
    case "primary":
    default:
      return isCornhole
        ? "bg-gradient-to-r from-green-500 to-emerald-600"
        : "bg-gradient-to-r from-teal-500 to-cyan-600";
  }
}

/**
 * Create a sport-specific glow shadow class string
 *
 * @param sport - The sport type
 * @param size - Glow size variant
 * @returns Tailwind shadow class
 */
export function getSportGlow(
  sport: SportType,
  size: "sm" | "md" | "lg" = "md"
): string {
  const isCornhole = sport === "cornhole";
  const baseColor = isCornhole ? "16,185,129" : "20,184,166";

  switch (size) {
    case "sm":
      return `shadow-[0_0_15px_rgba(${baseColor},0.2)]`;
    case "lg":
      return `shadow-[0_0_45px_rgba(${baseColor},0.4)]`;
    case "md":
    default:
      return `shadow-[0_0_30px_rgba(${baseColor},0.3)]`;
  }
}

// ============================================
// DEPRECATED COMPATIBILITY FUNCTIONS
// ============================================

/**
 * @deprecated Use getSportClasses() instead
 * Get primary text class for backward compatibility
 */
export function getPrimaryTextClass(sport: SportType): string {
  return getSportClasses(sport).primaryText;
}

/**
 * @deprecated Use getSportClasses() instead
 * Get primary background class for backward compatibility
 */
export function getPrimaryBgClass(sport: SportType): string {
  return getSportClasses(sport).primaryBgLight;
}

/**
 * @deprecated Use getSportClasses() instead
 * Get primary button class for backward compatibility
 */
export function getPrimaryBtnClass(sport: SportType): string {
  return getSportClasses(sport).primaryBtn;
}

/**
 * @deprecated Use getSportClasses() instead
 * Get primary border class for backward compatibility
 */
export function getPrimaryBorderClass(sport: SportType): string {
  return getSportClasses(sport).primaryBorderLight;
}
