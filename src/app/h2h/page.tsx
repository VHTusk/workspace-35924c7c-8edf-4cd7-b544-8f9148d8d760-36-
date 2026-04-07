import { Metadata } from "next";
import { MvpDisabledPage } from "@/components/mvp-disabled-page";

export const metadata: Metadata = {
  title: "Head-to-Head Comparison | VALORHIVE",
  description: "This feature is temporarily unavailable in the MVP production deployment.",
  openGraph: {
    title: "Head-to-Head Comparison | VALORHIVE",
    description: "This feature is temporarily unavailable in the MVP production deployment.",
    type: "website",
    images: ["/api/og/h2h"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Head-to-Head Comparison | VALORHIVE",
    description: "This feature is temporarily unavailable in the MVP production deployment.",
  },
};

export default function H2HPage() {
  return (
    <MvpDisabledPage
      title="Head-to-head comparison is coming soon"
      description="The public H2H experience depends on challenge APIs that are not ready for the first production launch, so it has been disabled for MVP."
      backHref="/"
      backLabel="Back to home"
    />
  );
}
