import { NextRequest } from 'next/server';
import { AUTH_CODES } from '@/lib/auth-contract';
import { authError, authSuccess } from '@/lib/auth-response';
import { verifyOtpPayload } from '@/lib/otp-verification';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await verifyOtpPayload(body);

    if (!result.success) {
      return authError(result.code, result.message, result.status, {
        field: result.field,
        fieldErrors: result.fieldErrors,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }

    return authSuccess(result.code, result.message);
  } catch {
    return authError(
      AUTH_CODES.SERVER_ERROR,
      'We could not verify the OTP right now. Please try again.',
      500,
    );
  }
}
