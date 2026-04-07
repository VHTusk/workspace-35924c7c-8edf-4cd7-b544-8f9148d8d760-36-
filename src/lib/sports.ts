import type { SportType } from "@prisma/client";
import { SPORT_LABELS, SUPPORTED_SPORTS, type SupportedSport } from "./constants";

const SPORT_SLUGS: Record<SupportedSport, string> = {
  CORNHOLE: "cornhole",
  DARTS: "darts",
};

const SPORT_LOOKUP = new Map<string, SupportedSport>();

for (const sport of SUPPORTED_SPORTS) {
  SPORT_LOOKUP.set(sport, sport);
  SPORT_LOOKUP.set(sport.toLowerCase(), sport);
  SPORT_LOOKUP.set(SPORT_SLUGS[sport], sport);
  SPORT_LOOKUP.set(SPORT_LABELS[sport].toLowerCase(), sport);
}

function normalizeToken(value: string): string {
  return value.trim().replace(/[\s-]+/g, "_");
}

export function normalizeSport(input?: string | null): SportType | null {
  if (!input) {
    return null;
  }

  const normalized = normalizeToken(input);
  return SPORT_LOOKUP.get(normalized) ?? SPORT_LOOKUP.get(normalized.toUpperCase()) ?? null;
}

export function isSupportedSport(input?: string | null): input is SportType {
  return normalizeSport(input) !== null;
}

export function getSportSlug(input: SportType | SupportedSport): string {
  return SPORT_SLUGS[input];
}

export function getSportLabel(input: SportType | SupportedSport): string {
  return SPORT_LABELS[input];
}
