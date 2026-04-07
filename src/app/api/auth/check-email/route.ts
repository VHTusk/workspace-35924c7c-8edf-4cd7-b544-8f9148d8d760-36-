import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeSport } from '@/lib/sports';

// GET /api/auth/check-email - Check if email/phone exists
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');
    const sportType = normalizeSport(searchParams.get('sport'));

    if (!sportType) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
    }
    let exists = false;

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const user = await db.user.findUnique({
        where: { email_sport: { email: normalizedEmail, sport: sportType } },
        select: { id: true },
      });
      exists = !!user;
    } else if (phone) {
      const normalizedPhone = phone.replace(/[\s-]/g, '').replace(/^\+91/, '');
      const user = await db.user.findUnique({
        where: { phone_sport: { phone: normalizedPhone, sport: sportType } },
        select: { id: true },
      });
      exists = !!user;
    } else {
      return NextResponse.json({ error: 'Email or phone required' }, { status: 400 });
    }

    return NextResponse.json({ exists });
  } catch (error) {
    console.error('Error checking email:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
