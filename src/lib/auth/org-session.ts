import { cookies } from 'next/headers';
import { validateOrgSession } from '@/lib/auth';

export async function getOrgSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('org_token')?.value;
  
  if (!token) {
    return null;
  }
  
  const session = await validateOrgSession(token);
  
  if (!session || !session.orgId) {
    return null;
  }
  
  return {
    orgId: session.orgId,
    userId: session.orgId, // For createdById field
    sport: session.sport,
    org: session.org,
  };
}
