'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// Redirect to the new dashboard-based city page
export default function CityRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const cityId = params.cityId as string;
  const sport = params.sport as string;

  useEffect(() => {
    // Redirect to the new location inside the dashboard
    router.replace(`/${sport}/dashboard/city/${cityId}`);
  }, [router, sport, cityId]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
