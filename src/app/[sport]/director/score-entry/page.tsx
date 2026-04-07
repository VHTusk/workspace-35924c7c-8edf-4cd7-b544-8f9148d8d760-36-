"use client";

import { useParams } from "next/navigation";
import { MvpDisabledPage } from "@/components/mvp-disabled-page";

export default function ScoreEntryPage() {
  const params = useParams();
  const sport = params.sport as string;

  return (
    <MvpDisabledPage
      title="Score entry is coming soon"
      description="Director score entry still depends on disabled admin match APIs, so it has been removed from the MVP launch scope."
      backHref={`/${sport}`}
      backLabel="Back to sport home"
    />
  );
}
