// Profile completeness calculation and validation

export interface ProfileCompleteness {
  percentage: number;
  missingFields: string[];
  isComplete: boolean;
  requiredFields: {
    field: string;
    label: string;
    filled: boolean;
  }[];
}

export interface TournamentProfileStatus {
  canRegister: boolean;
  percentage: number;
  missingFields: string[];
  requiresProfileCompletion: boolean;
  requiresPhoneVerification: boolean;
  requiresIdentityLock: boolean;
  phone?: string | null;
  phoneVerified: boolean;
  identityLocked: boolean;
  message: string;
}

export function calculateProfileCompleteness(user: {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  dob?: Date | null;
  gender?: string | null;
}): ProfileCompleteness {
  const requiredFields = [
    { field: 'firstName', label: 'First Name', filled: !!user.firstName },
    { field: 'lastName', label: 'Last Name', filled: !!user.lastName },
    { field: 'email', label: 'Email', filled: !!user.email },
    { field: 'phone', label: 'Phone', filled: !!user.phone },
    { field: 'city', label: 'City', filled: !!user.city },
    { field: 'district', label: 'District', filled: !!user.district },
    { field: 'state', label: 'State', filled: !!user.state },
    { field: 'dob', label: 'Date of Birth', filled: !!user.dob },
    { field: 'gender', label: 'Gender', filled: !!user.gender },
  ];

  const filledCount = requiredFields.filter(f => f.filled).length;
  const percentage = Math.round((filledCount / requiredFields.length) * 100);
  const missingFields = requiredFields.filter(f => !f.filled).map(f => f.label);
  const isComplete = percentage === 100;

  // For INDIVIDUAL tournaments, location (city, state) is mandatory
  const hasLocation = !!user.city && !!user.state;

  return {
    percentage,
    missingFields,
    isComplete: isComplete && hasLocation,
    requiredFields,
  };
}

export function canRegisterForTournament(
  user: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    district?: string | null;
    state?: string | null;
    dob?: Date | null;
    gender?: string | null;
  },
  tournamentType: 'INDIVIDUAL' | 'INTER_ORG' | 'INTRA_ORG'
): { canRegister: boolean; reason?: string } {
  const completeness = calculateProfileCompleteness(user);

  // For INDIVIDUAL tournaments, profile must be 100% complete with location
  if (tournamentType === 'INDIVIDUAL') {
    if (!user.city || !user.state) {
      return {
        canRegister: false,
        reason: 'Profile incomplete: City and State are required for tournament registration. Please update your profile.',
      };
    }

    if (completeness.percentage < 100) {
      return {
        canRegister: false,
        reason: `Profile ${completeness.percentage}% complete. Missing: ${completeness.missingFields.join(', ')}. Please complete your profile to register.`,
      };
    }
  }

  // For INTRA_ORG tournaments, basic info is required
  if (tournamentType === 'INTRA_ORG') {
    if (!user.firstName || !user.lastName) {
      return {
        canRegister: false,
        reason: 'Profile incomplete: Name is required for registration.',
      };
    }
  }

  // For INTER_ORG, org handles registration
  // Individual check is not applicable

  return { canRegister: true };
}

export function getTournamentProfileStatus(user: {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  dob?: Date | null;
  gender?: string | null;
  verified?: boolean | null;
  identityLocked?: boolean | null;
}): TournamentProfileStatus {
  const completeness = calculateProfileCompleteness(user);
  const requiresProfileCompletion = !completeness.isComplete;
  const requiresPhoneVerification = !user.verified;
  const requiresIdentityLock = !user.identityLocked;

  let message = "Your profile is ready for tournament registration.";

  if (requiresProfileCompletion) {
    message = completeness.percentage > 0
      ? `Complete your profile before joining tournaments. Missing: ${completeness.missingFields.join(', ')}.`
      : "Complete your profile before joining tournaments.";
  } else if (requiresPhoneVerification) {
    message = "Verify your mobile number by OTP before joining a tournament.";
  } else if (requiresIdentityLock) {
    message = "Confirm your profile details before joining a tournament. They will be locked after confirmation.";
  }

  return {
    canRegister: !requiresProfileCompletion && !requiresPhoneVerification && !requiresIdentityLock,
    percentage: completeness.percentage,
    missingFields: completeness.missingFields,
    requiresProfileCompletion,
    requiresPhoneVerification,
    requiresIdentityLock,
    phone: user.phone ?? null,
    phoneVerified: Boolean(user.verified),
    identityLocked: Boolean(user.identityLocked),
    message,
  };
}

export function buildTournamentProfileRequiredResponse(
  status: TournamentProfileStatus,
  sport: string,
) {
  return {
    code: "TOURNAMENT_PROFILE_REQUIRED",
    error: status.message,
    message: status.message,
    profileCompletion: status.percentage,
    missingFields: status.missingFields,
    requiresPhoneVerification: status.requiresPhoneVerification,
    requiresIdentityLock: status.requiresIdentityLock,
    phone: status.phone ?? null,
    phoneVerified: status.phoneVerified,
    identityLocked: status.identityLocked,
    profileUrl: `/${sport.toLowerCase()}/profile`,
  };
}
