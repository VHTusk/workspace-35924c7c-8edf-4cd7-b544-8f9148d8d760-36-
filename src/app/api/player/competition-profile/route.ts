import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { AUTH_CODES } from "@/lib/auth-contract";
import { authError, authSuccess } from "@/lib/auth-response";
import { verifyOtpPayload } from "@/lib/otp-verification";
import { getTournamentProfileStatus } from "@/lib/profile-completeness";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return authError(AUTH_CODES.INVALID_CREDENTIALS, "Not authenticated.", 401);
    }

    const body = await request.json().catch(() => ({}));
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    const currentUser = await db.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        age: true,
        city: true,
        district: true,
        state: true,
        dob: true,
        gender: true,
        verified: true,
        identityLocked: true,
      },
    });

    if (!currentUser) {
      return authError(AUTH_CODES.USER_NOT_FOUND, "User not found.", 404);
    }

    const status = getTournamentProfileStatus(currentUser);

    if (status.requiresProfileCompletion) {
      return authError(
        AUTH_CODES.VALIDATION_ERROR,
        status.message,
        400,
        {
          details: status.missingFields.join(", "),
        },
      );
    }

    if (status.requiresPhoneVerification) {
      if (!currentUser.phone) {
        return authError(
          AUTH_CODES.PHONE_NOT_VERIFIED,
          "Add your mobile number to your profile before joining a tournament.",
          400,
          {
            field: "phone",
            fieldErrors: {
              phone: "A verified mobile number is required before joining a tournament.",
            },
          },
        );
      }

      if (!otp) {
        return authError(
          AUTH_CODES.PHONE_NOT_VERIFIED,
          "Verify your mobile number with OTP before joining a tournament.",
          400,
          {
            field: "otp",
            fieldErrors: {
              otp: "Enter the OTP sent to your mobile number.",
            },
          },
        );
      }

      const otpResult = await verifyOtpPayload({
        phone: currentUser.phone,
        otp,
      });

      if (!otpResult.success) {
        return authError(otpResult.code, otpResult.message, otpResult.status, {
          field: otpResult.field,
          fieldErrors: otpResult.fieldErrors,
          retryAfterSeconds: otpResult.retryAfterSeconds,
        });
      }
    }

    const updatedUser = await db.user.update({
      where: { id: currentUser.id },
      data: {
        verified: true,
        verifiedAt: new Date(),
        identityLocked: true,
        profileUpdatedAt: new Date(),
      },
      select: {
        identityLocked: true,
        verified: true,
      },
    });

    return authSuccess(
      AUTH_CODES.OTP_VERIFIED,
      "Profile confirmed. You can now join tournaments.",
      {
        identityLocked: updatedUser.identityLocked,
        phoneVerified: updatedUser.verified,
      },
    );
  } catch (error) {
    console.error("Error finalizing competition profile:", error);
    return authError(
      AUTH_CODES.SERVER_ERROR,
      "We could not confirm your profile right now. Please try again.",
      500,
    );
  }
}
