export type OrgAuthType =
  | "SCHOOL"
  | "COLLEGE"
  | "CLUB"
  | "ASSOCIATION"
  | "CORPORATE"
  | "GOVT_ORGANISATION"
  | "ACADEMY"
  | "OTHER";

export const ORG_AUTH_TYPE_OPTIONS: Array<{ value: OrgAuthType; label: string }> = [
  { value: "CORPORATE", label: "Corporate" },
  { value: "SCHOOL", label: "School" },
  { value: "COLLEGE", label: "College" },
  { value: "CLUB", label: "Club" },
  { value: "ACADEMY", label: "Academy" },
  { value: "ASSOCIATION", label: "Association" },
  { value: "GOVT_ORGANISATION", label: "Government Organisation" },
  { value: "OTHER", label: "Other" },
];

export function isOrgAuthType(value: unknown): value is OrgAuthType {
  return ORG_AUTH_TYPE_OPTIONS.some((option) => option.value === value);
}

export function getOrgHomeRoute(sport: string, orgType?: string | null): string {
  const normalizedSport = String(sport || "").toLowerCase();

  switch (orgType) {
    case "CORPORATE":
      return `/${normalizedSport}/org/corporate-home`;
    case "SCHOOL":
      return `/${normalizedSport}/org/school-home`;
    case "COLLEGE":
      return `/${normalizedSport}/org/college-home`;
    default:
      return `/${normalizedSport}/org/dashboard`;
  }
}
