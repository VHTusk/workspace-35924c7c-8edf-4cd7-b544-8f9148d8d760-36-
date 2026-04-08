"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Calendar, Check, ChevronRight, ClipboardList, Crown, ShieldCheck, Swords, Target, Trophy } from "lucide-react";
import GoogleOneTap from "@/components/auth/google-one-tap";
import { AUTH_SPORTS } from "@/components/auth/auth-sport-config";
import { UniversalLoginModal } from "@/components/auth/universal-login-modal";
import { UniversalRegisterModal } from "@/components/auth/universal-register-modal";
import SiteFooter from "@/components/layout/site-footer";
import { ThemeToggleCompact } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const WHAT_YOU_CAN_DO = [
  {
    title: "Join tournaments",
    description: "Enter competitions organized by ValorHive and choose the sport-city path you want to grow in.",
    icon: Trophy,
  },
  {
    title: "Play structured matches",
    description: "Compete in verified formats with cleaner operations, smoother brackets, and clearer progression.",
    icon: Swords,
  },
  {
    title: "Track rankings",
    description: "See how every verified result moves your standing and what to chase next.",
    icon: Crown,
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Sign up", description: "Create your account." },
  { step: "02", title: "Choose sport", description: "Start with the sport you want to play right now." },
  { step: "03", title: "Join tournament", description: "Register in the city and format that fits you." },
  { step: "04", title: "Play and get ranked", description: "Climb the leaderboard after each verified match." },
];

const ORGANIZER_POINTS = [
  "Organizes structured tournaments under one trusted platform.",
  "Runs recurring competitions that help players compete regularly.",
  "Maintains rankings so performance compounds over time.",
  "Standardizes match formats, operations, and player experience.",
  "Builds a stronger sports ecosystem city by city.",
];

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authView, setAuthView] = useState<"login" | "register" | null>(null);

  useEffect(() => {
    const authParam = searchParams.get("auth");
    if (authParam === "login" || authParam === "register") {
      setAuthView(authParam);
      return;
    }

    setAuthView((current) => (current && !searchParams.get("auth") ? null : current));
  }, [searchParams]);

  const openAuth = (view: "login" | "register") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("auth", view);
    router.replace(params.size ? `/?${params.toString()}` : "/");
  };

  const handleAuthChange = (view: "login" | "register" | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view) {
      params.set("auth", view);
      setAuthView(view);
    } else {
      params.delete("auth");
      setAuthView(null);
    }
    router.replace(params.size ? `/?${params.toString()}` : "/");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <GoogleOneTap showButton={false} autoPrompt />

      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/logo.png" alt="VALORHIVE" width={36} height={36} className="h-9 w-auto" priority />
            <div>
              <p className="text-base font-semibold text-foreground">VALORHIVE</p>
              <p className="text-xs text-muted-foreground">Structured tournament play</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => openAuth("login")}>
              Log In
            </Button>
            <Button onClick={() => openAuth("register")}>Register</Button>
            <ThemeToggleCompact />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.14),transparent_34%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-8">
              <Badge variant="outline" className="border-border/70 bg-card/70 text-muted-foreground">
                ValorHive-organized tournaments and rankings
              </Badge>
              <div className="space-y-5">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Play structured tournaments. Get ranked. Compete regularly.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                  ValorHive helps players and organizers show up to a cleaner competition experience, from registration
                  and match operations to rankings that actually move after every verified result.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="gap-2" onClick={() => openAuth("register")}>
                  Create your account
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="gap-2" onClick={() => openAuth("login")}>
                  Log in
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <ClarityPill text="Tournaments organized by ValorHive" />
                <ClarityPill text="Play in your city" />
                <ClarityPill text="Get ranked after every match" />
              </div>
            </div>

            <div className="grid gap-4">
              <Card className="border-border/60 bg-card/85 shadow-xl">
                <CardHeader className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Crown className="h-4 w-4 text-amber-500" />
                    Live leaderboard preview
                  </div>
                  <CardTitle>Know what every verified match changes.</CardTitle>
                  <CardDescription>
                    Rankings, streaks, and city ladders stay visible so players always know what they are climbing toward.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    "See your standing update after each verified result.",
                    "Track city-level consistency before the next tournament.",
                    "Stay ready for the next verified competition.",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-3">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
                      <p className="text-sm text-foreground">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/85 shadow-xl lg:ml-12">
                <CardHeader className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    Tournament operations
                  </div>
                  <CardTitle>From registration to match day, keep the flow structured.</CardTitle>
                  <CardDescription>
                    Players register faster, organizers run formats more consistently, and the post-match ranking loop stays clear.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <InfoCard icon={ClipboardList} title="Recurring events" text="Keep players coming back with repeatable formats." />
                  <InfoCard icon={ShieldCheck} title="Verified results" text="Move rankings only when results are recorded cleanly." />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/25 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-4">
            <TrustPill title="Player access" text="Log in quickly and pick up where you left off." />
            <TrustPill title="City-first competition" text="Find structured play closer to home." />
            <TrustPill title="Verified rankings" text="Standings move after recorded matches." />
            <TrustPill title="Organizer run" text="All tournament flows stay inside ValorHive." />
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-10">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">What you can do here</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">A cleaner path from sign-up to repeat competition.</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {WHAT_YOU_CAN_DO.map((item) => (
                <Card key={item.title} className="border-border/60 shadow-sm">
                  <CardHeader>
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-10">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">Choose your sport</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Start where you compete today.</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {AUTH_SPORTS.map((sport) => {
                const Icon = sport.icon;

                return (
                  <Card key={sport.slug} className="overflow-hidden border-border/60 shadow-sm">
                    <CardContent className={`relative p-0`}>
                      <div className={`absolute inset-0 opacity-90 ${sport.slug === "cornhole" ? "bg-[linear-gradient(135deg,rgba(22,163,74,0.95),rgba(5,150,105,0.82))]" : "bg-[linear-gradient(135deg,rgba(13,148,136,0.95),rgba(6,182,212,0.82))]"}`} />
                      <div className="relative flex min-h-[280px] flex-col justify-between p-8 text-white">
                        <div className="space-y-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-3xl font-semibold">{sport.label}</p>
                              <p className="mt-2 text-white/85">{sport.tagline}</p>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
                              <Icon className="h-6 w-6" />
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <GlassStat label="Account access" value="Direct" />
                            <GlassStat label="Play style" value="Structured" />
                            <GlassStat label="Result flow" value="Ranked" />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Button asChild variant="secondary" className="border-0 bg-white text-slate-900 hover:bg-white/90">
                            <Link href={sport.tournamentsHref}>Play tournaments</Link>
                          </Button>
                          <Button asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                            <Link href={sport.leaderboardHref}>View leaderboard</Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/25 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-10">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">How it works</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Simple enough to start fast, structured enough to stay competitive.</h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-4">
              {HOW_IT_WORKS.map((item) => (
                <Card key={item.step} className="border-border/60 shadow-sm">
                  <CardHeader>
                    <Badge variant="outline" className="w-fit border-border/70 bg-background text-foreground">
                      {item.step}
                    </Badge>
                    <CardTitle className="pt-3">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">What ValorHive does</p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">We are building the operating layer for regular, trusted competition.</h2>
              <p className="text-base leading-7 text-muted-foreground">
                The goal is not just to list events. ValorHive is meant to organize, standardize, and compound how
                players compete over time.
              </p>
            </div>
            <Card className="border-border/60 shadow-sm">
              <CardContent className="space-y-4 p-6">
                {ORGANIZER_POINTS.map((point) => (
                  <div key={point} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-4">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <p className="text-sm leading-6 text-foreground">{point}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <SiteFooter />

      <UniversalLoginModal
        open={authView === "login"}
        onOpenChange={(open) => handleAuthChange(open ? "login" : null)}
        onSwitchToRegister={() => handleAuthChange("register")}
      />
      <UniversalRegisterModal
        open={authView === "register"}
        onOpenChange={(open) => handleAuthChange(open ? "register" : null)}
        onSwitchToLogin={() => handleAuthChange("login")}
      />
    </div>
  );
}

function ClarityPill({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm text-foreground shadow-sm backdrop-blur">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-emerald-500" />
        <span>{text}</span>
      </div>
    </div>
  );
}

function TrustPill({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Target;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function GlassStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-center backdrop-blur">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-white/80">{label}</p>
    </div>
  );
}
