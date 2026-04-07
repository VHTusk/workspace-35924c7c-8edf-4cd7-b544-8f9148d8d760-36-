import { NextRequest, NextResponse } from 'next/server';
import { generateMathCaptcha, verifyCaptcha } from '@/lib/captcha';

/**
 * GET /api/auth/captcha
 * Generate a new CAPTCHA challenge
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const purpose = (searchParams.get('purpose') || 'login') as 'login' | 'register' | 'password_reset' | 'contact';

    const captcha = generateMathCaptcha();

    return NextResponse.json({
      success: true,
      data: {
        captchaId: captcha.captchaId,
        question: captcha.question,
        expiresAt: captcha.expiresAt,
      },
    });
  } catch (error) {
    console.error('CAPTCHA generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CAPTCHA', code: 'SRV_001' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/captcha
 * Verify a CAPTCHA answer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { captchaId, captchaAnswer, captchaType, recaptchaToken, recaptchaAction } = body;

    const result = await verifyCaptcha({
      captchaType: captchaType || 'math',
      captchaId,
      captchaAnswer,
      recaptchaToken,
      recaptchaAction,
      remoteIp: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: 'CAPTCHA_001' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'CAPTCHA verified successfully',
    });
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify CAPTCHA', code: 'SRV_001' },
      { status: 500 }
    );
  }
}
