"use client";

import { useParams } from "next/navigation";
import { MvpDisabledPage } from "@/components/mvp-disabled-page";

export default function CheckInPage() {
  const params = useParams();
  const sport = params.sport as string;

  return (
    <MvpDisabledPage
      title="Director check-in is coming soon"
      description="This director workflow still depends on disabled tournament operations APIs, so it has been postponed for the MVP launch."
      backHref={`/${sport}`}
      backLabel="Back to sport home"
    />
  );
}
