import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

export const GOOGLE_ONE_TAP_PENDING_COOKIE = "google_onetap_pending";
const GOOGLE_ONE_TAP_PENDING_MAX_AGE = 10 * 60;

export type PendingGoogleOneTapState = {
  email: string;
  googleId: string;
  name?: string | null;
  picture?: string | null;
  issuedAt: number;
  expiresAt: number;
};

function getSigningSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is required for Google One Tap state");
  }

  return secret;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string): string {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

export function createPendingGoogleOneTapState(
  data: Omit<PendingGoogleOneTapState, "issuedAt" | "expiresAt">,
): string {
  const now = Date.now();
  const payload: PendingGoogleOneTapState = {
    ...data,
    issuedAt: now,
    expiresAt: now + GOOGLE_ONE_TAP_PENDING_MAX_AGE * 1000,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function parsePendingGoogleOneTapState(
  token?: string | null,
): PendingGoogleOneTapState | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const actualSignature = Buffer.from(signature, "utf8");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    actualSignature.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(actualSignature, expectedSignatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as PendingGoogleOneTapState;

    if (
      !payload.email ||
      !payload.googleId ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }

    if (payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function setPendingGoogleOneTapCookie(response: NextResponse, token: string): void {
  response.cookies.set(GOOGLE_ONE_TAP_PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: GOOGLE_ONE_TAP_PENDING_MAX_AGE,
    path: "/",
  });
}

export function clearPendingGoogleOneTapCookie(response: NextResponse): void {
  response.cookies.set(GOOGLE_ONE_TAP_PENDING_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}
