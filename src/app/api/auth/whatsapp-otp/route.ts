import { NextRequest } from "next/server";
import { sendWhatsAppOTP, verifyWhatsAppOTP } from "@/lib/integrations/whatsapp";
import { AUTH_CODES } from "@/lib/auth-contract";
import { authError, authSuccess } from "@/lib/auth-response";
import { isValidPhoneNumber, normalizePhone } from "@/lib/auth-validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const normalizedPhone = normalizePhone(body.phone);

    if (!normalizedPhone) {
      return authError(
        AUTH_CODES.REQUIRED_FIELD_MISSING,
        "Phone number is required.",
        400,
        {
          field: "phone",
          fieldErrors: { phone: "Phone number is required." },
        },
      );
    }

    if (!isValidPhoneNumber(normalizedPhone)) {
      return authError(
        AUTH_CODES.INVALID_PHONE_FORMAT,
        "Please enter a valid 10-digit Indian mobile number.",
        400,
        {
          field: "phone",
          fieldErrors: { phone: "Please enter a valid 10-digit Indian mobile number." },
        },
      );
    }

    const result = await sendWhatsAppOTP(normalizedPhone);

    if (!result.success) {
      return authError(
        AUTH_CODES.OTP_SEND_FAILED,
        result.error || "We could not send the verification code right now. Please try again.",
        500,
      );
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] WhatsApp OTP sent to ${normalizedPhone}`);
    }

    return authSuccess(AUTH_CODES.OTP_SENT, "OTP sent successfully via WhatsApp.", {
      ...(process.env.NODE_ENV === "development" && { devOtp: "Check server console" }),
    });
  } catch (error) {
    console.error("[WhatsApp OTP] Error sending OTP:", error);
    return authError(
      AUTH_CODES.SERVER_ERROR,
      "We could not send the verification code right now. Please try again.",
      500,
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const normalizedPhone = normalizePhone(body.phone);
    const otp = typeof body.otp === "string" ? body.otp : "";

    if (!normalizedPhone) {
      return authError(
        AUTH_CODES.REQUIRED_FIELD_MISSING,
        "Phone number is required.",
        400,
        {
          field: "phone",
          fieldErrors: { phone: "Phone number is required." },
        },
      );
    }

    if (!otp || otp.length !== 6) {
      return authError(AUTH_CODES.INVALID_OTP, "Please enter a valid 6-digit OTP.", 400, {
        field: "otp",
        fieldErrors: { otp: "Please enter a valid 6-digit OTP." },
      });
    }

    const result = await verifyWhatsAppOTP(normalizedPhone, otp);

    if (!result.success) {
      return authError(
        AUTH_CODES.INVALID_OTP,
        result.error || "Invalid OTP. Please try again.",
        400,
        {
          field: "otp",
          fieldErrors: { otp: result.error || "Invalid OTP. Please try again." },
        },
      );
    }

    return authSuccess(AUTH_CODES.OTP_VERIFIED, "Phone number verified successfully.", {
      phone: result.phone,
    });
  } catch (error) {
    console.error("[WhatsApp OTP] Error verifying OTP:", error);
    return authError(
      AUTH_CODES.SERVER_ERROR,
      "We could not verify the OTP right now. Please try again.",
      500,
    );
  }
}
