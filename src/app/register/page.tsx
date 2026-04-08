import Link from "next/link";
import Image from "next/image";
import { UniversalRegisterPanel } from "@/components/auth/universal-register-panel";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/logo.png" alt="VALORHIVE" width={40} height={40} className="h-10 w-auto" priority />
            <span className="text-lg font-semibold text-foreground">VALORHIVE</span>
          </Link>
          <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Back to home
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-5 pt-2">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Start here
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Create one VALORHIVE account and carry it into every match that matters.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              Register as a player or organization, verify with the method that suits you, and enter your sport with
              the same account from your first tournament to your next leaderboard climb.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoPill label="Google or OTP" text="Fast onboarding for players and teams." />
              <InfoPill label="Sport choice" text="Pick the sport you want to enter first." />
              <InfoPill label="Consent built in" text="Tournament and privacy acknowledgements are handled up front." />
            </div>
          </div>

          <UniversalRegisterPanel />
        </div>
      </div>
    </div>
  );
}

function InfoPill({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
