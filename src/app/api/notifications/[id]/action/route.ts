import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: 'Notification actions are temporarily unavailable in this MVP deployment.',
    },
    { status: 410 }
  );
}
