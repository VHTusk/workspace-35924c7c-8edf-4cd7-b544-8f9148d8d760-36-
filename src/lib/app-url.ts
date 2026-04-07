const DEFAULT_APP_URL = "https://example.invalid";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function getAppUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL;

  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  if (process.env.VERCEL_URL) {
    return trimTrailingSlash(`https://${process.env.VERCEL_URL}`);
  }

  return DEFAULT_APP_URL;
}

export function getBaseUrl(): string {
  return trimTrailingSlash(process.env.NEXT_PUBLIC_BASE_URL ?? getAppUrl());
}

export function getApiUrl(): string {
  return trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL ?? getAppUrl());
}

export function buildAppUrl(path: string, baseUrl = getAppUrl()): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${trimTrailingSlash(baseUrl)}${normalizePath(path)}`;
}

export function getRequestOrigin(headers: Pick<Headers, "get">): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const protocol =
    headers.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");

  if (!host) {
    return getAppUrl();
  }

  return trimTrailingSlash(`${protocol}://${host}`);
}
