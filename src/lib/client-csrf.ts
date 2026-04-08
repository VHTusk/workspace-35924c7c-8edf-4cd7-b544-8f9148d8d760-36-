"use client";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function readCsrfTokenFromCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split("=");
    if (name === "csrf_token") {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

async function refreshCsrfToken(): Promise<string | null> {
  const response = await fetch("/api/auth/csrf-token", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  return readCsrfTokenFromCookie();
}

export async function ensureCsrfToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh) {
    const existingToken = readCsrfTokenFromCookie();
    if (existingToken) {
      return existingToken;
    }
  }

  return refreshCsrfToken();
}

export async function fetchWithCsrf(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers || {});

  if (SAFE_METHODS.has(method)) {
    return fetch(input, {
      ...init,
      headers,
      credentials: init.credentials ?? "include",
    });
  }

  let csrfToken = await ensureCsrfToken();
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  let response = await fetch(input, {
    ...init,
    method,
    headers,
    credentials: init.credentials ?? "include",
  });

  if (response.status !== 403) {
    return response;
  }

  const body = await response.clone().json().catch(() => null);
  if (body?.code !== "CSRF_INVALID") {
    return response;
  }

  csrfToken = await ensureCsrfToken(true);
  if (!csrfToken) {
    return response;
  }

  headers.set("X-CSRF-Token", csrfToken);

  return fetch(input, {
    ...init,
    method,
    headers,
    credentials: init.credentials ?? "include",
  });
}
