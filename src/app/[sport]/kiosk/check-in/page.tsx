"use client";

import { useParams } from "next/navigation";
import { MvpDisabledPage } from "@/components/mvp-disabled-page";

export default function KioskCheckInPage() {
  const params = useParams();
  const sport = params.sport as string;

  return (
    <MvpDisabledPage
      title="Venue kiosk check-in is coming soon"
      description="The kiosk flow still depends on a disabled check-in backend, so it has been removed from the MVP deployment path."
      backHref={`/${sport}`}
      backLabel="Back to sport home"
    />
  );
}
