"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Flag,
  Globe2,
  MapPin,
  Medal,
  ShieldCheck,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import GoogleOneTap from "@/components/auth/google-one-tap";
import { AUTH_SPORTS } from "@/components/auth/auth-sport-config";
import { UniversalLoginModal } from "@/components/auth/universal-login-modal";
import { UniversalRegisterModal } from "@/components/auth/universal-register-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const HOW_IT_WORKS = [
  {
    title: "Register",
    description: "Create your account and get ready to compete.",
    icon: Users,
  },
  {
    title: "Find Tournaments",
    description: "Discover recurring competitions in your city.",
    icon: MapPin,
  },
  {
    title: "Compete",
    description: "Play in structured formats with verified results.",
    icon: Trophy,
  },
  {
    title: "Earn Points",
    description: "Watch your standing improve after every match.",
    icon: Medal,
  },
  {
    title: "Rise Up",
    description: "Progress through stronger competition over time.",
    icon: Flag,
  },
];

const FEATURE_CARDS = [
  {
    title: "Tournament Management",
    description: "Structured scheduling, organized registration, and smoother match-day flow.",
    icon: BadgeCheck,
  },
  {
    title: "Dual Rating System",
    description: "Track consistency and movement with results that update your ranking.",
    icon: BarChart3,
  },
  {
    title: "Geographic Tiers",
    description: "District, state, and national pathways that connect local play to bigger stages.",
    icon: Globe2,
  },
  {
    title: "Fair Play System",
    description: "Verified outcomes, transparent progression, and repeatable competition standards.",
    icon: ShieldCheck,
  },
];

