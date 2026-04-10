"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type StoredTournament = {
  id: string;
  sport: string;
};

export default function DirectorDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("director_tournament");
    if (!raw) {
      router.replace("/director/login");
      return;
    }

    try {
      const tournament = JSON.parse(raw) as StoredTournament;
      if (!tournament?.sport) {
        router.replace("/director/login");
        return;
      }

      router.replace(`/${String(tournament.sport).toLowerCase()}/director`);
    } catch {
      router.replace("/director/login");
    }
  }, [router]);

  return <div className="p-6 text-sm text-muted-foreground">Opening director dashboard...</div>;
}
