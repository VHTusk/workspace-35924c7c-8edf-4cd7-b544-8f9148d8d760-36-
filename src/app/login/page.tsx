import Link from "next/link";
import Image from "next/image";
import { UniversalLoginPanel } from "@/components/auth/universal-login-panel";

export default function LoginPage() {
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

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-5 pt-2">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Universal account
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Log in once. Play across every structured sport we support.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              Choose your sport, continue with Google, WhatsApp, email, or phone, and head straight into rankings,
              tournaments, and your dashboard without juggling separate identities.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoPill label="One account" text="Works across supported sports." />
              <InfoPill label="Sport-aware" text="Routes you into the right dashboard." />
              <InfoPill label="Organizer-ready" text="Players and organizations use the same gateway." />
            </div>
          </div>

          <UniversalLoginPanel />
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
