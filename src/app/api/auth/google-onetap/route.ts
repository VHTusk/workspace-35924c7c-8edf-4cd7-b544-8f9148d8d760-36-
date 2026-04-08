import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { Prisma, Role, SportType, type User } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession, generateReferralCode } from "@/lib/auth";
import { setCsrfCookie } from "@/lib/csrf";
import { setSessionCookie } from "@/lib/session-helpers";
import { AUTH_CODES, type AuthCode } from "@/lib/auth-contract";
import { authError, authSuccess } from "@/lib/auth-response";
import { normalizeEmail } from "@/lib/auth-validation";
import { getGoogleAuthServerConfig } from "@/lib/google-auth-config";
import { normalizeSport } from "@/lib/sports";
import {
  GOOGLE_ONE_TAP_PENDING_COOKIE,
  clearPendingGoogleOneTapCookie,
  createPendingGoogleOneTapState,
  parsePendingGoogleOneTapState,
  setPendingGoogleOneTapCookie,
} from "@/lib/google-one-tap";

export const runtime = "nodejs";

type GoogleTokenPayload = {
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
  sub?: string;
};

const googleAuthConfig = getGoogleAuthServerConfig();
const googleClientId = googleAuthConfig.clientId;

const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!googleAuthConfig.enabled || !googleClientId || !googleClient) {
    return authError(
      AUTH_CODES.PROVIDER_ERROR,
      "Google sign-in is not configured right now.",
      500,
    );
  }

  try {
    const body = (await request.json()) as {
      credential?: string;
      sport?: string;
    };

    const requestedSport = normalizeSport(body.sport);
    if (body.sport && !requestedSport) {
      return authError(
        AUTH_CODES.INVALID_SPORT,
        "Please choose a valid sport.",
        400,
        { field: "sport" },
      );
    }

    const googleIdentity = body.credential
      ? await verifyGoogleCredential(body.credential)
      : parsePendingGoogleOneTapState(
          request.cookies.get(GOOGLE_ONE_TAP_PENDING_COOKIE)?.value,
        );

    if (!googleIdentity) {
      const response = authError(
        AUTH_CODES.INVALID_GOOGLE_TOKEN,
        "Invalid Google token",
        401,
      );
      clearPendingGoogleOneTapCookie(response);
      return response;
    }

    const sport =
      requestedSport ?? (await resolveSportSelection(googleIdentity.email, googleIdentity.googleId));

    if (!sport) {
      const response = authSuccess(
        AUTH_CODES.SPORT_SELECTION_REQUIRED,
        "Choose a sport to continue with Google.",
        {
          redirectTo: "/select-sport",
          requiresSportSelection: true,
        },
      );

      setPendingGoogleOneTapCookie(
        response,
        createPendingGoogleOneTapState({
          email: googleIdentity.email,
          googleId: googleIdentity.googleId,
          name: googleIdentity.name,
          picture: googleIdentity.picture,
        }),
      );
      return response;
    }

    const userResult = await findOrCreateGoogleUser({
      email: googleIdentity.email,
      googleId: googleIdentity.googleId,
      name: googleIdentity.name,
      picture: googleIdentity.picture,
      sport,
    });

    if (!userResult.ok) {
      const response = authError(
        userResult.code,
        userResult.message,
        userResult.status,
      );
      clearPendingGoogleOneTapCookie(response);
      return response;
    }

    try {
      await db.session.deleteMany({
        where: {
          userId: userResult.user.id,
        },
      });
    } catch {}

    let session;
    try {
      session = await createSession(userResult.user.id, sport);
    } catch (error) {
      console.error("Session creation failed for Google One Tap", error);
      const response = authError(
        AUTH_CODES.SESSION_CREATE_FAILED,
        "Session creation failed",
        500,
      );
      clearPendingGoogleOneTapCookie(response);
      return response;
    }

    const response = authSuccess(
      userResult.created ? AUTH_CODES.REGISTRATION_SUCCESS : AUTH_CODES.LOGIN_SUCCESS,
      userResult.created ? "Account created successfully." : "Login successful.",
      {
        redirectTo: "/post-login",
        user: {
          id: userResult.user.id,
          email: userResult.user.email,
          sport: userResult.user.sport,
        },
      },
    );

    setSessionCookie(response, session.token);
    setCsrfCookie(response);
    clearPendingGoogleOneTapCookie(response);
    return response;
  } catch (error) {
    console.error("Google One Tap route failed", error);
    const response = authError(
      AUTH_CODES.SERVER_ERROR,
      "Google sign-in is unavailable right now. Please try again.",
      500,
    );
    clearPendingGoogleOneTapCookie(response);
    return response;
  }
}

