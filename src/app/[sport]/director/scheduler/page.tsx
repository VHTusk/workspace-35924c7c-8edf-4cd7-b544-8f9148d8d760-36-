"use client";

import { useParams } from "next/navigation";
import { MvpDisabledPage } from "@/components/mvp-disabled-page";

export default function MatchSchedulerPage() {
  const params = useParams();
  const sport = params.sport as string;

  return (
    <MvpDisabledPage
      title="Match scheduler is coming soon"
      description="Scheduling tools still depend on removed admin and director APIs, so they are not part of the MVP deployment."
      backHref={`/${sport}`}
      backLabel="Back to sport home"
    />
  );
}
