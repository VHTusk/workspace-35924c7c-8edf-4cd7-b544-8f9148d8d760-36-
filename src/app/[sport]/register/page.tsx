"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuthSportOption } from "@/components/auth/auth-sport-config";
import { UniversalRegisterPanel } from "@/components/auth/universal-register-panel";

export default function SportRegisterPage() {
  const params = useParams();
  const router = useRouter();
  const sportSlug = typeof params.sport === "string" ? params.sport : "cornhole";
  const sport = getAuthSportOption(sportSlug);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href={`/${sport.slug}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {sport.label}
          </Link>
          <Link href="/" className="inline-flex items-center gap-3">
            <img src="/logo.png" alt="VALORHIVE" className="h-10 w-auto" />
            <span className="text-lg font-semibold text-foreground">VALORHIVE</span>
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-5">
            <div
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${sport.accentBorder} ${sport.accentBackground} ${sport.accentText}`}
            >
              {sport.label}
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Create your account with the same clean signup box.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Start with a focused registration flow, then continue into tournaments, rankings, and the rest of your
                sport experience.
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-xl">
            <UniversalRegisterPanel
              initialSport={sport.slug}
              onSwitchToLogin={() => router.push(`/${sport.slug}/login`)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