const STATS = [
  { value: "500+", label: "Competitions", color: "text-emerald-500", icon: Trophy },
  { value: "10,000+", label: "Players", color: "text-cyan-500", icon: Users },
  { value: "50+", label: "Cities", color: "text-amber-500", icon: MapPin },
  { value: "350L+", label: "Prize Pool", color: "text-violet-500", icon: Star },
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
    <div className="min-h-screen bg-[#f8fbfd] text-slate-900">
      <GoogleOneTap showButton={false} autoPrompt />

      <header className="sticky top-0 z-40 border-b border-[#18AFCE]/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/logo.png" alt="VALORHIVE" width={34} height={34} className="h-9 w-auto" priority />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-[#060E11]">
                <span>VALOR</span>
                <span className="text-[#EE5D0E]">HIVE</span>
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/tournaments" className="text-sm font-medium text-slate-500 transition-colors hover:text-[#18AFCE]">
              Tournaments
            </Link>
            <Link href="/cornhole/leaderboard" className="text-sm font-medium text-slate-500 transition-colors hover:text-[#18AFCE]">
              Rankings
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="rounded-full border border-[#18AFCE]/20 bg-white px-4 py-2 text-sm font-medium text-[#18AFCE] transition-all hover:bg-[#18AFCE]/8 hover:shadow-[0_10px_22px_rgba(24,175,206,0.10)]"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="rounded-full border border-[#EE5D0E]/25 bg-[#EE5D0E] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#d8530d] hover:shadow-[0_12px_24px_rgba(238,93,14,0.22)]"
            >
              Register
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
          <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(24,175,206,0.12),transparent_58%),radial-gradient(circle_at_20%_20%,rgba(238,93,14,0.10),transparent_28%)]" />
          <div className="mx-auto max-w-5xl text-center">
            <div className="relative rounded-[32px] border border-white/70 bg-white/88 px-6 py-10 shadow-[0_24px_54px_rgba(15,23,42,0.07)] backdrop-blur sm:px-10 sm:py-12">
              <div className="mx-auto inline-flex items-center gap-3 rounded-full border border-[#18AFCE]/15 bg-white px-4 py-2 shadow-sm">
                <Image src="/logo.png" alt="ValorHive mark" width={28} height={28} className="h-7 w-auto" />
                <p className="text-sm font-semibold text-[#060E11]">
                  <span>VALOR</span>
                  <span className="text-[#EE5D0E]">HIVE</span>
                </p>
              </div>

              <div className="mt-8 space-y-4">
                <h1 className="text-3xl font-semibold tracking-tight text-[#060E11] sm:text-4xl lg:text-[2.85rem]">
                  India&apos;s Premier Inclusive Sports Ecosystem
                </h1>
                <p className="mx-auto max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
                  Every sport. Every city. One ecosystem where competitions stay structured and rankings keep moving.
                </p>
              </div>

              <div className="mt-7 flex justify-center">
                <div className="inline-flex rounded-full border border-[#18AFCE]/12 bg-[#f9fbfd] p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => openAuth("login")}
                    className="rounded-full px-5 py-2 text-sm font-medium text-[#18AFCE] transition-colors hover:bg-[#18AFCE]/8"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuth("register")}
                    className="rounded-full bg-[#EE5D0E] px-5 py-2 text-sm font-medium text-white transition-all hover:bg-[#d8530d]"
                  >
                    Register
                  </button>
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Button
                  className="h-12 min-w-[230px] bg-[#EE5D0E] px-6 text-white hover:bg-[#d8530d] hover:shadow-[0_14px_28px_rgba(238,93,14,0.22)]"
                  onClick={() => openAuth("register")}
                >
                  Join Upcoming Competitions
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-12 min-w-[220px] border-[#18AFCE]/24 bg-white text-[#18AFCE] hover:bg-[#18AFCE]/8 hover:text-[#0f8ea8]"
                >
                  <Link href="/tournaments">
                    View Tournaments
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <HeroMiniPill text="Verified match results" />
                <HeroMiniPill text="Recurring city tournaments" />
                <HeroMiniPill text="Rankings that keep moving" />
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#18AFCE]">Choose your sport</p>
              <h2 className="text-2xl font-semibold text-[#060E11]">Choose Your Sport</h2>
              <p className="mt-2 text-sm text-slate-500">
                Structured formats, recurring tournaments, and verified rankings in every sport you play
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {AUTH_SPORTS.map((sport) => {
                const Icon = sport.icon;
                const accent =
                  sport.slug === "cornhole"
                    ? "bg-[linear-gradient(135deg,#19cc62,#0e9e43)]"
                    : "bg-[linear-gradient(135deg,#18AFCE,#0a9ab8)]";

                return (
                  <Card key={sport.slug} className="overflow-hidden border-0 shadow-[0_18px_38px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-1">
                    <CardContent className={`relative p-0 ${accent}`}>
                      <div className="absolute inset-0 opacity-20">
                        <Image
                          src={sport.slug === "cornhole" ? "/images/hero/cornhole/action-shot.png" : "/images/hero/darts/action-shot.png"}
                          alt={`${sport.label} background`}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="relative p-6 text-white">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-2xl font-semibold">{sport.label}</h3>
                            <p className="mt-1 text-sm text-white/85">{sport.tagline}</p>
                          </div>
                          <div className="rounded-xl bg-white/16 p-3">
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>

                        <div className="mt-6 grid gap-3 sm:grid-cols-3">
                          <SportMetric value="5,000+" label="Players" />
                          <SportMetric value="250+" label="Tournaments" />
                          <SportMetric value="INR 25L+" label="Prize Pool" />
                        </div>

                        <div className="mt-7">
                          <Button
                            asChild
                            className="h-10 rounded-full bg-white/18 px-5 text-white backdrop-blur transition-all hover:bg-white/24 hover:shadow-[0_12px_24px_rgba(255,255,255,0.14)]"
                          >
                            <Link href={sport.tournamentsHref}>View Details</Link>
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

        <section className="px-4 py-18 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#18AFCE]">How it works</p>
              <h2 className="text-2xl font-semibold text-[#060E11]">How It Works</h2>
              <p className="mt-2 text-sm text-slate-500">
                Join recurring sports formats in structured competition across seasons and cities
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              {HOW_IT_WORKS.map((item) => (
                <SimpleFeatureCard key={item.title} title={item.title} description={item.description} icon={item.icon} />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[linear-gradient(180deg,rgba(24,175,206,0.03),transparent_60%)] px-4 py-18 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#18AFCE]">Built for champions</p>
              <h2 className="text-2xl font-semibold text-[#060E11]">Built for Champions</h2>
              <p className="mt-2 text-sm text-slate-500">
                Structured tools that make competition repeatable, transparent, and scalable
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {FEATURE_CARDS.map((item) => (
                <SimpleFeatureCard
                  key={item.title}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-18 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#18AFCE]">Growing every day</p>
              <h2 className="text-2xl font-semibold text-[#060E11]">Growing Every Day</h2>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {STATS.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-slate-200/80 bg-white px-5 py-6 text-center shadow-[0_12px_24px_rgba(15,23,42,0.04)]"
                >
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <p className={`text-3xl font-semibold ${item.color}`}>{item.value}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 pt-12 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-[30px] border border-[#18AFCE]/12 bg-[linear-gradient(180deg,#ffffff,#f7fbfd)] px-6 py-12 text-center shadow-[0_18px_38px_rgba(15,23,42,0.06)] sm:px-10">
            <h2 className="text-2xl font-semibold text-[#060E11]">Ready to Start Competing?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
              Join structured sports competitions and start building your ranking today.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                className="h-11 bg-[#19c766] px-6 text-white transition-all hover:bg-[#14b158] hover:shadow-[0_12px_24px_rgba(25,199,102,0.22)]"
                onClick={() => openAuth("register")}
              >
                Get Started
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 border-[#18AFCE]/24 bg-white text-[#18AFCE] hover:bg-[#18AFCE]/8"
              >
                <Link href="/tournaments">View Tournaments</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />

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

function SportMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/18 bg-white/12 px-4 py-3 text-center backdrop-blur">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-white/80">{label}</p>
    </div>
  );
}

function SimpleFeatureCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Trophy;
}) {
  return (
    <Card className="h-full border-slate-200/80 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.04)] transition-transform duration-200 hover:-translate-y-1">
      <CardHeader className="gap-4 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EE5D0E]/10">
          <Icon className="h-4 w-4 text-[#EE5D0E]" />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-base text-[#060E11]">{title}</CardTitle>
          <CardDescription className="text-sm leading-6 text-slate-500">{description}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}

function HeroMiniPill({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[#18AFCE]/10 bg-[#f9fbfd] px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
      {text}
    </div>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="ValorHive" width={28} height={28} className="h-7 w-auto" />
            <p className="text-sm font-semibold text-[#060E11]">
              <span>VALOR</span>
              <span className="text-[#EE5D0E]">HIVE</span>
            </p>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Structured sports competitions with verified results, city-level tournaments, and rankings that keep
            progressing.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#060E11]">Quick Links</p>
          <div className="mt-3 space-y-2 text-sm text-slate-500">
            <Link href="/cornhole" className="block hover:text-[#18AFCE]">
              Cornhole
            </Link>
            <Link href="/darts" className="block hover:text-[#18AFCE]">
              Darts
            </Link>
            <Link href="/tournaments" className="block hover:text-[#18AFCE]">
              Tournaments
            </Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#060E11]">Support</p>
          <div className="mt-3 space-y-2 text-sm text-slate-500">
            <p>support@valorhive.com</p>
            <p>+91 98765 43210</p>
            <p>Mon-Sat, 9AM-6PM</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#060E11]">Legal</p>
          <div className="mt-3 space-y-2 text-sm text-slate-500">
            <Link href="/legal/privacy" className="block hover:text-[#18AFCE]">
              Privacy Policy
            </Link>
            <Link href="/legal/terms" className="block hover:text-[#18AFCE]">
              Terms of Service
            </Link>
            <Link href="/admin/login" className="block hover:text-[#18AFCE]">
              Office Use Only
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 sm:px-6">
        © {new Date().getFullYear()} VALORHIVE. All rights reserved.
      </div>
    </footer>
  );
}