async function verifyGoogleCredential(credential: string) {
  if (!credential) {
    return null;
  }

  try {
    const ticket = await googleClient!.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });

    const payload = ticket.getPayload() as GoogleTokenPayload | undefined;

    const email = normalizeEmail(payload?.email);
    const googleId = typeof payload?.sub === "string" ? payload.sub : "";

    if (!payload?.email_verified || !email || !googleId) {
      return null;
    }

    return {
      email,
      googleId,
      name:
        payload.name?.trim() ||
        [payload.given_name, payload.family_name].filter(Boolean).join(" ").trim() ||
        null,
      picture: payload.picture?.trim() || null,
    };
  } catch (error) {
    console.error("Invalid Google token", error);
    return null;
  }
}

async function resolveSportSelection(email: string, googleId: string): Promise<SportType | null> {
  const matchingUsers = await db.user.findMany({
    where: {
      role: Role.PLAYER,
      OR: [{ email }, { googleId }],
    },
    select: {
      sport: true,
    },
  });

  const sports = Array.from(new Set(matchingUsers.map((user) => user.sport)));
  return sports.length === 1 ? sports[0] : null;
}

async function findOrCreateGoogleUser(input: {
  email: string;
  googleId: string;
  name?: string | null;
  picture?: string | null;
  sport: SportType;
}): Promise<
  | { ok: true; user: User; created: boolean }
  | { ok: false; code: AuthCode; message: string; status: number }
> {
  let user =
    (await db.user.findFirst({
      where: {
        googleId: input.googleId,
        sport: input.sport,
        role: Role.PLAYER,
      },
    })) ??
    (await db.user.findUnique({
      where: {
        email_sport: {
          email: input.email,
          sport: input.sport,
        },
      },
    }));

  if (user) {
    if (!user.isActive) {
      const blocked = user.deactivationReason?.toLowerCase().includes("blocked");
      return {
        ok: false,
        code: blocked ? AUTH_CODES.ACCOUNT_BLOCKED : AUTH_CODES.ACCOUNT_SUSPENDED,
        message: blocked
          ? "Your account has been blocked. Please contact support."
          : "Your account is currently suspended. Please contact support.",
        status: 403,
      };
    }

    user = await db.user.update({
      where: { id: user.id },
      data: {
        googleId: input.googleId,
        emailVerified: true,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        verified: true,
        verifiedAt: user.verifiedAt ?? new Date(),
        photoUrl: user.photoUrl || input.picture || undefined,
      },
    });

    return { ok: true, user, created: false };
  }

  const referralCode = await createUniqueReferralCode();
  const [firstName, ...lastNameParts] = (input.name?.trim() || "Google User")
    .split(/\s+/)
    .filter(Boolean);

  try {
    user = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: input.email,
          googleId: input.googleId,
          firstName: firstName || "Google",
          lastName: lastNameParts.join(" ") || "User",
          photoUrl: input.picture || undefined,
          sport: input.sport,
          role: Role.PLAYER,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          verified: true,
          verifiedAt: new Date(),
          referralCode,
        },
      });

      await tx.playerRating.create({
        data: {
          userId: createdUser.id,
          sport: input.sport,
        },
      });

      await tx.notificationPreference.create({
        data: {
          userId: createdUser.id,
        },
      });

      return createdUser;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingUser = await db.user.findFirst({
        where: {
          sport: input.sport,
          OR: [{ email: input.email }, { googleId: input.googleId }],
        },
      });

      if (existingUser) {
        return { ok: true, user: existingUser, created: false };
      }
    }

    console.error("User creation failed for Google One Tap", error);
    return {
      ok: false,
      code: AUTH_CODES.USER_CREATION_FAILED,
      message: "User creation failed",
      status: 500,
    };
  }

  return { ok: true, user, created: true };
}

async function createUniqueReferralCode(): Promise<string> {
  let referralCode = generateReferralCode();
  let attempts = 0;

  while (attempts < 10) {
    const existing = await db.user.findUnique({
      where: { referralCode },
    });

    if (!existing) {
      return referralCode;
    }

    referralCode = generateReferralCode();
    attempts += 1;
  }

  return `${generateReferralCode()}-${Date.now().toString().slice(-4)}`;
}
