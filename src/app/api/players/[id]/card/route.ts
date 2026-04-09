import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTierFromPoints } from '@/lib/tier';

function getAgeFromDob(dob: Date | null): number | null {
  if (!dob) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDifference = today.getMonth() - dob.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dob.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const user = await db.user.findUnique({
      where: { id },
      include: {
        rating: true,
        achievements: { take: 5 },
        orgRosterEntries: { include: { org: true } }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const tier = getTierFromPoints(user.visiblePoints);
    const winRate = (user.rating?.wins || 0) + (user.rating?.losses || 0) > 0
      ? Math.round(((user.rating?.wins || 0) / ((user.rating?.wins || 0) + (user.rating?.losses || 0))) * 100)
      : 0;
    const resolvedAge = user.age ?? getAgeFromDob(user.dob);
    const playerMeta = [
      resolvedAge ? `${resolvedAge} yrs` : null,
      user.gender ? `${user.gender.charAt(0)}${user.gender.slice(1).toLowerCase()}` : null,
    ].filter(Boolean).join(' • ');

    // Generate SVG card
    const cardWidth = 400;
    const cardHeight = 500;
    
    const svg = `
      <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a1a2e"/>
            <stop offset="100%" style="stop-color:#16213e"/>
          </linearGradient>
          <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${tier.color}"/>
            <stop offset="100%" style="stop-color:#667eea"/>
          </linearGradient>
        </defs>
        
        <!-- Background -->
        <rect width="${cardWidth}" height="${cardHeight}" fill="url(#bg)" rx="16"/>
        
        <!-- Accent bar -->
        <rect y="0" width="${cardWidth}" height="8" fill="url(#accent)" rx="16 16 0 0"/>
        
        <!-- Tier Badge -->
        <rect x="140" y="30" width="120" height="32" fill="${tier.color}" rx="16" opacity="0.9"/>
        <text x="200" y="52" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${tier.name.toUpperCase()}</text>
        
        <!-- Avatar Circle -->
        <circle cx="200" cy="120" r="50" fill="${tier.color}" opacity="0.2"/>
        <circle cx="200" cy="120" r="45" fill="${tier.color}" opacity="0.3"/>
        <text x="200" y="135" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">${user.firstName.charAt(0)}${user.lastName.charAt(0)}</text>
        
        <!-- Name -->
        <text x="200" y="200" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">${user.firstName} ${user.lastName}</text>
        
        <!-- Organization -->
        ${user.orgRosterEntries[0] ? `
          <text x="200" y="225" font-family="Arial, sans-serif" font-size="12" fill="#a0a0a0" text-anchor="middle">${user.orgRosterEntries[0].org.name}</text>
        ` : ''}
        ${playerMeta ? `
          <text x="200" y="${user.orgRosterEntries[0] ? 244 : 225}" font-family="Arial, sans-serif" font-size="11" fill="#9fb0c8" text-anchor="middle">${playerMeta}</text>
        ` : ''}

        <!-- Stats Row -->
        <rect x="30" y="250" width="340" height="80" fill="rgba(255,255,255,0.05)" rx="8"/>
        
        <!-- Points -->
        <text x="95" y="280" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${tier.color}" text-anchor="middle">${user.visiblePoints.toLocaleString()}</text>
        <text x="95" y="300" font-family="Arial, sans-serif" font-size="10" fill="#808080" text-anchor="middle">POINTS</text>
        
        <!-- Win Rate -->
        <text x="200" y="280" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#4ade80" text-anchor="middle">${winRate}%</text>
        <text x="200" y="300" font-family="Arial, sans-serif" font-size="10" fill="#808080" text-anchor="middle">WIN RATE</text>
        
        <!-- Matches -->
        <text x="305" y="280" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#60a5fa" text-anchor="middle">${(user.rating?.wins || 0) + (user.rating?.losses || 0)}</text>
        <text x="305" y="300" font-family="Arial, sans-serif" font-size="10" fill="#808080" text-anchor="middle">MATCHES</text>
        
        <!-- Wins / Losses -->
        <rect x="30" y="350" width="165" height="50" fill="rgba(74, 222, 128, 0.1)" rx="8"/>
        <text x="112" y="380" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#4ade80" text-anchor="middle">${user.rating?.wins || 0} W</text>
        
        <rect x="205" y="350" width="165" height="50" fill="rgba(248, 113, 113, 0.1)" rx="8"/>
        <text x="287" y="380" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#f87171" text-anchor="middle">${user.rating?.losses || 0} L</text>
        
        <!-- Streak -->
        ${(user.rating?.currentStreak || 0) > 0 ? `
          <rect x="120" y="420" width="160" height="30" fill="rgba(251, 146, 60, 0.2)" rx="15"/>
          <text x="200" y="440" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#fb923c" text-anchor="middle">🔥 ${user.rating?.currentStreak} Win Streak!</text>
        ` : ''}
        
        <!-- Footer -->
        <text x="200" y="480" font-family="Arial, sans-serif" font-size="10" fill="#505050" text-anchor="middle">VALORHIVE • ${user.sport}</text>
      </svg>
    `;

    // Return SVG with proper headers for download
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Content-Disposition': `attachment; filename="${user.firstName}-${user.lastName}-card.svg"`
      }
    });
  } catch (error) {
    console.error('Error generating player card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
