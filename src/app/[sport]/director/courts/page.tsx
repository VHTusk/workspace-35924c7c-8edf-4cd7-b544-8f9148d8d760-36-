"use client";

import { useParams } from "next/navigation";
import { MvpDisabledPage } from "@/components/mvp-disabled-page";

export default function CourtAssignmentPage() {
  const params = useParams();
  const sport = params.sport as string;

  return (
    <MvpDisabledPage
      title="Court assignment is coming soon"
      description="Court management still depends on disabled director APIs, so it has been removed from the MVP production surface."
      backHref={`/${sport}`}
      backLabel="Back to sport home"
    />
  );
}
