import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppOTP, verifyWhatsAppOTP } from "@/lib/integrations/whatsapp";

/**
 * POST /api/auth/whatsapp-otp
 * Send OTP to phone number via WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    // Validate phone number
    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Clean phone number (remove +91 prefix if present)
    const cleanPhone = phone.replace(/^\+?91/, "").replace(/\D/g, "");

    // Validate Indian mobile number
    if (cleanPhone.length !== 10) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid 10-digit Indian mobile number" },
        { status: 400 }
      );
    }

    // Validate that it starts with 6-9 (Indian mobile numbers)
    if (!/^[6-9]/.test(cleanPhone)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid Indian mobile number" },
        { status: 400 }
      );
    }

    // Send OTP via WhatsApp
    const result = await sendWhatsAppOTP(cleanPhone);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to send OTP" },
        { status: 500 }
      );
    }

    // In development mode, log the OTP
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] WhatsApp OTP sent to ${cleanPhone}`);
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully via WhatsApp",
      // In development, return the OTP for testing
      ...(process.env.NODE_ENV === "development" && { devOtp: "Check server console" }),
    });
  } catch (error) {
    console.error("[WhatsApp OTP] Error sending OTP:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/whatsapp-otp
 * Verify OTP code
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, otp } = body;

    // Validate phone number
    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Validate OTP
    if (!otp || otp.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid 6-digit OTP" },
        { status: 400 }
      );
    }

    // Clean phone number
    const cleanPhone = phone.replace(/^\+?91/, "").replace(/\D/g, "");

    // Verify OTP
    const result = await verifyWhatsAppOTP(cleanPhone, otp);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Invalid OTP" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully",
      phone: result.phone,
    });
  } catch (error) {
    console.error("[WhatsApp OTP] Error verifying OTP:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
