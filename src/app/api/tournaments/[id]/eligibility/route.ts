import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

interface EligibilityResult {
  isEligible: boolean;
  reasons: string[];
  warnings: string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ 
        isEligible: false, 
        reasons: ['Please login to check eligibility'],
        warnings: []
      });
    }

    // Get user session
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || !session.user) {
      return NextResponse.json({ 
        isEligible: false, 
        reasons: ['Please login to check eligibility'],
        warnings: []
      });
    }

    const user = session.user;
    const { id: tournamentId } = await params;

    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ 
        isEligible: false, 
        reasons: ['Tournament not found'],
        warnings: []
      });
    }

    const result: EligibilityResult = {
      isEligible: true,
      reasons: [],
      warnings: [],
    };

    // Check sport match
    if (tournament.sport !== user.sport) {
      result.isEligible = false;
      result.reasons.push(`This tournament is for ${tournament.sport.toLowerCase()} players only`);
    }

    // Check age eligibility
    if (tournament.ageMin || tournament.ageMax) {
      if (!user.dob) {
        result.warnings.push('Please add your date of birth to your profile for age verification');
      } else {
        const age = calculateAge(new Date(user.dob));
        
        if (tournament.ageMin && age < tournament.ageMin) {
          result.isEligible = false;
          result.reasons.push(`Minimum age requirement is ${tournament.ageMin} years. You are ${age} years old.`);
        }
        
        if (tournament.ageMax && age > tournament.ageMax) {
          result.isEligible = false;
          result.reasons.push(`Maximum age limit is ${tournament.ageMax} years. You are ${age} years old.`);
        }
      }
    }

    // Check gender eligibility
    if (tournament.gender && tournament.gender !== 'MIXED') {
      if (!user.gender) {
        result.warnings.push('Please add your gender to your profile for eligibility verification');
      } else if (user.gender !== tournament.gender) {
        result.isEligible = false;
        const genderLabel = tournament.gender === 'MALE' ? 'men' : 'women';
        result.reasons.push(`This tournament is exclusively for ${genderLabel}`);
      }
    }

    // Check geographic eligibility based on tournament scope
    if (tournament.scope && tournament.scope !== 'NATIONAL') {
      // For STATE level, player must be from the same state
      if (tournament.scope === 'STATE' && tournament.state) {
        if (!user.state) {
          result.warnings.push('Please add your state to your profile for location verification');
        } else if (user.state.toLowerCase() !== tournament.state.toLowerCase()) {
          result.isEligible = false;
          result.reasons.push(`This tournament is only for players from ${tournament.state}`);
        }
      }
      
      // For DISTRICT level, player must be from the same district
      if (tournament.scope === 'DISTRICT' && tournament.district && tournament.state) {
        if (!user.district || !user.state) {
          result.warnings.push('Please add your district and state to your profile for location verification');
        } else if (
          user.district.toLowerCase() !== tournament.district.toLowerCase() ||
          user.state.toLowerCase() !== tournament.state.toLowerCase()
        ) {
          result.isEligible = false;
          result.reasons.push(`This tournament is only for players from ${tournament.district}, ${tournament.state}`);
        }
      }
      
      // For CITY level, player must be from the same city
      if (tournament.scope === 'CITY' && tournament.city && tournament.state) {
        if (!user.city || !user.state) {
          result.warnings.push('Please add your city and state to your profile for location verification');
        } else if (
          user.city.toLowerCase() !== tournament.city.toLowerCase() ||
          user.state.toLowerCase() !== tournament.state.toLowerCase()
        ) {
          result.isEligible = false;
          result.reasons.push(`This tournament is only for players from ${tournament.city}, ${tournament.state}`);
        }
      }
    }

    // Check profession eligibility (for exclusive tournaments)
    if (tournament.isProfessionExclusive && tournament.allowedProfessions) {
      const allowedProfessions = tournament.allowedProfessions.split(',').map(p => p.trim().toUpperCase());
      
      if (!user.profession) {
        result.warnings.push('This tournament has profession restrictions. Please add your profession to your profile.');
      } else if (!allowedProfessions.includes(user.profession.toUpperCase())) {
        result.isEligible = false;
        result.reasons.push(`This tournament is exclusively for: ${tournament.allowedProfessions}`);
      }
    }

    // Check if already registered
    const existingRegistration = await db.tournamentRegistration.findUnique({
      where: {
        tournamentId_userId: { tournamentId, userId: user.id },
      },
    });

    if (existingRegistration) {
      result.isEligible = false;
      result.reasons.push('You are already registered for this tournament');
    }

    // Check if tournament is full
    const registrationCount = await db.tournamentRegistration.count({
      where: { tournamentId },
    });

    if (registrationCount >= tournament.maxPlayers) {
      result.isEligible = false;
      result.reasons.push('Tournament is full. You can join the waitlist.');
    }

    // Check registration deadline
    if (tournament.regDeadline && new Date(tournament.regDeadline) < new Date()) {
      result.isEligible = false;
      result.reasons.push('Registration deadline has passed');
    }

    // Check tournament status
    if (tournament.status !== 'REGISTRATION_OPEN') {
      result.isEligible = false;
      result.reasons.push('Tournament registration is not open');
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Eligibility check error:', error);
    return NextResponse.json({ 
      isEligible: false, 
      reasons: ['Unable to check eligibility. Please try again.'],
      warnings: []
    });
  }
}

// Helper function to calculate age
function calculateAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
}
