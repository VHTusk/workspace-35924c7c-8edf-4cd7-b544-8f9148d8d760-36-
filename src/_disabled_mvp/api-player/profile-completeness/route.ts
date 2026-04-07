import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// Profile completeness check - returns percentage and missing fields
export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;

    // Fetch additional user data for completeness check
    const userData = await db.user.findUnique({
      where: { id: user.id },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
        registrations: {
          where: { status: 'CONFIRMED' },
          take: 1,
        },
      },
    });

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Required fields for profile completeness
    const requiredFields = [
      { key: 'firstName', value: user.firstName, label: 'First Name' },
      { key: 'lastName', value: user.lastName, label: 'Last Name' },
      { key: 'email', value: user.email, label: 'Email' },
      { key: 'phone', value: user.phone, label: 'Phone Number' },
      { key: 'city', value: user.city, label: 'City' },
      { key: 'state', value: user.state, label: 'State' },
      { key: 'dob', value: user.dob, label: 'Date of Birth' },
      { key: 'gender', value: user.gender, label: 'Gender' },
    ];

    // Optional but recommended fields
    const optionalFields = [
      { key: 'profilePhoto', value: null, label: 'Profile Photo' }, // Not in schema yet
      { key: 'affiliatedOrg', value: user.affiliatedOrgId, label: 'Organization' },
    ];

    const missingRequired = requiredFields.filter(f => !f.value);
    const missingOptional = optionalFields.filter(f => !f.value);

    const completedRequired = requiredFields.length - missingRequired.length;
    const percentage = Math.round((completedRequired / requiredFields.length) * 100);

    // Profile is considered complete if all required fields are filled
    const isComplete = missingRequired.length === 0;

    // Minimum required for tournament participation
    // At minimum, need: firstName, lastName, email OR phone, city, state
    const minRequiredFields = ['firstName', 'lastName', 'city', 'state'];
    const minRequiredMet = minRequiredFields.every(key => {
      const field = requiredFields.find(f => f.key === key);
      return field?.value;
    }) && (user.email || user.phone);

    // Additional onboarding completeness flags
    const hasSubscription = userData.subscriptions && userData.subscriptions.length > 0;
    const hasTournament = (userData as unknown as Record<string, unknown>).registrations && 
      ((userData as unknown as Record<string, unknown>).registrations as unknown[]).length > 0;
    const hasLocation = !!(user.city && user.state);

    return NextResponse.json({
      percentage,
      isComplete,
      minRequiredMet,
      missingRequired: missingRequired.map(f => ({ key: f.key, label: f.label })),
      missingOptional: missingOptional.map(f => ({ key: f.key, label: f.label })),
      requiredFields: requiredFields.map(f => ({
        key: f.key,
        label: f.label,
        filled: !!f.value,
      })),
      // Onboarding completeness object
      completeness: {
        profileComplete: percentage >= 80,
        hasSubscription,
        hasTournament,
        hasLocation,
      },
    });
  } catch (error) {
    console.error('Profile completeness check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
