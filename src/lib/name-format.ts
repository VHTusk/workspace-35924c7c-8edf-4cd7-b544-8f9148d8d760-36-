function normalizeWordSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) {
    return "";
  }

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  if (/^[IVXLCDM]+$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (/^[A-Z]{2,4}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function normalizeToken(token: string): string {
  return token
    .split(/([-'’.])/)
    .map((part) => {
      if (/^[-'’.]$/.test(part)) {
        return part;
      }

      return normalizeWordSegment(part);
    })
    .join("");
}

export function toNameCase(value?: string | null): string {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .map((token) => normalizeToken(token))
    .filter(Boolean)
    .join(" ");
}
