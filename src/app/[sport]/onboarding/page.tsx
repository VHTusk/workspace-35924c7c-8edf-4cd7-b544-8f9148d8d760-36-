"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function OnboardingPage() {
  const params = useParams();
  const sport = params.sport as string;
  const safeSport = sport === "cornhole" || sport === "darts" ? sport : "cornhole";

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
          Coming Soon
        </p>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          Guided onboarding is not part of the launch build yet.
        </h1>
        <p className="mt-4 text-base text-gray-600">
          You can continue using the live MVP from the main {safeSport} experience.
        </p>
        <Link
          href={`/${safeSport}`}
          className="mt-8 inline-flex rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
        >
          Back to app
        </Link>
      </div>
    </main>
  );
}
