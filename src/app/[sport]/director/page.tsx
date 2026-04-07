"use client";

import { useParams } from "next/navigation";
import { MvpDisabledPage } from "@/components/mvp-disabled-page";

export default function DirectorDashboardPage() {
  const params = useParams();
  const sport = params.sport as string;

  return (
    <MvpDisabledPage
      title="Director dashboard is coming soon"
      description="Director operations still depend on APIs that are outside the MVP deployment scope, so this dashboard has been disabled for the first production release."
      backHref={`/${sport}`}
      backLabel="Back to sport home"
    />
  );
}
