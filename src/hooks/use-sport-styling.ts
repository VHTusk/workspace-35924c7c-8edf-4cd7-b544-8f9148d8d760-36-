"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import {
  getSportTheme,
  type SportType,
  type SportTheme,
  type SportStylingClasses,
} from "@/lib/sport-theme";

/**
 * Hook that provides centralized sport-specific styling
 * Based on the current sport from URL params
 *
 * @returns Object containing:
 *   - sport: The current sport type ('cornhole' | 'darts')
 *   - isCornhole: Boolean for cornhole-specific logic
 *   - isDarts: Boolean for darts-specific logic
 *   - theme: Sport-specific theme colors and values
 *   - classes: Pre-computed Tailwind CSS classes for common styling needs
 *
 * @example
 * ```tsx
 * const { isCornhole, classes, theme } = useSportStyling();
 *
 * // Use pre-computed classes
 * <div className={classes.primaryText}>Title</div>
 * <Button className={classes.primaryBtn}>Action</Button>
 *
 * // Or use theme values for custom styles
 * <div style={{ color: theme.primaryColor }}>Custom styled</div>
 * ```
 */
export function useSportStyling() {
  const params = useParams();
  const sportParam = params?.sport as string | undefined;

  return useMemo(() => {
    // Normalize sport parameter
    const sport: SportType =
      sportParam === "cornhole" ? "cornhole" : "darts";
    const isCornhole = sport === "cornhole";
    const isDarts = sport === "darts";

    // Get the full theme configuration
    const theme = getSportTheme(sport);

    // Pre-compute common styling classes
    const classes: SportStylingClasses = {
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

      // Accent colors (amber for cornhole, orange for darts)
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

    return {
      sport,
      isCornhole,
      isDarts,
      theme,
      classes,
    };
  }, [sportParam]);
}

/**
 * Hook for getting sport-specific styling without URL params
 * Useful for server components or when sport is known
 *
 * @param sport - The sport type to get styling for
 * @returns Same as useSportStyling but for a specific sport
 */
export function useSportStylingForSport(sport: SportType) {
  return useMemo(() => {
    const isCornhole = sport === "cornhole";
    const isDarts = sport === "darts";
    const theme = getSportTheme(sport);

    const classes: SportStylingClasses = {
      primaryText: isCornhole
        ? "text-green-600 dark:text-green-400"
        : "text-teal-600 dark:text-teal-400",
      primaryTextLight: isCornhole
        ? "text-green-500 dark:text-green-300"
        : "text-teal-500 dark:text-teal-300",
      primaryTextMuted: isCornhole
        ? "text-green-700 dark:text-green-300"
        : "text-teal-700 dark:text-teal-300",
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
      primaryBtn: isCornhole
        ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white"
        : "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white",
      primaryBtnOutline: isCornhole
        ? "border-green-600 text-green-600 hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-green-950/30"
        : "border-teal-600 text-teal-600 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/30",
      primaryBtnGhost: isCornhole
        ? "text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
        : "text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/30",
      primaryBorder: isCornhole
        ? "border-green-500 dark:border-green-400"
        : "border-teal-500 dark:border-teal-400",
      primaryBorderLight: isCornhole
        ? "border-green-500/30 dark:border-green-400/30"
        : "border-teal-500/30 dark:border-teal-400/30",
      primaryBorderMuted: isCornhole
        ? "border-green-200 dark:border-green-800"
        : "border-teal-200 dark:border-teal-800",
      primaryRing: isCornhole
        ? "ring-green-500 dark:ring-green-400"
        : "ring-teal-500 dark:ring-teal-400",
      focusRing: isCornhole
        ? "focus-visible:ring-green-500 dark:focus-visible:ring-green-400"
        : "focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400",
      gradientPrimary: isCornhole
        ? "from-green-500 to-emerald-600"
        : "from-teal-500 to-cyan-600",
      gradientHero: isCornhole
        ? "bg-gradient-to-r from-green-600 to-emerald-500"
        : "bg-gradient-to-r from-teal-600 to-cyan-500",
      glowPrimary: isCornhole
        ? "shadow-[0_0_30px_rgba(16,185,129,0.3)]"
        : "shadow-[0_0_30px_rgba(20,184,166,0.3)]",
      glowPrimarySm: isCornhole
        ? "shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        : "shadow-[0_0_15px_rgba(20,184,166,0.2)]",
      glowPrimaryLg: isCornhole
        ? "shadow-[0_0_45px_rgba(16,185,129,0.4)]"
        : "shadow-[0_0_45px_rgba(20,184,166,0.4)]",
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

    return {
      sport,
      isCornhole,
      isDarts,
      theme,
      classes,
    };
  }, [sport]);
}

// Export types for consumers
export type { SportType, SportTheme, SportStylingClasses };
